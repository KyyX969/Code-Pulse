import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  FileCode2,
  GitBranch,
  GitCommit,
  GitMerge,
  GitPullRequest,
  Lock,
  RotateCcw,
  ShieldCheck,
  X,
} from 'lucide-react';
import { isWorkspaceLeader } from '../../shared/permissions.ts';
import type { DiffSummary, PublicUser, Task, Workspace } from '../../shared/types.ts';
import { api } from '../lib/api.ts';
import { useLanguage } from '../lib/i18nContext.ts';
import { DiffViewerSkeleton } from './LoadingUI.tsx';

interface TaskDiffModalProps {
  workspace: Workspace;
  task: Task;
  currentUser: PublicUser;
  onClose: () => void;
  onTaskUpdated: (task: Task) => void;
  onToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export function TaskDiffModal({
  workspace,
  task,
  currentUser,
  onClose,
  onTaskUpdated,
  onToast,
}: TaskDiffModalProps) {
  const { L } = useLanguage();
  const [diff, setDiff] = useState<DiffSummary | null>(task.diffSummary);
  const [loadingDiff, setLoadingDiff] = useState(false);
  const [collapsedFiles, setCollapsedFiles] = useState<Record<string, boolean>>({});
  const [reviewComment, setReviewComment] = useState('');
  const [triggerDeploy, setTriggerDeploy] = useState(workspace.autoDeployOnMerge);
  const [submitting, setSubmitting] = useState<'approve' | 'reject' | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadDiff() {
      setLoadingDiff(true);
      try {
        const res = await api.getTaskDiff(workspace.id, task.id);
        if (!cancelled && res.diff) {
          setDiff(res.diff);
        }
      } catch {
        // Keep cached diff
      } finally {
        if (!cancelled) setLoadingDiff(false);
      }
    }
    void loadDiff();
    return () => {
      cancelled = true;
    };
  }, [workspace.id, task.id]);

  const isLeader = isWorkspaceLeader(workspace, currentUser);
  const canReview = task.status === 'in_review';
  const assignee = workspace.members.find((m) => m.userId === task.assigneeId);

  async function handleApproveAndMerge() {
    setSubmitting('approve');
    try {
      const res = await api.approveAndMerge(workspace.id, task.id, {
        reviewComment: reviewComment.trim() || undefined,
        triggerDeploy,
      });
      onTaskUpdated(res.task);
      onToast(
        'success',
        res.deployment
          ? L(
              `Berhasil merge #${task.taskCode} ke ${workspace.defaultBranch} & memulai deploy Vercel!`,
              `Merged #${task.taskCode} into ${workspace.defaultBranch} & started Vercel deploy!`,
            )
          : L(
              `Disetujui & di-merge #${task.taskCode} ke ${workspace.defaultBranch}.`,
              `Approved & merged #${task.taskCode} into ${workspace.defaultBranch}.`,
            ),
      );
      onClose();
    } catch (err) {
      onToast(
        'error',
        err instanceof Error ? err.message : L('Setujui & Merge gagal', 'Approve & Merge failed'),
      );
    } finally {
      setSubmitting(null);
    }
  }

  async function handleRequestChanges() {
    setSubmitting('reject');
    try {
      const res = await api.requestChanges(
        workspace.id,
        task.id,
        reviewComment.trim() ||
          L(
            'Mohon tindak lanjuti catatan review kode dan push kembali.',
            'Please address code review feedback and push again.',
          ),
      );
      onTaskUpdated(res.task);
      onToast(
        'info',
        L(
          `Mengembalikan #${task.taskCode} ke Sedang Dikerjakan untuk revisi.`,
          `Returned #${task.taskCode} to In Progress for revisions.`,
        ),
      );
      onClose();
    } catch (err) {
      onToast('error', err instanceof Error ? err.message : L('Aksi gagal', 'Action failed'));
    } finally {
      setSubmitting(null);
    }
  }

  function copyCheckoutCommand() {
    const branch = task.branchName || `feat/${task.taskCode.toLowerCase()}`;
    void navigator.clipboard.writeText(`git checkout -b ${branch}`);
    onToast(
      'info',
      L(`Disalin: git checkout -b ${branch}`, `Copied: git checkout -b ${branch}`),
    );
  }

  function formatFileStatus(status: string): string {
    switch (status) {
      case 'added':
        return L('ditambahkan', 'added');
      case 'modified':
        return L('diubah', 'modified');
      case 'removed':
        return L('dihapus', 'removed');
      case 'renamed':
        return L('diganti nama', 'renamed');
      default:
        return status;
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl max-h-[90vh] flex flex-col rounded-2xl bg-[#0e1018] border border-white/14 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-start justify-between gap-4 bg-zinc-950/75">
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-indigo-500/18 border border-indigo-500/35 text-indigo-300 font-mono text-xs font-semibold">
                #{task.taskCode}
              </span>
              <StatusBadge status={task.status} />
              {workspace.branchProtected && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/12 border border-emerald-500/30 text-emerald-300 text-[11px] font-medium">
                  <Lock className="w-3 h-3" />
                  {workspace.defaultBranch} {L('Terproteksi', 'Protected')}
                </span>
              )}
            </div>
            <h2 className="text-lg font-bold text-white truncate">{task.title}</h2>
            {task.description && (
              <p className="text-xs text-zinc-400 line-clamp-2">{task.description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Metadata Strip */}
        <div className="px-6 py-3 bg-zinc-950/40 border-b border-white/8 flex flex-wrap items-center gap-4 text-xs text-zinc-300">
          <div className="flex items-center gap-1.5 font-mono text-zinc-200 bg-zinc-900 px-2.5 py-1 rounded-lg border border-white/8">
            <GitBranch className="w-3.5 h-3.5 text-cyan-400" />
            <span>{task.branchName || L('tanpa-branch', 'no-branch')}</span>
            <span className="text-zinc-500">→</span>
            <span className="text-emerald-400">{workspace.defaultBranch}</span>
            <button
              type="button"
              onClick={copyCheckoutCommand}
              title={L('Salin perintah git checkout', 'Copy git checkout command')}
              className="ml-1 text-zinc-500 hover:text-white cursor-pointer"
            >
              <Copy className="w-3 h-3" />
            </button>
          </div>

          {task.latestCommitSha && (
            <div className="flex items-center gap-1.5 font-mono text-zinc-400">
              <GitCommit className="w-3.5 h-3.5 text-indigo-400" />
              <span>{task.latestCommitSha}</span>
            </div>
          )}

          {task.prNumber && (
            <a
              href={task.prUrl || '#'}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-indigo-300 hover:text-indigo-200 font-mono"
            >
              <GitPullRequest className="w-3.5 h-3.5" />
              <span>PR #{task.prNumber}</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}

          <div className="ml-auto flex items-center gap-2 text-zinc-400">
            {assignee && (
              <img
                src={assignee.avatarUrl}
                alt={assignee.username}
                className="w-5 h-5 rounded-full ring-1 ring-white/15"
              />
            )}
            <span className="text-zinc-200 font-medium">
              {assignee ? `@${assignee.username}` : L('Belum ditugaskan', 'Unassigned')}
            </span>
          </div>
        </div>

        {/* Body / Code Diff Viewer */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {task.latestCommitMessage && (
            <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-white/8 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-zinc-300 font-mono truncate">
                <span className="text-zinc-500 mr-2">Commit:</span>
                {task.latestCommitMessage}
              </div>
              {diff && (
                <div className="flex items-center gap-2.5 shrink-0 font-mono text-xs tabular-nums">
                  <span className="px-2 py-0.5 rounded bg-emerald-500/12 text-emerald-300">
                    +{diff.totalAdditions}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-rose-500/12 text-rose-300">
                    -{diff.totalDeletions}
                  </span>
                  <span className="text-zinc-400">
                    {diff.changedFiles} {L('berkas', 'files')}
                  </span>
                </div>
              )}
            </div>
          )}

          {task.reviewComment && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-200 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
              <div>
                <span className="font-semibold">{L('Catatan Review: ', 'Review Note: ')}</span>
                {task.reviewComment}
              </div>
            </div>
          )}

          {loadingDiff && !diff ? (
            <DiffViewerSkeleton />
          ) : diff && diff.files.length > 0 ? (
            <div className="space-y-4">
              {diff.files.map((file) => {
                const isCollapsed = Boolean(collapsedFiles[file.filename]);
                const lines = file.patch.split('\n');
                return (
                  <div
                    key={file.filename}
                    className="rounded-xl border border-white/10 overflow-hidden bg-[#080a0f]"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setCollapsedFiles((prev) => ({
                          ...prev,
                          [file.filename]: !prev[file.filename],
                        }))
                      }
                      className="w-full px-4 py-2.5 bg-zinc-900/95 border-b border-white/10 flex items-center justify-between gap-2 text-xs hover:bg-zinc-900 transition cursor-pointer"
                    >
                      <div className="flex items-center gap-2 font-mono text-zinc-200 min-w-0">
                        {isCollapsed ? (
                          <ChevronRight className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        )}
                        <FileCode2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span className="truncate">{file.filename}</span>
                        <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 text-[10px] uppercase">
                          {formatFileStatus(file.status)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 font-mono shrink-0 tabular-nums">
                        <span className="text-emerald-400">+{file.additions}</span>
                        <span className="text-rose-400">-{file.deletions}</span>
                      </div>
                    </button>

                    {!isCollapsed && (
                      <div className="overflow-x-auto text-xs font-mono leading-relaxed">
                        {lines.map((line, idx) => {
                          const isAdd = line.startsWith('+') && !line.startsWith('+++');
                          const isDel = line.startsWith('-') && !line.startsWith('---');
                          const isHunk = line.startsWith('@@');
                          return (
                            <div
                              key={idx}
                              className={`flex whitespace-pre ${
                                isAdd
                                  ? 'bg-emerald-500/12 text-emerald-200'
                                  : isDel
                                    ? 'bg-rose-500/12 text-rose-200'
                                    : isHunk
                                      ? 'bg-cyan-500/10 text-cyan-300'
                                      : 'text-zinc-300'
                              }`}
                            >
                              <span className="w-10 shrink-0 select-none text-right pr-3 py-0.5 text-[10px] text-zinc-600 border-r border-white/6 bg-black/20 tabular-nums">
                                {idx + 1}
                              </span>
                              <span className="px-3 py-0.5 flex-1">{line || ' '}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 rounded-xl border border-dashed border-white/10 text-center space-y-2">
              <GitPullRequest className="w-7 h-7 text-zinc-500 mx-auto" />
              <div className="text-sm font-medium text-zinc-300">
                {L('Belum ada diff kode terlampir', 'No code diff attached yet')}
              </div>
              <p className="text-xs text-zinc-500 max-w-md mx-auto">
                {L('Push commit yang mencantumkan ', 'Push a commit mentioning ')}
                <code className="text-indigo-300">#{task.taskCode}</code>{' '}
                {L(
                  'pada feature branch (atau gunakan Simulator Webhook di Gatekeeper) untuk melampirkan diff langsung guna di-review.',
                  'on a feature branch (or use the Webhook Simulator in Gatekeeper) to attach a live diff for review.',
                )}
              </p>
            </div>
          )}
        </div>

        {/* Gatekeeper Action Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-zinc-950/90 space-y-3">
          {canReview ? (
            isLeader ? (
              <>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder={L(
                      'Catatan review Gatekeeper opsional (mis. LGTM, guard auth rapi)...',
                      'Optional Gatekeeper review note (e.g. LGTM, clean auth guard)...',
                    )}
                    className="flex-1 px-3.5 py-2 rounded-xl bg-zinc-900 border border-white/10 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500"
                  />
                  <label className="inline-flex items-center gap-2 text-xs text-zinc-300 px-3.5 py-2 rounded-xl bg-zinc-900 border border-white/10 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={triggerDeploy}
                      onChange={(e) => setTriggerDeploy(e.target.checked)}
                      className="rounded border-zinc-600 bg-zinc-800 text-indigo-500"
                    />
                    <span>
                      {L('Auto-deploy ke Vercel setelah merge', 'Auto-deploy to Vercel after merge')}
                    </span>
                  </label>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-emerald-300">
                    <ShieldCheck className="w-4 h-4" />
                    <span>
                      {L(
                        'Terverifikasi Gatekeeper • Persetujuan Ketua Proyek',
                        'Gatekeeper Verified • Project Leader Approval',
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 ml-auto">
                    <button
                      type="button"
                      disabled={submitting !== null}
                      onClick={handleRequestChanges}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{L('Minta Revisi', 'Request Changes')}</span>
                    </button>
                    <button
                      type="button"
                      disabled={submitting !== null}
                      onClick={handleApproveAndMerge}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold shadow-lg shadow-emerald-950/60 transition cursor-pointer disabled:opacity-50"
                    >
                      <GitMerge className="w-4 h-4" />
                      <span>
                        {submitting === 'approve'
                          ? L('Melakukan Merge...', 'Merging...')
                          : L('Setujui & Merge', 'Approve & Merge')}
                      </span>
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-200 text-xs">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    <strong>{L('Terkunci Gatekeeper:', 'Gatekeeper Locked:')}</strong> Branch{' '}
                    <code className="text-white">{workspace.defaultBranch}</code>{' '}
                    {L('terproteksi. Hanya ', 'is protected. Only a ')}
                    <strong>{L('Ketua Proyek', 'Project Leader')}</strong>{' '}
                    {L('yang dapat memeriksa diff dan mengklik ', 'can inspect diffs and click ')}
                    <strong>{L('Setujui & Merge', 'Approve & Merge')}</strong>.
                  </span>
                </div>
              </div>
            )
          ) : (
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span className="inline-flex items-center gap-1.5">
                {task.status === 'done' ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-300">
                      {L(
                        `Disetujui & di-merge ke ${workspace.defaultBranch}.`,
                        `Approved & merged to ${workspace.defaultBranch}.`,
                      )}
                    </span>
                  </>
                ) : (
                  <span>
                    {L(
                      `Push commit yang mereferensikan #${task.taskCode} untuk masuk ke Review Gatekeeper.`,
                      `Push commits referencing #${task.taskCode} to enter Gatekeeper Review.`,
                    )}
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium cursor-pointer"
              >
                {L('Tutup', 'Close')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Task['status'] }) {
  const { L } = useLanguage();
  const styles: Record<Task['status'], string> = {
    todo: 'bg-zinc-800 text-zinc-300 border-white/10',
    in_progress: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    in_review: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
    done: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  };
  const labels: Record<Task['status'], string> = {
    todo: L('Akan Dikerjakan', 'To Do'),
    in_progress: L('Sedang Dikerjakan', 'In Progress'),
    in_review: L('Dalam Review', 'In Review'),
    done: L('Selesai', 'Done'),
  };
  return (
    <span className={`px-2 py-0.5 rounded-md border text-[11px] font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
