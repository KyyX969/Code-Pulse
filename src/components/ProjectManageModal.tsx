import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  GitBranch,
  Link2,
  Lock,
  LogOut,
  Pencil,
  Save,
  SlidersHorizontal,
  Trash2,
  Users,
  Webhook,
  X,
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

export type ProjectManageTab = 'team' | 'repo';

interface ProjectManageModalProps {
  workspace: Workspace;
  currentUser: PublicUser;
  capabilities: SystemCapabilities | null;
  initialTab: ProjectManageTab;
  onClose: () => void;
  onWorkspaceUpdated: (ws: Workspace) => void;
  onWorkspaceDeleted: (workspaceId: string) => void;
  onToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export function ProjectManageModal({
  workspace,
  currentUser,
  capabilities,
  initialTab,
  onClose,
  onWorkspaceUpdated,
  onWorkspaceDeleted,
  onToast,
}: ProjectManageModalProps) {
  const { L } = useLanguage();
  const [activeTab, setActiveTab] = useState<ProjectManageTab>(initialTab);

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

  const isLeader = isWorkspaceLeader(workspace, currentUser);
  const isOwner = workspace.ownerId === currentUser.id;
  const repoLinked = Boolean(workspace.githubOwner && workspace.githubRepo);
  const webhookUrl = `${window.location.origin}/api/webhooks/github`;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

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
    onToast('info', L('URL Webhook disalin ke clipboard.', 'Webhook URL copied to clipboard.'));
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
      onClose();
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
      onClose();
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
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[88vh] flex flex-col rounded-2xl bg-[#0d0f17] border border-white/12 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-white/[0.08] flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center text-indigo-300 shrink-0">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-semibold text-white truncate">{workspace.name}</h2>
                <span
                  className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-md ${
                    isLeader
                      ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/25'
                      : 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/25'
                  }`}
                >
                  {isLeader ? L('Ketua Proyek', 'Project Lead') : L('Kontributor', 'Contributor')}
                </span>
              </div>
              <p className="text-xs text-zinc-400 truncate mt-0.5">
                {L(
                  'Kelola tim, undangan anggota, repository GitHub, dan detail proyek.',
                  'Manage team members, invitations, GitHub repository, and project details.',
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/[0.06] transition cursor-pointer shrink-0"
            aria-label={L('Tutup', 'Close')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Underline Tab Bar */}
        <div className="px-5 sm:px-6 border-b border-white/[0.08] flex items-center gap-6 shrink-0 bg-zinc-950/40">
          <button
            type="button"
            onClick={() => setActiveTab('team')}
            className={`relative py-3 inline-flex items-center gap-2 text-xs font-medium transition cursor-pointer ${
              activeTab === 'team' ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-indigo-400" />
            <span>{L('Tim & Undangan', 'Team & Invitations')}</span>
            <span className="px-1.5 py-0.5 rounded-md bg-white/[0.06] text-[10px] font-mono text-zinc-300">
              {workspace.members.length}
            </span>
            {activeTab === 'team' && (
              <span className="absolute bottom-0 inset-x-0 h-0.5 rounded-full bg-indigo-500" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('repo')}
            className={`relative py-3 inline-flex items-center gap-2 text-xs font-medium transition cursor-pointer ${
              activeTab === 'repo' ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <GitBranch className="w-3.5 h-3.5 text-cyan-400" />
            <span>{L('Repository & Info Proyek', 'Repository & Project Info')}</span>
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                repoLinked ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
            {activeTab === 'repo' && (
              <span className="absolute bottom-0 inset-x-0 h-0.5 rounded-full bg-indigo-500" />
            )}
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {activeTab === 'team' ? (
            <>
              <TeamInvitationsCard
                key={workspace.id}
                workspace={workspace}
                currentUser={currentUser}
                onWorkspaceUpdated={onWorkspaceUpdated}
                onToast={onToast}
              />

              {/* Leave Project (Non-Owner Only) */}
              {!isOwner && (
                <div className="rounded-2xl p-4 sm:p-5 bg-zinc-950/75 border border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                      <LogOut className="w-3.5 h-3.5" />
                      <span>{L('Keluar dari Proyek', 'Leave Project')}</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      {L(
                        'Menghapus proyek ini dari daftar workspace Anda tanpa memengaruhi anggota tim lain.',
                        'Removes this project from your workspace list without affecting other team members.',
                      )}
                    </p>
                  </div>

                  {!confirmingLeave ? (
                    <button
                      type="button"
                      onClick={() => setConfirmingLeave(true)}
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500/12 hover:bg-amber-500/20 border border-amber-500/35 text-amber-300 text-xs font-semibold transition cursor-pointer shrink-0"
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
                        className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold cursor-pointer disabled:opacity-45"
                      >
                        {leavingProject
                          ? L('Keluar...', 'Leaving...')
                          : L('Ya, Keluar', 'Yes, Leave')}
                      </button>
                      <button
                        type="button"
                        disabled={leavingProject}
                        onClick={() => setConfirmingLeave(false)}
                        className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-xs text-zinc-300 cursor-pointer"
                      >
                        {L('Batal', 'Cancel')}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              {/* GitHub Repository & Webhook Card */}
              <div className="rounded-2xl p-5 bg-zinc-950/75 border border-white/10 space-y-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <GitHubIcon className="w-4 h-4" />
                      <span>{L('Repository GitHub & Gatekeeper', 'GitHub Repository & Gatekeeper')}</span>
                    </h3>
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
                      className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-white/10 text-xs text-zinc-200"
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

                <form onSubmit={handleConnectRepo} className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">
                        {L('Pemilik / Org GitHub', 'GitHub Owner / Org')}
                      </label>
                      <input
                        type="text"
                        required
                        disabled={!isLeader}
                        value={ghOwner}
                        onChange={(e) => setGhOwner(e.target.value)}
                        placeholder={L('username-github-anda', 'your-github-username')}
                        className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-white/10 text-xs font-mono text-white focus:outline-none focus:border-indigo-500 disabled:opacity-60"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">
                        {L('Nama Repository', 'Repository Name')}
                      </label>
                      <input
                        type="text"
                        required
                        disabled={!isLeader}
                        value={ghRepo}
                        onChange={(e) => setGhRepo(e.target.value)}
                        placeholder={L('nama-repository-anda', 'your-repository')}
                        className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-white/10 text-xs font-mono text-white focus:outline-none focus:border-indigo-500 disabled:opacity-60"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">
                        {L('Branch Terproteksi', 'Protected Branch')}
                      </label>
                      <input
                        type="text"
                        disabled={!isLeader}
                        value={defaultBranch}
                        onChange={(e) => setDefaultBranch(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-white/10 text-xs font-mono text-white focus:outline-none focus:border-indigo-500 disabled:opacity-60"
                      />
                    </div>
                    <label
                      className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-900 border border-white/10 text-xs text-zinc-300 ${
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
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition cursor-pointer disabled:opacity-45"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      <span>
                        {savingRepo
                          ? L('Menghubungkan & Mengunci...', 'Linking & Locking...')
                          : L('Simpan Repo & Sinkronkan Gatekeeper', 'Save Repo & Sync Gatekeeper')}
                      </span>
                    </button>
                  ) : (
                    <p className="text-[11px] text-zinc-500">
                      {L(
                        'Hanya Ketua Proyek yang dapat mengubah tautan repository dan proteksi branch.',
                        'Only Project Leaders can change repository link and branch protection settings.',
                      )}
                    </p>
                  )}
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
                    <code className="flex-1 px-3 py-2 rounded-xl bg-zinc-900 border border-white/10 text-[11px] text-cyan-300 truncate">
                      {webhookUrl}
                    </code>
                    <button
                      type="button"
                      onClick={copyWebhookUrl}
                      className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 cursor-pointer shrink-0"
                      title={L('Salin URL', 'Copy URL')}
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Project Details & Danger Zone (Leader Only) */}
              {isLeader && (
                <div className="rounded-2xl p-5 bg-zinc-950/75 border border-white/10 space-y-4">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Pencil className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{L('Detail Proyek', 'Project Details')}</span>
                  </h3>

                  <form onSubmit={handleSaveGeneral} className="space-y-3">
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">
                        {L('Nama Proyek', 'Project Name')}
                      </label>
                      <input
                        type="text"
                        required
                        minLength={2}
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-white/10 text-xs text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">
                        {L('Deskripsi Singkat', 'Short Description')}
                      </label>
                      <textarea
                        rows={2}
                        value={projectDescription}
                        onChange={(e) => setProjectDescription(e.target.value)}
                        placeholder={L('Deskripsi proyek...', 'Project description...')}
                        className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-white/10 text-xs text-white focus:outline-none focus:border-indigo-500 resize-none"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={savingGeneral}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 text-xs font-semibold transition cursor-pointer disabled:opacity-45"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>
                        {savingGeneral
                          ? L('Menyimpan...', 'Saving...')
                          : L('Simpan Perubahan', 'Save Changes')}
                      </span>
                    </button>
                  </form>

                  <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="text-xs font-semibold text-rose-300 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>{L('Hapus Proyek', 'Delete Project')}</span>
                      </div>
                      <p className="text-[11px] text-zinc-500">
                        {L(
                          'Menghapus workspace & tugas di CodePulse (repository GitHub tetap aman).',
                          'Deletes workspace & tasks in CodePulse (GitHub repository stays safe).',
                        )}
                      </p>
                    </div>

                    {!confirmingDelete ? (
                      <button
                        type="button"
                        onClick={() => setConfirmingDelete(true)}
                        className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500/12 hover:bg-rose-500/20 border border-rose-500/35 text-rose-300 text-xs font-semibold transition cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{L('Hapus Proyek', 'Delete Project')}</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={deletingProject}
                          onClick={() => void handleDeleteProject()}
                          className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold cursor-pointer disabled:opacity-45"
                        >
                          {deletingProject
                            ? L('Menghapus...', 'Deleting...')
                            : L('Ya, Hapus', 'Yes, Delete')}
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}

