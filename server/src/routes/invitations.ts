import { Router } from 'express';
import { isWorkspaceLeader } from '../../../shared/permissions.ts';
import { getStore } from '../db/index.ts';
import { doesInvitationMatchUser, extractInviteCode } from '../db/invitationHelpers.ts';
import { toPublicWorkspace } from '../db/types.ts';
import { requireAuth } from '../middleware/auth.ts';
import { realtimeHub } from '../ws/realtime.ts';

export const invitationsRouter = Router();

invitationsRouter.get('/mine', requireAuth, async (req, res) => {
  const store = await getStore();
  const [incoming, sent] = await Promise.all([
    store.listIncomingInvitations(req.currentUser!),
    store.listSentInvitations(req.currentUser!.id),
  ]);
  res.json({ incoming, sent });
});

invitationsRouter.post('/join', requireAuth, async (req, res) => {
  const { code } = req.body as { code?: string };
  const normalizedCode = extractInviteCode(code || '');
  if (!normalizedCode) {
    res.status(400).json({ error: 'Invite code or link is required' });
    return;
  }

  const store = await getStore();
  const inv = await store.getInvitationByCode(normalizedCode);
  if (!inv) {
    res.status(404).json({ error: 'Invite code not found. Check the code and try again.' });
    return;
  }
  if (inv.status !== 'pending') {
    res.status(400).json({ error: `This invitation is no longer active (${inv.status}).` });
    return;
  }

  const isTargeted = Boolean(inv.inviteeUsername || inv.inviteeEmail);
  if (isTargeted && !doesInvitationMatchUser(inv, req.currentUser!)) {
    res.status(403).json({
      error: `This invitation was sent specifically to ${inv.inviteeUsername ? `@${inv.inviteeUsername}` : inv.inviteeEmail}.`,
    });
    return;
  }

  const updatedWs = await store.addWorkspaceMember(inv.workspaceId, req.currentUser!.id, inv.role);
  if (!updatedWs) {
    res.status(404).json({ error: 'Target project workspace no longer exists' });
    return;
  }

  const updatedInv = isTargeted
    ? (await store.updateInvitationStatus(inv.id, 'accepted', req.currentUser!.id)) || inv
    : inv;

  const publicWs = toPublicWorkspace(updatedWs);
  realtimeHub.broadcastToWorkspace(updatedWs.id, {
    type: 'workspace:updated',
    workspace: publicWs,
  });
  realtimeHub.broadcastToWorkspace(updatedWs.id, {
    type: 'invitation:updated',
    workspaceId: updatedWs.id,
    invitation: updatedInv,
  });

  res.json({ workspace: publicWs, invitation: updatedInv });
});

invitationsRouter.post('/:invitationId/accept', requireAuth, async (req, res) => {
  const store = await getStore();
  const inv = await store.getInvitationById(String(req.params.invitationId));
  if (!inv) {
    res.status(404).json({ error: 'Invitation not found' });
    return;
  }
  if (inv.status !== 'pending') {
    res.status(400).json({ error: `Invitation is already ${inv.status}` });
    return;
  }

  const isTargeted = Boolean(inv.inviteeUsername || inv.inviteeEmail);
  if (isTargeted && !doesInvitationMatchUser(inv, req.currentUser!)) {
    res.status(403).json({ error: 'This invitation belongs to another account' });
    return;
  }

  const updatedWs = await store.addWorkspaceMember(inv.workspaceId, req.currentUser!.id, inv.role);
  if (!updatedWs) {
    res.status(404).json({ error: 'Workspace not found' });
    return;
  }

  const updatedInv = isTargeted
    ? (await store.updateInvitationStatus(inv.id, 'accepted', req.currentUser!.id)) || inv
    : inv;

  const publicWs = toPublicWorkspace(updatedWs);
  realtimeHub.broadcastToWorkspace(updatedWs.id, {
    type: 'workspace:updated',
    workspace: publicWs,
  });
  realtimeHub.broadcastToWorkspace(updatedWs.id, {
    type: 'invitation:updated',
    workspaceId: updatedWs.id,
    invitation: updatedInv,
  });

  res.json({ workspace: publicWs, invitation: updatedInv });
});

invitationsRouter.post('/:invitationId/decline', requireAuth, async (req, res) => {
  const store = await getStore();
  const inv = await store.getInvitationById(String(req.params.invitationId));
  if (!inv) {
    res.status(404).json({ error: 'Invitation not found' });
    return;
  }
  if (inv.status !== 'pending') {
    res.status(400).json({ error: `Invitation is already ${inv.status}` });
    return;
  }
  if (!doesInvitationMatchUser(inv, req.currentUser!)) {
    res.status(403).json({ error: 'Only the invited user can decline this invitation' });
    return;
  }

  const updatedInv = await store.updateInvitationStatus(inv.id, 'declined');
  if (updatedInv) {
    realtimeHub.broadcastToWorkspace(inv.workspaceId, {
      type: 'invitation:updated',
      workspaceId: inv.workspaceId,
      invitation: updatedInv,
    });
  }
  res.json({ invitation: updatedInv });
});

invitationsRouter.delete('/:invitationId', requireAuth, async (req, res) => {
  const store = await getStore();
  const inv = await store.getInvitationById(String(req.params.invitationId));
  if (!inv) {
    res.status(404).json({ error: 'Invitation not found' });
    return;
  }
  const ws = await store.getWorkspaceById(inv.workspaceId);
  const canRevoke =
    inv.inviterId === req.currentUser!.id ||
    (ws ? isWorkspaceLeader(ws, req.currentUser!) : false);

  if (!canRevoke) {
    res.status(403).json({ error: 'Only the inviter or a Project Leader can revoke this invite' });
    return;
  }

  const updatedInv = await store.updateInvitationStatus(inv.id, 'revoked');
  if (updatedInv) {
    realtimeHub.broadcastToWorkspace(inv.workspaceId, {
      type: 'invitation:updated',
      workspaceId: inv.workspaceId,
      invitation: updatedInv,
    });
  }
  res.json({ invitation: updatedInv });
});

