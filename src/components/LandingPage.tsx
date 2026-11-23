import { type MouseEvent, useEffect, useRef, useState } from 'react';
import Lenis from 'lenis';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  ArrowRight,
  Check,
  CheckCircle2,
  GitBranch,
  GitMerge,
  Globe,
  Kanban,
  Layers,
  Lock,
  Monitor,
  Radio,
  Rocket,
  ShieldCheck,
} from 'lucide-react';
import type { PublicUser } from '../../shared/types.ts';
import { useLanguage } from '../lib/i18nContext.ts';
import { EASE_OUT_EXPO, VIEWPORT_REVEAL } from '../lib/motion.ts';
import { CodePulseLogo } from './CodePulseLogo.tsx';
import { LanguageToggle } from './LanguageToggle.tsx';
import {
  ArchitecturePageView,
  CapabilitiesPageView,
  GovernancePageView,
  WorkflowPageView,
} from './PublicPages.tsx';

interface LandingPageProps {
  currentUser: PublicUser | null;
  onOpenAuth: (mode?: 'login' | 'register') => void;
  onReturnToWorkspace?: () => void;
}

type PreviewTab = 'kanban' | 'gatekeeper' | 'webrtc' | 'vercel';
type PublicPage = 'overview' | 'capabilities' | 'workflow' | 'governance' | 'architecture';

const PUBLIC_PAGE_PATHS: Record<PublicPage, string> = {
  overview: '/',
  capabilities: '/capabilities',
  workflow: '/workflow',
  governance: '/governance',
  architecture: '/architecture',
};

const PUBLIC_NAV_ITEMS: Array<{ id: PublicPage; label: { id: string; en: string } }> = [
  { id: 'overview', label: { id: 'Ringkasan', en: 'Overview' } },
  { id: 'capabilities', label: { id: 'Fitur', en: 'Capabilities' } },
  { id: 'workflow', label: { id: 'Alur Kerja', en: 'Workflow' } },
  { id: 'governance', label: { id: 'Tata Kelola', en: 'Governance' } },
  { id: 'architecture', label: { id: 'Arsitektur', en: 'Architecture' } },
];

const OVERVIEW_METRICS = [
  {
    key: 'commit-sync',
    value: '< 3s',
    label: { id: 'Sinkronisasi Commit ke Board', en: 'Commit-to-Board Sync' },
    detail: {
      id: 'Pipeline webhook terverifikasi HMAC-SHA256',
      en: 'HMAC-SHA256 verified webhook pipeline',
    },
    tone: 'text-cyan-300',
  },
  {
    key: 'direct-pushes',
    value: '0',
    label: { id: 'Direct Push ke Main', en: 'Direct Main Pushes' },
    detail: {
      id: 'Ditegakkan via proteksi branch @octokit/rest',
      en: 'Enforced via @octokit/rest branch guard',
    },
    tone: 'text-emerald-300',
  },
  {
    key: 'webrtc-streams',
    value: '60 FPS',
    label: { id: 'Stream IDE P2P di Browser', en: 'Browser P2P IDE Streams' },
    detail: {
      id: 'Berbagi layar WebRTC 1080p tanpa plugin',
      en: '1080p zero-plugin WebRTC screen sharing',
    },
    tone: 'text-indigo-300',
  },
  {
    key: 'aes-vault',
    value: '256-bit',
    label: { id: 'Vault Kredensial AES-GCM', en: 'AES-GCM Credential Vault' },
    detail: {
      id: 'Token GitHub & Vercel khusus sisi server',
      en: 'Server-only GitHub & Vercel tokens',
    },
    tone: 'text-amber-300',
  },
] as const;

const EXPLORE_DIRECTORY: Array<{
  page: Exclude<PublicPage, 'overview'>;
  tag: { id: string; en: string };
  title: { id: string; en: string };
  description: { id: string; en: string };
  accent: string;
}> = [
  {
    page: 'capabilities',
    tag: { id: 'RANGKAIAN MODUL', en: 'MODULE SUITE' },
    title: { id: 'Fitur Platform', en: 'Platform Capabilities' },
    description: {
      id: 'Jelajahi otomatisasi webhook, penguncian branch, feed WebRTC, dan deploy Vercel Edge.',
      en: 'Explore webhook automation, branch locking, WebRTC feeds, and Vercel Edge deploys.',
    },
    accent: 'text-indigo-300 border-indigo-500/25',
  },
  {
    page: 'workflow',
    tag: { id: 'PIPELINE 5 TAHAP', en: '5-STEP PIPELINE' },
    title: { id: 'Alur Kerja End-to-End', en: 'End-to-End Workflow' },
    description: {
      id: 'Telusuri setiap tahap otomatis mulai dari penandaan commit fitur hingga merge produksi.',
      en: 'Inspect each automated stage from feature commit tagging to production merge.',
    },
    accent: 'text-cyan-300 border-cyan-500/25',
  },
  {
    page: 'governance',
    tag: { id: 'MATRIKS RBAC', en: 'RBAC MATRIX' },
    title: { id: 'Tata Kelola Peran', en: 'Role Governance' },
    description: {
      id: 'Bandingkan izin eksekusi Anggota Tim terhadap gerbang persetujuan Project Leader.',
      en: 'Compare Team Member execution permissions against Project Leader approval gates.',
    },
    accent: 'text-emerald-300 border-emerald-500/25',
  },
  {
    page: 'architecture',
    tag: { id: 'EKOSISTEM TERBUKA', en: 'OPEN ECOSYSTEM' },
    title: { id: 'Arsitektur Terbuka', en: 'Open Architecture' },
    description: {
      id: 'Pelajari dukungan multi-stack open-source, keamanan Vault AES-256-GCM, dan transport P2P tanpa vendor lock-in.',
      en: 'Explore multi-stack open-source compatibility, AES-256-GCM Vault security, and zero-lock-in P2P transport.',
    },
    accent: 'text-violet-300 border-violet-500/25',
  },
];

function readPublicPageFromPath(pathname: string): PublicPage {
  if (pathname === '/capabilities') return 'capabilities';
  if (pathname === '/workflow') return 'workflow';
  if (pathname === '/governance') return 'governance';
  if (pathname === '/architecture') return 'architecture';
  return 'overview';
}

export function LandingPage({
  currentUser,
  onOpenAuth,
  onReturnToWorkspace,
}: LandingPageProps) {
  const { L } = useLanguage();
  const [activePage, setActivePage] = useState<PublicPage>(() =>
    typeof window === 'undefined' ? 'overview' : readPublicPageFromPath(window.location.pathname),
  );
  const [previewTab, setPreviewTab] = useState<PreviewTab>('kanban');
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const lenis = new Lenis({
      duration: 1.15,
      smoothWheel: true,
      wheelMultiplier: 0.95,
    });
    lenisRef.current = lenis;

    let rafId = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      rafId = window.requestAnimationFrame(raf);
    };
    rafId = window.requestAnimationFrame(raf);

    return () => {
      window.cancelAnimationFrame(rafId);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  useEffect(() => {
    function handlePopState() {
      setActivePage(readPublicPageFromPath(window.location.pathname));
    }
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  function switchToPublicPage(page: PublicPage) {
    setActivePage(page);
    const nextPath = PUBLIC_PAGE_PATHS[page];
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
    if (lenisRef.current) {
      lenisRef.current.scrollTo(0, { immediate: true });
    } else {
      window.scrollTo({ top: 0 });
    }
  }

  function navigateToPage(event: MouseEvent<HTMLAnchorElement>, page: PublicPage) {
    event.preventDefault();
    switchToPublicPage(page);
  }

  function handlePrimaryAction() {
    if (currentUser && onReturnToWorkspace) {
      onReturnToWorkspace();
      return;
    }
    onOpenAuth('login');
  }

  return (
    <div className="min-h-screen bg-[#06070b] text-zinc-100 selection:bg-indigo-500/30 selection:text-indigo-200 flex flex-col justify-between">
      {/* Subtle Ambient Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[960px] h-[520px] rounded-full bg-indigo-600/12 blur-[140px]" />
        <div className="absolute top-[28%] right-[-10%] w-[520px] h-[420px] rounded-full bg-cyan-500/8 blur-[140px]" />
        <div className="bg-cp-grid absolute inset-0 opacity-75" />
      </div>

      {/* Sticky Enterprise Header */}
      <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#06070b]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <a
            href="/"
            onClick={(e) => navigateToPage(e, 'overview')}
            className="flex items-center gap-2.5 shrink-0"
          >
            <CodePulseLogo size="md" />
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-white text-base">
                CodePulse
              </span>
              <span className="hidden sm:inline-flex text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-md bg-white/[0.06] border border-white/10 text-zinc-300">
                {L('Hub Enterprise', 'Enterprise Hub')}
              </span>
            </div>
          </a>

          <nav className="hidden md:flex items-center gap-1 text-xs font-medium">
            {PUBLIC_NAV_ITEMS.map((item) => {
              const isActive = activePage === item.id;
              return (
                <a
                  key={item.id}
                  href={PUBLIC_PAGE_PATHS[item.id]}
                  onClick={(e) => navigateToPage(e, item.id)}
                  className={`relative px-3.5 py-1.5 rounded-lg transition ${
                    isActive ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="public-nav-pill"
                      transition={{ type: 'spring', stiffness: 440, damping: 34 }}
                      className="absolute inset-0 rounded-lg bg-white/[0.07] border border-white/10"
                    />
                  )}
                  <span className="relative z-10">{L(item.label.id, item.label.en)}</span>
                </a>
              );
            })}
          </nav>

          <div className="flex items-center gap-2.5 shrink-0">
            <LanguageToggle />
            {currentUser ? (
              <button
                type="button"
                onClick={handlePrimaryAction}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-semibold shadow-lg transition cursor-pointer"
              >
                <span>{L('Kembali ke Workspace', 'Return to Workspace')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onOpenAuth('login')}
                  className="inline-flex px-3 sm:px-3.5 py-2 rounded-xl border border-white/12 hover:bg-white/[0.05] text-zinc-200 text-xs font-medium transition cursor-pointer"
                >
                  {L('Masuk', 'Sign In')}
                </button>
                <button
                  type="button"
                  onClick={() => onOpenAuth('register')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-semibold shadow-lg transition cursor-pointer"
                >
                  <span>{L('Daftar', 'Sign Up')}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Mobile Page Navigation Strip */}
        <nav className="md:hidden border-t border-white/[0.06] px-4 py-2 flex items-center gap-1.5 overflow-x-auto text-xs font-medium">
          {PUBLIC_NAV_ITEMS.map((item) => {
            const isActive = activePage === item.id;
            return (
              <a
                key={item.id}
                href={PUBLIC_PAGE_PATHS[item.id]}
                onClick={(e) => navigateToPage(e, item.id)}
                className={`px-3 py-1 rounded-lg whitespace-nowrap transition ${
                  isActive
                    ? 'bg-white/[0.09] border border-white/12 text-white'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {L(item.label.id, item.label.en)}
              </a>
            );
          })}
        </nav>
      </header>

      <main className="relative z-10 flex-1">
        <AnimatePresence mode="wait" initial={false}>
          {activePage === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: EASE_OUT_EXPO }}
            >
        {/* HERO SECTION */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-24 pb-16">
          <div className="max-w-4xl mx-auto text-center space-y-7">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/25 text-indigo-200 text-xs font-medium"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                {L(
                  'Tata Kelola Engineering Terpadu • GitHub Gatekeeper • Vercel Edge',
                  'Unified Engineering Governance • GitHub Gatekeeper • Vercel Edge',
                )}
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.58, delay: 0.08, ease: EASE_OUT_EXPO }}
              className="text-4xl sm:text-6xl lg:text-[64px] font-bold tracking-[-0.03em] text-white leading-[1.04]"
            >
              {L('Kendalikan Setiap Commit.', 'Control Every Commit.')}{' '}
              <span className="bg-gradient-to-r from-indigo-300 via-cyan-300 to-emerald-300 bg-clip-text text-transparent">
                {L('Rilis ke Produksi Tanpa Hambatan.', 'Ship Production With Zero Friction.')}
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.58, delay: 0.16, ease: EASE_OUT_EXPO }}
              className="text-base sm:text-lg text-zinc-400 leading-relaxed max-w-2xl mx-auto"
            >
              {L(
                <>
                  CodePulse menyatukan orkestrasi proyek Kanban, sinkronisasi webhook GitHub
                  otomatis, proteksi ketat branch <code>main</code>, pemantauan IDE WebRTC langsung
                  di browser, dan deploy Vercel sekali klik dalam satu hub enterprise tanpa
                  instalasi.
                </>,
                <>
                  CodePulse unifies Kanban project orchestration, automated GitHub webhook sync,
                  strict <code>main</code> branch protection, browser-native WebRTC IDE monitoring,
                  and one-click Vercel deployments into one zero-install enterprise hub.
                </>,
              )}
            </motion.p>
          </div>

          {/* Interactive Enterprise Product Showcase */}
          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.68, delay: 0.24, ease: EASE_OUT_EXPO }}
            className="mt-14 max-w-6xl mx-auto"
          >
            <div className="rounded-2xl border border-white/12 bg-[#0b0d14]/95 shadow-[0_32px_90px_-20px_rgba(0,0,0,0.85)] overflow-hidden backdrop-blur-xl">
              {/* Showcase Window Chrome */}
              <div className="px-4 py-3 border-b border-white/10 bg-zinc-950/90 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500/70" />
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
                  </div>
                  <div className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-white/8 text-[11px] font-mono text-zinc-400">
                    app.codepulse.hub / campussync-portal
                  </div>
                </div>

                <span className="text-[11px] font-mono text-zinc-500">
                  {L('Pratinjau Produk Interaktif', 'Interactive Product Preview')}
                </span>
              </div>

              {/* Showcase Viewport with App Shell Sidebar + Telemetry */}
              <div className="flex flex-col md:flex-row min-h-[430px] bg-gradient-to-b from-[#0d1018] to-[#08090e]">
                {/* Mini Left App Sidebar */}
                <div className="hidden md:flex w-52 shrink-0 flex-col justify-between bg-[#090b11] border-r border-white/8 p-3.5 text-left">
                  <div className="space-y-4">
                    <div className="p-2.5 rounded-xl bg-zinc-950/90 border border-white/8 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-white truncate">
                          CampusSync Portal
                        </span>
                        <Lock className="w-3 h-3 text-emerald-400 shrink-0" />
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-400 truncate">
                        <GitBranch className="w-3 h-3 text-cyan-400 shrink-0" />
                        <span className="truncate">campussync-web</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500 px-2 pb-1">
                        {L('Workspace', 'Workspace')}
                      </div>
                      {(
                        [
                          {
                            id: 'kanban',
                            label: L('Sinkronisasi Kanban', 'Kanban Sync'),
                            icon: <Kanban className="w-3.5 h-3.5" />,
                            count: '6',
                          },
                          {
                            id: 'gatekeeper',
                            label: L('Diff Gatekeeper', 'Gatekeeper Diff'),
                            icon: <ShieldCheck className="w-3.5 h-3.5" />,
                            count: '2 PR',
                          },
                          {
                            id: 'webrtc',
                            label: L('Monitor Langsung', 'Live Monitor'),
                            icon: <Monitor className="w-3.5 h-3.5" />,
                            count: '2 LIVE',
                          },
                          {
                            id: 'vercel',
                            label: 'Vercel Edge',
                            icon: <Rocket className="w-3.5 h-3.5" />,
                            count: L('SIAP', 'READY'),
                          },
                        ] as const
                      ).map((nav) => {
                        const isActive = previewTab === nav.id;
                        return (
                          <button
                            key={nav.id}
                            type="button"
                            onClick={() => setPreviewTab(nav.id)}
                            className={`relative w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[11px] font-medium transition cursor-pointer ${
                              isActive
                                ? 'text-white'
                                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03]'
                            }`}
                          >
                            {isActive && (
                              <motion.span
                                layoutId="showcase-nav-active"
                                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                                className="absolute inset-0 rounded-lg bg-indigo-500/15 border border-indigo-500/30"
                              />
                            )}
                            <span className="relative z-10 flex items-center gap-2 truncate">
                              <span className={isActive ? 'text-indigo-400' : 'text-zinc-500'}>
                                {nav.icon}
                              </span>
                              <span>{nav.label}</span>
                            </span>
                            <span className="relative z-10 font-mono text-[9px] text-zinc-400">
                              {nav.count}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <div className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500 px-2">
                        {L('Tim Aktif', 'Active Team')}
                      </div>
                      {[
                        { handle: '@rizky-lead', status: L('Leader', 'Leader'), dot: 'bg-indigo-400' },
                        { handle: '@nadia-dev', status: L('IDE Live', 'Live IDE'), dot: 'bg-cyan-400' },
                        { handle: '@bima-dev', status: L('IDE Live', 'Live IDE'), dot: 'bg-emerald-400' },
                      ].map((member) => (
                        <div
                          key={member.handle}
                          className="flex items-center justify-between px-2 py-1 text-[11px]"
                        >
                          <span className="flex items-center gap-2 text-zinc-300 truncate">
                            <span className={`w-1.5 h-1.5 rounded-full ${member.dot}`} />
                            <span className="truncate">{member.handle}</span>
                          </span>
                          <span className="font-mono text-[9px] text-zinc-500">{member.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-zinc-950/90 border border-white/8 space-y-1 text-[10px]">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500">{L('Sinkronisasi Webhook', 'Webhook Sync')}</span>
                      <span className="font-mono text-cyan-300">84ms</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500">Direct Push</span>
                      <span className="font-mono text-emerald-300">
                        {L('0 Diizinkan', '0 Allowed')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Main Interactive Preview Canvas */}
                <div className="flex-1 p-5 sm:p-6 flex flex-col justify-between gap-4 min-w-0">
                  {/* Top Workspace Telemetry Strip */}
                  <div className="px-3.5 py-2.5 rounded-xl bg-zinc-950/85 border border-white/8 flex flex-wrap items-center justify-between gap-3 text-[11px]">
                    <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                      <span className="font-semibold text-zinc-200 whitespace-nowrap">
                        {L('Progres Sprint', 'Sprint Delivery')}
                      </span>
                      <div className="h-1.5 flex-1 max-w-[180px] rounded-full bg-zinc-900 overflow-hidden flex">
                        <div className="w-[25%] bg-emerald-500" />
                        <div className="w-[33%] bg-violet-500" />
                        <div className="w-[17%] bg-sky-500" />
                      </div>
                      <span className="font-mono text-[10px] text-emerald-300">
                        {L('4 / 6 Aktif', '4 / 6 Active')}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 font-mono text-[10px]">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/12 text-emerald-300 border border-emerald-500/20">
                        <Lock className="w-2.5 h-2.5" />
                        {L('main terlindungi', 'main protected')}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-500/12 text-cyan-300 border border-cyan-500/20">
                        <Radio className="w-2.5 h-2.5 animate-pulse" />
                        {L('2 WebRTC aktif', '2 WebRTC live')}
                      </span>
                    </div>
                  </div>

                  {/* Active Tab Viewport */}
                  <div className="flex-1 flex flex-col justify-center">
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.div
                        key={previewTab}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.22, ease: EASE_OUT_EXPO }}
                      >
                        {previewTab === 'kanban' && <KanbanShowcase />}
                        {previewTab === 'gatekeeper' && <GatekeeperShowcase />}
                        {previewTab === 'webrtc' && <WebRTCShowcase />}
                        {previewTab === 'vercel' && <VercelShowcase />}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* ENTERPRISE PILLARS STRIP */}
        <section className="border-y border-white/[0.07] bg-zinc-950/60">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <EnterpriseHighlight
              delay={0}
              icon={<ShieldCheck className="w-4 h-4 text-emerald-400" />}
              title={L('Tata Kelola Enterprise', 'Enterprise Governance')}
              description={L(
                'Review Pull Request wajib dan proteksi branch produksi di setiap repository.',
                'Mandatory pull-request reviews and protected production branches across every repository.',
              )}
            />
            <EnterpriseHighlight
              delay={0.07}
              icon={<Activity className="w-4 h-4 text-cyan-400" />}
              title={L('Visibilitas Real-Time', 'Real-Time Visibility')}
              description={L(
                'Pembaruan commit-ke-board otomatis dipadukan dengan kolaborasi IDE langsung di browser.',
                'Automated commit-to-board updates paired with live browser IDE collaboration.',
              )}
            />
            <EnterpriseHighlight
              delay={0.14}
              icon={<Rocket className="w-4 h-4 text-amber-400" />}
              title={L('Continuous Delivery', 'Continuous Delivery')}
              description={L(
                'Deployment produksi ke Vercel Edge yang ringkas dengan telemetri build secara langsung.',
                'Streamlined production deployments to Vercel Edge with live build telemetry.',
              )}
            />
            <EnterpriseHighlight
              delay={0.21}
              icon={<Globe className="w-4 h-4 text-indigo-400" />}
              title={L('Tanpa Instalasi Klien', 'Zero Client Footprint')}
              description={L(
                '100% hub engineering berbasis browser—tanpa agen desktop atau plugin IDE tambahan.',
                '100% browser-native engineering hub—no desktop agents or IDE plugins required.',
              )}
            />
          </div>
        </section>

        {/* OPERATIONAL BENCHMARKS */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-20">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {OVERVIEW_METRICS.map((metric, idx) => (
              <motion.div
                key={metric.key}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={VIEWPORT_REVEAL}
                transition={{ duration: 0.45, delay: idx * 0.06, ease: EASE_OUT_EXPO }}
                className="cp-panel rounded-2xl p-5 sm:p-6 space-y-1.5"
              >
                <div className={`text-2xl sm:text-3xl font-bold font-mono tracking-tight ${metric.tone}`}>
                  {metric.value}
                </div>
                <div className="text-xs sm:text-sm font-semibold text-white">
                  {L(metric.label.id, metric.label.en)}
                </div>
                <p className="text-[11px] sm:text-xs text-zinc-400 leading-relaxed">
                  {L(metric.detail.id, metric.detail.en)}
                </p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* EDITORIAL VISUAL SPOTLIGHT 1: UNIFIED COMMAND PLANE */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 space-y-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={VIEWPORT_REVEAL}
              transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
              className="lg:col-span-5 space-y-5"
            >
              <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-indigo-400">
                <Layers className="w-3.5 h-3.5" />
                <span>{L('Kontrol Engineering Terpadu', 'Unified Engineering Control')}</span>
              </div>
              <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-white leading-[1.12]">
                {L(
                  'Hentikan merge tanpa izin dan dashboard proyek yang terpisah-pisah.',
                  'Eliminate shadow merges and fragmented project dashboards.',
                )}
              </h2>
              <p className="text-sm text-zinc-400 leading-relaxed">
                {L(
                  'Daripada berpindah-pindah antara pelacak tugas, konsol kebijakan branch, perekam layar, dan log deployment di alat yang terpisah, CodePulse menyatukan seluruh siklus pengiriman perangkat lunak Anda dalam satu pusat kendali browser.',
                  'Instead of juggling issue trackers, branch policy consoles, screen recorders, and deployment logs across separate tools, CodePulse unites your entire software delivery loop inside one browser control plane.',
                )}
              </p>
              <ul className="space-y-2.5 text-xs sm:text-sm text-zinc-300 pt-1">
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    {L(
                      'Commit bertanda #CP-XX otomatis memperbarui kolom Kanban',
                      'Commits tagged with #CP-XX automatically update Kanban columns',
                    )}
                  </span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    {L(
                      'Wajib review diff oleh Leader sebelum merge masuk ke branch main',
                      'Mandatory Leader diff review before any merge hits main',
                    )}
                  </span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    {L(
                      'Kredensial GitHub & Vercel terenkripsi dan terisolasi di sisi server',
                      'Encrypted GitHub & Vercel credentials isolated on the server',
                    )}
                  </span>
                </li>
              </ul>
              <div className="pt-2">
                <a
                  href="/capabilities"
                  onClick={(e) => navigateToPage(e, 'capabilities')}
                  className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-indigo-300 hover:text-indigo-200 transition group"
                >
                  <span>{L('Jelajahi Fitur Platform', 'Explore Platform Capabilities')}</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </a>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.985 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={VIEWPORT_REVEAL}
              transition={{ duration: 0.55, delay: 0.08, ease: EASE_OUT_EXPO }}
              className="lg:col-span-7"
            >
              <div className="cp-panel rounded-2xl p-2 sm:p-2.5 border-white/12 shadow-[0_28px_70px_-20px_rgba(0,0,0,0.85)]">
                <div className="relative rounded-xl overflow-hidden bg-zinc-950 aspect-[16/9]">
                  <img
                    src="/spotlight-command.jpg"
                    alt={L(
                      'Workstation telemetri terpadu dan tata kelola branch CodePulse',
                      'CodePulse unified telemetry and branch governance workstation',
                    )}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#06070b]/90 via-transparent to-transparent" />
                  <div className="absolute bottom-3.5 left-4 right-4 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
                    <span className="px-2.5 py-1 rounded-lg bg-[#090b11]/85 border border-white/12 text-zinc-200 backdrop-blur-md">
                      {L(
                        'Pusat Kendali • Webhook + Octokit Gatekeeper',
                        'Control Plane • Webhook + Octokit Gatekeeper',
                      )}
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 backdrop-blur-md">
                      {L('main terlindungi', 'main protected')}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* EDITORIAL VISUAL SPOTLIGHT 2: TEAM COLLABORATION */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.985 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={VIEWPORT_REVEAL}
              transition={{ duration: 0.55, ease: EASE_OUT_EXPO }}
              className="lg:col-span-7 order-2 lg:order-1"
            >
              <div className="cp-panel rounded-2xl p-2 sm:p-2.5 border-white/12 shadow-[0_28px_70px_-20px_rgba(0,0,0,0.85)]">
                <div className="relative rounded-xl overflow-hidden bg-zinc-950 aspect-[16/9]">
                  <img
                    src="/spotlight-collab.jpg"
                    alt={L(
                      'Engineer perangkat lunak meninjau arsitektur kode di hub CodePulse',
                      'Software engineers reviewing code architecture in CodePulse hub',
                    )}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#06070b]/90 via-transparent to-transparent" />
                  <div className="absolute bottom-3.5 left-4 right-4 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
                    <span className="px-2.5 py-1 rounded-lg bg-[#090b11]/85 border border-white/12 text-zinc-200 backdrop-blur-md">
                      {L(
                        'Monitor IDE Langsung • WebRTC P2P Browser',
                        'Live IDE Monitor • Browser WebRTC P2P',
                      )}
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 backdrop-blur-md">
                      {L('30 FPS Tanpa Instalasi', '30 FPS Zero-Install')}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={VIEWPORT_REVEAL}
              transition={{ duration: 0.5, delay: 0.08, ease: EASE_OUT_EXPO }}
              className="lg:col-span-5 order-1 lg:order-2 space-y-5"
            >
              <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-cyan-400">
                <Monitor className="w-3.5 h-3.5" />
                <span>{L('Visibilitas Tim Real-Time', 'Real-Time Team Visibility')}</span>
              </div>
              <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-white leading-[1.12]">
                {L(
                  'Pantau progres IDE secara langsung dan verifikasi rilis produksi secara visual.',
                  'Supervise live IDE progress and verify production releases visually.',
                )}
              </h2>
              <p className="text-sm text-zinc-400 leading-relaxed">
                {L(
                  'Developer tetap produktif di dalam Antigravity atau VS Code sambil menayangkan jendela IDE aktif melalui Chrome WebRTC kapan pun pair debugging dibutuhkan—dan Leader langsung melakukan deploy ke Vercel Edge segera setelah menyetujui diff.',
                  'Developers stay productive inside Antigravity or VS Code while streaming their active IDE window via Chrome WebRTC whenever pair debugging is needed—and leaders deploy to Vercel Edge immediately after approving diffs.',
                )}
              </p>
              <ul className="space-y-2.5 text-xs sm:text-sm text-zinc-300 pt-1">
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>
                    {L(
                      'Berbagi layar peer-to-peer langsung dari browser melalui getDisplayMedia',
                      'Direct browser peer-to-peer screen sharing via getDisplayMedia',
                    )}
                  </span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>
                    {L(
                      'Inspeksi unified diff baris demi baris sebelum Squash Merge',
                      'Line-by-line unified diff inspection before squash-merging',
                    )}
                  </span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>
                    {L(
                      'URL pratinjau Vercel Edge real-time langsung dikirim ke seluruh kolaborator',
                      'Real-time Vercel Edge preview URLs pushed to every collaborator',
                    )}
                  </span>
                </li>
              </ul>
              <div className="pt-2">
                <a
                  href="/workflow"
                  onClick={(e) => navigateToPage(e, 'workflow')}
                  className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-cyan-300 hover:text-cyan-200 transition group"
                >
                  <span>{L('Telusuri Alur Kerja End-to-End', 'Trace End-to-End Workflow')}</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </a>
              </div>
            </motion.div>
          </div>
        </section>

        {/* PLATFORM PAGES DIRECTORY STRIP */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-1.5">
              <div className="text-xs font-mono uppercase tracking-widest text-zinc-400">
                {L('Direktori Eksplorasi', 'Deep Dive Directory')}
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                {L(
                  'Jelajahi setiap lapisan CodePulse secara mendalam.',
                  'Explore every layer of CodePulse in detail.',
                )}
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {EXPLORE_DIRECTORY.map((item, idx) => (
              <motion.a
                key={item.page}
                href={PUBLIC_PAGE_PATHS[item.page]}
                onClick={(e) => navigateToPage(e, item.page)}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                whileHover={{ y: -3, transition: { duration: 0.18, ease: EASE_OUT_EXPO } }}
                viewport={VIEWPORT_REVEAL}
                transition={{ duration: 0.42, delay: idx * 0.06, ease: EASE_OUT_EXPO }}
                className="cp-panel rounded-2xl p-5 flex flex-col justify-between gap-4 hover:border-white/20 transition-colors group"
              >
                <div className="space-y-2.5">
                  <span
                    className={`inline-flex font-mono text-[10px] px-2 py-0.5 rounded-md border bg-zinc-950/90 ${item.accent}`}
                  >
                    {L(item.tag.id, item.tag.en)}
                  </span>
                  <h3 className="text-sm font-semibold text-white group-hover:text-indigo-200 transition">
                    {L(item.title.id, item.title.en)}
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {L(item.description.id, item.description.en)}
                  </p>
                </div>
                <div className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-300 group-hover:text-white pt-2 border-t border-white/[0.06]">
                  <span>{L('Buka halaman', 'Open page')}</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </motion.a>
            ))}
          </div>
        </section>
            </motion.div>
          )}

          {activePage === 'capabilities' && (
            <motion.div
              key="capabilities"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: EASE_OUT_EXPO }}
            >
              <CapabilitiesPageView
                onNavigatePage={switchToPublicPage}
                onOpenAuth={onOpenAuth}
              />
            </motion.div>
          )}

          {activePage === 'workflow' && (
            <motion.div
              key="workflow"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: EASE_OUT_EXPO }}
            >
              <WorkflowPageView
                onNavigatePage={switchToPublicPage}
                onOpenAuth={onOpenAuth}
              />
            </motion.div>
          )}

          {activePage === 'governance' && (
            <motion.div
              key="governance"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: EASE_OUT_EXPO }}
            >
              <GovernancePageView
                onNavigatePage={switchToPublicPage}
                onOpenAuth={onOpenAuth}
              />
            </motion.div>
          )}

          {activePage === 'architecture' && (
            <motion.div
              key="architecture"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: EASE_OUT_EXPO }}
            >
              <ArchitecturePageView
                onNavigatePage={switchToPublicPage}
                onOpenAuth={onOpenAuth}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {activePage === 'overview' ? (
        /* Enterprise Summary Footer Card (Overview Only) */
        <footer className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-12 pb-16">
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={VIEWPORT_REVEAL}
            transition={{ duration: 0.55, ease: EASE_OUT_EXPO }}
            className="cp-panel rounded-3xl p-8 sm:p-10 lg:p-12 relative overflow-hidden"
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 relative z-10">
              {/* Left: Brand & Value Summary */}
              <div className="lg:col-span-5 space-y-5">
                <a
                  href="/"
                  onClick={(e) => navigateToPage(e, 'overview')}
                  className="inline-flex items-center gap-2.5"
                >
                  <CodePulseLogo size="md" />
                  <span className="font-bold tracking-tight text-white text-base">
                    CodePulse
                  </span>
                  <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-md bg-white/[0.06] border border-white/10 text-zinc-300">
                    {L('Hub Enterprise', 'Enterprise Hub')}
                  </span>
                </a>

                <div className="space-y-2.5">
                  <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight leading-snug">
                    {L(
                      'Pantau, jaga gerbang kode, dan deploy rilis engineering dari satu hub terpadu.',
                      'Monitor, gatekeep, and deploy engineering delivery from one unified hub.',
                    )}
                  </h2>
                  <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed max-w-md">
                    {L(
                      <>
                        Dirancang untuk tim perangkat lunak yang disiplin dengan otomatisasi Kanban
                        real-time, proteksi ketat branch <code>main</code>, review IDE WebRTC
                        langsung di browser, dan rilis Vercel Edge.
                      </>,
                      <>
                        Built for disciplined software teams combining real-time Kanban automation,
                        strict <code>main</code> branch protection, browser-native WebRTC IDE
                        reviews, and Vercel Edge releases.
                      </>,
                    )}
                  </p>
                </div>
              </div>

              {/* Right: Navigation & Architecture Metadata Columns */}
              <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-8 lg:pl-8">
                <div className="space-y-3">
                  <div className="text-[11px] font-mono uppercase tracking-widest text-zinc-500">
                    {L('Platform', 'Platform')}
                  </div>
                  <ul className="space-y-2.5 text-xs text-zinc-400">
                    {PUBLIC_NAV_ITEMS.map((item) => (
                      <li key={item.id}>
                        <a
                          href={PUBLIC_PAGE_PATHS[item.id]}
                          onClick={(e) => navigateToPage(e, item.id)}
                          className={`transition ${
                            activePage === item.id
                              ? 'text-white font-medium'
                              : 'hover:text-white'
                          }`}
                        >
                          {L(item.label.id, item.label.en)}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-3">
                  <div className="text-[11px] font-mono uppercase tracking-widest text-zinc-500">
                    {L('Modul Utama', 'Core Modules')}
                  </div>
                  <ul className="space-y-2.5 text-xs text-zinc-400">
                    <li className="text-zinc-300">
                      {L('Sinkronisasi Kanban Webhook', 'Webhook Kanban Sync')}
                    </li>
                    <li className="text-zinc-300">GitHub Diff Gatekeeper</li>
                    <li className="text-zinc-300">
                      {L('Monitor IDE WebRTC', 'WebRTC IDE Monitor')}
                    </li>
                    <li className="text-zinc-300">
                      {L('Telemetri Vercel Edge', 'Vercel Edge Telemetry')}
                    </li>
                    <li className="text-zinc-300">
                      {L('Palet Perintah (Ctrl+K)', 'Command Palette (Ctrl+K)')}
                    </li>
                  </ul>
                </div>

                <div className="space-y-3 col-span-2 sm:col-span-1">
                  <div className="text-[11px] font-mono uppercase tracking-widest text-zinc-500">
                    {L('Keamanan & Stack', 'Security & Stack')}
                  </div>
                  <ul className="space-y-2.5 text-xs text-zinc-400">
                    <li className="text-zinc-300">
                      {L('Kunci Zero Direct Push', 'Zero Direct Push Lock')}
                    </li>
                    <li className="text-zinc-300">
                      {L('Vault AES-256-GCM', 'AES-256-GCM Vault')}
                    </li>
                    <li className="text-zinc-300">
                      {L('Webhook HMAC-SHA256', 'HMAC-SHA256 Webhooks')}
                    </li>
                    <li className="text-zinc-300">Supabase Realtime DB</li>
                    <li className="text-zinc-300">
                      {L('Kontrol Akses Peran (RBAC)', 'Role-Based Access (RBAC)')}
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Bottom Bar Inside Card */}
            <div className="relative z-10 mt-10 pt-6 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-4 text-[11px] text-zinc-500">
              <span>
                &copy; {new Date().getFullYear()} CodePulse —{' '}
                {L(
                  'Hub Pemantauan Proyek & Deployment Developer.',
                  'Developer Project Monitoring & Deployment Hub.',
                )}
              </span>
              <div className="flex flex-wrap items-center gap-4 font-mono text-zinc-400">
                <span>Zero Direct Push</span>
                <span className="text-zinc-700">&bull;</span>
                <span>WebRTC P2P</span>
                <span className="text-zinc-700">&bull;</span>
                <span>Supabase + Vercel</span>
              </div>
            </div>
          </motion.div>
        </footer>
      ) : (
        /* Compact Footer Bar for Inner Pages */
        <footer className="relative z-10 border-t border-white/[0.07] bg-zinc-950/40 mt-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
            <div className="flex items-center gap-2.5 text-center sm:text-left">
              <CodePulseLogo size="sm" />
              <span className="font-semibold text-zinc-300">CodePulse</span>
              <span className="text-zinc-700">&bull;</span>
              <span>
                &copy; {new Date().getFullYear()}{' '}
                {L(
                  'Hub Pemantauan Proyek & Deployment Developer',
                  'Developer Project Monitoring & Deployment Hub',
                )}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 font-mono text-[11px] text-zinc-400">
              <span>GitHub Gatekeeper</span>
              <span className="text-zinc-700">&bull;</span>
              <span>HMAC-SHA256</span>
              <span className="text-zinc-700">&bull;</span>
              <span>{L('Vault AES-256-GCM', 'AES-256-GCM Vault')}</span>
              <span className="text-zinc-700">&bull;</span>
              <span>Vercel Edge</span>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}

function KanbanShowcase() {
  const { L } = useLanguage();
  return (
    <div className="space-y-3.5 text-left">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Column 1: TO DO */}
        <div className="p-3 rounded-xl bg-zinc-950/90 border border-white/8 space-y-2.5">
          <div className="flex items-center justify-between text-[10px] font-semibold text-zinc-300">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-zinc-400" />
              {L('AKAN DIKERJAKAN', 'TO DO')}
            </span>
            <span className="font-mono text-zinc-500">2</span>
          </div>
          <div className="p-2.5 rounded-lg bg-[#121520] border border-white/8 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] text-indigo-300">#CP-05</span>
              <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300">
                {L('Sedang', 'Medium')}
              </span>
            </div>
            <div className="text-xs font-medium text-zinc-100 leading-snug">
              {L('Endpoint Ekspor PDF Absensi', 'Export Attendance PDF Endpoint')}
            </div>
            <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-1 border-t border-white/5">
              <span className="font-mono">feat/export-pdf</span>
              <span>@bima-dev</span>
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-[#121520] border border-white/8 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] text-indigo-300">#CP-06</span>
              <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                {L('Rendah', 'Low')}
              </span>
            </div>
            <div className="text-xs font-medium text-zinc-200 leading-snug">
              {L('Banner Pengingat Tenggat', 'Deadline Reminder Banner')}
            </div>
          </div>
        </div>

        {/* Column 2: IN PROGRESS */}
        <div className="p-3 rounded-xl bg-zinc-950/90 border border-white/8 space-y-2.5">
          <div className="flex items-center justify-between text-[10px] font-semibold text-sky-300">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-sky-400" />
              {L('DIKERJAKAN', 'IN PROGRESS')}
            </span>
            <span className="font-mono text-zinc-500">1</span>
          </div>
          <div className="p-2.5 rounded-lg bg-[#121520] border border-sky-500/25 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] text-indigo-300">#CP-04</span>
              <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">
                {L('Tinggi', 'High')}
              </span>
            </div>
            <div className="text-xs font-medium text-zinc-100 leading-snug">
              {L('Filter Jadwal Kuliah Real-Time', 'Real-Time Lecture Schedule Filter')}
            </div>
            <div className="text-[10px] font-mono text-cyan-300 bg-zinc-950 px-2 py-1 rounded border border-white/6 truncate">
              feat/schedule-filter
            </div>
            <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-1 border-t border-white/5">
              <span>@nadia-dev</span>
              <span className="text-cyan-300 font-mono">{L('IDE Aktif', 'IDE Live')}</span>
            </div>
          </div>
        </div>

        {/* Column 3: IN REVIEW */}
        <div className="p-3 rounded-xl bg-zinc-950/90 border border-violet-500/30 space-y-2.5">
          <div className="flex items-center justify-between text-[10px] font-semibold text-violet-300">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-violet-400" />
              {L('MENUNGGU REVIEW', 'IN REVIEW')}
            </span>
            <span className="font-mono text-violet-300">2</span>
          </div>
          <div className="p-2.5 rounded-lg bg-[#151828] border border-violet-500/35 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] text-indigo-300">#CP-02</span>
              <span className="font-mono text-[10px] text-emerald-400">+58 / -6</span>
            </div>
            <div className="text-xs font-medium text-white leading-snug">
              {L('Middleware Autentikasi Sesi Mahasiswa', 'Student Session Auth Middleware')}
            </div>
            <div className="text-[10px] font-mono text-zinc-400">
              PR #14 • e73b8d1
            </div>
            <div className="px-2 py-1 rounded bg-violet-600 text-white text-[10px] font-semibold text-center">
              {L('Periksa Diff & Merge', 'Inspect Diff & Merge')}
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-[#121520] border border-white/8 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] text-indigo-300">#CP-03</span>
              <span className="font-mono text-[10px] text-emerald-400">+39 / -4</span>
            </div>
            <div className="text-xs font-medium text-zinc-200 leading-snug">
              {L('Kartu Pemindai Absensi QR', 'QR Attendance Scanner Card')}
            </div>
          </div>
        </div>

        {/* Column 4: DONE */}
        <div className="p-3 rounded-xl bg-zinc-950/90 border border-emerald-500/25 space-y-2.5">
          <div className="flex items-center justify-between text-[10px] font-semibold text-emerald-300">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              {L('SELESAI', 'DONE')}
            </span>
            <span className="font-mono text-emerald-300">1</span>
          </div>
          <div className="p-2.5 rounded-lg bg-[#121520] border border-emerald-500/25 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] text-indigo-300">#CP-01</span>
              <span className="font-mono text-[10px] text-zinc-500">9a4f21c</span>
            </div>
            <div className="text-xs font-medium text-zinc-100 leading-snug">
              {L('Skema Supabase & Scaffold Proyek', 'Supabase Schema & Project Scaffold')}
            </div>
            <div className="inline-flex items-center gap-1 text-[10px] text-emerald-400">
              <CheckCircle2 className="w-3 h-3" />
              {L('Disetujui & Di-merge', 'Approved & Merged')}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Live Webhook Activity Strip */}
      <div className="px-3.5 py-2.5 rounded-xl bg-zinc-950/90 border border-white/8 flex flex-wrap items-center justify-between gap-2 font-mono text-[11px]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 text-[9px] uppercase font-bold">
            WEBHOOK PUSH
          </span>
          <span className="text-zinc-300 truncate">
            @nadia-dev {L('mengirim', 'pushed')} <span className="text-indigo-300">e73b8d1</span>{' '}
            &quot;feat: add JWT session middleware #CP-02&quot; →{' '}
            <span className="text-violet-300">{L('Menunggu Review', 'In Review')}</span>
          </span>
        </div>
        <span className="text-cyan-300 shrink-0">{L('Tersinkron dalam 84ms', 'Synced in 84ms')}</span>
      </div>
    </div>
  );
}

function GatekeeperShowcase() {
  const { L } = useLanguage();
  return (
    <div className="space-y-3.5 text-left">
      <div className="px-3.5 py-2.5 rounded-xl bg-zinc-950/90 border border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 font-mono">
          <span className="px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 font-semibold">
            #CP-02
          </span>
          <span className="text-zinc-200 font-medium">
            PR #14: feat/session-middleware → main
          </span>
        </div>
        <div className="font-mono text-[11px] flex items-center gap-2">
          <span className="text-emerald-400">+58</span>
          <span className="text-rose-400">-6</span>
          <span className="text-zinc-500">{L('2 berkas', '2 files')}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 rounded-xl bg-zinc-950 border border-white/10 overflow-hidden font-mono text-[11px]">
          <div className="px-4 py-2 bg-zinc-900 border-b border-white/10 flex items-center justify-between text-zinc-300">
            <span>src/middleware/requireAuth.ts</span>
            <span className="text-emerald-400">{L('+46 baris', '+46 lines')}</span>
          </div>
          <div className="divide-y divide-white/[0.03]">
            {[
              { ln: 1, text: '+ export function requireAuth(req, res, next) {', add: true },
              { ln: 2, text: '+   const token = req.cookies?.cp_session;', add: true },
              { ln: 3, text: "+   if (!token) return res.status(401).json({ error: 'Unauthorized' });", add: true },
              { ln: 4, text: '+   req.user = verifyToken(token);', add: true },
              { ln: 5, text: '+   next();', add: true },
              { ln: 6, text: '+ }', add: true },
            ].map((row) => (
              <div
                key={row.ln}
                className={`flex ${row.add ? 'bg-emerald-500/10 text-emerald-200' : 'text-zinc-300'}`}
              >
                <span className="w-8 text-right pr-2 py-1 text-[10px] text-zinc-600 border-r border-white/8 select-none">
                  {row.ln}
                </span>
                <span className="px-3 py-1 truncate">{row.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-5 p-4 rounded-xl bg-zinc-950 border border-white/10 flex flex-col justify-between gap-4">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
              <Lock className="w-3.5 h-3.5" />
              <span>{L('Verifikasi Kebijakan Gatekeeper', 'Gatekeeper Policy Verification')}</span>
            </div>
            <ul className="space-y-2 text-[11px] text-zinc-300">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>
                  {L('Branch fitur terisolasi terverifikasi', 'Isolated feature branch verified')}
                </span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>
                  {L(
                    'Tanda tangan webhook HMAC-SHA256 valid',
                    'HMAC-SHA256 webhook signature valid',
                  )}
                </span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>
                  {L(
                    'Auto-deploy ke Vercel aktif setelah merge',
                    'Auto-deploy to Vercel enabled after merge',
                  )}
                </span>
              </li>
            </ul>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold">
              <GitMerge className="w-3.5 h-3.5" />
              {L('Setujui & Merge', 'Approve & Merge')}
            </span>
            <span className="px-3 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-xs">
              {L('Minta Revisi', 'Request Changes')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function WebRTCShowcase() {
  const { L } = useLanguage();
  return (
    <div className="space-y-3.5 text-left">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          {
            user: '@nadia-dev',
            task: '#CP-04',
            fps: '30 FPS',
            kbps: '1,420 kbps',
            file: 'ScheduleFilter.tsx',
            lines: [
              'export function ScheduleFilter({ courses }) {',
              "  const [day, setDay] = useState('Mon');",
              '  return courses.filter((c) => c.day === day);',
              '}',
            ],
          },
          {
            user: '@bima-dev',
            task: '#CP-03',
            fps: '28 FPS',
            kbps: '1,180 kbps',
            file: 'AttendanceScanner.tsx',
            lines: [
              'async function handleQrVerify(qrToken: string) {',
              "  const res = await fetch('/api/attendance', {",
              "    method: 'POST', body: JSON.stringify({ qrToken })",
              '  });',
            ],
          },
        ].map((stream) => (
          <div
            key={stream.user}
            className="rounded-xl bg-zinc-950 border border-white/10 overflow-hidden"
          >
            <div className="px-3.5 py-2.5 border-b border-white/8 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-semibold text-white">{stream.user}</span>
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                  {stream.task}
                </span>
              </div>
              <span className="font-mono text-[11px] text-emerald-300">
                {stream.fps} • {stream.kbps}
              </span>
            </div>
            <div className="p-4 font-mono text-[11px] text-zinc-400 space-y-1.5 bg-[#06070b]">
              <div className="text-zinc-500">
                // {L('Tangkapan IDE Langsung', 'Live IDE Capture')} — {stream.file}
              </div>
              {stream.lines.map((line, i) => (
                <div key={i} className={i === 0 ? 'text-cyan-300' : 'text-zinc-300'}>
                  {line}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="px-3.5 py-2 rounded-xl bg-zinc-950/90 border border-white/8 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-zinc-400">
        <span>
          {L('Status ICE: terhubung (P2P STUN/TURN)', 'ICE State: connected (P2P STUN/TURN)')}
        </span>
        <span className="text-emerald-300">
          {L('Stream Browser Efemeral • Tanpa Rekaman', 'Ephemeral Browser Stream • No Recording')}
        </span>
      </div>
    </div>
  );
}

function VercelShowcase() {
  const { L } = useLanguage();
  return (
    <div className="space-y-3.5 text-left">
      <div className="grid grid-cols-3 gap-2.5 text-[11px] font-medium">
        <div className="px-3 py-2 rounded-xl bg-emerald-500/12 border border-emerald-500/30 text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>{L('1. Dalam Antrean', '1. Queued')}</span>
        </div>
        <div className="px-3 py-2 rounded-xl bg-emerald-500/12 border border-emerald-500/30 text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>{L('2. Membangun Artefak', '2. Building Artifacts')}</span>
        </div>
        <div className="px-3 py-2 rounded-xl bg-emerald-500/12 border border-emerald-500/30 text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>{L('3. Siap di Edge', '3. Edge Ready')}</span>
        </div>
      </div>

      <div className="rounded-xl bg-zinc-950 border border-white/10 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold">
              {L('Siap', 'Ready')}
            </span>
            <span className="font-mono text-xs text-cyan-300">
              https://campussync-portal.vercel.app
            </span>
          </div>
          <span className="font-mono text-[11px] text-zinc-400">
            main • 9a4f21c • {L('build 16 dtk', '16s build')}
          </span>
        </div>
        <div className="p-3 rounded-lg bg-[#06070b] border border-white/8 font-mono text-[11px] space-y-1 text-zinc-300">
          <div>[13:10:02] Cloning campussync-team/campussync-web (branch: main)</div>
          <div>[13:10:06] Installing dependencies via npm ci (248 packages)</div>
          <div>[13:10:12] Running &quot;tsc -b &amp;&amp; vite build&quot;</div>
          <div>[13:10:16] dist/assets/index-8f2a1b.js 184.2 kB | gzip 58.1 kB</div>
          <div className="text-emerald-300">
            [13:10:18] Deployment READY → https://campussync-portal.vercel.app
          </div>
        </div>
      </div>
    </div>
  );
}

function EnterpriseHighlight({
  icon,
  title,
  description,
  delay = 0,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={VIEWPORT_REVEAL}
      transition={{ duration: 0.45, delay, ease: EASE_OUT_EXPO }}
      className="space-y-2"
    >
      <div className="inline-flex items-center gap-2 text-sm font-semibold text-white">
        <span className="p-1.5 rounded-lg bg-white/[0.05] border border-white/10">
          {icon}
        </span>
        <span>{title}</span>
      </div>
      <p className="text-xs text-zinc-400 leading-relaxed">{description}</p>
    </motion.div>
  );
}
