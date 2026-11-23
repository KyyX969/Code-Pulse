import { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  GitBranch,
  Globe,
  Lock,
  Rocket,
  SlidersHorizontal,
  Terminal,
} from 'lucide-react';
import { isWorkspaceLeader } from '../../shared/permissions.ts';
import type { Deployment, PublicUser, Workspace } from '../../shared/types.ts';
import { api } from '../lib/api.ts';
import { useLanguage } from '../lib/i18nContext.ts';
import { VercelDeployConfigurator } from './VercelDeployConfigurator.tsx';
import { VercelIcon } from './VercelIcon.tsx';

interface DeploymentsPanelProps {
  workspace: Workspace;
  deployments: Deployment[];
  currentUser: PublicUser;
  onWorkspaceUpdated?: (ws: Workspace) => void;
  onUserUpdated?: (user: PublicUser) => void;
  onDeploymentCreated: (deployment: Deployment) => void;
  onOpenSettings?: () => void;
  onToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export function DeploymentsPanel({
  workspace,
  deployments,
  currentUser,
  onWorkspaceUpdated,
  onUserUpdated,
  onDeploymentCreated,
  onOpenSettings,
  onToast,
}: DeploymentsPanelProps) {
  const { L, locale } = useLanguage();
  const [deploying, setDeploying] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [configOpen, setConfigOpen] = useState(false);

  const activeDeployment =
    deployments.find((d) => d.id === selectedId) || deployments[0] || null;
  const isActiveSimulated = activeDeployment?.vercelDeploymentId?.startsWith('dpl_sim_') ?? false;
  const isLeader = isWorkspaceLeader(workspace, currentUser);

  async function handleDeployNow() {
    if (!isLeader) {
      onToast(
        'error',
        L(
          'Hanya Ketua Proyek yang dapat memicu deployment produksi Vercel.',
          'Only Project Leader can trigger Vercel production deployments.',
        ),
      );
      return;
    }
    setDeploying(true);
    try {
      const { deployment } = await api.triggerDeployment(workspace.id, {
        branch: workspace.defaultBranch,
      });
      onDeploymentCreated(deployment);
      setSelectedId(deployment.id);
      onToast(
        'info',
        L(
          'Deployment Vercel masuk antrean! Mengalirkan log build secara langsung...',
          'Vercel deployment queued! Streaming live build logs...',
        ),
      );
    } catch (err) {
      onToast(
        'error',
        err instanceof Error ? err.message : L('Gagal memicu deployment', 'Deployment trigger failed'),
      );
    } finally {
      setDeploying(false);
    }
  }

  function copyLogs() {
    if (!activeDeployment) return;
    void navigator.clipboard.writeText(activeDeployment.buildLogs.join('\n'));
    onToast('info', L('Log build disalin ke clipboard.', 'Build logs copied to clipboard.'));
  }

  return (
    <div className="space-y-6">
      {/* Top Deployment Hero */}
      <div className="cp-panel rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="space-y-2 relative z-10">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/10 text-white text-[11px] font-semibold tracking-wide">
              <VercelIcon className="w-3 h-3 text-white" />
              {L('DEPLOYMENT EDGE VERCEL', 'VERCEL EDGE DEPLOYMENT')}
            </span>
            <span className="text-xs font-mono text-zinc-400">
              {workspace.vercelProjectName || workspace.githubRepo || workspace.slug}
            </span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            {L('Deployment Produksi Sekali Klik', 'One-Click Production Deployment')}
          </h2>
          <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-400">
            <span className="inline-flex items-center gap-1.5 font-mono text-zinc-300">
              <GitBranch className="w-3.5 h-3.5 text-cyan-400" />
              Branch: {workspace.defaultBranch}
            </span>
            <span>
              {L('Auto-Deploy saat Merge:', 'Auto-Deploy on Merge:')}{' '}
              <strong
                className={workspace.autoDeployOnMerge ? 'text-emerald-400' : 'text-zinc-400'}
              >
                {workspace.autoDeployOnMerge ? L('Aktif', 'Enabled') : L('Manual', 'Manual')}
              </strong>
            </span>
            <span>
              {L('Token Vercel:', 'Vercel Token:')}{' '}
              <strong
                className={currentUser.vercelConnected ? 'text-emerald-400' : 'text-amber-300'}
              >
                {currentUser.vercelConnected
                  ? L('Terhubung', 'Connected')
                  : L('Belum Terhubung', 'Not Connected')}
              </strong>
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 relative z-10">
          {!isLeader && (
            <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 border border-white/10 text-xs text-zinc-400">
              <Lock className="w-3.5 h-3.5" />
              <span>{L('Khusus Ketua Proyek', 'Leader Only')}</span>
            </div>
          )}
          {currentUser.vercelConnected && workspace.vercelProjectId && (
            <button
              type="button"
              onClick={() => setConfigOpen((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/12 text-zinc-200 text-xs font-medium transition cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400" />
              <span>
                {configOpen
                  ? L('Sembunyikan Konfigurasi Build', 'Hide Build Config')
                  : L('Konfigurasi Build & Env', 'Build & Env Config')}
              </span>
            </button>
          )}
          <button
            type="button"
            disabled={deploying || !isLeader}
            onClick={handleDeployNow}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-semibold text-sm shadow-xl transition cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
          >
            {deploying ? (
              <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
            ) : (
              <Rocket className="w-4 h-4" />
            )}
            <span>{deploying ? L('Memicu...', 'Triggering...') : L('Deploy Sekarang', 'Deploy Now')}</span>
          </button>
        </div>
      </div>

      {(!currentUser.vercelConnected || !workspace.vercelProjectId || configOpen) && (
        <div
          className={`cp-panel rounded-2xl p-5 space-y-4 ${
            !currentUser.vercelConnected || !workspace.vercelProjectId
              ? 'border border-indigo-500/25'
              : ''
          }`}
        >
          {(!currentUser.vercelConnected || !workspace.vercelProjectId) && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs font-medium text-indigo-200">
                {!currentUser.vercelConnected
                  ? L(
                      'Hubungkan Token Vercel Anda sekali di bawah ini untuk membuat & deploy langsung dari CodePulse.',
                      'Link your Vercel token once below to provision & deploy directly from CodePulse.',
                    )
                  : L(
                      'Atur konfigurasi build & environment di bawah—CodePulse membuat proyek di Vercel secara otomatis tanpa perlu membuka vercel.com/new.',
                      'Configure build & environment settings below—CodePulse creates the project on Vercel automatically without needing vercel.com/new.',
                    )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-indigo-500/15 border border-indigo-500/25 text-indigo-300">
                  {!currentUser.vercelConnected
                    ? L('Mode Simulasi', 'Simulation Mode')
                    : L('Siap Diprovision', 'Ready to Provision')}
                </span>
                {onOpenSettings && (
                  <button
                    type="button"
                    onClick={onOpenSettings}
                    className="text-[11px] font-medium text-zinc-400 hover:text-white cursor-pointer"
                  >
                    {L('Pengaturan Proyek', 'Project Settings')}
                  </button>
                )}
              </div>
            </div>
          )}

          <VercelDeployConfigurator
            key={workspace.id}
            workspace={workspace}
            currentUser={currentUser}
            showDeployButton
            onWorkspaceUpdated={(ws) => onWorkspaceUpdated?.(ws)}
            onUserUpdated={onUserUpdated}
            onDeploymentCreated={(dep) => {
              onDeploymentCreated(dep);
              setSelectedId(dep.id);
            }}
            onToast={onToast}
          />
        </div>
      )}

      {/* Main Split: Deployment History + Build Console */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 cp-panel rounded-2xl p-5 space-y-3.5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">
              {L('Riwayat Deployment', 'Deployment History')}
            </h3>
            <span className="text-xs font-mono text-zinc-500 tabular-nums">
              {deployments.length} {L('total', 'total')}
            </span>
          </div>

          {deployments.length === 0 ? (
            <div className="p-8 rounded-xl border border-dashed border-white/10 text-center text-xs text-zinc-500">
              {L('Belum ada deployment. Klik ', 'No deployments yet. Click ')}
              <strong>{L('Deploy Sekarang', 'Deploy Now')}</strong>{' '}
              {L('untuk memulai.', 'to launch.')}
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1">
              {deployments.map((dep) => {
                const isSelected = activeDeployment?.id === dep.id;
                const isSimItem = dep.vercelDeploymentId?.startsWith('dpl_sim_') ?? false;
                return (
                  <button
                    key={dep.id}
                    type="button"
                    onClick={() => setSelectedId(dep.id)}
                    className={`w-full text-left p-3.5 rounded-xl border transition cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-500/12 border-indigo-400/50'
                        : 'bg-zinc-950/85 border-white/8 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <DeploymentStatusBadge status={dep.status} />
                        {isSimItem && (
                          <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/25 text-amber-300">
                            SIM
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-mono text-zinc-500 tabular-nums">
                        {new Date(dep.createdAt).toLocaleTimeString(
                          locale === 'id' ? 'id-ID' : 'en-US',
                        )}
                      </span>
                    </div>
                    <div className="mt-2 text-xs font-medium text-zinc-100 truncate">
                      {dep.commitMessage || `Deploy ${dep.branch}`}
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px] font-mono text-zinc-400">
                      <span>
                        {dep.branch} {dep.commitSha ? `• ${dep.commitSha}` : ''}
                      </span>
                      {dep.triggeredByUsername && <span>@{dep.triggeredByUsername}</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Active Deployment Inspector */}
        <div className="lg:col-span-7 cp-panel rounded-2xl p-5 space-y-4">
          {activeDeployment ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <DeploymentStatusBadge status={activeDeployment.status} />
                    <span className="font-mono text-xs text-zinc-400">
                      {activeDeployment.vercelDeploymentId || activeDeployment.id.slice(0, 8)}
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-white">
                    {activeDeployment.commitMessage ||
                      L('Deployment Produksi', 'Production Deployment')}
                  </div>
                </div>

                {activeDeployment.previewUrl &&
                  (isActiveSimulated ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs font-medium">
                      <span>
                        {L('Simulasi (Tidak Di-host di Vercel)', 'Simulated (Not Hosted on Vercel)')}
                      </span>
                    </span>
                  ) : (
                    <a
                      href={activeDeployment.previewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/35 text-emerald-300 text-xs font-semibold transition"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      <span>{L('Buka Pratinjau', 'Visit Preview')}</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  ))}
              </div>

              {/* Pipeline Stage Stepper */}
              <DeploymentStageStepper status={activeDeployment.status} />

              {/* Preview Browser Bar */}
              {activeDeployment.previewUrl &&
                (isActiveSimulated ? (
                  <div className="p-3 rounded-xl bg-zinc-950 border border-amber-500/20 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 text-zinc-400 min-w-0">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="text-zinc-300">
                        {L(
                          'Hanya output simulasi — hubungkan Proyek Vercel di ',
                          'Simulation output only — link a Vercel Project in ',
                        )}
                        <strong className="text-white">
                          {L('Pengaturan Proyek', 'Project Settings')}
                        </strong>{' '}
                        {L(
                          'untuk memublikasikan URL Vercel aktif.',
                          'to publish a live Vercel URL.',
                        )}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-amber-500/12 text-amber-300 shrink-0">
                      {L('Simulasi', 'Simulated')}
                    </span>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-zinc-950 border border-white/10 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 text-zinc-400 min-w-0">
                      <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <a
                        href={activeDeployment.previewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-cyan-300 hover:underline truncate"
                      >
                        {activeDeployment.previewUrl}
                      </a>
                    </div>
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-500/12 text-emerald-300 shrink-0">
                      {L('HTTPS Aktif', 'HTTPS Live')}
                    </span>
                  </div>
                ))}

              {/* Terminal Build Console */}
              <div className="rounded-xl bg-[#06070b] border border-white/10 overflow-hidden">
                <div className="px-4 py-2.5 bg-zinc-900/95 border-b border-white/10 flex items-center justify-between text-xs text-zinc-300">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 mr-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500/70" />
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
                    </div>
                    <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="font-mono">
                      {L('Output Build Vercel', 'Vercel Build Output')}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={copyLogs}
                    className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{L('Salin', 'Copy')}</span>
                  </button>
                </div>
                <div className="p-4 font-mono text-xs space-y-1.5 max-h-[300px] overflow-y-auto text-zinc-300 leading-relaxed">
                  {activeDeployment.buildLogs.map((line, i) => (
                    <div
                      key={i}
                      className={
                        line.includes('READY') || line.includes('succeeded')
                          ? 'text-emerald-300'
                          : line.includes('Error') || line.includes('ERROR')
                            ? 'text-rose-300'
                            : 'text-zinc-300'
                      }
                    >
                      {line}
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="h-64 flex items-center justify-center text-sm text-zinc-500">
              {L(
                'Pilih deployment untuk memeriksa log build.',
                'Select a deployment to inspect build logs.',
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DeploymentStageStepper({ status }: { status: Deployment['status'] }) {
  const { L } = useLanguage();
  const stageIndex =
    status === 'QUEUED' ? 0 : status === 'BUILDING' ? 1 : status === 'READY' ? 2 : -1;

  const steps = [
    L('Dalam Antrean', 'Queued'),
    L('Membangun Artefak', 'Building Artifacts'),
    L('Siap di Edge', 'Edge Ready'),
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {steps.map((label, idx) => {
        const isDone = status === 'READY' || idx < stageIndex;
        const isCurrent = status !== 'READY' && status !== 'ERROR' && idx === stageIndex;
        const isError = status === 'ERROR' && idx === 1;

        return (
          <div
            key={idx}
            className={`px-3 py-2 rounded-xl border text-[11px] font-medium flex items-center gap-2 ${
              isError
                ? 'bg-rose-500/12 border-rose-500/35 text-rose-300'
                : isDone
                  ? 'bg-emerald-500/12 border-emerald-500/30 text-emerald-300'
                  : isCurrent
                    ? 'bg-amber-500/12 border-amber-500/35 text-amber-200'
                    : 'bg-zinc-950/60 border-white/8 text-zinc-500'
            }`}
          >
            {isDone ? (
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            ) : isCurrent ? (
              <span className="w-2.5 h-2.5 rounded-full bg-amber-300 animate-pulse shrink-0" />
            ) : isError ? (
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <Clock className="w-3.5 h-3.5 shrink-0" />
            )}
            <span className="truncate">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function DeploymentStatusBadge({ status }: { status: Deployment['status'] }) {
  const { L } = useLanguage();
  switch (status) {
    case 'READY':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold">
          <CheckCircle2 className="w-3 h-3" />
          {L('Siap', 'Ready')}
        </span>
      );
    case 'BUILDING':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-semibold">
          <span className="w-2 h-2 rounded-full bg-amber-300 animate-pulse" />
          {L('Membangun', 'Building')}
        </span>
      );
    case 'ERROR':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[11px] font-semibold">
          <AlertCircle className="w-3 h-3" />
          {L('Gagal', 'Error')}
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-zinc-800 border border-white/10 text-zinc-300 text-[11px] font-semibold">
          <Clock className="w-3 h-3" />
          {L('Antrean', 'Queued')}
        </span>
      );
  }
}
