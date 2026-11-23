import type {
  Deployment,
  DiffSummary,
  GitHubRepoItem,
  LiveSession,
  PublicUser,
  SystemCapabilities,
  Task,
  TaskPriority,
  TaskStatus,
  UserRole,
  VercelDetectedPreset,
  VercelEnvVarInput,
  VercelEnvVarItem,
  VercelProjectConfig,
  VercelProjectItem,
  WebhookEvent,
  Workspace,
  WorkspaceInvitation,
} from '../../shared/types.ts';

export function buildInviteUrl(inviteCode: string): string {
  return `${window.location.origin}/?invite=${encodeURIComponent(inviteCode)}`;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errMsg =
      typeof (data as { error?: unknown }).error === 'string'
        ? (data as { error: string }).error
        : `Request failed (${res.status})`;
    throw new Error(errMsg);
  }
  return data as T;
}

export const api = {
  // F-01 Auth & OAuth
  getMe: () =>
    request<{
      user: PublicUser | null;
      users: PublicUser[];
      capabilities: SystemCapabilities;
    }>('/api/auth/me'),

  register: (payload: {
    email: string;
    password: string;
    username: string;
    displayName: string;
    role: UserRole;
  }) =>
    request<{ user: PublicUser }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  login: (payload: { email: string; password: string }) =>
    request<{ user: PublicUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  linkVercelToken: (token: string) =>
    request<{ user: PublicUser }>('/api/auth/vercel/token', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),

  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),

  // F-02 Workspaces & Integrations
  listWorkspaces: () => request<{ workspaces: Workspace[] }>('/api/workspaces'),

  createWorkspace: (payload: { name: string; description?: string }) =>
    request<{ workspace: Workspace }>('/api/workspaces', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateWorkspace: (workspaceId: string, payload: { name?: string; description?: string }) =>
    request<{ workspace: Workspace }>(`/api/workspaces/${workspaceId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deleteWorkspace: (workspaceId: string) =>
    request<{ ok: boolean; deletedId: string }>(`/api/workspaces/${workspaceId}`, {
      method: 'DELETE',
    }),

  listGitHubRepos: () =>
    request<{ repos: GitHubRepoItem[]; source: string; message?: string }>(
      '/api/workspaces/integrations/github-repos',
    ),

  listVercelProjects: () =>
    request<{ projects: VercelProjectItem[]; source: string }>(
      '/api/workspaces/integrations/vercel-projects',
    ),

  connectGitHubRepo: (
    workspaceId: string,
    payload: {
      owner: string;
      repo: string;
      repoId?: number;
      defaultBranch?: string;
      enableProtection?: boolean;
    },
  ) =>
    request<{ workspace: Workspace; notices: string[] }>(
      `/api/workspaces/${workspaceId}/connect-repo`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    ),

  connectVercelProject: (
    workspaceId: string,
    payload: { projectId?: string; projectName: string; autoDeployOnMerge?: boolean },
  ) =>
    request<{ workspace: Workspace }>(
      `/api/workspaces/${workspaceId}/connect-vercel`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    ),

  detectVercelSetup: (workspaceId: string) =>
    request<{
      detected: VercelDetectedPreset;
      config: VercelProjectConfig | null;
      envVars: VercelEnvVarItem[];
    }>(`/api/workspaces/${workspaceId}/vercel/detect`),

  provisionVercelProject: (
    workspaceId: string,
    payload: {
      projectName: string;
      framework?: string | null;
      rootDirectory?: string | null;
      buildCommand?: string | null;
      outputDirectory?: string | null;
      installCommand?: string | null;
      autoDeployOnMerge?: boolean;
      environmentVariables?: VercelEnvVarInput[];
    },
  ) =>
    request<{
      workspace: Workspace;
      created: boolean;
      config: VercelProjectConfig;
      envVars: VercelEnvVarItem[];
    }>(`/api/workspaces/${workspaceId}/vercel/provision`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deleteVercelEnvVar: (workspaceId: string, envId: string) =>
    request<{ ok: boolean }>(`/api/workspaces/${workspaceId}/vercel/env/${envId}`, {
      method: 'DELETE',
    }),

  // F-02 Kanban Tasks
  listTasks: (workspaceId: string) =>
    request<{ tasks: Task[] }>(`/api/workspaces/${workspaceId}/tasks`),

  createTask: (
    workspaceId: string,
    payload: {
      title: string;
      description?: string;
      priority?: TaskPriority;
      assigneeId?: string | null;
      branchName?: string | null;
      status?: TaskStatus;
    },
  ) =>
    request<{ task: Task }>(`/api/workspaces/${workspaceId}/tasks`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateTask: (
    workspaceId: string,
    taskId: string,
    payload: Partial<
      Pick<
        Task,
        'title' | 'description' | 'status' | 'priority' | 'position' | 'assigneeId' | 'branchName'
      >
    >,
  ) =>
    request<{ task: Task }>(`/api/workspaces/${workspaceId}/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deleteTask: (workspaceId: string, taskId: string) =>
    request<{ ok: boolean }>(`/api/workspaces/${workspaceId}/tasks/${taskId}`, {
      method: 'DELETE',
    }),

  // F-03 Webhooks & Simulator
  listWebhookEvents: (workspaceId: string) =>
    request<{ events: WebhookEvent[] }>(
      `/api/webhooks/workspaces/${workspaceId}/events`,
    ),

  simulateWebhook: (
    workspaceId: string,
    payload: {
      eventType: 'push' | 'pull_request';
      branch: string;
      commitMessage: string;
      actorUsername?: string;
      isDirectPushAttempt?: boolean;
    },
  ) =>
    request<{
      blocked: boolean;
      events: WebhookEvent[];
      updatedTasks: Task[];
      latencyMs: number;
    }>(`/api/webhooks/workspaces/${workspaceId}/simulate`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // F-04 Gatekeeper
  toggleBranchProtection: (workspaceId: string, enabled?: boolean) =>
    request<{ workspace: Workspace; notice: string }>(
      `/api/workspaces/${workspaceId}/gatekeeper/branch-protection/toggle`,
      {
        method: 'POST',
        body: JSON.stringify({ enabled }),
      },
    ),

  getTaskDiff: (workspaceId: string, taskId: string) =>
    request<{ diff: DiffSummary | null; source: string }>(
      `/api/workspaces/${workspaceId}/gatekeeper/tasks/${taskId}/diff`,
    ),

  approveAndMerge: (
    workspaceId: string,
    taskId: string,
    payload: { reviewComment?: string; triggerDeploy?: boolean },
  ) =>
    request<{
      task: Task;
      event: WebhookEvent;
      deployment: Deployment | null;
      notice: string;
    }>(`/api/workspaces/${workspaceId}/gatekeeper/tasks/${taskId}/approve-merge`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  requestChanges: (workspaceId: string, taskId: string, reviewComment: string) =>
    request<{ task: Task; event: WebhookEvent }>(
      `/api/workspaces/${workspaceId}/gatekeeper/tasks/${taskId}/request-changes`,
      {
        method: 'POST',
        body: JSON.stringify({ reviewComment }),
      },
    ),

  // F-05 Vercel Deployments
  listDeployments: (workspaceId: string) =>
    request<{ deployments: Deployment[] }>(
      `/api/workspaces/${workspaceId}/deployments`,
    ),

  triggerDeployment: (
    workspaceId: string,
    payload?: { branch?: string; commitMessage?: string; taskId?: string | null },
  ) =>
    request<{ deployment: Deployment }>(
      `/api/workspaces/${workspaceId}/deployments`,
      {
        method: 'POST',
        body: JSON.stringify(payload || {}),
      },
    ),

  // F-06 Live Screen Monitor Sessions
  listLiveSessions: (workspaceId: string) =>
    request<{ sessions: LiveSession[] }>(`/api/workspaces/${workspaceId}/sessions`),

  startLiveSession: (
    workspaceId: string,
    payload: {
      activeTaskCode?: string | null;
      streamLabel?: string;
      fps?: number;
      resolution?: string;
    },
  ) =>
    request<{ session: LiveSession; sessions: LiveSession[] }>(
      `/api/workspaces/${workspaceId}/sessions/start`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    ),

  stopLiveSession: (workspaceId: string) =>
    request<{ sessions: LiveSession[] }>(
      `/api/workspaces/${workspaceId}/sessions/stop`,
      {
        method: 'POST',
      },
    ),

  // Team Invitations & Project Member Governance
  listMyInvitations: () =>
    request<{ incoming: WorkspaceInvitation[]; sent: WorkspaceInvitation[] }>(
      '/api/invitations/mine',
    ),

  listWorkspaceInvitations: (workspaceId: string) =>
    request<{ invitations: WorkspaceInvitation[] }>(
      `/api/workspaces/${workspaceId}/invitations`,
    ),

  sendWorkspaceInvitation: (
    workspaceId: string,
    payload: { target?: string; role: UserRole; message?: string },
  ) =>
    request<{ invitation: WorkspaceInvitation }>(
      `/api/workspaces/${workspaceId}/invitations`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    ),

  joinWithInviteCode: (code: string) =>
    request<{ workspace: Workspace; invitation: WorkspaceInvitation }>('/api/invitations/join', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

  acceptInvitation: (invitationId: string) =>
    request<{ workspace: Workspace; invitation: WorkspaceInvitation }>(
      `/api/invitations/${invitationId}/accept`,
      { method: 'POST' },
    ),

  declineInvitation: (invitationId: string) =>
    request<{ invitation: WorkspaceInvitation }>(`/api/invitations/${invitationId}/decline`, {
      method: 'POST',
    }),

  revokeInvitation: (invitationId: string) =>
    request<{ invitation: WorkspaceInvitation }>(`/api/invitations/${invitationId}`, {
      method: 'DELETE',
    }),

  updateWorkspaceMemberRole: (workspaceId: string, userId: string, role: UserRole) =>
    request<{ workspace: Workspace }>(`/api/workspaces/${workspaceId}/members/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),

  removeWorkspaceMember: (workspaceId: string, userId: string) =>
    request<{ workspace: Workspace }>(`/api/workspaces/${workspaceId}/members/${userId}`, {
      method: 'DELETE',
    }),
};

