import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  GitBranch,
  Kanban,
  Monitor,
  Plus,
  Rocket,
  Search,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import type { Task } from '../../shared/types.ts';
import { useLanguage } from '../lib/i18nContext.ts';

export type PaletteTab = 'board' | 'gatekeeper' | 'deployments' | 'live' | 'manage';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  tasks: Task[];
  onNavigate: (tab: PaletteTab) => void;
  onSelectTask: (task: Task) => void;
  onNewTask: () => void;
}

interface PaletteItem {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  run: () => void;
}

export function CommandPalette({
  open,
  onClose,
  tasks,
  onNavigate,
  onSelectTask,
  onNewTask,
}: CommandPaletteProps) {
  const { L } = useLanguage();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const items = useMemo<PaletteItem[]>(() => {
    const statusLabel = (status: Task['status']) => {
      if (status === 'in_progress') return L('sedang dikerjakan', 'in progress');
      if (status === 'in_review') return L('dalam review', 'in review');
      if (status === 'done') return L('selesai', 'done');
      return L('akan dikerjakan', 'todo');
    };

    const base: PaletteItem[] = [
      {
        id: 'nav-board',
        group: L('Navigasi', 'Navigation'),
        label: L('Buka Papan Kanban', 'Go to Kanban Board'),
        hint: 'G B',
        icon: <Kanban className="w-4 h-4 text-indigo-400" />,
        run: () => onNavigate('board'),
      },
      {
        id: 'nav-gatekeeper',
        group: L('Navigasi', 'Navigation'),
        label: L('Buka Gatekeeper & Webhook', 'Go to Gatekeeper & Webhooks'),
        hint: 'G G',
        icon: <ShieldCheck className="w-4 h-4 text-violet-400" />,
        run: () => onNavigate('gatekeeper'),
      },
      {
        id: 'nav-deployments',
        group: L('Navigasi', 'Navigation'),
        label: L('Buka Deployment Vercel', 'Go to Vercel Deployments'),
        hint: 'G D',
        icon: <Rocket className="w-4 h-4 text-amber-400" />,
        run: () => onNavigate('deployments'),
      },
      {
        id: 'nav-live',
        group: L('Navigasi', 'Navigation'),
        label: L('Buka Monitor Layar Langsung (WebRTC)', 'Go to Live Screen Monitor (WebRTC)'),
        hint: 'G L',
        icon: <Monitor className="w-4 h-4 text-cyan-400" />,
        run: () => onNavigate('live'),
      },
      {
        id: 'nav-manage',
        group: L('Navigasi', 'Navigation'),
        label: L('Kelola Tim, Undangan & Repository', 'Manage Team, Invitations & Repository'),
        hint: 'G T',
        icon: <SlidersHorizontal className="w-4 h-4 text-zinc-300" />,
        run: () => onNavigate('manage'),
      },
      {
        id: 'act-new-task',
        group: L('Aksi', 'Actions'),
        label: L('Buat Tugas Kanban Baru', 'Create New Kanban Task'),
        hint: 'C',
        icon: <Plus className="w-4 h-4 text-emerald-400" />,
        run: () => onNewTask(),
      },
    ];

    const taskItems: PaletteItem[] = tasks.map((task) => ({
      id: `task-${task.id}`,
      group: L('Tugas', 'Tasks'),
      label: `#${task.taskCode} — ${task.title}`,
      hint: task.branchName || statusLabel(task.status),
      icon: <GitBranch className="w-4 h-4 text-cyan-400" />,
      run: () => onSelectTask(task),
    }));

    const all = [...base, ...taskItems];
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        (item.hint || '').toLowerCase().includes(q) ||
        item.group.toLowerCase().includes(q),
    );
  }, [L, onNavigate, onNewTask, onSelectTask, query, tasks]);

  const safeSelected =
    items.length === 0 ? 0 : Math.min(selectedIndex, items.length - 1);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (items.length ? (prev + 1) % items.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          items.length ? (prev - 1 + items.length) % items.length : 0,
        );
      } else if (e.key === 'Enter' && items[safeSelected]) {
        e.preventDefault();
        items[safeSelected].run();
        onClose();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [items, onClose, open, safeSelected]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[14vh] px-4 bg-black/75 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl bg-[#0e1017] border border-white/15 shadow-2xl shadow-black/80 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/10">
          <Search className="w-4 h-4 text-zinc-400 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder={L(
              'Ketik perintah atau cari #CP-01, branch, tampilan...',
              'Type a command or search #CP-01, branch, view...',
            )}
            className="w-full bg-transparent text-sm text-white placeholder:text-zinc-500 focus:outline-none"
          />
          <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-white/10 text-[10px] font-mono text-zinc-400">
            ESC
          </kbd>
        </div>

        <div className="max-h-[360px] overflow-y-auto p-2 space-y-1">
          {items.length === 0 ? (
            <div className="py-10 text-center text-xs text-zinc-500">
              {L('Tidak ada perintah atau tugas yang cocok.', 'No matching commands or tasks found.')}
            </div>
          ) : (
            items.map((item, idx) => {
              const active = idx === safeSelected;
              return (
                <button
                  key={item.id}
                  type="button"
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onClick={() => {
                    item.run();
                    onClose();
                  }}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left transition cursor-pointer ${
                    active
                      ? 'bg-indigo-600/20 border border-indigo-500/35 text-white'
                      : 'border border-transparent text-zinc-300 hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="shrink-0">{item.icon}</span>
                    <div className="min-w-0">
                      <div className="text-xs font-medium truncate">{item.label}</div>
                      <div className="text-[10px] text-zinc-500">{item.group}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {item.hint && (
                      <span className="px-2 py-0.5 rounded bg-zinc-900 border border-white/8 text-[10px] font-mono text-zinc-400">
                        {item.hint}
                      </span>
                    )}
                    {active && <ArrowRight className="w-3.5 h-3.5 text-indigo-400" />}
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="px-4 py-2 border-t border-white/8 bg-zinc-950/60 flex items-center justify-between text-[11px] text-zinc-500">
          <span>{L('Navigasi dengan ↑ ↓ dan Enter', 'Navigate with ↑ ↓ and Enter')}</span>
          <span className="font-mono text-zinc-400">
            {L('Perintah CodePulse', 'CodePulse Command')}
          </span>
        </div>
      </div>
    </div>
  );
}

