import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  Deployment,
  InvitationStatus,
  LiveSession,
  Task,
  UserRole,
  WebhookEvent,
  WorkspaceInvitation,
  WorkspaceMember,
} from '../../../shared/types.ts';
import { config } from '../config.ts';
import { doesInvitationMatchUser, generateInviteCode } from './invitationHelpers.ts';
import type {
  CreateInvitationInput,
  CreateTaskInput,
  CreateWorkspaceInput,
  DataStore,
  StoredUser,
  StoredWorkspace,
  UpdateTaskInput,
} from './types.ts';

function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const msg = (error.message || '').toLowerCase();
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    msg.includes('workspace_invitations') &&
      (msg.includes('does not exist') || msg.includes('could not find the table'))
  );
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'workspace'
  );
}

interface UserRow {
  id: string;
  github_id: string | null;
  username: string;
  display_name: string;
  avatar_url: string | null;
  email: string | null;
  role: UserRole;
  github_token_encrypted: string | null;
  vercel_token_encrypted: string | null;
  vercel_team_id: string | null;
  vercel_username: string | null;
  created_at: string;
  updated_at: string;
}

interface WorkspaceRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  owner_id: string;
  github_owner: string | null;
  github_repo: string | null;
  github_repo_id: number | null;
  default_branch: string;
  branch_protected: boolean;
  webhook_id: number | null;
  webhook_secret_encrypted: string | null;
  vercel_project_id: string | null;
  vercel_project_name: string | null;
  auto_deploy_on_merge: boolean;
  task_seq: number;
  blocked_direct_pushes: number;
  created_at: string;
  updated_at: string;
}

interface TaskRow {
  id: string;
  workspace_id: string;
  task_code: string;
  title: string;
  description: string | null;
  status: Task['status'];
  priority: Task['priority'];
  position: number;
  assignee_id: string | null;
  branch_name: string | null;
  pr_number: number | null;
  pr_url: string | null;
  latest_commit_sha: string | null;
  latest_commit_message: string | null;
  diff_summary: Task['diffSummary'];
  review_comment: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

function mapUser(r: UserRow): StoredUser {
  return {
    id: r.id,
    githubId: r.github_id,
    username: r.username,
    displayName: r.display_name,
    avatarUrl:
      r.avatar_url ||
      `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(r.username)}`,
    email: r.email,
    role: r.role,
    githubTokenEncrypted: r.github_token_encrypted,
    vercelTokenEncrypted: r.vercel_token_encrypted,
    vercelTeamId: r.vercel_team_id,
    vercelUsername: r.vercel_username,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapTask(r: TaskRow): Task {
  return {
    id: r.id,
    workspaceId: r.workspace_id,
    taskCode: r.task_code,
    title: r.title,
    description: r.description ?? '',
    status: r.status,
    priority: r.priority,
    position: r.position,
    assigneeId: r.assignee_id,
    branchName: r.branch_name,
    prNumber: r.pr_number,
    prUrl: r.pr_url,
    latestCommitSha: r.latest_commit_sha,
    latestCommitMessage: r.latest_commit_message,
    diffSummary: r.diff_summary ?? null,
    reviewComment: r.review_comment ?? null,
    approvedBy: r.approved_by,
    approvedAt: r.approved_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export class SupabaseStore implements DataStore {
  private client: SupabaseClient;

  constructor() {
    this.client = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
      auth: { persistSession: false },
    });
  }

  async init(): Promise<void> {
    const { error } = await this.client
      .from('workspaces')
      .select('id', { count: 'exact', head: true });
    if (error) {
      throw new Error(
        `Supabase connection check failed (${error.message}). Make sure supabase/schema.sql has been executed in your Supabase SQL Editor.`,
      );
    }
  }

  private async getWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
    const { data, error } = await this.client
      .from('workspace_members')
      .select('user_id, role, joined_at, users(username, display_name, avatar_url)')
      .eq('workspace_id', workspaceId);
    if (error || !data) return [];

    return data.map((row: Record<string, unknown>) => {
      const u = (row.users || {}) as Record<string, string | null>;
      return {
        userId: String(row.user_id),
        username: u.username || 'user',
        displayName: u.display_name || u.username || 'User',
        avatarUrl:
          u.avatar_url ||
          `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(u.username || 'U')}`,
        role: (row.role as UserRole) || 'member',
        joinedAt: String(row.joined_at),
      };
    });
  }

  private async mapWorkspace(r: WorkspaceRow): Promise<StoredWorkspace> {
    const members = await this.getWorkspaceMembers(r.id);
    return {
      id: r.id,
      name: r.name,
      slug: r.slug,
      description: r.description ?? '',
      ownerId: r.owner_id,
      githubOwner: r.github_owner,
      githubRepo: r.github_repo,
      githubRepoId: r.github_repo_id,
      defaultBranch: r.default_branch,
      branchProtected: r.branch_protected,
      webhookId: r.webhook_id,
      webhookSecretEncrypted: r.webhook_secret_encrypted,
      webhookActive: Boolean(r.webhook_id),
      vercelProjectId: r.vercel_project_id,
      vercelProjectName: r.vercel_project_name,
      autoDeployOnMerge: r.auto_deploy_on_merge,
      taskSeq: r.task_seq,
      blockedDirectPushes: r.blocked_direct_pushes,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      members,
    };
  }

  async getUserById(id: string): Promise<StoredUser | null> {
    const { data } = await this.client.from('users').select('*').eq('id', id).maybeSingle();
    return data ? mapUser(data as UserRow) : null;
  }

  async getUserByUsername(username: string): Promise<StoredUser | null> {
    const { data } = await this.client
      .from('users')
      .select('*')
      .ilike('username', username)
      .maybeSingle();
    return data ? mapUser(data as UserRow) : null;
  }

  async getUserByEmail(email: string): Promise<StoredUser | null> {
    const { data } = await this.client
      .from('users')
      .select('*')
      .ilike('email', email.trim())
      .maybeSingle();
    return data ? mapUser(data as UserRow) : null;
  }

  async getUserByGithubId(githubId: string): Promise<StoredUser | null> {
    const { data } = await this.client
      .from('users')
      .select('*')
      .eq('github_id', githubId)
      .maybeSingle();
    return data ? mapUser(data as UserRow) : null;
  }

  async listUsers(): Promise<StoredUser[]> {
    const { data } = await this.client.from('users').select('*');
    return (data || []).map((r) => mapUser(r as UserRow));
  }

  async upsertUser(
    input: Partial<StoredUser> & { username: string; displayName: string },
  ): Promise<StoredUser> {
    const payload = {
      github_id: input.githubId ?? null,
      username: input.username,
      display_name: input.displayName,
      avatar_url:
        input.avatarUrl ??
        `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(input.username)}`,
      email: input.email ?? null,
      role: input.role ?? 'member',
      ...(input.githubTokenEncrypted !== undefined
        ? { github_token_encrypted: input.githubTokenEncrypted }
        : {}),
      ...(input.vercelTokenEncrypted !== undefined
        ? { vercel_token_encrypted: input.vercelTokenEncrypted }
        : {}),
      ...(input.vercelTeamId !== undefined ? { vercel_team_id: input.vercelTeamId } : {}),
      ...(input.vercelUsername !== undefined
        ? { vercel_username: input.vercelUsername }
        : {}),
    };

    const existing =
      (input.id ? await this.getUserById(input.id) : null) ||
      (input.githubId ? await this.getUserByGithubId(input.githubId) : null) ||
      (input.email ? await this.getUserByEmail(input.email) : null) ||
      (await this.getUserByUsername(input.username));

    if (existing) {
      const { data, error } = await this.client
        .from('users')
        .update(payload)
        .eq('id', existing.id)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return mapUser(data as UserRow);
    }

    const { data, error } = await this.client
      .from('users')
      .insert({
        ...(input.id ? { id: input.id } : {}),
        ...payload,
      })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return mapUser(data as UserRow);
  }

  async updateUserRole(userId: string, role: UserRole): Promise<StoredUser | null> {
    const { data, error } = await this.client
      .from('users')
      .update({ role })
      .eq('id', userId)
      .select('*')
      .maybeSingle();
    if (error || !data) return null;
    await this.client.from('workspace_members').update({ role }).eq('user_id', userId);
    return mapUser(data as UserRow);
  }

  async listWorkspaces(): Promise<StoredWorkspace[]> {
    const { data } = await this.client
      .from('workspaces')
      .select('*')
      .order('created_at', { ascending: true });
    if (!data) return [];
    return Promise.all(data.map((r) => this.mapWorkspace(r as WorkspaceRow)));
  }

  async getWorkspaceById(id: string): Promise<StoredWorkspace | null> {
    const { data } = await this.client
      .from('workspaces')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    return data ? this.mapWorkspace(data as WorkspaceRow) : null;
  }

  async getWorkspaceByRepo(owner: string, repo: string): Promise<StoredWorkspace | null> {
    const { data } = await this.client
      .from('workspaces')
      .select('*')
      .ilike('github_owner', owner)
      .ilike('github_repo', repo)
      .maybeSingle();
    return data ? this.mapWorkspace(data as WorkspaceRow) : null;
  }

  async createWorkspace(input: CreateWorkspaceInput): Promise<StoredWorkspace> {
    const slug = `${slugify(input.name)}-${Math.random().toString(36).slice(2, 6)}`;
    const { data, error } = await this.client
      .from('workspaces')
      .insert({
        name: input.name,
        slug,
        description: input.description ?? '',
        owner_id: input.ownerId,
      })
      .select('*')
      .single();
    if (error) throw new Error(error.message);

    await this.client.from('workspace_members').upsert([
      {
        workspace_id: data.id,
        user_id: input.ownerId,
        role: 'leader',
      },
    ]);

    return this.mapWorkspace(data as WorkspaceRow);
  }

  async updateWorkspace(
    id: string,
    patch: Partial<Omit<StoredWorkspace, 'id' | 'createdAt'>>,
  ): Promise<StoredWorkspace | null> {
    const dbPatch: Record<string, unknown> = {};
    if (patch.name !== undefined) dbPatch.name = patch.name;
    if (patch.description !== undefined) dbPatch.description = patch.description;
    if (patch.githubOwner !== undefined) dbPatch.github_owner = patch.githubOwner;
    if (patch.githubRepo !== undefined) dbPatch.github_repo = patch.githubRepo;
    if (patch.githubRepoId !== undefined) dbPatch.github_repo_id = patch.githubRepoId;
    if (patch.defaultBranch !== undefined) dbPatch.default_branch = patch.defaultBranch;
    if (patch.branchProtected !== undefined) dbPatch.branch_protected = patch.branchProtected;
    if (patch.webhookId !== undefined) dbPatch.webhook_id = patch.webhookId;
    if (patch.webhookSecretEncrypted !== undefined)
      dbPatch.webhook_secret_encrypted = patch.webhookSecretEncrypted;
    if (patch.vercelProjectId !== undefined) dbPatch.vercel_project_id = patch.vercelProjectId;
    if (patch.vercelProjectName !== undefined)
      dbPatch.vercel_project_name = patch.vercelProjectName;
    if (patch.autoDeployOnMerge !== undefined)
      dbPatch.auto_deploy_on_merge = patch.autoDeployOnMerge;
    if (patch.taskSeq !== undefined) dbPatch.task_seq = patch.taskSeq;
    if (patch.blockedDirectPushes !== undefined)
      dbPatch.blocked_direct_pushes = patch.blockedDirectPushes;

    const { data, error } = await this.client
      .from('workspaces')
      .update(dbPatch)
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error || !data) return null;
    return this.mapWorkspace(data as WorkspaceRow);
  }

  async deleteWorkspace(id: string): Promise<boolean> {
    const { data, error } = await this.client
      .from('workspaces')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle();
    if (error || !data) return false;

    // Clean any local fallback invitations associated with this workspace
    try {
      const fallback = await this.readFallbackInvitations();
      const remaining = fallback.filter((inv) => inv.workspaceId !== id);
      if (remaining.length !== fallback.length) {
        await this.writeFallbackInvitations(remaining);
      }
    } catch {
      // ignore fallback cleanup error
    }
    return true;
  }

  async listTasks(workspaceId: string): Promise<Task[]> {
    const { data } = await this.client
      .from('tasks')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('position', { ascending: true });
    return (data || []).map((r) => mapTask(r as TaskRow));
  }

  async getTaskById(workspaceId: string, taskId: string): Promise<Task | null> {
    const { data } = await this.client
      .from('tasks')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('id', taskId)
      .maybeSingle();
    return data ? mapTask(data as TaskRow) : null;
  }

  async getTaskByCode(workspaceId: string, taskCode: string): Promise<Task | null> {
    const normalized = taskCode.replace(/^#/, '').toUpperCase();
    const { data } = await this.client
      .from('tasks')
      .select('*')
      .eq('workspace_id', workspaceId)
      .ilike('task_code', normalized)
      .maybeSingle();
    return data ? mapTask(data as TaskRow) : null;
  }

  async createTask(input: CreateTaskInput): Promise<Task> {
    const ws = await this.getWorkspaceById(input.workspaceId);
    if (!ws) throw new Error('Workspace not found');
    const nextSeq = ws.taskSeq + 1;
    await this.updateWorkspace(ws.id, { taskSeq: nextSeq });
    const taskCode = `CP-${String(nextSeq).padStart(2, '0')}`;

    const { data, error } = await this.client
      .from('tasks')
      .insert({
        workspace_id: input.workspaceId,
        task_code: taskCode,
        title: input.title,
        description: input.description ?? '',
        status: input.status ?? 'todo',
        priority: input.priority ?? 'medium',
        position: 0,
        assignee_id: input.assigneeId ?? null,
        branch_name: input.branchName ?? `feat/${taskCode.toLowerCase()}`,
      })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return mapTask(data as TaskRow);
  }

  async updateTask(
    workspaceId: string,
    taskId: string,
    patch: UpdateTaskInput,
  ): Promise<Task | null> {
    const dbPatch: Record<string, unknown> = {};
    if (patch.title !== undefined) dbPatch.title = patch.title;
    if (patch.description !== undefined) dbPatch.description = patch.description;
    if (patch.status !== undefined) dbPatch.status = patch.status;
    if (patch.priority !== undefined) dbPatch.priority = patch.priority;
    if (patch.position !== undefined) dbPatch.position = patch.position;
    if (patch.assigneeId !== undefined) dbPatch.assignee_id = patch.assigneeId;
    if (patch.branchName !== undefined) dbPatch.branch_name = patch.branchName;
    if (patch.prNumber !== undefined) dbPatch.pr_number = patch.prNumber;
    if (patch.prUrl !== undefined) dbPatch.pr_url = patch.prUrl;
    if (patch.latestCommitSha !== undefined)
      dbPatch.latest_commit_sha = patch.latestCommitSha;
    if (patch.latestCommitMessage !== undefined)
      dbPatch.latest_commit_message = patch.latestCommitMessage;
    if (patch.diffSummary !== undefined) dbPatch.diff_summary = patch.diffSummary;
    if (patch.reviewComment !== undefined) dbPatch.review_comment = patch.reviewComment;
    if (patch.approvedBy !== undefined) dbPatch.approved_by = patch.approvedBy;
    if (patch.approvedAt !== undefined) dbPatch.approved_at = patch.approvedAt;

    const { data } = await this.client
      .from('tasks')
      .update(dbPatch)
      .eq('workspace_id', workspaceId)
      .eq('id', taskId)
      .select('*')
      .maybeSingle();
    return data ? mapTask(data as TaskRow) : null;
  }

  async deleteTask(workspaceId: string, taskId: string): Promise<boolean> {
    const { error } = await this.client
      .from('tasks')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('id', taskId);
    return !error;
  }

  async listWebhookEvents(workspaceId: string): Promise<WebhookEvent[]> {
    const { data } = await this.client
      .from('webhook_events')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(50);

    return (data || []).map((r: Record<string, unknown>) => ({
      id: String(r.id),
      workspaceId: String(r.workspace_id),
      eventType: r.event_type as WebhookEvent['eventType'],
      deliveryId: (r.delivery_id as string | null) ?? null,
      branch: (r.branch as string | null) ?? null,
      actorUsername: String(r.actor_username || 'github'),
      commitSha: (r.commit_sha as string | null) ?? null,
      commitMessage: (r.commit_message as string | null) ?? null,
      matchedTaskCode: (r.matched_task_code as string | null) ?? null,
      statusTransition: (r.status_transition as string | null) ?? null,
      latencyMs: Number(r.latency_ms || 0),
      blocked: Boolean((r.payload_summary as Record<string, unknown> | null)?.blocked),
      reason: (r.payload_summary as Record<string, unknown> | null)?.reason as
        | string
        | undefined,
      createdAt: String(r.created_at),
    }));
  }

  async addWebhookEvent(
    event: Omit<WebhookEvent, 'id' | 'createdAt'>,
  ): Promise<WebhookEvent> {
    const { data, error } = await this.client
      .from('webhook_events')
      .insert({
        workspace_id: event.workspaceId,
        event_type: event.eventType,
        delivery_id: event.deliveryId,
        branch: event.branch,
        actor_username: event.actorUsername,
        commit_sha: event.commitSha,
        commit_message: event.commitMessage,
        matched_task_code: event.matchedTaskCode,
        status_transition: event.statusTransition,
        latency_ms: event.latencyMs,
        payload_summary: { blocked: event.blocked, reason: event.reason },
      })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return {
      ...event,
      id: String(data.id),
      createdAt: String(data.created_at),
    };
  }

  async listDeployments(workspaceId: string): Promise<Deployment[]> {
    const { data } = await this.client
      .from('deployments')
      .select('*, users(username)')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    return (data || []).map((r: Record<string, unknown>) => ({
      id: String(r.id),
      workspaceId: String(r.workspace_id),
      taskId: (r.task_id as string | null) ?? null,
      vercelDeploymentId: (r.vercel_deployment_id as string | null) ?? null,
      branch: String(r.branch || 'main'),
      commitSha: (r.commit_sha as string | null) ?? null,
      commitMessage: (r.commit_message as string | null) ?? null,
      status: r.status as Deployment['status'],
      previewUrl: (r.preview_url as string | null) ?? null,
      inspectorUrl: (r.inspector_url as string | null) ?? null,
      buildLogs: Array.isArray(r.build_logs) ? (r.build_logs as string[]) : [],
      triggeredBy: (r.triggered_by as string | null) ?? null,
      triggeredByUsername:
        ((r.users as Record<string, unknown> | null)?.username as string | null) ?? null,
      createdAt: String(r.created_at),
      readyAt: (r.ready_at as string | null) ?? null,
    }));
  }

  async getDeploymentById(id: string): Promise<Deployment | null> {
    const { data } = await this.client
      .from('deployments')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (!data) return null;
    return {
      id: data.id,
      workspaceId: data.workspace_id,
      taskId: data.task_id,
      vercelDeploymentId: data.vercel_deployment_id,
      branch: data.branch,
      commitSha: data.commit_sha,
      commitMessage: data.commit_message,
      status: data.status,
      previewUrl: data.preview_url,
      inspectorUrl: data.inspector_url,
      buildLogs: Array.isArray(data.build_logs) ? data.build_logs : [],
      triggeredBy: data.triggered_by,
      triggeredByUsername: null,
      createdAt: data.created_at,
      readyAt: data.ready_at,
    };
  }

  async createDeployment(
    deployment: Omit<Deployment, 'id' | 'createdAt'>,
  ): Promise<Deployment> {
    const { data, error } = await this.client
      .from('deployments')
      .insert({
        workspace_id: deployment.workspaceId,
        task_id: deployment.taskId,
        vercel_deployment_id: deployment.vercelDeploymentId,
        branch: deployment.branch,
        commit_sha: deployment.commitSha,
        commit_message: deployment.commitMessage,
        status: deployment.status,
        preview_url: deployment.previewUrl,
        inspector_url: deployment.inspectorUrl,
        build_logs: deployment.buildLogs,
        triggered_by: deployment.triggeredBy,
        ready_at: deployment.readyAt,
      })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return {
      ...deployment,
      id: data.id,
      createdAt: data.created_at,
    };
  }

  async updateDeployment(
    id: string,
    patch: Partial<Deployment>,
  ): Promise<Deployment | null> {
    const dbPatch: Record<string, unknown> = {};
    if (patch.status !== undefined) dbPatch.status = patch.status;
    if (patch.previewUrl !== undefined) dbPatch.preview_url = patch.previewUrl;
    if (patch.inspectorUrl !== undefined) dbPatch.inspector_url = patch.inspectorUrl;
    if (patch.buildLogs !== undefined) dbPatch.build_logs = patch.buildLogs;
    if (patch.readyAt !== undefined) dbPatch.ready_at = patch.readyAt;
    if (patch.vercelDeploymentId !== undefined)
      dbPatch.vercel_deployment_id = patch.vercelDeploymentId;

    const { data } = await this.client
      .from('deployments')
      .update(dbPatch)
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (!data) return null;
    return this.getDeploymentById(id);
  }

  async listLiveSessions(workspaceId: string): Promise<LiveSession[]> {
    const { data } = await this.client
      .from('live_sessions')
      .select('*, users(username, display_name, avatar_url)')
      .eq('workspace_id', workspaceId)
      .eq('is_active', true);

    return (data || []).map((r: Record<string, unknown>) => {
      const u = (r.users || {}) as Record<string, string | null>;
      return {
        id: String(r.id),
        workspaceId: String(r.workspace_id),
        userId: String(r.user_id),
        username: u.username || 'member',
        displayName: u.display_name || u.username || 'Member',
        avatarUrl:
          u.avatar_url ||
          `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(u.username || 'M')}`,
        activeTaskCode: (r.active_task_code as string | null) ?? null,
        streamLabel: String(r.stream_label || 'IDE Window'),
        isActive: Boolean(r.is_active),
        startedAt: String(r.started_at),
        endedAt: (r.ended_at as string | null) ?? null,
      };
    });
  }

  async upsertLiveSession(
    session: Omit<LiveSession, 'id' | 'startedAt' | 'endedAt'>,
  ): Promise<LiveSession> {
    await this.endLiveSession(session.workspaceId, session.userId);
    const { data, error } = await this.client
      .from('live_sessions')
      .insert({
        workspace_id: session.workspaceId,
        user_id: session.userId,
        active_task_code: session.activeTaskCode,
        stream_label: session.streamLabel,
        is_active: true,
      })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return {
      ...session,
      id: data.id,
      startedAt: data.started_at,
      endedAt: null,
    };
  }

  async endLiveSession(workspaceId: string, userId: string): Promise<LiveSession[]> {
    await this.client
      .from('live_sessions')
      .update({ is_active: false, ended_at: new Date().toISOString() })
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .eq('is_active', true);
    return this.listLiveSessions(workspaceId);
  }

  async addWorkspaceMember(
    workspaceId: string,
    userId: string,
    role: UserRole,
  ): Promise<StoredWorkspace | null> {
    const ws = await this.getWorkspaceById(workspaceId);
    if (!ws) return null;
    const effectiveRole: UserRole = ws.ownerId === userId ? 'leader' : role;
    const { error } = await this.client.from('workspace_members').upsert(
      {
        workspace_id: workspaceId,
        user_id: userId,
        role: effectiveRole,
      },
      { onConflict: 'workspace_id,user_id' },
    );
    if (error) throw new Error(error.message);
    return this.getWorkspaceById(workspaceId);
  }

  async updateWorkspaceMemberRole(
    workspaceId: string,
    userId: string,
    role: UserRole,
  ): Promise<StoredWorkspace | null> {
    const ws = await this.getWorkspaceById(workspaceId);
    if (!ws) return null;
    if (ws.ownerId === userId) return ws;
    const { error } = await this.client
      .from('workspace_members')
      .update({ role })
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId);
    if (error) throw new Error(error.message);
    return this.getWorkspaceById(workspaceId);
  }

  async removeWorkspaceMember(
    workspaceId: string,
    userId: string,
  ): Promise<StoredWorkspace | null> {
    const ws = await this.getWorkspaceById(workspaceId);
    if (!ws || ws.ownerId === userId) return null;
    const { error } = await this.client
      .from('workspace_members')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId);
    if (error) throw new Error(error.message);
    return this.getWorkspaceById(workspaceId);
  }

  private get fallbackInvitationsPath(): string {
    return path.resolve(path.dirname(config.dataFilePath), 'invitations-store.json');
  }

  private async readFallbackInvitations(): Promise<WorkspaceInvitation[]> {
    try {
      const raw = await fs.readFile(this.fallbackInvitationsPath, 'utf8');
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? (parsed as WorkspaceInvitation[]) : [];
    } catch {
      return [];
    }
  }

  private async writeFallbackInvitations(list: WorkspaceInvitation[]): Promise<void> {
    await fs.mkdir(path.dirname(this.fallbackInvitationsPath), { recursive: true });
    const tmp = `${this.fallbackInvitationsPath}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(list, null, 2), 'utf8');
    await fs.rename(tmp, this.fallbackInvitationsPath);
  }

  private mapInvitationRow(r: Record<string, unknown>): WorkspaceInvitation {
    const ws = (r.workspaces || {}) as Record<string, string | null>;
    const inviter = (r.users || {}) as Record<string, string | null>;
    const repo =
      ws.github_owner && ws.github_repo ? `${ws.github_owner}/${ws.github_repo}` : null;
    const inviterUsername = inviter.username || 'leader';
    return {
      id: String(r.id),
      workspaceId: String(r.workspace_id),
      workspaceName: ws.name || 'Workspace',
      workspaceRepo: repo,
      inviterId: String(r.inviter_id),
      inviterUsername,
      inviterDisplayName: inviter.display_name || inviterUsername,
      inviterAvatarUrl:
        inviter.avatar_url ||
        `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(inviterUsername)}`,
      inviteeUsername: (r.invitee_username as string | null) ?? null,
      inviteeEmail: (r.invitee_email as string | null) ?? null,
      role: ((r.role as UserRole) || 'member'),
      inviteCode: String(r.invite_code),
      message: String(r.message || ''),
      status: (r.status as InvitationStatus) || 'pending',
      acceptedBy: (r.accepted_by as string | null) ?? null,
      createdAt: String(r.created_at),
      respondedAt: (r.responded_at as string | null) ?? null,
    };
  }

  async createInvitation(input: CreateInvitationInput): Promise<WorkspaceInvitation> {
    const ws = await this.getWorkspaceById(input.workspaceId);
    const inviter = await this.getUserById(input.inviterId);
    if (!ws || !inviter) {
      throw new Error('Workspace or inviter not found');
    }

    const inviteCode = generateInviteCode();
    const inviteeUsername = input.inviteeUsername?.replace(/^@/, '').trim() || null;
    const inviteeEmail = input.inviteeEmail?.trim().toLowerCase() || null;
    const message = input.message?.trim() || '';

    const { data, error } = await this.client
      .from('workspace_invitations')
      .insert({
        workspace_id: ws.id,
        inviter_id: inviter.id,
        invitee_username: inviteeUsername,
        invitee_email: inviteeEmail,
        role: input.role,
        invite_code: inviteCode,
        message,
        status: 'pending',
      })
      .select(
        '*, workspaces(name, github_owner, github_repo), users!workspace_invitations_inviter_id_fkey(username, display_name, avatar_url)',
      )
      .single();

    if (!error && data) {
      return this.mapInvitationRow(data as Record<string, unknown>);
    }

    if (error && !isMissingTableError(error)) {
      throw new Error(error.message);
    }

    const fallbackList = await this.readFallbackInvitations();
    const created: WorkspaceInvitation = {
      id: crypto.randomUUID(),
      workspaceId: ws.id,
      workspaceName: ws.name,
      workspaceRepo: ws.githubOwner && ws.githubRepo ? `${ws.githubOwner}/${ws.githubRepo}` : null,
      inviterId: inviter.id,
      inviterUsername: inviter.username,
      inviterDisplayName: inviter.displayName,
      inviterAvatarUrl: inviter.avatarUrl,
      inviteeUsername,
      inviteeEmail,
      role: input.role,
      inviteCode,
      message,
      status: 'pending',
      acceptedBy: null,
      createdAt: new Date().toISOString(),
      respondedAt: null,
    };
    fallbackList.unshift(created);
    await this.writeFallbackInvitations(fallbackList);
    return created;
  }

  async listWorkspaceInvitations(workspaceId: string): Promise<WorkspaceInvitation[]> {
    const { data, error } = await this.client
      .from('workspace_invitations')
      .select(
        '*, workspaces(name, github_owner, github_repo), users!workspace_invitations_inviter_id_fkey(username, display_name, avatar_url)',
      )
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      return data.map((r) => this.mapInvitationRow(r as Record<string, unknown>));
    }
    if (error && !isMissingTableError(error)) {
      throw new Error(error.message);
    }
    const list = await this.readFallbackInvitations();
    return list
      .filter((inv) => inv.workspaceId === workspaceId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async listIncomingInvitations(user: StoredUser): Promise<WorkspaceInvitation[]> {
    const { data, error } = await this.client
      .from('workspace_invitations')
      .select(
        '*, workspaces(name, github_owner, github_repo), users!workspace_invitations_inviter_id_fkey(username, display_name, avatar_url)',
      )
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (!error && data) {
      return data
        .map((r) => this.mapInvitationRow(r as Record<string, unknown>))
        .filter((inv) => inv.inviterId !== user.id && doesInvitationMatchUser(inv, user));
    }
    if (error && !isMissingTableError(error)) {
      throw new Error(error.message);
    }
    const list = await this.readFallbackInvitations();
    return list
      .filter(
        (inv) =>
          inv.status === 'pending' &&
          inv.inviterId !== user.id &&
          doesInvitationMatchUser(inv, user),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async listSentInvitations(userId: string): Promise<WorkspaceInvitation[]> {
    const { data, error } = await this.client
      .from('workspace_invitations')
      .select(
        '*, workspaces(name, github_owner, github_repo), users!workspace_invitations_inviter_id_fkey(username, display_name, avatar_url)',
      )
      .eq('inviter_id', userId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      return data.map((r) => this.mapInvitationRow(r as Record<string, unknown>));
    }
    if (error && !isMissingTableError(error)) {
      throw new Error(error.message);
    }
    const list = await this.readFallbackInvitations();
    return list
      .filter((inv) => inv.inviterId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getInvitationById(invitationId: string): Promise<WorkspaceInvitation | null> {
    const { data, error } = await this.client
      .from('workspace_invitations')
      .select(
        '*, workspaces(name, github_owner, github_repo), users!workspace_invitations_inviter_id_fkey(username, display_name, avatar_url)',
      )
      .eq('id', invitationId)
      .maybeSingle();

    if (!error && data) {
      return this.mapInvitationRow(data as Record<string, unknown>);
    }
    if (error && !isMissingTableError(error)) {
      throw new Error(error.message);
    }
    const list = await this.readFallbackInvitations();
    return list.find((inv) => inv.id === invitationId) ?? null;
  }

  async getInvitationByCode(inviteCode: string): Promise<WorkspaceInvitation | null> {
    const normalized = inviteCode.trim().toUpperCase();
    const { data, error } = await this.client
      .from('workspace_invitations')
      .select(
        '*, workspaces(name, github_owner, github_repo), users!workspace_invitations_inviter_id_fkey(username, display_name, avatar_url)',
      )
      .ilike('invite_code', normalized)
      .maybeSingle();

    if (!error && data) {
      return this.mapInvitationRow(data as Record<string, unknown>);
    }
    if (error && !isMissingTableError(error)) {
      throw new Error(error.message);
    }
    const list = await this.readFallbackInvitations();
    return list.find((inv) => inv.inviteCode.toUpperCase() === normalized) ?? null;
  }

  async updateInvitationStatus(
    invitationId: string,
    status: InvitationStatus,
    acceptedBy?: string | null,
  ): Promise<WorkspaceInvitation | null> {
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { status, responded_at: now };
    if (acceptedBy !== undefined) patch.accepted_by = acceptedBy;

    const { data, error } = await this.client
      .from('workspace_invitations')
      .update(patch)
      .eq('id', invitationId)
      .select(
        '*, workspaces(name, github_owner, github_repo), users!workspace_invitations_inviter_id_fkey(username, display_name, avatar_url)',
      )
      .maybeSingle();

    if (!error && data) {
      return this.mapInvitationRow(data as Record<string, unknown>);
    }
    if (error && !isMissingTableError(error)) {
      throw new Error(error.message);
    }

    const list = await this.readFallbackInvitations();
    const item = list.find((inv) => inv.id === invitationId);
    if (!item) return null;
    item.status = status;
    item.respondedAt = now;
    if (acceptedBy !== undefined) item.acceptedBy = acceptedBy;
    await this.writeFallbackInvitations(list);
    return item;
  }
}
