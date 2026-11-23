-- CodePulse Database Schema (Supabase / PostgreSQL)
-- Implements F-01 through F-06 data model + Realtime sync

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Users (GitHub & Vercel OAuth identities + encrypted tokens)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  github_id TEXT UNIQUE,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('leader', 'member')),
  github_token_encrypted TEXT,
  vercel_token_encrypted TEXT,
  vercel_team_id TEXT,
  vercel_username TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Workspaces (Projects linked to GitHub Repo + Vercel Project)
CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  github_owner TEXT,
  github_repo TEXT,
  github_repo_id BIGINT,
  default_branch TEXT NOT NULL DEFAULT 'main',
  branch_protected BOOLEAN NOT NULL DEFAULT FALSE,
  webhook_id BIGINT,
  webhook_secret_encrypted TEXT,
  vercel_project_id TEXT,
  vercel_project_name TEXT,
  auto_deploy_on_merge BOOLEAN NOT NULL DEFAULT TRUE,
  task_seq INTEGER NOT NULL DEFAULT 0,
  blocked_direct_pushes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Workspace Members
CREATE TABLE IF NOT EXISTS public.workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('leader', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, user_id)
);

-- 4. Tasks (Kanban cards with unique #CP-XX code + Git/PR metadata)
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  task_code TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'in_review', 'done')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  position INTEGER NOT NULL DEFAULT 0,
  assignee_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  branch_name TEXT,
  pr_number INTEGER,
  pr_url TEXT,
  latest_commit_sha TEXT,
  latest_commit_message TEXT,
  diff_summary JSONB,
  review_comment TEXT,
  approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, task_code)
);

-- 5. GitHub Webhook & Gatekeeper Audit Events
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('push', 'pull_request', 'direct_push_blocked', 'gatekeeper_merge', 'gatekeeper_rejected')),
  delivery_id TEXT,
  branch TEXT,
  actor_username TEXT,
  commit_sha TEXT,
  commit_message TEXT,
  matched_task_code TEXT,
  status_transition TEXT,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  payload_summary JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Vercel Deployments
CREATE TABLE IF NOT EXISTS public.deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  vercel_deployment_id TEXT,
  branch TEXT NOT NULL DEFAULT 'main',
  commit_sha TEXT,
  commit_message TEXT,
  status TEXT NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED', 'BUILDING', 'READY', 'ERROR')),
  preview_url TEXT,
  inspector_url TEXT,
  build_logs JSONB NOT NULL DEFAULT '[]'::jsonb,
  triggered_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ready_at TIMESTAMPTZ
);

-- 7. Live Screen Monitor Sessions (WebRTC presence)
CREATE TABLE IF NOT EXISTS public.live_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  active_task_code TEXT,
  stream_label TEXT DEFAULT 'IDE Window',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

-- 8. Workspace Invitations (Direct @username/email invites & shareable invite codes)
CREATE TABLE IF NOT EXISTS public.workspace_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  inviter_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  invitee_username TEXT,
  invitee_email TEXT,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('leader', 'member')),
  invite_code TEXT NOT NULL UNIQUE,
  message TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'revoked')),
  accepted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_tasks_workspace_status ON public.tasks (workspace_id, status, position);
CREATE INDEX IF NOT EXISTS idx_tasks_code ON public.tasks (workspace_id, task_code);
CREATE INDEX IF NOT EXISTS idx_webhook_events_workspace ON public.webhook_events (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deployments_workspace ON public.deployments (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_live_sessions_active ON public.live_sessions (workspace_id, is_active);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_workspace ON public.workspace_invitations (workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_code ON public.workspace_invitations (invite_code);

-- Updated_at trigger helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users;
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_workspaces_updated_at ON public.workspaces;
CREATE TRIGGER trg_workspaces_updated_at BEFORE UPDATE ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_tasks_updated_at ON public.tasks;
CREATE TRIGGER trg_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Enable Row Level Security (backend uses service_role key; clients can subscribe read-only via anon key)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_invitations ENABLE ROW LEVEL SECURITY;

-- Public read policies for Supabase Realtime subscriptions on board/deployment/live state
-- Note: Sensitive token columns live on public.users which should not be exposed to anon reads.
DROP POLICY IF EXISTS "Realtime read tasks" ON public.tasks;
CREATE POLICY "Realtime read tasks" ON public.tasks FOR SELECT USING (true);

DROP POLICY IF EXISTS "Realtime read webhook_events" ON public.webhook_events;
CREATE POLICY "Realtime read webhook_events" ON public.webhook_events FOR SELECT USING (true);

DROP POLICY IF EXISTS "Realtime read deployments" ON public.deployments;
CREATE POLICY "Realtime read deployments" ON public.deployments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Realtime read live_sessions" ON public.live_sessions;
CREATE POLICY "Realtime read live_sessions" ON public.live_sessions FOR SELECT USING (true);

-- Enable Supabase Realtime Publication
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.webhook_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.deployments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_sessions;

