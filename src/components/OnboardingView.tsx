import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  FolderGit2,
  KeyRound,
  Lock,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  UserPlus,
} from 'lucide-react';
import type {
  GitHubRepoItem,
  PublicUser,
  SystemCapabilities,
  Workspace,
} from '../../shared/types.ts';
import { api } from '../lib/api.ts';
import { useLanguage } from '../lib/i18nContext.ts';
import { CodePulseLogo } from './CodePulseLogo.tsx';
import { GitHubIcon } from './GitHubIcon.tsx';
import { LanguageToggle } from './LanguageToggle.tsx';
import { RepoListSkeleton } from './LoadingUI.tsx';
import { VercelIcon } from './VercelIcon.tsx';

interface OnboardingViewProps {
  currentUser: PublicUser;
  capabilities: SystemCapabilities | null;
  repos: GitHubRepoItem[];
  reposLoading: boolean;
  pendingInviteCode: string;
  onUserUpdated: (user: PublicUser) => void;
  onImportRepo: (repo: GitHubRepoItem) => Promise<void>;
  onWorkspaceCreated: (ws: Workspace) => void;
  onInviteAccepted: (ws: Workspace) => void;
  onFinishToConsole: () => void;
  onToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

type Step2Mode = 'import' | 'blank' | 'invite';

export function OnboardingView({
  currentUser,
  capabilities,
  repos,
  reposLoading,
  pendingInviteCode,
  onUserUpdated,
  onImportRepo,
  onWorkspaceCreated,
  onInviteAccepted,
  onFinishToConsole,
  onToast,
}: OnboardingViewProps) {
  const { L } = useLanguage();
  const [step, setStep] = useState<1 | 2>(1);
  const [step2Mode, setStep2Mode] = useState<Step2Mode>(() => {
    if (pendingInviteCode) return 'invite';
    return currentUser.githubConnected ? 'import' : 'blank';
  });

  // Step 1: Optional Vercel Vault
  const [vercelToken, setVercelToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [savingVercel, setSavingVercel] = useState(false);

  // Step 2: Import / Create / Join
  const [repoQuery, setRepoQuery] = useState('');
  const [importingId, setImportingId] = useState<number | null>(null);
  const [projectName, setProjectName] = useState('');
  const [projectDesc, setProjectDesc] = useState('');
  const [creatingBlank, setCreatingBlank] = useState(false);
  const [inviteCode, setInviteCode] = useState(pendingInviteCode);
  const [joiningInvite, setJoiningInvite] = useState(false);

  const filteredRepos = repos
    .filter((r) => {
      if (!repoQuery.trim()) return true;
      const q = repoQuery.toLowerCase();
      return (
        r.fullName.toLowerCase().includes(q) ||
        r.defaultBranch.toLowerCase().includes(q)
      );
    })
    .slice(0, 6);

  async function handleLinkVercel(e: React.FormEvent) {
    e.preventDefault();
    if (!vercelToken.trim()) return;
    setSavingVercel(true);
    try {
      const { user } = await api.linkVercelToken(vercelToken.trim());
      onUserUpdated(user);
      setVercelToken('');
      setShowToken(false);
      onToast(
        'success',
        L(
          'Token Vercel berhasil dienkripsi (AES-256-GCM) dan ditautkan ke Vault Anda.',
          'Vercel token encrypted (AES-256-GCM) and linked to your vault.',
        ),
      );
    } catch (err) {
      onToast(
        'error',
        err instanceof Error
          ? err.message
          : L('Gagal menyimpan token Vercel', 'Failed to save Vercel token'),
      );
    } finally {
      setSavingVercel(false);
    }
  }

  async function handleQuickImport(repo: GitHubRepoItem) {
    setImportingId(repo.id);
    try {
      await onImportRepo(repo);
    } finally {
      setImportingId(null);
    }
  }

  async function handleCreateBlank(e: React.FormEvent) {
    e.preventDefault();
    if (!projectName.trim()) return;
    setCreatingBlank(true);
    try {
      const { workspace } = await api.createWorkspace({
        name: projectName.trim(),
        description:
          projectDesc.trim() ||
          L(
            'Diinisialisasi saat onboarding akun CodePulse.',
            'Initialized during CodePulse account onboarding.',
          ),
      });
      onToast(
        'success',
        L(`Proyek "${workspace.name}" berhasil dibuat!`, `Project "${workspace.name}" created!`),
      );
      onWorkspaceCreated(workspace);
    } catch (err) {
      onToast(
        'error',
        err instanceof Error
          ? err.message
          : L('Gagal membuat proyek', 'Failed to create project'),
      );
    } finally {
      setCreatingBlank(false);
    }
  }

  async function handleJoinByInvite(e: React.FormEvent) {
    e.preventDefault();
    const clean = inviteCode.trim();
    if (!clean) return;
    setJoiningInvite(true);
    try {
      const { workspace } = await api.joinWithInviteCode(clean);
      onToast(
        'success',
        L(`Berhasil bergabung ke "${workspace.name}"!`, `Joined "${workspace.name}"!`),
      );
      onInviteAccepted(workspace);
    } catch (err) {
      onToast(
        'error',
        err instanceof Error
          ? err.message
          : L(
              'Kode undangan tidak valid atau sudah kedaluwarsa',
              'Invalid or expired invite code',
            ),
      );
    } finally {
      setJoiningInvite(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#06070b] text-zinc-100 flex flex-col justify-between relative overflow-hidden">
      {/* Ambient Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute -top-36 left-1/2 -translate-x-1/2 w-[820px] h-[440px] rounded-full bg-indigo-600/14 blur-[145px]" />
        <div className="absolute bottom-0 right-0 w-[460px] h-[360px] rounded-full bg-cyan-500/8 blur-[140px]" />
        <div className="bg-cp-grid absolute inset-0 opacity-75" />
      </div>

      {/* Top Bar */}
      <header className="relative z-10 max-w-4xl w-full mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <CodePulseLogo size="md" />
          <span className="font-bold tracking-tight text-white text-base">CodePulse</span>
          <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/12 border border-emerald-500/25 text-emerald-300">
            {L('Pengaturan Akun', 'Account Setup')}
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <LanguageToggle />
          <button
            type="button"
            onClick={onFinishToConsole}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 hover:bg-white/[0.05] text-xs font-medium text-zinc-300 hover:text-white transition cursor-pointer"
          >
            <span>{L('Lewati ke Konsol', 'Skip to Console')}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Center Onboarding Card */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-2xl space-y-6"
        >
          {/* Stepper Header */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/12 border border-indigo-500/25 text-[11px] font-mono text-indigo-200">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>
                {L(
                  `Selamat datang, ${currentUser.displayName}!`,
                  `Welcome aboard, ${currentUser.displayName}!`,
                )}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              {step === 1
                ? L('Hubungkan stack developer Anda', 'Connect your developer stack')
                : L('Luncurkan workspace pertama Anda', 'Launch your first workspace')}
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 max-w-lg mx-auto">
              {step === 1
                ? L(
                    'Verifikasi identitas baru Anda dan hubungkan GitHub & Vercel secara opsional agar workspace pertama siap menjalankan pipeline.',
                    'Verify your new identity and optionally connect GitHub & Vercel so your first workspace is pipeline-ready.',
                  )
                : L(
                    'Impor repository GitHub yang sudah ada, buat workspace proyek baru, atau bergabung ke tim dengan kode undangan.',
                    'Import an existing GitHub repository, create a fresh project workspace, or join your team with an invite code.',
                  )}
            </p>

            {/* Step Indicator */}
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border transition cursor-pointer ${
                  step === 1
                    ? 'bg-indigo-500/15 border-indigo-500/35 text-indigo-200'
                    : 'bg-zinc-900/70 border-white/10 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-indigo-500/25 text-indigo-200 font-mono text-[10px] inline-flex items-center justify-center">
                  1
                </span>
                <span>{L('Profil & Stack', 'Profile & Stack')}</span>
              </button>
              <div className="w-8 h-px bg-white/12" />
              <button
                type="button"
                onClick={() => setStep(2)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border transition cursor-pointer ${
                  step === 2
                    ? 'bg-indigo-500/15 border-indigo-500/35 text-indigo-200'
                    : 'bg-zinc-900/70 border-white/10 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-indigo-500/25 text-indigo-200 font-mono text-[10px] inline-flex items-center justify-center">
                  2
                </span>
                <span>{L('Workspace Pertama', 'First Workspace')}</span>
              </button>
            </div>
          </div>

          <div className="cp-panel rounded-2xl p-6 sm:p-7">
            <AnimatePresence mode="wait" initial={false}>
              {step === 1 ? (
                <motion.div
                  key="onboarding-step-1"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-5"
                >
                  {/* Profile Confirmation Row */}
                  <div className="p-4 rounded-xl bg-zinc-950/90 border border-white/8 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={currentUser.avatarUrl}
                        alt={currentUser.username}
                        className="w-10 h-10 rounded-full ring-1 ring-white/15 bg-zinc-800 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white truncate">
                          {currentUser.displayName}
                        </div>
                        <div className="text-xs font-mono text-zinc-400 truncate">
                          @{currentUser.username}
                          {currentUser.email ? ` • ${currentUser.email}` : ''}
                        </div>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/12 border border-emerald-500/25 text-emerald-300 text-[11px] font-medium shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {L('Akun Dibuat', 'Account Created')}
                    </span>
                  </div>

                  {/* GitHub OAuth Card */}
                  <div className="p-4 rounded-xl bg-zinc-950/80 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center shrink-0">
                        <GitHubIcon className="w-4 h-4 text-white" />
                      </div>
                      <div className="space-y-0.5">
                        <div className="text-sm font-semibold text-white">
                          {L('Repository GitHub & Gatekeeper', 'GitHub Repositories & Gatekeeper')}
                        </div>
                        <p className="text-xs text-zinc-400">
                          {currentUser.githubConnected
                            ? L(
                                `Terhubung sebagai @${currentUser.username}. ${
                                  reposLoading
                                    ? 'Menyinkronkan repository...'
                                    : `${repos.length} repository siap diimpor.`
                                }`,
                                `Connected as @${currentUser.username}. ${
                                  reposLoading
                                    ? 'Syncing repositories...'
                                    : `${repos.length} repository(ies) ready to import.`
                                }`,
                              )
                            : L(
                                'Hubungkan GitHub sekarang untuk mengimpor repository, mengunci branch main, dan menyinkronkan tag commit secara otomatis.',
                                'Link GitHub now to import repositories, lock main branches, and auto-sync commit tags.',
                              )}
                        </p>
                      </div>
                    </div>

                    {currentUser.githubConnected ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/12 border border-emerald-500/25 text-emerald-300 text-xs font-semibold shrink-0">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {L('Terhubung', 'Connected')}
                      </span>
                    ) : capabilities?.githubOAuthConfigured ? (
                      <a
                        href="/api/auth/github?intent=connect&return_to=onboarding"
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-semibold transition shrink-0"
                      >
                        <GitHubIcon className="w-3.5 h-3.5" />
                        <span>{L('Hubungkan GitHub', 'Connect GitHub')}</span>
                      </a>
                    ) : (
                      <span className="text-[11px] font-mono text-zinc-500 shrink-0">
                        {L('Env OAuth belum diatur', 'OAuth env unset')}
                      </span>
                    )}
                  </div>

                  {/* Optional Vercel Vault Card */}
                  <div className="p-4 rounded-xl bg-zinc-950/80 border border-white/10 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center shrink-0">
                          <VercelIcon className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-white">
                              {L('Vault Deployment Vercel', 'Vercel Deployment Vault')}
                            </span>
                            <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                              {L('Opsional', 'Optional')}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-400">
                            {L(
                              'Deploy proyek langsung dari CodePulse dengan kredensial terenkripsi AES-256-GCM.',
                              'Deploy projects directly from CodePulse with AES-256-GCM encrypted credentials.',
                            )}
                          </p>
                        </div>
                      </div>
                      {currentUser.vercelConnected && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/12 border border-emerald-500/25 text-emerald-300 text-[11px] font-semibold shrink-0">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {L('Tertaut', 'Linked')}
                        </span>
                      )}
                    </div>

                    {!currentUser.vercelConnected && (
                      <form onSubmit={handleLinkVercel} className="flex flex-col sm:flex-row gap-2">
                        <div className="relative flex-1">
                          <KeyRound className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type={showToken ? 'text' : 'password'}
                            value={vercelToken}
                            onChange={(e) => setVercelToken(e.target.value)}
                            placeholder={L(
                              'Tempel Personal Access Token Vercel (opsional)...',
                              'Paste Vercel Personal Access Token (optional)...',
                            )}
                            className="w-full pl-9 pr-9 py-2 rounded-xl bg-zinc-900 border border-white/10 text-xs font-mono text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
                          />
                          <button
                            type="button"
                            onClick={() => setShowToken((prev) => !prev)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 cursor-pointer"
                            aria-label={L('Tampilkan atau sembunyikan token', 'Toggle token visibility')}
                          >
                            {showToken ? (
                              <EyeOff className="w-3.5 h-3.5" />
                            ) : (
                              <Eye className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                        <button
                          type="submit"
                          disabled={savingVercel || !vercelToken.trim()}
                          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition cursor-pointer disabled:opacity-45 shrink-0"
                        >
                          {savingVercel ? L('Menyimpan...', 'Saving...') : L('Tautkan Token', 'Link Token')}
                        </button>
                      </form>
                    )}
                  </div>

                  {/* Step 1 Footer */}
                  <div className="pt-2 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={onFinishToConsole}
                      className="text-xs text-zinc-400 hover:text-white transition cursor-pointer"
                    >
                      {L('Atur nanti di Konsol', 'Configure later in Console')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-semibold shadow-lg transition cursor-pointer"
                    >
                      <span>{L('Lanjut ke Pengaturan Workspace', 'Continue to Workspace Setup')}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="onboarding-step-2"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-5"
                >
                  {/* Step 2 Mode Switcher */}
                  <div className="grid grid-cols-3 gap-2 p-1 rounded-xl bg-zinc-950/90 border border-white/8">
                    <button
                      type="button"
                      onClick={() => setStep2Mode('import')}
                      className={`inline-flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                        step2Mode === 'import'
                          ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-500/30'
                          : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
                      }`}
                    >
                      <FolderGit2 className="w-3.5 h-3.5" />
                      <span>{L('Impor GitHub', 'Import GitHub')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep2Mode('blank')}
                      className={`inline-flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                        step2Mode === 'blank'
                          ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-500/30'
                          : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{L('Proyek Kosong', 'Blank Project')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep2Mode('invite')}
                      className={`inline-flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                        step2Mode === 'invite'
                          ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-500/30'
                          : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
                      }`}
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>{L('Gabung Tim', 'Join Team')}</span>
                    </button>
                  </div>

                  {/* Import GitHub Mode */}
                  {step2Mode === 'import' && (
                    <div className="space-y-3">
                      {!currentUser.githubConnected ? (
                        <div className="p-6 rounded-xl bg-zinc-950/80 border border-dashed border-white/12 text-center space-y-3">
                          <GitHubIcon className="w-7 h-7 text-zinc-400 mx-auto" />
                          <div className="text-sm font-semibold text-white">
                            {L(
                              'Hubungkan GitHub untuk menelusuri repository Anda',
                              'Connect GitHub to browse your repositories',
                            )}
                          </div>
                          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                            {L(
                              <>
                                Otorisasi GitHub OAuth untuk mengimpor repository dalam satu klik, atau beralih ke{' '}
                                <strong className="text-zinc-200">Proyek Kosong</strong> di atas.
                              </>,
                              <>
                                Authorize GitHub OAuth to import a repo in one click, or switch to{' '}
                                <strong className="text-zinc-200">Blank Project</strong> above.
                              </>,
                            )}
                          </p>
                          {capabilities?.githubOAuthConfigured && (
                            <a
                              href="/api/auth/github?intent=connect&return_to=onboarding"
                              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-semibold transition"
                            >
                              <GitHubIcon className="w-3.5 h-3.5" />
                              <span>{L('Hubungkan Akun GitHub', 'Connect GitHub Account')}</span>
                            </a>
                          )}
                        </div>
                      ) : (
                        <>
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              value={repoQuery}
                              onChange={(e) => setRepoQuery(e.target.value)}
                              placeholder={L(
                                'Cari repository GitHub Anda...',
                                'Search your GitHub repositories...',
                              )}
                              className="w-full pl-9 pr-3 py-2 rounded-xl bg-zinc-950 border border-white/10 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
                            />
                          </div>

                          {reposLoading ? (
                            <RepoListSkeleton count={3} />
                          ) : filteredRepos.length === 0 ? (
                            <div className="p-5 rounded-xl bg-zinc-950/70 border border-white/8 text-center text-xs text-zinc-500">
                              {L(
                                'Tidak ada repository yang cocok. Coba buat Proyek Kosong sebagai gantinya.',
                                'No matching repositories found. Try creating a Blank Project instead.',
                              )}
                            </div>
                          ) : (
                            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                              {filteredRepos.map((repo) => (
                                <div
                                  key={repo.id}
                                  className="p-3 rounded-xl bg-zinc-950/90 border border-white/8 hover:border-white/15 flex items-center justify-between gap-3 transition"
                                >
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-mono font-semibold text-white truncate">
                                        {repo.fullName}
                                      </span>
                                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.05] text-zinc-400 shrink-0">
                                        {repo.private ? L('privat', 'private') : L('publik', 'public')}
                                      </span>
                                    </div>
                                    <div className="text-[11px] text-zinc-500 mt-0.5">
                                      {L(
                                        `Pemilik: ${repo.owner} • branch utama: ${repo.defaultBranch}`,
                                        `Owner: ${repo.owner} • default: ${repo.defaultBranch}`,
                                      )}
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    disabled={importingId !== null}
                                    onClick={() => void handleQuickImport(repo)}
                                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition cursor-pointer disabled:opacity-50 shrink-0"
                                  >
                                    {importingId === repo.id
                                      ? L('Mengimpor...', 'Importing...')
                                      : L('Impor & Buka', 'Import & Launch')}
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {/* Blank Project Mode */}
                  {step2Mode === 'blank' && (
                    <form onSubmit={handleCreateBlank} className="space-y-3.5">
                      <div>
                        <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                          {L('Nama Proyek', 'Project Name')}
                        </label>
                        <input
                          type="text"
                          required
                          value={projectName}
                          onChange={(e) => setProjectName(e.target.value)}
                          placeholder={L('mis. Portal CampusSync', 'e.g. CampusSync Portal')}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-white/10 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                          {L('Deskripsi Singkat (Opsional)', 'Short Description (Optional)')}
                        </label>
                        <input
                          type="text"
                          value={projectDesc}
                          onChange={(e) => setProjectDesc(e.target.value)}
                          placeholder={L(
                            'Apa yang sedang dibangun tim Anda?',
                            'What is your team building?',
                          )}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-white/10 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={creatingBlank || !projectName.trim()}
                        className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg transition cursor-pointer disabled:opacity-50"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>
                          {creatingBlank
                            ? L('Membuat Workspace...', 'Creating Workspace...')
                            : L('Buat & Buka Proyek', 'Create & Open Project')}
                        </span>
                      </button>
                    </form>
                  )}

                  {/* Join Team Invite Mode */}
                  {step2Mode === 'invite' && (
                    <form onSubmit={handleJoinByInvite} className="space-y-3.5">
                      <div className="p-3.5 rounded-xl bg-indigo-500/8 border border-indigo-500/20 text-xs text-indigo-200 leading-relaxed">
                        {L(
                          'Punya tautan atau kode undangan dari Project Leader? Tempel kodenya di bawah untuk langsung bergabung ke workspace mereka.',
                          'Have an invite link or code from a Project Leader? Paste the code below to join their workspace immediately.',
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                          {L('Kode Undangan Workspace', 'Workspace Invite Code')}
                        </label>
                        <div className="relative">
                          <Lock className="w-3.5 h-3.5 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            required
                            value={inviteCode}
                            onChange={(e) => setInviteCode(e.target.value)}
                            placeholder={L('mis. CP-7X9K2M', 'e.g. CP-7X9K2M')}
                            className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-zinc-950 border border-white/10 text-xs font-mono text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                      </div>
                      <button
                        type="submit"
                        disabled={joiningInvite || !inviteCode.trim()}
                        className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg transition cursor-pointer disabled:opacity-50"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>
                          {joiningInvite
                            ? L('Bergabung ke Proyek...', 'Joining Project...')
                            : L('Terima Undangan & Masuk Proyek', 'Accept Invite & Enter Project')}
                        </span>
                      </button>
                    </form>
                  )}

                  {/* Step 2 Footer */}
                  <div className="pt-2 border-t border-white/[0.07] flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>{L('Kembali', 'Back')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={onFinishToConsole}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-white/10 text-xs font-semibold text-white transition cursor-pointer"
                    >
                      <span>{L('Selesai & Buka Konsol', 'Finish & Open Console')}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-center justify-center gap-2 text-[11px] text-zinc-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              {L(
                'Anda selalu dapat memperbarui integrasi & workspace kapan saja di dalam Hub',
                'You can always update integrations & workspaces later inside Hub',
              )}
            </span>
          </div>
        </motion.div>
      </main>

      <footer className="relative z-10 py-5 text-center text-[11px] text-zinc-600">
        {L('CodePulse — Hub Rekayasa Perangkat Lunak Enterprise', 'CodePulse Enterprise Engineering Hub')}
      </footer>
    </div>
  );
}
