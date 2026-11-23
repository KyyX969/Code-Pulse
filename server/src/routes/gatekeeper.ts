import crypto from 'node:crypto';
import { Router } from 'express';
import { getStore } from '../db/index.js';
import { toPublicWorkspace } from '../db/types.js';
import { requireAuth, requireWorkspaceLeader } from '../middleware/auth.js';
import {
  enableBranchProtectionOnMain,
  fetchGitHubDiff,
  mergeGitHubTask,
} from '../services/githubService.js';
import { triggerVercelDeployment } from '../services/vercelService.js';
import { decryptToken } from '../utils/crypto.js';
import { realtimeHub } from '../ws/realtime.js';

export const gatekeeperRouter = Router({ mergeParams: true });

gatekeeperRouter.post('/branch-protection/toggle', requireWorkspaceLeader, async (req, res) => {
  const workspaceId = String(req.params.workspaceId);
  const { enabled } = req.body as { enabled?: boolean };

  const store = await getStore();
  const ws = await store.getWorkspaceById(workspaceId);
  if (!ws) {
    res.status(404).json({ error: 'Workspace not found' });
    return;
  }

  const targetState = enabled !== undefined ? Boolean(enabled) : !ws.branchProtected;
  let notice = targetState
    ? `Branch protection enforced on "${ws.defaultBranch}" (Zero Direct Push active).`
    : `Branch protection relaxed on "${ws.defaultBranch}".`;

  if (targetState && req.currentUser?.githubTokenEncrypted && ws.githubOwner && ws.githubRepo) {
    const token = decryptToken(req.currentUser.githubTokenEncrypted);
    const ghRes = await enableBranchProtectionOnMain(
      token,
      ws.githubOwner,
      ws.githubRepo,
      ws.defaultBranch,
    );
    notice = ghRes.message;
  }

  const updated = await store.updateWorkspace(workspaceId, {
    branchProtected: targetState,
  });
  const publicWs = toPublicWorkspace(updated!);
  realtimeHub.broadcastToWorkspace(workspaceId, {
    type: 'workspace:updated',
    workspace: publicWs,
  });

  res.json({ workspace: publicWs, notice });
});

gatekeeperRouter.get('/tasks/:taskId/diff', requireAuth, async (req, res) => {
  const workspaceId = String(req.params.workspaceId);
  const taskId = String(req.params.taskId);
  const store = await getStore();

  const ws = await store.getWorkspaceById(workspaceId);
  const task = await store.getTaskById(workspaceId, taskId);
  if (!ws || !task) {
    res.status(404).json({ error: 'Workspace or task not found' });
    return;
  }

  if (
    req.currentUser?.githubTokenEncrypted &&
    ws.githubOwner &&
    ws.githubRepo &&
    (task.prNumber || task.branchName)
  ) {
    try {
      const ghToken = decryptToken(req.currentUser.githubTokenEncrypted);
      const liveDiff = await fetchGitHubDiff(ghToken, ws.githubOwner, ws.githubRepo, {
        prNumber: task.prNumber,
        baseBranch: ws.defaultBranch,
        headBranch: task.branchName,
      });
      if (liveDiff) {
        await store.updateTask(workspaceId, taskId, { diffSummary: liveDiff });
        res.json({ diff: liveDiff, source: 'github' });
        return;
      }
    } catch {
      // Fallback to stored diff summary
    }
  }

  res.json({ diff: task.diffSummary, source: 'cached' });
});

gatekeeperRouter.post('/tasks/:taskId/approve-merge', requireWorkspaceLeader, async (req, res) => {
  const workspaceId = String(req.params.workspaceId);
  const taskId = String(req.params.taskId);
  const { reviewComment, triggerDeploy } = req.body as {
    reviewComment?: string;
    triggerDeploy?: boolean;
  };

  const store = await getStore();
  const ws = await store.getWorkspaceById(workspaceId);
  const task = await store.getTaskById(workspaceId, taskId);
  if (!ws || !task) {
    res.status(404).json({ error: 'Workspace or task not found' });
    return;
  }

  let mergeSha = task.latestCommitSha || crypto.randomBytes(4).toString('hex').slice(0, 7);
  let mergeNotice = `Approved & merged ${task.branchName || task.taskCode} into ${ws.defaultBranch}`;

  if (req.currentUser?.githubTokenEncrypted && ws.githubOwner && ws.githubRepo) {
    const ghToken = decryptToken(req.currentUser.githubTokenEncrypted);
    const ghMerge = await mergeGitHubTask(
      ghToken,
      ws.githubOwner,
      ws.githubRepo,
      ws.defaultBranch,
      task,
      req.currentUser.username,
    );
    if (!ghMerge.ok) {
      res.status(409).json({ error: `GitHub Gatekeeper merge failed: ${ghMerge.message}` });
      return;
    }
    if (ghMerge.mergeSha) mergeSha = ghMerge.mergeSha.slice(0, 7);
    mergeNotice = ghMerge.message;
  }

  const prevStatus = task.status;
  const updatedTask = await store.updateTask(workspaceId, taskId, {
    status: 'done',
    latestCommitSha: mergeSha,
    reviewComment: reviewComment?.trim() || 'Approved by Project Leader via Gatekeeper',
    approvedBy: req.currentUser!.id,
    approvedAt: new Date().toISOString(),
  });

  const auditEvent = await store.addWebhookEvent({
    workspaceId,
    eventType: 'gatekeeper_merge',
    deliveryId: `gk-${crypto.randomBytes(3).toString('hex')}`,
    branch: `${task.branchName || 'feature'} -> ${ws.defaultBranch}`,
    actorUsername: req.currentUser!.username,
    commitSha: mergeSha,
    commitMessage: `Approve & Merge ${task.taskCode}: ${task.title}`,
    matchedTaskCode: task.taskCode,
    statusTransition: `${prevStatus} -> done`,
    latencyMs: 24,
    blocked: false,
  });

  if (updatedTask) {
    realtimeHub.broadcastToWorkspace(workspaceId, {
      type: 'task:updated',
      workspaceId,
      task: updatedTask,
    });
  }
  realtimeHub.broadcastToWorkspace(workspaceId, {
    type: 'webhook:received',
    workspaceId,
    event: auditEvent,
  });

  let deployment = null;
  if (triggerDeploy ?? ws.autoDeployOnMerge) {
    const vercelToken = req.currentUser?.vercelTokenEncrypted
      ? decryptToken(req.currentUser.vercelTokenEncrypted)
      : null;
    const githubToken = req.currentUser?.githubTokenEncrypted
      ? decryptToken(req.currentUser.githubTokenEncrypted)
      : null;

    deployment = await triggerVercelDeployment({
      workspaceId,
      taskId: task.id,
      branch: ws.defaultBranch,
      commitSha: mergeSha,
      commitMessage: `Merge ${task.taskCode}: ${task.title}`,
      triggeredBy: req.currentUser!.id,
      triggeredByUsername: req.currentUser!.username,
      vercelToken,
      vercelTeamId: req.currentUser?.vercelTeamId,
      vercelProjectId: ws.vercelProjectId,
      vercelProjectName: ws.vercelProjectName,
      githubToken,
      githubOwner: ws.githubOwner,
      githubRepo: ws.githubRepo,
      githubRepoId: ws.githubRepoId,
    });
  }

  res.json({
    task: updatedTask,
    event: auditEvent,
    deployment,
    notice: mergeNotice,
  });
});

gatekeeperRouter.post('/tasks/:taskId/request-changes', requireWorkspaceLeader, async (req, res) => {
  const workspaceId = String(req.params.workspaceId);
  const taskId = String(req.params.taskId);
  const { reviewComment } = req.body as { reviewComment?: string };

  const store = await getStore();
  const task = await store.getTaskById(workspaceId, taskId);
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  const prevStatus = task.status;
  const updated = await store.updateTask(workspaceId, taskId, {
    status: 'in_progress',
    reviewComment:
      reviewComment?.trim() || 'Changes requested by Project Leader during code review.',
  });

  const auditEvent = await store.addWebhookEvent({
    workspaceId,
    eventType: 'gatekeeper_rejected',
    deliveryId: `gk-${crypto.randomBytes(3).toString('hex')}`,
    branch: task.branchName || 'feature',
    actorUsername: req.currentUser!.username,
    commitSha: task.latestCommitSha,
    commitMessage: reviewComment?.trim() || `Changes requested on ${task.taskCode}`,
    matchedTaskCode: task.taskCode,
    statusTransition: `${prevStatus} -> in_progress`,
    latencyMs: 18,
    blocked: false,
  });

  if (updated) {
    realtimeHub.broadcastToWorkspace(workspaceId, {
      type: 'task:updated',
      workspaceId,
      task: updated,
    });
  }
  realtimeHub.broadcastToWorkspace(workspaceId, {
    type: 'webhook:received',
    workspaceId,
    event: auditEvent,
  });

  res.json({ task: updated, event: auditEvent });
});

