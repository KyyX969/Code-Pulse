import crypto from 'node:crypto';
import { Router } from 'express';
import { config } from '../config.ts';
import { getStore } from '../db/index.ts';
import { toPublicWorkspace } from '../db/types.ts';
import { requireAuth, requireWorkspaceLeader } from '../middleware/auth.ts';
import {
  enableBranchProtectionOnMain,
  fetchUserGitHubRepos,
  registerGitHubWebhook,
} from '../services/githubService.ts';
import type { UserRole, VercelEnvVarInput } from '../../../shared/types.ts';
import {
  deleteVercelEnvVar,
  fetchVercelProjects,
  getVercelProjectConfig,
  inspectGitHubRepoPackage,
  provisionVercelProject,
} from '../services/vercelService.ts';
import { decryptToken, encryptToken } from '../utils/crypto.ts';
import { realtimeHub } from '../ws/realtime.ts';

export const workspacesRouter = Router();

workspacesRouter.get('/', requireAuth, async (req, res) => {
  const store = await getStore();
  const workspaces = await store.listWorkspaces();
  const userId = req.currentUser!.id;
  const visible = workspaces.filter(
    (ws) => ws.ownerId === userId || ws.members.some((m) => m.userId === userId),
  );
  res.json({ workspaces: visible.map(toPublicWorkspace) });
});

workspacesRouter.post('/', requireAuth, async (req, res) => {
  const { name, description } = req.body as { name?: string; description?: string };
  if (!name || name.trim().length < 2) {
    res.status(400).json({ error: 'Workspace name must be at least 2 characters' });
    return;
  }

  const store = await getStore();
  const created = await store.createWorkspace({
    name: name.trim(),
    description: description?.trim() || '',
    ownerId: req.currentUser!.id,
  });
  res.status(201).json({ workspace: toPublicWorkspace(created) });
});

workspacesRouter.get('/integrations/github-repos', requireAuth, async (req, res) => {
  if (!req.currentUser?.githubTokenEncrypted) {
    res.json({
      repos: [],
      source: 'unconnected',
      message: 'Connect GitHub OAuth to browse your live repositories.',
    });
    return;
  }
  try {
    const token = decryptToken(req.currentUser.githubTokenEncrypted);
    const repos = await fetchUserGitHubRepos(token);
    res.json({ repos, source: 'github' });
  } catch (err) {
    res.status(502).json({
      error: err instanceof Error ? err.message : 'Failed to fetch GitHub repos',
    });
  }
});

workspacesRouter.get('/integrations/vercel-projects', requireAuth, async (req, res) => {
  if (!req.currentUser?.vercelTokenEncrypted) {
    res.json({
      projects: [],
      source: 'unconnected',
    });
    return;
  }
  const token = decryptToken(req.currentUser.vercelTokenEncrypted);
  if (token.startsWith('demo_')) {
    res.json({
      projects: [
        {
          id: 'prj_campussync_demo',
          name: 'campussync-portal',
          framework: 'vite',
          latestUrl: 'https://campussync-portal.vercel.app',
        },
      ],
      source: 'demo',
    });
    return;
  }
  try {
    const projects = await fetchVercelProjects(token, req.currentUser?.vercelTeamId);
    res.json({ projects, source: 'vercel' });
  } catch (err) {
    res.status(502).json({
      error: err instanceof Error ? err.message : 'Failed to fetch Vercel projects',
    });
  }
});

workspacesRouter.get('/:id', requireAuth, async (req, res) => {
  const store = await getStore();
  const ws = await store.getWorkspaceById(String(req.params.id));
  if (!ws) {
    res.status(404).json({ error: 'Workspace not found' });
    return;
  }
  res.json({ workspace: toPublicWorkspace(ws) });
});

workspacesRouter.patch('/:id', requireWorkspaceLeader, async (req, res) => {
  const { name, description } = req.body as {
    name?: string;
    description?: string;
  };

  if (name !== undefined && name.trim().length < 2) {
    res.status(400).json({ error: 'Project name must be at least 2 characters' });
    return;
  }

  const store = await getStore();
  const patch: { name?: string; description?: string } = {};
  if (name !== undefined) patch.name = name.trim();
  if (description !== undefined) patch.description = description.trim();

  const updated = await store.updateWorkspace(String(req.params.id), patch);
  if (!updated) {
    res.status(404).json({ error: 'Workspace not found' });
    return;
  }

  const publicWs = toPublicWorkspace(updated);
  realtimeHub.broadcastToWorkspace(updated.id, {
    type: 'workspace:updated',
    workspace: publicWs,
  });

  res.json({ workspace: publicWs });
});

workspacesRouter.delete('/:id', requireWorkspaceLeader, async (req, res) => {
  const workspaceId = String(req.params.id);
  const store = await getStore();
  const deleted = await store.deleteWorkspace(workspaceId);
  if (!deleted) {
    res.status(404).json({ error: 'Workspace not found' });
    return;
  }
  res.json({ ok: true, deletedId: workspaceId });
});

workspacesRouter.post('/:id/connect-repo', requireWorkspaceLeader, async (req, res) => {
  const { owner, repo, repoId, defaultBranch, enableProtection } = req.body as {
    owner?: string;
    repo?: string;
    repoId?: number;
    defaultBranch?: string;
    enableProtection?: boolean;
  };

  if (!owner?.trim() || !repo?.trim()) {
    res.status(400).json({ error: 'GitHub owner and repo name are required' });
    return;
  }

  const store = await getStore();
  const ws = await store.getWorkspaceById(String(req.params.id));
  if (!ws) {
    res.status(404).json({ error: 'Workspace not found' });
    return;
  }

  const branch = defaultBranch?.trim() || 'main';
  let branchProtected = enableProtection !== false;
  let webhookId = ws.webhookId;
  let webhookSecretEncrypted = ws.webhookSecretEncrypted;
  const notices: string[] = [];

  if (req.currentUser?.githubTokenEncrypted) {
    const ghToken = decryptToken(req.currentUser.githubTokenEncrypted);
    if (branchProtected) {
      const bpResult = await enableBranchProtectionOnMain(
        ghToken,
        owner.trim(),
        repo.trim(),
        branch,
      );
      notices.push(bpResult.message);
      branchProtected = bpResult.ok;
    }

    const secret = config.github.webhookSecret || crypto.randomBytes(24).toString('hex');
    const webhookUrl = `${config.apiPublicUrl.replace(/\/$/, '')}/api/webhooks/github`;
    const hookResult = await registerGitHubWebhook(
      ghToken,
      owner.trim(),
      repo.trim(),
      webhookUrl,
      secret,
    );
    notices.push(hookResult.message);
    if (hookResult.ok) {
      webhookId = hookResult.webhookId;
      webhookSecretEncrypted = encryptToken(secret);
    }
  } else {
    notices.push(
      `Repository linked in CodePulse Gatekeeper mode. Branch "${branch}" protection policy enforced.`,
    );
  }

  const updated = await store.updateWorkspace(ws.id, {
    githubOwner: owner.trim(),
    githubRepo: repo.trim(),
    githubRepoId: repoId ?? ws.githubRepoId ?? Math.floor(10000000 + Math.random() * 90000000),
    defaultBranch: branch,
    branchProtected,
    webhookId,
    webhookSecretEncrypted,
    webhookActive: true,
  });

  const publicWs = toPublicWorkspace(updated!);
  realtimeHub.broadcastToWorkspace(ws.id, {
    type: 'workspace:updated',
    workspace: publicWs,
  });

  res.json({ workspace: publicWs, notices });
});

workspacesRouter.post('/:id/connect-vercel', requireWorkspaceLeader, async (req, res) => {
  const { projectId, projectName, autoDeployOnMerge } = req.body as {
    projectId?: string;
    projectName?: string;
    autoDeployOnMerge?: boolean;
  };

  if (!projectName?.trim()) {
    res.status(400).json({ error: 'Vercel project name is required' });
    return;
  }

  let resolvedProjectId = projectId?.trim() || '';
  if (!resolvedProjectId && req.currentUser?.vercelTokenEncrypted) {
    try {
      const token = decryptToken(req.currentUser.vercelTokenEncrypted);
      if (!token.startsWith('demo_')) {
        const projects = await fetchVercelProjects(token);
        const match = projects.find(
          (p) => p.name.toLowerCase() === projectName.trim().toLowerCase(),
        );
        if (match) resolvedProjectId = match.id;
      }
    } catch {
      // fall back below if Vercel lookup fails
    }
  }

  const store = await getStore();
  const updated = await store.updateWorkspace(String(req.params.id), {
    vercelProjectId: resolvedProjectId || `prj_${projectName.trim().toLowerCase()}`,
    vercelProjectName: projectName.trim(),
    autoDeployOnMerge: autoDeployOnMerge ?? true,
  });

  if (!updated) {
    res.status(404).json({ error: 'Workspace not found' });
    return;
  }

  const publicWs = toPublicWorkspace(updated);
  realtimeHub.broadcastToWorkspace(updated.id, {
    type: 'workspace:updated',
    workspace: publicWs,
  });

  res.json({ workspace: publicWs });
});

workspacesRouter.get('/:id/vercel/detect', requireAuth, async (req, res) => {
  const store = await getStore();
  const ws = await store.getWorkspaceById(String(req.params.id));
  if (!ws) {
    res.status(404).json({ error: 'Workspace not found' });
    return;
  }

  const githubToken = req.currentUser?.githubTokenEncrypted
    ? decryptToken(req.currentUser.githubTokenEncrypted)
    : null;
  const vercelToken = req.currentUser?.vercelTokenEncrypted
    ? decryptToken(req.currentUser.vercelTokenEncrypted)
    : null;

  const detected =
    ws.githubOwner && ws.githubRepo
      ? await inspectGitHubRepoPackage({
          githubToken,
          owner: ws.githubOwner,
          repo: ws.githubRepo,
          branch: ws.defaultBranch,
        })
      : {
          framework: null,
          label: 'Static / Other',
          buildCommand: '',
          outputDirectory: '',
          installCommand: '',
          rootDirectory: '',
          packageJsonFound: false,
        };

  let config = null;
  let envVars: Array<{ id: string; key: string; type: string; target: string[] }> = [];
  if (vercelToken && !vercelToken.startsWith('demo_') && ws.vercelProjectId) {
    try {
      const details = await getVercelProjectConfig(
        vercelToken,
        ws.vercelProjectId,
        req.currentUser?.vercelTeamId,
      );
      config = details.config;
      envVars = details.envVars;
    } catch {
      // project may not exist remotely yet
    }
  }

  res.json({ detected, config, envVars });
});

workspacesRouter.post('/:id/vercel/provision', requireWorkspaceLeader, async (req, res) => {
  const {
    projectName,
    framework,
    rootDirectory,
    buildCommand,
    outputDirectory,
    installCommand,
    autoDeployOnMerge,
    environmentVariables,
  } = req.body as {
    projectName?: string;
    framework?: string | null;
    rootDirectory?: string | null;
    buildCommand?: string | null;
    outputDirectory?: string | null;
    installCommand?: string | null;
    autoDeployOnMerge?: boolean;
    environmentVariables?: VercelEnvVarInput[];
  };

  if (!projectName?.trim()) {
    res.status(400).json({ error: 'Vercel project name is required' });
    return;
  }

  const store = await getStore();
  const ws = await store.getWorkspaceById(String(req.params.id));
  if (!ws) {
    res.status(404).json({ error: 'Workspace not found' });
    return;
  }

  const vercelToken = req.currentUser?.vercelTokenEncrypted
    ? decryptToken(req.currentUser.vercelTokenEncrypted)
    : null;

  if (!vercelToken) {
    res.status(400).json({
      error: 'Link your Vercel Personal Access Token first before provisioning a Vercel project.',
    });
    return;
  }

  // Offline demo fallback
  if (vercelToken.startsWith('demo_')) {
    const slug = projectName.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
    const updated = await store.updateWorkspace(ws.id, {
      vercelProjectId: ws.vercelProjectId || `prj_demo_${slug}`,
      vercelProjectName: slug,
      autoDeployOnMerge: autoDeployOnMerge ?? true,
    });
    const publicWs = toPublicWorkspace(updated!);
    realtimeHub.broadcastToWorkspace(ws.id, { type: 'workspace:updated', workspace: publicWs });
    res.json({
      workspace: publicWs,
      created: !ws.vercelProjectId,
      config: {
        projectId: publicWs.vercelProjectId!,
        projectName: slug,
        framework: framework ?? null,
        rootDirectory: rootDirectory ?? null,
        buildCommand: buildCommand ?? null,
        outputDirectory: outputDirectory ?? null,
        installCommand: installCommand ?? null,
      },
      envVars: [],
    });
    return;
  }

  try {
    const result = await provisionVercelProject({
      token: vercelToken,
      teamId: req.currentUser?.vercelTeamId,
      existingProjectId: ws.vercelProjectId,
      projectName: projectName.trim(),
      framework: framework ?? null,
      rootDirectory: rootDirectory ?? null,
      buildCommand: buildCommand ?? null,
      outputDirectory: outputDirectory ?? null,
      installCommand: installCommand ?? null,
      environmentVariables,
    });

    const updated = await store.updateWorkspace(ws.id, {
      vercelProjectId: result.projectId,
      vercelProjectName: result.projectName,
      autoDeployOnMerge: autoDeployOnMerge ?? true,
    });

    const publicWs = toPublicWorkspace(updated!);
    realtimeHub.broadcastToWorkspace(ws.id, {
      type: 'workspace:updated',
      workspace: publicWs,
    });

    res.json({
      workspace: publicWs,
      created: result.created,
      config: result.config,
      envVars: result.envVars,
    });
  } catch (err) {
    res.status(502).json({
      error: err instanceof Error ? err.message : 'Failed to provision project on Vercel',
    });
  }
});

workspacesRouter.delete('/:id/vercel/env/:envId', requireWorkspaceLeader, async (req, res) => {
  const store = await getStore();
  const ws = await store.getWorkspaceById(String(req.params.id));
  if (!ws || !ws.vercelProjectId) {
    res.status(404).json({ error: 'Linked Vercel project not found' });
    return;
  }

  const vercelToken = req.currentUser?.vercelTokenEncrypted
    ? decryptToken(req.currentUser.vercelTokenEncrypted)
    : null;
  if (!vercelToken) {
    res.status(400).json({ error: 'Vercel token is not linked' });
    return;
  }

  try {
    if (!vercelToken.startsWith('demo_')) {
      await deleteVercelEnvVar(
        vercelToken,
        ws.vercelProjectId,
        String(req.params.envId),
        req.currentUser?.vercelTeamId,
      );
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(502).json({
      error: err instanceof Error ? err.message : 'Failed to delete environment variable',
    });
  }
});

// Workspace Team Members & Invitations
workspacesRouter.get('/:id/invitations', requireAuth, async (req, res) => {
  const store = await getStore();
  const ws = await store.getWorkspaceById(String(req.params.id));
  if (!ws) {
    res.status(404).json({ error: 'Workspace not found' });
    return;
  }
  const invitations = await store.listWorkspaceInvitations(ws.id);
  res.json({ invitations });
});

workspacesRouter.post('/:id/invitations', requireWorkspaceLeader, async (req, res) => {
  const { target, role, message } = req.body as {
    target?: string;
    role?: UserRole;
    message?: string;
  };

  const inviteRole: UserRole = role === 'leader' ? 'leader' : 'member';
  const rawTarget = (target || '').trim();
  const isEmail = rawTarget.includes('@') && rawTarget.includes('.') && !rawTarget.startsWith('@');
  const inviteeEmail = isEmail ? rawTarget.toLowerCase() : null;
  const inviteeUsername = !isEmail && rawTarget ? rawTarget.replace(/^@/, '').trim() : null;

  const store = await getStore();
  const ws = await store.getWorkspaceById(String(req.params.id));
  if (!ws) {
    res.status(404).json({ error: 'Workspace not found' });
    return;
  }

  // Prevent duplicate invite if user is already a member of this workspace
  if (inviteeUsername) {
    const alreadyMember = ws.members.some(
      (m) => m.username.toLowerCase() === inviteeUsername.toLowerCase(),
    );
    if (alreadyMember) {
      res.status(409).json({ error: `@${inviteeUsername} is already a member of this project.` });
      return;
    }
  }
  if (inviteeEmail) {
    const matchedUser = await store.getUserByEmail(inviteeEmail);
    if (matchedUser && ws.members.some((m) => m.userId === matchedUser.id)) {
      res.status(409).json({ error: `${inviteeEmail} is already a member of this project.` });
      return;
    }
  }

  const invitation = await store.createInvitation({
    workspaceId: ws.id,
    inviterId: req.currentUser!.id,
    inviteeUsername,
    inviteeEmail,
    role: inviteRole,
    message: message?.trim() || '',
  });

  realtimeHub.broadcastToWorkspace(ws.id, {
    type: 'invitation:updated',
    workspaceId: ws.id,
    invitation,
  });

  res.status(201).json({ invitation });
});

workspacesRouter.patch('/:id/members/:userId', requireWorkspaceLeader, async (req, res) => {
  const { role } = req.body as { role?: UserRole };
  if (role !== 'leader' && role !== 'member') {
    res.status(400).json({ error: 'Valid role ("leader" or "member") is required' });
    return;
  }
  const store = await getStore();
  const ws = await store.getWorkspaceById(String(req.params.id));
  if (!ws) {
    res.status(404).json({ error: 'Workspace not found' });
    return;
  }
  if (ws.ownerId === String(req.params.userId)) {
    res.status(400).json({ error: 'Cannot change the role of the workspace owner' });
    return;
  }

  const updated = await store.updateWorkspaceMemberRole(ws.id, String(req.params.userId), role);
  if (!updated) {
    res.status(404).json({ error: 'Member not found in this workspace' });
    return;
  }
  const publicWs = toPublicWorkspace(updated);
  realtimeHub.broadcastToWorkspace(ws.id, { type: 'workspace:updated', workspace: publicWs });
  res.json({ workspace: publicWs });
});

workspacesRouter.delete('/:id/members/:userId', requireWorkspaceLeader, async (req, res) => {
  const store = await getStore();
  const ws = await store.getWorkspaceById(String(req.params.id));
  if (!ws) {
    res.status(404).json({ error: 'Workspace not found' });
    return;
  }
  if (ws.ownerId === String(req.params.userId)) {
    res.status(400).json({ error: 'Cannot remove the workspace owner' });
    return;
  }

  const updated = await store.removeWorkspaceMember(ws.id, String(req.params.userId));
  if (!updated) {
    res.status(404).json({ error: 'Member not found' });
    return;
  }
  const publicWs = toPublicWorkspace(updated);
  realtimeHub.broadcastToWorkspace(ws.id, { type: 'workspace:updated', workspace: publicWs });
  res.json({ workspace: publicWs });
});

