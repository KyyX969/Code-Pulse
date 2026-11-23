import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  Deployment,
  InvitationStatus,
  LiveSession,
  Task,
  UserRole,
  WebhookEvent,
  WorkspaceInvitation,
} from '../../../shared/types.ts';
import { config } from '../config.ts';
import { doesInvitationMatchUser, generateInviteCode } from './invitationHelpers.ts';
import { createSeedData, type LocalDbSnapshot } from './seed.ts';
import type {
  CreateInvitationInput,
  CreateTaskInput,
  CreateWorkspaceInput,
  DataStore,
  StoredUser,
  StoredWorkspace,
  UpdateTaskInput,
} from './types.ts';

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'workspace'
  );
}

function createEmptySnapshot(): LocalDbSnapshot {
  return {
    users: [],
    workspaces: [],
    tasks: [],
    webhookEvents: [],
    deployments: [],
    liveSessions: [],
    invitations: [],
  };
}

export class LocalJsonStore implements DataStore {
  private data: LocalDbSnapshot;
  private writeQueue: Promise<void> = Promise.resolve();
  private readonly filePath: string;
  private readonly seedDemoData: boolean;

  constructor(
    filePath: string = config.dataFilePath,
    options: { seedDemoData?: boolean } = {},
  ) {
    this.filePath = filePath;
    this.seedDemoData = Boolean(options.seedDemoData);
    this.data = this.seedDemoData ? createSeedData() : createEmptySnapshot();
  }

  async init(): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      this.data = JSON.parse(raw) as LocalDbSnapshot;
      if (!Array.isArray(this.data.invitations)) {
        this.data.invitations = [];
      }
    } catch {
      this.data = this.seedDemoData ? createSeedData() : createEmptySnapshot();
      await this.persist();
    }
  }

  private async persist(): Promise<void> {
    const snapshot = JSON.stringify(this.data, null, 2);
    this.writeQueue = this.writeQueue.then(async () => {
      const tmp = `${this.filePath}.tmp`;
      await fs.writeFile(tmp, snapshot, 'utf8');
      await fs.rename(tmp, this.filePath);
    });
    await this.writeQueue;
  }

  async getUserById(id: string): Promise<StoredUser | null> {
    return this.data.users.find((u) => u.id === id) ?? null;
  }

  async getUserByUsername(username: string): Promise<StoredUser | null> {
    const target = username.toLowerCase();
    return this.data.users.find((u) => u.username.toLowerCase() === target) ?? null;
  }

  async getUserByEmail(email: string): Promise<StoredUser | null> {
    const target = email.trim().toLowerCase();
    return (
      this.data.users.find((u) => (u.email || '').toLowerCase() === target) ?? null
    );
  }

  async getUserByGithubId(githubId: string): Promise<StoredUser | null> {
    return this.data.users.find((u) => u.githubId === githubId) ?? null;
  }

  async listUsers(): Promise<StoredUser[]> {
    return [...this.data.users];
  }

  async upsertUser(
    input: Partial<StoredUser> & { username: string; displayName: string },
  ): Promise<StoredUser> {
    const now = new Date().toISOString();
    let existing = input.id
      ? this.data.users.find((u) => u.id === input.id)
      : undefined;

    if (!existing && input.githubId) {
      existing = this.data.users.find((u) => u.githubId === input.githubId);
    }
    if (!existing) {
      existing = this.data.users.find(
        (u) => u.username.toLowerCase() === input.username.toLowerCase(),
      );
    }

    if (existing) {
      Object.assign(existing, input, { updatedAt: now });
      await this.persist();
      return existing;
    }

    const created: StoredUser = {
      id: input.id ?? crypto.randomUUID(),
      githubId: input.githubId ?? null,
      username: input.username,
      displayName: input.displayName,
      avatarUrl:
        input.avatarUrl ??
        `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(input.username)}`,
      email: input.email ?? null,
      role: input.role ?? 'member',
      passwordHash: input.passwordHash ?? null,
      githubTokenEncrypted: input.githubTokenEncrypted ?? null,
      vercelTokenEncrypted: input.vercelTokenEncrypted ?? null,
      vercelTeamId: input.vercelTeamId ?? null,
      vercelUsername: input.vercelUsername ?? null,
      createdAt: now,
      updatedAt: now,
    };

    this.data.users.push(created);

    // In seeded test/demo mode only, auto-join seeded workspaces so F-01..F-06 test flow works directly
    if (this.seedDemoData) {
      for (const ws of this.data.workspaces) {
        if (!ws.members.some((m) => m.userId === created.id)) {
          ws.members.push({
            userId: created.id,
            username: created.username,
            displayName: created.displayName,
            avatarUrl: created.avatarUrl,
            role: created.role,
            joinedAt: now,
          });
        }
      }
    }

    await this.persist();
    return created;
  }

  async updateUserRole(userId: string, role: UserRole): Promise<StoredUser | null> {
    const user = this.data.users.find((u) => u.id === userId);
    if (!user) return null;
    user.role = role;
    user.updatedAt = new Date().toISOString();

    for (const ws of this.data.workspaces) {
      const member = ws.members.find((m) => m.userId === userId);
      if (member) {
        member.role = role;
      }
    }

    await this.persist();
    return user;
  }

  async listWorkspaces(): Promise<StoredWorkspace[]> {
    return [...this.data.workspaces];
  }

  async getWorkspaceById(id: string): Promise<StoredWorkspace | null> {
    return this.data.workspaces.find((w) => w.id === id) ?? null;
  }

  async getWorkspaceByRepo(owner: string, repo: string): Promise<StoredWorkspace | null> {
    return (
      this.data.workspaces.find(
        (w) =>
          w.githubOwner?.toLowerCase() === owner.toLowerCase() &&
          w.githubRepo?.toLowerCase() === repo.toLowerCase(),
      ) ?? null
    );
  }

  async createWorkspace(input: CreateWorkspaceInput): Promise<StoredWorkspace> {
    const now = new Date().toISOString();
    const owner = await this.getUserById(input.ownerId);
    const baseSlug = slugify(input.name);
    const uniqueSuffix = crypto.randomBytes(2).toString('hex');
    const slug = this.data.workspaces.some((w) => w.slug === baseSlug)
      ? `${baseSlug}-${uniqueSuffix}`
      : baseSlug;

    const members = this.seedDemoData
      ? this.data.users.map((u) => ({
          userId: u.id,
          username: u.username,
          displayName: u.displayName,
          avatarUrl: u.avatarUrl,
          role: u.id === input.ownerId ? ('leader' as const) : u.role,
          joinedAt: now,
        }))
      : [];

    if (owner && !members.some((m) => m.userId === owner.id)) {
      members.unshift({
        userId: owner.id,
        username: owner.username,
        displayName: owner.displayName,
        avatarUrl: owner.avatarUrl,
        role: 'leader',
        joinedAt: now,
      });
    }

    const ws: StoredWorkspace = {
      id: crypto.randomUUID(),
      name: input.name,
      slug,
      description: input.description ?? '',
      ownerId: input.ownerId,
      githubOwner: null,
      githubRepo: null,
      githubRepoId: null,
      defaultBranch: 'main',
      branchProtected: false,
      webhookId: null,
      webhookSecretEncrypted: null,
      webhookActive: false,
      vercelProjectId: null,
      vercelProjectName: null,
      autoDeployOnMerge: true,
      taskSeq: 0,
      blockedDirectPushes: 0,
      createdAt: now,
      updatedAt: now,
      members,
    };

    this.data.workspaces.push(ws);
    await this.persist();
    return ws;
  }

  async updateWorkspace(
    id: string,
    patch: Partial<Omit<StoredWorkspace, 'id' | 'createdAt'>>,
  ): Promise<StoredWorkspace | null> {
    const ws = this.data.workspaces.find((w) => w.id === id);
    if (!ws) return null;
    Object.assign(ws, patch, { updatedAt: new Date().toISOString() });
    await this.persist();
    return ws;
  }

  async deleteWorkspace(id: string): Promise<boolean> {
    const before = this.data.workspaces.length;
    this.data.workspaces = this.data.workspaces.filter((w) => w.id !== id);
    if (this.data.workspaces.length === before) return false;
    this.data.tasks = this.data.tasks.filter((t) => t.workspaceId !== id);
    this.data.webhookEvents = this.data.webhookEvents.filter((e) => e.workspaceId !== id);
    this.data.deployments = this.data.deployments.filter((d) => d.workspaceId !== id);
    this.data.liveSessions = this.data.liveSessions.filter((s) => s.workspaceId !== id);
    if (Array.isArray(this.data.invitations)) {
      this.data.invitations = this.data.invitations.filter((inv) => inv.workspaceId !== id);
    }
    await this.persist();
    return true;
  }

  async listTasks(workspaceId: string): Promise<Task[]> {
    return this.data.tasks
      .filter((t) => t.workspaceId === workspaceId)
      .sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt));
  }

  async getTaskById(workspaceId: string, taskId: string): Promise<Task | null> {
    return (
      this.data.tasks.find((t) => t.workspaceId === workspaceId && t.id === taskId) ?? null
    );
  }

  async getTaskByCode(workspaceId: string, taskCode: string): Promise<Task | null> {
    const normalized = taskCode.replace(/^#/, '').toUpperCase();
    return (
      this.data.tasks.find(
        (t) => t.workspaceId === workspaceId && t.taskCode.toUpperCase() === normalized,
      ) ?? null
    );
  }

  async createTask(input: CreateTaskInput): Promise<Task> {
    const ws = this.data.workspaces.find((w) => w.id === input.workspaceId);
    if (!ws) throw new Error('Workspace not found');

    const now = new Date().toISOString();
    ws.taskSeq += 1;
    ws.updatedAt = now;
    const taskCode = `CP-${String(ws.taskSeq).padStart(2, '0')}`;
    const status = input.status ?? 'todo';
    const siblingCount = this.data.tasks.filter(
      (t) => t.workspaceId === input.workspaceId && t.status === status,
    ).length;

    const task: Task = {
      id: crypto.randomUUID(),
      workspaceId: input.workspaceId,
      taskCode,
      title: input.title,
      description: input.description ?? '',
      status,
      priority: input.priority ?? 'medium',
      position: siblingCount,
      assigneeId: input.assigneeId ?? null,
      branchName: input.branchName ?? `feat/${taskCode.toLowerCase()}`,
      prNumber: null,
      prUrl: null,
      latestCommitSha: null,
      latestCommitMessage: null,
      diffSummary: null,
      reviewComment: null,
      approvedBy: null,
      approvedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    this.data.tasks.push(task);
    await this.persist();
    return task;
  }

  async updateTask(
    workspaceId: string,
    taskId: string,
    patch: UpdateTaskInput,
  ): Promise<Task | null> {
    const task = this.data.tasks.find(
      (t) => t.workspaceId === workspaceId && t.id === taskId,
    );
    if (!task) return null;
    Object.assign(task, patch, { updatedAt: new Date().toISOString() });
    await this.persist();
    return task;
  }

  async deleteTask(workspaceId: string, taskId: string): Promise<boolean> {
    const idx = this.data.tasks.findIndex(
      (t) => t.workspaceId === workspaceId && t.id === taskId,
    );
    if (idx === -1) return false;
    this.data.tasks.splice(idx, 1);
    await this.persist();
    return true;
  }

  async listWebhookEvents(workspaceId: string): Promise<WebhookEvent[]> {
    return this.data.webhookEvents
      .filter((e) => e.workspaceId === workspaceId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 50);
  }

  async addWebhookEvent(
    event: Omit<WebhookEvent, 'id' | 'createdAt'>,
  ): Promise<WebhookEvent> {
    const created: WebhookEvent = {
      ...event,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.data.webhookEvents.unshift(created);
    if (this.data.webhookEvents.length > 200) {
      this.data.webhookEvents = this.data.webhookEvents.slice(0, 200);
    }
    await this.persist();
    return created;
  }

  async listDeployments(workspaceId: string): Promise<Deployment[]> {
    return this.data.deployments
      .filter((d) => d.workspaceId === workspaceId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getDeploymentById(id: string): Promise<Deployment | null> {
    return this.data.deployments.find((d) => d.id === id) ?? null;
  }

  async createDeployment(
    deployment: Omit<Deployment, 'id' | 'createdAt'>,
  ): Promise<Deployment> {
    const created: Deployment = {
      ...deployment,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.data.deployments.unshift(created);
    await this.persist();
    return created;
  }

  async updateDeployment(
    id: string,
    patch: Partial<Deployment>,
  ): Promise<Deployment | null> {
    const dep = this.data.deployments.find((d) => d.id === id);
    if (!dep) return null;
    Object.assign(dep, patch);
    await this.persist();
    return dep;
  }

  async listLiveSessions(workspaceId: string): Promise<LiveSession[]> {
    return this.data.liveSessions.filter(
      (s) => s.workspaceId === workspaceId && s.isActive,
    );
  }

  async upsertLiveSession(
    session: Omit<LiveSession, 'id' | 'startedAt' | 'endedAt'>,
  ): Promise<LiveSession> {
    const now = new Date().toISOString();
    const existing = this.data.liveSessions.find(
      (s) =>
        s.workspaceId === session.workspaceId &&
        s.userId === session.userId &&
        s.isActive,
    );
    if (existing) {
      Object.assign(existing, session);
      await this.persist();
      return existing;
    }

    const created: LiveSession = {
      ...session,
      id: crypto.randomUUID(),
      startedAt: now,
      endedAt: null,
    };
    this.data.liveSessions.push(created);
    await this.persist();
    return created;
  }

  async endLiveSession(workspaceId: string, userId: string): Promise<LiveSession[]> {
    const now = new Date().toISOString();
    for (const s of this.data.liveSessions) {
      if (s.workspaceId === workspaceId && s.userId === userId && s.isActive) {
        s.isActive = false;
        s.endedAt = now;
      }
    }
    await this.persist();
    return this.listLiveSessions(workspaceId);
  }

  async addWorkspaceMember(
    workspaceId: string,
    userId: string,
    role: UserRole,
  ): Promise<StoredWorkspace | null> {
    const ws = this.data.workspaces.find((w) => w.id === workspaceId);
    const user = this.data.users.find((u) => u.id === userId);
    if (!ws || !user) return null;

    const existing = ws.members.find((m) => m.userId === userId);
    if (existing) {
      if (ws.ownerId !== userId) {
        existing.role = role;
      }
    } else {
      ws.members.push({
        userId: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        role,
        joinedAt: new Date().toISOString(),
      });
    }
    ws.updatedAt = new Date().toISOString();
    await this.persist();
    return ws;
  }

  async updateWorkspaceMemberRole(
    workspaceId: string,
    userId: string,
    role: UserRole,
  ): Promise<StoredWorkspace | null> {
    const ws = this.data.workspaces.find((w) => w.id === workspaceId);
    if (!ws) return null;
    if (ws.ownerId === userId) return ws;
    const member = ws.members.find((m) => m.userId === userId);
    if (!member) return null;
    member.role = role;
    ws.updatedAt = new Date().toISOString();
    await this.persist();
    return ws;
  }

  async removeWorkspaceMember(
    workspaceId: string,
    userId: string,
  ): Promise<StoredWorkspace | null> {
    const ws = this.data.workspaces.find((w) => w.id === workspaceId);
    if (!ws || ws.ownerId === userId) return null;
    ws.members = ws.members.filter((m) => m.userId !== userId);
    ws.updatedAt = new Date().toISOString();
    await this.persist();
    return ws;
  }

  async createInvitation(input: CreateInvitationInput): Promise<WorkspaceInvitation> {
    const ws = this.data.workspaces.find((w) => w.id === input.workspaceId);
    const inviter = this.data.users.find((u) => u.id === input.inviterId);
    if (!ws || !inviter) {
      throw new Error('Workspace or inviter not found');
    }

    const list = (this.data.invitations ??= []);
    let code = generateInviteCode();
    while (list.some((item) => item.inviteCode === code)) {
      code = generateInviteCode();
    }

    const invitation: WorkspaceInvitation = {
      id: crypto.randomUUID(),
      workspaceId: ws.id,
      workspaceName: ws.name,
      workspaceRepo: ws.githubOwner && ws.githubRepo ? `${ws.githubOwner}/${ws.githubRepo}` : null,
      inviterId: inviter.id,
      inviterUsername: inviter.username,
      inviterDisplayName: inviter.displayName,
      inviterAvatarUrl: inviter.avatarUrl,
      inviteeUsername: input.inviteeUsername?.replace(/^@/, '').trim() || null,
      inviteeEmail: input.inviteeEmail?.trim().toLowerCase() || null,
      role: input.role,
      inviteCode: code,
      message: input.message?.trim() || '',
      status: 'pending',
      acceptedBy: null,
      createdAt: new Date().toISOString(),
      respondedAt: null,
    };

    list.unshift(invitation);
    await this.persist();
    return invitation;
  }

  async listWorkspaceInvitations(workspaceId: string): Promise<WorkspaceInvitation[]> {
    const list = this.data.invitations || [];
    return list
      .filter((inv) => inv.workspaceId === workspaceId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async listIncomingInvitations(user: StoredUser): Promise<WorkspaceInvitation[]> {
    const list = this.data.invitations || [];
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
    const list = this.data.invitations || [];
    return list
      .filter((inv) => inv.inviterId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getInvitationById(invitationId: string): Promise<WorkspaceInvitation | null> {
    const list = this.data.invitations || [];
    return list.find((inv) => inv.id === invitationId) ?? null;
  }

  async getInvitationByCode(inviteCode: string): Promise<WorkspaceInvitation | null> {
    const list = this.data.invitations || [];
    const normalized = inviteCode.trim().toUpperCase();
    return list.find((inv) => inv.inviteCode.toUpperCase() === normalized) ?? null;
  }

  async updateInvitationStatus(
    invitationId: string,
    status: InvitationStatus,
    acceptedBy?: string | null,
  ): Promise<WorkspaceInvitation | null> {
    const list = this.data.invitations || [];
    const inv = list.find((item) => item.id === invitationId);
    if (!inv) return null;
    inv.status = status;
    inv.respondedAt = new Date().toISOString();
    if (acceptedBy !== undefined) {
      inv.acceptedBy = acceptedBy;
    }
    await this.persist();
    return inv;
  }
}
