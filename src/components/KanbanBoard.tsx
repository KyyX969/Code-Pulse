import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Eye,
  GitBranch,
  GitPullRequest,
  GripVertical,
  LayoutGrid,
  List,
  Lock,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import { isWorkspaceLeader } from '../../shared/permissions.ts';
import type {
  PublicUser,
  Task,
  TaskPriority,
  TaskStatus,
  Workspace,
} from '../../shared/types.ts';
import { api } from '../lib/api.ts';
import { useLanguage } from '../lib/i18nContext.ts';

interface KanbanBoardProps {
  workspace: Workspace;
  tasks: Task[];
  currentUser: PublicUser;
  externalCreateOpen?: boolean;
  onCloseExternalCreate?: () => void;
  onTasksChange: (tasks: Task[]) => void;
  onOpenTask: (task: Task) => void;
  onToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

interface KanbanColumnDef {
  id: TaskStatus;
  title: string;
  topGlow: string;
  dot: string;
  hint: string;
}

const COLUMN_IDS: TaskStatus[] = ['todo', 'in_progress', 'in_review', 'done'];

export function KanbanBoard({
  workspace,
  tasks,
  currentUser,
  externalCreateOpen = false,
  onCloseExternalCreate,
  onTasksChange,
  onOpenTask,
  onToast,
}: KanbanBoardProps) {
  const { L } = useLanguage();
  const [search, setSearch] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [activeDragTask, setActiveDragTask] = useState<Task | null>(null);
  const [createDefaultStatus, setCreateDefaultStatus] = useState<TaskStatus>('todo');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const columns = useMemo<KanbanColumnDef[]>(
    () => [
      {
        id: 'todo',
        title: L('Akan Dikerjakan', 'To Do'),
        topGlow: 'from-zinc-500/40',
        dot: 'bg-zinc-400',
        hint: L('Backlog siap diambil', 'Backlog ready to claim'),
      },
      {
        id: 'in_progress',
        title: L('Sedang Dikerjakan', 'In Progress'),
        topGlow: 'from-sky-500/50',
        dot: 'bg-sky-400',
        hint: L('Aktif di feature branch', 'Active on feature branches'),
      },
      {
        id: 'in_review',
        title: L('Dalam Review', 'In Review'),
        topGlow: 'from-violet-500/60',
        dot: 'bg-violet-400',
        hint: L('Sinkron via webhook • Perlu review', 'Synced by webhook • Needs review'),
      },
      {
        id: 'done',
        title: L('Selesai', 'Done'),
        topGlow: 'from-emerald-500/55',
        dot: 'bg-emerald-400',
        hint: L('Disetujui & di-merge ke main', 'Approved & merged to main'),
      },
    ],
    [L],
  );

  const isCreateOpen = showCreateModal || externalCreateOpen;
  const closeCreateModal = () => {
    setShowCreateModal(false);
    onCloseExternalCreate?.();
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => {
      if (assigneeFilter !== 'all' && t.assigneeId !== assigneeFilter) return false;
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
      if (!q) return true;
      return (
        t.taskCode.toLowerCase().includes(q) ||
        t.title.toLowerCase().includes(q) ||
        (t.branchName || '').toLowerCase().includes(q)
      );
    });
  }, [tasks, search, assigneeFilter, priorityFilter]);

  const counts = useMemo(() => {
    const total = tasks.length || 1;
    const done = tasks.filter((t) => t.status === 'done').length;
    const inReview = tasks.filter((t) => t.status === 'in_review').length;
    const inProgress = tasks.filter((t) => t.status === 'in_progress').length;
    const todo = tasks.filter((t) => t.status === 'todo').length;
    return {
      total: tasks.length,
      pctDone: Math.round((done / total) * 100),
      donePct: (done / total) * 100,
      reviewPct: (inReview / total) * 100,
      progressPct: (inProgress / total) * 100,
      todoPct: (todo / total) * 100,
      done,
      inReview,
      inProgress,
      todo,
    };
  }, [tasks]);

  function getColumnTasks(status: TaskStatus): Task[] {
    return filteredTasks
      .filter((t) => t.status === status)
      .sort((a, b) => a.position - b.position);
  }

  function handleDragStart(event: DragStartEvent) {
    const found = tasks.find((t) => t.id === event.active.id);
    setActiveDragTask(found ?? null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveDragTask(null);
    const { active, over } = event;
    if (!over) return;

    const draggedTask = tasks.find((t) => t.id === active.id);
    if (!draggedTask) return;

    let targetStatus: TaskStatus = draggedTask.status;
    if (COLUMN_IDS.includes(over.id as TaskStatus)) {
      targetStatus = over.id as TaskStatus;
    } else {
      const overTask = tasks.find((t) => t.id === over.id);
      if (overTask) targetStatus = overTask.status;
    }

    if (targetStatus === draggedTask.status && active.id === over.id) return;

    if (targetStatus === 'done' && draggedTask.status !== 'done' && !isWorkspaceLeader(workspace, currentUser)) {
      onToast(
        'error',
        L(
          'Kebijakan Gatekeeper: Hanya Ketua Proyek yang dapat menyetujui & memindahkan tugas ke Selesai.',
          'Gatekeeper Policy: Only the Project Leader can approve & move tasks to Done.',
        ),
      );
      return;
    }

    const updatedList = tasks.map((t) =>
      t.id === draggedTask.id ? { ...t, status: targetStatus } : t,
    );
    onTasksChange(updatedList);

    try {
      const { task: saved } = await api.updateTask(workspace.id, draggedTask.id, {
        status: targetStatus,
      });
      onTasksChange(updatedList.map((t) => (t.id === saved.id ? saved : t)));
    } catch (err) {
      onTasksChange(tasks);
      onToast('error', err instanceof Error ? err.message : L('Gagal memindahkan tugas', 'Failed to move task'));
    }
  }

  async function handleDeleteTask(task: Task) {
    if (!isWorkspaceLeader(workspace, currentUser)) {
      onToast(
        'error',
        L('Hanya Ketua Proyek yang dapat menghapus tugas.', 'Only Project Leader can delete tasks.'),
      );
      return;
    }
    try {
      await api.deleteTask(workspace.id, task.id);
      onTasksChange(tasks.filter((t) => t.id !== task.id));
      onToast('info', L(`Menghapus #${task.taskCode}`, `Deleted #${task.taskCode}`));
    } catch (err) {
      onToast('error', err instanceof Error ? err.message : L('Gagal menghapus', 'Delete failed'));
    }
  }

  function handleCopyTag(code: string) {
    void navigator.clipboard.writeText(`#${code}`);
    onToast(
      'info',
      L(
        `#${code} disalin — tempel ke pesan git commit Anda untuk sinkronisasi otomatis.`,
        `Copied #${code} — paste into your git commit message to auto-sync.`,
      ),
    );
  }

  return (
    <div className="space-y-5">
      {/* Sprint Progress Strip */}
      <div className="cp-panel rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white">
                {L('Progres Pengiriman Sprint', 'Sprint Delivery Pulse')}
              </span>
              <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-emerald-500/12 border border-emerald-500/25 text-emerald-300 tabular-nums">
                {counts.pctDone}% {L('Selesai', 'Complete')}
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-zinc-400 tabular-nums">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                {counts.done} {L('Selesai', 'Done')}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-violet-400" />
                {counts.inReview} {L('Review', 'Review')}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-sky-400" />
                {counts.inProgress} {L('Aktif', 'Active')}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-zinc-500" />
                {counts.todo} {L('Akan Dikerjakan', 'To Do')}
              </span>
            </div>
          </div>

          <div className="h-2 w-full rounded-full bg-zinc-900 overflow-hidden flex border border-white/5">
            <div
              style={{ width: `${counts.donePct}%` }}
              className="bg-emerald-500 transition-all duration-500"
            />
            <div
              style={{ width: `${counts.reviewPct}%` }}
              className="bg-violet-500 transition-all duration-500"
            />
            <div
              style={{ width: `${counts.progressPct}%` }}
              className="bg-sky-500 transition-all duration-500"
            />
            <div
              style={{ width: `${counts.todoPct}%` }}
              className="bg-zinc-700 transition-all duration-500"
            />
          </div>
        </div>

        {/* View Toggle & New Task */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="inline-flex rounded-xl bg-zinc-950 border border-white/10 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('board')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                viewMode === 'board'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>{L('Papan', 'Board')}</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-zinc-800 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>{L('Daftar', 'List')}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setCreateDefaultStatus('todo');
              setShowCreateModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-950/50 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{L('Tugas Baru', 'New Task')}</span>
          </button>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={L('Cari berdasarkan #CP-01, judul, atau branch...', 'Filter by #CP-01, title, or branch...')}
            className="w-full pl-8 pr-3 py-2 rounded-xl bg-[#0e1017] border border-white/10 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <select
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
          className="px-3 py-2 rounded-xl bg-[#0e1017] border border-white/10 text-xs text-zinc-300 focus:outline-none focus:border-indigo-500"
        >
          <option value="all">{L('Semua Developer', 'All Developers')}</option>
          {workspace.members.map((m) => (
            <option key={m.userId} value={m.userId}>
              @{m.username} ({m.role === 'leader' ? L('Ketua Proyek', 'leader') : L('Kontributor', 'member')})
            </option>
          ))}
        </select>

        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="px-3 py-2 rounded-xl bg-[#0e1017] border border-white/10 text-xs text-zinc-300 focus:outline-none focus:border-indigo-500"
        >
          <option value="all">{L('Semua Prioritas', 'All Priorities')}</option>
          <option value="urgent">{L('Mendesak', 'Urgent')}</option>
          <option value="high">{L('Tinggi', 'High')}</option>
          <option value="medium">{L('Sedang', 'Medium')}</option>
          <option value="low">{L('Rendah', 'Low')}</option>
        </select>
      </div>

      {/* Board or Compact List View */}
      {viewMode === 'board' ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
            {columns.map((column) => (
              <KanbanColumn
                key={column.id}
                column={column}
                tasks={getColumnTasks(column.id)}
                workspace={workspace}
                currentUser={currentUser}
                onOpenTask={onOpenTask}
                onDeleteTask={handleDeleteTask}
                onCopyTag={handleCopyTag}
                onQuickAdd={() => {
                  setCreateDefaultStatus(column.id);
                  setShowCreateModal(true);
                }}
              />
            ))}
          </div>

          <DragOverlay>
            {activeDragTask ? (
              <div className="rotate-1 scale-[1.02]">
                <TaskCardView
                  task={activeDragTask}
                  workspace={workspace}
                  currentUser={currentUser}
                  onOpen={() => {}}
                  onCopyTag={() => {}}
                  isDraggingOverlay
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <TaskListView
          tasks={filteredTasks}
          workspace={workspace}
          onOpenTask={onOpenTask}
          onCopyTag={handleCopyTag}
        />
      )}

      {isCreateOpen && (
        <CreateTaskModal
          workspace={workspace}
          defaultStatus={createDefaultStatus}
          currentUser={currentUser}
          onClose={closeCreateModal}
          onCreated={(newTask) => {
            onTasksChange([...tasks, newTask]);
            closeCreateModal();
            onToast(
              'success',
              L(
                `Tugas #${newTask.taskCode} dibuat (${newTask.title})`,
                `Created #${newTask.taskCode} (${newTask.title})`,
              ),
            );
          }}
          onError={(msg) => onToast('error', msg)}
        />
      )}
    </div>
  );
}

function KanbanColumn({
  column,
  tasks,
  workspace,
  currentUser,
  onOpenTask,
  onDeleteTask,
  onCopyTag,
  onQuickAdd,
}: {
  column: KanbanColumnDef;
  tasks: Task[];
  workspace: Workspace;
  currentUser: PublicUser;
  onOpenTask: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
  onCopyTag: (code: string) => void;
  onQuickAdd: () => void;
}) {
  const { L } = useLanguage();
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const canQuickAdd = column.id !== 'done' || isWorkspaceLeader(workspace, currentUser);

  return (
    <div
      ref={setNodeRef}
      className={`rounded-2xl bg-[#0c0e15]/90 border transition-colors overflow-hidden flex flex-col min-h-[460px] ${
        isOver ? 'border-indigo-400/70 bg-indigo-500/5' : 'border-white/8'
      }`}
    >
      {/* Top gradient hairline */}
      <div className={`h-0.5 w-full bg-gradient-to-r ${column.topGlow} to-transparent`} />

      <div className="p-3.5 flex flex-col gap-3 flex-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${column.dot}`} />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-100">
              {column.title}
            </h3>
            <span className="px-1.5 py-0.5 rounded-md bg-white/6 text-zinc-300 font-mono text-[11px] tabular-nums">
              {tasks.length}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {column.id === 'done' &&
              workspace.branchProtected &&
              !isWorkspaceLeader(workspace, currentUser) && (
                <span
                  title={L(
                    'Diperlukan Gatekeeper Ketua Proyek untuk memindahkan kartu ke Selesai',
                    'Leader Gatekeeper required to move cards to Done',
                  )}
                  className="p-1 text-zinc-500"
                >
                  <Lock className="w-3.5 h-3.5" />
                </span>
              )}
            {canQuickAdd && (
              <button
                type="button"
                onClick={onQuickAdd}
                className="p-1 rounded-md text-zinc-500 hover:text-white hover:bg-white/8 transition cursor-pointer"
                title={L(`Tambah tugas ke ${column.title}`, `Add task to ${column.title}`)}
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="text-[11px] text-zinc-500 -mt-1.5">{column.hint}</div>

        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2.5 flex-1">
            {tasks.map((task) => (
              <SortableTaskCard
                key={task.id}
                task={task}
                workspace={workspace}
                currentUser={currentUser}
                onOpen={() => onOpenTask(task)}
                onDelete={() => onDeleteTask(task)}
                onCopyTag={() => onCopyTag(task.taskCode)}
              />
            ))}
            {tasks.length === 0 && (
              <div className="h-28 rounded-xl border border-dashed border-white/8 flex items-center justify-center text-xs text-zinc-600">
                {L('Lepas tugas di sini', 'Drop tasks here')}
              </div>
            )}
          </div>
        </SortableContext>
      </div>
    </div>
  );
}

function SortableTaskCard({
  task,
  workspace,
  currentUser,
  onOpen,
  onDelete,
  onCopyTag,
}: {
  task: Task;
  workspace: Workspace;
  currentUser: PublicUser;
  onOpen: () => void;
  onDelete: () => void;
  onCopyTag: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={isDragging ? 'opacity-30' : ''}
      {...attributes}
      {...listeners}
    >
      <TaskCardView
        task={task}
        workspace={workspace}
        currentUser={currentUser}
        onOpen={onOpen}
        onDelete={onDelete}
        onCopyTag={onCopyTag}
      />
    </div>
  );
}

function TaskCardView({
  task,
  workspace,
  currentUser,
  onOpen,
  onDelete,
  onCopyTag,
  isDraggingOverlay = false,
}: {
  task: Task;
  workspace: Workspace;
  currentUser: PublicUser;
  onOpen: () => void;
  onDelete?: () => void;
  onCopyTag: () => void;
  isDraggingOverlay?: boolean;
}) {
  const { L } = useLanguage();
  const assignee = workspace.members.find((m) => m.userId === task.assigneeId);

  const priorityMeta: Record<TaskPriority, { badge: string; stripe: string; label: string }> = {
    low: { badge: 'bg-zinc-800/90 text-zinc-400', stripe: 'bg-zinc-600', label: L('Rendah', 'Low') },
    medium: { badge: 'bg-sky-500/15 text-sky-300', stripe: 'bg-sky-500', label: L('Sedang', 'Medium') },
    high: { badge: 'bg-amber-500/15 text-amber-300', stripe: 'bg-amber-500', label: L('Tinggi', 'High') },
    urgent: { badge: 'bg-rose-500/18 text-rose-300', stripe: 'bg-rose-500', label: L('Mendesak', 'Urgent') },
  };

  return (
    <div
      onClick={onOpen}
      className={`group relative rounded-xl cp-card hover:border-indigo-400/45 hover:bg-[#161a26] p-3.5 pl-4 space-y-2.5 cursor-grab active:cursor-grabbing transition-all ${
        isDraggingOverlay ? 'shadow-2xl border-indigo-400 ring-2 ring-indigo-500/30' : ''
      }`}
    >
      {/* Left Priority Indicator Bar */}
      <div
        className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full ${priorityMeta[task.priority].stripe}`}
      />

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <GripVertical className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-400" />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCopyTag();
            }}
            title={L(
              `Salin #${task.taskCode} untuk pesan git commit`,
              `Copy #${task.taskCode} for git commit message`,
            )}
            className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-indigo-300 bg-indigo-500/12 hover:bg-indigo-500/25 border border-indigo-500/20 px-1.5 py-0.5 rounded transition cursor-pointer"
          >
            <span>#{task.taskCode}</span>
            <Copy className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100" />
          </button>
          <span
            className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${priorityMeta[task.priority].badge}`}
          >
            {priorityMeta[task.priority].label}
          </span>
        </div>

        {isWorkspaceLeader(workspace, currentUser) && onDelete && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="opacity-0 group-hover:opacity-100 p-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
            title={L('Hapus tugas', 'Delete task')}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="text-[13px] font-medium text-zinc-100 leading-snug">
        {task.title}
      </div>

      {task.branchName && (
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-400 bg-zinc-950/90 px-2 py-1 rounded-lg border border-white/6 truncate">
          <GitBranch className="w-3 h-3 text-cyan-400 shrink-0" />
          <span className="truncate">{task.branchName}</span>
          {task.latestCommitSha && (
            <span className="ml-auto text-indigo-300 shrink-0">{task.latestCommitSha}</span>
          )}
        </div>
      )}

      {task.diffSummary && (
        <div className="flex items-center justify-between text-[11px] font-mono px-2 py-1 rounded-md bg-white/[0.03] border border-white/5">
          <span className="inline-flex items-center gap-1 text-zinc-400">
            <GitPullRequest className="w-3 h-3 text-violet-400" />
            {task.prNumber
              ? `PR #${task.prNumber}`
              : L(`${task.diffSummary.changedFiles} berkas`, `${task.diffSummary.changedFiles} files`)}
          </span>
          <span className="tabular-nums">
            <span className="text-emerald-400">+{task.diffSummary.totalAdditions}</span>{' '}
            <span className="text-rose-400">-{task.diffSummary.totalDeletions}</span>
          </span>
        </div>
      )}

      {task.status === 'in_review' && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
          className={`w-full py-1.5 px-2.5 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition cursor-pointer ${
            isWorkspaceLeader(workspace, currentUser)
              ? 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-md shadow-violet-950/50'
              : 'bg-zinc-900 hover:bg-zinc-800 text-violet-300 border border-violet-500/30'
          }`}
        >
          <Eye className="w-3.5 h-3.5" />
          <span>
            {isWorkspaceLeader(workspace, currentUser)
              ? L('Periksa Diff & Merge', 'Inspect Diff & Merge')
              : L('Lihat Diff (Menunggu Ketua Proyek)', 'View Diff (Awaiting Leader)')}
          </span>
        </button>
      )}

      {task.reviewComment && task.status === 'in_progress' && (
        <div className="flex items-center gap-1.5 text-[11px] text-amber-300 bg-amber-500/10 px-2 py-1 rounded-md border border-amber-500/20">
          <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{task.reviewComment}</span>
        </div>
      )}

      <div className="flex items-center justify-between pt-1.5 border-t border-white/6 text-[11px] text-zinc-400">
        <div className="flex items-center gap-1.5 min-w-0">
          {assignee ? (
            <>
              <img
                src={assignee.avatarUrl}
                alt={assignee.username}
                className="w-4 h-4 rounded-full bg-zinc-800 ring-1 ring-white/15"
              />
              <span className="truncate">@{assignee.username}</span>
            </>
          ) : (
            <span className="text-zinc-600">{L('Belum ditugaskan', 'Unassigned')}</span>
          )}
        </div>

        {task.status === 'done' && (
          <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
            <CheckCircle2 className="w-3 h-3" />
            {L('Di-merge', 'Merged')}
          </span>
        )}
      </div>
    </div>
  );
}

function TaskListView({
  tasks,
  workspace,
  onOpenTask,
  onCopyTag,
}: {
  tasks: Task[];
  workspace: Workspace;
  onOpenTask: (task: Task) => void;
  onCopyTag: (code: string) => void;
}) {
  const { L } = useLanguage();
  const statusStyles: Record<TaskStatus, string> = {
    todo: 'bg-zinc-800 text-zinc-300',
    in_progress: 'bg-sky-500/15 text-sky-300',
    in_review: 'bg-violet-500/15 text-violet-300',
    done: 'bg-emerald-500/15 text-emerald-300',
  };
  const statusLabels: Record<TaskStatus, string> = {
    todo: L('Akan Dikerjakan', 'To Do'),
    in_progress: L('Sedang Dikerjakan', 'In Progress'),
    in_review: L('Dalam Review', 'In Review'),
    done: L('Selesai', 'Done'),
  };
  const priorityLabels: Record<TaskPriority, string> = {
    low: L('Rendah', 'Low'),
    medium: L('Sedang', 'Medium'),
    high: L('Tinggi', 'High'),
    urgent: L('Mendesak', 'Urgent'),
  };

  return (
    <div className="cp-panel rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-zinc-950/80 border-b border-white/8 text-[11px] uppercase tracking-wider text-zinc-400">
            <tr>
              <th className="px-4 py-3">{L('ID', 'ID')}</th>
              <th className="px-4 py-3">{L('Tugas', 'Task')}</th>
              <th className="px-4 py-3">{L('Status', 'Status')}</th>
              <th className="px-4 py-3">{L('Prioritas', 'Priority')}</th>
              <th className="px-4 py-3">Branch</th>
              <th className="px-4 py-3">{L('Penanggung Jawab', 'Assignee')}</th>
              <th className="px-4 py-3 text-right">{L('Aksi', 'Action')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/6">
            {tasks.map((task) => {
              const assignee = workspace.members.find((m) => m.userId === task.assigneeId);
              return (
                <tr
                  key={task.id}
                  onClick={() => onOpenTask(task)}
                  className="hover:bg-white/[0.03] cursor-pointer transition"
                >
                  <td className="px-4 py-3 font-mono">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCopyTag(task.taskCode);
                      }}
                      className="text-indigo-300 hover:text-indigo-200 font-semibold cursor-pointer"
                    >
                      #{task.taskCode}
                    </button>
                  </td>
                  <td className="px-4 py-3 font-medium text-zinc-100">{task.title}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[11px] font-medium ${statusStyles[task.status]}`}
                    >
                      {statusLabels[task.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 uppercase font-mono text-[11px] text-zinc-400">
                    {priorityLabels[task.priority]}
                  </td>
                  <td className="px-4 py-3 font-mono text-cyan-300">
                    {task.branchName || '—'}
                  </td>
                  <td className="px-4 py-3 text-zinc-300">
                    {assignee ? `@${assignee.username}` : L('Belum ditugaskan', 'Unassigned')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenTask(task);
                      }}
                      className="px-2.5 py-1 rounded-md bg-white/8 hover:bg-white/15 text-zinc-200 text-[11px] font-medium cursor-pointer"
                    >
                      {L('Periksa', 'Inspect')}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CreateTaskModal({
  workspace,
  defaultStatus,
  currentUser,
  onClose,
  onCreated,
  onError,
}: {
  workspace: Workspace;
  defaultStatus: TaskStatus;
  currentUser: PublicUser;
  onClose: () => void;
  onCreated: (task: Task) => void;
  onError: (msg: string) => void;
}) {
  const { L } = useLanguage();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [status, setStatus] = useState<TaskStatus>(defaultStatus);
  const [assigneeId, setAssigneeId] = useState<string>(workspace.members[1]?.userId || '');
  const [branchName, setBranchName] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      const { task } = await api.createTask(workspace.id, {
        title: title.trim(),
        description: description.trim(),
        priority,
        status,
        assigneeId: assigneeId || null,
        branchName: branchName.trim() || undefined,
      });
      onCreated(task);
    } catch (err) {
      onError(err instanceof Error ? err.message : L('Gagal membuat tugas', 'Failed to create task'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-[#10121b] border border-white/12 shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">
            {L('Buat Tugas Kanban', 'Create Kanban Task')}
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
              {L('Judul Tugas', 'Task Title')}
            </label>
            <input
              type="text"
              required
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={L(
                'mis. Bangun handler callback OAuth',
                'e.g. Build OAuth callback handler',
              )}
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
              placeholder={L('Kriteria penerimaan & catatan...', 'Acceptance criteria & notes...')}
              className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-white/10 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                {L('Kolom', 'Column')}
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full px-2.5 py-2 rounded-xl bg-zinc-950 border border-white/10 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="todo">{L('Akan Dikerjakan', 'To Do')}</option>
                <option value="in_progress">{L('Sedang Dikerjakan', 'In Progress')}</option>
                <option value="in_review">{L('Dalam Review', 'In Review')}</option>
                {isWorkspaceLeader(workspace, currentUser) && (
                  <option value="done">{L('Selesai', 'Done')}</option>
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                {L('Prioritas', 'Priority')}
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full px-2.5 py-2 rounded-xl bg-zinc-950 border border-white/10 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="low">{L('Rendah', 'Low')}</option>
                <option value="medium">{L('Sedang', 'Medium')}</option>
                <option value="high">{L('Tinggi', 'High')}</option>
                <option value="urgent">{L('Mendesak', 'Urgent')}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                {L('Penanggung Jawab', 'Assignee')}
              </label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full px-2.5 py-2 rounded-xl bg-zinc-950 border border-white/10 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="">{L('Belum ditugaskan', 'Unassigned')}</option>
                {workspace.members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    @{m.username}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              {L(
                'Feature Branch (otomatis jika kosong)',
                'Feature Branch (auto-generated if blank)',
              )}
            </label>
            <input
              type="text"
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              placeholder="feat/oauth-callback"
              className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-white/10 text-xs font-mono text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-medium hover:bg-zinc-700 cursor-pointer"
            >
              {L('Batal', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold disabled:opacity-50 cursor-pointer"
            >
              {saving ? L('Membuat...', 'Creating...') : L('Buat Tugas', 'Create Task')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
