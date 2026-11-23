import { Router } from 'express';
import { isWorkspaceLeader } from '../../../shared/permissions.js';
import type { TaskPriority, TaskStatus } from '../../../shared/types.js';
import { getStore } from '../db/index.js';
import { requireAuth, requireWorkspaceLeader } from '../middleware/auth.js';
import { realtimeHub } from '../ws/realtime.js';

export const tasksRouter = Router({ mergeParams: true });

const VALID_STATUSES: TaskStatus[] = ['todo', 'in_progress', 'in_review', 'done'];
const VALID_PRIORITIES: TaskPriority[] = ['low', 'medium', 'high', 'urgent'];

tasksRouter.get('/', requireAuth, async (req, res) => {
  const workspaceId = String(req.params.workspaceId);
  const store = await getStore();
  const tasks = await store.listTasks(workspaceId);
  res.json({ tasks });
});

tasksRouter.post('/', requireAuth, async (req, res) => {
  const workspaceId = String(req.params.workspaceId);
  const { title, description, priority, assigneeId, branchName, status } = req.body as {
    title?: string;
    description?: string;
    priority?: TaskPriority;
    assigneeId?: string | null;
    branchName?: string | null;
    status?: TaskStatus;
  };

  if (!title || title.trim().length < 2) {
    res.status(400).json({ error: 'Task title is required' });
    return;
  }

  const safeStatus = status && VALID_STATUSES.includes(status) ? status : 'todo';

  const store = await getStore();
  const ws = await store.getWorkspaceById(workspaceId);
  if (!ws) {
    res.status(404).json({ error: 'Workspace not found' });
    return;
  }

  if (safeStatus === 'done' && !isWorkspaceLeader(ws, req.currentUser!)) {
    res.status(403).json({ error: 'Only a Project Leader can create tasks directly in Done.' });
    return;
  }

  const task = await store.createTask({
    workspaceId,
    title: title.trim(),
    description: description?.trim() || '',
    priority: priority && VALID_PRIORITIES.includes(priority) ? priority : 'medium',
    assigneeId: assigneeId ?? null,
    branchName: branchName?.trim() || undefined,
    status: safeStatus,
  });

  realtimeHub.broadcastToWorkspace(workspaceId, {
    type: 'task:created',
    workspaceId,
    task,
  });

  res.status(201).json({ task });
});

tasksRouter.patch('/:taskId', requireAuth, async (req, res) => {
  const workspaceId = String(req.params.workspaceId);
  const taskId = String(req.params.taskId);
  const body = req.body as Record<string, unknown>;

  const store = await getStore();
  const ws = await store.getWorkspaceById(workspaceId);
  if (!ws) {
    res.status(404).json({ error: 'Workspace not found' });
    return;
  }

  const existing = await store.getTaskById(workspaceId, taskId);
  if (!existing) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  const nextStatus =
    typeof body.status === 'string' && VALID_STATUSES.includes(body.status as TaskStatus)
      ? (body.status as TaskStatus)
      : undefined;

  if (nextStatus === 'done' && existing.status !== 'done' && !isWorkspaceLeader(ws, req.currentUser!)) {
    res.status(403).json({
      error:
        'Gatekeeper Policy: Only the Project Leader can approve and move tasks to Done.',
    });
    return;
  }

  const updated = await store.updateTask(workspaceId, taskId, {
    ...(typeof body.title === 'string' ? { title: body.title.trim() } : {}),
    ...(typeof body.description === 'string' ? { description: body.description } : {}),
    ...(nextStatus ? { status: nextStatus } : {}),
    ...(typeof body.priority === 'string' && VALID_PRIORITIES.includes(body.priority as TaskPriority)
      ? { priority: body.priority as TaskPriority }
      : {}),
    ...(typeof body.position === 'number' ? { position: body.position } : {}),
    ...(body.assigneeId !== undefined
      ? { assigneeId: typeof body.assigneeId === 'string' ? body.assigneeId : null }
      : {}),
    ...(body.branchName !== undefined
      ? { branchName: typeof body.branchName === 'string' ? body.branchName.trim() : null }
      : {}),
  });

  if (updated) {
    realtimeHub.broadcastToWorkspace(workspaceId, {
      type: 'task:updated',
      workspaceId,
      task: updated,
    });
  }

  res.json({ task: updated });
});

tasksRouter.delete('/:taskId', requireWorkspaceLeader, async (req, res) => {
  const workspaceId = String(req.params.workspaceId);
  const taskId = String(req.params.taskId);
  const store = await getStore();
  const deleted = await store.deleteTask(workspaceId, taskId);
  if (!deleted) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  realtimeHub.broadcastToWorkspace(workspaceId, {
    type: 'task:deleted',
    workspaceId,
    taskId,
  });

  res.json({ ok: true });
});
