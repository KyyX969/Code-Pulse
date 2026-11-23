import { Router } from 'express';
import { getStore } from '../db/index.ts';
import { requireAuth } from '../middleware/auth.ts';
import { realtimeHub } from '../ws/realtime.ts';

export const sessionsRouter = Router({ mergeParams: true });

sessionsRouter.get('/', requireAuth, async (req, res) => {
  const store = await getStore();
  const sessions = await store.listLiveSessions(String(req.params.workspaceId));
  res.json({ sessions });
});

sessionsRouter.post('/start', requireAuth, async (req, res) => {
  const workspaceId = String(req.params.workspaceId);
  const { activeTaskCode, streamLabel, fps, resolution } = req.body as {
    activeTaskCode?: string | null;
    streamLabel?: string;
    fps?: number;
    resolution?: string;
  };

  const store = await getStore();
  const session = await store.upsertLiveSession({
    workspaceId,
    userId: req.currentUser!.id,
    username: req.currentUser!.username,
    displayName: req.currentUser!.displayName,
    avatarUrl: req.currentUser!.avatarUrl,
    activeTaskCode: activeTaskCode ?? null,
    streamLabel: streamLabel?.trim() || 'IDE Screen Share',
    isActive: true,
    fps,
    resolution,
  });

  const sessions = await store.listLiveSessions(workspaceId);
  realtimeHub.broadcastToWorkspace(workspaceId, {
    type: 'session:updated',
    workspaceId,
    sessions,
  });

  res.json({ session, sessions });
});

sessionsRouter.post('/stop', requireAuth, async (req, res) => {
  const workspaceId = String(req.params.workspaceId);
  const store = await getStore();
  const sessions = await store.endLiveSession(workspaceId, req.currentUser!.id);
  realtimeHub.broadcastToWorkspace(workspaceId, {
    type: 'session:updated',
    workspaceId,
    sessions,
  });

  res.json({ sessions });
});

