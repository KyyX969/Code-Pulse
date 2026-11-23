import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Database,
  KeyRound,
  Link2,
  Lock,
  LogOut,
  Pencil,
  Save,
  Trash2,
  Webhook,
} from 'lucide-react';
import { isWorkspaceLeader } from '../../shared/permissions.ts';
import type {
  GitHubRepoItem,
  PublicUser,
  SystemCapabilities,
  Workspace,
} from '../../shared/types.ts';
import { api } from '../lib/api.ts';
import { useLanguage } from '../lib/i18nContext.ts';
import { GitHubIcon } from './GitHubIcon.tsx';
import { TeamInvitationsCard } from './TeamInvitationsCard.tsx';
import { VercelDeployConfigurator } from './VercelDeployConfigurator.tsx';
import { VercelIcon } from './VercelIcon.tsx';

interface SettingsPanelProps {
  workspace: Workspace;
  currentUser: PublicUser;
  capabilities: SystemCapabilities | null;
  onWorkspaceUpdated: (ws: Workspace) => void;
  onWorkspaceDeleted?: (workspaceId: string) => void;
  onUserUpdated: (user: PublicUser) => void;
  onToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export function SettingsPanel({
  workspace,
  currentUser,
  capabilities,
  onWorkspaceUpdated,
  onWorkspaceDeleted,
  onUserUpdated,
  onToast,
}: SettingsPanelProps) {
  const { L } = useLanguage();
  const [projectName, setProjectName] = useState(workspace.name);
  const [projectDescription, setProjectDescription] = useState(workspace.description || '');
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [leavingProject, setLeavingProject] = useState(false);

  const [ghOwner, setGhOwner] = useState(workspace.githubOwner || '');
  const [ghRepo, setGhRepo] = useState(workspace.githubRepo || '');
  const [defaultBranch, setDefaultBranch] = useState(workspace.defaultBranch || 'main');
  const [enableProtection, setEnableProtection] = useState(workspace.branchProtected);
  const [ghRepos, setGhRepos] = useState<GitHubRepoItem[]>([]);
  const [savingRepo, setSavingRepo] = useState(false);

  const [vercelTokenInput, setVercelTokenInput] = useState('');
  const [editingVercelToken, setEditingVercelToken] = useState(false);
  const [savingVercel, setSavingVercel] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (currentUser.githubConnected) {
      api
        .listGitHubRepos()
        .then((res) => {
          if (!cancelled) setGhRepos(res.repos);
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [currentUser.githubConnected]);

  const isLeader = isWorkspaceLeader(workspace, currentUser);
  const isOwner = workspace.ownerId === currentUser.id;
  const webhookUrl = `${window.location.origin}/api/webhooks/github`;

  async function handleConnectRepo(e: React.FormEvent) {
    e.preventDefault();
    if (!isLeader) {
      onToast(
        'error',
        L(
          'Hanya Ketua Proyek yang dapat menghubungkan atau memproteksi repository.',
          'Only Project Leader can connect or protect repositories.',
        ),
      );
      return;
    }
    setSavingRepo(true);
    try {
      const matched = ghRepos.find(
        (r) =>
          r.owner.toLowerCase() === ghOwner.trim().toLowerCase() &&
          r.name.toLowerCase() === ghRepo.trim().toLowerCase(),
      );
      const res = await api.connectGitHubRepo(workspace.id, {
        owner: ghOwner.trim(),
        repo: ghRepo.trim(),
        repoId: matched?.id,
        defaultBranch: defaultBranch.trim() || 'main',
        enableProtection,
      });
      onWorkspaceUpdated(res.workspace);
      onToast(
        'success',
        res.notices[0] ||
          L(
            'Repository GitHub terhubung & terproteksi!',
            'GitHub repository connected & protected!',
          ),
      );
    } catch (err) {
      onToast(
        'error',
        err instanceof Error
          ? err.message
          : L('Gagal menghubungkan repository', 'Failed to connect repo'),
      );
    } finally {
      setSavingRepo(false);
    }
  }

  async function handleLinkVercelToken(e: React.FormEvent) {
    e.preventDefault();
    if (!vercelTokenInput.trim()) return;
    setSavingVercel(true);
    try {
      const { user } = await api.linkVercelToken(vercelTokenInput.trim());
      onUserUpdated(user);
      setVercelTokenInput('');
      setEditingVercelToken(false);
      onToast(
        'success',
        L(
          'Akun Vercel terhubung (token dienkripsi AES-256-GCM saat disimpan).',
          'Vercel account linked (token encrypted AES-256-GCM at rest).',
        ),
      );
    } catch (err) {
      onToast(
        'error',
        err instanceof Error
          ? err.message
          : L('Gagal memverifikasi Token Vercel', 'Failed to verify Vercel token'),
      );
    } finally {
      setSavingVercel(false);
    }
  }

  function copyWebhookUrl() {
    void navigator.clipboard.writeText(webhookUrl);
    onToast('info', L('URL Webhook disalin ke clipboard.', 'Webhook URL copied to clipboard.'));
  }

  async function handleSaveGeneral(e: React.FormEvent) {
    e.preventDefault();
    if (!isLeader) {
      onToast(
        'error',
        L(
          'Hanya Ketua Proyek yang dapat mengedit detail proyek.',
          'Only Project Leader can edit project details.',
        ),
      );
      return;
    }
    if (projectName.trim().length < 2) {
      onToast(
        'error',
        L('Nama proyek minimal 2 karakter.', 'Project name must be at least 2 characters.'),
      );
      return;
    }
    setSavingGeneral(true);
    try {
      const { workspace: updated } = await api.updateWorkspace(workspace.id, {
        name: projectName.trim(),
        description: projectDescription.trim(),
      });
      onWorkspaceUpdated(updated);
      onToast('success', L('Detail proyek diperbarui.', 'Project details updated.'));
    } catch (err) {
      onToast(
        'error',
        err instanceof Error
          ? err.message
          : L('Gagal memperbarui detail proyek', 'Failed to update project details'),
      );
    } finally {
      setSavingGeneral(false);
    }
  }

  async function handleDeleteProject() {
    if (!isLeader) {
      onToast(
        'error',
        L(
          'Hanya Ketua Proyek yang dapat menghapus proyek ini.',
          'Only Project Leader can delete this project.',
        ),
      );
      return;
    }
    setDeletingProject(true);
    try {
      await api.deleteWorkspace(workspace.id);
      onToast(
        'info',
        L(
          `Proyek "${workspace.name}" dihapus dari CodePulse.`,
          `Project "${workspace.name}" deleted from CodePulse.`,
        ),
      );
      onWorkspaceDeleted?.(workspace.id);
    } catch (err) {
      onToast(
        'error',
        err instanceof Error ? err.message : L('Gagal menghapus proyek', 'Failed to delete project'),
      );
      setDeletingProject(false);
    }
  }

  async function handleLeaveProject() {
    if (isOwner) return;
    setLeavingProject(true);
    try {
      await api.leaveWorkspace(workspace.id);
      onToast(
        'info',
        L(
          `Anda telah keluar dari proyek "${workspace.name}".`,
          `You have left project "${workspace.name}".`,
        ),
      );
      onWorkspaceDeleted?.(workspace.id);
    } catch (err) {
      onToast(
        'error',
        err instanceof Error
          ? err.message
          : L('Gagal keluar dari proyek', 'Failed to leave project'),
      );
      setLeavingProject(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Infrastructure / Supabase Readiness Banner */}
      <div className="cp-panel rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={`p-2.5 rounded-xl border ${
              capabilities?.mode === 'supabase'
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                : 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300'
            }`}
          >
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">
              {capabilities?.mode === 'supabase'
                ? L('Supabase PostgreSQL & Realtime Aktif', 'Supabase PostgreSQL & Realtime Active')
                : L(
                    'Penyimpanan JSON Lokal Aktif (Siap Supabase)',
                    'Local JSON Store Active (Supabase Ready)',
                  )}
            </div>
            <div className="text-xs text-zinc-400">
              {capabilities?.mode === 'supabase'
                ? L(
                    'Semua tugas, token terenkripsi, audit webhook, dan sesi langsung tersimpan di Supabase.',
                    'All tasks, encrypted tokens, webhook audits, and live sessions persist to Supabase.',
                  )
                : L(
                    'Jalankan supabase/schema.sql di Supabase dan isi SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY di .env untuk beralih otomatis.',
                    'Run supabase/schema.sql in Supabase and fill SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env to switch automatically.',
                  )}
            </div>
          </div>
        </div>
        <span className="font-mono text-[11px] px-2.5 py-1 rounded-lg bg-zinc-950 border border-white/10 text-zinc-300">
          {L('Vault Token AES-256-GCM', 'AES-256-GCM Token Vault')}
        </span>
      </div>

      {/* Team Members & Invitations */}
      <TeamInvitationsCard
        key={workspace.id}
        workspace={workspace}
        currentUser={currentUser}
        onWorkspaceUpdated={onWorkspaceUpdated}
        onToast={onToast}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* GitHub Integration */}
        <div className="cp-panel rounded-2xl p-6 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <GitHubIcon className="w-4 h-4" />
                <span>{L('Repository GitHub & Gatekeeper', 'GitHub Repository & Gatekeeper')}</span>
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                {L(
                  'Hubungkan repository dan terapkan proteksi branch pada ',
                  'Link repository and enforce branch protection on ',
                )}
                <code>main</code>
                {L(' melalui Octokit.', ' via Octokit.')}
              </p>
            </div>
            {currentUser.githubConnected ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 text-[11px] font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {L('GitHub Terhubung', 'GitHub Connected')}
              </span>
            ) : capabilities?.githubOAuthConfigured ? (
              <a
                href="/api/auth/github?intent=connect"
                className="px-3 py-1.5 rounded-lg bg-white text-zinc-950 text-xs font-semibold hover:bg-zinc-200 transition"
              >
                {L('Hubungkan OAuth GitHub', 'Connect GitHub OAuth')}
              </a>
            ) : (
              <span className="px-2 py-1 rounded-md bg-zinc-800 text-zinc-400 text-[11px] font-mono">
                {L('Env OAuth Belum Diatur', 'OAuth Env Unset')}
              </span>
            )}
          </div>

          {ghRepos.length > 0 && (
            <div>
              <label className="block text-xs text-zinc-400 mb-1">
                {L(
                  'Pilih Cepat dari Repository GitHub Anda',
                  'Quick Pick from Your GitHub Repositories',
                )}
              </label>
              <select
                onChange={(e) => {
                  const selected = ghRepos.find((r) => r.fullName === e.target.value);
                  if (selected) {
                    setGhOwner(selected.owner);
                    setGhRepo(selected.name);
                    setDefaultBranch(selected.defaultBranch);
                  }
                }}
                className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-white/10 text-xs text-zinc-200"
              >
                <option value="">{L('-- Pilih repository --', '-- Select a repository --')}</option>
                {ghRepos.map((r) => (
                  <option key={r.id} value={r.fullName}>
                    {r.fullName} ({r.private ? L('privat', 'private') : L('publik', 'public')})
                  </option>
                ))}
              </select>
            </div>
          )}

          <form onSubmit={handleConnectRepo} className="space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  {L('Pemilik / Org GitHub', 'GitHub Owner / Org')}
                </label>
                <input
                  type="text"
                  required
                  value={ghOwner}
                  onChange={(e) => setGhOwner(e.target.value)}
                  placeholder={L('username-github-anda', 'your-github-username')}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-white/10 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  {L('Nama Repository', 'Repository Name')}
                </label>
                <input
                  type="text"
                  required
                  value={ghRepo}
                  onChange={(e) => setGhRepo(e.target.value)}
                  placeholder={L('nama-repository-anda', 'your-repository')}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-white/10 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 items-end">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  {L('Branch Terproteksi', 'Protected Branch')}
                </label>
                <input
                  type="text"
                  value={defaultBranch}
                  onChange={(e) => setDefaultBranch(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-white/10 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-950 border border-white/10 text-xs text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableProtection}
                  onChange={(e) => setEnableProtection(e.target.checked)}
                />
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                <span>{L('Kunci branch main', 'Lock main branch')}</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={savingRepo || !isLeader}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition cursor-pointer disabled:opacity-45"
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>
                {savingRepo
                  ? L('Menghubungkan & Mengunci...', 'Linking & Locking...')
                  : L('Hubungkan Repo & Sinkronkan Gatekeeper', 'Connect Repo & Sync Gatekeeper')}
              </span>
            </button>
          </form>

          <div className="pt-3 border-t border-white/10 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-300">
              <Webhook className="w-3.5 h-3.5 text-cyan-400" />
              <span>
                {L(
                  'Endpoint Webhook GitHub (push & pull_request)',
                  'GitHub Webhook Endpoint (push & pull_request)',
                )}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 rounded-xl bg-zinc-950 border border-white/10 text-[11px] text-cyan-300 truncate">
                {webhookUrl}
              </code>
              <button
                type="button"
                onClick={copyWebhookUrl}
                className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 cursor-pointer"
                title={L('Salin URL', 'Copy URL')}
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Vercel Integration */}
        <div className="cp-panel rounded-2xl p-6 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <VercelIcon className="w-3.5 h-3.5 text-white" />
                <span>{L('Akun Vercel & Auto-Deploy', 'Vercel Account & Auto-Deploy')}</span>
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                {L(
                  'Token OAuth dienkripsi dengan AES-256-GCM sebelum disimpan.',
                  'OAuth tokens are encrypted with AES-256-GCM before storage.',
                )}
              </p>
            </div>
            {currentUser.vercelConnected ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 text-[11px] font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {L('Vercel Terhubung', 'Vercel Linked')}
              </span>
            ) : capabilities?.vercelOAuthConfigured ? (
              <a
                href="/api/auth/vercel"
                className="px-3 py-1.5 rounded-lg bg-white text-zinc-950 text-xs font-semibold hover:bg-zinc-200 transition"
              >
                {L('Hubungkan OAuth Vercel', 'Connect Vercel OAuth')}
              </a>
            ) : null}
          </div>

          {currentUser.vercelConnected && (
            !editingVercelToken ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400">
                    {L('Vercel Personal Access Token Tersimpan', 'Saved Vercel Personal Access Token')}
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400">
                    {L('Aktif • Terenkripsi', 'Active • Encrypted')}
                  </span>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 px-3 py-2 rounded-xl bg-zinc-950 border border-emerald-500/25 flex items-center gap-2 min-w-0">
                    <KeyRound className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <code className="text-xs font-mono text-zinc-200 tracking-wider truncate">
                      {currentUser.vercelTokenPreview || '••••••••••••••••••••'}
                    </code>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingVercelToken(true)}
                    className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-semibold cursor-pointer shrink-0"
                  >
                    {L('Ganti Token', 'Change Token')}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleLinkVercelToken} className="space-y-2">
                <label className="block text-xs text-zinc-400">
                  {L('Perbarui Vercel Personal Access Token', 'Update Vercel Personal Access Token')}
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <KeyRound className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      value={vercelTokenInput}
                      onChange={(e) => setVercelTokenInput(e.target.value)}
                      placeholder={L(
                        'Tempel Token Vercel baru untuk mengganti...',
                        'Paste new Vercel token to replace...',
                      )}
                      className="w-full pl-8 pr-3 py-2 rounded-xl bg-zinc-950 border border-white/10 text-xs font-mono text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={savingVercel || !vercelTokenInput.trim()}
                    className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer disabled:opacity-45"
                  >
                    {savingVercel ? L('Menyimpan...', 'Saving...') : L('Simpan', 'Save')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingVercelToken(false);
                      setVercelTokenInput('');
                    }}
                    className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-400 hover:text-white text-xs cursor-pointer"
                  >
                    {L('Batal', 'Cancel')}
                  </button>
                </div>
              </form>
            )
          )}

          <div className="pt-2 border-t border-white/10">
            <VercelDeployConfigurator
              key={workspace.id}
              workspace={workspace}
              currentUser={currentUser}
              onWorkspaceUpdated={onWorkspaceUpdated}
              onUserUpdated={onUserUpdated}
              onToast={onToast}
            />
          </div>

          <div className="pt-3 border-t border-white/10 text-[11px] text-zinc-400 space-y-1">
            <div className="font-semibold text-zinc-300">
              {L('WebRTC ICE / STUN / TURN Aktif', 'Active WebRTC ICE / STUN / TURN')}
            </div>
            <div className="font-mono text-zinc-500">
              {capabilities?.iceServers.map((s, idx) => (
                <div key={idx}>
                  {Array.isArray(s.urls) ? s.urls.join(', ') : s.urls}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* General Project Details & Danger Zone */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form
          onSubmit={handleSaveGeneral}
          className="lg:col-span-7 cp-panel rounded-2xl p-6 space-y-4"
        >
          <div>
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Pencil className="w-4 h-4 text-indigo-400" />
              <span>{L('Detail Umum Proyek', 'General Project Details')}</span>
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              {L(
                'Ubah nama workspace ini atau perbarui deskripsi yang tampil di seluruh Console Hub.',
                'Rename this workspace or update its description shown across Console Hub.',
              )}
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">
                {L('Nama Proyek', 'Project Name')}
              </label>
              <input
                type="text"
                required
                minLength={2}
                disabled={!isLeader || savingGeneral}
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-white/10 text-xs text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">
                {L('Deskripsi', 'Description')}
              </label>
              <textarea
                rows={2}
                disabled={!isLeader || savingGeneral}
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                placeholder={L(
                  'Jelaskan ruang lingkup proyek atau target tim...',
                  'Describe the project scope or squad goals...',
                )}
                className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-white/10 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 resize-none disabled:opacity-50"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={!isLeader || savingGeneral || projectName.trim().length < 2}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition cursor-pointer disabled:opacity-45"
          >
            <Save className="w-3.5 h-3.5" />
            <span>
              {savingGeneral
                ? L('Menyimpan...', 'Saving...')
                : L('Simpan Detail Proyek', 'Save Project Details')}
            </span>
          </button>
        </form>

        <div
          className={`lg:col-span-5 cp-panel rounded-2xl p-6 border flex flex-col justify-between gap-4 ${
            !isOwner && !isLeader ? 'border-amber-500/25' : 'border-rose-500/25'
          }`}
        >
          {isLeader ? (
            <>
              <div className="space-y-2">
                <h3 className="text-base font-semibold text-rose-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  <span>{L('Zona Berbahaya', 'Danger Zone')}</span>
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  {L('Menghapus ', 'Deleting ')}
                  <strong className="text-zinc-200">{workspace.name}</strong>{' '}
                  {L(
                    'akan menghapus Papan Kanban, log Gatekeeper, riwayat deployment, dan undangan dari CodePulse. Repository GitHub dan proyek Vercel Anda tetap aman tidak tersentuh.',
                    'removes its Kanban board, Gatekeeper logs, deployment history, and invitations from CodePulse. Your GitHub repository and Vercel project remain untouched.',
                  )}
                </p>
              </div>

              {!confirmingDelete ? (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500/12 hover:bg-rose-500/20 border border-rose-500/35 text-rose-300 text-xs font-semibold transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{L('Hapus Workspace Proyek', 'Delete Project Workspace')}</span>
                  </button>
                  {!isOwner && (
                    <button
                      type="button"
                      onClick={() => setConfirmingLeave(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/12 hover:bg-amber-500/20 border border-amber-500/35 text-amber-300 text-xs font-semibold transition cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>{L('Keluar dari Proyek', 'Leave Project')}</span>
                    </button>
                  )}
                </div>
              ) : (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-2.5">
              <div className="text-xs text-rose-200 font-medium">
                {L(
                  `Konfirmasi penghapusan permanen “${workspace.name}”?`,
                  `Confirm permanently deleting “${workspace.name}”?`,
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={deletingProject}
                  onClick={() => void handleDeleteProject()}
                  className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold cursor-pointer disabled:opacity-45"
                >
                  {deletingProject
                    ? L('Menghapus...', 'Deleting...')
                    : L('Ya, Hapus Permanen', 'Yes, Delete Permanently')}
                </button>
                <button
                  type="button"
                  disabled={deletingProject}
                  onClick={() => setConfirmingDelete(false)}
                  className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-xs text-zinc-300 cursor-pointer"
                >
                  {L('Batal', 'Cancel')}
                </button>
              </div>
            </div>
          )}

              {!isOwner && confirmingLeave && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2.5">
                  <div className="text-xs text-amber-200 font-medium">
                    {L(
                      `Keluar dari workspace "${workspace.name}"?`,
                      `Leave workspace "${workspace.name}"?`,
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={leavingProject}
                      onClick={() => void handleLeaveProject()}
                      className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold cursor-pointer disabled:opacity-45"
                    >
                      {leavingProject
                        ? L('Keluar...', 'Leaving...')
                        : L('Ya, Keluar Proyek', 'Yes, Leave Project')}
                    </button>
                    <button
                      type="button"
                      disabled={leavingProject}
                      onClick={() => setConfirmingLeave(false)}
                      className="px-3.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-xs text-zinc-300 cursor-pointer"
                    >
                      {L('Batal', 'Cancel')}
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="space-y-2">
                <h3 className="text-base font-semibold text-amber-300 flex items-center gap-2">
                  <LogOut className="w-4 h-4" />
                  <span>{L('Keluar dari Proyek', 'Leave Project')}</span>
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  {L('Keluar dari ', 'Leaving ')}
                  <strong className="text-zinc-200">{workspace.name}</strong>{' '}
                  {L(
                    'akan menghapus proyek ini dari daftar workspace Anda. Proyek, tugas, dan anggota lain tetap aman — Anda dapat bergabung kembali nanti lewat undangan baru.',
                    'removes this project from your workspace list. The project, tasks, and other members remain untouched — you can rejoin later with a new invite.',
                  )}
                </p>
              </div>

              {!confirmingLeave ? (
                <div>
                  <button
                    type="button"
                    onClick={() => setConfirmingLeave(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/12 hover:bg-amber-500/20 border border-amber-500/35 text-amber-300 text-xs font-semibold transition cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>{L('Keluar dari Proyek', 'Leave Project')}</span>
                  </button>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2.5">
                  <div className="text-xs text-amber-200 font-medium">
                    {L(
                      `Konfirmasi keluar dari "${workspace.name}"?`,
                      `Confirm leaving "${workspace.name}"?`,
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={leavingProject}
                      onClick={() => void handleLeaveProject()}
                      className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold cursor-pointer disabled:opacity-45"
                    >
                      {leavingProject
                        ? L('Keluar...', 'Leaving...')
                        : L('Ya, Keluar Proyek', 'Yes, Leave Project')}
                    </button>
                    <button
                      type="button"
                      disabled={leavingProject}
                      onClick={() => setConfirmingLeave(false)}
                      className="px-3.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-xs text-zinc-300 cursor-pointer"
                    >
                      {L('Batal', 'Cancel')}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
