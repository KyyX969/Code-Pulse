import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  FolderGit2,
  GitBranch,
  Home,
  Kanban,
  KeyRound,
  Layers,
  Lock,
  LogOut,
  Mail,
  Menu,
  Monitor,
  Plus,
  Rocket,
  Search,
  Settings,
  ShieldCheck,
  Unlock,
  UserPlus,
  X,
} from 'lucide-react';
import { getWorkspaceMemberRole } from '../shared/permissions.ts';
import type {
  Deployment,
  GitHubRepoItem,
  LiveSession,
  PublicUser,
  RealtimeServerMessage,
  SystemCapabilities,
  Task,
  WebhookEvent,
  Workspace,
  WorkspaceInvitation,
} from '../shared/types.ts';
import { type AuthNotice, AuthPage } from './components/AuthPage.tsx';
import { CodePulseLogo } from './components/CodePulseLogo.tsx';
import { CommandPalette, type PaletteTab } from './components/CommandPalette.tsx';
import { type ConsoleSection, ConsoleViewRouter } from './components/ConsoleViews.tsx';
import { DeploymentsPanel } from './components/DeploymentsPanel.tsx';
import { GatekeeperCenter } from './components/GatekeeperCenter.tsx';
import { KanbanBoard } from './components/KanbanBoard.tsx';
import { LandingPage } from './components/LandingPage.tsx';
import { LanguageToggle } from './components/LanguageToggle.tsx';
import { LiveMonitorPanel } from './components/LiveMonitorPanel.tsx';
import { CodePulseSplashLoader, WorkspaceViewSkeleton } from './components/LoadingUI.tsx';
import { OnboardingView } from './components/OnboardingView.tsx';
import { SettingsPanel } from './components/SettingsPanel.tsx';
import { TaskDiffModal } from './components/TaskDiffModal.tsx';
import { api } from './lib/api.ts';
import { readStoredLocale, useLanguage } from './lib/i18nContext.ts';
import { EASE_OUT_EXPO } from './lib/motion.ts';
import { realtimeClient } from './lib/realtime.ts';

interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

const CONSOLE_SECTION_LABELS: Record<ConsoleSection, { id: string; en: string }> = {
  home: { id: 'Ringkasan', en: 'Overview' },
  projects: { id: 'Proyek', en: 'Projects' },
  invitations: { id: 'Undangan & Akses Tim', en: 'Invitations & Team Access' },
  repos: { id: 'Repository GitHub', en: 'GitHub Repositories' },
  activity: { id: 'Aktivitas & Log Audit', en: 'Activity & Audit Logs' },
  guide: { id: 'Panduan Setup', en: 'Setup & Guide' },
  vault: { id: 'Integrasi & Vault', en: 'Integrations & Vault' },
};

const TAB_LABELS: Record<PaletteTab, { id: string; en: string }> = {
  board: { id: 'Papan Kanban', en: 'Kanban Board' },
  gatekeeper: { id: 'Gatekeeper & Webhook', en: 'Gatekeeper & Webhooks' },
  deployments: { id: 'Deployment Vercel', en: 'Vercel Deployments' },
  live: { id: 'Monitor Layar Langsung', en: 'Live Screen Monitor' },
  settings: { id: 'Pengaturan Proyek', en: 'Project Settings' },
};

const AUTH_ERROR_MESSAGES: Record<string, { id: string; en: string }> = {
  github_oauth_not_configured: {
    id: 'GitHub OAuth membutuhkan GITHUB_CLIENT_ID & GITHUB_CLIENT_SECRET di .env. Silakan masuk dengan Email & Kata Sandi.',
    en: 'GitHub OAuth requires GITHUB_CLIENT_ID & GITHUB_CLIENT_SECRET in .env. Please sign in with Email & Password.',
  },
  invalid_oauth_state: {
    id: 'Sesi GitHub OAuth telah berakhir. Silakan coba masuk kembali.',
    en: 'GitHub OAuth session expired. Please try signing in again.',
  },
  github_token_exchange_failed: {
    id: 'Penukaran token GitHub OAuth gagal. Silakan coba lagi.',
    en: 'GitHub OAuth token exchange failed. Please try again.',
  },
  github_oauth_exception: {
    id: 'Tidak dapat menyelesaikan login GitHub saat ini.',
    en: 'Unable to complete GitHub sign-in right now.',
  },
};

type AuthNoticeDescriptor =
  | { kind: 'github_account_not_found'; ghUser?: string }
  | { kind: 'github_account_exists'; ghUser?: string }
  | { kind: 'auth_error'; code: string };

function readInitialAuthRoute(): {
  route: 'login' | 'register' | null;
  notice: AuthNoticeDescriptor | null;
} {
  if (typeof window === 'undefined') return { route: null, notice: null };
  const params = new URLSearchParams(window.location.search);
  const authError = params.get('auth_error');
  const authMode = params.get('auth_mode');
  const ghUser = params.get('gh_user')?.trim();
  if (authError) {
    const targetRoute: 'login' | 'register' =
      authMode === 'register' || authError === 'github_account_not_found' ? 'register' : 'login';
    const nextPath = targetRoute === 'register' ? '/signup' : '/login';
    window.history.replaceState({}, '', nextPath);

    if (authError === 'github_account_not_found') {
      return {
        route: 'register',
        notice: { kind: 'github_account_not_found', ghUser: ghUser || undefined },
      };
    }

    if (authError === 'github_account_exists') {
      return {
        route: 'login',
        notice: { kind: 'github_account_exists', ghUser: ghUser || undefined },
      };
    }

    return {
      route: targetRoute,
      notice: { kind: 'auth_error', code: authError },
    };
  }
  if (window.location.pathname === '/login') return { route: 'login', notice: null };
  if (window.location.pathname === '/signup' || window.location.pathname === '/register') {
    return { route: 'register', notice: null };
  }
  return { route: null, notice: null };
}

const PENDING_INVITE_STORAGE_KEY = 'cp_pending_invite_code';

function readInitialInviteCode(): string {
  if (typeof window === 'undefined') return '';
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('invite')?.trim();
  if (fromQuery) {
    try {
      window.sessionStorage.setItem(PENDING_INVITE_STORAGE_KEY, fromQuery);
    } catch {
      // ignore storage errors
    }
    params.delete('invite');
    const cleanSearch = params.toString();
    const nextUrl = `${window.location.pathname}${cleanSearch ? `?${cleanSearch}` : ''}`;
    window.history.replaceState({}, '', nextUrl);
    return fromQuery;
  }
  try {
    return window.sessionStorage.getItem(PENDING_INVITE_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function App() {
  const { L, locale } = useLanguage();
  const [initialRoute] = useState(() => readInitialAuthRoute());
  const [pendingInviteCode, setPendingInviteCode] = useState<string>(() => readInitialInviteCode());
  const [booting, setBooting] = useState(true);
  const [currentUser, setCurrentUser] = useState<PublicUser | null>(null);
  const [capabilities, setCapabilities] = useState<SystemCapabilities | null>(null);
  const [authRoute, setAuthRoute] = useState<'login' | 'register' | null>(initialRoute.route);
  const [authNoticeDesc, setAuthNoticeDesc] = useState<AuthNoticeDescriptor | null>(
    initialRoute.notice,
  );
  const [showOnboarding, setShowOnboarding] = useState(false);

  const authInitialNotice: AuthNotice | null = (() => {
    if (!authNoticeDesc) return null;
    if (authNoticeDesc.kind === 'github_account_not_found') {
      return {
        tone: 'info',
        message: authNoticeDesc.ghUser
          ? L(
              `Akun CodePulse untuk @${authNoticeDesc.ghUser} belum ditemukan. Klik "Daftar dengan GitHub" di bawah untuk membuat akun dan mulai onboarding.`,
              `No CodePulse account found for @${authNoticeDesc.ghUser} yet. Click "Sign up with GitHub" below to create your account and start onboarding.`,
            )
          : L(
              'Akun CodePulse untuk profil GitHub tersebut belum ditemukan. Daftar di bawah untuk membuat akun.',
              'No CodePulse account found for that GitHub profile yet. Sign up below to create one.',
            ),
      };
    }
    if (authNoticeDesc.kind === 'github_account_exists') {
      return {
        tone: 'info',
        message: authNoticeDesc.ghUser
          ? L(
              `Akun GitHub @${authNoticeDesc.ghUser} sudah terdaftar di CodePulse. Klik "Masuk dengan GitHub" di bawah untuk membuka Konsol Anda.`,
              `GitHub account @${authNoticeDesc.ghUser} is already registered in CodePulse. Click "Sign in with GitHub" below to open your Console.`,
            )
          : L(
              'Akun GitHub tersebut sudah terdaftar. Masuk di bawah untuk melanjutkan.',
              'That GitHub account is already registered. Sign in below to continue.',
            ),
      };
    }
    const errEntry = AUTH_ERROR_MESSAGES[authNoticeDesc.code];
    return {
      tone: 'error',
      message: errEntry
        ? L(errEntry.id, errEntry.en)
        : L('Autentikasi gagal. Silakan coba lagi.', 'Authentication failed. Please try again.'),
    };
  })();

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [webhookEvents, setWebhookEvents] = useState<WebhookEvent[]>([]);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [liveSessions, setLiveSessions] = useState<LiveSession[]>([]);
  const [incomingInvitations, setIncomingInvitations] = useState<WorkspaceInvitation[]>([]);
  const [sentInvitations, setSentInvitations] = useState<WorkspaceInvitation[]>([]);

  const [navScope, setNavScope] = useState<'console' | 'project'>('console');
  const [consoleSection, setConsoleSection] = useState<ConsoleSection>(() =>
    pendingInviteCode ? 'invitations' : 'home',
  );
  const [activeTab, setActiveTab] = useState<PaletteTab>('board');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showNewWorkspace, setShowNewWorkspace] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [externalCreateOpen, setExternalCreateOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const [repos, setRepos] = useState<GitHubRepoItem[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [reposError, setReposError] = useState<string | null>(null);
  const [importingRepoId, setImportingRepoId] = useState<number | null>(null);

  const pushToast = useCallback(
    (type: ToastItem['type'], message: string) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev.slice(-3), { id, type, message }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4500);
    },
    [],
  );

  const loadGitHubRepos = useCallback(async () => {
    setReposLoading(true);
    setReposError(null);
    try {
      const res = await api.listGitHubRepos();
      setRepos(res.repos);
    } catch (err) {
      setReposError(
        err instanceof Error
          ? err.message
          : L('Tidak dapat memuat repository GitHub', 'Unable to load GitHub repositories'),
      );
    } finally {
      setReposLoading(false);
    }
  }, [L]);

  const loadWorkspaceData = useCallback(async (workspaceId: string) => {
    const [taskRes, eventRes, deployRes, sessionRes] = await Promise.all([
      api.listTasks(workspaceId),
      api.listWebhookEvents(workspaceId),
      api.listDeployments(workspaceId),
      api.listLiveSessions(workspaceId),
    ]);
    setTasks(taskRes.tasks);
    setWebhookEvents(eventRes.events);
    setDeployments(deployRes.deployments);
    setLiveSessions(sessionRes.sessions);
  }, []);

  const loadInvitations = useCallback(async () => {
    try {
      const res = await api.listMyInvitations();
      setIncomingInvitations(res.incoming);
      setSentInvitations(res.sent);
    } catch {
      // ignore initial invitation fetch failure
    }
  }, []);

  const loadAuthenticatedState = useCallback(async () => {
    const [{ workspaces: wsList }] = await Promise.all([
      api.listWorkspaces(),
      loadInvitations(),
    ]);
    setWorkspaces(wsList);
    if (wsList.length > 0) {
      const targetId =
        activeWorkspaceId && wsList.some((w) => w.id === activeWorkspaceId)
          ? activeWorkspaceId
          : wsList[0].id;
      setActiveWorkspaceId(targetId);
      await loadWorkspaceData(targetId);
    }
  }, [activeWorkspaceId, loadInvitations, loadWorkspaceData]);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      const startedAt = Date.now();
      try {
        let me: Awaited<ReturnType<typeof api.getMe>> | null = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            me = await api.getMe();
            break;
          } catch {
            if (cancelled || attempt === 2) break;
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        }
        if (cancelled || !me) return;
        setCapabilities(me.capabilities);
        setCurrentUser(me.user);
        if (me.user) {
          const params = new URLSearchParams(window.location.search);
          const githubStatus = params.get('github');
          const connectError = params.get('github_connect_error');
          const ghUserParam = params.get('gh_user')?.trim();
          const wantOnboarding = params.get('onboarding') === '1';

          if (githubStatus || connectError || wantOnboarding) {
            window.history.replaceState({}, '', '/');
          }

          if (wantOnboarding) {
            setShowOnboarding(true);
          }

          const bootLocale = readStoredLocale();
          const tBoot = (idText: string, enText: string) => (bootLocale === 'en' ? enText : idText);

          if (connectError === 'already_linked') {
            pushToast(
              'error',
              ghUserParam
                ? tBoot(
                    `Akun GitHub @${ghUserParam} sudah terhubung ke pengguna CodePulse lain.`,
                    `GitHub account @${ghUserParam} is already linked to another CodePulse user.`,
                  )
                : tBoot(
                    'Akun GitHub tersebut sudah terhubung ke pengguna CodePulse lain.',
                    'That GitHub account is already linked to another CodePulse user.',
                  ),
            );
          } else if (githubStatus === 'signed_in') {
            pushToast(
              'success',
              tBoot(
                `Selamat datang kembali, ${me.user.displayName}!`,
                `Welcome back, ${me.user.displayName}!`,
              ),
            );
          } else if (githubStatus === 'registered') {
            pushToast(
              'success',
              tBoot(
                'Akun berhasil dibuat dengan GitHub! Selesaikan pengaturan singkat Anda.',
                'Account created with GitHub! Complete your quick setup.',
              ),
            );
          } else if (githubStatus === 'connected') {
            pushToast(
              'success',
              tBoot('GitHub OAuth berhasil terhubung!', 'GitHub OAuth connected cleanly!'),
            );
          }

          await loadAuthenticatedState();
        }
      } catch {
        // Unauthenticated or server booting
      } finally {
        const elapsed = Date.now() - startedAt;
        const minSplashMs = 520;
        if (elapsed < minSplashMs) {
          await new Promise((resolve) => setTimeout(resolve, minSplashMs - elapsed));
        }
        if (!cancelled) setBooting(false);
      }
    }
    void boot();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function fetchRepos() {
      if (!currentUser?.githubConnected) {
        setRepos([]);
        return;
      }
      setReposLoading(true);
      setReposError(null);
      try {
        const res = await api.listGitHubRepos();
        if (!cancelled) setRepos(res.repos);
      } catch (err) {
        if (!cancelled) {
          const loc = readStoredLocale();
          setReposError(
            err instanceof Error
              ? err.message
              : loc === 'en'
                ? 'Unable to load GitHub repositories'
                : 'Tidak dapat memuat repository GitHub',
          );
        }
      } finally {
        if (!cancelled) setReposLoading(false);
      }
    }
    void fetchRepos();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.githubConnected]);

  // Global Cmd+K / Ctrl+K shortcut for Command Palette (active project scope only)
  useEffect(() => {
    if (!currentUser || navScope !== 'project' || !activeWorkspaceId) return;
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentUser, navScope, activeWorkspaceId]);

  // Workspace realtime WebSocket sync
  useEffect(() => {
    if (!currentUser || !activeWorkspaceId) {
      realtimeClient.disconnect();
      return;
    }

    realtimeClient.connect(activeWorkspaceId, currentUser.id);
    const unsubscribe = realtimeClient.subscribe((msg: RealtimeServerMessage) => {
      if (msg.type === 'task:created' && msg.workspaceId === activeWorkspaceId) {
        setTasks((prev) =>
          prev.some((t) => t.id === msg.task.id) ? prev : [...prev, msg.task],
        );
      } else if (msg.type === 'task:updated' && msg.workspaceId === activeWorkspaceId) {
        setTasks((prev) => prev.map((t) => (t.id === msg.task.id ? msg.task : t)));
        setSelectedTask((prev) => (prev?.id === msg.task.id ? msg.task : prev));
      } else if (msg.type === 'task:deleted' && msg.workspaceId === activeWorkspaceId) {
        setTasks((prev) => prev.filter((t) => t.id !== msg.taskId));
        setSelectedTask((prev) => (prev?.id === msg.taskId ? null : prev));
      } else if (msg.type === 'workspace:updated') {
        setWorkspaces((prev) =>
          prev.map((w) => (w.id === msg.workspace.id ? msg.workspace : w)),
        );
      } else if (msg.type === 'webhook:received' && msg.workspaceId === activeWorkspaceId) {
        setWebhookEvents((prev) =>
          prev.some((e) => e.id === msg.event.id)
            ? prev
            : [msg.event, ...prev].slice(0, 50),
        );
      } else if (msg.type === 'deployment:updated' && msg.workspaceId === activeWorkspaceId) {
        setDeployments((prev) => {
          const exists = prev.some((d) => d.id === msg.deployment.id);
          if (exists) {
            return prev.map((d) => (d.id === msg.deployment.id ? msg.deployment : d));
          }
          return [msg.deployment, ...prev];
        });
      } else if (msg.type === 'session:updated' && msg.workspaceId === activeWorkspaceId) {
        setLiveSessions(msg.sessions);
      } else if (msg.type === 'invitation:updated') {
        void loadInvitations();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [currentUser, activeWorkspaceId, loadInvitations]);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) || null;

  async function handleSelectWorkspace(id: string) {
    setActiveWorkspaceId(id);
    setSelectedTask(null);
    setNavScope('project');
    setMobileMenuOpen(false);
    setWorkspaceLoading(true);
    try {
      await loadWorkspaceData(id);
    } finally {
      setWorkspaceLoading(false);
    }
  }

  async function handleEnterProject(workspaceId: string, initialTab: PaletteTab = 'board') {
    setActiveTab(initialTab);
    setNavScope('project');
    setMobileMenuOpen(false);
    if (workspaceId !== activeWorkspaceId) {
      setActiveWorkspaceId(workspaceId);
      setSelectedTask(null);
      setWorkspaceLoading(true);
      try {
        await loadWorkspaceData(workspaceId);
      } finally {
        setWorkspaceLoading(false);
      }
    }
  }

  async function handleWorkspaceJoined(ws: Workspace) {
    setWorkspaces((prev) =>
      prev.some((w) => w.id === ws.id)
        ? prev.map((w) => (w.id === ws.id ? ws : w))
        : [...prev, ws],
    );
    setPendingInviteCode('');
    try {
      window.sessionStorage.removeItem(PENDING_INVITE_STORAGE_KEY);
    } catch {
      // ignore storage error
    }
    setActiveWorkspaceId(ws.id);
    await loadWorkspaceData(ws.id);
    setActiveTab('board');
    setNavScope('project');
  }

  function handleWorkspaceUpdated(ws: Workspace) {
    setWorkspaces((prev) => prev.map((w) => (w.id === ws.id ? ws : w)));
  }

  function handleWorkspaceDeleted(workspaceId: string) {
    setWorkspaces((prev) => {
      const next = prev.filter((w) => w.id !== workspaceId);
      if (activeWorkspaceId === workspaceId) {
        setActiveWorkspaceId(next[0]?.id ?? null);
      }
      return next;
    });
    if (activeWorkspaceId === workspaceId) {
      setTasks([]);
      setWebhookEvents([]);
      setDeployments([]);
      setLiveSessions([]);
      setSelectedTask(null);
      setNavScope('console');
      setConsoleSection('projects');
    }
    void loadInvitations();
  }

  async function handleImportRepo(repo: GitHubRepoItem): Promise<boolean> {
    setImportingRepoId(repo.id);
    try {
      const { workspace: created } = await api.createWorkspace({
        name: repo.name,
        description: L(
          `Repository GitHub terhubung: ${repo.fullName}`,
          `Connected GitHub repository: ${repo.fullName}`,
        ),
      });

      const { workspace: linked, notices } = await api.connectGitHubRepo(created.id, {
        owner: repo.owner,
        repo: repo.name,
        repoId: repo.id,
        defaultBranch: repo.defaultBranch,
        enableProtection: true,
      });

      setWorkspaces((prev) => [...prev, linked]);
      setActiveWorkspaceId(linked.id);
      await loadWorkspaceData(linked.id);
      setActiveTab('board');
      setNavScope('project');
      pushToast(
        'success',
        notices[0] ||
          L(
            `Proyek "${linked.name}" berhasil dibuat & terhubung!`,
            `Project "${linked.name}" initialized & linked!`,
          ),
      );
      return true;
    } catch (err) {
      pushToast(
        'error',
        err instanceof Error
          ? err.message
          : L('Gagal membuat proyek', 'Failed to initialize project'),
      );
      return false;
    } finally {
      setImportingRepoId(null);
    }
  }

  useEffect(() => {
    function onPopState() {
      if (window.location.pathname === '/login') setAuthRoute('login');
      else if (window.location.pathname === '/signup' || window.location.pathname === '/register') {
        setAuthRoute('register');
      } else {
        setAuthRoute(null);
      }
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  function navigateAuth(mode: 'login' | 'register' | null) {
    setAuthNoticeDesc(null);
    setAuthRoute(mode);
    const nextPath = mode === 'login' ? '/login' : mode === 'register' ? '/signup' : '/';
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleLogout() {
    await api.logout();
    realtimeClient.disconnect();
    setShowOnboarding(false);
    setNavScope('console');
    setConsoleSection('home');
    setCurrentUser(null);
    setWorkspaces([]);
    setTasks([]);
    setRepos([]);
    setIncomingInvitations([]);
    setSentInvitations([]);
    navigateAuth(null);
  }

  const toastOverlay = (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            layout
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 24, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className={`pointer-events-auto flex items-start gap-2.5 p-3.5 rounded-xl border shadow-2xl text-xs backdrop-blur-md ${
              toast.type === 'success'
                ? 'bg-emerald-950/95 border-emerald-500/40 text-emerald-100'
                : toast.type === 'error'
                  ? 'bg-rose-950/95 border-rose-500/40 text-rose-100'
                  : 'bg-[#12141e]/95 border-white/15 text-zinc-100'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : toast.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            ) : (
              <Activity className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            )}
            <span className="leading-snug flex-1">{toast.message}</span>
            <button
              type="button"
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="text-zinc-400 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );

  if (booting) {
    return <CodePulseSplashLoader />;
  }

  if (!currentUser && authRoute) {
    return (
      <AuthPage
        mode={authRoute}
        initialNotice={authInitialNotice}
        capabilities={capabilities}
        onCapabilitiesLoaded={setCapabilities}
        onSwitchMode={(nextMode) => navigateAuth(nextMode)}
        onAuthenticated={(user, isNewAccount) => {
          setNavScope('console');
          setConsoleSection(pendingInviteCode ? 'invitations' : 'home');
          setCurrentUser(user);
          setAuthRoute(null);
          setAuthNoticeDesc(null);
          setShowOnboarding(isNewAccount);
          if (window.location.pathname !== '/') {
            window.history.replaceState({}, '', '/');
          }
          void loadAuthenticatedState();
        }}
        onBackToLanding={() => navigateAuth(null)}
      />
    );
  }

  if (!currentUser) {
    return (
      <LandingPage
        currentUser={null}
        onOpenAuth={(mode = 'login') => navigateAuth(mode)}
      />
    );
  }

  if (showOnboarding) {
    return (
      <>
        <OnboardingView
          currentUser={currentUser}
          capabilities={capabilities}
          repos={repos}
          reposLoading={reposLoading}
          pendingInviteCode={pendingInviteCode}
          onUserUpdated={setCurrentUser}
          onImportRepo={async (repo) => {
            const ok = await handleImportRepo(repo);
            if (ok) setShowOnboarding(false);
          }}
          onWorkspaceCreated={(ws) => {
            setWorkspaces((prev) => [...prev, ws]);
            setActiveWorkspaceId(ws.id);
            setTasks([]);
            setWebhookEvents([]);
            setDeployments([]);
            setLiveSessions([]);
            setActiveTab('board');
            setNavScope('project');
            setShowOnboarding(false);
          }}
          onInviteAccepted={(ws) => {
            setShowOnboarding(false);
            void handleWorkspaceJoined(ws);
          }}
          onFinishToConsole={() => {
            setShowOnboarding(false);
            setNavScope('console');
            setConsoleSection(pendingInviteCode ? 'invitations' : 'home');
          }}
          onToast={pushToast}
        />
        {toastOverlay}
      </>
    );
  }

  const inReviewCount = tasks.filter((t) => t.status === 'in_review').length;
  const latestDeploy = deployments[0] || null;
  const liveUserIds = new Set(liveSessions.map((s) => s.userId));
  const activeProjectRole = activeWorkspace
    ? getWorkspaceMemberRole(activeWorkspace, currentUser)
    : null;

  function openConsoleSection(section: ConsoleSection) {
    setConsoleSection(section);
    setNavScope('console');
    setMobileMenuOpen(false);
  }

  function openProjectTab(tab: PaletteTab) {
    if (!activeWorkspace) {
      setShowNewWorkspace(true);
      setMobileMenuOpen(false);
      return;
    }
    setActiveTab(tab);
    setNavScope('project');
    setMobileMenuOpen(false);
  }

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#0b0c12] border-r border-white/8">
      {/* Sidebar Brand */}
      <button
        type="button"
        onClick={() => openConsoleSection('home')}
        className="h-14 px-4 flex items-center justify-between border-b border-white/8 hover:bg-white/[0.02] transition cursor-pointer text-left shrink-0"
      >
        <div className="flex items-center gap-2.5">
          <CodePulseLogo size="sm" />
          <span className="font-bold tracking-tight text-white text-sm">CodePulse</span>
        </div>
        <span
          className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${
            navScope === 'project' && activeWorkspace
              ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/25'
              : 'bg-white/5 text-zinc-400'
          }`}
        >
          {navScope === 'project' && activeWorkspace ? L('PROYEK', 'PROJECT') : 'HUB'}
        </span>
      </button>

      {/* Scrollable Contextual Sidebar Navigation (Swaps between Hub & Project menus) */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {navScope === 'project' && activeWorkspace ? (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => openConsoleSection('home')}
              className="w-full px-3 py-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/8 flex items-center gap-2 text-xs font-medium text-zinc-300 hover:text-white transition cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span>{L('Kembali ke Hub', 'Back to Hub')}</span>
            </button>

            <div className="pt-3 border-t border-white/[0.07] space-y-2 px-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  {L('Proyek Aktif', 'Active Project')}
                </span>
                <button
                  type="button"
                  onClick={() => setShowNewWorkspace(true)}
                  className="inline-flex items-center gap-1 text-[10px] font-medium text-indigo-300 hover:text-indigo-200 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>{L('Baru', 'New')}</span>
                </button>
              </div>

              <div className="space-y-1.5">
                <select
                  value={activeWorkspace.id}
                  onChange={(e) => void handleSelectWorkspace(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl bg-zinc-950 border border-white/10 text-xs font-medium text-white focus:outline-none focus:border-indigo-500 truncate"
                >
                  {workspaces.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>

                {activeWorkspace.githubOwner && activeWorkspace.githubRepo && (
                  <div className="px-2.5 py-1.5 rounded-lg bg-zinc-950/70 border border-white/6 flex items-center justify-between gap-2 text-[11px] font-mono">
                    <span className="inline-flex items-center gap-1.5 text-zinc-300 truncate">
                      <GitBranch className="w-3 h-3 text-cyan-400 shrink-0" />
                      <span className="truncate">
                        {activeWorkspace.githubOwner}/{activeWorkspace.githubRepo}
                      </span>
                    </span>
                    {activeWorkspace.branchProtected ? (
                      <Lock className="w-3 h-3 text-emerald-400 shrink-0" />
                    ) : (
                      <Unlock className="w-3 h-3 text-amber-400 shrink-0" />
                    )}
                  </div>
                )}
              </div>
            </div>

          <nav className="space-y-1">
            <SidebarItem
              active={navScope === 'project' && activeTab === 'board'}
              onClick={() => openProjectTab('board')}
              icon={<Kanban className="w-4 h-4" />}
              label={L('Papan Kanban', 'Kanban Board')}
              badge={activeWorkspace && tasks.length > 0 ? String(tasks.length) : undefined}
            />
            <SidebarItem
              active={navScope === 'project' && activeTab === 'gatekeeper'}
              onClick={() => openProjectTab('gatekeeper')}
              icon={<ShieldCheck className="w-4 h-4" />}
              label="Gatekeeper"
              badge={activeWorkspace && inReviewCount > 0 ? `${inReviewCount} PR` : undefined}
              badgeTone="violet"
            />
            <SidebarItem
              active={navScope === 'project' && activeTab === 'deployments'}
              onClick={() => openProjectTab('deployments')}
              icon={<Rocket className="w-4 h-4" />}
              label={L('Deployment', 'Deployments')}
              badge={activeWorkspace && latestDeploy ? latestDeploy.status : undefined}
              badgeTone={
                latestDeploy?.status === 'READY'
                  ? 'emerald'
                  : latestDeploy?.status === 'ERROR'
                    ? 'rose'
                    : 'amber'
              }
            />
            <SidebarItem
              active={navScope === 'project' && activeTab === 'live'}
              onClick={() => openProjectTab('live')}
              icon={<Monitor className="w-4 h-4" />}
              label={L('Monitor Langsung', 'Live Monitor')}
              badge={
                activeWorkspace && liveSessions.length > 0
                  ? `${liveSessions.length} LIVE`
                  : undefined
              }
              badgeTone="cyan"
            />
            <SidebarItem
              active={navScope === 'project' && activeTab === 'settings'}
              onClick={() => openProjectTab('settings')}
              icon={<Settings className="w-4 h-4" />}
              label={L('Pengaturan Proyek', 'Project Settings')}
            />
          </nav>

            {/* Project Members (Contextual to Selected Project Only) */}
            <div className="pt-3 border-t border-white/[0.06] space-y-1.5">
              <div className="flex items-center justify-between px-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  {L(
                    `Tim Proyek (${activeWorkspace.members.length})`,
                    `Project Team (${activeWorkspace.members.length})`,
                  )}
                </span>
                {activeProjectRole === 'leader' && (
                  <button
                    type="button"
                    onClick={() => openProjectTab('settings')}
                    className="inline-flex items-center gap-1 text-[10px] font-medium text-indigo-300 hover:text-indigo-200 cursor-pointer"
                    title={L('Undang anggota tim ke proyek ini', 'Invite teammates to this project')}
                  >
                    <UserPlus className="w-3 h-3" />
                    <span>{L('Undang', 'Invite')}</span>
                  </button>
                )}
              </div>
              {activeWorkspace.members.map((m) => {
                const isLive = liveUserIds.has(m.userId);
                return (
                  <div
                    key={m.userId}
                    className="px-2.5 py-1.5 rounded-xl flex items-center justify-between gap-2 text-xs hover:bg-white/[0.03]"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="relative shrink-0">
                        <img
                          src={m.avatarUrl}
                          alt={m.username}
                          className="w-6 h-6 rounded-full ring-1 ring-white/15 bg-zinc-800"
                        />
                        {isLive && (
                          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-cyan-400 ring-2 ring-[#0b0c12] animate-pulse" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-zinc-200 truncate">
                          @{m.username}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded ${
                        isLive
                          ? 'bg-cyan-500/15 text-cyan-300'
                          : m.role === 'leader'
                            ? 'bg-indigo-500/15 text-indigo-300'
                            : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {isLive ? 'LIVE' : m.role === 'leader' ? 'Lead' : L('Anggota', 'Member')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <nav className="space-y-1">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 px-2 pb-1">
              Platform
            </div>
            <SidebarItem
              active={navScope === 'console' && consoleSection === 'home'}
              onClick={() => openConsoleSection('home')}
              icon={<Home className="w-4 h-4" />}
              label={L('Ringkasan', 'Overview')}
            />
            <SidebarItem
              active={navScope === 'console' && consoleSection === 'projects'}
              onClick={() => openConsoleSection('projects')}
              icon={<Layers className="w-4 h-4" />}
              label={L('Proyek', 'Projects')}
              badge={workspaces.length > 0 ? String(workspaces.length) : undefined}
            />
            <SidebarItem
              active={navScope === 'console' && consoleSection === 'invitations'}
              onClick={() => openConsoleSection('invitations')}
              icon={<Mail className="w-4 h-4" />}
              label={L('Undangan', 'Invitations')}
              badge={incomingInvitations.length > 0 ? String(incomingInvitations.length) : undefined}
              badgeTone="emerald"
            />
            <SidebarItem
              active={navScope === 'console' && consoleSection === 'repos'}
              onClick={() => openConsoleSection('repos')}
              icon={<FolderGit2 className="w-4 h-4" />}
              label={L('Repo GitHub', 'GitHub Repos')}
              badge={repos.length > 0 ? String(repos.length) : undefined}
              badgeTone="cyan"
            />
            <SidebarItem
              active={navScope === 'console' && consoleSection === 'activity'}
              onClick={() => openConsoleSection('activity')}
              icon={<Activity className="w-4 h-4" />}
              label={L('Log Aktivitas', 'Activity Logs')}
            />
            <SidebarItem
              active={navScope === 'console' && consoleSection === 'guide'}
              onClick={() => openConsoleSection('guide')}
              icon={<BookOpen className="w-4 h-4" />}
              label={L('Panduan Setup', 'Setup & Guide')}
            />
            <SidebarItem
              active={navScope === 'console' && consoleSection === 'vault'}
              onClick={() => openConsoleSection('vault')}
              icon={<KeyRound className="w-4 h-4" />}
              label={L('Integrasi & Vault', 'Integrations & Vault')}
            />
          </nav>
        )}
      </div>

      {/* Neutral Account Footer */}
      <div className="p-3 border-t border-white/8 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <img
            src={currentUser.avatarUrl}
            alt={currentUser.username}
            className="w-7 h-7 rounded-full border border-white/15 bg-zinc-800 shrink-0"
          />
          <div className="min-w-0">
            <div className="text-xs font-semibold text-zinc-200 truncate">
              {currentUser.displayName}
            </div>
            <div className="text-[10px] font-mono text-zinc-500 truncate">
              @{currentUser.username}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition cursor-pointer shrink-0"
          title={L('Keluar', 'Sign out')}
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-cp-grid text-zinc-100 flex">
      {/* Unified Desktop Left Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Sidebar */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] h-full z-10">{sidebarContent}</div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Slim Top Command Header */}
        <header className="sticky top-0 z-30 h-14 px-4 sm:px-6 border-b border-white/8 bg-[#07080c]/85 backdrop-blur-md flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-1.5 rounded-lg bg-zinc-900 border border-white/10 text-zinc-300 cursor-pointer"
            >
              <Menu className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 text-xs min-w-0">
              <span className="text-zinc-500 hidden sm:inline truncate max-w-[160px]">
                {navScope === 'console'
                  ? L('Konsol', 'Console')
                  : activeWorkspace?.name || L('Workspace Proyek', 'Project Workspace')}
              </span>
              <span className="text-zinc-700 hidden sm:inline">/</span>
              <span className="font-semibold text-white truncate">
                {navScope === 'console'
                  ? L(
                      CONSOLE_SECTION_LABELS[consoleSection].id,
                      CONSOLE_SECTION_LABELS[consoleSection].en,
                    )
                  : L(TAB_LABELS[activeTab].id, TAB_LABELS[activeTab].en)}
              </span>
              {navScope === 'project' && activeProjectRole && (
                <span
                  className={`hidden sm:inline-flex text-[10px] font-mono uppercase px-2 py-0.5 rounded-md border ${
                    activeProjectRole === 'leader'
                      ? 'bg-indigo-500/12 border-indigo-500/25 text-indigo-300'
                      : 'bg-cyan-500/12 border-cyan-500/25 text-cyan-300'
                  }`}
                >
                  {activeProjectRole === 'leader' ? 'Project Lead' : L('Kontributor', 'Contributor')}
                </span>
              )}
            </div>
          </div>

          {/* Center Search / Command Palette Trigger (active project scope only) */}
          {navScope === 'project' && activeWorkspace && (
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="hidden md:flex items-center justify-between gap-6 px-3 py-1.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-900 border border-white/10 text-xs text-zinc-400 transition cursor-pointer w-64"
            >
              <span className="inline-flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-zinc-500" />
                <span>{L('Cari tugas atau perintah...', 'Search tasks or commands...')}</span>
              </span>
              <kbd className="px-1.5 py-0.5 rounded bg-zinc-950 border border-white/10 font-mono text-[10px] text-zinc-400">
                Ctrl K
              </kbd>
            </button>
          )}

          {/* Right Controls (Neutral Identity) */}
          <div className="flex items-center gap-2.5 shrink-0">
            {navScope === 'project' &&
              latestDeploy?.previewUrl &&
              latestDeploy.status === 'READY' &&
              !latestDeploy.vercelDeploymentId?.startsWith('dpl_sim_') && (
                <a
                  href={latestDeploy.previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 text-emerald-300 text-[11px] font-mono transition"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>{L('Pratinjau Langsung', 'Live Preview')}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}

            <LanguageToggle />

            <button
              type="button"
              onClick={() => openConsoleSection('vault')}
              className="flex items-center gap-2 pl-2 border-l border-white/10 hover:opacity-90 transition cursor-pointer"
              title={L('Pengaturan Akun & Vault', 'Account & Vault Settings')}
            >
              <img
                src={currentUser.avatarUrl}
                alt={currentUser.username}
                className="w-7 h-7 rounded-full border border-white/15 bg-zinc-800"
              />
              <span className="hidden sm:inline text-xs font-medium text-zinc-200">
                @{currentUser.username}
              </span>
            </button>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
              title={L('Keluar', 'Sign out')}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Unified Dynamic Canvas */}
        <main className="flex-1 max-w-[1400px] w-full mx-auto px-4 sm:px-6 py-6">
          <AnimatePresence mode="wait" initial={false}>
            {navScope === 'console' ? (
              <motion.div
                key={`console-${consoleSection}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18, ease: EASE_OUT_EXPO }}
              >
                <ConsoleViewRouter
                  section={consoleSection}
                  currentUser={currentUser}
                  workspaces={workspaces}
                  capabilities={capabilities}
                  repos={repos}
                  reposLoading={reposLoading}
                  reposError={reposError}
                  incomingInvitations={incomingInvitations}
                  sentInvitations={sentInvitations}
                  pendingInviteCode={pendingInviteCode}
                  onRefreshRepos={loadGitHubRepos}
                  onRefreshInvitations={loadInvitations}
                  onWorkspaceJoined={handleWorkspaceJoined}
                  onImportRepo={async (repo) => {
                    await handleImportRepo(repo);
                  }}
                  importingRepoId={importingRepoId}
                  onNavigateSection={openConsoleSection}
                  onEnterProject={handleEnterProject}
                  onOpenNewWorkspaceModal={() => setShowNewWorkspace(true)}
                  onWorkspaceUpdated={handleWorkspaceUpdated}
                  onWorkspaceDeleted={handleWorkspaceDeleted}
                  onUserUpdated={setCurrentUser}
                  onToast={pushToast}
                />
              </motion.div>
            ) : !activeWorkspace ? (
              <motion.div
                key="no-project"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18, ease: EASE_OUT_EXPO }}
                className="cp-panel p-12 rounded-2xl text-center space-y-4 max-w-xl mx-auto mt-8"
              >
                <h2 className="text-xl font-semibold text-white">
                  {L('Belum ada proyek yang dipilih', 'No project selected')}
                </h2>
                <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                  {locale === 'id' ? (
                    <>
                      Buat workspace proyek pertamamu untuk menghubungkan repository GitHub,
                      mengaktifkan proteksi branch <code>main</code>, mengatur tugas Kanban, dan
                      deploy ke Vercel.
                    </>
                  ) : (
                    <>
                      Create your first project workspace to link a GitHub repository, enable{' '}
                      <code>main</code> branch protection, organize Kanban tasks, and deploy to
                      Vercel.
                    </>
                  )}
                </p>
                <button
                  type="button"
                  onClick={() => setShowNewWorkspace(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{L('Buat Proyek Pertama', 'Create First Project')}</span>
                </button>
              </motion.div>
            ) : (
              <motion.div
                key={`project-${activeWorkspace.id}-${activeTab}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18, ease: EASE_OUT_EXPO }}
              >
                {workspaceLoading ? (
                  <WorkspaceViewSkeleton tab={activeTab} />
                ) : (
                  <>
                {activeTab === 'board' && (
                  <KanbanBoard
                    workspace={activeWorkspace}
                    tasks={tasks}
                    currentUser={currentUser}
                    externalCreateOpen={externalCreateOpen}
                    onCloseExternalCreate={() => setExternalCreateOpen(false)}
                    onTasksChange={setTasks}
                    onOpenTask={(t) => setSelectedTask(t)}
                    onToast={pushToast}
                  />
                )}

                {activeTab === 'gatekeeper' && (
                  <GatekeeperCenter
                    workspace={activeWorkspace}
                    tasks={tasks}
                    events={webhookEvents}
                    currentUser={currentUser}
                    onWorkspaceUpdated={(ws) =>
                      setWorkspaces((prev) => prev.map((w) => (w.id === ws.id ? ws : w)))
                    }
                    onOpenTask={(t) => setSelectedTask(t)}
                    onToast={pushToast}
                  />
                )}

                {activeTab === 'deployments' && (
                  <DeploymentsPanel
                    workspace={activeWorkspace}
                    deployments={deployments}
                    currentUser={currentUser}
                    onWorkspaceUpdated={(ws) =>
                      setWorkspaces((prev) => prev.map((w) => (w.id === ws.id ? ws : w)))
                    }
                    onUserUpdated={setCurrentUser}
                    onDeploymentCreated={(dep) =>
                      setDeployments((prev) =>
                        prev.some((d) => d.id === dep.id) ? prev : [dep, ...prev],
                      )
                    }
                    onOpenSettings={() => openProjectTab('settings')}
                    onToast={pushToast}
                  />
                )}

                {activeTab === 'live' && (
                  <LiveMonitorPanel
                    workspace={activeWorkspace}
                    tasks={tasks}
                    sessions={liveSessions}
                    currentUser={currentUser}
                    iceServers={
                      capabilities?.iceServers || [
                        { urls: 'stun:stun.l.google.com:19302' },
                      ]
                    }
                    onSessionsChange={setLiveSessions}
                    onToast={pushToast}
                  />
                )}

                {activeTab === 'settings' && (
                  <SettingsPanel
                    workspace={activeWorkspace}
                    currentUser={currentUser}
                    capabilities={capabilities}
                    onWorkspaceUpdated={handleWorkspaceUpdated}
                    onWorkspaceDeleted={handleWorkspaceDeleted}
                    onUserUpdated={setCurrentUser}
                    onToast={pushToast}
                  />
                )}
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Global Command Palette */}
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        tasks={tasks}
        onNavigate={(tab) => {
          setNavScope('project');
          setActiveTab(tab);
        }}
        onSelectTask={(task) => setSelectedTask(task)}
        onNewTask={() => {
          setNavScope('project');
          setActiveTab('board');
          setExternalCreateOpen(true);
        }}
      />

      {/* Task Detail & Gatekeeper Diff Modal */}
      {selectedTask && activeWorkspace && (
        <TaskDiffModal
          workspace={activeWorkspace}
          task={selectedTask}
          currentUser={currentUser}
          onClose={() => setSelectedTask(null)}
          onTaskUpdated={(updated) => {
            setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
            setSelectedTask(updated);
          }}
          onToast={pushToast}
        />
      )}

      {/* Create Workspace Modal */}
      {showNewWorkspace && (
        <CreateWorkspaceModal
          onClose={() => setShowNewWorkspace(false)}
          onCreated={async (ws) => {
            setWorkspaces((prev) => [...prev, ws]);
            setActiveWorkspaceId(ws.id);
            await loadWorkspaceData(ws.id);
            setShowNewWorkspace(false);
            setActiveTab('board');
            setNavScope('project');
            pushToast(
              'success',
              L(`Proyek "${ws.name}" berhasil dibuat!`, `Project "${ws.name}" created!`),
            );
          }}
          onError={(msg) => pushToast('error', msg)}
        />
      )}

      {/* Toast Stack */}
      {toastOverlay}
    </div>
  );
}

function SidebarItem({
  active,
  onClick,
  icon,
  label,
  badge,
  badgeTone = 'zinc',
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: string;
  badgeTone?: 'zinc' | 'violet' | 'emerald' | 'rose' | 'amber' | 'cyan';
}) {
  const toneClasses: Record<NonNullable<typeof badgeTone>, string> = {
    zinc: 'bg-zinc-800 text-zinc-300',
    violet: 'bg-violet-500/20 text-violet-300',
    emerald: 'bg-emerald-500/20 text-emerald-300',
    rose: 'bg-rose-500/20 text-rose-300',
    amber: 'bg-amber-500/20 text-amber-300',
    cyan: 'bg-cyan-500/20 text-cyan-300',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
        active
          ? 'bg-indigo-500/15 text-white border border-indigo-500/30 shadow-sm'
          : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.04] border border-transparent'
      }`}
    >
      <span className="flex items-center gap-2.5 min-w-0">
        <span className={active ? 'text-indigo-400' : 'text-zinc-500'}>{icon}</span>
        <span className="truncate">{label}</span>
      </span>
      {badge && (
        <span
          className={`px-1.5 py-0.5 rounded font-mono text-[10px] shrink-0 tabular-nums ${toneClasses[badgeTone]}`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function CreateWorkspaceModal({
  onClose,
  onCreated,
  onError,
}: {
  onClose: () => void;
  onCreated: (ws: Workspace) => Promise<void>;
  onError: (msg: string) => void;
}) {
  const { L } = useLanguage();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const { workspace } = await api.createWorkspace({
        name: name.trim(),
        description: description.trim(),
      });
      await onCreated(workspace);
    } catch (err) {
      onError(
        err instanceof Error
          ? err.message
          : L('Gagal membuat workspace', 'Failed to create workspace'),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-[#10121b] border border-white/12 shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">
            {L('Buat Workspace Baru', 'Create New Workspace')}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              {L('Nama Proyek / Workspace', 'Project / Workspace Name')}
            </label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={L('mis. SmartLibrary Capstone', 'e.g. SmartLibrary Capstone')}
              className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-white/10 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              {L('Deskripsi', 'Description')}
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={L(
                'Ringkasan singkat proyek tim Anda...',
                'Short summary of your team project...',
              )}
              className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-white/10 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-medium hover:bg-zinc-700 cursor-pointer"
            >
              {L('Batal', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold disabled:opacity-50 cursor-pointer"
            >
              {saving ? L('Membuat...', 'Creating...') : L('Buat Workspace', 'Create Workspace')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default App;
