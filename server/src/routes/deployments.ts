import { Router } from 'express';
import { getStore } from '../db/index.ts';
import { requireAuth, requireWorkspaceLeader } from '../middleware/auth.ts';
import { triggerVercelDeployment } from '../services/vercelService.ts';
import { decryptToken } from '../utils/crypto.ts';

export const deploymentsRouter = Router({ mergeParams: true });

deploymentsRouter.get('/', requireAuth, async (req, res) => {
  const store = await getStore();
  const deployments = await store.listDeployments(String(req.params.workspaceId));
  res.json({ deployments });
});

deploymentsRouter.post('/', requireWorkspaceLeader, async (req, res) => {
  const workspaceId = String(req.params.workspaceId);
  const { branch, commitMessage, taskId } = req.body as {
    branch?: string;
    commitMessage?: string;
    taskId?: string | null;
  };

  const store = await getStore();
  const ws = await store.getWorkspaceById(workspaceId);
  if (!ws) {
    res.status(404).json({ error: 'Workspace not found' });
    return;
  }

  const vercelToken = req.currentUser?.vercelTokenEncrypted
    ? decryptToken(req.currentUser.vercelTokenEncrypted)
    : null;
  const githubToken = req.currentUser?.githubTokenEncrypted
    ? decryptToken(req.currentUser.githubTokenEncrypted)
    : null;

  const deployment = await triggerVercelDeployment({
    workspaceId,
    taskId: taskId ?? null,
    branch: branch?.trim() || ws.defaultBranch,
    commitSha: null,
    commitMessage:
      commitMessage?.trim() || `One-click deploy ${ws.vercelProjectName || ws.name}`,
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

  res.status(201).json({ deployment });
});

