import type {
  Deployment,
  InvitationStatus,
  LiveSession,
  PublicUser,
  Task,
  TaskPriority,
  TaskStatus,
  UserRole,
  WebhookEvent,
  Workspace,
  WorkspaceInvitation,
} from '../../../shared/types.js';

export interface StoredUser {
  id: string;
  githubId: string | null;
  username: string;
  displayName: string;
  avatarUrl: string;
  email: string | null;
  role: UserRole;
  passwordHash?: string | null;
  githubTokenEncrypted: string | null;
  vercelTokenEncrypted: string | null;
  vercelTeamId: string | null;
  vercelUsername: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StoredWorkspace extends Workspace {
  webhookSecretEncrypted: string | null;
}

export interface CreateWorkspaceInput {
  name: string;
  description?: string;
  ownerId: string;
}

export interface CreateTaskInput {
  workspaceId: string;
  title: string;
  description?: string;
  priority?: TaskPriority;
  assigneeId?: string | null;
  branchName?: string | null;
  status?: TaskStatus;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  position?: number;
  assigneeId?: string | null;
  branchName?: string | null;
  prNumber?: number | null;
  prUrl?: string | null;
  latestCommitSha?: string | null;
  latestCommitMessage?: string | null;
  diffSummary?: Task['diffSummary'];
  reviewComment?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
}

export interface CreateInvitationInput {
  workspaceId: string;
  inviterId: string;
  inviteeUsername?: string | null;
  inviteeEmail?: string | null;
  role: UserRole;
  message?: string;
}

export interface DataStore {
  init(): Promise<void>;

  // Users
  getUserById(id: string): Promise<StoredUser | null>;
  getUserByUsername(username: string): Promise<StoredUser | null>;
  getUserByEmail(email: string): Promise<StoredUser | null>;
  getUserByGithubId(githubId: string): Promise<StoredUser | null>;
  listUsers(): Promise<StoredUser[]>;
  upsertUser(user: Partial<StoredUser> & { username: string; displayName: string }): Promise<StoredUser>;
  updateUserRole(userId: string, role: UserRole): Promise<StoredUser | null>;

  // Workspaces & Members
  listWorkspaces(): Promise<StoredWorkspace[]>;
  getWorkspaceById(id: string): Promise<StoredWorkspace | null>;
  getWorkspaceByRepo(owner: string, repo: string): Promise<StoredWorkspace | null>;
  createWorkspace(input: CreateWorkspaceInput): Promise<StoredWorkspace>;
  updateWorkspace(
    id: string,
    patch: Partial<Omit<StoredWorkspace, 'id' | 'createdAt'>>,
  ): Promise<StoredWorkspace | null>;
  deleteWorkspace(id: string): Promise<boolean>;
  addWorkspaceMember(
    workspaceId: string,
    userId: string,
    role: UserRole,
  ): Promise<StoredWorkspace | null>;
  updateWorkspaceMemberRole(
    workspaceId: string,
    userId: string,
    role: UserRole,
  ): Promise<StoredWorkspace | null>;
  removeWorkspaceMember(workspaceId: string, userId: string): Promise<StoredWorkspace | null>;

  // Workspace Invitations
  createInvitation(input: CreateInvitationInput): Promise<WorkspaceInvitation>;
  listWorkspaceInvitations(workspaceId: string): Promise<WorkspaceInvitation[]>;
  listIncomingInvitations(user: StoredUser): Promise<WorkspaceInvitation[]>;
  listSentInvitations(userId: string): Promise<WorkspaceInvitation[]>;
  getInvitationById(invitationId: string): Promise<WorkspaceInvitation | null>;
  getInvitationByCode(inviteCode: string): Promise<WorkspaceInvitation | null>;
  updateInvitationStatus(
    invitationId: string,
    status: InvitationStatus,
    acceptedBy?: string | null,
  ): Promise<WorkspaceInvitation | null>;

  // Tasks
  listTasks(workspaceId: string): Promise<Task[]>;
  getTaskById(workspaceId: string, taskId: string): Promise<Task | null>;
  getTaskByCode(workspaceId: string, taskCode: string): Promise<Task | null>;
  createTask(input: CreateTaskInput): Promise<Task>;
  updateTask(workspaceId: string, taskId: string, patch: UpdateTaskInput): Promise<Task | null>;
  deleteTask(workspaceId: string, taskId: string): Promise<boolean>;

  // Webhook Events
  listWebhookEvents(workspaceId: string): Promise<WebhookEvent[]>;
  addWebhookEvent(event: Omit<WebhookEvent, 'id' | 'createdAt'>): Promise<WebhookEvent>;

  // Deployments
  listDeployments(workspaceId: string): Promise<Deployment[]>;
  getDeploymentById(id: string): Promise<Deployment | null>;
  createDeployment(deployment: Omit<Deployment, 'id' | 'createdAt'>): Promise<Deployment>;
  updateDeployment(id: string, patch: Partial<Deployment>): Promise<Deployment | null>;

  // Live Sessions
  listLiveSessions(workspaceId: string): Promise<LiveSession[]>;
  upsertLiveSession(
    session: Omit<LiveSession, 'id' | 'startedAt' | 'endedAt'>,
  ): Promise<LiveSession>;
  endLiveSession(workspaceId: string, userId: string): Promise<LiveSession[]>;
}

export function toPublicUser(user: StoredUser): PublicUser {
  return {
    id: user.id,
    githubId: user.githubId,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    email: user.email,
    role: user.role,
    githubConnected: Boolean(user.githubTokenEncrypted),
    vercelConnected: Boolean(user.vercelTokenEncrypted),
    vercelUsername: user.vercelUsername,
  };
}

export function toPublicWorkspace(ws: StoredWorkspace): Workspace {
  const { webhookSecretEncrypted: _secret, ...rest } = ws;
  void _secret;
  return rest;
}
