import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  GitBranch,
  Link2,
  Lock,
  LogOut,
  Pencil,
  Save,
  Trash2,
  Users,
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

export type ProjectManageSubTab = 'team' | 'repo';

interface ProjectManageViewProps {
  workspace: Workspace;
  currentUser: PublicUser;
  capabilities: SystemCapabilities | null;
  activeSubTab: ProjectManageSubTab;
  onChangeSubTab: (tab: ProjectManageSubTab) => void;
  onWorkspaceUpdated: (ws: Workspace) => void;
  onWorkspaceDeleted: (workspaceId: string) => void;
  onInvitationsChanged?: () => void;
  onToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export function ProjectManageView({
  workspace,
  currentUser,
  capabilities,
  activeSubTab,
  onChangeSubTab,
  onWorkspaceUpdated,
  onWorkspaceDeleted,
  onInvitationsChanged,
  onToast,
}: ProjectManageViewProps) {
  const { L } = useLanguage();

  // Team: Leave Project (non-owner)
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [leavingProject, setLeavingProject] = useState(false);

  // Repo & Gatekeeper
  const [ghOwner, setGhOwner] = useState(workspace.githubOwner || '');
  const [ghRepo, setGhRepo] = useState(workspace.githubRepo || '');
  const [defaultBranch, setDefaultBranch] = useState(workspace.defaultBranch || 'main');
  const [enableProtection, setEnableProtection] = useState(workspace.branchProtected);
  const [ghRepos, setGhRepos] = useState<GitHubRepoItem[]>([]);
  const [savingRepo, setSavingRepo] = useState(false);

  // Project Name / Description / Delete (leader only)
  const [projectName, setProjectName] = useState(workspace.name);
  const [projectDescription, setProjectDescription] = useState(workspace.description || '');
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);
  const [copiedHandle, setCopiedHandle] = useState(false);

  const isLeader = isWorkspaceLeader(workspace, currentUser);
  const isOwner = workspace.ownerId === currentUser.id;
  const repoLinked = Boolean(workspace.githubOwner && workspace.githubRepo);
  const webhookUrl = `${window.location.origin}/api/webhooks/github`;

  useEffect(() => {
    let cancelled = false;
    if (currentUser.githubConnected && isLeader) {
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
  }, [currentUser.githubConnected, isLeader]);

  function copyMyHandle() {
    void navigator.clipboard.writeText(`@${currentUser.username}`);
    setCopiedHandle(true);
    onToast('info', L('Handle Anda disalin ke papan klip.', 'Your handle copied to clipboard.'));
    setTimeout(() => setCopiedHandle(false), 1800);
  }

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

  function copyWebhookUrl() {
    void navigator.clipboard.writeText(webhookUrl);
    onToast('info', L('URL Webhook disalin ke papan klip.', 'Webhook URL copied to clipboard.'));
  }

  async function handleSaveGeneral(e: React.FormEvent) {
    e.preventDefault();
    if (!isLeader) return;
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
    if (!isLeader) return;
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
      onWorkspaceDeleted(workspace.id);
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
      onWorkspaceDeleted(workspace.id);
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
      {/* Full-Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold text-white tracking-tight truncate">
              {L('Kelola Tim & Proyek', 'Team & Project Management')}
            </h1>
            <span
              className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-md border ${
                isLeader
                  ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/25'
                  : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/25'
              }`}
            >
              {isLeader ? L('Ketua Proyek', 'Project Lead') : L('Kontributor', 'Contributor')}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            {L(
              `Atur anggota tim, kirim undangan proyek, riwayat undangan, serta koneksi repository untuk ${workspace.name}.`,
              `Manage team members, send project invitations, invitation history, and repository links for ${workspace.name}.`,
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={copyMyHandle}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-xs font-mono text-zinc-300 transition cursor-pointer whitespace-nowrap"
            title={L(
              'Salin handle Anda',
              'Copy your handle',
            )}
          >
            {copiedHandle ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-zinc-400" />
            )}
            <span>@{currentUser.username}</span>
          </button>
        </div>
      </div>

      {/* Horizontal Underline Navigation Rail */}
      <div className="border-b border-white/[0.08]">
        <nav
          aria-label={L('Navigasi Kelola Proyek', 'Project Management Navigation')}
          className="flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar -mb-px"
        >
          <button
            type="button"
            onClick={() => onChangeSubTab('team')}
            className={`relative inline-flex items-center gap-2 px-3.5 sm:px-4 py-3 text-xs sm:text-sm font-medium whitespace-nowrap transition cursor-pointer ${
              activeSubTab === 'team' ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Users
              className={`w-4 h-4 ${activeSubTab === 'team' ? 'text-indigo-400' : 'text-zinc-500'}`}
            />
            <span>{L('Tim & Undangan', 'Team & Invitations')}</span>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-md border bg-indigo-500/12 border-indigo-500/25 text-indigo-300">
              {workspace.members.length}
            </span>
            {activeSubTab === 'team' && (
              <motion.span
                layoutId="project-manage-active-line"
                transition={{ type: 'spring', stiffness: 460, damping: 36 }}
                className="absolute left-0 right-0 bottom-0 h-[2px] rounded-full bg-gradient-to-r from-indigo-400 via-cyan-400 to-indigo-400"
              />
            )}
          </button>

          <button
            type="button"
            onClick={() => onChangeSubTab('repo')}
            className={`relative inline-flex items-center gap-2 px-3.5 sm:px-4 py-3 text-xs sm:text-sm font-medium whitespace-nowrap transition cursor-pointer ${
              activeSubTab === 'repo' ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <GitBranch
              className={`w-4 h-4 ${activeSubTab === 'repo' ? 'text-cyan-400' : 'text-zinc-500'}`}
            />
            <span>{L('Repository & Info Proyek', 'Repository & Project Info')}</span>
            <span
              className={`w-2 h-2 rounded-full ${
                repoLinked ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
            {activeSubTab === 'repo' && (
              <motion.span
                layoutId="project-manage-active-line"
                transition={{ type: 'spring', stiffness: 460, damping: 36 }}
                className="absolute left-0 right-0 bottom-0 h-[2px] rounded-full bg-gradient-to-r from-indigo-400 via-cyan-400 to-indigo-400"
              />
            )}
          </button>
        </nav>
      </div>

      {/* Dedicated Full-Width Tab Content */}
      <AnimatePresence mode="wait" initial={false}>
        {activeSubTab === 'team' ? (
          <motion.div
            key="manage-team"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16 }}
            className="space-y-5"
          >
            <TeamInvitationsCard
              key={workspace.id}
              workspace={workspace}
              currentUser={currentUser}
              onWorkspaceUpdated={onWorkspaceUpdated}
              onInvitationsChanged={onInvitationsChanged}
              onToast={onToast}
            />

            {/* Leave Project Card (Non-Owner Only) */}
            {!isOwner && (
              <div className="cp-panel rounded-2xl p-5 border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-amber-300 flex items-center gap-2">
                    <LogOut className="w-4 h-4" />
                    <span>{L('Keluar dari Proyek', 'Leave Project')}</span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed max-w-2xl">
                    {L(
                      `Keluar dari "${workspace.name}" akan menghapus proyek ini dari daftar workspace Anda. Tugas dan anggota tim lain tetap aman.`,
                      `Leaving "${workspace.name}" removes this project from your workspace list. Tasks and other team members remain unaffected.`,
                    )}
                  </p>
                </div>

                {!confirmingLeave ? (
                  <button
                    type="button"
                    onClick={() => setConfirmingLeave(true)}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-500/12 hover:bg-amber-500/20 border border-amber-500/35 text-amber-300 text-xs font-semibold transition cursor-pointer shrink-0"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>{L('Keluar Proyek', 'Leave Project')}</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={leavingProject}
                      onClick={() => void handleLeaveProject()}
                      className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold cursor-pointer disabled:opacity-45"
                    >
                      {leavingProject
                        ? L('Keluar...', 'Leaving...')
                        : L('Ya, Keluar Proyek', 'Yes, Leave Project')}
                    </button>
                    <button
                      type="button"
                      disabled={leavingProject}
                      onClick={() => setConfirmingLeave(false)}
                      className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-xs text-zinc-300 cursor-pointer"
                    >
                      {L('Batal', 'Cancel')}
                    </button>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="manage-repo"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16 }}
            className="grid grid-cols-1 xl:grid-cols-12 gap-6"
          >
            {/* Left: GitHub Repository & Webhook */}
            <div
              className={`cp-panel rounded-2xl p-6 space-y-5 ${
                isLeader ? 'xl:col-span-7' : 'xl:col-span-12'
              }`}
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-base font-semibold text-white flex items-center gap-2">
                    <GitHubIcon className="w-4 h-4" />
                    <span>
                      {L('Repository GitHub & Gatekeeper', 'GitHub Repository & Gatekeeper')}
                    </span>
                  </h2>
                  <p className="text-xs text-zinc-400 mt-1">
                    {L(
                      'Hubungkan repository dan aktifkan proteksi branch utama untuk workflow Gatekeeper.',
                      'Link a repository and enforce main branch protection for the Gatekeeper workflow.',
                    )}
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
                ) : null}
              </div>

              {isLeader && ghRepos.length > 0 && (
                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5">
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
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-white/10 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">
                      {L('-- Pilih repository --', '-- Select a repository --')}
                    </option>
                    {ghRepos.map((r) => (
                      <option key={r.id} value={r.fullName}>
                        {r.fullName} ({r.private ? L('privat', 'private') : L('publik', 'public')})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <form onSubmit={handleConnectRepo} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">
                      {L('Pemilik / Org GitHub', 'GitHub Owner / Org')}
                    </label>
                    <input
                      type="text"
                      required
                      disabled={!isLeader}
                      value={ghOwner}
                      onChange={(e) => setGhOwner(e.target.value)}
                      placeholder={L('username-github-anda', 'your-github-username')}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-white/10 text-xs font-mono text-white focus:outline-none focus:border-indigo-500 disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">
                      {L('Nama Repository', 'Repository Name')}
                    </label>
                    <input
                      type="text"
                      required
                      disabled={!isLeader}
                      value={ghRepo}
                      onChange={(e) => setGhRepo(e.target.value)}
                      placeholder={L('nama-repository-anda', 'your-repository')}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-white/10 text-xs font-mono text-white focus:outline-none focus:border-indigo-500 disabled:opacity-60"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-end">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">
                      {L('Branch Terproteksi', 'Protected Branch')}
                    </label>
                    <input
                      type="text"
                      disabled={!isLeader}
                      value={defaultBranch}
                      onChange={(e) => setDefaultBranch(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-white/10 text-xs font-mono text-white focus:outline-none focus:border-indigo-500 disabled:opacity-60"
                    />
                  </div>
                  <label
                    className={`inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-white/10 text-xs text-zinc-300 ${
                      isLeader ? 'cursor-pointer' : 'opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <input
                      type="checkbox"
                      disabled={!isLeader}
                      checked={enableProtection}
                      onChange={(e) => setEnableProtection(e.target.checked)}
                    />
                    <Lock className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{L('Kunci branch utama', 'Lock main branch')}</span>
                  </label>
                </div>

                {isLeader ? (
                  <button
                    type="submit"
                    disabled={savingRepo}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition cursor-pointer disabled:opacity-45"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    <span>
                      {savingRepo
                        ? L('Menghubungkan & Mengunci...', 'Linking & Locking...')
                        : L('Simpan Repo & Sinkronkan Gatekeeper', 'Save Repo & Sync Gatekeeper')}
                    </span>
                  </button>
                ) : (
                  <p className="text-xs text-zinc-500">
                    {L(
                      'Hanya Ketua Proyek yang dapat mengubah tautan repository dan proteksi branch.',
                      'Only Project Leaders can change repository link and branch protection settings.',
                    )}
                  </p>
                )}
              </form>

              <div className="pt-4 border-t border-white/10 space-y-2">
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
                  <code className="flex-1 px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-white/10 text-[11px] text-cyan-300 truncate">
                    {webhookUrl}
                  </code>
                  <button
                    type="button"
                    onClick={copyWebhookUrl}
                    className="p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 cursor-pointer shrink-0"
                    title={L('Salin URL', 'Copy URL')}
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Project Details & Danger Zone (Leader Only) */}
            {isLeader && (
              <div className="xl:col-span-5 cp-panel rounded-2xl p-6 space-y-5 flex flex-col justify-between">
                <div className="space-y-4">
                  <h2 className="text-base font-semibold text-white flex items-center gap-2">
                    <Pencil className="w-4 h-4 text-indigo-400" />
                    <span>{L('Detail Proyek', 'Project Details')}</span>
                  </h2>

                  <form onSubmit={handleSaveGeneral} className="space-y-3.5">
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1.5">
                        {L('Nama Proyek', 'Project Name')}
                      </label>
                      <input
                        type="text"
                        required
                        minLength={2}
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-white/10 text-xs text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1.5">
                        {L('Deskripsi Singkat', 'Short Description')}
                      </label>
                      <textarea
                        rows={3}
                        value={projectDescription}
                        onChange={(e) => setProjectDescription(e.target.value)}
                        placeholder={L('Deskripsi proyek...', 'Project description...')}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-white/10 text-xs text-white focus:outline-none focus:border-indigo-500 resize-none"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={savingGeneral}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 text-xs font-semibold transition cursor-pointer disabled:opacity-45"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>
                        {savingGeneral
                          ? L('Menyimpan...', 'Saving...')
                          : L('Simpan Perubahan', 'Save Changes')}
                      </span>
                    </button>
                  </form>
                </div>

                <div className="pt-5 border-t border-white/10 space-y-3">
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-rose-300 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>{L('Zona Berbahaya — Hapus Proyek', 'Danger Zone — Delete Project')}</span>
                    </div>
                    <p className="text-[11px] text-zinc-500 leading-relaxed">
                      {L(
                        'Menghapus workspace & tugas di CodePulse secara permanen (repository GitHub tetap aman).',
                        'Permanently deletes this workspace & tasks in CodePulse (GitHub repository stays safe).',
                      )}
                    </p>
                  </div>

                  {!confirmingDelete ? (
                    <button
                      type="button"
                      onClick={() => setConfirmingDelete(true)}
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500/12 hover:bg-rose-500/20 border border-rose-500/35 text-rose-300 text-xs font-semibold transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{L('Hapus Proyek', 'Delete Project')}</span>
                    </button>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={deletingProject}
                        onClick={() => void handleDeleteProject()}
                        className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold cursor-pointer disabled:opacity-45"
                      >
                        {deletingProject
                          ? L('Menghapus...', 'Deleting...')
                          : L('Ya, Hapus Permanen', 'Yes, Delete Permanently')}
                      </button>
                      <button
                        type="button"
                        disabled={deletingProject}
                        onClick={() => setConfirmingDelete(false)}
                        className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-xs text-zinc-300 cursor-pointer"
                      >
                        {L('Batal', 'Cancel')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

