import { type ReactNode, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  ArrowRight,
  Ban,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Code2,
  Cpu,
  Database,
  FileCode2,
  FolderGit2,
  GitBranch,
  GitCommit,
  GitMerge,
  GitPullRequest,
  Globe,
  KeyRound,
  Layers,
  Link2,
  Lock,
  Monitor,
  Radio,
  Server,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Terminal,
  UserCheck,
  UserPlus,
  Users,
  Webhook,
  XCircle,
  Zap,
} from 'lucide-react';
import { useLanguage } from '../lib/i18nContext.ts';
import { EASE_OUT_EXPO } from '../lib/motion.ts';
import { GitHubIcon } from './GitHubIcon.tsx';
import { VercelIcon } from './VercelIcon.tsx';

export type PublicPageId = 'overview' | 'capabilities' | 'workflow' | 'governance' | 'architecture';

interface BiText {
  id: string;
  en: string;
}

interface PublicPageProps {
  onNavigatePage?: (page: PublicPageId) => void;
  onOpenAuth?: (mode?: 'login' | 'register') => void;
}

/* ==========================================================================
   DATA: CAPABILITIES
   ========================================================================== */

type CapabilityTabId = 'gatekeeper' | 'vercel' | 'webrtc' | 'team';

interface CapabilityDeepDive {
  id: CapabilityTabId;
  label: BiText;
  eyebrow: BiText;
  title: BiText;
  description: BiText;
  bullets: BiText[];
  protocols: BiText[];
}

const CAPABILITY_TABS: CapabilityDeepDive[] = [
  {
    id: 'gatekeeper',
    label: { id: 'GitHub Gatekeeper', en: 'GitHub Gatekeeper' },
    eyebrow: { id: 'KEAMANAN BRANCH OTOMATIS', en: 'AUTOMATED BRANCH SECURITY' },
    title: {
      id: 'Nol merge bermasalah ke main dengan inspeksi PR baris demi baris.',
      en: 'Zero broken main merges with line-by-line PR inspection.',
    },
    description: {
      id: 'Menghubungkan repository langsung mengaktifkan proteksi branch melalui @octokit/rest, memvalidasi webhook masuk dengan tanda tangan HMAC-SHA256 timing-safe, dan membatasi merge produksi hanya setelah review Project Leader.',
      en: 'Connecting a repository enables branch protection via @octokit/rest, validates incoming webhooks with timing-safe HMAC-SHA256 signatures, and gates production merges strictly behind Project Leader review.',
    },
    bullets: [
      {
        id: 'Ekstraksi otomatis kode tugas #CP-XX dari payload push & pull_request',
        en: 'Automatic #CP-XX task extraction from push & pull_request payloads',
      },
      {
        id: 'Penampil unified diff yang menampilkan penambahan, penghapusan, dan berkas yang diubah',
        en: 'Unified diff viewer showing exact additions, deletions, and modified files',
      },
      {
        id: 'Penegakan RBAC sisi server memblokir permintaan approve/merge dari non-Leader',
        en: 'Server-side RBAC enforcement blocks non-Leader approve/merge calls',
      },
      {
        id: 'Tombol Minta Revisi satu klik mengembalikan kartu ke Dikerjakan beserta catatan feedback',
        en: 'One-click Request Changes returns cards to In Progress with feedback',
      },
    ],
    protocols: [
      { id: 'HMAC-SHA256', en: 'HMAC-SHA256' },
      { id: '@octokit/rest', en: '@octokit/rest' },
      { id: 'Squash Merge', en: 'Squash Merge' },
      { id: 'Guard HTTP 403', en: 'HTTP 403 Guard' },
    ],
  },
  {
    id: 'vercel',
    label: { id: 'Deploy Vercel Langsung', en: 'Direct Vercel Deploy' },
    eyebrow: { id: 'TANPA IMPOR MANUAL DI VERCEL', en: 'ZERO MANUAL VERCEL IMPORT' },
    title: {
      id: 'Siapkan, konfigurasi, dan deploy langsung dari dalam CodePulse.',
      en: 'Provision, configure, and deploy straight inside CodePulse.',
    },
    description: {
      id: 'Tidak perlu bolak-balik ke vercel.com/new. CodePulse mendeteksi preset framework dari package.json, mengatur perintah build/output dan environment variable terenkripsi, lalu mengunggah snapshot GitHub langsung ke Vercel Edge.',
      en: 'Skip bouncing back and forth to vercel.com/new. CodePulse detects your framework preset from package.json, configures build/output commands and encrypted environment variables, and uploads GitHub snapshots straight to Vercel Edge.',
    },
    bullets: [
      {
        id: 'Otomatis mendeteksi preset Vite, Next.js, Astro, Remix, SvelteKit, dan Static',
        en: 'Auto-detects Vite, Next.js, Astro, Remix, SvelteKit, and Static presets',
      },
      {
        id: 'Buat proyek cloud Vercel baru langsung dari tab Deployment',
        en: 'Provision new Vercel cloud projects directly from the Deployments tab',
      },
      {
        id: 'Kelola env var Production, Preview, dan Development langsung di aplikasi',
        en: 'Manage Production, Preview, and Development env vars in-app',
      },
      {
        id: 'Auto-deploy setelah merge Gatekeeper dengan streaming log build real-time',
        en: 'Auto-deploy after Gatekeeper merge with real-time build log streaming',
      },
    ],
    protocols: [
      { id: 'Vercel v13 API', en: 'Vercel v13 API' },
      { id: 'Tarball GitHub', en: 'GitHub Tarball' },
      { id: 'AES-256-GCM', en: 'AES-256-GCM' },
      { id: 'Siap Edge', en: 'Edge Ready' },
    ],
  },
  {
    id: 'webrtc',
    label: { id: 'Monitor Langsung 60 FPS', en: '60 FPS Live Monitor' },
    eyebrow: { id: 'PAIR STREAMING LANGSUNG DI BROWSER', en: 'BROWSER-NATIVE PAIR STREAMING' },
    title: {
      id: 'Pemantauan IDE 1080p 60 FPS super mulus tanpa instalasi aplikasi desktop.',
      en: 'Ultra-smooth 1080p 60 FPS IDE monitoring without desktop installs.',
    },
    description: {
      id: 'Developer menyiarkan jendela IDE langsung dari Chrome melalui getDisplayMedia. Koneksi peer bernegosiasi langsung lewat STUN/TURN dengan pilihan preset kualitas dan tanpa beban relay video di server.',
      en: 'Developers broadcast their IDE window straight from Chrome via getDisplayMedia. Peer connections negotiate directly over STUN/TURN with selectable quality presets and zero video relay overhead on the server.',
    },
    bullets: [
      {
        id: 'Tiga preset kualitas: 1080p 60 FPS Mulus, 1080p 30 FPS Tajam, 720p Hemat',
        en: 'Three quality presets: 1080p 60 FPS Smooth, 1080p 30 FPS Crisp, 720p Saver',
      },
      {
        id: 'Stream WebRTC P2P berakselerasi perangkat keras dengan telemetri FPS & bitrate langsung',
        en: 'Hardware-accelerated WebRTC P2P streams with live FPS & bitrate telemetry',
      },
      {
        id: 'Sematkan konteks tugas #CP-XX aktif agar Leader langsung tahu fitur yang sedang dikerjakan',
        en: 'Attach active #CP-XX task context so Leaders see what is being built',
      },
      {
        id: 'Desain sesi efemeral — siaran tidak pernah direkam atau disimpan ke disk',
        en: 'Ephemeral session design — streams are never recorded or stored on disk',
      },
    ],
    protocols: [
      { id: 'WebRTC P2P', en: 'WebRTC P2P' },
      { id: '60 FPS 1080p', en: '60 FPS 1080p' },
      { id: 'STUN / TURN', en: 'STUN / TURN' },
      { id: 'DTLS / SRTP', en: 'DTLS / SRTP' },
    ],
  },
  {
    id: 'team',
    label: { id: 'Hub Tim & Analitik', en: 'Team Hub & Analytics' },
    eyebrow: { id: 'ORKESTRASI MULTI-PROYEK', en: 'MULTI-PROJECT ORCHESTRATION' },
    title: {
      id: 'Undang rekan tim, atur peran, dan pantau kecepatan kerja secara real-time.',
      en: 'Invite teammates, govern roles, and track velocity in real time.',
    },
    description: {
      id: 'Kelola banyak repository dari satu Hub Engineering terpadu dengan grafik pulse 7 hari, rincian distribusi tugas, undangan langsung via @handle/email, tautan undangan, serta kontrol peran per proyek.',
      en: 'Manage multiple repositories from a unified Engineering Hub with 7-day pulse charts, distribution breakdowns, direct @handle/email invites, shareable invite links, and per-project role control.',
    },
    bullets: [
      {
        id: 'Kirim undangan langsung atau buat tautan undangan yang dapat dibagikan (/?invite=CODE)',
        en: 'Send direct invitations or generate reusable shareable links (/?invite=CODE)',
      },
      {
        id: 'Cakupan peran per proyek: jadi Leader di satu repo, Kontributor di repo lainnya',
        en: 'Per-project role scoping: Leader on one repo, Contributor on another',
      },
      {
        id: 'Grafik interaktif kecepatan 7 hari, webhook, deployment, dan kesiapan pipeline',
        en: 'Interactive 7-day velocity, webhook, deployment, and readiness charts',
      },
      {
        id: 'Kontrol siklus proyek penuh: ubah metadata, lepas repo, atau hapus proyek dengan aman',
        en: 'Full project lifecycle control: edit metadata, unlink repos, or safely delete',
      },
    ],
    protocols: [
      { id: 'RBAC Per-Proyek', en: 'Per-Project RBAC' },
      { id: 'Tautan Undangan', en: 'Invite Links' },
      { id: 'Sinkronisasi WS', en: 'WebSocket Sync' },
      { id: 'Palet Ctrl+K', en: 'Ctrl+K Palette' },
    ],
  },
];

const COMPARISON_ROWS: Array<{
  key: string;
  dimension: BiText;
  legacy: BiText;
  codepulse: BiText;
}> = [
  {
    key: 'task-tracking',
    dimension: { id: 'Pelacakan Status Tugas', en: 'Task Status Tracking' },
    legacy: {
      id: 'Seret manual di Trello/Jira setelah setiap commit; board cepat tidak akurat.',
      en: 'Manual drag in Trello/Jira after every commit; boards quickly go stale.',
    },
    codepulse: {
      id: 'Webhook GitHub mendeteksi tag #CP-XX dan memindahkan kartu ke In Review dalam < 3 detik.',
      en: 'GitHub webhooks detect #CP-XX tags and move cards to In Review in < 3s.',
    },
  },
  {
    key: 'branch-protection',
    dimension: { id: 'Proteksi Branch Main', en: 'Main Branch Protection' },
    legacy: {
      id: 'Pengaturan repo manual; force-push tidak sengaja merusak build produksi.',
      en: 'Manual repo settings; accidental force-pushes break production builds.',
    },
    codepulse: {
      id: 'Terkunci otomatis via Octokit dengan review diff Gatekeeper & merge khusus Leader.',
      en: 'Auto-locked via Octokit with Gatekeeper diff review & Leader-only merge.',
    },
  },
  {
    key: 'vercel-deploy',
    dimension: { id: 'Pengaturan Deploy Vercel', en: 'Vercel Deployment Setup' },
    legacy: {
      id: 'Keluar dari dashboard, buka vercel.com/new, impor ulang repo, ketik ulang env var.',
      en: 'Leave dashboard, open vercel.com/new, re-import repo, re-enter env vars.',
    },
    codepulse: {
      id: 'Buat proyek, deteksi preset framework, atur env var & deploy langsung di aplikasi.',
      en: 'Provision projects, detect framework presets, set env vars & deploy in-app.',
    },
  },
  {
    key: 'live-supervision',
    dimension: { id: 'Supervisi Kode Langsung', en: 'Live Code Supervision' },
    legacy: {
      id: 'Panggilan video pihak ketiga (Zoom/Discord) yang berat dan terpisah dari tugas aktif.',
      en: 'Heavy third-party video calls (Zoom/Discord) detached from active tasks.',
    },
    codepulse: {
      id: 'Grid IDE WebRTC 60 FPS tanpa instalasi yang terhubung langsung ke kartu #CP-XX.',
      en: 'Zero-install 60 FPS browser WebRTC IDE grid linked directly to #CP-XX cards.',
    },
  },
  {
    key: 'team-rbac',
    dimension: { id: 'Undangan Tim & Peran', en: 'Team Invitations & Roles' },
    legacy: {
      id: 'Spreadsheet terpisah atau hak admin global lintas repository yang tidak terkait.',
      en: 'Disconnected spreadsheets or global admin roles across unrelated repos.',
    },
    codepulse: {
      id: 'RBAC Leader/Kontributor per proyek dengan tautan undangan & log audit lengkap.',
      en: 'Per-project Leader/Contributor RBAC with shareable invite links & audit logs.',
    },
  },
  {
    key: 'token-storage',
    dimension: { id: 'Penyimpanan OAuth & Token', en: 'OAuth & Token Storage' },
    legacy: {
      id: 'Token mentah ditempel di berkas .env bersama atau terekspos di localStorage frontend.',
      en: 'Raw tokens pasted in shared .env files or exposed in frontend localStorage.',
    },
    codepulse: {
      id: 'Enkripsi AES-256-GCM at rest khusus server dengan sesi HTTP-only bertanda tangan.',
      en: 'Server-only AES-256-GCM encryption at rest with HTTP-only signed sessions.',
    },
  },
];

/* ==========================================================================
   DATA: WORKFLOW
   ========================================================================== */

interface WorkflowStepDetail {
  step: string;
  actor: BiText;
  title: BiText;
  summary: BiText;
  badge: BiText;
  latency: BiText;
  trigger: BiText;
  guardrail: BiText;
  outcome: BiText;
  sampleTitle: BiText;
  sampleLines: string[];
}

const WORKFLOW_STEPS: WorkflowStepDetail[] = [
  {
    step: '01',
    actor: { id: 'Project Leader', en: 'Project Leader' },
    title: {
      id: 'Inisialisasi Workspace & Kunci Branch main',
      en: 'Initialize Workspace & Lock main Branch',
    },
    summary: {
      id: 'Impor repository GitHub saat onboarding atau Quick Import Hub, konfigurasi preset Vercel & env var di aplikasi, dan kunci branch main otomatis.',
      en: 'Import a GitHub repository directly during onboarding or Hub Quick Import, configure Vercel preset & env vars in-app, and lock main automatically.',
    },
    badge: { id: 'Kunci Branch Octokit', en: 'Octokit Branch Lock' },
    latency: { id: 'setup ~1,2 dtk', en: '~1.2s setup' },
    trigger: {
      id: 'POST /api/workspaces menautkan repository GitHub & menyiapkan proyek Vercel opsional.',
      en: 'POST /api/workspaces links GitHub repository & provisions optional Vercel project.',
    },
    guardrail: {
      id: 'Octokit menegakkan proteksi main: wajib review PR, berlaku untuk admin, nol direct push.',
      en: 'Octokit enforces main protection: required PR review, admins enforced, zero direct push.',
    },
    outcome: {
      id: 'Status workspace, secret webhook, dan token terenkripsi tersimpan di Vault AES-256-GCM.',
      en: 'Workspace state, webhook secret, and encrypted tokens persisted in AES-256-GCM vault.',
    },
    sampleTitle: { id: 'API: Provisioning Workspace', en: 'API: Workspace Provisioning' },
    sampleLines: [
      'POST /api/workspaces/ws_89a/github/connect',
      '  repo: "org/campussync-web"  branch: "main"',
      '✓ GitHub Branch Protection enabled (strict=true)',
      '✓ Webhook registered → /api/webhooks/github',
    ],
  },
  {
    step: '02',
    actor: { id: 'Anggota Tim', en: 'Team Member' },
    title: {
      id: 'Ambil Tugas & Push ke Branch Fitur',
      en: 'Claim Task & Push to Feature Branch',
    },
    summary: {
      id: 'Terima undangan tim, pilih kartu #CP-XX di papan Kanban, kerjakan pada branch fitur terisolasi, lalu commit dengan tag ID tugas.',
      en: 'Accept team invite, pick a #CP-XX card on the Kanban board, build on an isolated feature branch, and commit with the task ID tag.',
    },
    badge: { id: 'git push origin feat/*', en: 'git push origin feat/*' },
    latency: { id: 'Branch terisolasi', en: 'Isolated branch' },
    trigger: {
      id: 'Developer memindahkan kartu ke In Progress dan mengirim push commit bertanda #CP-XX pada branch fitur.',
      en: 'Developer drags card to In Progress and pushes commits tagging #CP-XX on a feature branch.',
    },
    guardrail: {
      id: 'Direct push menuju branch main langsung ditolak oleh remote GitHub (HTTP 403).',
      en: 'Direct pushes targeting main are immediately blocked at the GitHub remote (HTTP 403).',
    },
    outcome: {
      id: 'Metadata commit dan referensi branch tetap terisolasi rapi hingga siap direview.',
      en: 'Commit metadata and branch reference remain cleanly isolated until ready for review.',
    },
    sampleTitle: { id: 'CLI: Commit Branch Fitur', en: 'CLI: Feature Branch Commit' },
    sampleLines: [
      '$ git checkout -b feat/cp-02-oauth-guard',
      '$ git commit -m "feat: add timing-safe session check #CP-02"',
      '$ git push -u origin feat/cp-02-oauth-guard',
      '→ Pull Request #14 opened against main',
    ],
  },
  {
    step: '03',
    actor: { id: 'Mesin Webhook', en: 'Webhook Engine' },
    title: {
      id: 'Transisi Status Otomatis di Bawah 3 Detik',
      en: 'Sub-3s Automated Status Transition',
    },
    summary: {
      id: 'CodePulse memverifikasi tanda tangan webhook HMAC-SHA256, mengekstrak #CP-XX dari commit atau PR, menyematkan ringkasan diff, dan memindahkan kartu ke In Review.',
      en: 'CodePulse verifies the HMAC-SHA256 webhook signature, extracts #CP-XX from the commit or PR, attaches the diff summary, and moves the card to In Review.',
    },
    badge: { id: 'SLA HMAC-SHA256 < 3 dtk', en: 'HMAC-SHA256 < 3s SLA' },
    latency: { id: 'rata-rata ~84ms', en: '~84ms avg' },
    trigger: {
      id: 'GitHub mengirim payload webhook push / pull_request ke /api/webhooks/github.',
      en: 'GitHub fires push / pull_request webhook payload to /api/webhooks/github.',
    },
    guardrail: {
      id: 'Server memvalidasi digest HMAC X-Hub-Signature-256 secara timing-safe sebelum mengubah status.',
      en: 'Server validates X-Hub-Signature-256 timing-safe HMAC digest before mutating state.',
    },
    outcome: {
      id: 'Kartu berpindah ke In Review otomatis dan menyiarkan diff + SHA via WebSocket.',
      en: 'Card moves to In Review automatically and broadcasts diff + SHA via WebSocket.',
    },
    sampleTitle: { id: 'Jejak Verifikasi Webhook', en: 'Webhook Verification Trace' },
    sampleLines: [
      'POST /api/webhooks/github [X-GitHub-Event: push]',
      '✓ X-Hub-Signature-256 verified (timingSafeEqual)',
      '✓ Extracted task code: #CP-02 (commit e73b8d1)',
      '⚡ WS broadcast: task:updated → status="in_review" (84ms)',
    ],
  },
  {
    step: '04',
    actor: { id: 'Project Leader', en: 'Project Leader' },
    title: {
      id: 'Periksa Diff & Eksekusi Merge Gatekeeper',
      en: 'Inspect Diff & Execute Gatekeeper Merge',
    },
    summary: {
      id: 'Tinjau perubahan kode baris demi baris di dalam Modal Diff Gatekeeper. Hanya Project Leader yang dapat menyetujui dan melakukan Squash Merge ke main—atau meminta revisi.',
      en: 'Review unified line-by-line code changes inside the Gatekeeper Diff Modal. Only the Project Leader can approve and squash-merge into main—or request changes.',
    },
    badge: { id: 'Zero Direct Push', en: 'Zero Direct Push' },
    latency: { id: 'Dijaga RBAC', en: 'RBAC gated' },
    trigger: {
      id: 'Leader membuka kartu tugas In Review dan memeriksa penambahan/penghapusan berkas di Modal Diff.',
      en: 'Leader opens the In Review task card and inspects file additions/deletions inside Diff Modal.',
    },
    guardrail: {
      id: 'Kontrol Akses Berbasis Peran (RBAC) memblokir endpoint merge untuk sesi Anggota Tim (403).',
      en: 'Role-Based Access Control blocks merge endpoints for Team Member sessions (403).',
    },
    outcome: {
      id: 'Squash Merge dieksekusi mulus di GitHub dan memindahkan tugas ke Done di semua layar.',
      en: 'Squash-merge executes cleanly on GitHub and transitions the task to Done across all screens.',
    },
    sampleTitle: { id: 'Gatekeeper Setujui & Merge', en: 'Gatekeeper Approve & Merge' },
    sampleLines: [
      'POST /api/workspaces/ws_89a/gatekeeper/tasks/t_02/approve-merge',
      '  actor: @leader (role="leader")  method: "squash"',
      '✓ PR #14 merged cleanly into main (sha 9a4f21c)',
      '✓ #CP-02 moved In Review → Done · Auto-deploy queued',
    ],
  },
  {
    step: '05',
    actor: { id: 'Sistem & Tim', en: 'System & Team' },
    title: {
      id: 'Deploy Vercel Langsung & Monitor Live 60 FPS',
      en: 'Direct Vercel Deploy & 60 FPS Live Monitor',
    },
    summary: {
      id: 'Merge yang disetujui memicu deployment Vercel Edge langsung dari snapshot tarball GitHub beserta log real-time, sementara developer menayangkan IDE 1080p 60 FPS via WebRTC.',
      en: 'Approved merges trigger Vercel Edge deployments straight from GitHub tarball snapshots with live logs, while developers stream 1080p 60 FPS IDE feeds via WebRTC.',
    },
    badge: { id: 'Vercel Edge + 60 FPS', en: 'Vercel Edge + 60 FPS' },
    latency: { id: 'build Edge ~16 dtk', en: '~16s Edge build' },
    trigger: {
      id: 'Auto-deploy pasca-merge atau tombol Deploy Sekarang memicu Vercel v13 API; WebRTC berbagi layar.',
      en: 'Post-merge auto-deploy or manual Deploy Now triggers Vercel v13 API; WebRTC shares screen.',
    },
    guardrail: {
      id: 'Server mendekripsi token Vercel hanya di memori per permintaan; sinyal WebRTC lewat WS workspace.',
      en: 'Server decrypts Vercel token in memory per request; WebRTC signals flow over workspace WS.',
    },
    outcome: {
      id: 'URL pratinjau Ready langsung muncul di tab Deployment berdampingan dengan feed IDE latensi rendah.',
      en: 'Live Ready preview URL surfaces in Deployments alongside low-latency browser IDE feeds.',
    },
    sampleTitle: { id: 'Snapshot Vercel & Stream WebRTC', en: 'Vercel Snapshot & WebRTC Stream' },
    sampleLines: [
      '[Vercel v13] Snapshot uploaded (42 files, preset: vite)',
      '[Vercel v13] Build READY → https://campussync.vercel.app',
      '[WebRTC P2P] @nadia-dev streaming 1080p @ 60 FPS (ICE: connected)',
    ],
  },
];

type ScenarioId = 'blocked' | 'changes' | 'fallback';

const FAILURE_SCENARIOS: Array<{
  id: ScenarioId;
  title: BiText;
  tag: BiText;
  tone: string;
  description: BiText;
  trace: string[];
  resolution: BiText;
}> = [
  {
    id: 'blocked',
    title: { id: 'Percobaan Direct Push ke main', en: 'Direct Push to main Attempted' },
    tag: { id: 'PROTEKSI AKTIF', en: 'PROTECTION ACTIVE' },
    tone: 'text-rose-300 border-rose-500/30 bg-rose-500/10',
    description: {
      id: 'Seorang kontributor tidak sengaja menjalankan git push origin main tanpa membuat branch fitur atau PR.',
      en: 'A contributor accidentally runs git push origin main without opening a feature branch or PR.',
    },
    trace: [
      '$ git push origin main',
      'remote: error: GH006: Protected branch update failed for refs/heads/main.',
      'remote: Changes must be made through a pull request (CodePulse Gatekeeper).',
      '[Audit Log] Blocked direct push recorded (+1 blockedDirectPushes)',
    ],
    resolution: {
      id: 'Developer menjalankan git checkout -b feat/cp-07-fix && git push -u origin feat/cp-07-fix. Webhook menyinkronkan #CP-07 ke In Review secara otomatis.',
      en: 'Developer runs git checkout -b feat/cp-07-fix && git push -u origin feat/cp-07-fix. Webhook syncs #CP-07 to In Review automatically.',
    },
  },
  {
    id: 'changes',
    title: { id: 'Leader Meminta Revisi pada Diff', en: 'Leader Requests Changes on Diff' },
    tag: { id: 'SIKLUS FEEDBACK', en: 'FEEDBACK LOOP' },
    tone: 'text-amber-300 border-amber-500/30 bg-amber-500/10',
    description: {
      id: 'Saat meninjau diff, Project Leader menemukan edge case yang belum ditangani dan menolak merge.',
      en: 'During diff review, the Project Leader catches an unhandled edge case and declines the merge.',
    },
    trace: [
      'POST /gatekeeper/tasks/cp-04/request-changes',
      '  comment: "Validate empty token payload before calling decryptToken()"',
      '✓ Card #CP-04 moved back: In Review → In Progress',
      '⚡ Real-time toast + review note pinned to card for @contributor',
    ],
    resolution: {
      id: 'Kontributor langsung melihat catatan revisi, mendorong commit perbaikan bertanda #CP-04, dan kartu otomatis kembali ke In Review.',
      en: 'Contributor sees feedback instantly, pushes a follow-up commit tagged #CP-04, and the card automatically returns to In Review.',
    },
  },
  {
    id: 'fallback',
    title: { id: 'Token Vercel Belum Ditautkan', en: 'No Vercel Token Linked Yet' },
    tag: { id: 'MODE TANPA HAMBATAN', en: 'ZERO-BLOCKER MODE' },
    tone: 'text-cyan-300 border-cyan-500/30 bg-cyan-500/10',
    description: {
      id: 'Tim mahasiswa atau penguji mencoba merge Gatekeeper sebelum membuat Personal Access Token Vercel.',
      en: 'A student or evaluation team tests Gatekeeper merges before generating a Vercel Personal Access Token.',
    },
    trace: [
      '[Deploy Engine] No Vercel vault token detected for workspace owner.',
      '[Deploy Engine] Switching seamlessly to CodePulse Simulated Pipeline.',
      '✓ Queued → Building → Ready stage logs streamed over WebSocket',
      '✓ Preview deployment record persisted in workspace history',
    ],
    resolution: {
      id: 'Tim tetap dapat menguji seluruh alur Kanban → Gatekeeper → Deploy seketika, lalu menambahkan token Vercel asli kapan saja di Integrasi & Vault.',
      en: 'Teams can test the entire Kanban → Gatekeeper → Deploy workflow immediately, then drop in a real Vercel token anytime in Integrations & Vault.',
    },
  },
];

/* ==========================================================================
   DATA: GOVERNANCE
   ========================================================================== */

const PERMISSION_MATRIX: Array<{
  key: string;
  capability: BiText;
  leader: BiText;
  member: BiText;
  leaderAllowed: boolean;
  memberAllowed: boolean;
}> = [
  {
    key: 'manage-ws',
    capability: {
      id: 'Membuat, mengubah metadata, atau menghapus workspace proyek',
      en: 'Create, edit metadata, or delete project workspaces',
    },
    leader: { id: 'Kontrol Penuh', en: 'Full Control' },
    member: { id: 'Diblokir (403)', en: 'Blocked (403)' },
    leaderAllowed: true,
    memberAllowed: false,
  },
  {
    key: 'repo-lock',
    capability: {
      id: 'Mengonfigurasi tautan repository GitHub & proteksi branch main',
      en: 'Configure GitHub repository link & main Branch Protection',
    },
    leader: { id: 'Akses Penuh', en: 'Full Access' },
    member: { id: 'Hanya Lihat', en: 'View Only' },
    leaderAllowed: true,
    memberAllowed: false,
  },
  {
    key: 'team-invites',
    capability: {
      id: 'Mengundang rekan tim, membuat tautan undangan & mengelola peran anggota',
      en: 'Invite teammates, generate invite links & manage member roles',
    },
    leader: { id: 'Kontrol Penuh', en: 'Full Control' },
    member: { id: 'Lihat Daftar Saja', en: 'View Roster Only' },
    leaderAllowed: true,
    memberAllowed: false,
  },
  {
    key: 'kanban-dnd',
    capability: {
      id: 'Seret-lepas kartu Kanban (To Do / In Progress)',
      en: 'Drag-and-drop Kanban tasks (To Do / In Progress)',
    },
    leader: { id: 'Diizinkan', en: 'Allowed' },
    member: { id: 'Diizinkan', en: 'Allowed' },
    leaderAllowed: true,
    memberAllowed: true,
  },
  {
    key: 'push-feature',
    capability: {
      id: 'Push commit branch fitur dengan tag otomatisasi #CP-XX',
      en: 'Push feature branch commits with #CP-XX automation tag',
    },
    leader: { id: 'Diizinkan', en: 'Allowed' },
    member: { id: 'Diizinkan', en: 'Allowed' },
    leaderAllowed: true,
    memberAllowed: true,
  },
  {
    key: 'gatekeeper-merge',
    capability: {
      id: 'Menyetujui diff PR & mengeksekusi Squash Merge Gatekeeper ke main',
      en: 'Approve PR diff & execute Gatekeeper squash-merge to main',
    },
    leader: { id: 'Kontrol Eksklusif', en: 'Exclusive Control' },
    member: { id: 'Diblokir (RBAC)', en: 'Blocked (RBAC)' },
    leaderAllowed: true,
    memberAllowed: false,
  },
  {
    key: 'webrtc-live',
    capability: {
      id: 'Menyiarkan & memantau sesi layar IDE 60 FPS langsung via WebRTC',
      en: 'Broadcast & watch live 60 FPS IDE screen sessions via WebRTC',
    },
    leader: { id: 'Siar & Pantau', en: 'Host & Monitor' },
    member: { id: 'Siar & Kolaborasi', en: 'Host & Collaborate' },
    leaderAllowed: true,
    memberAllowed: true,
  },
  {
    key: 'vercel-deploy',
    capability: {
      id: 'Menyiapkan proyek Vercel, mengelola env var & memicu Deploy Sekarang',
      en: 'Provision Vercel projects, manage env vars & trigger Deploy Now',
    },
    leader: { id: 'Kontrol Eksklusif', en: 'Exclusive Control' },
    member: { id: 'Lihat Status Saja', en: 'View Status Only' },
    leaderAllowed: true,
    memberAllowed: false,
  },
];

const RBAC_SIMULATION_ENDPOINTS: Array<{
  method: string;
  endpoint: string;
  action: BiText;
  leaderAllowed: boolean;
  memberAllowed: boolean;
}> = [
  {
    method: 'POST',
    endpoint: '/api/workspaces/:id/gatekeeper/tasks/:taskId/approve-merge',
    action: {
      id: 'Setujui Diff & Squash Merge ke main',
      en: 'Approve Diff & Squash-Merge to main',
    },
    leaderAllowed: true,
    memberAllowed: false,
  },
  {
    method: 'POST',
    endpoint: '/api/workspaces/:id/deployments',
    action: {
      id: 'Picu Deployment Produksi Vercel',
      en: 'Trigger Production Vercel Deployment',
    },
    leaderAllowed: true,
    memberAllowed: false,
  },
  {
    method: 'PUT',
    endpoint: '/api/workspaces/:id/vercel/env',
    action: {
      id: 'Tulis Environment Variable Vercel Terenkripsi',
      en: 'Write Encrypted Vercel Environment Variables',
    },
    leaderAllowed: true,
    memberAllowed: false,
  },
  {
    method: 'POST',
    endpoint: '/api/workspaces/:id/invitations',
    action: {
      id: 'Kirim Undangan Tim / Buat Tautan Berbagi',
      en: 'Send Team Invitation / Generate Shareable Link',
    },
    leaderAllowed: true,
    memberAllowed: false,
  },
  {
    method: 'DELETE',
    endpoint: '/api/workspaces/:id',
    action: {
      id: 'Hapus Workspace Proyek (Zona Berbahaya)',
      en: 'Delete Project Workspace (Danger Zone)',
    },
    leaderAllowed: true,
    memberAllowed: false,
  },
  {
    method: 'PATCH',
    endpoint: '/api/workspaces/:id/tasks/:taskId',
    action: {
      id: 'Pindahkan Kartu Kanban (To Do ↔ In Progress)',
      en: 'Move Kanban Task (To Do ↔ In Progress)',
    },
    leaderAllowed: true,
    memberAllowed: true,
  },
  {
    method: 'POST',
    endpoint: '/api/workspaces/:id/sessions/start',
    action: {
      id: 'Siarkan Layar IDE 60 FPS Langsung via WebRTC',
      en: 'Broadcast 60 FPS Live IDE Screen via WebRTC',
    },
    leaderAllowed: true,
    memberAllowed: true,
  },
  {
    method: 'GET',
    endpoint: '/api/workspaces/:id/webhooks/events',
    action: {
      id: 'Periksa Log Audit Webhook & Gatekeeper',
      en: 'Inspect Webhook & Gatekeeper Audit Logs',
    },
    leaderAllowed: true,
    memberAllowed: true,
  },
];

/* ==========================================================================
   DATA: ARCHITECTURE (OPEN-SOURCE & STACK-AGNOSTIC ECOSYSTEM)
   ========================================================================== */

type ArchTierId = 'developer' | 'gatekeeper' | 'vault' | 'ecosystem';

const SUPPORTED_ECOSYSTEMS: Array<{
  key: string;
  badge: BiText;
  title: BiText;
  description: BiText;
  stacks: string[];
  accent: string;
}> = [
  {
    key: 'web-frontend',
    badge: { id: 'WEB & FULL-STACK', en: 'WEB & FULL-STACK' },
    title: { id: 'Aplikasi Web & Frontend Modern', en: 'Modern Web & Frontend Apps' },
    description: {
      id: 'Kanban otomatis, proteksi branch main, review diff, Live IDE 60 FPS, plus opsi deploy langsung 1-klik ke Vercel Edge.',
      en: 'Automated Kanban, main branch lock, diff reviews, 60 FPS Live IDE, plus optional 1-click direct deploy to Vercel Edge.',
    },
    stacks: ['Next.js', 'Vite', 'React', 'Vue / Nuxt', 'SvelteKit', 'Astro', 'HTML/CSS'],
    accent: 'text-cyan-300 border-cyan-500/25 bg-cyan-500/10',
  },
  {
    key: 'backend-api',
    badge: { id: 'BACKEND & API', en: 'BACKEND & API' },
    title: { id: 'Service Backend, API & Microservices', en: 'Backend Services, APIs & Microservices' },
    description: {
      id: 'Kelola tugas, review PR lintas kontributor, dan pantau live coding tanpa mengganggu pipeline CI/CD Docker, VPS, atau cloud Anda.',
      en: 'Orchestrate tasks, review contributor PRs, and monitor live coding without interfering with your Docker, VPS, or cloud CI/CD.',
    },
    stacks: ['Node.js', 'Go', 'Python / FastAPI', 'Django', 'PHP / Laravel', 'Rust', 'Java / Spring'],
    accent: 'text-indigo-300 border-indigo-500/25 bg-indigo-500/10',
  },
  {
    key: 'mobile-cli',
    badge: { id: 'MOBILE, CLI & MONOREPO', en: 'MOBILE, CLI & MONOREPO' },
    title: { id: 'Aplikasi Mobile, Desktop & Library', en: 'Mobile, Desktop & Library Repos' },
    description: {
      id: 'Karena integrasi bekerja di level Git & Pull Request, repositori non-web tetap menikmati seluruh fitur Gatekeeper dan monitor browser.',
      en: 'Because integration runs at the Git & Pull Request layer, non-web repositories get full Gatekeeper and browser monitoring.',
    },
    stacks: ['Flutter', 'React Native', 'Kotlin / Swift', 'Electron', 'CLI / SDK', 'Monorepo'],
    accent: 'text-violet-300 border-violet-500/25 bg-violet-500/10',
  },
  {
    key: 'open-source',
    badge: { id: 'OPEN SOURCE & KOMUNITAS', en: 'OPEN SOURCE & COMMUNITY' },
    title: { id: 'Proyek Open Source & Self-Host', en: 'Open-Source Projects & Self-Hosting' },
    description: {
      id: 'Undang kontributor eksternal lewat tautan berbagi, lindungi branch utama dari direct push, dan jalankan secara terbuka tanpa vendor lock-in.',
      en: 'Onboard external contributors via shareable links, guard main from direct pushes, and run openly with zero vendor lock-in.',
    },
    stacks: ['Repos Publik & Privat', 'Maintainer RBAC', 'Invite Links', 'Self-Host Ready', 'Open Standards'],
    accent: 'text-emerald-300 border-emerald-500/25 bg-emerald-500/10',
  },
];

const ARCH_TIERS: Array<{
  id: ArchTierId;
  badge: BiText;
  title: BiText;
  subtitle: BiText;
  accent: string;
  protocol: string;
  responsibilities: BiText[];
  components: string[];
}> = [
  {
    id: 'developer',
    badge: { id: 'LAPISAN 01 · DEVELOPER', en: 'TIER 01 · DEVELOPER' },
    title: {
      id: 'Lingkungan Kerja Bebas Stack & IDE',
      en: 'Stack-Agnostic & IDE-Free Workspace',
    },
    subtitle: {
      id: 'Tim dan kontributor bebas menggunakan bahasa pemrograman, framework, dan editor favorit tanpa instalasi plugin.',
      en: 'Teams and contributors freely use any programming language, framework, or editor with zero plugin installs.',
    },
    accent: 'border-indigo-500/35 text-indigo-300 bg-indigo-500/10',
    protocol: 'Standard Git · Browser HTTPS · WebRTC',
    responsibilities: [
      {
        id: 'Kompatibel dengan VS Code, Cursor, JetBrains, Neovim, Antigravity, hingga workflow Git CLI standar',
        en: 'Compatible with VS Code, Cursor, JetBrains, Neovim, Antigravity, and standard Git CLI workflows',
      },
      {
        id: 'Cukup sertakan tag #CP-XX di pesan commit atau PR pada proyek bahasa apa pun untuk menyinkronkan papan Kanban',
        en: 'Simply include #CP-XX in commit or PR messages on any language stack to automate Kanban transitions',
      },
      {
        id: 'Menyiarkan layar IDE 1080p 60 FPS langsung dari browser standar tanpa perlu memasang agen desktop',
        en: 'Streams 1080p 60 FPS IDE windows directly from a standard browser with zero desktop agents required',
      },
    ],
    components: ['Any Language / Stack', 'Any Code Editor', 'Standard Git Flow', 'Zero IDE Plugin', 'Browser WebRTC'],
  },
  {
    id: 'gatekeeper',
    badge: { id: 'LAPISAN 02 · OTOMASI & GATEKEEPER', en: 'TIER 02 · AUTOMATION & GATEKEEPER' },
    title: {
      id: 'Mesin Webhook, Proteksi Branch & Realtime',
      en: 'Webhook Engine, Branch Guard & Realtime Hub',
    },
    subtitle: {
      id: 'Beroperasi di atas standar terbuka GitHub Webhooks, verifikasi HMAC, dan WebSocket terisolasi per proyek.',
      en: 'Operates on open GitHub Webhooks, cryptographic HMAC verification, and project-scoped WebSockets.',
    },
    accent: 'border-cyan-500/35 text-cyan-300 bg-cyan-500/10',
    protocol: 'HMAC-SHA256 · REST API · Realtime WS',
    responsibilities: [
      {
        id: 'Memvalidasi setiap event push dan pull_request dengan digest HMAC-SHA256 timing-safe sebelum memproses tugas',
        en: 'Validates every incoming push and pull_request event via timing-safe HMAC-SHA256 before updating tasks',
      },
      {
        id: 'Menegakkan RBAC per proyek: Maintainer/Leader menyetujui diff & Squash Merge, kontributor bebas eksplorasi di branch fitur',
        en: 'Enforces per-project RBAC: Maintainers/Leaders approve diffs & squash-merge while contributors build on feature branches',
      },
      {
        id: 'Menyiarkan pembaruan status, log audit, dan sinyal WebRTC secara instan ke seluruh anggota workspace',
        en: 'Broadcasts live board state, audit logs, and WebRTC signaling instantly across every workspace member',
      },
    ],
    components: ['HMAC-SHA256 Verify', 'Branch Lock API', 'Unified Diff Review', 'Per-Project RBAC', 'WebSocket Sync'],
  },
  {
    id: 'vault',
    badge: { id: 'LAPISAN 03 · KEAMANAN & VAULT', en: 'TIER 03 · SECURITY & VAULT' },
    title: {
      id: 'Zero-Trust Vault & Penyimpanan Portabel',
      en: 'Zero-Trust Vault & Portable Persistence',
    },
    subtitle: {
      id: 'Kode sumber tetap 100% di repositori GitHub Anda, sementara kredensial disimpan terenkripsi sisi server.',
      en: 'Source code stays 100% in your GitHub repository while credentials remain encrypted server-side.',
    },
    accent: 'border-emerald-500/35 text-emerald-300 bg-emerald-500/10',
    protocol: 'AES-256-GCM · HTTP-Only Session · TLS',
    responsibilities: [
      {
        id: 'Token OAuth GitHub dan token deployment dienkripsi AES-256-GCM di server dan tidak pernah dikirim ke browser',
        en: 'GitHub OAuth and deployment tokens are AES-256-GCM encrypted server-side and never exposed to browsers',
      },
      {
        id: 'CodePulse hanya menyimpan metadata tugas, undangan, dan jejak audit — tanpa menyandera atau menyalin kepemilikan kode Anda',
        en: 'CodePulse stores only task metadata, invitations, and audit trails — never locking in or owning your source code',
      },
      {
        id: 'Lapisan data portabel mendukung database PostgreSQL cloud maupun mode mandiri lokal untuk komunitas yang ingin self-host',
        en: 'Portable storage layer supports managed PostgreSQL or standalone local mode for self-hosted open-source communities',
      },
    ],
    components: ['AES-256-GCM Vault', 'HTTP-Only Sessions', 'Audit Trail Logs', 'Zero Source Lock-In', 'Self-Host Ready'],
  },
  {
    id: 'ecosystem',
    badge: { id: 'LAPISAN 04 · EKOSISTEM TERBUKA', en: 'TIER 04 · OPEN ECOSYSTEM' },
    title: {
      id: 'Integrasi GitHub, Rilis Fleksibel & P2P Media',
      en: 'GitHub Integration, Flexible Delivery & P2P Media',
    },
    subtitle: {
      id: 'Hubungkan repositori publik/privat, deploy web langsung ke Vercel Edge, atau padukan dengan CI/CD pilihan Anda.',
      en: 'Connect public or private repos, ship web apps straight to Vercel Edge, or pair freely with your own CI/CD.',
    },
    accent: 'border-violet-500/35 text-violet-300 bg-violet-500/10',
    protocol: 'OAuth 2.0 · Open REST · ICE STUN/TURN',
    responsibilities: [
      {
        id: 'Mendukung repositori open-source (publik) maupun privat di GitHub untuk pengelolaan kolaborasi tim yang disiplin',
        en: 'Supports both public open-source and private GitHub repositories for disciplined team collaboration',
      },
      {
        id: 'Untuk proyek web, tersedia deployment langsung ke Vercel Edge tanpa impor ulang; proyek backend/mobile tetap bebas pakai GitHub Actions atau Docker',
        en: 'Offers direct 1-click Vercel Edge deployments for web apps, while backend/mobile projects seamlessly coexist with GitHub Actions or Docker',
      },
      {
        id: 'Transpor WebRTC P2P melalui STUN/TURN menjaga kolaborasi live IDE tetap lancar menembus firewall jaringan kampus & kantor',
        en: 'ICE STUN/TURN WebRTC transport keeps P2P live IDE collaboration smooth across campus and corporate firewalls',
      },
    ],
    components: ['GitHub Public & Private', 'Vercel Edge (Optional)', 'GitHub Actions Ready', 'STUN / TURN P2P', 'Open Protocols'],
  },
];

const ARCH_FAQS: Array<{ key: string; q: BiText; a: BiText }> = [
  {
    key: 'stack-agnostic',
    q: {
      id: 'Apakah proyek yang dihubungkan ke CodePulse wajib memakai stack tertentu (mis. React atau Node.js)?',
      en: 'Does my project have to use a specific tech stack (like React or Node.js) to use CodePulse?',
    },
    a: {
      id: 'Tidak sama sekali. CodePulse bersifat 100% stack-agnostic untuk proyek Anda karena seluruh sinkronisasi Kanban, penguncian branch main, inspeksi diff PR, undangan tim, dan Monitor IDE 60 FPS berjalan di level Git, GitHub Webhook, dan browser WebRTC. Repositori Python, Go, Rust, PHP/Laravel, Flutter, Java, Next.js, hingga monorepo open-source semuanya didukung penuh.',
      en: 'Not at all. CodePulse is 100% stack-agnostic for your projects because Kanban automation, main branch protection, PR diff review, team invitations, and 60 FPS Live IDE Monitoring all operate at the Git, GitHub Webhook, and browser WebRTC layers. Python, Go, Rust, PHP/Laravel, Flutter, Java, Next.js, and open-source monorepos all work seamlessly.',
    },
  },
  {
    key: 'non-vercel-projects',
    q: {
      id: 'Bagaimana jika proyek open-source saya bukan proyek web Vercel (misalnya API backend, CLI, atau aplikasi mobile)?',
      en: 'What if my open-source project is not a Vercel web app (such as a backend API, CLI, or mobile app)?',
    },
    a: {
      id: 'Integrasi Vercel sepenuhnya opsional. Anda tetap bisa memakai seluruh fitur inti CodePulse — Papan Kanban otomatis, Gatekeeper proteksi main, review diff kode, undangan kontributor, dan Live IDE Monitor — sambil membiarkan rilis produksi ditangani oleh GitHub Actions, Docker, Play Store/App Store, atau server milik tim Anda sendiri.',
      en: 'Vercel integration is completely optional. You still get every core CodePulse capability — automated Kanban, main branch Gatekeeper, code diff reviews, contributor invitations, and Live IDE Monitor — while letting GitHub Actions, Docker, app stores, or your own servers handle production releases.',
    },
  },
  {
    key: 'vercel-no-import',
    q: {
      id: 'Untuk proyek web, apakah saya harus impor repositori manual di vercel.com dulu?',
      en: 'For web apps, do I have to manually import my repository on vercel.com first?',
    },
    a: {
      id: 'Tidak perlu. Setelah token Vercel ditautkan di Vault terenkripsi, CodePulse dapat mendeteksi preset framework proyek web Anda, menyiapkan proyek Vercel baru, mengelola environment variable, dan mengirim snapshot rilis langsung dari tab Deployment.',
      en: 'No. Once your Vercel token is linked in the encrypted Vault, CodePulse automatically detects your web framework preset, provisions a new Vercel project, manages environment variables, and ships release snapshots directly from the Deployments tab.',
    },
  },
  {
    key: 'token-security',
    q: {
      id: 'Bagaimana keamanan kode dan token kontributor open-source dijaga?',
      en: 'How are source code and open-source contributor credentials kept secure?',
    },
    a: {
      id: 'Kode Anda tidak pernah berpindah kepemilikan dan tetap berada penuh di repositori GitHub Anda. Kredensial OAuth dan token deployment dienkripsi AES-256-GCM di sisi server, dilindungi cookie sesi HTTP-only, dan akses merge dibatasi ketat lewat RBAC per proyek.',
      en: 'Your source code always stays in your GitHub repository with zero lock-in. OAuth and deployment tokens are encrypted server-side using AES-256-GCM, protected by HTTP-only session cookies, and merge privileges are strictly isolated via per-project RBAC.',
    },
  },
  {
    key: 'open-source-self-host',
    q: {
      id: 'Bisakah CodePulse di-self-host atau dikembangkan bersama oleh komunitas open-source?',
      en: 'Can CodePulse be self-hosted or extended by open-source communities?',
    },
    a: {
      id: 'Ya. CodePulse dibangun di atas protokol web terbuka (GitHub OAuth, Webhook HMAC standar, WebRTC P2P, serta penyimpanan portabel PostgreSQL atau mode lokal), sehingga organisasi, laboratorium kampus, maupun komunitas open-source dapat mengaudit, memodifikasi, atau menjalankan instance mandiri di infrastruktur mereka sendiri.',
      en: 'Yes. CodePulse is built on open web standards (GitHub OAuth, standard HMAC Webhooks, P2P WebRTC, and portable PostgreSQL or standalone local storage), making it straightforward for organizations, university labs, and open-source communities to audit, fork, or self-host on their own infrastructure.',
    },
  },
];

/* ==========================================================================
   SHARED FOOTER CTA BANNER FOR INNER PAGES
   ========================================================================== */

function InnerPageCtaBanner({
  eyebrow,
  title,
  subtitle,
  nextPage,
  nextLabel,
  onNavigatePage,
  onOpenAuth,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  nextPage: PublicPageId;
  nextLabel: string;
  onNavigatePage?: (page: PublicPageId) => void;
  onOpenAuth?: (mode?: 'login' | 'register') => void;
}) {
  const { L } = useLanguage();
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.45, ease: EASE_OUT_EXPO }}
      className="cp-panel rounded-3xl p-7 sm:p-9 relative overflow-hidden border-indigo-500/20"
    >
      <div
        className="pointer-events-none absolute -top-24 -right-24 w-80 h-80 rounded-full opacity-20 blur-3xl"
        style={{
          background:
            'radial-gradient(circle, rgba(99,102,241,0.75) 0%, rgba(34,211,238,0.2) 60%, transparent 100%)',
        }}
      />
      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="text-[11px] font-mono uppercase tracking-widest text-cyan-300">
            {eyebrow}
          </div>
          <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-white">{title}</h3>
          <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {onNavigatePage && (
            <button
              type="button"
              onClick={() => onNavigatePage(nextPage)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/12 text-xs font-semibold text-zinc-200 transition cursor-pointer"
            >
              <span>{nextLabel}</span>
              <ArrowRight className="w-3.5 h-3.5 text-cyan-400" />
            </button>
          )}
          {onOpenAuth && (
            <button
              type="button"
              onClick={() => onOpenAuth('register')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-semibold shadow-lg transition cursor-pointer"
            >
              <span>{L('Mulai Gratis', 'Get Started Free')}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ==========================================================================
   PAGE 1: CAPABILITIES
   ========================================================================== */

export function CapabilitiesPageView({ onNavigatePage, onOpenAuth }: PublicPageProps) {
  const { L } = useLanguage();
  const [activeTab, setActiveTab] = useState<CapabilityTabId>('gatekeeper');
  const selectedDeepDive =
    CAPABILITY_TABS.find((t) => t.id === activeTab) ?? CAPABILITY_TABS[0];

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-16 pb-10 space-y-14">
      {/* Header + Capability KPI Strip */}
      <div className="space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: EASE_OUT_EXPO }}
          className="max-w-3xl space-y-3"
        >
          <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-indigo-400">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{L('Fitur Platform', 'Platform Capabilities')}</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-white">
            {L(
              'Enam pilar terintegrasi untuk pengiriman perangkat lunak yang disiplin.',
              'Six integrated pillars built for disciplined software delivery.',
            )}
          </h1>
          <p className="text-sm sm:text-base text-zinc-400 leading-relaxed">
            {L(
              'Setiap modul di CodePulse bekerja selaras melalui WebSocket real-time, GitHub API, Vercel Edge, dan Supabase untuk menghapus pembaruan status manual, merge berisiko, dan fragmentasi alat kerja.',
              'Every module in CodePulse works together over real-time WebSockets, GitHub APIs, Vercel Edge, and Supabase to eliminate manual status chasing, unsafe merges, and tool fragmentation.',
            )}
          </p>
        </motion.div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          {[
            {
              key: 'webhook-sla',
              value: '< 3s',
              label: L('SLA Sinkronisasi Webhook', 'Webhook Sync SLA'),
              detail: L('Commit terverifikasi HMAC-SHA256', 'HMAC-SHA256 verified commits'),
              tone: 'text-cyan-300',
            },
            {
              key: 'live-ide',
              value: '60 FPS',
              label: L('Pemantauan IDE Langsung', 'Live IDE Monitoring'),
              detail: L('Preset stream WebRTC P2P 1080p', '1080p P2P WebRTC stream presets'),
              tone: 'text-violet-300',
            },
            {
              key: 'vercel-zero',
              value: '0-Click',
              label: L('Setup Eksternal Vercel', 'Vercel External Setup'),
              detail: L('Siapkan & deploy langsung di aplikasi', 'Provision & deploy right in-app'),
              tone: 'text-emerald-300',
            },
            {
              key: 'aes-vault',
              value: '256-bit',
              label: L('Vault Token AES-GCM', 'AES-GCM Token Vault'),
              detail: L('Kunci GitHub & Vercel khusus server', 'Server-only GitHub & Vercel keys'),
              tone: 'text-amber-300',
            },
          ].map((stat, idx) => (
            <motion.div
              key={stat.key}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: idx * 0.05, ease: EASE_OUT_EXPO }}
              className="cp-panel rounded-2xl p-4 sm:p-5 space-y-1"
            >
              <div className={`text-2xl sm:text-3xl font-bold font-mono tracking-tight ${stat.tone}`}>
                {stat.value}
              </div>
              <div className="text-xs font-semibold text-white">{stat.label}</div>
              <div className="text-[11px] text-zinc-500">{stat.detail}</div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Six Pillars Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-5">
        {/* Card 1: Webhook Automation (3 cols) */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ y: -3, transition: { duration: 0.18, ease: EASE_OUT_EXPO } }}
          transition={{ duration: 0.42, delay: 0.04, ease: EASE_OUT_EXPO }}
          className="md:col-span-3 cp-panel rounded-2xl p-6 space-y-4 hover:border-cyan-500/35 transition-colors"
        >
          <div className="flex items-center justify-between">
            <span className="p-2.5 rounded-xl bg-cyan-500/12 border border-cyan-500/25 text-cyan-300">
              <Webhook className="w-5 h-5" />
            </span>
            <span className="font-mono text-[11px] text-zinc-500">
              {L('OTOMATISASI', 'AUTOMATION')}
            </span>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">
              {L('Otomatisasi Kanban Berbasis Webhook', 'Webhook-Driven Kanban Automation')}
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1.5 leading-relaxed">
              {L(
                <>
                  Sertakan kode tugas seperti <code>#CP-02</code> pada pesan commit atau PR Anda.
                  CodePulse memverifikasi tanda tangan HMAC dan memindahkan kartu ke{' '}
                  <span className="text-violet-300 font-medium">In Review</span> dalam kurang dari
                  3 detik.
                </>,
                <>
                  Mention any task code like <code>#CP-02</code> in your commit or PR. CodePulse
                  verifies HMAC signatures and moves the card to{' '}
                  <span className="text-violet-300 font-medium">In Review</span> in under 3
                  seconds.
                </>,
              )}
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-zinc-950/90 border border-white/8 font-mono text-[11px] space-y-1.5">
            <div className="text-zinc-400">
              $ git commit -m &quot;feat: JWT session guard{' '}
              <span className="text-indigo-300">#CP-02</span>&quot;
            </div>
            <div className="flex items-center justify-between text-emerald-300">
              <span>
                {L(
                  '✓ Webhook menyinkronkan #CP-02 → In Review',
                  '✓ Webhook synced #CP-02 → In Review',
                )}
              </span>
              <span className="text-cyan-300">84ms</span>
            </div>
          </div>
        </motion.div>

        {/* Card 2: Branch Gatekeeper (3 cols) */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ y: -3, transition: { duration: 0.18, ease: EASE_OUT_EXPO } }}
          transition={{ duration: 0.42, delay: 0.09, ease: EASE_OUT_EXPO }}
          className="md:col-span-3 cp-panel rounded-2xl p-6 space-y-4 hover:border-emerald-500/35 transition-colors"
        >
          <div className="flex items-center justify-between">
            <span className="p-2.5 rounded-xl bg-emerald-500/12 border border-emerald-500/25 text-emerald-300">
              <Lock className="w-5 h-5" />
            </span>
            <span className="font-mono text-[11px] text-zinc-500">
              {L('KEAMANAN BRANCH', 'BRANCH SECURITY')}
            </span>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">
              {L(
                'Proteksi Branch Main & Diff Gatekeeper',
                'Main Branch Protection & Diff Gatekeeper',
              )}
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1.5 leading-relaxed">
              {L(
                <>
                  Menautkan repository langsung mengunci branch <code>main</code> lewat GitHub API.
                  Direct push otomatis ditolak, dan hanya Project Leader yang dapat memeriksa diff
                  kode serta mengeklik <strong>Setujui &amp; Merge</strong>.
                </>,
                <>
                  Linking a repository automatically locks <code>main</code> via GitHub API. Direct
                  pushes are rejected, and only the Project Leader can inspect the code diff and
                  click <strong>Approve &amp; Merge</strong>.
                </>,
              )}
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-zinc-950/90 border border-rose-500/25 font-mono text-[11px] space-y-1">
            <div className="text-zinc-400">$ git push origin main</div>
            <div className="text-rose-300 flex items-center gap-1.5">
              <Ban className="w-3.5 h-3.5 shrink-0" />
              <span>remote: Protected branch main — Direct push blocked (403)</span>
            </div>
          </div>
        </motion.div>

        {/* Card 3: Live Screen Monitor (2 cols) */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ y: -3, transition: { duration: 0.18, ease: EASE_OUT_EXPO } }}
          transition={{ duration: 0.42, delay: 0.14, ease: EASE_OUT_EXPO }}
          className="md:col-span-2 cp-panel rounded-2xl p-6 space-y-4 hover:border-violet-500/35 transition-colors"
        >
          <div className="flex items-center justify-between">
            <span className="p-2.5 rounded-xl bg-violet-500/12 border border-violet-500/25 text-violet-300">
              <Monitor className="w-5 h-5" />
            </span>
            <span className="font-mono text-[11px] text-zinc-500">
              {L('MONITOR LANGSUNG', 'LIVE MONITORING')}
            </span>
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">
              {L('Monitor IDE Langsung 60 FPS', '60 FPS Live IDE Monitor')}
            </h2>
            <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
              {L(
                <>
                  Berbagi layar langsung dari browser tanpa instalasi via{' '}
                  <code>getDisplayMedia</code> dengan preset 1080p 60 FPS, traversal STUN/TURN, dan
                  telemetri bitrate langsung.
                </>,
                <>
                  Zero-install browser screen sharing via <code>getDisplayMedia</code> with 1080p
                  60 FPS presets, STUN/TURN traversal, and live bitrate telemetry.
                </>,
              )}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-zinc-950/90 border border-white/8 flex items-center justify-between text-xs">
            <span className="inline-flex items-center gap-1.5 text-zinc-200 font-medium">
              <Radio className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
              @nadia-dev IDE
            </span>
            <span className="font-mono text-[11px] text-emerald-300">60 FPS P2P</span>
          </div>
        </motion.div>

        {/* Card 4: Direct Vercel Provisioning & Deploy (2 cols) */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ y: -3, transition: { duration: 0.18, ease: EASE_OUT_EXPO } }}
          transition={{ duration: 0.42, delay: 0.19, ease: EASE_OUT_EXPO }}
          className="md:col-span-2 cp-panel rounded-2xl p-6 space-y-4 hover:border-white/25 transition-colors"
        >
          <div className="flex items-center justify-between">
            <span className="p-2.5 rounded-xl bg-white/[0.06] border border-white/15 text-white">
              <VercelIcon className="w-5 h-5" />
            </span>
            <span className="font-mono text-[11px] text-zinc-500">
              {L('DEPLOY LANGSUNG', 'DIRECT DEPLOY')}
            </span>
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">
              {L('Provisioning Vercel di Dalam Aplikasi', 'In-App Vercel Provisioning')}
            </h2>
            <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
              {L(
                <>
                  Deteksi otomatis preset framework, kelola env var, dan deploy snapshot GitHub
                  langsung ke Vercel Edge tanpa membuka <code>vercel.com/new</code>.
                </>,
                <>
                  Auto-detect framework presets, manage env vars, and deploy GitHub snapshots
                  straight to Vercel Edge without touching <code>vercel.com/new</code>.
                </>,
              )}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-zinc-950/90 border border-white/8 flex items-center justify-between text-xs font-mono">
            <span className="text-cyan-300 truncate">campussync.vercel.app</span>
            <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 text-[10px]">
              {L('SIAP', 'READY')}
            </span>
          </div>
        </motion.div>

        {/* Card 5: OAuth, Invitations & Encrypted Vault (2 cols) */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ y: -3, transition: { duration: 0.18, ease: EASE_OUT_EXPO } }}
          transition={{ duration: 0.42, delay: 0.24, ease: EASE_OUT_EXPO }}
          className="md:col-span-2 cp-panel rounded-2xl p-6 space-y-4 hover:border-indigo-500/35 transition-colors"
        >
          <div className="flex items-center justify-between">
            <span className="p-2.5 rounded-xl bg-indigo-500/12 border border-indigo-500/25 text-indigo-300">
              <KeyRound className="w-5 h-5" />
            </span>
            <span className="font-mono text-[11px] text-zinc-500">
              {L('IDENTITAS & VAULT', 'IDENTITY & VAULT')}
            </span>
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">
              {L('Undangan & Vault AES-256-GCM', 'Invitations & AES-256-GCM Vault')}
            </h2>
            <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
              {L(
                'Undang anggota melalui handle, email, atau tautan undangan sambil menjaga token GitHub OAuth & Vercel tetap terenkripsi di server.',
                'Invite members via handle, email, or shareable links while keeping GitHub OAuth & Vercel tokens encrypted at rest on the server.',
              )}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-zinc-950/90 border border-white/8 flex items-center justify-between text-[11px] font-mono text-zinc-300">
            <span>{L('RBAC Per-Proyek', 'Per-Project RBAC')}</span>
            <span className="text-indigo-300">{L('Leader / Anggota', 'Leader / Member')}</span>
          </div>
        </motion.div>

        {/* Card 6: Engineering Analytics & Command Palette (6 cols) */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ y: -3, transition: { duration: 0.18, ease: EASE_OUT_EXPO } }}
          transition={{ duration: 0.42, delay: 0.29, ease: EASE_OUT_EXPO }}
          className="md:col-span-6 cp-panel rounded-2xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6 hover:border-sky-500/35 transition-colors"
        >
          <div className="flex items-start gap-4 max-w-2xl">
            <span className="p-2.5 rounded-xl bg-sky-500/12 border border-sky-500/25 text-sky-300 shrink-0">
              <Terminal className="w-5 h-5" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-base font-semibold text-white">
                  {L(
                    'Analitik Ringkasan Engineering & Palet Perintah',
                    'Engineering Overview Analytics & Command Palette',
                  )}
                </h2>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-white/5 border border-white/10 text-zinc-400">
                  Ctrl / Cmd + K
                </span>
              </div>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1.5 leading-relaxed">
                {L(
                  'Pantau pulse aktivitas 7 hari, grafik distribusi donat, dan indikator kesiapan pipeline di setiap workspace—atau lompat langsung ke Kanban, Gatekeeper, dan Deployment lewat pintasan keyboard.',
                  'Track 7-day activity pulses, distribution donuts, and pipeline readiness gauges across every workspace—or jump directly to Kanban, Gatekeeper, and Deployments via keyboard shortcuts.',
                )}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 font-mono text-[11px] shrink-0">
            <span className="px-3 py-1.5 rounded-xl bg-zinc-950/90 border border-white/8 text-cyan-300">
              {L('Grafik Pulse 7 Hari', '7-Day Pulse Charts')}
            </span>
            <span className="px-3 py-1.5 rounded-xl bg-zinc-950/90 border border-white/8 text-emerald-300">
              {L('Sinkronisasi WS Tanpa Refresh', 'Zero Refresh WS Sync')}
            </span>
          </div>
        </motion.div>
      </div>

      {/* Interactive Module Deep-Dive Explorer */}
      <div className="space-y-5">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1.5">
            <div className="text-xs font-mono uppercase tracking-widest text-cyan-400">
              {L('Inspektor Modul Interaktif', 'Interactive Module Inspector')}
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              {L(
                'Telusuri cara kerja setiap mesin CodePulse di balik layar.',
                'Inspect how each CodePulse engine operates under the hood.',
              )}
            </h2>
          </div>

          <div className="flex flex-wrap gap-1.5 p-1 rounded-xl bg-zinc-950/90 border border-white/10">
            {CAPABILITY_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {L(tab.label.id, tab.label.en)}
              </button>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={selectedDeepDive.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: EASE_OUT_EXPO }}
            className="cp-panel rounded-2xl p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center"
          >
            {/* Left: Narrative & Specs */}
            <div className="lg:col-span-6 space-y-5">
              <div className="space-y-2">
                <span className="text-[11px] font-mono uppercase tracking-widest text-indigo-300">
                  {L(selectedDeepDive.eyebrow.id, selectedDeepDive.eyebrow.en)}
                </span>
                <h3 className="text-xl sm:text-2xl font-bold text-white leading-snug">
                  {L(selectedDeepDive.title.id, selectedDeepDive.title.en)}
                </h3>
                <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                  {L(selectedDeepDive.description.id, selectedDeepDive.description.en)}
                </p>
              </div>

              <ul className="space-y-2.5 text-xs sm:text-sm text-zinc-300">
                {selectedDeepDive.bullets.map((bullet, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{L(bullet.id, bullet.en)}</span>
                  </li>
                ))}
              </ul>

              <div className="flex flex-wrap gap-2 pt-1">
                {selectedDeepDive.protocols.map((p, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 rounded-lg bg-zinc-950 border border-white/10 font-mono text-[11px] text-cyan-300"
                  >
                    {L(p.id, p.en)}
                  </span>
                ))}
              </div>
            </div>

            {/* Right: Rich Visual Preview */}
            <div className="lg:col-span-6">
              <CapabilityPreviewCard tab={selectedDeepDive.id} />
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Legacy Stack vs. CodePulse Comparison Table */}
      <div className="space-y-5">
        <div className="max-w-2xl space-y-2">
          <div className="text-xs font-mono uppercase tracking-widest text-emerald-400">
            {L('Mengapa Tim Engineering Beralih', 'Why Engineering Teams Switch')}
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            {L(
              'Gantikan dashboard yang terpecah dengan satu pusat kendali otomatis.',
              'Replace fragmented dashboards with one automated control plane.',
            )}
          </h2>
        </div>

        <div className="cp-panel rounded-2xl overflow-hidden">
          <div className="hidden md:grid grid-cols-12 px-6 py-3.5 border-b border-white/[0.08] bg-zinc-950/70 text-[11px] font-mono uppercase tracking-wider">
            <div className="col-span-3 text-zinc-500">
              {L('Tahap Engineering', 'Engineering Stage')}
            </div>
            <div className="col-span-4 text-rose-300/80">
              {L('Alat Lama yang Terpisah', 'Fragmented Legacy Tools')}
            </div>
            <div className="col-span-5 text-emerald-300">
              {L('CodePulse Enterprise Hub', 'CodePulse Enterprise Hub')}
            </div>
          </div>
          <div className="divide-y divide-white/[0.06]">
            {COMPARISON_ROWS.map((row) => (
              <div
                key={row.key}
                className="px-6 py-4 grid grid-cols-1 md:grid-cols-12 gap-3 md:items-center text-xs"
              >
                <div className="md:col-span-3 font-semibold text-white">
                  {L(row.dimension.id, row.dimension.en)}
                </div>
                <div className="md:col-span-4 flex items-start gap-2 text-zinc-400">
                  <XCircle className="w-4 h-4 text-rose-400/80 shrink-0 mt-0.5" />
                  <span>{L(row.legacy.id, row.legacy.en)}</span>
                </div>
                <div className="md:col-span-5 flex items-start gap-2 text-zinc-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{L(row.codepulse.id, row.codepulse.en)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <InnerPageCtaBanner
        eyebrow={L('Langkah Tur Berikutnya', 'Next Step in Tour')}
        title={L(
          'Lihat bagaimana setiap commit bergerak dari branch fitur hingga URL Vercel aktif.',
          'See how every commit moves from feature branch to live Vercel URL.',
        )}
        subtitle={L(
          'Ikuti siklus pengiriman 5 tahap interaktif, jejak payload webhook, dan pengaman pemulihan kegagalan kami.',
          'Walk through our interactive 5-step delivery lifecycle, webhook payload traces, and failure recovery guardrails.',
        )}
        nextPage="workflow"
        nextLabel={L('Jelajahi Alur Kerja 5 Tahap', 'Explore 5-Step Workflow')}
        onNavigatePage={onNavigatePage}
        onOpenAuth={onOpenAuth}
      />
    </section>
  );
}

function CapabilityPreviewCard({ tab }: { tab: CapabilityTabId }) {
  const { L } = useLanguage();

  if (tab === 'gatekeeper') {
    return (
      <div className="rounded-2xl bg-zinc-950/95 border border-white/10 overflow-hidden shadow-2xl">
        <div className="px-4 py-3 border-b border-white/8 bg-[#0b0d14] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <GitPullRequest className="w-4 h-4 text-violet-400" />
            <span className="font-mono font-semibold text-white">PR #14 • #CP-02</span>
          </div>
          <span className="font-mono text-[11px] text-emerald-300">
            {L('+58 / -6 baris', '+58 / -6 lines')}
          </span>
        </div>
        <div className="p-4 font-mono text-[11px] space-y-1.5 bg-[#06070b]">
          <div className="text-zinc-500">server/src/middleware/auth.ts</div>
          <div className="px-2 py-0.5 rounded bg-rose-500/12 text-rose-300">
            - const valid = signature === expected;
          </div>
          <div className="px-2 py-0.5 rounded bg-emerald-500/12 text-emerald-300">
            + const valid = crypto.timingSafeEqual(sigBuf, expBuf);
          </div>
          <div className="px-2 py-0.5 rounded bg-emerald-500/12 text-emerald-300">
            + if (!valid) return res.status(401).json(&#123; error: &apos;Invalid HMAC&apos; &#125;);
          </div>
        </div>
        <div className="px-4 py-3 border-t border-white/8 bg-[#0b0d14] flex items-center justify-between gap-2 text-xs">
          <span className="text-zinc-400 font-mono text-[11px]">
            {L('Gatekeeper: Khusus Leader', 'Gatekeeper: Leader Only')}
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-600 text-white font-semibold text-[11px]">
            <GitMerge className="w-3.5 h-3.5" />
            {L('Setujui & Squash Merge', 'Approve & Squash Merge')}
          </span>
        </div>
      </div>
    );
  }

  if (tab === 'vercel') {
    return (
      <div className="rounded-2xl bg-zinc-950/95 border border-white/10 overflow-hidden shadow-2xl">
        <div className="px-4 py-3 border-b border-white/8 bg-[#0b0d14] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <VercelIcon className="w-3.5 h-3.5 text-white" />
            <span className="font-semibold text-white">
              {L('Provisioner Proyek Langsung', 'Direct Project Provisioner')}
            </span>
          </div>
          <span className="px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 font-mono text-[10px]">
            {L('Terdeteksi Otomatis: Vite', 'Auto-Detected: Vite')}
          </span>
        </div>
        <div className="p-4 space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-2.5 font-mono text-[11px]">
            <div className="p-2.5 rounded-xl bg-[#06070b] border border-white/8">
              <div className="text-zinc-500 text-[10px]">
                {L('PERINTAH BUILD', 'BUILD COMMAND')}
              </div>
              <div className="text-zinc-200 mt-0.5">npm run build</div>
            </div>
            <div className="p-2.5 rounded-xl bg-[#06070b] border border-white/8">
              <div className="text-zinc-500 text-[10px]">
                {L('DIREKTORI OUTPUT', 'OUTPUT DIR')}
              </div>
              <div className="text-zinc-200 mt-0.5">dist</div>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-[#06070b] border border-white/8 font-mono text-[11px] space-y-1">
            <div className="flex items-center justify-between text-zinc-400">
              <span>VITE_API_URL</span>
              <span className="text-emerald-300">
                {L('Terenkripsi • Produksi', 'Encrypted • Production')}
              </span>
            </div>
            <div className="flex items-center justify-between text-zinc-400">
              <span>SUPABASE_URL</span>
              <span className="text-emerald-300">
                {L('Terenkripsi • Produksi', 'Encrypted • Production')}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono text-emerald-300 pt-1">
            <span>
              {L(
                '✓ Snapshot diunggah langsung ke Vercel Edge',
                '✓ Snapshot uploaded directly to Vercel Edge',
              )}
            </span>
            <span>14.8s</span>
          </div>
        </div>
      </div>
    );
  }

  if (tab === 'webrtc') {
    return (
      <div className="rounded-2xl bg-zinc-950/95 border border-white/10 overflow-hidden shadow-2xl">
        <div className="px-4 py-3 border-b border-white/8 bg-[#0b0d14] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            <span className="font-semibold text-white">@nadia-dev • Live IDE</span>
            <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono text-[10px]">
              #CP-04
            </span>
          </div>
          <span className="font-mono text-[11px] text-emerald-300">1080p • 60 FPS</span>
        </div>
        <div className="p-4 bg-[#06070b] font-mono text-[11px] space-y-1.5">
          <div className="text-zinc-500">
            // {L('Preset Kualitas Saat Siaran Langsung', 'Quality Presets Available on Broadcast')}
          </div>
          <div className="grid grid-cols-3 gap-2 pt-1">
            <div className="p-2 rounded-lg bg-indigo-500/15 border border-indigo-500/35 text-indigo-200 text-center">
              1080p 60 FPS
            </div>
            <div className="p-2 rounded-lg bg-zinc-900 border border-white/8 text-zinc-400 text-center">
              1080p 30 FPS
            </div>
            <div className="p-2 rounded-lg bg-zinc-900 border border-white/8 text-zinc-400 text-center">
              720p 30 FPS
            </div>
          </div>
          <div className="pt-2 text-cyan-300">
            {L(
              'Transport ICE: P2P Langsung (2.450 kbps · 0% packet loss)',
              'ICE Transport: P2P Direct (2,450 kbps · 0% packet loss)',
            )}
          </div>
          <div className="text-zinc-400">
            {L(
              'Jaminan tanpa rekaman · Kanal peer terenkripsi DTLS/SRTP',
              'Zero-recording guarantee · DTLS/SRTP encrypted peer channel',
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-zinc-950/95 border border-white/10 overflow-hidden shadow-2xl">
      <div className="px-4 py-3 border-b border-white/8 bg-[#0b0d14] flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-cyan-400" />
          <span className="font-semibold text-white">
            {L('Undangan & Akses Tim', 'Team Invitations & Access')}
          </span>
        </div>
        <span className="font-mono text-[10px] text-emerald-300">
          {L('RBAC Per-Proyek', 'Per-Project RBAC')}
        </span>
      </div>
      <div className="p-4 space-y-2.5 text-xs">
        <div className="p-3 rounded-xl bg-[#06070b] border border-white/8 flex items-center justify-between">
          <div>
            <div className="font-semibold text-white">@bima-dev</div>
            <div className="text-[11px] text-zinc-500 font-mono">
              {L('Kode: CP-9K4M2X • Kontributor', 'Code: CP-9K4M2X • Contributor')}
            </div>
          </div>
          <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 font-mono text-[10px]">
            {L('DITERIMA', 'ACCEPTED')}
          </span>
        </div>
        <div className="p-3 rounded-xl bg-[#06070b] border border-white/8 flex items-center justify-between">
          <div>
            <div className="font-semibold text-white">
              {L('Tautan Undangan Terbuka', 'Open Shareable Invite Link')}
            </div>
            <div className="text-[11px] text-cyan-300 font-mono truncate">
              codepulse.hub/?invite=CP-7R2Q8A
            </div>
          </div>
          <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 font-mono text-[10px]">
            {L('MENUNGGU', 'PENDING')}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   PAGE 2: WORKFLOW
   ========================================================================== */

export function WorkflowPageView({ onNavigatePage, onOpenAuth }: PublicPageProps) {
  const { L } = useLanguage();
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [scenarioId, setScenarioId] = useState<ScenarioId>('blocked');
  const current = WORKFLOW_STEPS[selectedIdx];
  const activeScenario =
    FAILURE_SCENARIOS.find((s) => s.id === scenarioId) ?? FAILURE_SCENARIOS[0];

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-16 pb-10 space-y-14">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: EASE_OUT_EXPO }}
        className="flex flex-col md:flex-row md:items-end justify-between gap-4"
      >
        <div className="max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-cyan-400">
            <Zap className="w-3.5 h-3.5" />
            <span>{L('Siklus End-to-End', 'End-to-End Lifecycle')}</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-white">
            {L(
              'Cara tim engineering merilis kode di dalam CodePulse.',
              'How engineering teams ship inside CodePulse.',
            )}
          </h1>
        </div>
        <p className="text-xs sm:text-sm text-zinc-400 max-w-sm">
          {L(
            'Pilih tahapan siklus di bawah untuk memeriksa pemicu API, pengaman keamanan otomatis, contoh jejak langsung, dan hasil real-time.',
            'Select any lifecycle stage below to inspect API triggers, automated security guardrails, live sample traces, and real-time outcomes.',
          )}
        </p>
      </motion.div>

      {/* 5-Stage Pipeline Cards */}
      <div className="relative">
        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ duration: 0.65, ease: EASE_OUT_EXPO }}
          style={{ transformOrigin: 'left center' }}
          className="hidden lg:block absolute top-6 left-8 right-8 h-px bg-gradient-to-r from-indigo-500/40 via-cyan-400/40 to-emerald-400/40"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 relative z-10">
          {WORKFLOW_STEPS.map((item, idx) => {
            const isSelected = idx === selectedIdx;
            return (
              <motion.button
                key={item.step}
                type="button"
                onClick={() => setSelectedIdx(idx)}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -3, transition: { duration: 0.18, ease: EASE_OUT_EXPO } }}
                transition={{ duration: 0.4, delay: idx * 0.05, ease: EASE_OUT_EXPO }}
                className={`text-left cp-panel rounded-2xl p-5 flex flex-col justify-between gap-4 transition-colors cursor-pointer ${
                  isSelected
                    ? 'border-indigo-400/60 bg-indigo-500/[0.08]'
                    : 'hover:border-white/20'
                }`}
              >
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`w-8 h-8 rounded-xl border font-mono text-xs font-bold flex items-center justify-center shadow-sm transition ${
                        isSelected
                          ? 'bg-indigo-500 text-zinc-950 border-indigo-400'
                          : 'bg-zinc-950 border-indigo-500/40 text-indigo-300'
                      }`}
                    >
                      {item.step}
                    </span>
                    <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/8 text-zinc-400">
                      {L(item.actor.id, item.actor.en)}
                    </span>
                  </div>

                  <h2 className="text-sm font-semibold text-white leading-snug">
                    {L(item.title.id, item.title.en)}
                  </h2>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {L(item.summary.id, item.summary.en)}
                  </p>
                </div>

                <div className="pt-3 border-t border-white/8 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center font-mono text-[10px] px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                    {L(item.badge.id, item.badge.en)}
                  </span>
                  <span className="font-mono text-[10px] text-zinc-500">
                    {L(item.latency.id, item.latency.en)}
                  </span>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Selected Step Execution Deep-Dive + Live Command/Payload Trace */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={current.step}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2, ease: EASE_OUT_EXPO }}
          className="cp-panel rounded-2xl p-6 space-y-5 border-indigo-500/25"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/[0.07]">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs px-2.5 py-1 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-300">
                {L('TAHAP', 'STEP')} {current.step}
              </span>
              <h3 className="text-base sm:text-lg font-semibold text-white">
                {L(current.title.id, current.title.en)}
              </h3>
            </div>
            <div className="flex items-center gap-3 font-mono text-[11px]">
              <span className="text-zinc-500">{L(current.latency.id, current.latency.en)}</span>
              <span className="text-cyan-300">{L(current.actor.id, current.actor.en)}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-zinc-950/90 border border-white/8 space-y-1.5">
              <div className="font-mono text-[10px] uppercase tracking-wider text-indigo-300">
                {L('1. Pemicu Event', '1. Event Trigger')}
              </div>
              <p className="text-zinc-300 leading-relaxed">
                {L(current.trigger.id, current.trigger.en)}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-zinc-950/90 border border-white/8 space-y-1.5">
              <div className="font-mono text-[10px] uppercase tracking-wider text-emerald-300">
                {L('2. Pengaman Otomatis', '2. Automated Guardrail')}
              </div>
              <p className="text-zinc-300 leading-relaxed">
                {L(current.guardrail.id, current.guardrail.en)}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-zinc-950/90 border border-white/8 space-y-1.5">
              <div className="font-mono text-[10px] uppercase tracking-wider text-cyan-300">
                {L('3. Hasil Real-Time', '3. Real-Time Outcome')}
              </div>
              <p className="text-zinc-300 leading-relaxed">
                {L(current.outcome.id, current.outcome.en)}
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#06070b] border border-white/10 font-mono text-[11px] space-y-1.5">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 pb-1 border-b border-white/[0.06] flex items-center justify-between">
              <span>{L(current.sampleTitle.id, current.sampleTitle.en)}</span>
              <span className="text-emerald-400">
                {L('Contoh Protokol Langsung', 'Live Protocol Example')}
              </span>
            </div>
            {current.sampleLines.map((line, i) => (
              <div
                key={i}
                className={
                  line.startsWith('✓')
                    ? 'text-emerald-300'
                    : line.startsWith('⚡') || line.startsWith('→')
                      ? 'text-cyan-300'
                      : 'text-zinc-300'
                }
              >
                {line}
              </div>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Edge Cases & Guardrail Recovery Playbook */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 space-y-4">
          <div className="space-y-2">
            <div className="text-xs font-mono uppercase tracking-widest text-amber-400">
              {L('Panduan Pengamanan', 'Guardrail Playbook')}
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white">
              {L(
                'Apa yang terjadi saat alur keluar dari jalur?',
                'What happens when things go off-script?',
              )}
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              {L(
                'Tim engineering sungguhan menghadapi kesalahan setiap hari. Lihat bagaimana CodePulse melindungi produksi dan memandu developer kembali ke jalur aman secara otomatis.',
                'Real engineering teams hit mistakes daily. Inspect how CodePulse protects production and guides developers back onto the happy path automatically.',
              )}
            </p>
          </div>

          <div className="space-y-2.5">
            {FAILURE_SCENARIOS.map((sc) => {
              const active = sc.id === scenarioId;
              return (
                <button
                  key={sc.id}
                  type="button"
                  onClick={() => setScenarioId(sc.id)}
                  className={`w-full text-left p-4 rounded-xl border transition cursor-pointer ${
                    active
                      ? 'bg-white/[0.05] border-indigo-400/50'
                      : 'bg-zinc-950/70 border-white/8 hover:border-white/18'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-white">
                      {L(sc.title.id, sc.title.en)}
                    </span>
                    <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${sc.tone}`}>
                      {L(sc.tag.id, sc.tag.en)}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1.5 leading-relaxed">
                    {L(sc.description.id, sc.description.en)}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-7 cp-panel rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-white/[0.07]">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span>{L(activeScenario.title.id, activeScenario.title.en)}</span>
            </div>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${activeScenario.tone}`}>
              {L(activeScenario.tag.id, activeScenario.tag.en)}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-[#06070b] border border-white/10 font-mono text-[11px] space-y-1.5">
            {activeScenario.trace.map((line, idx) => (
              <div
                key={idx}
                className={
                  line.includes('error') || line.includes('Blocked')
                    ? 'text-rose-300'
                    : line.startsWith('✓')
                      ? 'text-emerald-300'
                      : line.startsWith('⚡')
                        ? 'text-cyan-300'
                        : 'text-zinc-300'
                }
              >
                {line}
              </div>
            ))}
          </div>

          <div className="p-4 rounded-xl bg-emerald-500/[0.07] border border-emerald-500/20 space-y-1.5">
            <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-300">
              {L('Jalur Pemulihan Bersih', 'Clean Recovery Path')}
            </div>
            <p className="text-xs text-zinc-200 leading-relaxed">
              {L(activeScenario.resolution.id, activeScenario.resolution.en)}
            </p>
          </div>
        </div>
      </div>

      {/* Commit Tagging & SLA Latency Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 cp-panel rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-white">
              <Code2 className="w-4 h-4 text-indigo-400" />
              <span>
                {L(
                  'Panduan Singkat Tag Commit & Penamaan Branch',
                  'Commit Tag & Branch Naming Cheat Sheet',
                )}
              </span>
            </div>
            <span className="font-mono text-[10px] text-zinc-500">Regex: /#CP-\d+/gi</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-[11px]">
            {[
              {
                branch: 'feat/cp-02-auth-guard',
                commit: 'feat: verify JWT cookie #CP-02',
                result: L('Memindahkan #CP-02 → In Review', 'Moves #CP-02 → In Review'),
              },
              {
                branch: 'fix/cp-09-diff-scroll',
                commit: 'fix: preserve diff line wrap #CP-09',
                result: L('Menyematkan commit SHA + diff', 'Attaches commit SHA + diff'),
              },
              {
                branch: 'refactor/cp-14-vault',
                commit: 'refactor: rotate AES key #CP-14',
                result: L('Memberi notifikasi Leader Gatekeeper', 'Notifies Leader Gatekeeper'),
              },
              {
                branch: 'feat/cp-21-multi',
                commit: 'feat: ship API #CP-21 #CP-22',
                result: L('Menyinkronkan banyak kartu sekaligus', 'Syncs multiple cards at once'),
              },
            ].map((ex) => (
              <div
                key={ex.branch}
                className="p-3.5 rounded-xl bg-zinc-950/90 border border-white/8 space-y-1.5"
              >
                <div className="text-cyan-300 flex items-center gap-1.5">
                  <GitBranch className="w-3 h-3 shrink-0" />
                  <span className="truncate">{ex.branch}</span>
                </div>
                <div className="text-zinc-300 truncate">{ex.commit}</div>
                <div className="text-emerald-400 text-[10px]">✓ {ex.result}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-5 cp-panel rounded-2xl p-6 space-y-4">
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-white">
            <Activity className="w-4 h-4 text-cyan-400" />
            <span>{L('Anggaran Latensi Webhook < 3 Detik', 'Sub-3s Webhook Latency Budget')}</span>
          </div>
          <div className="space-y-3 text-xs">
            {[
              {
                t: 't + 0ms',
                stage: L('Webhook Push / PR GitHub Dikirim', 'GitHub Push / PR Webhook Dispatched'),
                pct: '15%',
              },
              {
                t: 't + 28ms',
                stage: L(
                  'Digest HMAC-SHA256 Diverifikasi (timingSafeEqual)',
                  'HMAC-SHA256 Digest Verified (timingSafeEqual)',
                ),
                pct: '38%',
              },
              {
                t: 't + 54ms',
                stage: L(
                  'Baris Tugas Supabase & Log Audit Diperbarui',
                  'Supabase Task Row & Audit Log Updated',
                ),
                pct: '68%',
              },
              {
                t: 't + 84ms',
                stage: L(
                  'Broadcast WebSocket Memperbarui Semua Browser',
                  'WebSocket Broadcast Updates All Browsers',
                ),
                pct: '100%',
              },
            ].map((item) => (
              <div key={item.t} className="space-y-1">
                <div className="flex items-center justify-between font-mono text-[11px]">
                  <span className="text-zinc-200">{item.stage}</span>
                  <span className="text-cyan-300 shrink-0 ml-2">{item.t}</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-cyan-400 to-emerald-400"
                    style={{ width: item.pct }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <InnerPageCtaBanner
        eyebrow={L('Langkah Tur Berikutnya', 'Next Step in Tour')}
        title={L(
          'Lihat bagaimana Project Leader dan Kontributor berbagi kendali dengan aman.',
          'Inspect how Project Leaders and Contributors share control safely.',
        )}
        subtitle={L(
          'Jelajahi RBAC per proyek, simulasi izin API interaktif, dan tautan undangan tim yang dapat dibagikan.',
          'Explore per-project RBAC, interactive API permission simulation, and shareable team invitation links.',
        )}
        nextPage="governance"
        nextLabel={L('Jelajahi Tata Kelola Peran', 'Explore Role Governance')}
        onNavigatePage={onNavigatePage}
        onOpenAuth={onOpenAuth}
      />
    </section>
  );
}

/* ==========================================================================
   PAGE 3: GOVERNANCE
   ========================================================================== */

export function GovernancePageView({ onNavigatePage, onOpenAuth }: PublicPageProps) {
  const { L } = useLanguage();
  const [simulatedRole, setSimulatedRole] = useState<'leader' | 'member'>('leader');

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-16 pb-10 space-y-14">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: EASE_OUT_EXPO }}
        className="max-w-3xl space-y-3"
      >
        <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-emerald-400">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>{L('Tata Kelola Akses Berbasis Peran', 'Role-Based Access Governance')}</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-white">
          {L(
            'Pemisahan tegas antara eksekusi kode dan persetujuan produksi.',
            'Clear separation between execution and production approval.',
          )}
        </h1>
        <p className="text-sm sm:text-base text-zinc-400 leading-relaxed">
          {L(
            <>
              CodePulse menegakkan <strong>RBAC per-proyek</strong> di sisi server pada penguncian
              repository, merge Pull Request, undangan tim, dan deployment Vercel—sehingga Anda
              dapat memimpin satu proyek sembari berkontribusi aman di proyek lain.
            </>,
            <>
              CodePulse enforces server-side, <strong>per-project RBAC</strong> on repository
              locks, pull-request merges, team invitations, and Vercel deployments—so you can lead
              one project while contributing safely to another.
            </>,
          )}
        </p>
      </motion.div>

      {/* Dual Role Deep Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ y: -3, transition: { duration: 0.18, ease: EASE_OUT_EXPO } }}
          transition={{ duration: 0.42, delay: 0.05, ease: EASE_OUT_EXPO }}
          className="cp-panel rounded-2xl p-7 space-y-5 border-indigo-500/25"
        >
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-2 text-indigo-300 text-xs font-semibold uppercase tracking-wider">
              <UserCheck className="w-4 h-4" />
              <span>{L('Project Leader / Pembimbing', 'Project Leader / Supervisor')}</span>
            </div>
            <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300">
              ADMIN GATEKEEPER
            </span>
          </div>
          <h2 className="text-xl font-bold text-white">
            {L(
              'Tinjau diff, lindungi main, kelola akses tim, dan rilis ke produksi.',
              'Review diffs, protect main, govern team access, and ship production.',
            )}
          </h2>
          <ul className="space-y-2.5 text-sm text-zinc-300">
            {[
              L(
                'Membuat, mengubah metadata, atau menghapus workspace proyek dengan aman',
                'Create, edit metadata, or safely delete project workspaces',
              ),
              L(
                'Menautkan repository GitHub & menegakkan proteksi branch main otomatis',
                'Link GitHub repos & enforce automated main branch protection',
              ),
              L(
                'Memeriksa unified diff PR dan mengeksekusi Setujui & Squash Merge',
                'Inspect unified PR code diffs and execute Approve & Squash-Merge',
              ),
              L(
                'Menyiapkan proyek Vercel, mengatur env var & menjalankan Deploy Sekarang',
                'Provision Vercel projects, configure env vars & run Deploy Now',
              ),
              L(
                'Mengirim undangan tim langsung, membuat tautan berbagi & mengatur peran',
                'Send direct team invites, generate shareable links & manage roles',
              ),
              L(
                'Memantau grid IDE WebRTC 60 FPS langsung & memeriksa log audit webhook',
                'Monitor live 60 FPS WebRTC IDE grid & review webhook audit logs',
              ),
            ].map((item, idx) => (
              <li key={idx} className="flex items-start gap-2.5">
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ y: -3, transition: { duration: 0.18, ease: EASE_OUT_EXPO } }}
          transition={{ duration: 0.42, delay: 0.12, ease: EASE_OUT_EXPO }}
          className="cp-panel rounded-2xl p-7 space-y-5 border-cyan-500/25"
        >
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-2 text-cyan-300 text-xs font-semibold uppercase tracking-wider">
              <Users className="w-4 h-4" />
              <span>{L('Anggota Tim / Kontributor', 'Team Member / Contributor')}</span>
            </div>
            <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300">
              {L('KONTRIBUTOR', 'CONTRIBUTOR')}
            </span>
          </div>
          <h2 className="text-xl font-bold text-white">
            {L(
              'Kirim fitur cepat pada branch terisolasi tanpa khawatir konflik merge.',
              'Ship features rapidly on isolated branches with zero merge-conflict fear.',
            )}
          </h2>
          <ul className="space-y-2.5 text-sm text-zinc-300">
            {[
              L(
                'Bergabung ke proyek dalam satu klik via undangan langsung atau kode undangan',
                'Join projects in one click via direct invite or shareable invite code',
              ),
              L(
                'Membuat & mengatur kartu Kanban di kolom To Do dan In Progress',
                'Create & organize Kanban cards across To Do and In Progress columns',
              ),
              L(
                'Push commit branch fitur dengan tag #CP-XX untuk sinkronisasi otomatis ke In Review',
                'Push feature branch commits with #CP-XX tags for auto In Review sync',
              ),
              L(
                'Menyiarkan jendela IDE 1080p 60 FPS langsung dari Chrome via WebRTC',
                'Broadcast 1080p 60 FPS IDE window directly from Chrome via WebRTC',
              ),
              L(
                'Melihat status diff PR langsung, komentar review Leader & URL deployment',
                'View live PR diff status, Leader review comments & deployment URLs',
              ),
              L(
                'Terlindungi dari ketidaksengajaan push ke main atau mengubah env var produksi',
                'Protected from accidentally pushing to main or modifying prod env vars',
              ),
            ].map((item, idx) => (
              <li key={idx} className="flex items-start gap-2.5">
                <Check className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>

      {/* Interactive RBAC Endpoint Simulator */}
      <div className="cp-panel rounded-2xl p-6 sm:p-7 space-y-5 border-white/12">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.07]">
          <div className="space-y-1">
            <div className="text-[11px] font-mono uppercase tracking-widest text-indigo-300">
              {L('Simulator RBAC Interaktif', 'Interactive RBAC Simulator')}
            </div>
            <h3 className="text-lg font-bold text-white">
              {L(
                'Uji otorisasi API sisi server berdasarkan peran',
                'Test server-side API authorization by role',
              )}
            </h3>
            <p className="text-xs text-zinc-400">
              {L(
                'Beralih antara Leader dan Kontributor untuk melihat bagaimana middleware otorisasi server menjaga setiap endpoint.',
                'Toggle between Leader and Contributor to see exactly how server-side authorization middleware guards each endpoint.',
              )}
            </p>
          </div>

          <div className="inline-flex p-1 rounded-xl bg-zinc-950 border border-white/10 shrink-0">
            <button
              type="button"
              onClick={() => setSimulatedRole('leader')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                simulatedRole === 'leader'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Project Leader
            </button>
            <button
              type="button"
              onClick={() => setSimulatedRole('member')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                simulatedRole === 'member'
                  ? 'bg-cyan-600 text-white shadow'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {L('Kontributor', 'Contributor')}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {RBAC_SIMULATION_ENDPOINTS.map((ep) => {
            const allowed =
              simulatedRole === 'leader' ? ep.leaderAllowed : ep.memberAllowed;
            return (
              <div
                key={ep.endpoint}
                className={`p-3.5 rounded-xl border transition flex items-start justify-between gap-3 ${
                  allowed
                    ? 'bg-zinc-950/90 border-emerald-500/20'
                    : 'bg-rose-950/15 border-rose-500/25'
                }`}
              >
                <div className="min-w-0 space-y-1">
                  <div className="text-xs font-semibold text-white">
                    {L(ep.action.id, ep.action.en)}
                  </div>
                  <div className="font-mono text-[10px] text-zinc-500 truncate">
                    <span className="text-indigo-300">{ep.method}</span> {ep.endpoint}
                  </div>
                </div>
                <span
                  className={`font-mono text-[10px] px-2 py-1 rounded-md shrink-0 border ${
                    allowed
                      ? 'bg-emerald-500/12 border-emerald-500/25 text-emerald-300'
                      : 'bg-rose-500/12 border-rose-500/30 text-rose-300'
                  }`}
                >
                  {allowed ? L('200 IZINKAN', '200 ALLOW') : L('403 TOLAK', '403 DENY')}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Team Invitation & Membership Lifecycle */}
      <div className="space-y-5">
        <div className="max-w-2xl space-y-1.5">
          <div className="text-xs font-mono uppercase tracking-widest text-cyan-400">
            {L('Akses Tim & Undangan', 'Team Access & Invitations')}
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">
            {L(
              'Kolaborasi tanpa hambatan tanpa mengorbankan batas kepemilikan.',
              'Seamless collaboration without losing ownership boundaries.',
            )}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              key: 'direct-invite',
              icon: <UserPlus className="w-4 h-4 text-indigo-300" />,
              title: L('Undangan Langsung @Handle & Email', 'Direct @Handle & Email Invites'),
              desc: L(
                'Leader mengundang rekan tim langsung dari Pengaturan Proyek → Tim dengan penetapan peran Kontributor atau Project Lead secara eksplisit.',
                'Leaders invite teammates straight from Project Settings → Team with explicit Contributor or Project Lead role assignment.',
              ),
            },
            {
              key: 'share-link',
              icon: <Link2 className="w-4 h-4 text-cyan-300" />,
              title: L('Tautan Undangan Berbagi (/?invite=)', 'Shareable Invite Links (/?invite=)'),
              desc: L(
                'Buat satu URL undangan yang tetap tersimpan melewati proses Daftar & onboarding GitHub OAuth agar anggota baru langsung masuk ke workspace.',
                'Generate a single invite URL that persists through Sign Up & GitHub OAuth onboarding so new members land right in the workspace.',
              ),
            },
            {
              key: 'owner-guard',
              icon: <ShieldCheck className="w-4 h-4 text-emerald-300" />,
              title: L('Proteksi Pemilik & Pencabutan Akses', 'Owner Protection & Revocation'),
              desc: L(
                'Leader dapat mempromosikan, menurunkan peran, mencabut undangan tertunda, atau mengeluarkan anggota—sementara pemilik awal workspace selalu terlindungi dari penguncian.',
                'Leaders can promote, demote, revoke pending invites, or remove members—while the original workspace owner is always protected from lockout.',
              ),
            },
          ].map((card) => (
            <div key={card.key} className="cp-panel rounded-2xl p-5 space-y-2.5">
              <div className="w-9 h-9 rounded-xl bg-zinc-950 border border-white/10 flex items-center justify-center">
                {card.icon}
              </div>
              <h3 className="text-sm font-semibold text-white">{card.title}</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">{card.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Role Permissions Matrix */}
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.45, ease: EASE_OUT_EXPO }}
        className="cp-panel rounded-2xl overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-white/[0.07] flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">
            {L('Matriks Penegakan Lengkap', 'Complete Enforcement Matrix')}
          </h3>
          <span className="font-mono text-[11px] text-zinc-500">
            {L('RBAC Sesi HTTP-Only', 'HTTP-Only Session RBAC')}
          </span>
        </div>
        <div className="divide-y divide-white/[0.06] text-xs">
          {PERMISSION_MATRIX.map((row) => (
            <div
              key={row.key}
              className="px-6 py-3.5 grid grid-cols-1 sm:grid-cols-12 gap-2 sm:items-center"
            >
              <div className="sm:col-span-6 text-zinc-200 font-medium">
                {L(row.capability.id, row.capability.en)}
              </div>
              <div className="sm:col-span-3 flex items-center gap-2 font-mono text-[11px]">
                <span className="text-zinc-500 sm:hidden">Leader:</span>
                <span className={row.leaderAllowed ? 'text-emerald-300' : 'text-zinc-500'}>
                  {L(row.leader.id, row.leader.en)}
                </span>
              </div>
              <div className="sm:col-span-3 flex items-center gap-2 font-mono text-[11px]">
                <span className="text-zinc-500 sm:hidden">{L('Anggota:', 'Member:')}</span>
                <span className={row.memberAllowed ? 'text-cyan-300' : 'text-amber-300/90'}>
                  {L(row.member.id, row.member.en)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      <InnerPageCtaBanner
        eyebrow={L('Langkah Tur Berikutnya', 'Next Step in Tour')}
        title={L(
          'Lihat bagaimana arsitektur terbuka CodePulse mendukung semua tech stack.',
          'See how CodePulse open architecture supports every tech stack.',
        )}
        subtitle={L(
          'Pelajari kompatibilitas proyek open-source lintas bahasa, keamanan Vault AES-256-GCM, WebRTC P2P tanpa rekaman, dan kesiapan self-hosting.',
          'Explore multi-language open-source compatibility, AES-256-GCM Vault security, zero-recording WebRTC P2P, and self-hosting readiness.',
        )}
        nextPage="architecture"
        nextLabel={L('Jelajahi Arsitektur Terbuka', 'Explore Open Architecture')}
        onNavigatePage={onNavigatePage}
        onOpenAuth={onOpenAuth}
      />
    </section>
  );
}

/* ==========================================================================
   PAGE 4: ARCHITECTURE
   ========================================================================== */

export function ArchitecturePageView({ onNavigatePage, onOpenAuth }: PublicPageProps) {
  const { L } = useLanguage();
  const [selectedTier, setSelectedTier] = useState<ArchTierId>('developer');
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const activeTier = ARCH_TIERS.find((t) => t.id === selectedTier) ?? ARCH_TIERS[0];

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-16 pb-10 space-y-14">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: EASE_OUT_EXPO }}
        className="max-w-3xl space-y-3"
      >
        <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-violet-300">
          <Cpu className="w-3.5 h-3.5" />
          <span>{L('Arsitektur Terbuka & Keamanan', 'Open Architecture & Security')}</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-white">
          {L(
            'Dirancang terbuka untuk proyek open-source dengan tech stack apa pun.',
            'Built open for open-source projects on any tech stack.',
          )}
        </h1>
        <p className="text-sm sm:text-base text-zinc-400 leading-relaxed">
          {L(
            'CodePulse bekerja di lapisan standar industri — Git, Pull Request, Webhook HMAC, dan WebRTC browser — sehingga tim Anda bebas memakai bahasa, framework, maupun IDE apa saja tanpa mengunci repositori ke satu ekosistem tertentu.',
            'CodePulse operates on universal standards — Git, Pull Requests, HMAC Webhooks, and browser WebRTC — keeping your team free to build with any language, framework, or IDE without locking repositories into a single stack.',
          )}
        </p>
      </motion.div>

      {/* Supported Stacks & Open-Source Ecosystem Compatibility */}
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-emerald-400">
              {L('Kompatibilitas Multi-Stack & Open Source', 'Multi-Stack & Open-Source Compatibility')}
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mt-1">
              {L(
                'Bawa repositori GitHub apa saja — bukan terbatas pada satu bahasa atau framework',
                'Bring any GitHub repository — never limited to one language or framework',
              )}
            </h2>
          </div>
          <span className="font-mono text-[11px] text-emerald-300">
            {L('100% Stack-Agnostic', '100% Stack-Agnostic')}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SUPPORTED_ECOSYSTEMS.map((eco, idx) => (
            <motion.div
              key={eco.key}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: idx * 0.05, ease: EASE_OUT_EXPO }}
              className="cp-panel rounded-2xl p-6 space-y-4 hover:border-white/20 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`font-mono text-[10px] px-2.5 py-0.5 rounded border ${eco.accent}`}>
                  {L(eco.badge.id, eco.badge.en)}
                </span>
                <FolderGit2 className="w-4 h-4 text-zinc-500" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-semibold text-white">
                  {L(eco.title.id, eco.title.en)}
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  {L(eco.description.id, eco.description.en)}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {eco.stacks.map((stack) => (
                  <span
                    key={stack}
                    className="px-2.5 py-1 rounded-lg bg-zinc-950/90 border border-white/8 font-mono text-[11px] text-zinc-200"
                  >
                    {stack}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Interactive 4-Layer Open Ecosystem Architecture */}
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-cyan-400">
              {L('Arsitektur Ekosistem Terbuka', 'Open Ecosystem Architecture')}
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mt-1">
              {L(
                'Klik lapisan mana saja untuk melihat bagaimana proyek Anda terhubung secara aman',
                'Click any layer to inspect how your project connects safely end-to-end',
              )}
            </h2>
          </div>
          <span className="font-mono text-[11px] text-zinc-500">
            {L('4 Lapisan Standar Terbuka', '4 Open-Standard Layers')}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {ARCH_TIERS.map((tier, idx) => {
            const isSelected = tier.id === selectedTier;
            return (
              <motion.button
                key={tier.id}
                type="button"
                onClick={() => setSelectedTier(tier.id)}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -3, transition: { duration: 0.18, ease: EASE_OUT_EXPO } }}
                transition={{ duration: 0.4, delay: idx * 0.05, ease: EASE_OUT_EXPO }}
                className={`text-left cp-panel rounded-2xl p-5 space-y-3 transition-colors cursor-pointer ${
                  isSelected
                    ? 'border-indigo-400/60 bg-indigo-500/[0.08]'
                    : 'hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`font-mono text-[10px] px-2 py-0.5 rounded border ${tier.accent}`}>
                    {L(tier.badge.id, tier.badge.en)}
                  </span>
                  {tier.id === 'developer' && <Layers className="w-4 h-4 text-indigo-400" />}
                  {tier.id === 'gatekeeper' && <Server className="w-4 h-4 text-cyan-400" />}
                  {tier.id === 'vault' && <Database className="w-4 h-4 text-emerald-400" />}
                  {tier.id === 'ecosystem' && <Globe className="w-4 h-4 text-violet-400" />}
                </div>
                <div className="text-sm font-semibold text-white leading-snug">
                  {L(tier.title.id, tier.title.en)}
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  {L(tier.subtitle.id, tier.subtitle.en)}
                </p>
                <div className="pt-2 border-t border-white/[0.06] font-mono text-[10px] text-zinc-500">
                  {tier.protocol}
                </div>
              </motion.button>
            );
          })}
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeTier.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: EASE_OUT_EXPO }}
            className="cp-panel rounded-2xl p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start border-indigo-500/25"
          >
            <div className="lg:col-span-7 space-y-3.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className={`font-mono text-[10px] px-2.5 py-1 rounded border ${activeTier.accent}`}>
                  {L(activeTier.badge.id, activeTier.badge.en)}
                </span>
                <h3 className="text-base sm:text-lg font-bold text-white">
                  {L(activeTier.title.id, activeTier.title.en)}
                </h3>
              </div>
              <ul className="space-y-2 text-xs sm:text-sm text-zinc-300">
                {activeTier.responsibilities.map((r, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <GitCommit className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                    <span>{L(r.id, r.en)}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="lg:col-span-5 p-4 rounded-xl bg-zinc-950/90 border border-white/8 space-y-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                {L('Standar & Kapabilitas Lapisan', 'Layer Standards & Capabilities')}
              </div>
              <div className="font-mono text-xs text-cyan-300">{activeTier.protocol}</div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {activeTier.components.map((comp) => (
                  <span
                    key={comp}
                    className="px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/10 font-mono text-[11px] text-zinc-200"
                  >
                    {comp}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* 3 Core Open Data & Integration Flows */}
      <div className="space-y-5">
        <div className="max-w-2xl space-y-1.5">
          <div className="text-xs font-mono uppercase tracking-widest text-emerald-400">
            {L('Cetak Biru Aliran Integrasi', 'Integration Flow Blueprints')}
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">
            {L(
              'Bagaimana alur kerja terbuka berjalan dari commit hingga rilis',
              'How open delivery pipelines run from commit to release',
            )}
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {[
            {
              key: 'webhook-flow',
              icon: <GitHubIcon className="w-4 h-4 text-white" />,
              title: L('1. Otomasi Git & Gatekeeper', '1. Git Automation & Gatekeeper'),
              steps: [
                L(
                  'Kontributor push commit atau buka PR dengan tag #CP-XX dari bahasa apa saja',
                  'Contributor pushes commits or opens a PR with #CP-XX on any language stack',
                ),
                L(
                  'Webhook GitHub diverifikasi secara kriptografis (HMAC-SHA256 timing-safe)',
                  'GitHub webhook payload is verified cryptographically (timing-safe HMAC-SHA256)',
                ),
                L(
                  'Kartu Kanban otomatis pindah ke Dalam Review lengkap dengan ringkasan diff',
                  'Kanban card transitions automatically to In Review with full diff context',
                ),
                L(
                  'Project Leader meninjau perubahan dan melakukan Squash Merge aman ke main',
                  'Project Leader reviews changes and executes a clean Squash Merge to main',
                ),
              ],
            },
            {
              key: 'vercel-flow',
              icon: <VercelIcon className="w-4 h-4 text-white" />,
              title: L('2. Rilis Fleksibel (Vercel / CI Mandiri)', '2. Flexible Release (Vercel / Own CI)'),
              steps: [
                L(
                  'Untuk aplikasi web: deteksi preset framework & atur env var langsung di CodePulse',
                  'For web apps: auto-detect framework presets & configure env vars right inside CodePulse',
                ),
                L(
                  'Snapshot branch otomatis dikirim ke Vercel Edge tanpa perlu impor manual ulang',
                  'Branch snapshots ship directly to Vercel Edge with zero manual re-importing',
                ),
                L(
                  'Log build mengalir real-time dari Antrean → Build → Siap hingga URL live muncul',
                  'Build logs stream live from Queued → Building → Ready until the live URL appears',
                ),
                L(
                  'Untuk proyek backend/mobile/CLI: tetap bebas dipadukan dengan GitHub Actions atau Docker',
                  'For backend/mobile/CLI repos: pair seamlessly with GitHub Actions, Docker, or your own CI',
                ),
              ],
            },
            {
              key: 'webrtc-flow',
              icon: <Radio className="w-4 h-4 text-violet-300" />,
              title: L('3. Live IDE 60 FPS Peer-to-Peer', '3. Peer-to-Peer 60 FPS Live IDE'),
              steps: [
                L(
                  'Developer memilih jendela IDE apa saja di browser (preset hingga 1080p 60 FPS)',
                  'Developer picks any IDE window straight from the browser (up to 1080p 60 FPS)',
                ),
                L(
                  'Pensinyalan WebRTC ringan mempertemukan peer di dalam ruang proyek yang sah',
                  'Lightweight WebRTC signaling pairs authorized peers inside the workspace room',
                ),
                L(
                  'STUN/TURN membuka koneksi langsung DTLS/SRTP terenkripsi antar browser',
                  'STUN/TURN negotiates a direct encrypted DTLS/SRTP browser-to-browser connection',
                ),
                L(
                  'Video mengalir latensi rendah tanpa pernah direkam atau disimpan di server',
                  'Low-latency video streams directly with zero server-side recording or storage',
                ),
              ],
            },
          ].map((flow) => (
            <div key={flow.key} className="cp-panel rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-zinc-950 border border-white/10 flex items-center justify-center">
                  {flow.icon}
                </div>
                <h3 className="text-sm font-semibold text-white">{flow.title}</h3>
              </div>
              <ol className="space-y-2.5 text-xs text-zinc-400">
                {flow.steps.map((stepText, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-md bg-white/[0.05] border border-white/10 font-mono text-[10px] text-cyan-300 inline-flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <span className="leading-relaxed text-zinc-300">{stepText}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </div>

      {/* 6 Open-Source & Security Guarantees */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <GuaranteeCard
          icon={<ShieldCheck className="w-4 h-4 text-emerald-400" />}
          title={L('Nol Kebocoran Token', 'Zero Token Leakage')}
          tone="text-emerald-300"
          desc={L(
            'Token GitHub OAuth dan Personal Access Token Vercel tetap terenkripsi AES-256-GCM di server dan tidak pernah diekspos ke klien.',
            'GitHub OAuth and Vercel Personal Access Tokens remain AES-256-GCM encrypted on the server and are never exposed to clients.',
          )}
        />
        <GuaranteeCard
          icon={<Webhook className="w-4 h-4 text-cyan-400" />}
          title={L('Autentikasi Webhook Kriptografis', 'Cryptographic Webhook Auth')}
          tone="text-cyan-300"
          desc={L(
            'Setiap event push atau pull_request GitHub yang masuk melewati verifikasi HMAC-SHA256 timing-safe sebelum menyentuh status tugas.',
            'Every inbound GitHub push or pull_request event passes timing-safe HMAC-SHA256 verification before mutating task states.',
          )}
        />
        <GuaranteeCard
          icon={<FolderGit2 className="w-4 h-4 text-amber-400" />}
          title={L('Kode 100% Milik Anda (Zero Lock-In)', 'Zero Source Lock-In')}
          tone="text-amber-300"
          desc={L(
            'Repositori tetap tinggal sepenuhnya di akun GitHub Anda. Putuskan integrasi kapan saja tanpa mengubah struktur kode atau riwayat Git.',
            'Repositories stay 100% in your GitHub account. Disconnect anytime without altering your codebase structure or Git history.',
          )}
        />
        <GuaranteeCard
          icon={<Radio className="w-4 h-4 text-violet-400" />}
          title={L('Video P2P Efemeral (Nol Rekaman)', 'Ephemeral P2P Video')}
          tone="text-violet-300"
          desc={L(
            'Siaran layar IDE mengalir langsung antar browser melalui koneksi WebRTC terenkripsi tanpa rekaman atau penyimpanan media di server.',
            'IDE screen feeds stream directly browser-to-browser over encrypted WebRTC peer channels with zero recording or server storage.',
          )}
        />
        <GuaranteeCard
          icon={<Lock className="w-4 h-4 text-indigo-400" />}
          title={L('CSRF OAuth & RBAC Per Proyek', 'OAuth CSRF & Per-Project RBAC')}
          tone="text-indigo-300"
          desc={L(
            'Setiap alur Masuk, Daftar, dan Tautkan Vault dilindungi cookie HTTP-only terisolasi serta batas izin Maintainer vs Kontributor per proyek.',
            'Sign In, Sign Up, and Vault linking bind isolated HTTP-only CSRF cookies alongside strict per-project Maintainer vs Contributor RBAC.',
          )}
        />
        <GuaranteeCard
          icon={<FileCode2 className="w-4 h-4 text-sky-400" />}
          title={L('Siap Open-Source & Self-Host', 'Open-Source & Self-Host Ready')}
          tone="text-sky-300"
          desc={L(
            'Dibangun dengan protokol web terbuka dan penyimpanan portabel (PostgreSQL cloud maupun mode lokal) agar mudah diaudit & di-host mandiri.',
            'Built on open web protocols with portable persistence (managed PostgreSQL or standalone local mode) for effortless auditing & self-hosting.',
          )}
        />
      </div>

      {/* Technical FAQ Accordion */}
      <div className="space-y-4">
        <div className="space-y-1">
          <div className="text-xs font-mono uppercase tracking-widest text-zinc-400">
            {L('FAQ Teknis', 'Technical FAQ')}
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">
            {L('Pertanyaan teknis yang sering diajukan', 'Frequently asked engineering questions')}
          </h2>
        </div>

        <div className="cp-panel rounded-2xl divide-y divide-white/[0.06] overflow-hidden">
          {ARCH_FAQS.map((item, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div key={item.key}>
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full px-6 py-4 flex items-center justify-between gap-4 text-left hover:bg-white/[0.02] transition cursor-pointer"
                >
                  <span className="text-xs sm:text-sm font-semibold text-white">
                    {L(item.q.id, item.q.en)}
                  </span>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-indigo-300 shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-zinc-500 shrink-0" />
                  )}
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 pb-5 text-xs sm:text-sm text-zinc-400 leading-relaxed">
                        {L(item.a.id, item.a.en)}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>

      <InnerPageCtaBanner
        eyebrow={L('Siap Meluncur', 'Ready to Ship')}
        title={L(
          'Luncurkan workspace CodePulse terlindungi pertama Anda dalam kurang dari semenit.',
          'Launch your first protected CodePulse workspace in under a minute.',
        )}
        subtitle={L(
          'Daftar dengan GitHub atau Email untuk mengikuti onboarding 2 langkah terpandu, menghubungkan repository, dan langsung deploy ke Vercel.',
          'Sign up with GitHub or Email to walk through guided 2-step workspace onboarding, connect a repo, and deploy straight to Vercel.',
        )}
        nextPage="capabilities"
        nextLabel={L('Tinjau Fitur', 'Review Capabilities')}
        onNavigatePage={onNavigatePage}
        onOpenAuth={onOpenAuth}
      />
    </section>
  );
}

function GuaranteeCard({
  icon,
  title,
  tone,
  desc,
}: {
  icon: ReactNode;
  title: string;
  tone: string;
  desc: string;
}) {
  return (
    <div className="cp-panel rounded-2xl p-5 space-y-2 hover:border-white/20 transition-colors">
      <div className={`inline-flex items-center gap-2 text-xs font-semibold ${tone}`}>
        {icon}
        <span>{title}</span>
      </div>
      <p className="text-xs text-zinc-400 leading-relaxed">{desc}</p>
    </div>
  );
}
