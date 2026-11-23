import { motion } from 'framer-motion';
import { useLanguage } from '../lib/i18nContext.ts';
import { CodePulseLogo } from './CodePulseLogo.tsx';
import type { PaletteTab } from './CommandPalette.tsx';

export function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`cp-skeleton rounded-lg ${className}`} aria-hidden="true" />;
}

/**
 * Full-screen signature CodePulse boot/refresh loader.
 * Used exclusively when accessing the app or performing a full browser refresh.
 */
export function CodePulseSplashLoader({ label }: { label?: string }) {
  const { L } = useLanguage();
  const resolvedLabel =
    label || L('Menyiapkan CodePulse Hub...', 'Initializing CodePulse Hub...');
  return (
    <div className="min-h-screen bg-cp-grid flex flex-col items-center justify-center px-6 relative overflow-hidden select-none">
      {/* Ambient central aura */}
      <div
        className="pointer-events-none absolute w-[420px] h-[420px] rounded-full blur-3xl opacity-25"
        style={{
          background:
            'radial-gradient(circle, rgba(34,211,238,0.45) 0%, rgba(99,102,241,0.35) 45%, transparent 72%)',
        }}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex flex-col items-center gap-6"
      >
        {/* Dual-orbit orbital spinner + pulsing radar waves around CodePulse emblem */}
        <div className="relative w-28 h-28 flex items-center justify-center">
          {/* Expanding sonar radar rings */}
          <span className="absolute inset-2 rounded-full border border-cyan-400/35 cp-radar-ring" />
          <span
            className="absolute inset-2 rounded-full border border-indigo-400/25 cp-radar-ring"
            style={{ animationDelay: '0.85s' }}
          />

          {/* Slow counter-rotating outer dashed ring */}
          <svg
            viewBox="0 0 112 112"
            className="absolute inset-0 w-full h-full cp-orbit-ccw"
            aria-hidden="true"
          >
            <circle
              cx="56"
              cy="56"
              r="52"
              fill="none"
              stroke="rgba(129, 140, 248, 0.28)"
              strokeWidth="1.25"
              strokeDasharray="6 8"
            />
          </svg>

          {/* Fast glowing orbital spinner arc */}
          <svg
            viewBox="0 0 112 112"
            className="absolute inset-0 w-full h-full cp-orbit-cw"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="cpSplashSpinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#22d3ee" stopOpacity="1" />
                <stop offset="55%" stopColor="#818cf8" stopOpacity="0.85" />
                <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
              </linearGradient>
            </defs>
            <circle
              cx="56"
              cy="56"
              r="43"
              fill="none"
              stroke="url(#cpSplashSpinGrad)"
              strokeWidth="2.75"
              strokeLinecap="round"
              strokeDasharray="115 160"
            />
          </svg>

          {/* Floating CodePulse Brand Emblem */}
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="relative z-10"
          >
            <CodePulseLogo
              size="lg"
              className="w-14 h-14 p-2 rounded-2xl border-cyan-400/40 shadow-[0_0_28px_rgba(34,211,238,0.28)]"
            />
          </motion.div>
        </div>

        {/* Live Animated CodePulse Heartbeat Waveform */}
        <div className="flex flex-col items-center gap-2.5">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tight text-white">CodePulse</span>
            <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-cyan-500/12 border border-cyan-500/25 text-cyan-300">
              HUB
            </span>
          </div>

          <svg
            viewBox="0 0 220 34"
            className="w-52 h-8 overflow-visible"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="cpWaveStroke" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#6366f1" stopOpacity="0.2" />
                <stop offset="35%" stopColor="#22d3ee" stopOpacity="1" />
                <stop offset="65%" stopColor="#34d399" stopOpacity="1" />
                <stop offset="100%" stopColor="#818cf8" stopOpacity="0.2" />
              </linearGradient>
            </defs>
            {/* Subtle guide track */}
            <path
              d="M 4 17 L 72 17 L 82 17 L 91 5 L 101 29 L 111 9 L 119 21 L 127 17 L 216 17"
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Animated traveling pulse */}
            <motion.path
              d="M 4 17 L 72 17 L 82 17 L 91 5 L 101 29 L 111 9 L 119 21 L 127 17 L 216 17"
              fill="none"
              stroke="url(#cpWaveStroke)"
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0.25, pathOffset: 0 }}
              animate={{ pathOffset: [0, 1] }}
              transition={{ duration: 1.55, repeat: Infinity, ease: 'easeInOut' }}
              style={{ filter: 'drop-shadow(0 0 6px rgba(34,211,238,0.65))' }}
            />
          </svg>

          {/* Progress shimmer bar */}
          <div className="w-48 h-1 rounded-full bg-white/[0.06] overflow-hidden">
            <motion.div
              className="h-full w-1/2 rounded-full bg-gradient-to-r from-indigo-500 via-cyan-400 to-emerald-400"
              animate={{ x: ['-100%', '220%'] }}
              transition={{ duration: 1.35, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>

          <span className="text-[11px] font-mono text-zinc-400 tracking-wide mt-0.5">
            {resolvedLabel}
          </span>
        </div>
      </motion.div>
    </div>
  );
}

/** Skeleton for Overview Telemetry Charts & KPI Cards */
export function OverviewTelemetrySkeleton() {
  return (
    <div className="space-y-6">
      {/* 4 KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="cp-panel rounded-2xl p-5 flex items-end justify-between gap-3">
            <div className="space-y-2.5 flex-1">
              <SkeletonBlock className="h-3 w-24" />
              <div className="flex items-center gap-2">
                <SkeletonBlock className="h-7 w-12" />
                <SkeletonBlock className="h-4 w-14 rounded-md" />
              </div>
              <SkeletonBlock className="h-3 w-32" />
            </div>
            <SkeletonBlock className="h-7 w-16 rounded-md shrink-0" />
          </div>
        ))}
      </div>

      {/* Hero Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 cp-panel rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-2">
              <SkeletonBlock className="h-4 w-52" />
              <SkeletonBlock className="h-3 w-72 max-w-full" />
            </div>
            <SkeletonBlock className="h-6 w-20 rounded-md" />
          </div>
          <div className="flex gap-2">
            <SkeletonBlock className="h-6 w-20 rounded-lg" />
            <SkeletonBlock className="h-6 w-28 rounded-lg" />
            <SkeletonBlock className="h-6 w-24 rounded-lg" />
          </div>
          <SkeletonBlock className="h-48 w-full rounded-xl" />
        </div>

        <div className="lg:col-span-4 cp-panel rounded-2xl p-6 flex flex-col justify-between gap-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <SkeletonBlock className="h-4 w-28" />
              <SkeletonBlock className="h-6 w-32 rounded-lg" />
            </div>
            <SkeletonBlock className="h-3 w-48" />
          </div>
          <div className="flex flex-col items-center gap-4">
            <SkeletonBlock className="w-36 h-36 rounded-full" />
            <div className="w-full space-y-2">
              <SkeletonBlock className="h-8 w-full rounded-lg" />
              <SkeletonBlock className="h-8 w-full rounded-lg" />
              <SkeletonBlock className="h-8 w-full rounded-lg" />
            </div>
          </div>
        </div>
      </div>

      {/* Project Health + Pipeline Readiness Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 cp-panel rounded-2xl p-6 space-y-4">
          <SkeletonBlock className="h-4 w-56" />
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, idx) => (
              <div key={idx} className="p-4 rounded-xl bg-zinc-950/70 border border-white/8 space-y-3">
                <div className="flex justify-between gap-2">
                  <SkeletonBlock className="h-4 w-32" />
                  <SkeletonBlock className="h-4 w-40" />
                </div>
                <SkeletonBlock className="h-2.5 w-full rounded-full" />
                <div className="flex justify-between">
                  <SkeletonBlock className="h-3 w-36" />
                  <SkeletonBlock className="h-3 w-28" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-5 cp-panel rounded-2xl p-6 space-y-5">
          <SkeletonBlock className="h-4 w-40" />
          <div className="p-4 rounded-xl bg-zinc-950/70 border border-white/8 flex items-center gap-4">
            <SkeletonBlock className="w-24 h-24 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <SkeletonBlock className="h-3.5 w-full" />
              <SkeletonBlock className="h-3.5 w-5/6" />
              <SkeletonBlock className="h-3.5 w-4/5" />
              <SkeletonBlock className="h-3.5 w-3/4" />
            </div>
          </div>
          <div className="space-y-2.5">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="space-y-1.5">
                <SkeletonBlock className="h-3 w-36" />
                <SkeletonBlock className="h-2 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Skeleton for GitHub Repositories 3-column grid */
export function RepoGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="cp-panel rounded-2xl p-5 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <SkeletonBlock className="h-4 w-36" />
              <SkeletonBlock className="h-4 w-14 rounded-md" />
            </div>
            <SkeletonBlock className="h-3 w-48" />
            <SkeletonBlock className="h-3 w-28" />
          </div>
          <div className="pt-3 border-t border-white/8 flex items-center justify-between">
            <SkeletonBlock className="h-3.5 w-16" />
            <SkeletonBlock className="h-7 w-24 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Compact Repo list skeleton for Overview Quick Import */
export function RepoListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="p-3 rounded-xl bg-zinc-950/90 border border-white/8 flex items-center justify-between gap-3"
        >
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center gap-2">
              <SkeletonBlock className="h-3.5 w-44" />
              <SkeletonBlock className="h-4 w-12 rounded-md" />
            </div>
            <SkeletonBlock className="h-3 w-24" />
          </div>
          <SkeletonBlock className="h-7 w-24 rounded-lg shrink-0" />
        </div>
      ))}
    </div>
  );
}

/** Activity & Audit Logs list skeleton */
export function ActivityFeedSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="cp-panel rounded-2xl divide-y divide-white/[0.06]">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="p-4 flex items-center justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <SkeletonBlock className="w-8 h-8 rounded-lg shrink-0" />
            <div className="space-y-2 flex-1">
              <SkeletonBlock className="h-3.5 w-64 max-w-full" />
              <SkeletonBlock className="h-3 w-44 max-w-full" />
            </div>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <SkeletonBlock className="h-5 w-16 rounded-md" />
            <SkeletonBlock className="h-4 w-12" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Cloud Vercel projects list skeleton */
export function VercelProjectsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="px-3.5 py-2.5 rounded-xl bg-zinc-950/90 border border-white/8 flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2 flex-1">
            <SkeletonBlock className="w-3.5 h-3.5 rounded-full shrink-0" />
            <SkeletonBlock className="h-3.5 w-32" />
            <SkeletonBlock className="h-4 w-12 rounded-md" />
          </div>
          <SkeletonBlock className="h-3.5 w-10" />
        </div>
      ))}
    </div>
  );
}

/** Invitations list skeleton */
export function InvitationsListSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="p-4 rounded-xl bg-zinc-950/90 border border-white/8 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <SkeletonBlock className="h-4 w-40" />
            <SkeletonBlock className="h-4 w-16" />
          </div>
          <SkeletonBlock className="h-3 w-48" />
          <div className="flex items-center gap-2 pt-1">
            <SkeletonBlock className="h-8 w-36 rounded-xl" />
            <SkeletonBlock className="h-8 w-20 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Code Diff Viewer skeleton for TaskDiffModal */
export function DiffViewerSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 2 }).map((_, idx) => (
        <div
          key={idx}
          className="rounded-xl border border-white/10 overflow-hidden bg-[#080a0f]"
        >
          <div className="px-4 py-3 bg-zinc-900/90 border-b border-white/8 flex items-center justify-between">
            <SkeletonBlock className="h-3.5 w-52" />
            <SkeletonBlock className="h-3.5 w-16" />
          </div>
          <div className="p-4 space-y-2">
            <SkeletonBlock className="h-3 w-3/4" />
            <SkeletonBlock className="h-3 w-full" />
            <SkeletonBlock className="h-3 w-5/6" />
            <SkeletonBlock className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Tab-aware Project Workspace Skeleton while switching/entering a workspace */
export function WorkspaceViewSkeleton({ tab }: { tab: PaletteTab }) {
  if (tab === 'board') {
    return (
      <div className="space-y-5">
        <div className="cp-panel rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
          <SkeletonBlock className="h-4 w-64" />
          <div className="flex gap-2">
            <SkeletonBlock className="h-8 w-24 rounded-xl" />
            <SkeletonBlock className="h-8 w-28 rounded-xl" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, col) => (
            <div key={col} className="cp-panel rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <SkeletonBlock className="h-4 w-24" />
                <SkeletonBlock className="h-5 w-6 rounded-full" />
              </div>
              {Array.from({ length: col === 0 ? 3 : 2 }).map((__, card) => (
                <div
                  key={card}
                  className="p-3.5 rounded-xl bg-zinc-950/85 border border-white/8 space-y-2.5"
                >
                  <div className="flex items-center gap-2">
                    <SkeletonBlock className="h-4 w-12 rounded-md" />
                    <SkeletonBlock className="h-4 w-14 rounded-md" />
                  </div>
                  <SkeletonBlock className="h-3.5 w-full" />
                  <SkeletonBlock className="h-3 w-2/3" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (tab === 'deployments') {
    return (
      <div className="space-y-6">
        <div className="cp-panel rounded-2xl p-6 flex flex-col md:flex-row justify-between gap-4">
          <div className="space-y-2.5 flex-1">
            <SkeletonBlock className="h-5 w-48 rounded-full" />
            <SkeletonBlock className="h-6 w-72" />
            <SkeletonBlock className="h-3.5 w-80 max-w-full" />
          </div>
          <SkeletonBlock className="h-11 w-36 rounded-xl shrink-0" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 cp-panel rounded-2xl p-5 space-y-3">
            <SkeletonBlock className="h-4 w-36" />
            {Array.from({ length: 3 }).map((_, idx) => (
              <SkeletonBlock key={idx} className="h-20 w-full rounded-xl" />
            ))}
          </div>
          <div className="lg:col-span-7 cp-panel rounded-2xl p-5 space-y-4">
            <SkeletonBlock className="h-6 w-56" />
            <div className="grid grid-cols-3 gap-2">
              <SkeletonBlock className="h-9 rounded-xl" />
              <SkeletonBlock className="h-9 rounded-xl" />
              <SkeletonBlock className="h-9 rounded-xl" />
            </div>
            <SkeletonBlock className="h-52 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (tab === 'live') {
    return (
      <div className="space-y-6">
        <div className="cp-panel rounded-2xl p-6 flex flex-wrap justify-between gap-4">
          <div className="space-y-2">
            <SkeletonBlock className="h-5 w-48 rounded-full" />
            <SkeletonBlock className="h-6 w-64" />
            <SkeletonBlock className="h-3.5 w-80 max-w-full" />
          </div>
          <div className="flex gap-2">
            <SkeletonBlock className="h-10 w-44 rounded-xl" />
            <SkeletonBlock className="h-10 w-36 rounded-xl" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <SkeletonBlock className="aspect-video w-full rounded-2xl" />
          <SkeletonBlock className="aspect-video w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="cp-panel rounded-2xl p-5 flex justify-between items-center gap-4">
        <div className="space-y-2 flex-1">
          <SkeletonBlock className="h-4 w-48" />
          <SkeletonBlock className="h-3 w-72 max-w-full" />
        </div>
        <SkeletonBlock className="h-8 w-28 rounded-xl" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SkeletonBlock className="h-64 w-full rounded-2xl" />
        <SkeletonBlock className="h-64 w-full rounded-2xl" />
      </div>
    </div>
  );
}

