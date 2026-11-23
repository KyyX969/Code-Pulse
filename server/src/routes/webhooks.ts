import crypto from 'node:crypto';
import { Router } from 'express';
import { config } from '../config.js';
import { getStore } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { processWebhookPayload } from '../services/webhookProcessor.js';
import { decryptToken, verifyGitHubWebhookSignature } from '../utils/crypto.js';

export const webhooksRouter = Router();

/**
 * Real GitHub Webhook Endpoint (F-03)
 * Listens for `push` and `pull_request` events from GitHub with HMAC-SHA256 verification.
 */
webhooksRouter.post('/github', async (req, res) => {
  const eventHeader = String(req.headers['x-github-event'] || '');
  const deliveryId = req.headers['x-github-delivery']
    ? String(req.headers['x-github-delivery'])
    : crypto.randomUUID();
  const signature = req.headers['x-hub-signature-256']
    ? String(req.headers['x-hub-signature-256'])
    : undefined;

  if (eventHeader === 'ping') {
    res.json({ ok: true, message: 'CodePulse webhook pong' });
    return;
  }

  if (eventHeader !== 'push' && eventHeader !== 'pull_request') {
    res.json({ ok: true, ignored: true, event: eventHeader });
    return;
  }

  const payload = req.body as Record<string, unknown>;
  const repoObj = payload.repository as Record<string, unknown> | undefined;
  const fullName = String(repoObj?.full_name || '');
  const [repoOwner, repoName] = fullName.split('/');

  if (!repoOwner || !repoName) {
    res.status(400).json({ error: 'Missing repository.full_name in webhook payload' });
    return;
  }

  const store = await getStore();
  const workspace = await store.getWorkspaceByRepo(repoOwner, repoName);
  if (!workspace) {
    res.status(404).json({ error: `No CodePulse workspace linked to ${fullName}` });
    return;
  }

  // Verify HMAC-SHA256 signature if a webhook secret is configured
  let secretToCheck = config.github.webhookSecret;
  if (!secretToCheck && workspace.webhookSecretEncrypted) {
    try {
      secretToCheck = decryptToken(workspace.webhookSecretEncrypted);
    } catch {
      secretToCheck = '';
    }
  }

  if (secretToCheck && req.rawBody) {
    const valid = verifyGitHubWebhookSignature(req.rawBody, signature, secretToCheck);
    if (!valid) {
      res.status(401).json({ error: 'Invalid X-Hub-Signature-256 webhook signature' });
      return;
    }
  }

  if (eventHeader === 'push') {
    const ref = String(payload.ref || '');
    const commits = Array.isArray(payload.commits)
      ? (payload.commits as Array<Record<string, unknown>>)
      : [];
    const headCommit = (payload.head_commit as Record<string, unknown> | undefined) || commits[0];
    const commitMessage = commits
      .map((c) => String(c.message || ''))
      .filter(Boolean)
      .join('\n') || String(headCommit?.message || '');
    const commitSha = String(payload.after || headCommit?.id || '');
    const pusher = payload.pusher as Record<string, unknown> | undefined;
    const sender = payload.sender as Record<string, unknown> | undefined;
    const actor = String(pusher?.name || sender?.login || 'github');

    const result = await processWebhookPayload(workspace, {
      eventType: 'push',
      deliveryId,
      repoOwner,
      repoName,
      branch: ref,
      actorUsername: actor,
      commitSha,
      commitMessage,
    });

    res.status(result.blocked ? 403 : 200).json(result);
    return;
  }

  // pull_request event
  const pr = (payload.pull_request as Record<string, unknown> | undefined) || {};
  const head = (pr.head as Record<string, unknown> | undefined) || {};
  const userObj = (pr.user as Record<string, unknown> | undefined) || {};
  const result = await processWebhookPayload(workspace, {
    eventType: 'pull_request',
    deliveryId,
    repoOwner,
    repoName,
    branch: String(head.ref || ''),
    actorUsername: String(userObj.login || 'github'),
    commitSha: String(head.sha || ''),
    commitMessage: String(pr.title || ''),
    prNumber: Number(pr.number || payload.number || 0) || null,
    prUrl: String(pr.html_url || '') || null,
    prAction: String(payload.action || 'opened'),
    prMerged: Boolean(pr.merged),
    prTitle: String(pr.title || ''),
    prBody: String(pr.body || ''),
  });

  res.json(result);
});

/**
 * List Webhook & Gatekeeper audit events for a workspace
 */
webhooksRouter.get('/workspaces/:workspaceId/events', requireAuth, async (req, res) => {
  const store = await getStore();
  const events = await store.listWebhookEvents(String(req.params.workspaceId));
  res.json({ events });
});

/**
 * Local Webhook & Gatekeeper Simulator (for testing F-03 & F-04 in real time without ngrok)
 */
webhooksRouter.post('/workspaces/:workspaceId/simulate', requireAuth, async (req, res) => {
  const workspaceId = String(req.params.workspaceId);
  const { eventType, branch, commitMessage, actorUsername, prNumber, isDirectPushAttempt } =
    req.body as {
      eventType?: 'push' | 'pull_request';
      branch?: string;
      commitMessage?: string;
      actorUsername?: string;
      prNumber?: number;
      isDirectPushAttempt?: boolean;
    };

  const store = await getStore();
  const workspace = await store.getWorkspaceById(workspaceId);
  if (!workspace) {
    res.status(404).json({ error: 'Workspace not found' });
    return;
  }

  const sha = crypto.randomBytes(4).toString('hex').slice(0, 7);
  const targetBranch = (branch || 'feat/update').trim();
  const actor = (actorUsername || req.currentUser!.username).trim();
  const message = (commitMessage || 'feat: update implementation').trim();

  const result = await processWebhookPayload(workspace, {
    eventType: eventType || 'push',
    deliveryId: `sim-${crypto.randomBytes(3).toString('hex')}`,
    repoOwner: workspace.githubOwner || 'owner',
    repoName: workspace.githubRepo || 'repo',
    branch: targetBranch,
    actorUsername: actor,
    commitSha: sha,
    commitMessage: message,
    prNumber:
      eventType === 'pull_request'
        ? prNumber || Math.floor(16 + Math.random() * 40)
        : null,
    prUrl:
      eventType === 'pull_request' && workspace.githubOwner && workspace.githubRepo
        ? `https://github.com/${workspace.githubOwner}/${workspace.githubRepo}/pull/${prNumber || 16}`
        : null,
    prAction: eventType === 'pull_request' ? 'opened' : null,
    prTitle: eventType === 'pull_request' ? message : null,
    isDirectPushAttempt:
      Boolean(isDirectPushAttempt) || targetBranch === workspace.defaultBranch,
  });

  res.status(result.blocked ? 403 : 200).json(result);
});

