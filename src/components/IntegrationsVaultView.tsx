import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Database,
  ExternalLink,
  Eye,
  EyeOff,
  FolderGit2,
  Globe,
  HelpCircle,
  KeyRound,
  Lock,
  Radio,
  RefreshCw,
  ShieldCheck,
  Webhook,
} from 'lucide-react';
import type {
  GitHubRepoItem,
  PublicUser,
  SystemCapabilities,
  VercelProjectItem,
  Workspace,
} from '../../shared/types.ts';
import { api } from '../lib/api.ts';
import { useLanguage } from '../lib/i18nContext.ts';
import type { ConsoleSection } from './ConsoleViews.tsx';
import { GitHubIcon } from './GitHubIcon.tsx';
import { VercelProjectsSkeleton } from './LoadingUI.tsx';
import { VercelIcon } from './VercelIcon.tsx';
import { VercelTokenGuide } from './VercelTokenGuide.tsx';

interface IntegrationsVaultViewProps {
  currentUser: PublicUser;
  capabilities: SystemCapabilities | null;
  workspaces: Workspace[];
  repos: GitHubRepoItem[];
  onNavigateSection: (section: ConsoleSection) => void;
  onUserUpdated: (user: PublicUser) => void;
  onToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

const GITHUB_SCOPES = [
  {
    scope: 'repo',
    labelId: 'Akses Repository & PR',
    labelEn: 'Repository & PR Access',
    descId: 'Baca repo, ambil diff, dan setujui/merge PR',
    descEn: 'Read repos, fetch diffs, and approve/merge PRs',
  },
  {
    scope: 'admin:repo_hook',
    labelId: 'Webhook & Proteksi',
    labelEn: 'Webhooks & Guard',
    descId: 'Daftarkan webhook push & terapkan proteksi branch',
    descEn: 'Register push webhooks & enforce branch protection',
  },
  {
    scope: 'read:user',
    labelId: 'Sinkronisasi Identitas',
    labelEn: 'Identity Sync',
    descId: 'Sinkronkan nama profil, avatar, dan handle GitHub',
    descEn: 'Sync profile name, avatar, and GitHub handle',
  },
];

export function IntegrationsVaultView({
  currentUser,
  capabilities,
  workspaces,
  repos,
  onNavigateSection,
  onUserUpdated,
  onToast,
}: IntegrationsVaultViewProps) {
  const { L, locale } = useLanguage();
  const [vercelToken, setVercelToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [rotatingToken, setRotatingToken] = useState(false);
  const [savingVercel, setSavingVercel] = useState(false);
  const [vercelProjects, setVercelProjects] = useState<VercelProjectItem[]>([]);
  const [vercelProjectsLoaded, setVercelProjectsLoaded] = useState(!currentUser.vercelConnected);
  const [refreshingVercel, setRefreshingVercel] = useState(false);
  const [guideExpanded, setGuideExpanded] = useState(!currentUser.vercelConnected);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const linkedRepoWorkspaces = workspaces.filter((w) => Boolean(w.githubRepo)).length;
  const linkedVercelWorkspaces = workspaces.filter((w) => Boolean(w.vercelProjectId)).length;
  const connectedProviders =
    (currentUser.githubConnected ? 1 : 0) + (currentUser.vercelConnected ? 1 : 0);
  const webhookUrl = `${window.location.origin}/api/webhooks/github`;

  useEffect(() => {
    let cancelled = false;
    if (currentUser.vercelConnected) {
      api
        .listVercelProjects()
        .then((res) => {
          if (!cancelled) setVercelProjects(res.projects);
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setVercelProjectsLoaded(true);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [currentUser.vercelConnected]);

  function copyValue(key: string, text: string, label: string) {
    void navigator.clipboard.writeText(text);
    setCopiedKey(key);
    onToast('info', L(`${label} disalin ke papan klip.`, `${label} copied to clipboard.`));
    setTimeout(() => setCopiedKey(null), 1800);
  }

  async function handleRefreshVercelProjects() {
    if (!currentUser.vercelConnected) return;
    setRefreshingVercel(true);
    try {
      const res = await api.listVercelProjects();
      setVercelProjects(res.projects);
      onToast(
        'info',
        L(
          `${res.projects.length} proyek Vercel berhasil disinkronkan.`,
          `Synced ${res.projects.length} Vercel project(s).`,
        ),
      );
    } catch {
      onToast(
        'error',
        L(
          'Tidak dapat menyegarkan proyek Vercel saat ini.',
          'Unable to refresh Vercel projects right now.',
        ),
      );
    } finally {
      setRefreshingVercel(false);
    }
  }

  async function handleLinkVercelToken(e: React.FormEvent) {
    e.preventDefault();
    if (!vercelToken.trim()) return;
    setSavingVercel(true);
    try {
      const { user } = await api.linkVercelToken(vercelToken.trim());
      onUserUpdated(user);
      setVercelToken('');
      setShowToken(false);
      setRotatingToken(false);
      setGuideExpanded(false);
      const vRes = await api.listVercelProjects().catch(() => ({ projects: [] }));
      setVercelProjects(vRes.projects);
      setVercelProjectsLoaded(true);
      onToast(
        'success',
        L(
          'Token Vercel terenkripsi (AES-256-GCM) dan terhubung ke vault Anda.',
          'Vercel token encrypted (AES-256-GCM) and linked to your vault.',
        ),
      );
    } catch (err) {
      onToast(
        'error',
        err instanceof Error
          ? err.message
          : L('Gagal menghubungkan token Vercel', 'Failed to link Vercel token'),
      );
    } finally {
      setSavingVercel(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Hero Banner with Ambient Glow & Security Posture Chips */}
      <div className="cp-panel rounded-2xl p-6 relative overflow-hidden">
        <div
          className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full opacity-20 blur-3xl"
          style={{
            background: 'radial-gradient(circle, rgba(99,102,241,0.7) 0%, rgba(34,211,238,0.15) 60%, transparent 100%)',
          }}
        />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/12 border border-emerald-500/25 text-emerald-300">
                <ShieldCheck className="w-3 h-3" />
                <span>{L('Vault Terenkripsi AES-256-GCM', 'AES-256-GCM Encrypted Vault')}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-500/12 border border-cyan-500/25 text-cyan-300">
                <Lock className="w-3 h-3" />
                <span>{L('Sesi HTTP-Only Bertanda Tangan', 'HTTP-Only Signed Session')}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/25 text-indigo-300">
                <span>
                  {L(
                    `${connectedProviders}/2 Penyedia Terhubung`,
                    `${connectedProviders}/2 Providers Linked`,
                  )}
                </span>
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              {L('Integrasi & Vault Kredensial', 'Integrations & Credential Vault')}
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 max-w-2xl">
              {L(
                'Kelola cakupan OAuth penyedia, kredensial deployment terenkripsi, dan keamanan webhook runtime di seluruh workspace CodePulse Anda.',
                'Manage OAuth provider scopes, encrypted deployment credentials, and runtime webhook security across your CodePulse workspaces.',
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => onNavigateSection('repos')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/12 text-xs font-semibold text-zinc-100 transition cursor-pointer"
            >
              <FolderGit2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>{L(`Repo GitHub (${repos.length})`, `GitHub Repos (${repos.length})`)}</span>
            </button>
            <a
              href="https://vercel.com/account/tokens"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-semibold transition"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>{L('Token Vercel', 'Vercel Tokens')}</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* 4-Column Vault Telemetry Strip */}
        <div className="relative z-10 mt-6 pt-5 border-t border-white/[0.07] grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="p-3.5 rounded-xl bg-zinc-950/85 border border-white/8 space-y-1">
            <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
              {L('Cipher Enkripsi', 'Encryption Cipher')}
            </div>
            <div className="text-sm font-bold font-mono text-emerald-300">AES-256-GCM</div>
            <div className="text-[11px] text-zinc-500">96-bit IV + GCM AuthTag</div>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-950/85 border border-white/8 space-y-1">
            <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
              {L('Jejak GitHub', 'GitHub Footprint')}
            </div>
            <div className="text-sm font-bold font-mono text-white tabular-nums">
              {L(
                `${repos.length} Repo · ${linkedRepoWorkspaces} Terhubung`,
                `${repos.length} Repos · ${linkedRepoWorkspaces} Linked`,
              )}
            </div>
            <div className="text-[11px] text-zinc-500">
              {currentUser.githubConnected
                ? L('Token OAuth aktif', 'OAuth token active')
                : L('OAuth terputus', 'OAuth disconnected')}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-950/85 border border-white/8 space-y-1">
            <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
              Vercel Cloud
            </div>
            <div className="text-sm font-bold font-mono text-cyan-300 tabular-nums">
              {L(
                `${vercelProjects.length} Cloud · ${linkedVercelWorkspaces} Aktif`,
                `${vercelProjects.length} Cloud · ${linkedVercelWorkspaces} Active`,
              )}
            </div>
            <div className="text-[11px] text-zinc-500">
              {currentUser.vercelConnected
                ? L('Deploy langsung aktif', 'Direct deploy enabled')
                : L('Fallback simulasi', 'Simulation fallback')}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-950/85 border border-white/8 space-y-1">
            <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
              {L('Mesin Persistensi', 'Persistence Engine')}
            </div>
            <div className="text-sm font-bold font-mono text-indigo-300 uppercase">
              {capabilities?.mode || 'local'}
            </div>
            <div className="text-[11px] text-zinc-500">
              {L(
                `${capabilities?.iceServers.length || 1} server ICE WebRTC`,
                `${capabilities?.iceServers.length || 1} WebRTC ICE server(s)`,
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Balanced 2-Column Provider Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left Card: GitHub OAuth & Repository Access */}
        <div className="cp-panel rounded-2xl p-6 space-y-5 overflow-hidden">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-white/12 flex items-center justify-center shrink-0">
                <GitHubIcon className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-white">
                  {L('Penyedia GitHub OAuth', 'GitHub OAuth Provider')}
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {L(
                    'Mendukung impor repository, review diff PR, penguncian branch, dan sinkronisasi webhook.',
                    'Powers repository imports, PR diff review, branch locks, and webhook syncing.',
                  )}
                </p>
              </div>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium shrink-0 ${
                currentUser.githubConnected
                  ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                  : 'bg-zinc-800 border border-white/10 text-zinc-400'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  currentUser.githubConnected ? 'bg-emerald-400' : 'bg-zinc-500'
                }`}
              />
              <span>
                {currentUser.githubConnected
                  ? L('Terhubung', 'Connected')
                  : L('Terputus', 'Disconnected')}
              </span>
            </span>
          </div>

          {/* Connected Identity Profile Box */}
          <div className="p-4 rounded-xl bg-zinc-950/90 border border-white/8 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <img
                src={currentUser.avatarUrl}
                alt={currentUser.username}
                className="w-11 h-11 rounded-full ring-2 ring-white/15 bg-zinc-800 shrink-0"
              />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white truncate">
                  {currentUser.displayName}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-zinc-400">
                  <span className="text-cyan-300">@{currentUser.username}</span>
                  {currentUser.email && (
                    <>
                      <span className="text-zinc-600">•</span>
                      <span className="truncate">{currentUser.email}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                copyValue(
                  'gh-handle',
                  `@${currentUser.username}`,
                  L('Handle GitHub', 'GitHub handle'),
                )
              }
              className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-400 hover:text-white transition cursor-pointer shrink-0"
              title={L('Salin handle GitHub', 'Copy GitHub handle')}
            >
              {copiedKey === 'gh-handle' ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          {/* Granted OAuth Scopes */}
          <div className="space-y-2">
            <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
              {L('Cakupan OAuth Terotorisasi', 'Authorized OAuth Scopes')}
            </div>
            <div className="space-y-2">
              {GITHUB_SCOPES.map((item) => (
                <div
                  key={item.scope}
                  className="px-3.5 py-2.5 rounded-xl bg-zinc-950/75 border border-white/[0.07] flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <code className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300">
                        {item.scope}
                      </code>
                      <span className="text-xs font-medium text-zinc-200 truncate">
                        {L(item.labelId, item.labelEn)}
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-500 mt-0.5 truncate">
                      {L(item.descId, item.descEn)}
                    </div>
                  </div>
                  <CheckCircle2
                    className={`w-4 h-4 shrink-0 ${
                      currentUser.githubConnected ? 'text-emerald-400' : 'text-zinc-700'
                    }`}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Action Footer */}
          <div className="pt-3 border-t border-white/8 flex flex-wrap items-center justify-between gap-2.5">
            {capabilities?.githubOAuthConfigured ? (
              <a
                href="/api/auth/github?intent=connect"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/12 text-xs font-semibold text-zinc-100 transition"
              >
                <GitHubIcon className="w-3.5 h-3.5" />
                <span>
                  {currentUser.githubConnected
                    ? L('Hubungkan Ulang GitHub OAuth', 'Reconnect GitHub OAuth')
                    : L('Hubungkan GitHub OAuth', 'Connect GitHub OAuth')}
                </span>
              </a>
            ) : (
              <span className="text-[11px] font-mono text-zinc-500">
                {L(
                  'Kredensial klien OAuth dikelola melalui .env',
                  'OAuth client credentials managed via .env',
                )}
              </span>
            )}

            <button
              type="button"
              onClick={() => onNavigateSection('repos')}
              className="inline-flex items-center gap-1 text-xs font-medium text-indigo-300 hover:text-indigo-200 cursor-pointer"
            >
              <span>{L('Periksa Repository', 'Inspect Repositories')}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right Card: Vercel Deployment Vault */}
        <div className="cp-panel rounded-2xl p-6 space-y-5 overflow-hidden">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-white/12 flex items-center justify-center shrink-0">
                <VercelIcon className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-white">
                  {L('Vault Deployment Vercel', 'Vercel Deployment Vault')}
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {L(
                    'Mengaktifkan provisi proyek langsung, sinkronisasi variabel env, dan deploy Edge 1-klik.',
                    'Enables direct project provisioning, env var syncing, and 1-click Edge deploys.',
                  )}
                </p>
              </div>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium shrink-0 ${
                currentUser.vercelConnected
                  ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                  : 'bg-zinc-800 border border-white/10 text-zinc-400'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  currentUser.vercelConnected ? 'bg-emerald-400' : 'bg-zinc-500'
                }`}
              />
              <span>
                {currentUser.vercelConnected
                  ? L('Terhubung', 'Linked')
                  : L('Belum Terhubung', 'Not Linked')}
              </span>
            </span>
          </div>

          {/* Active Encrypted Token Status Indicator */}
          {currentUser.vercelConnected && (
            <div className="px-4 py-3 rounded-xl bg-emerald-500/[0.07] border border-emerald-500/20 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-emerald-200 min-w-0">
                <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate">
                  {locale === 'id' ? (
                    <>
                      Token terenkripsi saat disimpan
                      {currentUser.vercelUsername ? (
                        <>
                          {' '}
                          untuk{' '}
                          <strong className="font-mono text-white">
                            @{currentUser.vercelUsername}
                          </strong>
                        </>
                      ) : null}
                    </>
                  ) : (
                    <>
                      Token encrypted at rest
                      {currentUser.vercelUsername ? (
                        <>
                          {' '}
                          for{' '}
                          <strong className="font-mono text-white">
                            @{currentUser.vercelUsername}
                          </strong>
                        </>
                      ) : null}
                    </>
                  )}
                </span>
              </div>
              <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 shrink-0">
                {L('API LANGSUNG SIAP', 'LIVE API READY')}
              </span>
            </div>
          )}

          {/* Saved Masked Token Display or Input / Rotation Form */}
          {currentUser.vercelConnected && !rotatingToken ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-300">
                  {L('Personal Access Token Vercel Tersimpan', 'Saved Vercel Personal Access Token')}
                </span>
                <span className="text-[10px] font-mono text-emerald-400">
                  {L('Tersimpan • AES-256-GCM', 'Stored • AES-256-GCM')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-emerald-500/25 flex items-center justify-between gap-2 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <KeyRound className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <code className="text-xs font-mono text-zinc-200 tracking-wider truncate">
                      {currentUser.vercelTokenPreview || '••••••••••••••••••••'}
                    </code>
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/12 text-emerald-300 shrink-0">
                    {L('Aktif', 'Active')}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setRotatingToken(true)}
                  className="px-3.5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/12 text-zinc-200 hover:text-white text-xs font-semibold transition cursor-pointer shrink-0"
                >
                  {L('Ganti Token', 'Rotate Token')}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleLinkVercelToken} className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-zinc-300">
                  {currentUser.vercelConnected
                    ? L('Ganti Personal Access Token Vercel', 'Replace Vercel Personal Access Token')
                    : L('Personal Access Token Vercel', 'Vercel Personal Access Token')}
                </label>
                <span className="text-[10px] font-mono text-zinc-500">
                  {L('Dienkripsi sebelum disimpan', 'Encrypted before save')}
                </span>
              </div>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <KeyRound className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={vercelToken}
                    onChange={(e) => setVercelToken(e.target.value)}
                    placeholder={
                      currentUser.vercelConnected
                        ? L('Tempel token baru untuk mengganti...', 'Paste a new token to replace...')
                        : L('Tempel token Vercel Anda...', 'Paste your Vercel token...')
                    }
                    className="w-full pl-8 pr-9 py-2.5 rounded-xl bg-zinc-950 border border-white/10 text-xs font-mono text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken((prev) => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-200 cursor-pointer"
                    title={
                      showToken
                        ? L('Sembunyikan token', 'Hide token')
                        : L('Tampilkan token', 'Show token')
                    }
                  >
                    {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={savingVercel || !vercelToken.trim()}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition cursor-pointer disabled:opacity-45 shrink-0"
                >
                  {savingVercel
                    ? L('Memverifikasi...', 'Verifying...')
                    : L('Simpan Token', 'Save Token')}
                </button>
                {currentUser.vercelConnected && (
                  <button
                    type="button"
                    onClick={() => {
                      setRotatingToken(false);
                      setVercelToken('');
                      setShowToken(false);
                    }}
                    className="px-3 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-400 hover:text-white text-xs font-medium transition cursor-pointer shrink-0"
                  >
                    {L('Batal', 'Cancel')}
                  </button>
                )}
              </div>
            </form>
          )}

          {/* Linked Cloud Projects */}
          {currentUser.vercelConnected && (
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
                  {L(
                    `Proyek Cloud Vercel (${vercelProjects.length})`,
                    `Cloud Vercel Projects (${vercelProjects.length})`,
                  )}
                </span>
                <button
                  type="button"
                  disabled={refreshingVercel}
                  onClick={() => void handleRefreshVercelProjects()}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-400 hover:text-white transition cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>
                    {refreshingVercel ? L('Menyinkronkan...', 'Syncing...') : L('Sinkronkan', 'Sync')}
                  </span>
                </button>
              </div>

              {!vercelProjectsLoaded || refreshingVercel ? (
                <VercelProjectsSkeleton count={3} />
              ) : vercelProjects.length === 0 ? (
                <div className="p-3.5 rounded-xl bg-zinc-950/75 border border-dashed border-white/10 text-xs text-zinc-500">
                  {locale === 'id' ? (
                    <>
                      Belum ada proyek cloud di token ini. Buka tab{' '}
                      <strong className="text-zinc-300">Deployment</strong> pada proyek mana saja
                      untuk membuatnya langsung dari CodePulse.
                    </>
                  ) : (
                    <>
                      No cloud projects on this token yet. Open any project&apos;s{' '}
                      <strong className="text-zinc-300">Deployments</strong> tab to provision one
                      directly from CodePulse.
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                  {vercelProjects.map((p) => (
                    <div
                      key={p.id}
                      className="px-3.5 py-2.5 rounded-xl bg-zinc-950/90 border border-white/8 hover:border-white/15 transition flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Globe className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span className="font-mono font-medium text-zinc-100 truncate">
                          {p.name}
                        </span>
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 shrink-0">
                          {p.framework || 'static'}
                        </span>
                      </div>
                      {p.latestUrl && (
                        <a
                          href={p.latestUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-300 hover:text-emerald-200 shrink-0"
                        >
                          <span>Live</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Smart Collapsible Setup Guide (Expanded by default only when not linked) */}
          <div className="pt-2 border-t border-white/8">
            <button
              type="button"
              onClick={() => setGuideExpanded((prev) => !prev)}
              className="w-full flex items-center justify-between text-xs font-medium text-zinc-400 hover:text-white transition cursor-pointer py-1"
            >
              <span className="inline-flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
                <span>
                  {L(
                    'Cara membuat atau merotasi Personal Access Token Vercel',
                    'How to create or rotate a Vercel Personal Access Token',
                  )}
                </span>
              </span>
              {guideExpanded ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
            {guideExpanded && (
              <div className="mt-2.5">
                <VercelTokenGuide compact />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Infrastructure & Runtime Security Details */}
      <div className="cp-panel rounded-2xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Database className="w-4 h-4 text-indigo-400" />
              <span>
                {L(
                  'Keamanan Runtime & Infrastruktur Webhook',
                  'Runtime Security & Webhook Infrastructure',
                )}
              </span>
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              {L(
                'Endpoint sisi server aktif dan transport signaling yang mendukung hub CodePulse Anda.',
                'Active server-side endpoints and signaling transports backing your CodePulse hub.',
              )}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-zinc-950/90 border border-white/8 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                <Webhook className="w-3.5 h-3.5 text-cyan-400" />
                <span>{L('Endpoint Webhook', 'Webhook Endpoint')}</span>
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/12 text-cyan-300">
                HMAC-SHA256
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <code className="flex-1 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-white/8 text-[11px] font-mono text-zinc-300 truncate">
                {webhookUrl}
              </code>
              <button
                type="button"
                onClick={() => copyValue('hook-url', webhookUrl, L('URL Webhook', 'Webhook URL'))}
                className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 cursor-pointer shrink-0"
                title={L('Salin URL webhook', 'Copy webhook URL')}
              >
                {copiedKey === 'hook-url' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              {L(
                'Setiap payload push/PR GitHub divalidasi terhadap tanda tangan raw body sebelum disinkronkan.',
                'Every GitHub push/PR payload is validated against raw body signatures before syncing.',
              )}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-zinc-950/90 border border-white/8 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>{L('Vault Tanpa Eksposur', 'Zero-Exposure Vault')}</span>
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/12 text-emerald-300">
                {L('KHUSUS SERVER', 'SERVER-ONLY')}
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              {locale === 'id' ? (
                <>
                  Token OAuth &amp; Vercel dienkripsi dengan AES-256-GCM sebelum disimpan ke{' '}
                  <strong className="text-zinc-200 uppercase">{capabilities?.mode || 'local'}</strong>{' '}
                  dan dihapus dari seluruh respons API publik.
                </>
              ) : (
                <>
                  OAuth &amp; Vercel tokens are encrypted via AES-256-GCM before persisting to{' '}
                  <strong className="text-zinc-200 uppercase">{capabilities?.mode || 'local'}</strong>{' '}
                  and are stripped from all public API responses.
                </>
              )}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-zinc-950/90 border border-white/8 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-indigo-400" />
                <span>{L('Signaling WebRTC', 'WebRTC Signaling')}</span>
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300">
                P2P 60 FPS
              </span>
            </div>
            <div className="space-y-1 text-[11px] font-mono text-zinc-400 max-h-16 overflow-y-auto">
              {(capabilities?.iceServers || [{ urls: 'stun:stun.l.google.com:19302' }]).map(
                (srv, idx) => (
                  <div key={idx} className="truncate">
                    {Array.isArray(srv.urls) ? srv.urls.join(', ') : srv.urls}
                  </div>
                ),
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

