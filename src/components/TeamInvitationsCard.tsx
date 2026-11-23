import { useEffect, useState } from 'react';
import {
  Check,
  Copy,
  Link2,
  Mail,
  Send,
  Shield,
  Trash2,
  UserPlus,
  Users,
  XCircle,
} from 'lucide-react';
import { isWorkspaceLeader } from '../../shared/permissions.ts';
import type { PublicUser, UserRole, Workspace, WorkspaceInvitation } from '../../shared/types.ts';
import { api, buildInviteUrl } from '../lib/api.ts';
import { useLanguage } from '../lib/i18nContext.ts';
import { InvitationsListSkeleton } from './LoadingUI.tsx';

type InviteFilter = 'all' | 'pending' | 'accepted' | 'closed';

interface TeamInvitationsCardProps {
  workspace: Workspace;
  currentUser: PublicUser;
  onWorkspaceUpdated: (ws: Workspace) => void;
  onInvitationsChanged?: () => void;
  onToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export function TeamInvitationsCard({
  workspace,
  currentUser,
  onWorkspaceUpdated,
  onInvitationsChanged,
  onToast,
}: TeamInvitationsCardProps) {
  const { L } = useLanguage();
  const isLeader = isWorkspaceLeader(workspace, currentUser);

  const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([]);
  const [loadedWorkspaceId, setLoadedWorkspaceId] = useState<string | null>(null);
  const [inviteFilter, setInviteFilter] = useState<InviteFilter>('all');
  const [target, setTarget] = useState('');
  const [role, setRole] = useState<UserRole>('member');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadingInvitations = loadedWorkspaceId !== workspace.id;

  useEffect(() => {
    let cancelled = false;
    api
      .listWorkspaceInvitations(workspace.id)
      .then((res) => {
        if (!cancelled) setInvitations(res.invitations);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadedWorkspaceId(workspace.id);
      });
    return () => {
      cancelled = true;
    };
  }, [workspace.id]);

  function copyValue(key: string, text: string, label: string) {
    void navigator.clipboard.writeText(text);
    setCopiedId(key);
    onToast('info', L(`${label} disalin ke clipboard.`, `${label} copied to clipboard.`));
    setTimeout(() => setCopiedId(null), 1800);
  }

  async function handleSendDirectInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!isLeader) {
      onToast(
        'error',
        L(
          'Hanya Ketua Proyek yang dapat mengundang anggota tim.',
          'Only Project Leader can invite team members.',
        ),
      );
      return;
    }
    if (!target.trim()) {
      onToast(
        'error',
        L(
          'Masukkan @username GitHub atau email, atau klik Buat Tautan Undangan.',
          'Enter a GitHub @username or email, or click Generate Invite Link.',
        ),
      );
      return;
    }
    setSending(true);
    try {
      const { invitation } = await api.sendWorkspaceInvitation(workspace.id, {
        target: target.trim(),
        role,
        message: message.trim(),
      });
      setInvitations((prev) => [invitation, ...prev]);
      onInvitationsChanged?.();
      setTarget('');
      setMessage('');
      const inviteeLabel = invitation.inviteeUsername
        ? `@${invitation.inviteeUsername}`
        : invitation.inviteeEmail;
      onToast(
        'success',
        L(
          `Undangan terkirim ke ${inviteeLabel} (Kode: ${invitation.inviteCode}).`,
          `Invitation sent to ${inviteeLabel} (Code: ${invitation.inviteCode}).`,
        ),
      );
    } catch (err) {
      onToast(
        'error',
        err instanceof Error ? err.message : L('Gagal mengirim undangan', 'Failed to send invitation'),
      );
    } finally {
      setSending(false);
    }
  }

  async function handleGenerateOpenLink() {
    if (!isLeader) {
      onToast(
        'error',
        L(
          'Hanya Ketua Proyek yang dapat membuat tautan undangan.',
          'Only Project Leader can generate invite links.',
        ),
      );
      return;
    }
    setGeneratingLink(true);
    try {
      const { invitation } = await api.sendWorkspaceInvitation(workspace.id, {
        role,
        message:
          message.trim() ||
          L(`Bergabunglah ke ${workspace.name} di CodePulse`, `Join ${workspace.name} on CodePulse`),
      });
      setInvitations((prev) => [invitation, ...prev]);
      onInvitationsChanged?.();
      copyValue(
        invitation.id,
        buildInviteUrl(invitation.inviteCode),
        L('Tautan undangan', 'Shareable invite link'),
      );
    } catch (err) {
      onToast(
        'error',
        err instanceof Error
          ? err.message
          : L('Gagal membuat tautan undangan', 'Failed to create invite link'),
      );
    } finally {
      setGeneratingLink(false);
    }
  }

  async function handleRevoke(invId: string) {
    try {
      const { invitation } = await api.revokeInvitation(invId);
      setInvitations((prev) => prev.map((item) => (item.id === invId ? invitation : item)));
      onInvitationsChanged?.();
      onToast('info', L('Undangan dibatalkan.', 'Invitation revoked.'));
    } catch (err) {
      onToast(
        'error',
        err instanceof Error
          ? err.message
          : L('Gagal membatalkan undangan', 'Failed to revoke invitation'),
      );
    }
  }

  async function handleRoleChange(userId: string, nextRole: UserRole) {
    try {
      const { workspace: updated } = await api.updateWorkspaceMemberRole(
        workspace.id,
        userId,
        nextRole,
      );
      onWorkspaceUpdated(updated);
      onToast('success', L('Peran anggota proyek diperbarui.', 'Member project role updated.'));
    } catch (err) {
      onToast(
        'error',
        err instanceof Error
          ? err.message
          : L('Gagal memperbarui peran anggota', 'Failed to update member role'),
      );
    }
  }

  async function handleRemoveMember(userId: string, username: string) {
    try {
      const { workspace: updated } = await api.removeWorkspaceMember(workspace.id, userId);
      onWorkspaceUpdated(updated);
      onToast(
        'info',
        L(`Menghapus @${username} dari ${workspace.name}.`, `Removed @${username} from ${workspace.name}.`),
      );
    } catch (err) {
      onToast(
        'error',
        err instanceof Error ? err.message : L('Gagal menghapus anggota', 'Failed to remove member'),
      );
    }
  }

  function formatInviteStatus(status: WorkspaceInvitation['status']): string {
    switch (status) {
      case 'pending':
        return L('menunggu', 'pending');
      case 'accepted':
        return L('diterima', 'accepted');
      case 'revoked':
        return L('dibatalkan', 'revoked');
      case 'declined':
        return L('ditolak', 'declined');
      default:
        return status;
    }
  }

  const pendingInvites = invitations.filter((i) => i.status === 'pending');
  const filteredInvitations = invitations.filter((inv) => {
    if (inviteFilter === 'all') return true;
    if (inviteFilter === 'pending') return inv.status === 'pending';
    if (inviteFilter === 'accepted') return inv.status === 'accepted';
    return inv.status === 'declined' || inv.status === 'revoked';
  });

  return (
    <div className="cp-panel rounded-2xl p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-indigo-400" />
            <span>{L('Anggota Tim Proyek & Undangan', 'Team Members & Invitations')}</span>
          </h3>
          <p className="text-xs text-zinc-400 mt-1">
            {L('Undang rekan tim langsung lewat ', 'Invite teammates directly by GitHub ')}
            <code>@username</code>
            {L(
              ' GitHub atau email, atau buat tautan/kode undangan yang bisa dibagikan untuk proyek ini.',
              ' or email, or generate a shareable invite link/code for this project.',
            )}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/12 border border-indigo-500/25 text-indigo-300 text-[11px] font-mono">
          <Users className="w-3 h-3" />
          <span>
            {workspace.members.length} {L('anggota', 'members')}
          </span>
          {pendingInvites.length > 0 && (
            <span>
              · {pendingInvites.length} {L('menunggu', 'pending')}
            </span>
          )}
        </span>
      </div>

      {/* Invite Composer (Project Lead only) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 space-y-4">
          <form
            onSubmit={handleSendDirectInvite}
            className="p-4 rounded-xl bg-zinc-950/90 border border-white/10 space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-cyan-400" />
                <span>{L('Kirim Undangan Proyek', 'Send Project Invitation')}</span>
              </span>
              {!isLeader && (
                <span className="text-[10px] font-mono text-amber-300">
                  {L('Khusus Ketua Proyek', 'Project Lead only')}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="sm:col-span-2">
                <label className="block text-[11px] text-zinc-400 mb-1">
                  {L('@username atau email rekan tim', 'Teammate @username or email')}
                </label>
                <input
                  type="text"
                  disabled={!isLeader || sending}
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder={L('@username atau rekan@email.com', '@username or teammate@email.com')}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-white/10 text-xs font-mono text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-[11px] text-zinc-400 mb-1">
                  {L('Peran Proyek', 'Project Role')}
                </label>
                <select
                  value={role}
                  disabled={!isLeader || sending}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full px-2.5 py-2 rounded-xl bg-zinc-900 border border-white/10 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                >
                  <option value="member">{L('Kontributor', 'Contributor')}</option>
                  <option value="leader">{L('Ketua Proyek', 'Project Lead')}</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-zinc-400 mb-1">
                {L('Catatan Opsional (ditampilkan ke penerima)', 'Optional Note (shown to invitee)')}
              </label>
              <input
                type="text"
                disabled={!isLeader || sending}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={L(
                  'mis. Gabung ke papan sprint dan review PR untuk repo ini',
                  'e.g. Join our sprint board and PR reviews for this repo',
                )}
                className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-white/10 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="submit"
                disabled={!isLeader || sending || !target.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition cursor-pointer disabled:opacity-45"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{sending ? L('Mengirim...', 'Sending...') : L('Kirim Undangan', 'Send Invite')}</span>
              </button>

              <button
                type="button"
                disabled={!isLeader || generatingLink}
                onClick={() => void handleGenerateOpenLink()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-white/10 text-zinc-100 text-xs font-medium transition cursor-pointer disabled:opacity-45"
              >
                <Link2 className="w-3.5 h-3.5 text-cyan-400" />
                <span>
                  {generatingLink
                    ? L('Membuat...', 'Creating...')
                    : L('Buat Tautan Undangan', 'Generate Shareable Link')}
                </span>
              </button>
            </div>
          </form>

          {/* Pending & Sent Invitations for this Workspace */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
                {L('Riwayat & Undangan Aktif Proyek', 'Project Active & Sent Invitations')} (
                {invitations.length})
              </div>
              {invitations.length > 0 && (
                <div className="flex items-center gap-1">
                  {(
                    [
                      { id: 'all', label: L('Semua', 'All') },
                      { id: 'pending', label: L('Menunggu', 'Pending') },
                      { id: 'accepted', label: L('Diterima', 'Accepted') },
                      { id: 'closed', label: L('Ditutup', 'Closed') },
                    ] as Array<{ id: InviteFilter; label: string }>
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setInviteFilter(f.id)}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition cursor-pointer ${
                        inviteFilter === f.id
                          ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-500/35'
                          : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-white/8'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {loadingInvitations ? (
              <InvitationsListSkeleton count={2} />
            ) : filteredInvitations.length === 0 ? (
              <div className="p-4 rounded-xl bg-zinc-950/60 border border-dashed border-white/10 text-xs text-zinc-500 text-center">
                {invitations.length === 0
                  ? L(
                      'Belum ada undangan yang dikirim untuk proyek ini.',
                      'No invitations sent for this project yet.',
                    )
                  : L(
                      'Tidak ada undangan pada filter ini.',
                      'No invitations match this filter.',
                    )}
              </div>
            ) : (
              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {filteredInvitations.map((inv) => {
                  const isOpenLink = !inv.inviteeUsername && !inv.inviteeEmail;
                  const inviteLink = buildInviteUrl(inv.inviteCode);
                  return (
                    <div
                      key={inv.id}
                      className="p-3 rounded-xl bg-zinc-950/90 border border-white/8 flex flex-wrap items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-semibold text-zinc-100 truncate">
                            {isOpenLink
                              ? L('Tautan Undangan Terbuka', 'Open Shareable Link')
                              : inv.inviteeUsername
                                ? `@${inv.inviteeUsername}`
                                : inv.inviteeEmail}
                          </span>
                          <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300">
                            {inv.role === 'leader'
                              ? L('Ketua', 'Lead')
                              : L('Kontributor', 'Contributor')}
                          </span>
                          <span
                            className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded ${
                              inv.status === 'pending'
                                ? 'bg-amber-500/15 text-amber-300'
                                : inv.status === 'accepted'
                                  ? 'bg-emerald-500/15 text-emerald-300'
                                  : 'bg-zinc-800 text-zinc-400'
                            }`}
                          >
                            {formatInviteStatus(inv.status)}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-zinc-500">
                          {L('Kode:', 'Code:')}{' '}
                          <span className="text-cyan-300">{inv.inviteCode}</span>
                        </div>
                      </div>

                      {inv.status === 'pending' && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              copyValue(
                                `code-${inv.id}`,
                                inv.inviteCode,
                                L('Kode undangan', 'Invite code'),
                              )
                            }
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-[11px] font-mono text-cyan-300 cursor-pointer"
                            title={L('Salin kode undangan', 'Copy invite code')}
                          >
                            {copiedId === `code-${inv.id}` ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                            <span>{L('Kode', 'Code')}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              copyValue(inv.id, inviteLink, L('Tautan undangan', 'Invite link'))
                            }
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[11px] text-zinc-200 cursor-pointer"
                            title={L('Salin tautan undangan', 'Copy shareable link')}
                          >
                            {copiedId === inv.id ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                            <span>{L('Salin Tautan', 'Copy Link')}</span>
                          </button>
                          {isLeader && (
                            <button
                              type="button"
                              onClick={() => void handleRevoke(inv.id)}
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-300 hover:bg-rose-500/10 cursor-pointer"
                              title={L('Batalkan undangan', 'Revoke invitation')}
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Current Project Team Roster */}
        <div className="lg:col-span-6 space-y-2.5">
          <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
            {L('Anggota Tim Proyek Saat Ini', 'Current Project Members')} ({workspace.members.length})
          </div>
          <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
            {workspace.members.map((member) => {
              const isOwner = workspace.ownerId === member.userId;
              const isSelf = currentUser.id === member.userId;
              return (
                <div
                  key={member.userId}
                  className="p-3 rounded-xl bg-zinc-950/90 border border-white/8 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={member.avatarUrl}
                      alt={member.username}
                      className="w-8 h-8 rounded-full ring-1 ring-white/15 bg-zinc-800 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-white truncate">
                          {member.displayName}
                        </span>
                        {isOwner && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 shrink-0">
                            <Shield className="w-2.5 h-2.5" />
                            {L('Pemilik', 'Owner')}
                          </span>
                        )}
                        {isSelf && (
                          <span className="text-[9px] font-mono text-zinc-500">
                            {L('(Anda)', '(you)')}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-mono text-zinc-500 truncate">
                        @{member.username}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isLeader && !isOwner ? (
                      <>
                        <select
                          value={member.role}
                          onChange={(e) =>
                            void handleRoleChange(member.userId, e.target.value as UserRole)
                          }
                          className="px-2 py-1 rounded-lg bg-zinc-900 border border-white/10 text-[11px] text-zinc-200 focus:outline-none focus:border-indigo-500"
                        >
                          <option value="member">{L('Kontributor', 'Contributor')}</option>
                          <option value="leader">{L('Ketua Proyek', 'Project Lead')}</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => void handleRemoveMember(member.userId, member.username)}
                          className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-300 hover:bg-rose-500/10 cursor-pointer"
                          title={L(`Hapus @${member.username}`, `Remove @${member.username}`)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <span
                        className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border ${
                          member.role === 'leader'
                            ? 'bg-indigo-500/12 border-indigo-500/25 text-indigo-300'
                            : 'bg-cyan-500/12 border-cyan-500/25 text-cyan-300'
                        }`}
                      >
                        {member.role === 'leader'
                          ? L('Ketua Proyek', 'Project Lead')
                          : L('Kontributor', 'Contributor')}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
