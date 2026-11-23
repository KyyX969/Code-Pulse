import type { PublicUser, UserRole, Workspace, WorkspaceMember } from './types.ts';

interface WorkspaceRoleContext {
  ownerId: string;
  members: Array<Pick<WorkspaceMember, 'userId' | 'role'>>;
}

interface UserRoleContext {
  id: string;
  role: UserRole;
}

/** Resolves a user's effective role inside a specific project workspace. */
export function getWorkspaceMemberRole(
  workspace: Pick<Workspace, 'ownerId' | 'members'> | WorkspaceRoleContext,
  user: Pick<PublicUser, 'id' | 'role'> | UserRoleContext,
): UserRole {
  if (workspace.ownerId === user.id) return 'leader';
  const entry = workspace.members.find((m) => m.userId === user.id);
  if (entry) return entry.role;
  return user.role;
}

/** True when the user owns or holds Project Leader permissions in the given workspace. */
export function isWorkspaceLeader(
  workspace: Pick<Workspace, 'ownerId' | 'members'> | WorkspaceRoleContext,
  user: Pick<PublicUser, 'id' | 'role'> | UserRoleContext,
): boolean {
  return getWorkspaceMemberRole(workspace, user) === 'leader';
}

