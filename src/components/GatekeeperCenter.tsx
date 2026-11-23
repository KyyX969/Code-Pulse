import { useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Ban,
  Clock,
  Eye,
  GitBranch,
  GitCommit,
  GitMerge,
  GitPullRequest,
  Link2,
  Lock,
  Play,
  ShieldAlert,
  ShieldCheck,
  Unlock,
  Zap,
} from 'lucide-react';
import { isWorkspaceLeader } from '../../shared/permissions.ts';
import type { PublicUser, Task, WebhookEvent, Workspace } from '../../shared/types.ts';
import { api } from '../lib/api.ts';
import { useLanguage } from '../lib/i18nContext.ts';

interface GatekeeperCenterProps {
  workspace: Workspace;
  tasks: Task[];
  events: WebhookEvent[];
  currentUser: PublicUser;
  onWorkspaceUpdated: (ws: Workspace) => void;
  onOpenTask: (task: Task) => void;
  onOpenRepoConnect?: () => void;
  onToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export function GatekeeperCenter({
  workspace,
  tasks,
  events,
  currentUser,
  onWorkspaceUpdated,
  onOpenTask,
  onOpenRepoConnect,
  onToast,
}: GatekeeperCenterProps) {
  const { L, locale } = useLanguage();
  const isLeader = isWorkspaceLeader(workspace, currentUser);
  const activeCandidate =
    tasks.find((t) => t.status === 'in_progress') ||
    tasks.find((t) => t.status === 'todo') ||
    tasks[0];

  const [simType, setSimType] = useState<'push' | 'pull_request'>('push');
  const [simBranch, setSimBranch] = useState(
    activeCandidate?.branchName || `feat/${activeCandidate?.taskCode.toLowerCase() || 'auth'}`,
  );
  const [simMessage, setSimMessage] = useState(
    activeCandidate
      ? `feat: complete implementation #${activeCandidate.taskCode}`
      : 'feat: update authentication flow #CP-04',
  );
  const [simulating, setSimulating] = useState(false);
  const [togglingProtection, setTogglingProtection] = useState(false);

  const inReviewTasks = useMemo(
    () => tasks.filter((t) => t.status === 'in_review'),
    [tasks],
  );

  const avgLatencyMs = useMemo(() => {
    if (events.length === 0) return 0;
    const total = events.reduce((acc, e) => acc + (e.latencyMs || 0), 0);
    return Math.round(total / events.length);
  }, [events]);

  async function handleToggleProtection() {
    if (!isLeader) {
      onToast(
        'error',
        L(
          'Hanya Ketua Proyek yang dapat mengubah Proteksi Branch.',
          'Only Project Leader can modify Branch Protection.',
        ),
      );
      return;
    }
    setTogglingProtection(true);
    try {
      const res = await api.toggleBranchProtection(workspace.id);
      onWorkspaceUpdated(res.workspace);
      onToast('info', res.notice);
    } catch (err) {
      onToast(
        'error',
        err instanceof Error
          ? err.message
          : L('Gagal mengubah status proteksi', 'Failed to toggle protection'),
      );
    } finally {
      setTogglingProtection(false);
    }
  }

  async function runSimulation(opts?: {
    eventType?: 'push' | 'pull_request';
    branch?: string;
    commitMessage?: string;
    isDirectPushAttempt?: boolean;
  }) {
    setSimulating(true);
    const targetBranch = opts?.branch ?? simBranch;
    const targetMessage = opts?.commitMessage ?? simMessage;
    const targetType = opts?.eventType ?? simType;

    try {
      const res = await api.simulateWebhook(workspace.id, {
        eventType: targetType,
        branch: targetBranch,
        commitMessage: targetMessage,
        actorUsername: currentUser.username,
        isDirectPushAttempt: opts?.isDirectPushAttempt,
      });

      if (res.updatedTasks.length > 0) {
        onToast(
          'success',
          L(
            `Webhook menyinkronkan #${res.updatedTasks[0].taskCode} → Dalam Review dalam ${res.latencyMs}ms!`,
            `Webhook synced #${res.updatedTasks[0].taskCode} → In Review in ${res.latencyMs}ms!`,
          ),
        );
      } else {
        onToast(
          'info',
          L(
            `Webhook diproses dalam ${res.latencyMs}ms.`,
            `Webhook processed in ${res.latencyMs}ms.`,
          ),
        );
      }
    } catch (err) {
      onToast(
        'error',
        err instanceof Error ? err.message : L('Simulasi diblokir', 'Simulation blocked'),
      );
    } finally {
      setSimulating(false);
    }
  }

  const slaPct = Math.min(100, Math.max(3, Math.round((avgLatencyMs / 3000) * 100)));

  return (
    <div className="space-y-6">
      {/* Gatekeeper Pipeline Architecture Strip */}
      <div className="cp-panel rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <PipelineStep label={L('1. Push Fitur', '1. Feature Push')} sub="IDE → feat/*" tone="sky" />
          <ArrowRight className="w-3.5 h-3.5 text-zinc-600 hidden sm:inline" />
          <PipelineStep label={L('2. Sinkron Webhook', '2. Webhook Sync')} sub="HMAC < 3s" tone="cyan" />
          <ArrowRight className="w-3.5 h-3.5 text-zinc-600 hidden sm:inline" />
          <PipelineStep
            label={L('3. Otomatis Dalam Review', '3. Auto In Review')}
            sub={L('Deteksi #CP-XX', 'Parse #CP-XX')}
            tone="violet"
          />
          <ArrowRight className="w-3.5 h-3.5 text-zinc-600 hidden sm:inline" />
          <PipelineStep
            label={L('4. Gatekeeper Ketua Proyek', '4. Leader Gatekeeper')}
            sub={`Merge → ${workspace.defaultBranch}`}
            tone="emerald"
          />
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="text-[11px] font-mono text-zinc-400">
            {L('Push langsung ke', 'Direct pushes to')}{' '}
            <code className="text-rose-300">{workspace.defaultBranch}</code>{' '}
            {workspace.branchProtected
              ? L('ditolak (403)', 'rejected (403)')
              : L('tidak terproteksi', 'unprotected')}
          </div>
          {!workspace.githubRepo && isLeader && onOpenRepoConnect && (
            <button
              type="button"
              onClick={onOpenRepoConnect}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold transition cursor-pointer"
            >
              <Link2 className="w-3 h-3" />
              <span>{L('Hubungkan Repo GitHub', 'Connect GitHub Repo')}</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="cp-panel rounded-2xl p-4 flex items-start justify-between gap-3">
          <div>
            <div className="text-xs text-zinc-400">
              {L('Gatekeeper Branch Utama', 'Main Branch Gatekeeper')}
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-xl font-bold text-white">
                {workspace.branchProtected
                  ? L('Terproteksi', 'Protected')
                  : L('Tidak Terproteksi', 'Unprotected')}
              </span>
              <span
                className={`text-[11px] font-mono px-2 py-0.5 rounded-md ${
                  workspace.branchProtected
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25'
                    : 'bg-amber-500/15 text-amber-300 border border-amber-500/25'
                }`}
              >
                {workspace.defaultBranch}
              </span>
            </div>
            <div className="text-[11px] text-zinc-400 mt-1.5 tabular-nums">
              <strong className="text-rose-300">{workspace.blockedDirectPushes}</strong>{' '}
              {L(
                'push langsung diblokir (Zero Direct Push: 100%)',
                'direct pushes blocked (Zero Direct Push: 100%)',
              )}
            </div>
          </div>
          <button
            type="button"
            disabled={togglingProtection || !isLeader}
            onClick={handleToggleProtection}
            title={
              !isLeader
                ? L('Khusus Ketua Proyek', 'Leader only')
                : L('Ubah Proteksi Branch GitHub', 'Toggle GitHub Branch Protection')
            }
            className={`p-2.5 rounded-xl border transition cursor-pointer disabled:opacity-50 ${
              workspace.branchProtected
                ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300 hover:bg-emerald-500/25'
                : 'bg-zinc-800 border-white/10 text-zinc-400 hover:text-white'
            }`}
          >
            {workspace.branchProtected ? (
              <Lock className="w-5 h-5" />
            ) : (
              <Unlock className="w-5 h-5" />
            )}
          </button>
        </div>

        <div className="cp-panel rounded-2xl p-4 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs text-zinc-400">
                {L('Rata-rata Latensi Sinkron Webhook', 'Avg Webhook Sync Latency')}
              </div>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className="text-xl font-bold font-mono text-cyan-300 tabular-nums">
                  {avgLatencyMs} ms
                </span>
                <span className="text-[11px] text-emerald-400 font-medium">
                  {L('SLA < 3.000 ms', 'SLA < 3,000 ms')}
                </span>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-cyan-500/15 border border-cyan-500/25 text-cyan-300">
              <Zap className="w-5 h-5" />
            </div>
          </div>
          <div className="h-1.5 w-full rounded-full bg-zinc-900 overflow-hidden">
            <div
              style={{ width: `${slaPct}%` }}
              className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400"
            />
          </div>
        </div>

        <div className="cp-panel rounded-2xl p-4 flex items-start justify-between gap-3">
          <div>
            <div className="text-xs text-zinc-400">
              {L('Antrean Review Gatekeeper', 'Gatekeeper Review Queue')}
            </div>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="text-xl font-bold text-violet-300 tabular-nums">
                {inReviewTasks.length} {L('PR', inReviewTasks.length === 1 ? 'PR' : 'PRs')}
              </span>
              <span className="text-[11px] text-zinc-400">
                {L('menunggu Ketua Proyek', 'awaiting Leader')}
              </span>
            </div>
            <div className="text-[11px] text-zinc-500 mt-1.5">
              {L(
                'Wajib inspeksi diff kode sebelum merge',
                'Requires code diff inspection before merge',
              )}
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-violet-500/15 border border-violet-500/25 text-violet-300">
            <GitPullRequest className="w-5 h-5" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Review Queue + Webhook Simulator */}
        <div className="lg:col-span-5 space-y-6">
          <div className="cp-panel rounded-2xl p-5 space-y-3.5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-violet-400" />
                <span>{L('Antrean Persetujuan Gatekeeper', 'Approval Gatekeeper Queue')}</span>
              </h3>
              <span className="text-xs font-mono text-zinc-400 tabular-nums">
                {inReviewTasks.length} {L('siap', 'ready')}
              </span>
            </div>

            {inReviewTasks.length === 0 ? (
              <div className="p-6 rounded-xl border border-dashed border-white/10 text-center text-xs text-zinc-500">
                {L(
                  'Belum ada branch yang menunggu di Dalam Review.',
                  'No branches currently waiting in In Review.',
                )}
              </div>
            ) : (
              <div className="space-y-2.5">
                {inReviewTasks.map((task) => (
                  <div
                    key={task.id}
                    className="cp-card p-3.5 rounded-xl flex items-center justify-between gap-3 hover:border-violet-400/40 transition"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-indigo-300">
                          #{task.taskCode}
                        </span>
                        <span className="text-xs font-medium text-white truncate">
                          {task.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[11px] font-mono text-zinc-400">
                        <GitBranch className="w-3 h-3 text-cyan-400 shrink-0" />
                        <span className="truncate">{task.branchName}</span>
                        {task.diffSummary && (
                          <span className="text-emerald-400 shrink-0 tabular-nums">
                            +{task.diffSummary.totalAdditions}/-{task.diffSummary.totalDeletions}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenTask(task)}
                      className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-semibold transition cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>{L('Review', 'Review')}</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Interactive Webhook & Direct-Push Simulator */}
          <div className="cp-panel rounded-2xl border-indigo-500/25 p-5 space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-400" />
                  <span>{L('Simulator Webhook GitHub', 'GitHub Webhook Simulator')}</span>
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  {L(
                    'Uji sinkronisasi Kanban otomatis (F-03) & proteksi push langsung (F-04) secara lokal.',
                    'Test F-03 auto-Kanban sync & F-04 direct-push protection locally.',
                  )}
                </p>
              </div>
              {activeCandidate && (
                <button
                  type="button"
                  onClick={() => {
                    setSimBranch(
                      activeCandidate.branchName ||
                        `feat/${activeCandidate.taskCode.toLowerCase()}`,
                    );
                    setSimMessage(
                      `feat: implement ${activeCandidate.title.toLowerCase()} #${activeCandidate.taskCode}`,
                    );
                  }}
                  className="text-[11px] font-mono px-2 py-1 rounded-md bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/25 cursor-pointer shrink-0"
                >
                  {L('Isi', 'Fill')} #{activeCandidate.taskCode}
                </button>
              )}
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSimType('push')}
                  className={`py-1.5 px-3 rounded-xl text-xs font-medium border cursor-pointer transition ${
                    simType === 'push'
                      ? 'bg-indigo-500/20 border-indigo-400/50 text-indigo-200'
                      : 'bg-zinc-950 border-white/10 text-zinc-400'
                  }`}
                >
                  {L('Event push', 'push event')}
                </button>
                <button
                  type="button"
                  onClick={() => setSimType('pull_request')}
                  className={`py-1.5 px-3 rounded-xl text-xs font-medium border cursor-pointer transition ${
                    simType === 'pull_request'
                      ? 'bg-indigo-500/20 border-indigo-400/50 text-indigo-200'
                      : 'bg-zinc-950 border-white/10 text-zinc-400'
                  }`}
                >
                  {L('Event pull_request', 'pull_request event')}
                </button>
              </div>

              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">
                  {L('Branch Target', 'Target Branch')}
                </label>
                <input
                  type="text"
                  value={simBranch}
                  onChange={(e) => setSimBranch(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-white/10 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">
                  {L('Pesan Commit / PR (sertakan #CP-XX)', 'Commit / PR Message (include #CP-XX)')}
                </label>
                <input
                  type="text"
                  value={simMessage}
                  onChange={(e) => setSimMessage(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-white/10 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  disabled={simulating}
                  onClick={() => runSimulation()}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>{L('Simulasi Push Fitur', 'Simulate Feature Push')}</span>
                </button>

                <button
                  type="button"
                  disabled={simulating}
                  onClick={() =>
                    runSimulation({
                      eventType: 'push',
                      branch: workspace.defaultBranch,
                      commitMessage: 'hotfix: direct push attempt to main',
                      isDirectPushAttempt: true,
                    })
                  }
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/35 text-rose-300 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>{L('Uji Direct Push', 'Test Direct Push')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Real-Time Webhook & Gatekeeper Audit Feed */}
        <div className="lg:col-span-7 cp-panel rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">
              {L(
                'Aliran Audit Webhook & Gatekeeper Langsung',
                'Live Webhook & Gatekeeper Audit Stream',
              )}
            </h3>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-950 border border-white/8 text-zinc-400">
              POST /api/webhooks/github
            </span>
          </div>

          <div className="space-y-2.5 max-h-[560px] overflow-y-auto pr-1">
            {events.map((ev) => (
              <div
                key={ev.id}
                className={`p-3.5 rounded-xl border text-xs space-y-1.5 transition ${
                  ev.blocked
                    ? 'bg-rose-950/30 border-rose-500/35'
                    : ev.eventType === 'gatekeeper_merge'
                      ? 'bg-emerald-950/25 border-emerald-500/30'
                      : 'bg-zinc-950/85 border-white/8'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <EventBadge eventType={ev.eventType} />
                    <span className="font-semibold text-zinc-200">
                      @{ev.actorUsername}
                    </span>
                    {ev.branch && (
                      <span className="font-mono text-[11px] text-zinc-400 truncate">
                        {L('di', 'on')} {ev.branch}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0 text-[11px] font-mono text-zinc-400 tabular-nums">
                    <span className="inline-flex items-center gap-1 text-cyan-300">
                      <Clock className="w-3 h-3" />
                      {ev.latencyMs}ms
                    </span>
                    <span>
                      {new Date(ev.createdAt).toLocaleTimeString(
                        locale === 'id' ? 'id-ID' : 'en-US',
                      )}
                    </span>
                  </div>
                </div>

                {ev.commitMessage && (
                  <div className="font-mono text-[11px] text-zinc-300 flex items-center gap-1.5">
                    <GitCommit className="w-3 h-3 text-zinc-500 shrink-0" />
                    <span className="truncate">{ev.commitMessage}</span>
                  </div>
                )}

                {ev.reason && (
                  <div className="text-rose-300 text-[11px] flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                    <span>{ev.reason}</span>
                  </div>
                )}

                {ev.matchedTaskCode && (
                  <div className="flex items-center gap-2 pt-0.5 text-[11px]">
                    <span className="px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300 font-mono">
                      #{ev.matchedTaskCode}
                    </span>
                    {ev.statusTransition && (
                      <span className="font-mono text-zinc-400">
                        {ev.statusTransition}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PipelineStep({
  label,
  sub,
  tone,
}: {
  label: string;
  sub: string;
  tone: 'sky' | 'cyan' | 'violet' | 'emerald';
}) {
  const styles: Record<typeof tone, string> = {
    sky: 'border-sky-500/30 bg-sky-500/10 text-sky-200',
    cyan: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200',
    violet: 'border-violet-500/30 bg-violet-500/10 text-violet-200',
    emerald: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  };
  return (
    <div className={`px-2.5 py-1.5 rounded-xl border ${styles[tone]}`}>
      <div className="font-semibold text-[11px] leading-tight">{label}</div>
      <div className="font-mono text-[10px] opacity-75">{sub}</div>
    </div>
  );
}

function EventBadge({ eventType }: { eventType: WebhookEvent['eventType'] }) {
  const { L } = useLanguage();
  switch (eventType) {
    case 'direct_push_blocked':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 font-mono text-[10px] font-semibold uppercase">
          <Ban className="w-3 h-3" />
          {L('Diblokir', 'Blocked')}
        </span>
      );
    case 'gatekeeper_merge':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-semibold uppercase">
          <GitMerge className="w-3 h-3" />
          {L('Di-merge', 'Merged')}
        </span>
      );
    case 'gatekeeper_rejected':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-mono text-[10px] font-semibold uppercase">
          <ShieldAlert className="w-3 h-3" />
          {L('Perlu Revisi', 'Changes Requested')}
        </span>
      );
    case 'pull_request':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-500/20 text-violet-300 font-mono text-[10px] font-semibold uppercase">
          <GitPullRequest className="w-3 h-3" />
          PR
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-300 font-mono text-[10px] font-semibold uppercase">
          <GitCommit className="w-3 h-3" />
          Push
        </span>
      );
  }
}
