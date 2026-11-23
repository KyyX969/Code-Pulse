import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Ban,
  BarChart3,
  Check,
  CheckCircle2,
  Circle,
  Copy,
  ExternalLink,
  GitBranch,
  GitMerge,
  Layers,
  Lock,
  LogOut,
  Pencil,
  PieChart,
  Plus,
  RefreshCw,
  Rocket,
  Search,
  Trash2,
  TrendingUp,
  Unlock,
  X,
  Zap,
} from 'lucide-react';
import { getWorkspaceMemberRole } from '../../shared/permissions.ts';
import type {
  Deployment,
  GitHubRepoItem,
  PublicUser,
  SystemCapabilities,
  Task,
  WebhookEvent,
  Workspace,
  WorkspaceInvitation,
} from '../../shared/types.ts';
import { api } from '../lib/api.ts';
import { useLanguage } from '../lib/i18nContext.ts';
import type { PaletteTab } from './CommandPalette.tsx';
import { GitHubIcon } from './GitHubIcon.tsx';
import { IntegrationsVaultView } from './IntegrationsVaultView.tsx';
import { InvitationsView } from './InvitationsView.tsx';
import {
  ActivityFeedSkeleton,
  OverviewTelemetrySkeleton,
  RepoGridSkeleton,
  RepoListSkeleton,
} from './LoadingUI.tsx';
import { VercelIcon } from './VercelIcon.tsx';
import {
  InteractiveDonutChart,
  MiniSparkline,
  RadialScoreGauge,
  SevenDayPulseChart,
  type DailyPulsePoint,
  type DonutSegment,
} from './OverviewCharts.tsx';
import { VercelTokenGuide } from './VercelTokenGuide.tsx';

export type ConsoleSection =
  | 'home'
  | 'projects'
  | 'invitations'
  | 'repos'
  | 'activity'
  | 'guide'
  | 'vault';

interface ConsoleViewProps {
  section: ConsoleSection;
  currentUser: PublicUser;
  workspaces: Workspace[];
  capabilities: SystemCapabilities | null;
  repos: GitHubRepoItem[];
  reposLoading: boolean;
  reposError: string | null;
  incomingInvitations: WorkspaceInvitation[];
  sentInvitations: WorkspaceInvitation[];
  pendingInviteCode?: string;
  onRefreshRepos: () => Promise<void>;
  onRefreshInvitations: () => Promise<void>;
  onWorkspaceJoined: (ws: Workspace) => Promise<void>;
  onImportRepo: (repo: GitHubRepoItem) => Promise<void>;
  importingRepoId: number | null;
  onNavigateSection: (section: ConsoleSection) => void;
  onEnterProject: (workspaceId: string, tab?: PaletteTab) => Promise<void>;
  onOpenNewWorkspaceModal: () => void;
  onWorkspaceUpdated: (ws: Workspace) => void;
  onWorkspaceDeleted: (workspaceId: string) => void;
  onUserUpdated: (user: PublicUser) => void;
  onToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export function ConsoleViewRouter({
  section,
  currentUser,
  workspaces,
  capabilities,
  repos,
  reposLoading,
  reposError,
  incomingInvitations,
  sentInvitations,
  pendingInviteCode,
  onRefreshRepos,
  onRefreshInvitations,
  onWorkspaceJoined,
  onImportRepo,
  importingRepoId,
  onNavigateSection,
  onEnterProject,
  onOpenNewWorkspaceModal,
  onWorkspaceUpdated,
  onWorkspaceDeleted,
  onUserUpdated,
  onToast,
}: ConsoleViewProps) {
  switch (section) {
    case 'home':
      return (
        <HomeOverviewSection
          currentUser={currentUser}
          workspaces={workspaces}
          capabilities={capabilities}
          repos={repos}
          reposLoading={reposLoading}
          importingRepoId={importingRepoId}
          onImportRepo={onImportRepo}
          onNavigateSection={onNavigateSection}
          onEnterProject={onEnterProject}
          onOpenNewWorkspaceModal={onOpenNewWorkspaceModal}
        />
      );
    case 'projects':
      return (
        <ProjectsDirectorySection
          currentUser={currentUser}
          workspaces={workspaces}
          onEnterProject={onEnterProject}
          onOpenNewWorkspaceModal={onOpenNewWorkspaceModal}
          onWorkspaceUpdated={onWorkspaceUpdated}
          onWorkspaceDeleted={onWorkspaceDeleted}
          onToast={onToast}
        />
      );
    case 'invitations':
      return (
        <InvitationsView
          currentUser={currentUser}
          workspaces={workspaces}
          incoming={incomingInvitations}
          sent={sentInvitations}
          initialInviteCode={pendingInviteCode}
          onRefreshInvitations={onRefreshInvitations}
          onWorkspaceJoined={onWorkspaceJoined}
          onToast={onToast}
        />
      );
    case 'repos':
      return (
        <RepositoriesSection
          currentUser={currentUser}
          capabilities={capabilities}
          repos={repos}
          reposLoading={reposLoading}
          reposError={reposError}
          importingRepoId={importingRepoId}
          onRefreshRepos={onRefreshRepos}
          onImportRepo={onImportRepo}
        />
      );
    case 'activity':
      return (
        <ActivityLogsSection
          workspaces={workspaces}
          onEnterProject={onEnterProject}
          onOpenNewWorkspaceModal={onOpenNewWorkspaceModal}
        />
      );
    case 'guide':
      return <SetupGuideSection onToast={onToast} />;
    case 'vault':
      return (
        <IntegrationsVaultView
          currentUser={currentUser}
          capabilities={capabilities}
          workspaces={workspaces}
          repos={repos}
          onNavigateSection={onNavigateSection}
          onUserUpdated={onUserUpdated}
          onToast={onToast}
        />
      );
  }
}

interface ProjectTelemetry {
  workspace: Workspace;
  tasks: Task[];
  deployments: Deployment[];
  events: WebhookEvent[];
}

interface OverviewTelemetrySnapshot {
  tasks: Task[];
  deployments: Array<Deployment & { workspaceName: string }>;
  events: Array<WebhookEvent & { workspaceName: string }>;
  byProject: ProjectTelemetry[];
  loaded: boolean;
}

function getLocalDateKey(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function HomeOverviewSection({
  currentUser,
  workspaces,
  capabilities,
  repos,
  reposLoading,
  importingRepoId,
  onImportRepo,
  onNavigateSection,
  onEnterProject,
  onOpenNewWorkspaceModal,
}: {
  currentUser: PublicUser;
  workspaces: Workspace[];
  capabilities: SystemCapabilities | null;
  repos: GitHubRepoItem[];
  reposLoading: boolean;
  importingRepoId: number | null;
  onImportRepo: (repo: GitHubRepoItem) => Promise<void>;
  onNavigateSection: (section: ConsoleSection) => void;
  onEnterProject: (workspaceId: string, tab?: PaletteTab) => Promise<void>;
  onOpenNewWorkspaceModal: () => void;
}) {
  const { L, locale } = useLanguage();
  const [telemetry, setTelemetry] = useState<OverviewTelemetrySnapshot>({
    tasks: [],
    deployments: [],
    events: [],
    byProject: [],
    loaded: false,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [donutMode, setDonutMode] = useState<'repos' | 'tasks' | 'deploys' | null>(null);
  const [quickRepoFilter, setQuickRepoFilter] = useState('');

  const fetchAllTelemetry = useCallback(async (): Promise<OverviewTelemetrySnapshot> => {
    if (workspaces.length === 0) {
      return { tasks: [], deployments: [], events: [], byProject: [], loaded: true };
    }
    const results = await Promise.all(
      workspaces.map(async (ws) => {
        const [taskRes, depRes, evtRes] = await Promise.all([
          api.listTasks(ws.id).catch(() => ({ tasks: [] as Task[] })),
          api.listDeployments(ws.id).catch(() => ({ deployments: [] as Deployment[] })),
          api.listWebhookEvents(ws.id).catch(() => ({ events: [] as WebhookEvent[] })),
        ]);
        return {
          workspace: ws,
          tasks: taskRes.tasks,
          deployments: depRes.deployments,
          events: evtRes.events,
        };
      }),
    );

    const tasks = results.flatMap((r) => r.tasks);
    const deployments = results
      .flatMap((r) =>
        r.deployments.map((d) => ({ ...d, workspaceName: r.workspace.name })),
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const events = results
      .flatMap((r) => r.events.map((e) => ({ ...e, workspaceName: r.workspace.name })))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return {
      tasks,
      deployments,
      events,
      byProject: results,
      loaded: true,
    };
  }, [workspaces]);

  useEffect(() => {
    let cancelled = false;
    void fetchAllTelemetry().then((snapshot) => {
      if (!cancelled) setTelemetry(snapshot);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchAllTelemetry]);

  async function handleRefreshTelemetry() {
    setRefreshing(true);
    try {
      const snapshot = await fetchAllTelemetry();
      setTelemetry(snapshot);
    } finally {
      setRefreshing(false);
    }
  }

  // Real aggregated analytics
  const linkedRepoKeys = useMemo(
    () =>
      new Set(
        workspaces
          .filter((w) => w.githubOwner && w.githubRepo)
          .map((w) => `${w.githubOwner}/${w.githubRepo}`.toLowerCase()),
      ),
    [workspaces],
  );
  const linkedReposCount = workspaces.filter((w) => Boolean(w.githubRepo)).length;
  const protectedCount = workspaces.filter((w) => w.branchProtected).length;
  const vercelLinkedProjects = workspaces.filter((w) => Boolean(w.vercelProjectId)).length;

  const taskCounts = useMemo(() => {
    const counts = { todo: 0, in_progress: 0, in_review: 0, done: 0 };
    for (const t of telemetry.tasks) {
      counts[t.status] += 1;
    }
    return counts;
  }, [telemetry.tasks]);

  const totalTasks = telemetry.tasks.length;
  const completionRate =
    totalTasks > 0 ? Math.round((taskCounts.done / totalTasks) * 100) : 0;

  const deployStats = useMemo(() => {
    let liveReady = 0;
    let simulated = 0;
    let active = 0;
    let failed = 0;
    for (const d of telemetry.deployments) {
      const isSim = d.vercelDeploymentId?.startsWith('dpl_sim_') ?? false;
      if (d.status === 'ERROR') failed += 1;
      else if (d.status === 'BUILDING' || d.status === 'QUEUED') active += 1;
      else if (isSim) simulated += 1;
      else liveReady += 1;
    }
    const readyTotal = liveReady + simulated;
    const total = telemetry.deployments.length;
    const successRate = total > 0 ? Math.round((readyTotal / total) * 100) : 0;
    return { liveReady, simulated, active, failed, total, successRate };
  }, [telemetry.deployments]);

  const blockedPushes = useMemo(
    () =>
      workspaces.reduce((sum, w) => sum + (w.blockedDirectPushes || 0), 0) ||
      telemetry.events.filter((e) => e.blocked).length,
    [workspaces, telemetry.events],
  );

  const avgLatencyMs = useMemo(() => {
    if (telemetry.events.length === 0) return 0;
    const sum = telemetry.events.reduce((acc, e) => acc + (e.latencyMs || 0), 0);
    return Math.round(sum / telemetry.events.length);
  }, [telemetry.events]);

  // 7-day rolling timeline computed strictly from real timestamps
  const sevenDayData = useMemo<DailyPulsePoint[]>(() => {
    const days: DailyPulsePoint[] = [];
    const now = new Date();
    const dateLocale = locale === 'id' ? 'id-ID' : 'en-US';
    for (let offset = 6; offset >= 0; offset -= 1) {
      const d = new Date(now);
      d.setDate(now.getDate() - offset);
      const key = getLocalDateKey(d);
      const label =
        offset === 0
          ? L('Hari Ini', 'Today')
          : d.toLocaleDateString(dateLocale, { month: 'short', day: 'numeric' });
      days.push({ dateKey: key, label, events: 0, deployments: 0, tasks: 0 });
    }
    const byKey = new Map(days.map((d) => [d.dateKey, d]));

    for (const t of telemetry.tasks) {
      const bucket = byKey.get(getLocalDateKey(t.updatedAt || t.createdAt));
      if (bucket) bucket.tasks += 1;
    }
    for (const ev of telemetry.events) {
      const bucket = byKey.get(getLocalDateKey(ev.createdAt));
      if (bucket) bucket.events += 1;
    }
    for (const dep of telemetry.deployments) {
      const bucket = byKey.get(getLocalDateKey(dep.createdAt));
      if (bucket) bucket.deployments += 1;
    }
    return days;
  }, [L, locale, telemetry.tasks, telemetry.events, telemetry.deployments]);

  // Donut segments across selectable modes (Repos, Tasks, Deploys)
  const effectiveDonutMode = donutMode ?? (totalTasks > 0 ? 'tasks' : 'repos');

  const donutConfig = useMemo<{
    segments: DonutSegment[];
    centerLabel: string;
    emptyText: string;
  }>(() => {
    if (effectiveDonutMode === 'tasks') {
      return {
        centerLabel: L('Total Tugas', 'Total Tasks'),
        emptyText: L(
          'Belum ada tugas di proyek Anda. Buka papan Kanban proyek untuk menambahkan tugas.',
          'No tasks yet across your projects. Open a project Kanban board to add tasks.',
        ),
        segments: [
          {
            id: 'done',
            label: L('Selesai & Merge', 'Done & Merged'),
            value: taskCounts.done,
            color: '#34d399',
            tailwindDot: 'bg-emerald-400',
          },
          {
            id: 'in_review',
            label: L('Dalam Review (PR)', 'In Review (PR)'),
            value: taskCounts.in_review,
            color: '#a78bfa',
            tailwindDot: 'bg-violet-400',
          },
          {
            id: 'in_progress',
            label: L('Sedang Dikerjakan', 'In Progress'),
            value: taskCounts.in_progress,
            color: '#22d3ee',
            tailwindDot: 'bg-cyan-400',
          },
          {
            id: 'todo',
            label: L('Backlog To Do', 'To Do Backlog'),
            value: taskCounts.todo,
            color: '#64748b',
            tailwindDot: 'bg-slate-400',
          },
        ],
      };
    }

    if (effectiveDonutMode === 'deploys') {
      return {
        centerLabel: L('Deployment', 'Deployments'),
        emptyText: L(
          'Belum ada deployment yang dijalankan. Buka tab Deployment proyek untuk memulai.',
          'No deployments triggered yet. Open a project Deployments tab to launch.',
        ),
        segments: [
          {
            id: 'live',
            label: L('Live Siap', 'Live Ready'),
            value: deployStats.liveReady,
            color: '#34d399',
            tailwindDot: 'bg-emerald-400',
          },
          {
            id: 'sim',
            label: L('Simulasi', 'Simulated'),
            value: deployStats.simulated,
            color: '#fbbf24',
            tailwindDot: 'bg-amber-400',
          },
          {
            id: 'building',
            label: L('Sedang Build', 'Building'),
            value: deployStats.active,
            color: '#22d3ee',
            tailwindDot: 'bg-cyan-400',
          },
          {
            id: 'failed',
            label: L('Gagal', 'Failed'),
            value: deployStats.failed,
            color: '#fb7185',
            tailwindDot: 'bg-rose-400',
          },
        ],
      };
    }

    // Repositories breakdown
    let linkedCount = 0;
    let publicUnlinked = 0;
    let privateUnlinked = 0;
    for (const r of repos) {
      if (linkedRepoKeys.has(r.fullName.toLowerCase())) {
        linkedCount += 1;
      } else if (r.private) {
        privateUnlinked += 1;
      } else {
        publicUnlinked += 1;
      }
    }
    return {
      centerLabel: L('Repo GitHub', 'GitHub Repos'),
      emptyText: L(
        'Hubungkan GitHub OAuth untuk memeriksa portofolio repository Anda.',
        'Connect GitHub OAuth to inspect your repository portfolio.',
      ),
      segments: [
        {
          id: 'linked',
          label: L('Repo Terhubung', 'Linked Repos'),
          value: linkedCount,
          color: '#34d399',
          tailwindDot: 'bg-emerald-400',
        },
        {
          id: 'public',
          label: L('Repo Publik', 'Public Repos'),
          value: publicUnlinked,
          color: '#22d3ee',
          tailwindDot: 'bg-cyan-400',
        },
        {
          id: 'private',
          label: L('Repo Privat', 'Private Repos'),
          value: privateUnlinked,
          color: '#818cf8',
          tailwindDot: 'bg-indigo-400',
        },
      ],
    };
  }, [L, effectiveDonutMode, taskCounts, deployStats, repos, linkedRepoKeys]);

  // Platform Readiness Checks -> Radial Gauge %
  const readinessChecks = [
    {
      id: 'github',
      label: 'GitHub OAuth',
      done: currentUser.githubConnected,
      cta: currentUser.githubConnected ? L('Terhubung', 'Connected') : L('Hubungkan', 'Connect'),
      onClick: currentUser.githubConnected
        ? undefined
        : () => {
            window.location.href = '/api/auth/github?intent=connect';
          },
    },
    {
      id: 'vercel',
      label: 'Vercel Vault',
      done: currentUser.vercelConnected,
      cta: currentUser.vercelConnected ? L('Tertaut', 'Linked') : L('Konfigurasi', 'Configure'),
      onClick: currentUser.vercelConnected ? undefined : () => onNavigateSection('vault'),
    },
    {
      id: 'repos',
      label: L('Repo Terhubung', 'Repos Linked'),
      done: linkedReposCount > 0,
      cta: `${linkedReposCount}/${Math.max(workspaces.length, 1)}`,
      onClick: linkedReposCount > 0 ? undefined : () => onNavigateSection('repos'),
    },
    {
      id: 'guard',
      label: L('Proteksi Branch', 'Branch Guard'),
      done: protectedCount > 0 || vercelLinkedProjects > 0,
      cta:
        protectedCount > 0
          ? L(`${protectedCount} terkunci`, `${protectedCount} locked`)
          : L('Atur', 'Setup'),
      onClick: workspaces.length > 0 ? () => onNavigateSection('projects') : onOpenNewWorkspaceModal,
    },
  ];
  const readinessDone = readinessChecks.filter((c) => c.done).length;
  const readinessScore = Math.round((readinessDone / readinessChecks.length) * 100);

  // Recent combined pulse feed (top 5 real events/deploys)
  const recentPulse = useMemo(() => {
    const items: Array<{
      id: string;
      kind: 'deployment' | 'webhook';
      workspaceId: string;
      workspaceName: string;
      title: string;
      subtitle: string;
      badge: string;
      tone: 'emerald' | 'amber' | 'rose' | 'indigo';
      createdAt: string;
    }> = [];

    for (const d of telemetry.deployments.slice(0, 6)) {
      const isSim = d.vercelDeploymentId?.startsWith('dpl_sim_') ?? false;
      items.push({
        id: `dep-${d.id}`,
        kind: 'deployment',
        workspaceId: d.workspaceId,
        workspaceName: d.workspaceName,
        title: d.commitMessage || `Deploy ${d.branch}`,
        subtitle: `Branch ${d.branch}${d.triggeredByUsername ? ` • @${d.triggeredByUsername}` : ''}`,
        badge: isSim ? `${d.status} (SIM)` : d.status,
        tone: d.status === 'ERROR' ? 'rose' : isSim ? 'amber' : 'emerald',
        createdAt: d.createdAt,
      });
    }

    for (const ev of telemetry.events.slice(0, 6)) {
      items.push({
        id: `ev-${ev.id}`,
        kind: 'webhook',
        workspaceId: ev.workspaceId,
        workspaceName: ev.workspaceName,
        title: ev.commitMessage || ev.eventType.replace(/_/g, ' '),
        subtitle: `@${ev.actorUsername}${ev.branch ? ` • ${ev.branch}` : ''}`,
        badge: ev.blocked
          ? L('DIBLOKIR', 'BLOCKED')
          : ev.matchedTaskCode
            ? `#${ev.matchedTaskCode}`
            : 'SYNC',
        tone: ev.blocked ? 'rose' : 'indigo',
        createdAt: ev.createdAt,
      });
    }

    return items
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }, [L, telemetry.deployments, telemetry.events]);

  // Quick Import repos (prioritize unlinked repos, support inline filter)
  const quickImportRepos = useMemo(() => {
    const q = quickRepoFilter.trim().toLowerCase();
    const sorted = [...repos].sort((a, b) => {
      const aLinked = linkedRepoKeys.has(a.fullName.toLowerCase()) ? 1 : 0;
      const bLinked = linkedRepoKeys.has(b.fullName.toLowerCase()) ? 1 : 0;
      return aLinked - bLinked;
    });
    const filtered = q
      ? sorted.filter((r) => r.fullName.toLowerCase().includes(q))
      : sorted;
    return filtered.slice(0, 5);
  }, [repos, linkedRepoKeys, quickRepoFilter]);

  const deploymentBars = [
    {
      id: 'live',
      label: L('Live Vercel Siap', 'Live Vercel Ready'),
      count: deployStats.liveReady,
      colorClass: 'bg-emerald-400',
      textClass: 'text-emerald-300',
    },
    {
      id: 'sim',
      label: L('Simulasi Siap', 'Simulated Ready'),
      count: deployStats.simulated,
      colorClass: 'bg-amber-400',
      textClass: 'text-amber-300',
    },
    {
      id: 'active',
      label: L('Build / Antrean', 'Building / Queued'),
      count: deployStats.active,
      colorClass: 'bg-cyan-400',
      textClass: 'text-cyan-300',
    },
    {
      id: 'failed',
      label: L('Gagal / Error', 'Failed / Error'),
      count: deployStats.failed,
      colorClass: 'bg-rose-400',
      textClass: 'text-rose-300',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Compact Executive Dashboard Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/12 border border-emerald-500/25 text-emerald-300">
              <GitHubIcon className="w-3 h-3" />
              <span>
                {currentUser.githubConnected
                  ? `@${currentUser.username}`
                  : L('GitHub Terputus', 'GitHub Disconnected')}
              </span>
            </span>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border ${
                currentUser.vercelConnected
                  ? 'bg-cyan-500/12 border-cyan-500/25 text-cyan-300'
                  : 'bg-white/[0.04] border-white/10 text-zinc-400'
              }`}
            >
              <VercelIcon className="w-3 h-3" />
              <span>
                {currentUser.vercelConnected
                  ? L('Vercel Terhubung', 'Vercel Linked')
                  : L('Vercel Belum Terhubung', 'Vercel Unlinked')}
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/12 border border-indigo-500/25 text-indigo-300 uppercase">
              <span>{capabilities?.mode || 'local'}</span>
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            {L('Ringkasan Engineering', 'Engineering Overview')}
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400">
            {locale === 'id' ? (
              <>
                Telemetri real-time di{' '}
                <strong className="text-zinc-200">{workspaces.length} proyek</strong>,{' '}
                <strong className="text-zinc-200">{repos.length} repository</strong>, dan{' '}
                <strong className="text-zinc-200">{deployStats.total} deployment</strong>.
              </>
            ) : (
              <>
                Real-time telemetry across{' '}
                <strong className="text-zinc-200">{workspaces.length} projects</strong>,{' '}
                <strong className="text-zinc-200">{repos.length} repositories</strong>, and{' '}
                <strong className="text-zinc-200">{deployStats.total} deployments</strong>.
              </>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            disabled={refreshing}
            onClick={() => void handleRefreshTelemetry()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-xs font-medium text-zinc-300 hover:text-white transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>
              {refreshing ? L('Menyinkronkan...', 'Syncing...') : L('Sinkronkan Metrik', 'Sync Metrics')}
            </span>
          </button>
          <button
            type="button"
            onClick={() => onNavigateSection('projects')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/12 text-xs font-semibold text-zinc-100 transition cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span>{L(`Proyek (${workspaces.length})`, `Projects (${workspaces.length})`)}</span>
          </button>
          <button
            type="button"
            onClick={onOpenNewWorkspaceModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-semibold shadow-lg transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{L('Proyek Baru', 'New Project')}</span>
          </button>
        </div>
      </div>

      {/* Row 1–3: Telemetry KPI Sparklines + Charts (Shimmer Skeleton while loading) */}
      {!telemetry.loaded || refreshing ? (
        <OverviewTelemetrySkeleton />
      ) : (
        <>
      {/* Row 1: 4 Live Sparkline KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="cp-panel rounded-2xl p-5 flex items-end justify-between gap-2 overflow-hidden min-w-0">
          <div className="space-y-1.5 min-w-0">
            <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
              {L('Kecepatan Tugas', 'Task Velocity')}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-white font-mono tabular-nums">
                {telemetry.loaded ? totalTasks : '...'}
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/12 text-emerald-300 shrink-0">
                {completionRate}% {L('selesai', 'done')}
              </span>
            </div>
            <div className="text-[11px] text-zinc-400 truncate">
              {taskCounts.in_review} {L('dalam review', 'in review')} · {taskCounts.in_progress}{' '}
              {L('aktif', 'active')}
            </div>
          </div>
          <MiniSparkline values={sevenDayData.map((d) => d.tasks)} color="#34d399" />
        </div>

        <div className="cp-panel rounded-2xl p-5 flex items-end justify-between gap-2 overflow-hidden min-w-0">
          <div className="space-y-1.5 min-w-0">
            <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
              {L('Deployment', 'Deployments')}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-indigo-300 font-mono tabular-nums">
                {telemetry.loaded ? deployStats.total : '...'}
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-200 shrink-0">
                {deployStats.successRate}% ok
              </span>
            </div>
            <div className="text-[11px] text-zinc-400 truncate">
              {deployStats.liveReady} live · {deployStats.simulated} sim · {deployStats.failed} err
            </div>
          </div>
          <MiniSparkline values={sevenDayData.map((d) => d.deployments)} color="#818cf8" />
        </div>

        <div className="cp-panel rounded-2xl p-5 flex items-end justify-between gap-2 overflow-hidden min-w-0">
          <div className="space-y-1.5 min-w-0">
            <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
              {L('Event Gatekeeper', 'Gatekeeper Events')}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-cyan-300 font-mono tabular-nums">
                {telemetry.loaded ? telemetry.events.length : '...'}
              </span>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0 ${
                  blockedPushes > 0
                    ? 'bg-rose-500/15 text-rose-300'
                    : 'bg-cyan-500/12 text-cyan-300'
                }`}
              >
                {blockedPushes} {L('diblokir', 'blocked')}
              </span>
            </div>
            <div className="text-[11px] text-zinc-400 truncate">
              {avgLatencyMs > 0
                ? L(`Rata-rata sync ${avgLatencyMs} ms`, `Avg sync ${avgLatencyMs} ms`)
                : L(`${protectedCount} branch terproteksi`, `${protectedCount} branch protected`)}
            </div>
          </div>
          <MiniSparkline values={sevenDayData.map((d) => d.events)} color="#22d3ee" />
        </div>

        <div className="cp-panel rounded-2xl p-5 flex items-end justify-between gap-2 overflow-hidden min-w-0">
          <div className="space-y-1.5 min-w-0">
            <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
              {L('Cakupan GitHub', 'GitHub Coverage')}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-white font-mono tabular-nums">
                {reposLoading ? '...' : repos.length}
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/12 text-amber-300 shrink-0">
                {linkedReposCount} {L('terhubung', 'linked')}
              </span>
            </div>
            <div className="text-[11px] text-zinc-400 truncate">
              {L(
                `${vercelLinkedProjects}/${Math.max(workspaces.length, 1)} proyek siap Vercel`,
                `${vercelLinkedProjects}/${Math.max(workspaces.length, 1)} projects Vercel-ready`,
              )}
            </div>
          </div>
          <MiniSparkline
            values={[
              Math.max(repos.filter((r) => !r.private).length, 1),
              repos.filter((r) => r.private).length,
              linkedReposCount,
              workspaces.length,
              vercelLinkedProjects,
            ]}
            color="#fbbf24"
          />
        </div>
      </div>

      {/* Row 2: Hero Charts — 7-Day Multi-Series Pulse + Interactive Donut Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-8 cp-panel rounded-2xl p-6 flex flex-col justify-between space-y-4 overflow-hidden min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-cyan-400" />
                <span>
                  {L('Denyut Aktivitas Engineering 7 Hari', '7-Day Engineering Activity Pulse')}
                </span>
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                {L(
                  'Tugas harian yang diperbarui, sinyal sinkronisasi webhook, dan deployment di seluruh proyek.',
                  'Daily tasks updated, webhook sync signals, and deployments across all projects.',
                )}
              </p>
            </div>
            <span className="text-[10px] font-mono uppercase px-2 py-1 rounded-md bg-white/[0.04] border border-white/8 text-zinc-400">
              {L('7 Hari Terakhir', 'Last 7 Days')}
            </span>
          </div>

          <SevenDayPulseChart data={sevenDayData} />
        </div>

        <div className="lg:col-span-4 cp-panel rounded-2xl p-6 flex flex-col gap-4 overflow-hidden min-w-0">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <PieChart className="w-4 h-4 text-indigo-400" />
                <span>{L('Distribusi', 'Distribution')}</span>
              </h2>
              <div className="inline-flex items-center p-0.5 rounded-lg bg-zinc-950 border border-white/10 text-[10px] font-mono shrink-0">
                {(
                  [
                    { id: 'repos', label: L('Repo', 'Repos') },
                    { id: 'tasks', label: L('Tugas', 'Tasks') },
                    { id: 'deploys', label: L('Deploy', 'Deploys') },
                  ] as const
                ).map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setDonutMode(mode.id)}
                    className={`px-2 py-1 rounded-md transition cursor-pointer ${
                      effectiveDonutMode === mode.id
                        ? 'bg-indigo-500/25 text-indigo-200'
                        : 'text-zinc-500 hover:text-zinc-200'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-zinc-400">
              {L(
                'Arahkan kursor ke segmen mana saja untuk melihat persentase detail di portofolio workspace Anda.',
                'Hover any slice to inspect exact share across your workspace portfolio.',
              )}
            </p>
          </div>

          <div className="flex-1 flex flex-col justify-center">
            <InteractiveDonutChart
              segments={donutConfig.segments}
              centerLabel={donutConfig.centerLabel}
              emptyText={donutConfig.emptyText}
            />
          </div>
        </div>
      </div>

      {/* Row 3: Per-Project Delivery Bar Chart + Readiness Gauge & Deployment Health */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 cp-panel rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-400" />
                <span>
                  {L('Pengiriman Proyek & Kesehatan Pipeline', 'Project Delivery & Pipeline Health')}
                </span>
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                {L(
                  'Progres Kanban bertumpuk dan telemetri pipeline per workspace—klik batang untuk membuka.',
                  'Stacked Kanban completion and pipeline telemetry per workspace—click any bar to open.',
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateSection('projects')}
              className="text-xs font-medium text-indigo-300 hover:text-indigo-200 transition cursor-pointer shrink-0"
            >
              {L('Kelola Proyek →', 'Manage Projects →')}
            </button>
          </div>

          {workspaces.length === 0 ? (
            <div className="p-8 rounded-xl bg-zinc-950/80 border border-dashed border-white/10 text-center space-y-2.5">
              <div className="text-sm font-medium text-zinc-200">
                {L('Belum ada analitik proyek', 'No project analytics yet')}
              </div>
              <p className="text-xs text-zinc-400">
                {locale === 'id' ? (
                  <>
                    Gunakan <strong>Impor Cepat dari GitHub</strong> di bawah atau buat proyek untuk
                    mengisi grafik pengiriman.
                  </>
                ) : (
                  <>
                    Use <strong>Quick Import from GitHub</strong> below or create a project to
                    populate delivery charts.
                  </>
                )}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {(telemetry.byProject.length > 0
                ? telemetry.byProject
                : workspaces.map((ws) => ({
                    workspace: ws,
                    tasks: [] as Task[],
                    deployments: [] as Deployment[],
                    events: [] as WebhookEvent[],
                  }))
              ).map(({ workspace: ws, tasks: wsTasks, deployments: wsDeps, events: wsEvents }) => {
                const done = wsTasks.filter((t) => t.status === 'done').length;
                const review = wsTasks.filter((t) => t.status === 'in_review').length;
                const active = wsTasks.filter((t) => t.status === 'in_progress').length;
                const todo = wsTasks.filter((t) => t.status === 'todo').length;
                const total = wsTasks.length;
                const pctDone = total > 0 ? Math.round((done / total) * 100) : 0;
                const latest = wsDeps[0];
                const isLatestSim = latest?.vercelDeploymentId?.startsWith('dpl_sim_') ?? false;

                return (
                  <button
                    key={ws.id}
                    type="button"
                    onClick={() => void onEnterProject(ws.id, 'board')}
                    className="w-full text-left p-4 rounded-xl bg-zinc-950/85 hover:bg-zinc-950 border border-white/8 hover:border-indigo-500/40 transition space-y-2.5 cursor-pointer group"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-semibold text-white group-hover:text-indigo-200 transition truncate">
                          {ws.name}
                        </span>
                        {ws.branchProtected ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/12 border border-emerald-500/25 text-emerald-300 font-mono text-[10px]">
                            <Lock className="w-2.5 h-2.5" />
                            <span>{ws.defaultBranch}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/10 text-zinc-400 font-mono text-[10px]">
                            <Unlock className="w-2.5 h-2.5" />
                            <span>{L('terbuka', 'open')}</span>
                          </span>
                        )}
                        {ws.vercelProjectId && (
                          <span className="px-1.5 py-0.5 rounded bg-indigo-500/15 border border-indigo-500/25 text-indigo-300 font-mono text-[10px]">
                            Vercel
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-[11px] font-mono text-zinc-400 shrink-0">
                        <span>
                          <strong className="text-white">{total}</strong> {L('tugas', 'tasks')}
                        </span>
                        <span>
                          <strong className="text-indigo-300">{wsDeps.length}</strong>{' '}
                          {L('deploy', 'deploys')}
                        </span>
                        <span>
                          <strong className="text-cyan-300">{wsEvents.length}</strong>{' '}
                          {L('event', 'events')}
                        </span>
                        <span className="text-emerald-300 font-semibold w-9 text-right">
                          {pctDone}%
                        </span>
                      </div>
                    </div>

                    {/* Stacked Progress Bar */}
                    <div className="h-2.5 w-full rounded-full bg-zinc-900 border border-white/[0.06] overflow-hidden flex">
                      {total > 0 ? (
                        <>
                          {done > 0 && (
                            <div
                              style={{ width: `${(done / total) * 100}%` }}
                              className="h-full bg-emerald-400 transition-all"
                              title={L(`Selesai: ${done}`, `Done: ${done}`)}
                            />
                          )}
                          {review > 0 && (
                            <div
                              style={{ width: `${(review / total) * 100}%` }}
                              className="h-full bg-violet-400 transition-all"
                              title={L(`Dalam Review: ${review}`, `In Review: ${review}`)}
                            />
                          )}
                          {active > 0 && (
                            <div
                              style={{ width: `${(active / total) * 100}%` }}
                              className="h-full bg-cyan-400 transition-all"
                              title={L(`Sedang Dikerjakan: ${active}`, `In Progress: ${active}`)}
                            />
                          )}
                          {todo > 0 && (
                            <div
                              style={{ width: `${(todo / total) * 100}%` }}
                              className="h-full bg-slate-600 transition-all"
                              title={`To Do: ${todo}`}
                            />
                          )}
                        </>
                      ) : (
                        <div className="h-full w-full bg-white/[0.03]" />
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-zinc-500">
                      <span className="truncate">
                        {ws.githubOwner && ws.githubRepo
                          ? `${ws.githubOwner}/${ws.githubRepo}`
                          : L('Belum ada repo GitHub terhubung', 'No GitHub repo linked')}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        {latest ? (
                          <span
                            className={
                              latest.status === 'ERROR'
                                ? 'text-rose-300'
                                : isLatestSim
                                  ? 'text-amber-300'
                                  : 'text-emerald-300'
                            }
                          >
                            {L('Deploy terakhir', 'Last deploy')}: {latest.status}
                            {isLatestSim ? ' (SIM)' : ''}
                          </span>
                        ) : (
                          <span>{L('Belum ada deploy', 'No deploys yet')}</span>
                        )}
                        <ArrowRight className="w-3 h-3 text-zinc-500 group-hover:text-white transition" />
                      </span>
                    </div>
                  </button>
                );
              })}

              {/* Legend */}
              <div className="flex flex-wrap items-center gap-4 pt-1 text-[11px] text-zinc-400">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400" /> {L('Selesai', 'Done')}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-violet-400" />{' '}
                  {L('Dalam Review', 'In Review')}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-cyan-400" />{' '}
                  {L('Sedang Dikerjakan', 'In Progress')}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-slate-600" /> To Do
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right: Radial Readiness Gauge + Deployment Outcomes Horizontal Bar Chart */}
        <div className="lg:col-span-5 cp-panel rounded-2xl p-6 flex flex-col justify-between space-y-5 overflow-hidden min-w-0">
          {/* Top: Radial Readiness Gauge */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="truncate">{L('Kesiapan Pipeline', 'Pipeline Readiness')}</span>
              </h2>
              <span className="text-[11px] font-mono text-zinc-400 shrink-0">
                {L(
                  `${readinessDone}/${readinessChecks.length} cek`,
                  `${readinessDone}/${readinessChecks.length} checks`,
                )}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-zinc-950/90 border border-white/8 flex flex-col sm:flex-row lg:flex-col xl:flex-row items-center gap-4 overflow-hidden">
              <RadialScoreGauge
                score={readinessScore}
                label={L('Kesiapan', 'Readiness')}
                sublabel={`${readinessDone}/${readinessChecks.length} ok`}
              />

              <div className="flex-1 w-full min-w-0 space-y-1.5">
                {readinessChecks.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-2 text-xs py-0.5 min-w-0"
                  >
                    <span className="inline-flex items-center gap-2 text-zinc-300 min-w-0">
                      {item.done ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <Circle className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                      )}
                      <span className="truncate">{item.label}</span>
                    </span>
                    {item.onClick ? (
                      <button
                        type="button"
                        onClick={item.onClick}
                        className="font-mono text-[10px] text-indigo-300 hover:text-indigo-200 underline underline-offset-2 cursor-pointer shrink-0"
                      >
                        {item.cta}
                      </button>
                    ) : (
                      <span className="font-mono text-[10px] text-emerald-300 shrink-0">
                        {item.cta}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom: Deployment Outcomes Horizontal Bar Chart */}
          <div className="pt-4 border-t border-white/8 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-zinc-200">
                {L('Hasil Deployment', 'Deployment Outcomes')}
              </span>
              <span className="font-mono text-[11px] text-zinc-500">
                {L(`${deployStats.total} total eksekusi`, `${deployStats.total} total runs`)}
              </span>
            </div>

            <div className="space-y-2.5">
              {deploymentBars.map((bar) => {
                const pct =
                  deployStats.total > 0
                    ? Math.round((bar.count / deployStats.total) * 100)
                    : 0;
                return (
                  <div key={bar.id} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-zinc-400">{bar.label}</span>
                      <span className={`font-mono ${bar.textClass}`}>
                        {bar.count} <span className="text-zinc-600">({pct}%)</span>
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-zinc-950 border border-white/[0.06] overflow-hidden">
                      <div
                        style={{ width: `${pct}%` }}
                        className={`h-full rounded-full ${bar.colorClass} transition-all duration-500`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
        </>
      )}

      {/* Row 4: Quick Import from GitHub (Preserved!) + Compact Live Telemetry Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 cp-panel rounded-2xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <GitHubIcon className="w-4 h-4 text-zinc-200" />
                <span>{L('Impor Cepat dari GitHub', 'Quick Import from GitHub')}</span>
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                {L(
                  'Inisialisasi workspace proyek baru langsung dari repository Anda.',
                  'Initialize a new project workspace straight from your repositories.',
                )}
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={quickRepoFilter}
                  onChange={(e) => setQuickRepoFilter(e.target.value)}
                  placeholder={L('Filter repo...', 'Filter repo...')}
                  className="pl-7 pr-2.5 py-1.5 rounded-lg bg-zinc-950 border border-white/10 text-[11px] text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 w-36 sm:w-44"
                />
              </div>
              <button
                type="button"
                onClick={() => onNavigateSection('repos')}
                className="text-xs font-medium text-indigo-300 hover:text-indigo-200 transition cursor-pointer shrink-0"
              >
                {L(`Lihat semua (${repos.length}) →`, `View all (${repos.length}) →`)}
              </button>
            </div>
          </div>

          {reposLoading ? (
            <RepoListSkeleton count={4} />
          ) : quickImportRepos.length === 0 ? (
            <div className="p-4 rounded-xl bg-zinc-950/80 border border-white/8 text-center text-xs text-zinc-400">
              {repos.length === 0
                ? L(
                    'Belum ada repository GitHub dimuat. Periksa koneksi Anda di Repo GitHub.',
                    'No GitHub repositories loaded yet. Check your connection in GitHub Repos.',
                  )
                : L('Tidak ada repository yang cocok dengan filter.', 'No repositories match that filter.')}
            </div>
          ) : (
            <div className="space-y-2.5">
              {quickImportRepos.map((repo) => {
                const alreadyLinked = linkedRepoKeys.has(repo.fullName.toLowerCase());
                return (
                  <div
                    key={repo.id}
                    className="p-3 rounded-xl bg-zinc-950/90 border border-white/8 hover:border-white/15 transition flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-white truncate font-mono">
                          {repo.fullName}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.05] text-zinc-400">
                          {repo.private ? L('privat', 'private') : L('publik', 'public')}
                        </span>
                        {alreadyLinked && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/12 border border-emerald-500/25 text-emerald-300">
                            {L('terhubung', 'linked')}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-mono text-zinc-500 mt-0.5">
                        Branch: {repo.defaultBranch}
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={importingRepoId === repo.id}
                      onClick={() => void onImportRepo(repo)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/90 hover:bg-indigo-500 text-white text-[11px] font-semibold shrink-0 transition cursor-pointer disabled:opacity-50"
                    >
                      <span>
                        {importingRepoId === repo.id
                          ? L('Menyiapkan...', 'Setting up...')
                          : L('Setup Proyek', 'Setup Project')}
                      </span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Recent Pipeline Signals Feed */}
        <div className="lg:col-span-5 cp-panel rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                <span>{L('Denyut Pipeline Terbaru', 'Recent Pipeline Pulse')}</span>
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                {L(
                  'Deployment dan sinyal webhook terbaru di seluruh workspace.',
                  'Latest deployments and webhook signals across workspaces.',
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateSection('activity')}
              className="text-xs font-medium text-indigo-300 hover:text-indigo-200 transition cursor-pointer shrink-0"
            >
              {L('Log Lengkap →', 'Full Logs →')}
            </button>
          </div>

          {recentPulse.length === 0 ? (
            <div className="p-6 rounded-xl bg-zinc-950/80 border border-dashed border-white/10 text-center text-xs text-zinc-500">
              {L(
                'Belum ada deployment atau sinyal webhook. Jalankan deploy atau push commit bertag untuk melihat telemetri langsung di sini.',
                'No deployments or webhook signals yet. Trigger a deploy or push a tagged commit to see live telemetry here.',
              )}
            </div>
          ) : (
            <div className="space-y-2.5">
              {recentPulse.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() =>
                    void onEnterProject(
                      item.workspaceId,
                      item.kind === 'deployment' ? 'deployments' : 'gatekeeper',
                    )
                  }
                  className="w-full text-left p-3 rounded-xl bg-zinc-950/90 hover:bg-zinc-950 border border-white/8 hover:border-indigo-500/35 transition flex items-start justify-between gap-3 cursor-pointer"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-500">
                      <span className="text-zinc-300 font-semibold">{item.workspaceName}</span>
                      <span>•</span>
                      <span>
                        {new Date(item.createdAt).toLocaleTimeString(
                          locale === 'id' ? 'id-ID' : 'en-US',
                        )}
                      </span>
                    </div>
                    <div className="text-xs font-medium text-zinc-100 truncate">{item.title}</div>
                    <div className="text-[11px] font-mono text-zinc-500 truncate">
                      {item.subtitle}
                    </div>
                  </div>
                  <span
                    className={`font-mono text-[10px] px-2 py-0.5 rounded border shrink-0 ${
                      item.tone === 'rose'
                        ? 'bg-rose-500/12 border-rose-500/25 text-rose-300'
                        : item.tone === 'amber'
                          ? 'bg-amber-500/12 border-amber-500/25 text-amber-300'
                          : item.tone === 'emerald'
                            ? 'bg-emerald-500/12 border-emerald-500/25 text-emerald-300'
                            : 'bg-indigo-500/12 border-indigo-500/25 text-indigo-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProjectsDirectorySection({
  currentUser,
  workspaces,
  onEnterProject,
  onOpenNewWorkspaceModal,
  onWorkspaceUpdated,
  onWorkspaceDeleted,
  onToast,
}: {
  currentUser: PublicUser;
  workspaces: Workspace[];
  onEnterProject: (workspaceId: string, tab?: PaletteTab) => Promise<void>;
  onOpenNewWorkspaceModal: () => void;
  onWorkspaceUpdated: (ws: Workspace) => void;
  onWorkspaceDeleted: (workspaceId: string) => void;
  onToast: (type: 'success' | 'error' | 'info', message: string) => void;
}) {
  const { L, locale } = useLanguage();
  const [query, setQuery] = useState('');
  const [editingWs, setEditingWs] = useState<Workspace | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const [deletingWs, setDeletingWs] = useState<Workspace | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [leavingWs, setLeavingWs] = useState<Workspace | null>(null);
  const [leaving, setLeaving] = useState(false);

  const filtered = workspaces.filter((ws) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      ws.name.toLowerCase().includes(q) ||
      (ws.githubRepo || '').toLowerCase().includes(q) ||
      (ws.githubOwner || '').toLowerCase().includes(q)
    );
  });

  function openEditModal(ws: Workspace) {
    setEditingWs(ws);
    setEditName(ws.name);
    setEditDesc(ws.description || '');
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingWs || editName.trim().length < 2) return;
    setSavingEdit(true);
    try {
      const { workspace: updated } = await api.updateWorkspace(editingWs.id, {
        name: editName.trim(),
        description: editDesc.trim(),
      });
      onWorkspaceUpdated(updated);
      setEditingWs(null);
      onToast(
        'success',
        L(`Proyek "${updated.name}" diperbarui.`, `Project "${updated.name}" updated.`),
      );
    } catch (err) {
      onToast(
        'error',
        err instanceof Error
          ? err.message
          : L('Gagal memperbarui proyek', 'Failed to update project'),
      );
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deletingWs) return;
    setDeleting(true);
    try {
      await api.deleteWorkspace(deletingWs.id);
      const removedName = deletingWs.name;
      const removedId = deletingWs.id;
      setDeletingWs(null);
      onWorkspaceDeleted(removedId);
      onToast(
        'info',
        L(
          `Proyek "${removedName}" dihapus dari CodePulse.`,
          `Project "${removedName}" deleted from CodePulse.`,
        ),
      );
    } catch (err) {
      onToast(
        'error',
        err instanceof Error
          ? err.message
          : L('Gagal menghapus proyek', 'Failed to delete project'),
      );
    } finally {
      setDeleting(false);
    }
  }

  async function handleConfirmLeave() {
    if (!leavingWs) return;
    setLeaving(true);
    try {
      await api.leaveWorkspace(leavingWs.id);
      const leftName = leavingWs.name;
      const leftId = leavingWs.id;
      setLeavingWs(null);
      onWorkspaceDeleted(leftId);
      onToast(
        'info',
        L(
          `Anda telah keluar dari proyek "${leftName}".`,
          `You have left project "${leftName}".`,
        ),
      );
    } catch (err) {
      onToast(
        'error',
        err instanceof Error
          ? err.message
          : L('Gagal keluar dari proyek', 'Failed to leave project'),
      );
    } finally {
      setLeaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {L('Workspace Proyek', 'Project Workspaces')}
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            {L(
              'Semua hub proyek yang Anda ikuti, lengkap dengan status repository dan peran Anda di setiap proyek.',
              'All project hubs you belong to, along with repository status and your per-project role.',
            )}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={L('Filter proyek...', 'Filter projects...')}
              className="pl-8 pr-3 py-2 rounded-xl bg-zinc-950 border border-white/10 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 w-52"
            />
          </div>
          <button
            type="button"
            onClick={onOpenNewWorkspaceModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-semibold transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{L('Proyek Baru', 'New Project')}</span>
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="cp-panel rounded-2xl p-12 text-center space-y-3">
          <Layers className="w-7 h-7 text-zinc-500 mx-auto" />
          <div className="text-sm font-medium text-white">
            {L('Tidak ada proyek yang cocok', 'No matching projects')}
          </div>
          <p className="text-xs text-zinc-400">
            {L(
              'Buat workspace proyek baru atau ubah kata kunci pencarian Anda.',
              'Create a project workspace or adjust your search query.',
            )}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((ws) => {
            const projectRole = getWorkspaceMemberRole(ws, currentUser);
            const isLead = projectRole === 'leader';
            const isOwner = ws.ownerId === currentUser.id;
            return (
              <div
                key={ws.id}
                className="cp-panel rounded-2xl p-5 flex flex-col justify-between gap-4 hover:border-indigo-500/35 transition"
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-base font-semibold text-white truncate">{ws.name}</h2>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border ${
                          isLead
                            ? 'bg-indigo-500/12 border-indigo-500/25 text-indigo-300'
                            : 'bg-cyan-500/12 border-cyan-500/25 text-cyan-300'
                        }`}
                      >
                        {isLead ? 'Project Lead' : L('Kontributor', 'Contributor')}
                      </span>
                      {isLead && (
                        <>
                          <button
                            type="button"
                            onClick={() => openEditModal(ws)}
                            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-400 hover:text-white transition cursor-pointer"
                            title={L(`Edit ${ws.name}`, `Edit ${ws.name}`)}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingWs(ws)}
                            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-rose-500/15 border border-white/10 hover:border-rose-500/30 text-zinc-400 hover:text-rose-300 transition cursor-pointer"
                            title={L(`Hapus ${ws.name}`, `Delete ${ws.name}`)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                      {!isOwner && (
                        <button
                          type="button"
                          onClick={() => setLeavingWs(ws)}
                          className="p-1.5 rounded-lg bg-zinc-900 hover:bg-amber-500/15 border border-white/10 hover:border-amber-500/35 text-zinc-400 hover:text-amber-300 transition cursor-pointer"
                          title={L(`Keluar dari ${ws.name}`, `Leave ${ws.name}`)}
                        >
                          <LogOut className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  {ws.description && (
                    <p className="text-xs text-zinc-400 line-clamp-2">{ws.description}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-zinc-400 pt-1">
                    {ws.githubOwner && ws.githubRepo ? (
                      <span className="inline-flex items-center gap-1 text-cyan-300">
                        <GitBranch className="w-3 h-3" />
                        {ws.githubOwner}/{ws.githubRepo}
                      </span>
                    ) : (
                      <span>{L('Belum ada repo terhubung', 'No repo connected')}</span>
                    )}
                    <span>&bull;</span>
                    <span>
                      {ws.branchProtected
                        ? L(`${ws.defaultBranch} terkunci`, `${ws.defaultBranch} locked`)
                        : L('tidak terproteksi', 'unprotected')}
                    </span>
                    <span>&bull;</span>
                    <span>
                      {L(`${ws.members.length} anggota`, `${ws.members.length} member(s)`)}
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-white/8 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => void onEnterProject(ws.id, 'gatekeeper')}
                      className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-[11px] text-zinc-300 cursor-pointer"
                    >
                      Gatekeeper
                    </button>
                    <button
                      type="button"
                      onClick={() => void onEnterProject(ws.id, 'deployments')}
                      className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-[11px] text-zinc-300 cursor-pointer"
                    >
                      {L('Deployment', 'Deployments')}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => void onEnterProject(ws.id, 'board')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-semibold cursor-pointer"
                  >
                    <span>{L('Buka Papan', 'Open Board')}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Project Modal */}
      {editingWs && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveEdit}
            className="w-full max-w-md rounded-2xl bg-[#10121a] border border-white/12 p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Pencil className="w-4 h-4 text-indigo-400" />
                <span>{L('Edit Workspace Proyek', 'Edit Project Workspace')}</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingWs(null)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">
                {L('Nama Proyek', 'Project Name')}
              </label>
              <input
                type="text"
                required
                minLength={2}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-white/10 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">
                {L('Deskripsi', 'Description')}
              </label>
              <textarea
                rows={3}
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                placeholder={L(
                  'Ringkasan singkat workspace proyek ini...',
                  'Brief summary of this project workspace...',
                )}
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-white/10 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingWs(null)}
                className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-xs text-zinc-300 cursor-pointer"
              >
                {L('Batal', 'Cancel')}
              </button>
              <button
                type="submit"
                disabled={savingEdit || editName.trim().length < 2}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer disabled:opacity-45"
              >
                {savingEdit ? L('Menyimpan...', 'Saving...') : L('Simpan Perubahan', 'Save Changes')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Project Confirmation Modal */}
      {deletingWs && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#10121a] border border-rose-500/30 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-rose-300 flex items-center gap-2">
                <Trash2 className="w-4 h-4" />
                <span>{L('Hapus Workspace Proyek', 'Delete Project Workspace')}</span>
              </h3>
              <button
                type="button"
                onClick={() => setDeletingWs(null)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              {locale === 'id' ? (
                <>
                  Apakah Anda yakin ingin menghapus{' '}
                  <strong className="text-white">{deletingWs.name}</strong>? Semua tugas Kanban,
                  log Gatekeeper, riwayat deployment, dan undangan untuk workspace ini di dalam
                  CodePulse akan dihapus secara permanen.
                </>
              ) : (
                <>
                  Are you sure you want to delete{' '}
                  <strong className="text-white">{deletingWs.name}</strong>? All Kanban tasks,
                  Gatekeeper logs, deployment history, and invitations for this workspace inside
                  CodePulse will be permanently removed.
                </>
              )}
            </p>
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              {locale === 'id' ? (
                <>
                  Repository GitHub asli dan proyek cloud Vercel Anda <strong>tidak</strong> akan
                  dihapus.
                </>
              ) : (
                <>
                  Your actual GitHub repository and Vercel cloud project will <strong>not</strong>{' '}
                  be deleted.
                </>
              )}
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingWs(null)}
                className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-xs text-zinc-300 cursor-pointer"
              >
                {L('Batal', 'Cancel')}
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => void handleConfirmDelete()}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold cursor-pointer disabled:opacity-45"
              >
                {deleting ? L('Menghapus...', 'Deleting...') : L('Hapus Proyek', 'Delete Project')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leave Project Confirmation Modal */}
      {leavingWs && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#10121a] border border-amber-500/30 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-amber-300 flex items-center gap-2">
                <LogOut className="w-4 h-4" />
                <span>{L('Keluar dari Proyek', 'Leave Project')}</span>
              </h3>
              <button
                type="button"
                onClick={() => setLeavingWs(null)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              {locale === 'id' ? (
                <>
                  Apakah Anda yakin ingin keluar dari{' '}
                  <strong className="text-white">{leavingWs.name}</strong>? Anda tidak lagi dapat
                  mengakses Papan Kanban, Gatekeeper, atau Deployment proyek ini sampai diundang
                  kembali oleh Project Lead.
                </>
              ) : (
                <>
                  Are you sure you want to leave{' '}
                  <strong className="text-white">{leavingWs.name}</strong>? You will lose access to
                  its Kanban board, Gatekeeper, and Deployments until re-invited by a Project Lead.
                </>
              )}
            </p>
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              {L(
                'Proyek, riwayat tugas, dan anggota lain tetap aman tidak terpengaruh.',
                'The project, task history, and other team members will remain unaffected.',
              )}
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setLeavingWs(null)}
                className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-xs text-zinc-300 cursor-pointer"
              >
                {L('Batal', 'Cancel')}
              </button>
              <button
                type="button"
                disabled={leaving}
                onClick={() => void handleConfirmLeave()}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold cursor-pointer disabled:opacity-45"
              >
                {leaving ? L('Keluar...', 'Leaving...') : L('Ya, Keluar Proyek', 'Yes, Leave Project')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RepositoriesSection({
  currentUser,
  capabilities,
  repos,
  reposLoading,
  reposError,
  importingRepoId,
  onRefreshRepos,
  onImportRepo,
}: {
  currentUser: PublicUser;
  capabilities: SystemCapabilities | null;
  repos: GitHubRepoItem[];
  reposLoading: boolean;
  reposError: string | null;
  importingRepoId: number | null;
  onRefreshRepos: () => Promise<void>;
  onImportRepo: (repo: GitHubRepoItem) => Promise<void>;
}) {
  const { L } = useLanguage();
  const [search, setSearch] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'public' | 'private'>('all');

  const filtered = repos.filter((r) => {
    if (visibilityFilter === 'public' && r.private) return false;
    if (visibilityFilter === 'private' && !r.private) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return r.fullName.toLowerCase().includes(q) || r.defaultBranch.toLowerCase().includes(q);
  });

  const visibilityOptions: Array<{ id: 'all' | 'public' | 'private'; label: string }> = [
    { id: 'all', label: L('Semua', 'All') },
    { id: 'public', label: L('Publik', 'Public') },
    { id: 'private', label: L('Privat', 'Private') },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {L('Repository GitHub', 'GitHub Repositories')}
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            {L(
              'Jelajahi repository GitHub yang terhubung dan inisialisasi proyek CodePulse dengan proteksi branch.',
              'Browse your connected GitHub repositories and initialize a CodePulse project with branch protection.',
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl bg-zinc-950 border border-white/10 p-0.5 text-[11px]">
            {visibilityOptions.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setVisibilityFilter(v.id)}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  visibilityFilter === v.id ? 'bg-zinc-800 text-white font-medium' : 'text-zinc-400'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={L('Cari repository...', 'Search repositories...')}
              className="pl-8 pr-3 py-1.5 rounded-xl bg-zinc-950 border border-white/10 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 w-48"
            />
          </div>

          <button
            type="button"
            onClick={() => void onRefreshRepos()}
            disabled={reposLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-xs text-zinc-200 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{reposLoading ? L('Menyinkronkan...', 'Syncing...') : L('Segarkan', 'Refresh')}</span>
          </button>
        </div>
      </div>

      {!currentUser.githubConnected ? (
        <div className="cp-panel rounded-2xl p-10 text-center space-y-3">
          <GitHubIcon className="w-7 h-7 text-zinc-400 mx-auto" />
          <div className="text-sm font-semibold text-white">
            {L('GitHub Belum Terhubung', 'GitHub Not Connected')}
          </div>
          <p className="text-xs text-zinc-400 max-w-md mx-auto">
            {L(
              'Hubungkan akun GitHub Anda via OAuth untuk melihat repository secara langsung dan mengonfigurasi alur kerja Gatekeeper otomatis.',
              'Connect your GitHub account via OAuth to browse live repositories and configure automated Gatekeeper workflows.',
            )}
          </p>
          {capabilities?.githubOAuthConfigured && (
            <a
              href="/api/auth/github?intent=connect"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-zinc-950 text-xs font-semibold"
            >
              <GitHubIcon className="w-3.5 h-3.5" />
              <span>{L('Hubungkan Akun GitHub', 'Connect GitHub Account')}</span>
            </a>
          )}
        </div>
      ) : reposLoading ? (
        <RepoGridSkeleton count={6} />
      ) : reposError ? (
        <div className="cp-panel rounded-2xl p-6 text-xs text-rose-300 flex items-center justify-between">
          <span>{reposError}</span>
          <button
            type="button"
            onClick={() => void onRefreshRepos()}
            className="px-3 py-1.5 rounded-lg bg-white/10 text-white cursor-pointer"
          >
            {L('Coba Lagi', 'Retry')}
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="cp-panel rounded-2xl p-12 text-center text-xs text-zinc-400">
          {L('Tidak ada repository yang cocok ditemukan.', 'No matching repositories found.')}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((repo) => (
            <div
              key={repo.id}
              className="cp-panel rounded-2xl p-5 flex flex-col justify-between gap-4 hover:border-indigo-500/35 transition"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-semibold text-white font-mono break-all">
                    {repo.name}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.06] border border-white/10 text-zinc-400 shrink-0">
                    {repo.private ? L('Privat', 'Private') : L('Publik', 'Public')}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-zinc-400 truncate">{repo.fullName}</div>
                <div className="inline-flex items-center gap-1.5 text-[11px] font-mono text-cyan-300">
                  <GitBranch className="w-3 h-3" />
                  <span>{repo.defaultBranch}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-white/8 flex items-center justify-between gap-2">
                <a
                  href={repo.htmlUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white transition"
                >
                  <span>GitHub</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                <button
                  type="button"
                  disabled={importingRepoId === repo.id}
                  onClick={() => void onImportRepo(repo)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold transition cursor-pointer disabled:opacity-50"
                >
                  <span>
                    {importingRepoId === repo.id
                      ? L('Membuat...', 'Creating...')
                      : L('Setup Proyek', 'Setup Project')}
                  </span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface AggregatedActivityItem {
  id: string;
  kind: 'webhook' | 'deployment';
  workspaceId: string;
  workspaceName: string;
  branch: string | null;
  eventType?: string;
  blocked?: boolean;
  statusTransition?: string | null;
  deployStatus?: string;
  subtitle: string;
  tone: 'emerald' | 'rose' | 'indigo' | 'cyan';
  createdAt: string;
}

function ActivityLogsSection({
  workspaces,
  onEnterProject,
  onOpenNewWorkspaceModal,
}: {
  workspaces: Workspace[];
  onEnterProject: (workspaceId: string, tab?: PaletteTab) => Promise<void>;
  onOpenNewWorkspaceModal: () => void;
}) {
  const { L } = useLanguage();
  const [items, setItems] = useState<AggregatedActivityItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadAllActivity() {
      if (workspaces.length === 0) {
        setItems([]);
        return;
      }
      setLoading(true);
      try {
        const results = await Promise.all(
          workspaces.map(async (ws) => {
            const [evRes, depRes] = await Promise.all([
              api.listWebhookEvents(ws.id).catch(() => ({ events: [] as WebhookEvent[] })),
              api.listDeployments(ws.id).catch(() => ({ deployments: [] as Deployment[] })),
            ]);

            const eventItems: AggregatedActivityItem[] = evRes.events.map((ev) => ({
              id: `ev-${ev.id}`,
              kind: 'webhook',
              workspaceId: ws.id,
              workspaceName: ws.name,
              branch: ev.branch,
              eventType: ev.eventType,
              blocked: ev.blocked,
              statusTransition: ev.statusTransition,
              subtitle: `${ev.actorUsername} • ${ev.commitMessage}${ev.matchedTaskCode ? ` (#${ev.matchedTaskCode})` : ''}`,
              tone: ev.blocked ? 'rose' : ev.eventType === 'gatekeeper_merge' ? 'emerald' : 'indigo',
              createdAt: ev.createdAt,
            }));

            const depItems: AggregatedActivityItem[] = depRes.deployments.map((dep) => ({
              id: `dep-${dep.id}`,
              kind: 'deployment',
              workspaceId: ws.id,
              workspaceName: ws.name,
              branch: dep.branch,
              deployStatus: dep.status,
              subtitle: `${dep.triggeredByUsername} • ${dep.commitMessage}`,
              tone: dep.status === 'READY' ? 'emerald' : dep.status === 'ERROR' ? 'rose' : 'cyan',
              createdAt: dep.createdAt,
            }));

            return [...eventItems, ...depItems];
          }),
        );

        if (!cancelled) {
          const merged = results
            .flat()
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setItems(merged);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadAllActivity();
    return () => {
      cancelled = true;
    };
  }, [workspaces]);

  function formatActivityTitle(item: AggregatedActivityItem): string {
    if (item.kind === 'deployment') {
      return L(`Deployment Vercel (${item.branch})`, `Vercel deployment (${item.branch})`);
    }
    if (item.blocked) {
      return L(`Direct push diblokir di ${item.branch}`, `Direct push blocked on ${item.branch}`);
    }
    if (item.eventType === 'gatekeeper_merge') {
      return L(`Merge Gatekeeper di ${item.branch}`, `Gatekeeper merge on ${item.branch}`);
    }
    return L(
      `${item.eventType} tersinkronisasi di ${item.branch}`,
      `${item.eventType} synced on ${item.branch}`,
    );
  }

  function formatActivityBadge(item: AggregatedActivityItem): string {
    if (item.kind === 'deployment') return item.deployStatus || '';
    if (item.blocked) return L('DIBLOKIR 403', 'BLOCKED 403');
    return item.statusTransition || item.eventType || '';
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">
          {L('Aktivitas & Log Audit', 'Activity & Audit Logs')}
        </h1>
        <p className="text-xs sm:text-sm text-zinc-400 mt-1">
          {L(
            'Catatan real-time terpadu untuk webhook GitHub, merge Gatekeeper, direct push yang diblokir, dan deployment Vercel di seluruh proyek Anda.',
            'Unified real-time ledger of GitHub webhooks, Gatekeeper merges, blocked direct pushes, and Vercel deployments across all your projects.',
          )}
        </p>
      </div>

      {workspaces.length === 0 ? (
        <div className="cp-panel rounded-2xl p-10 text-center space-y-3">
          <Activity className="w-7 h-7 text-zinc-500 mx-auto" />
          <div className="text-sm font-semibold text-white">
            {L('Belum ada aktivitas workspace', 'No workspace activity yet')}
          </div>
          <p className="text-xs text-zinc-400">
            {L(
              'Buat atau impor proyek terlebih dahulu untuk melacak commit, merge, dan deployment di sini.',
              'Create or import a project first to track commits, merges, and deployments here.',
            )}
          </p>
          <button
            type="button"
            onClick={onOpenNewWorkspaceModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{L('Proyek Baru', 'New Project')}</span>
          </button>
        </div>
      ) : loading ? (
        <ActivityFeedSkeleton count={6} />
      ) : items.length === 0 ? (
        <div className="cp-panel rounded-2xl p-10 text-center space-y-2">
          <Activity className="w-7 h-7 text-zinc-500 mx-auto" />
          <div className="text-sm font-semibold text-white">
            {L('Log Audit Bersih', 'Clean Audit Log')}
          </div>
          <p className="text-xs text-zinc-400 max-w-md mx-auto">
            {L(
              `Belum ada commit webhook, review Gatekeeper, atau deployment Vercel yang tercatat di dalam ${workspaces.length} proyek aktif Anda.`,
              `No webhook commits, Gatekeeper reviews, or Vercel deployments recorded yet inside your ${workspaces.length} active project(s).`,
            )}
          </p>
        </div>
      ) : (
        <div className="cp-panel rounded-2xl divide-y divide-white/[0.06]">
          {items.map((item) => (
            <div
              key={item.id}
              className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-white/[0.02] transition"
            >
              <div className="flex items-start gap-3 min-w-0">
                <span className="p-2 rounded-xl bg-zinc-950 border border-white/10 shrink-0 mt-0.5">
                  {item.tone === 'rose' ? (
                    <Ban className="w-4 h-4 text-rose-400" />
                  ) : item.kind === 'deployment' ? (
                    <Rocket className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <GitMerge className="w-4 h-4 text-indigo-400" />
                  )}
                </span>
                <div className="min-w-0 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-white">
                      {formatActivityTitle(item)}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.05] text-zinc-300">
                      {item.workspaceName}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-400 truncate">{item.subtitle}</div>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                <span
                  className={`font-mono text-[10px] px-2 py-0.5 rounded border ${
                    item.tone === 'rose'
                      ? 'bg-rose-500/12 border-rose-500/25 text-rose-300'
                      : item.tone === 'emerald'
                        ? 'bg-emerald-500/12 border-emerald-500/25 text-emerald-300'
                        : 'bg-indigo-500/12 border-indigo-500/25 text-indigo-300'
                  }`}
                >
                  {formatActivityBadge(item)}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    void onEnterProject(
                      item.workspaceId,
                      item.kind === 'deployment' ? 'deployments' : 'gatekeeper',
                    )
                  }
                  className="text-[11px] font-medium text-indigo-300 hover:text-white cursor-pointer"
                >
                  {L('Buka →', 'Open →')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SetupGuideSection({
  onToast,
}: {
  onToast: (type: 'success' | 'error' | 'info', message: string) => void;
}) {
  const { L, locale } = useLanguage();
  const webhookUrl = useMemo(() => `${window.location.origin}/api/webhooks/github`, []);
  const [copiedKey, setCopiedKey] = useState<'hook' | 'commit' | null>(null);

  function copyText(text: string, key: 'hook' | 'commit', label: string) {
    void navigator.clipboard.writeText(text);
    setCopiedKey(key);
    onToast('info', L(`${label} disalin ke papan klip.`, `${label} copied to clipboard.`));
    setTimeout(() => setCopiedKey(null), 1800);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">
          {L('Panduan Setup & Developer', 'Setup & Developer Guide')}
        </h1>
        <p className="text-xs sm:text-sm text-zinc-400 mt-1">
          {L(
            'Konfigurasikan sinkronisasi commit otomatis, webhook GitHub, dan sesi langsung WebRTC dengan mudah.',
            'Configure automated commit syncing, GitHub webhooks, and WebRTC live sessions cleanly.',
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="cp-panel rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-white">
            {L('1. Konvensi Tag Commit (#CP-XX)', '1. Commit Tagging Convention (#CP-XX)')}
          </h2>
          <p className="text-xs text-zinc-400 leading-relaxed">
            {locale === 'id' ? (
              <>
                Sertakan kode kartu dari papan Kanban proyek di dalam pesan commit atau judul pull
                request saat push ke feature branch. CodePulse otomatis melampirkan diff commit dan
                memindahkan kartu ke <strong>In Review</strong>.
              </>
            ) : (
              <>
                Include the card code from your project Kanban board inside commit messages or pull
                request titles when pushing to a feature branch. CodePulse automatically attaches
                the commit diff and moves the card to <strong>In Review</strong>.
              </>
            )}
          </p>
          <div className="p-3.5 rounded-xl bg-zinc-950 border border-white/10 flex items-center justify-between gap-2 font-mono text-xs text-cyan-300">
            <span className="truncate">git commit -m &quot;feat: auth guard #CP-01&quot;</span>
            <button
              type="button"
              onClick={() =>
                copyText(
                  'git commit -m "feat: auth guard #CP-01"',
                  'commit',
                  L('Contoh perintah git', 'Sample git command'),
                )
              }
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 cursor-pointer shrink-0"
            >
              {copiedKey === 'commit' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        <div className="cp-panel rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-white">
            {L('2. URL Payload Webhook GitHub', '2. GitHub Webhook Payload URL')}
          </h2>
          <p className="text-xs text-zinc-400 leading-relaxed">
            {locale === 'id' ? (
              <>
                Saat menghubungkan repository di GitHub, CodePulse menggunakan endpoint ini untuk
                event <code>push</code> dan <code>pull_request</code> yang diverifikasi melalui
                HMAC-SHA256.
              </>
            ) : (
              <>
                When linking a repository on GitHub, CodePulse uses this endpoint for{' '}
                <code>push</code> and <code>pull_request</code> events verified via HMAC-SHA256.
              </>
            )}
          </p>
          <div className="p-3.5 rounded-xl bg-zinc-950 border border-white/10 flex items-center justify-between gap-2 font-mono text-xs text-indigo-300">
            <span className="truncate">{webhookUrl}</span>
            <button
              type="button"
              onClick={() => copyText(webhookUrl, 'hook', L('URL Webhook', 'Webhook URL'))}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 cursor-pointer shrink-0"
            >
              {copiedKey === 'hook' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        <div className="cp-panel rounded-2xl p-6 space-y-3">
          <h2 className="text-base font-semibold text-white">
            {L('3. Tata Kelola Peran Tingkat Proyek', '3. Project-Level Role Governance')}
          </h2>
          <p className="text-xs text-zinc-400 leading-relaxed">
            {locale === 'id' ? (
              <>
                Hak akses berlaku per workspace proyek, bukan secara global. Membuat workspace
                menjadikan Anda <strong>Project Lead</strong> proyek tersebut (membuka akses kunci
                repo, <em>Approve &amp; Merge</em>, dan deploy produksi Vercel), sementara workspace
                lain tetap independen.
              </>
            ) : (
              <>
                Your permissions apply per project workspace rather than globally. Creating a
                workspace makes you that project&apos;s <strong>Project Lead</strong> (unlocking
                repo locking, <em>Approve &amp; Merge</em>, and production Vercel deploys), while
                keeping your other workspaces independent.
              </>
            )}
          </p>
        </div>

        <div className="cp-panel rounded-2xl p-6 space-y-3">
          <h2 className="text-base font-semibold text-white">
            {L('4. Monitoring IDE WebRTC Langsung', '4. Live WebRTC IDE Monitoring')}
          </h2>
          <p className="text-xs text-zinc-400 leading-relaxed">
            {locale === 'id' ? (
              <>
                Buka proyek mana saja lalu masuk ke <strong>Monitor Langsung</strong> → klik{' '}
                <strong>Mulai Sesi Langsung</strong> dan pilih jendela IDE atau editor kode Anda
                langsung di Chrome—tanpa plugin atau agen desktop tambahan.
              </>
            ) : (
              <>
                Open any project and navigate to <strong>Live Monitor</strong> → click{' '}
                <strong>Start Live Session</strong> and pick your IDE or code editor window directly
                in Chrome—zero plugins or desktop agents needed.
              </>
            )}
          </p>
        </div>

        <div className="cp-panel rounded-2xl p-6 space-y-3 lg:col-span-2">
          <h2 className="text-base font-semibold text-white">
            {L(
              '5. Deployment Vercel Langsung & Auto-Deploy saat Merge',
              '5. Live Vercel Deployments & Auto-Deploy on Merge',
            )}
          </h2>
          <p className="text-xs text-zinc-400 leading-relaxed">
            {locale === 'id' ? (
              <>
                Tautkan token Vercel terenkripsi Anda sekali saja di{' '}
                <strong>Integrasi &amp; Vault</strong>, lalu hubungkan setiap workspace proyek ke
                proyek Vercel-nya langsung di tab <strong>Deployment</strong>.
              </>
            ) : (
              <>
                Link your encrypted Vercel token once in <strong>Integrations &amp; Vault</strong>,
                then connect each project workspace to its Vercel project directly inside the{' '}
                <strong>Deployments</strong> tab.
              </>
            )}
          </p>
          <VercelTokenGuide />
        </div>
      </div>
    </div>
  );
}

