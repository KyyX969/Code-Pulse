import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ClipboardPaste,
  Copy,
  GitBranch,
  Inbox,
  Mail,
  RefreshCw,
  Ticket,
  Users,
  XCircle,
} from 'lucide-react';
import type { PublicUser, Workspace, WorkspaceInvitation } from '../../shared/types.ts';
import { api } from '../lib/api.ts';
import { useLanguage } from '../lib/i18nContext.ts';
import { InvitationsListSkeleton } from './LoadingUI.tsx';

type InviteTab = 'inbox' | 'join';

interface InvitationsViewProps {
  currentUser: PublicUser;
  incoming: WorkspaceInvitation[];
  initialInviteCode?: string;
  onRefreshInvitations: () => Promise<void>;
  onWorkspaceJoined: (ws: Workspace) => Promise<void>;
  onOpenProjectTeam?: () => void;
  onToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export function InvitationsView({
  currentUser,
  incoming,
  initialInviteCode = '',
  onRefreshInvitations,
  onWorkspaceJoined,
  onOpenProjectTeam,
  onToast,
}: InvitationsViewProps) {
  const { L, locale } = useLanguage();

  const [activeTab, setActiveTab] = useState<InviteTab>(() =>
    initialInviteCode.trim() ? 'join' : 'inbox',
  );
  const [joinInput, setJoinInput] = useState(initialInviteCode);
  const [joining, setJoining] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function copyText(key: string, value: string, label: string) {
    void navigator.clipboard.writeText(value);
    setCopiedId(key);
    onToast('info', L(`${label} disalin ke papan klip.`, `${label} copied to clipboard.`));
    setTimeout(() => setCopiedId(null), 1800);
  }

  async function handlePasteClipboard() {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (!text) {
        onToast('info', L('Papan klip kosong.', 'Clipboard is empty.'));
        return;
      }
      setJoinInput(text);
    } catch {
      onToast(
        'error',
        L(
          'Browser memblokir akses papan klip. Silakan tempel manual (Ctrl+V).',
          'Browser blocked clipboard read. Please paste manually (Ctrl+V).',
        ),
      );
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await onRefreshInvitations();
    } finally {
      setRefreshing(false);
    }
  }

  async function handleJoinByCode(e: React.FormEvent) {
    e.preventDefault();
    if (!joinInput.trim()) return;
    setJoining(true);
    try {
      const { workspace } = await api.joinWithInviteCode(joinInput.trim());
      setJoinInput('');
      await onRefreshInvitations();
      onToast(
        'success',
        L(`Bergabung ke proyek "${workspace.name}"!`, `Joined project "${workspace.name}"!`),
      );
      await onWorkspaceJoined(workspace);
    } catch (err) {
      onToast(
        'error',
        err instanceof Error
          ? err.message
          : L(
              'Tidak dapat bergabung dengan kode undangan tersebut',
              'Unable to join with that invite code',
            ),
      );
    } finally {
      setJoining(false);
    }
  }

  async function handleAccept(inv: WorkspaceInvitation) {
    setRespondingId(inv.id);
    try {
      const { workspace } = await api.acceptInvitation(inv.id);
      await onRefreshInvitations();
      onToast(
        'success',
        L(
          `Undangan ke "${workspace.name}" diterima!`,
          `Accepted invitation to "${workspace.name}"!`,
        ),
      );
      await onWorkspaceJoined(workspace);
    } catch (err) {
      onToast(
        'error',
        err instanceof Error
          ? err.message
          : L('Gagal menerima undangan', 'Failed to accept invitation'),
      );
    } finally {
      setRespondingId(null);
    }
  }

  async function handleDecline(inv: WorkspaceInvitation) {
    setRespondingId(inv.id);
    try {
      await api.declineInvitation(inv.id);
      await onRefreshInvitations();
      onToast(
        'info',
        L(
          `Undangan ke "${inv.workspaceName}" ditolak.`,
          `Declined invitation to "${inv.workspaceName}".`,
        ),
      );
    } catch (err) {
      onToast(
        'error',
        err instanceof Error
          ? err.message
          : L('Gagal menolak undangan', 'Failed to decline invitation'),
      );
    } finally {
      setRespondingId(null);
    }
  }

  const tabs: Array<{
    id: InviteTab;
    label: string;
    icon: React.ReactNode;
    badge?: number;
    badgeTone?: string;
  }> = [
    {
      id: 'inbox',
      label: L('Kotak Masuk', 'Inbox'),
      icon: <Inbox className="w-4 h-4" />,
      badge: incoming.length,
      badgeTone:
        incoming.length > 0
          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
          : 'bg-white/[0.05] text-zinc-400 border-white/10',
    },
    {
      id: 'join',
      label: L('Gabung via Kode', 'Join via Code'),
      icon: <Ticket className="w-4 h-4" />,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {L('Undangan Masuk & Gabung Proyek', 'Incoming Invitations & Join Project')}
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            {L(
              'Terima undangan masuk atau bergabung ke proyek rekan lewat kode. Pengiriman undangan & manajemen anggota kini berada di menu Kelola pada tiap proyek.',
              'Accept incoming invites or join a teammate’s project by code. Sending invitations & member management now live inside each project’s Manage view.',
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() =>
              copyText('my-handle', `@${currentUser.username}`, L('Handle Anda', 'Your handle'))
            }
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-xs font-mono text-zinc-300 transition cursor-pointer whitespace-nowrap"
            title={L(
              'Salin handle Anda agar rekan tim bisa mengundang Anda',
              'Copy your handle so teammates can invite you',
            )}
          >
            {copiedId === 'my-handle' ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-zinc-400" />
            )}
            <span>@{currentUser.username}</span>
          </button>
          <button
            type="button"
            disabled={refreshing}
            onClick={() => void handleRefresh()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-xs font-medium text-zinc-200 transition cursor-pointer disabled:opacity-50 whitespace-nowrap"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{refreshing ? L('Menyinkronkan...', 'Syncing...') : L('Segarkan', 'Refresh')}</span>
          </button>
        </div>
      </div>

      {/* Horizontal Underline Navigation Rail */}
      <div className="border-b border-white/[0.08]">
        <nav
          aria-label={L('Navigasi Undangan', 'Invitations Navigation')}
          className="flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar -mb-px"
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`relative inline-flex items-center gap-2 px-3.5 sm:px-4 py-3 text-xs sm:text-sm font-medium whitespace-nowrap transition cursor-pointer ${
                  isActive ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <span className={isActive ? 'text-indigo-400' : 'text-zinc-500'}>{tab.icon}</span>
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span
                    className={`font-mono text-[10px] px-1.5 py-0.5 rounded-md border whitespace-nowrap ${tab.badgeTone}`}
                  >
                    {tab.badge}
                  </span>
                )}
                {isActive && (
                  <motion.span
                    layoutId="invitations-active-line"
                    transition={{ type: 'spring', stiffness: 460, damping: 36 }}
                    className="absolute left-0 right-0 bottom-0 h-[2px] rounded-full bg-gradient-to-r from-indigo-400 via-cyan-400 to-indigo-400"
                  />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Dedicated Full-Width Tab Content */}
      <AnimatePresence mode="wait" initial={false}>
        {/* TAB 1: INBOX */}
        {activeTab === 'inbox' && (
          <motion.div
            key="tab-inbox"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16 }}
            className="cp-panel rounded-2xl p-6 sm:p-7 space-y-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/[0.07]">
              <div>
                <h2 className="text-base font-semibold text-white">
                  {L('Undangan Diterima', 'Received Invitations')}
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {locale === 'id' ? (
                    <>
                      Undangan proyek yang ditujukan ke <code>@{currentUser.username}</code>
                      {currentUser.email ? ` atau ${currentUser.email}` : ''}.
                    </>
                  ) : (
                    <>
                      Project invitations addressed to <code>@{currentUser.username}</code>
                      {currentUser.email ? ` or ${currentUser.email}` : ''}.
                    </>
                  )}
                </p>
              </div>
              <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-emerald-500/12 border border-emerald-500/25 text-emerald-300 whitespace-nowrap shrink-0">
                {L(`${incoming.length} tertunda`, `${incoming.length} pending`)}
              </span>
            </div>

            {refreshing ? (
              <InvitationsListSkeleton count={2} />
            ) : incoming.length === 0 ? (
              <div className="py-12 px-6 rounded-xl bg-zinc-950/75 border border-dashed border-white/10 text-center space-y-4">
                <div className="w-11 h-11 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center mx-auto">
                  <Mail className="w-5 h-5 text-zinc-500" />
                </div>
                <div className="space-y-1.5">
                  <div className="text-sm font-semibold text-zinc-200">
                    {L('Kotak masuk undangan masih kosong', 'Your invitation inbox is empty')}
                  </div>
                  <p className="text-xs text-zinc-500 max-w-md mx-auto leading-relaxed">
                    {locale === 'id' ? (
                      <>
                        Saat Project Lead mengundang <code>@{currentUser.username}</code>, undangan
                        akan muncul langsung di sini. Punya kode undangan dari rekan tim?
                      </>
                    ) : (
                      <>
                        When a Project Lead invites <code>@{currentUser.username}</code>, it will
                        appear right here. Already have an invite code from a teammate?
                      </>
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab('join')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-semibold transition cursor-pointer"
                  >
                    <Ticket className="w-3.5 h-3.5" />
                    <span>{L('Gabung via Kode', 'Join via Code')}</span>
                  </button>
                  {onOpenProjectTeam && (
                    <button
                      type="button"
                      onClick={onOpenProjectTeam}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-200 text-xs font-medium transition cursor-pointer"
                    >
                      <Users className="w-3.5 h-3.5 text-indigo-400" />
                      <span>{L('Kelola Tim di Proyek', 'Manage Team in Project')}</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {incoming.map((inv) => (
                  <div
                    key={inv.id}
                    className="p-5 rounded-xl bg-zinc-950/90 border border-emerald-500/25 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                  >
                    <div className="space-y-2 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-semibold text-white">
                          {inv.workspaceName}
                        </span>
                        <span
                          className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border whitespace-nowrap ${
                            inv.role === 'leader'
                              ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300'
                              : 'bg-cyan-500/12 border-cyan-500/25 text-cyan-300'
                          }`}
                        >
                          {inv.role === 'leader' ? 'Project Lead' : L('Kontributor', 'Contributor')}
                        </span>
                        {inv.workspaceRepo && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded">
                            <GitBranch className="w-3 h-3" />
                            <span>{inv.workspaceRepo}</span>
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
                        <span className="inline-flex items-center gap-2">
                          <img
                            src={inv.inviterAvatarUrl}
                            alt={inv.inviterUsername}
                            className="w-5 h-5 rounded-full ring-1 ring-white/15"
                          />
                          <span>
                            {L('Diundang oleh', 'Invited by')}{' '}
                            <strong className="text-zinc-200">@{inv.inviterUsername}</strong>
                          </span>
                        </span>
                        <span className="text-zinc-600">•</span>
                        <span className="font-mono text-[11px] text-zinc-500">
                          {new Date(inv.createdAt).toLocaleDateString(
                            locale === 'id' ? 'id-ID' : 'en-US',
                          )}
                        </span>
                      </div>

                      {inv.message && (
                        <p className="text-xs text-zinc-300 bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 max-w-2xl">
                          &ldquo;{inv.message}&rdquo;
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={respondingId === inv.id}
                        onClick={() => void handleAccept(inv)}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-semibold transition cursor-pointer disabled:opacity-50 whitespace-nowrap"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>
                          {respondingId === inv.id
                            ? L('Bergabung...', 'Joining...')
                            : L('Terima & Buka Proyek', 'Accept & Open Project')}
                        </span>
                      </button>
                      <button
                        type="button"
                        disabled={respondingId === inv.id}
                        onClick={() => void handleDecline(inv)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-zinc-900 hover:bg-rose-500/15 border border-white/10 hover:border-rose-500/30 text-zinc-300 hover:text-rose-200 text-xs font-medium transition cursor-pointer disabled:opacity-50 whitespace-nowrap"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>{L('Tolak', 'Decline')}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* TAB 2: JOIN VIA CODE OR LINK */}
        {activeTab === 'join' && (
          <motion.div
            key="tab-join"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16 }}
            className="cp-panel rounded-2xl p-6 sm:p-8 space-y-6 border-indigo-500/20"
          >
            <div className="max-w-2xl space-y-1.5">
              <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-cyan-300">
                <Ticket className="w-3.5 h-3.5" />
                <span>{L('Akses Cepat Proyek', 'Instant Project Access')}</span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-white">
                {L(
                  'Gabung Proyek dengan Kode atau Tautan Undangan',
                  'Join a Project with an Invite Code or Link',
                )}
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                {locale === 'id' ? (
                  <>
                    Tempel kode undangan seperti <code className="text-cyan-300">CP-A8F3K9</code>{' '}
                    atau URL undangan CodePulse lengkap yang dibagikan Project Lead Anda.
                  </>
                ) : (
                  <>
                    Paste an invite code like <code className="text-cyan-300">CP-A8F3K9</code> or a
                    full CodePulse invite URL shared by your Project Lead.
                  </>
                )}
              </p>
            </div>

            <form onSubmit={handleJoinByCode} className="max-w-2xl space-y-3">
              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={joinInput}
                    onChange={(e) => setJoinInput(e.target.value)}
                    placeholder={L(
                      'Tempel kode (mis. CP-7K4M9Q) atau tautan undangan...',
                      'Paste code (e.g. CP-7K4M9Q) or invite link...',
                    )}
                    className="w-full pl-4 pr-24 py-3 rounded-xl bg-zinc-950 border border-white/12 text-xs sm:text-sm font-mono text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => void handlePasteClipboard()}
                    className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-[11px] font-medium text-zinc-300 transition cursor-pointer"
                  >
                    <ClipboardPaste className="w-3 h-3 text-cyan-400" />
                    <span>{L('Tempel', 'Paste')}</span>
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={joining || !joinInput.trim()}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-semibold shadow-lg transition cursor-pointer disabled:opacity-45 shrink-0 whitespace-nowrap"
                >
                  <span>
                    {joining ? L('Bergabung...', 'Joining...') : L('Gabung Proyek', 'Join Project')}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>

            {/* Helpful 3-step visual guide */}
            <div className="pt-4 border-t border-white/[0.07] grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {[
                {
                  step: '01',
                  title: L('Tempel Kode atau URL', 'Paste Code or URL'),
                  desc: L(
                    'Mendukung kode singkat CP-XXXXXX maupun tautan penuh https://.../?invite=...',
                    'Accepts both short CP-XXXXXX codes and full https://.../?invite=... URLs.',
                  ),
                },
                {
                  step: '02',
                  title: L('Otorisasi Peran Otomatis', 'Automatic Role Binding'),
                  desc: L(
                    'Sistem langsung menetapkan peran Kontributor atau Project Lead sesuai undangan.',
                    'Automatically binds your Contributor or Project Lead role as configured.',
                  ),
                },
                {
                  step: '03',
                  title: L('Langsung Masuk Papan', 'Instant Board Access'),
                  desc: L(
                    'Anda langsung diarahkan ke Papan Kanban proyek dan bisa mulai berkolaborasi.',
                    'Redirects straight into the project Kanban board so you can start shipping.',
                  ),
                },
              ].map((item) => (
                <div
                  key={item.step}
                  className="p-4 rounded-xl bg-zinc-950/75 border border-white/[0.06] space-y-1.5"
                >
                  <div className="text-[10px] font-mono text-indigo-400">{item.step}</div>
                  <div className="text-xs font-semibold text-zinc-200">{item.title}</div>
                  <p className="text-[11px] text-zinc-500 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
