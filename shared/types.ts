export type UserRole = 'leader' | 'member';

export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export type DeploymentStatus = 'QUEUED' | 'BUILDING' | 'READY' | 'ERROR';

export type WebhookEventType =
  | 'push'
  | 'pull_request'
  | 'direct_push_blocked'
  | 'gatekeeper_merge'
  | 'gatekeeper_rejected';

export interface PublicUser {
  id: string;
  githubId: string | null;
  username: string;
  displayName: string;
  avatarUrl: string;
  email: string | null;
  role: UserRole;
  githubConnected: boolean;
  vercelConnected: boolean;
  vercelUsername: string | null;
}

export interface WorkspaceMember {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  role: UserRole;
  joinedAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description: string;
  ownerId: string;
  githubOwner: string | null;
  githubRepo: string | null;
  githubRepoId: number | null;
  defaultBranch: string;
  branchProtected: boolean;
  webhookId: number | null;
  webhookActive: boolean;
  vercelProjectId: string | null;
  vercelProjectName: string | null;
  autoDeployOnMerge: boolean;
  taskSeq: number;
  blockedDirectPushes: number;
  createdAt: string;
  updatedAt: string;
  members: WorkspaceMember[];
}

export interface DiffFile {
  filename: string;
  status: 'added' | 'modified' | 'removed' | 'renamed';
  additions: number;
  deletions: number;
  patch: string;
}

export interface DiffSummary {
  baseBranch: string;
  headBranch: string;
  totalAdditions: number;
  totalDeletions: number;
  changedFiles: number;
  files: DiffFile[];
  commitAuthor?: string;
  commitTimestamp?: string;
}

export interface Task {
  id: string;
  workspaceId: string;
  taskCode: string; // e.g., "CP-01"
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  position: number;
  assigneeId: string | null;
  branchName: string | null;
  prNumber: number | null;
  prUrl: string | null;
  latestCommitSha: string | null;
  latestCommitMessage: string | null;
  diffSummary: DiffSummary | null;
  reviewComment: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookEvent {
  id: string;
  workspaceId: string;
  eventType: WebhookEventType;
  deliveryId: string | null;
  branch: string | null;
  actorUsername: string;
  commitSha: string | null;
  commitMessage: string | null;
  matchedTaskCode: string | null;
  statusTransition: string | null;
  latencyMs: number;
  blocked: boolean;
  reason?: string;
  createdAt: string;
}

export interface Deployment {
  id: string;
  workspaceId: string;
  taskId: string | null;
  vercelDeploymentId: string | null;
  branch: string;
  commitSha: string | null;
  commitMessage: string | null;
  status: DeploymentStatus;
  previewUrl: string | null;
  inspectorUrl: string | null;
  buildLogs: string[];
  triggeredBy: string | null;
  triggeredByUsername: string | null;
  createdAt: string;
  readyAt: string | null;
}

export interface LiveSession {
  id: string;
  workspaceId: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  activeTaskCode: string | null;
  streamLabel: string;
  isActive: boolean;
  startedAt: string;
  endedAt: string | null;
  fps?: number;
  resolution?: string;
}

export interface SystemCapabilities {
  mode: 'supabase' | 'local';
  githubOAuthConfigured: boolean;
  vercelOAuthConfigured: boolean;
  webhookSecretConfigured: boolean;
  iceServers: RTCIceServerConfig[];
}

export interface RTCIceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface GitHubRepoItem {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  defaultBranch: string;
  private: boolean;
  htmlUrl: string;
}

export interface VercelProjectItem {
  id: string;
  name: string;
  framework: string | null;
  latestUrl: string | null;
}

export interface VercelProjectConfig {
  projectId: string;
  projectName: string;
  framework: string | null;
  rootDirectory: string | null;
  buildCommand: string | null;
  outputDirectory: string | null;
  installCommand: string | null;
}

export interface VercelDetectedPreset {
  framework: string | null;
  label: string;
  buildCommand: string;
  outputDirectory: string;
  installCommand: string;
  rootDirectory: string;
  packageJsonFound: boolean;
}

export interface VercelEnvVarInput {
  key: string;
  value: string;
  target?: Array<'production' | 'preview' | 'development'>;
}

export interface VercelEnvVarItem {
  id: string;
  key: string;
  type: string;
  target: string[];
}

export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'revoked';

export interface WorkspaceInvitation {
  id: string;
  workspaceId: string;
  workspaceName: string;
  workspaceRepo: string | null;
  inviterId: string;
  inviterUsername: string;
  inviterDisplayName: string;
  inviterAvatarUrl: string;
  inviteeUsername: string | null;
  inviteeEmail: string | null;
  role: UserRole;
  inviteCode: string;
  message: string;
  status: InvitationStatus;
  acceptedBy: string | null;
  createdAt: string;
  respondedAt: string | null;
}

export type RealtimeServerMessage =
  | { type: 'connected'; clientId: string }
  | { type: 'task:created'; workspaceId: string; task: Task }
  | { type: 'task:updated'; workspaceId: string; task: Task }
  | { type: 'task:deleted'; workspaceId: string; taskId: string }
  | { type: 'workspace:updated'; workspace: Workspace }
  | { type: 'webhook:received'; workspaceId: string; event: WebhookEvent }
  | { type: 'deployment:updated'; workspaceId: string; deployment: Deployment }
  | { type: 'session:updated'; workspaceId: string; sessions: LiveSession[] }
  | { type: 'invitation:updated'; workspaceId: string; invitation: WorkspaceInvitation }
  | {
      type: 'rtc:signal';
      workspaceId: string;
      fromUserId: string;
      toUserId: string;
      signalType: 'offer' | 'answer' | 'ice-candidate' | 'viewer-join' | 'broadcaster-ready';
      payload: unknown;
    };

