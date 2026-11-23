import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ClipboardPaste,
  Clock,
  Copy,
  GitBranch,
  Inbox,
  Link2,
  Mail,
  RefreshCw,
  Send,
  Shield,
  Ticket,
  Users,
  XCircle,
} from 'lucide-react';
import { isWorkspaceLeader } from '../../shared/permissions.ts';
import type {
  PublicUser,
  UserRole,
  Workspace,
  WorkspaceInvitation,
} from '../../shared/types.ts';
import { api, buildInviteUrl } from '../lib/api.ts';
import { useLanguage } from '../lib/i18nContext.ts';
import { InvitationsListSkeleton } from './LoadingUI.tsx';

type InviteTab = 'inbox' | 'join' | 'send' | 'sent';
type SentFilter = 'all' | 'pending' | 'accepted' | 'closed';

interface InvitationsViewProps {
  currentUser: PublicUser;
  workspaces: Workspace[];
  incoming: WorkspaceInvitation[];
  sent: WorkspaceInvitation[];
  initialInviteCode?: string;
  onRefreshInvitations: () => Promise<void>;
  onWorkspaceJoined: (ws: Workspace) => Promise<void>;
  onToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export function InvitationsView({
  currentUser,
  workspaces,
  incoming,
  sent,
  initialInviteCode = '',
  onRefreshInvitations,
  onWorkspaceJoined,
  onToast,
}: InvitationsViewProps) {
  const { L, locale } = useLanguage();
  const leadWorkspaces = workspaces.filter((ws) => isWorkspaceLeader(ws, currentUser));

  const [activeTab, setActiveTab] = useState<InviteTab>(() =>
    initialInviteCode.trim() ? 'join' : 'inbox',
  );
  const [sentFilter, setSentFilter] = useState<SentFilter>('all');

  const [joinInput, setJoinInput] = useState(initialInviteCode);
  const [joining, setJoining] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [sendWorkspaceId, setSendWorkspaceId] = useState(leadWorkspaces[0]?.id || '');
  const [sendTarget, setSendTarget] = useState('');
  const [sendRole, setSendRole] = useState<UserRole>('member');
  const [sendMessage, setSendMessage] = useState('');
  const [sendingInvite, setSendingInvite] = useState(false);
  const [lastCreatedInvite, setLastCreatedInvite] = useState<WorkspaceInvitation | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const effectiveSendWorkspaceId =
    leadWorkspaces.some((w) => w.id === sendWorkspaceId)
      ? sendWorkspaceId
      : leadWorkspaces[0]?.id || '';

  const pendingSentCount = sent.filter((i) => i.status === 'pending').length;
  const filteredSent = sent.filter((inv) => {
    if (sentFilter === 'all') return true;
    if (sentFilter === 'pending') return inv.status === 'pending';
    if (sentFilter === 'accepted') return inv.status === 'accepted';
    return inv.status === 'declined' || inv.status === 'revoked';
  });

  function formatInviteStatus(status: WorkspaceInvitation['status']) {
    if (status === 'pending') return L('Tertunda', 'Pending');
    if (status === 'accepted') return L('Diterima', 'Accepted');
    if (status === 'declined') return L('Ditolak', 'Declined');
    if (status === 'revoked') return L('Dicabut', 'Revoked');
    return status;
  }

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

  async function handleRevoke(invId: string) {
    setRespondingId(invId);
    try {
      await api.revokeInvitation(invId);
      await onRefreshInvitations();
      onToast('info', L('Undangan dicabut.', 'Invitation revoked.'));
    } catch (err) {
      onToast(
        'error',
        err instanceof Error
          ? err.message
          : L('Gagal mencabut undangan', 'Failed to revoke invitation'),
      );
    } finally {
      setRespondingId(null);
    }
  }

  async function handleSendInvite(openLinkOnly: boolean) {
    if (!effectiveSendWorkspaceId) {
      onToast(
        'error',
        L(
          'Buat proyek terlebih dahulu untuk mengirim undangan.',
          'Create a project first to send invitations.',
        ),
      );
      return;
    }
    if (!openLinkOnly && !sendTarget.trim()) {
      onToast(
        'error',
        L(
          'Masukkan @username atau email, atau klik Buat Tautan.',
          'Enter a @username or email, or click Generate Link.',
        ),
      );
      return;
    }

    setSendingInvite(true);
    try {
      const { invitation } = await api.sendWorkspaceInvitation(effectiveSendWorkspaceId, {
        target: openLinkOnly ? undefined : sendTarget.trim(),
        role: sendRole,
        message: sendMessage.trim(),
      });
      setLastCreatedInvite(invitation);
      await onRefreshInvitations();
      if (openLinkOnly) {
        copyText(
          invitation.id,
          buildInviteUrl(invitation.inviteCode),
          L('Tautan undangan', 'Shareable invite link'),
        );
      } else {
        setSendTarget('');
        setSendMessage('');
        const targetLabel = invitation.inviteeUsername
          ? `@${invitation.inviteeUsername}`
          : invitation.inviteeEmail;
        onToast(
          'success',
          L(
            `Undangan terkirim ke ${targetLabel} (${invitation.inviteCode}).`,
            `Invitation sent to ${targetLabel} (${invitation.inviteCode}).`,
          ),
        );
      }
    } catch (err) {
      onToast(
        'error',
        err instanceof Error
          ? err.message
          : L('Gagal mengirim undangan', 'Failed to send invitation'),
      );
    } finally {
      setSendingInvite(false);
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
    {
      id: 'send',
      label: L('Kirim Undangan', 'Send Invite'),
      icon: <Send className="w-4 h-4" />,
    },
    {
      id: 'sent',
      label: L('Riwayat Terkirim', 'Sent History'),
      icon: <Clock className="w-4 h-4" />,
      badge: sent.length,
      badgeTone:
        pendingSentCount > 0
          ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
          : 'bg-white/[0.05] text-zinc-400 border-white/10',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {L('Undangan & Akses Tim', 'Invitations & Team Access')}
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            {L(
              'Kelola undangan masuk, bergabung dengan kode proyek, atau undang rekan tim secara terpisah dan rapi.',
              'Manage incoming invites, join via project code, or send team invitations in clean dedicated views.',
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
                  <button
                    type="button"
                    onClick={() => setActiveTab('send')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-200 text-xs font-medium transition cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{L('Undang Rekan Tim', 'Invite Teammates')}</span>
                  </button>
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
                  className="p-4 rounded-xl bg-zinc-950/75 border border-white/[0.07] space-y-1.5"
                >
                  <span className="font-mono text-[10px] text-cyan-300">{item.step}</span>
                  <div className="text-xs font-semibold text-white">{item.title}</div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* TAB 3: SEND INVITE COMPOSER */}
        {activeTab === 'send' && (
          <motion.div
            key="tab-send"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16 }}
            className="cp-panel rounded-2xl p-6 sm:p-8 space-y-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/[0.07]">
              <div>
                <h2 className="text-base sm:text-lg font-semibold text-white">
                  {L('Undang Rekan Tim ke Proyek', 'Invite Teammates to a Project')}
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {L(
                    'Kirim undangan langsung ke akun tertentu atau buat tautan berbagi untuk grup/komunitas.',
                    'Send a direct invite to a specific user or generate a shareable invite link for your team.',
                  )}
                </p>
              </div>
              {sent.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab('sent')}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-300 hover:text-indigo-200 transition cursor-pointer whitespace-nowrap"
                >
                  <span>
                    {L(`Lihat ${sent.length} Riwayat Terkirim`, `View ${sent.length} Sent History`)}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {leadWorkspaces.length === 0 ? (
              <div className="p-8 rounded-xl bg-zinc-950/75 border border-dashed border-white/10 text-center space-y-2">
                <Users className="w-6 h-6 text-zinc-500 mx-auto" />
                <div className="text-sm font-medium text-zinc-300">
                  {L('Belum ada proyek yang Anda pimpin', 'No projects where you are Project Lead')}
                </div>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                  {L(
                    'Buat atau pimpin workspace proyek terlebih dahulu untuk mengirim undangan tim.',
                    'Create or lead a project workspace first to send team invitations.',
                  )}
                </p>
              </div>
            ) : (
              <div className="max-w-3xl space-y-5">
                {/* Workspace selector */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                      {L('Pilih Workspace Proyek', 'Select Project Workspace')}
                    </label>
                    <select
                      value={effectiveSendWorkspaceId}
                      onChange={(e) => setSendWorkspaceId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-white/12 text-xs text-white focus:outline-none focus:border-indigo-500"
                    >
                      {leadWorkspaces.map((ws) => (
                        <option key={ws.id} value={ws.id}>
                          {ws.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                      {L('@username atau Email Rekan Tim', 'Teammate @username or Email')}
                    </label>
                    <input
                      type="text"
                      value={sendTarget}
                      onChange={(e) => setSendTarget(e.target.value)}
                      placeholder={L(
                        '@handle-github atau rekan@email.com',
                        '@github-handle or teammate@email.com',
                      )}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-white/12 text-xs font-mono text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* Role selector cards */}
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-zinc-300">
                    {L('Peran yang Diberikan', 'Assigned Role')}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setSendRole('member')}
                      className={`p-3.5 rounded-xl border text-left transition cursor-pointer ${
                        sendRole === 'member'
                          ? 'bg-cyan-500/10 border-cyan-500/40'
                          : 'bg-zinc-950/75 border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-cyan-400" />
                          <span>{L('Kontributor (Anggota)', 'Contributor (Member)')}</span>
                        </span>
                        {sendRole === 'member' && (
                          <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-1">
                        {L(
                          'Mengelola kartu Kanban, push branch fitur #CP-XX, dan siar Live IDE.',
                          'Manage Kanban cards, push #CP-XX feature branches, and stream Live IDE.',
                        )}
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSendRole('leader')}
                      className={`p-3.5 rounded-xl border text-left transition cursor-pointer ${
                        sendRole === 'leader'
                          ? 'bg-indigo-500/12 border-indigo-500/45'
                          : 'bg-zinc-950/75 border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                          <Shield className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Project Lead</span>
                        </span>
                        {sendRole === 'leader' && (
                          <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-1">
                        {L(
                          'Akses penuh: Gatekeeper merge ke main, deploy Vercel, dan kelola anggota.',
                          'Full access: Gatekeeper merge to main, Vercel deploys, and member governance.',
                        )}
                      </p>
                    </button>
                  </div>
                </div>

                {/* Optional note */}
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    {L('Catatan Sambutan (Opsional)', 'Welcome Note (Optional)')}
                  </label>
                  <input
                    type="text"
                    value={sendMessage}
                    onChange={(e) => setSendMessage(e.target.value)}
                    placeholder={L(
                      'Mis. Halo, silakan gabung untuk mengerjakan modul autentikasi!',
                      'e.g. Hey, join us to work on the authentication module!',
                    )}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-white/12 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    disabled={sendingInvite || !sendTarget.trim()}
                    onClick={() => void handleSendInvite(false)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg transition cursor-pointer disabled:opacity-45"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>
                      {sendingInvite
                        ? L('Mengirim...', 'Sending...')
                        : L('Kirim Undangan Langsung', 'Send Direct Invitation')}
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={sendingInvite}
                    onClick={() => void handleSendInvite(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/12 text-zinc-100 text-xs font-medium transition cursor-pointer disabled:opacity-45"
                  >
                    <Link2 className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{L('Buat Tautan Berbagi', 'Generate Shareable Link')}</span>
                  </button>
                </div>

                {/* Instant created confirmation banner */}
                {lastCreatedInvite && (
                  <div className="p-4 rounded-xl bg-emerald-500/[0.08] border border-emerald-500/25 flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-0.5 min-w-0">
                      <div className="text-xs font-semibold text-emerald-200 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>
                          {L('Undangan siap dibagikan!', 'Invitation ready to share!')}
                        </span>
                      </div>
                      <div className="font-mono text-[11px] text-zinc-300 truncate">
                        {lastCreatedInvite.workspaceName} •{' '}
                        <span className="text-cyan-300">{lastCreatedInvite.inviteCode}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          copyText(
                            `banner-${lastCreatedInvite.id}`,
                            buildInviteUrl(lastCreatedInvite.inviteCode),
                            L('Tautan undangan', 'Invite link'),
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-[11px] font-medium text-white cursor-pointer"
                      >
                        {copiedId === `banner-${lastCreatedInvite.id}` ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3 text-cyan-400" />
                        )}
                        <span>{L('Salin Tautan', 'Copy Link')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('sent')}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 text-[11px] font-semibold cursor-pointer"
                      >
                        {L('Lihat Riwayat', 'View History')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* TAB 4: SENT INVITATIONS HISTORY */}
        {activeTab === 'sent' && (
          <motion.div
            key="tab-sent"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16 }}
            className="cp-panel rounded-2xl p-6 sm:p-7 space-y-5"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/[0.07]">
              <div>
                <h2 className="text-base font-semibold text-white">
                  {L('Riwayat Undangan Terkirim', 'Sent Invitations History')}
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {L(
                    'Pantau status undangan, salin ulang tautan, atau cabut undangan yang masih tertunda.',
                    'Track invite status, copy links again, or revoke pending invitations.',
                  )}
                </p>
              </div>

              {/* Filter pills */}
              <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-zinc-950/90 border border-white/10 self-start sm:self-auto">
                {(
                  [
                    { id: 'all', label: L('Semua', 'All') },
                    { id: 'pending', label: L('Tertunda', 'Pending') },
                    { id: 'accepted', label: L('Diterima', 'Accepted') },
                    { id: 'closed', label: L('Ditutup', 'Closed') },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setSentFilter(f.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition cursor-pointer whitespace-nowrap ${
                      sentFilter === f.id
                        ? 'bg-indigo-600 text-white'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {refreshing ? (
              <InvitationsListSkeleton count={3} />
            ) : filteredSent.length === 0 ? (
              <div className="py-12 px-6 rounded-xl bg-zinc-950/60 border border-dashed border-white/10 text-center space-y-3">
                <Clock className="w-6 h-6 text-zinc-600 mx-auto" />
                <div className="text-sm font-medium text-zinc-300">
                  {sent.length === 0
                    ? L('Belum ada undangan terkirim', 'No sent invitations yet')
                    : L('Tidak ada undangan pada filter ini', 'No invitations match this filter')}
                </div>
                {sent.length === 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('send')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{L('Kirim Undangan Pertama', 'Send First Invitation')}</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-white/[0.06] rounded-xl bg-zinc-950/80 border border-white/8 overflow-hidden">
                {filteredSent.map((inv) => {
                  const isOpenLink = !inv.inviteeUsername && !inv.inviteeEmail;
                  return (
                    <div
                      key={inv.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-white/[0.02] transition"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-semibold text-white">{inv.workspaceName}</span>
                          <span className="text-zinc-600">→</span>
                          <span className="font-mono text-zinc-200">
                            {isOpenLink
                              ? L('Tautan Berbagi Terbuka', 'Open Shareable Link')
                              : inv.inviteeUsername
                                ? `@${inv.inviteeUsername}`
                                : inv.inviteeEmail}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
                          <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-300">
                            {inv.inviteCode}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 uppercase text-[10px]">
                            {inv.role === 'leader' ? 'Project Lead' : L('Kontributor', 'Contributor')}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded border uppercase text-[10px] whitespace-nowrap ${
                              inv.status === 'pending'
                                ? 'bg-amber-500/10 border-amber-500/25 text-amber-300'
                                : inv.status === 'accepted'
                                  ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
                                  : 'bg-zinc-800/80 border-white/10 text-zinc-400'
                            }`}
                          >
                            {formatInviteStatus(inv.status)}
                          </span>
                          <span className="text-zinc-500 text-[10px]">
                            {new Date(inv.createdAt).toLocaleDateString(
                              locale === 'id' ? 'id-ID' : 'en-US',
                            )}
                          </span>
                        </div>
                      </div>

                      {inv.status === 'pending' && (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              copyText(
                                `code-${inv.id}`,
                                inv.inviteCode,
                                L('Kode undangan', 'Invite code'),
                              )
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-[11px] font-mono text-zinc-300 cursor-pointer whitespace-nowrap"
                          >
                            {copiedId === `code-${inv.id}` ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3 text-zinc-400" />
                            )}
                            <span>{L('Kode', 'Code')}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              copyText(
                                inv.id,
                                buildInviteUrl(inv.inviteCode),
                                L('Tautan undangan', 'Invite link'),
                              )
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[11px] font-medium text-zinc-100 cursor-pointer whitespace-nowrap"
                          >
                            {copiedId === inv.id ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Link2 className="w-3 h-3 text-cyan-400" />
                            )}
                            <span>{L('Salin Tautan', 'Copy Link')}</span>
                          </button>
                          <button
                            type="button"
                            disabled={respondingId === inv.id}
                            onClick={() => void handleRevoke(inv.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-zinc-400 hover:text-rose-300 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/25 text-[11px] transition cursor-pointer disabled:opacity-50 whitespace-nowrap"
                            title={L('Cabut undangan', 'Revoke invitation')}
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">{L('Cabut', 'Revoke')}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
