import { useState } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '../lib/i18nContext.ts';

export interface DailyPulsePoint {
  dateKey: string;
  label: string;
  events: number;
  deployments: number;
  tasks: number;
}

export interface DonutSegment {
  id: string;
  label: string;
  value: number;
  color: string;
  tailwindDot: string;
  subtitle?: string;
}

export function MiniSparkline({
  values,
  color = '#22d3ee',
  height = 28,
}: {
  values: number[];
  color?: string;
  height?: number;
}) {
  const safeValues = values.length >= 2 ? values : [0, ...values, 0];
  const width = 76;
  const max = Math.max(...safeValues, 1);
  const stepX = width / Math.max(safeValues.length - 1, 1);

  const points = safeValues.map((v, idx) => ({
    x: idx * stepX,
    y: height - 4 - (v / max) * (height - 8),
  }));

  const pathD = points
    .map((p, idx) => (idx === 0 ? `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}` : `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`))
    .join(' ');

  const areaD = `${pathD} L ${width} ${height} L 0 ${height} Z`;
  const gradId = `spark-${color.replace(/[^a-z0-9]/gi, '')}-${values.length}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-16 sm:w-20 h-7 overflow-visible shrink-0"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.32" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#${gradId})`} />
      <motion.path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0.4 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
      />
      <circle
        cx={points[points.length - 1].x}
        cy={points[points.length - 1].y}
        r="2.4"
        fill={color}
      />
    </svg>
  );
}

function buildSmoothPath(coords: Array<{ x: number; y: number }>): string {
  if (coords.length === 0) return '';
  if (coords.length === 1) return `M ${coords[0].x} ${coords[0].y}`;
  let d = `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i];
    const p1 = coords[i + 1];
    const cx = (p0.x + p1.x) / 2;
    d += ` C ${cx.toFixed(1)} ${p0.y.toFixed(1)}, ${cx.toFixed(1)} ${p1.y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
  }
  return d;
}

export function SevenDayPulseChart({ data }: { data: DailyPulsePoint[] }) {
  const { L } = useLanguage();
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [visibleSeries, setVisibleSeries] = useState({
    tasks: true,
    events: true,
    deployments: true,
  });

  const width = 620;
  const height = 220;
  const padLeft = 34;
  const padRight = 18;
  const padTop = 18;
  const padBottom = 30;
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;

  const maxVal = Math.max(
    4,
    ...data.map((d) =>
      Math.max(
        visibleSeries.tasks ? d.tasks : 0,
        visibleSeries.events ? d.events : 0,
        visibleSeries.deployments ? d.deployments : 0,
      ),
    ),
  );
  const yCeiling = Math.ceil(maxVal / 2) * 2;
  const yTicks = [0, Math.round(yCeiling / 2), yCeiling];

  const count = Math.max(data.length, 1);
  const xFor = (idx: number) =>
    count === 1 ? padLeft + innerW / 2 : padLeft + (idx / (count - 1)) * innerW;
  const yFor = (val: number) => padTop + innerH - (val / Math.max(yCeiling, 1)) * innerH;

  const eventPoints = data.map((d, idx) => ({ x: xFor(idx), y: yFor(d.events) }));
  const taskPoints = data.map((d, idx) => ({ x: xFor(idx), y: yFor(d.tasks) }));

  const eventLine = buildSmoothPath(eventPoints);
  const eventArea =
    eventPoints.length > 0
      ? `${eventLine} L ${eventPoints[eventPoints.length - 1].x.toFixed(1)} ${(padTop + innerH).toFixed(1)} L ${eventPoints[0].x.toFixed(1)} ${(padTop + innerH).toFixed(1)} Z`
      : '';

  const taskLine = buildSmoothPath(taskPoints);
  const taskArea =
    taskPoints.length > 0
      ? `${taskLine} L ${taskPoints[taskPoints.length - 1].x.toFixed(1)} ${(padTop + innerH).toFixed(1)} L ${taskPoints[0].x.toFixed(1)} ${(padTop + innerH).toFixed(1)} Z`
      : '';

  const activePoint = hoveredIdx !== null ? data[hoveredIdx] : null;
  const totalTasks = data.reduce((sum, d) => sum + d.tasks, 0);
  const totalEvents = data.reduce((sum, d) => sum + d.events, 0);
  const totalDeploys = data.reduce((sum, d) => sum + d.deployments, 0);

  return (
    <div className="space-y-4">
      {/* Interactive Legend / Series Toggles */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setVisibleSeries((s) => ({ ...s, tasks: !s.tasks }))}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition cursor-pointer ${
              visibleSeries.tasks
                ? 'bg-emerald-500/12 border-emerald-500/30 text-emerald-200'
                : 'bg-zinc-950 border-white/8 text-zinc-500'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>{L(`Tugas (${totalTasks})`, `Tasks (${totalTasks})`)}</span>
          </button>

          <button
            type="button"
            onClick={() => setVisibleSeries((s) => ({ ...s, events: !s.events }))}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition cursor-pointer ${
              visibleSeries.events
                ? 'bg-cyan-500/12 border-cyan-500/30 text-cyan-200'
                : 'bg-zinc-950 border-white/8 text-zinc-500'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <span>{L(`Webhook & Sinkronisasi (${totalEvents})`, `Webhook & Sync (${totalEvents})`)}</span>
          </button>

          <button
            type="button"
            onClick={() => setVisibleSeries((s) => ({ ...s, deployments: !s.deployments }))}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition cursor-pointer ${
              visibleSeries.deployments
                ? 'bg-indigo-500/15 border-indigo-500/35 text-indigo-200'
                : 'bg-zinc-950 border-white/8 text-zinc-500'
            }`}
          >
            <span className="w-2 h-2 rounded-sm bg-indigo-400" />
            <span>{L(`Deployment (${totalDeploys})`, `Deployments (${totalDeploys})`)}</span>
          </button>
        </div>

        <div className="font-mono text-[11px] text-zinc-400 min-h-[20px]">
          {activePoint ? (
            <span className="inline-flex items-center gap-2.5 px-2.5 py-0.5 rounded-md bg-zinc-950 border border-white/10 text-zinc-200">
              <strong className="text-white">{activePoint.label}</strong>
              <span className="text-emerald-300">
                {activePoint.tasks} {L('tugas', 'tasks')}
              </span>
              <span className="text-cyan-300">
                {activePoint.events} {L('event', 'events')}
              </span>
              <span className="text-indigo-300">
                {activePoint.deployments} {L('deploy', 'deploys')}
              </span>
            </span>
          ) : (
            <span>
              {L(
                'Arahkan kursor ke grafik untuk melihat metrik harian',
                'Hover chart to inspect daily metrics',
              )}
            </span>
          )}
        </div>
      </div>

      {/* Responsive SVG Canvas */}
      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto min-w-[360px] select-none"
          onMouseLeave={() => setHoveredIdx(null)}
        >
          <defs>
            <linearGradient id="cpPulseCyan" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.01" />
            </linearGradient>
            <linearGradient id="cpPulseEmerald" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#34d399" stopOpacity="0.01" />
            </linearGradient>
            <linearGradient id="cpPulseBar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#818cf8" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0.25" />
            </linearGradient>
          </defs>

          {/* Horizontal Grid Lines & Y-Axis Ticks */}
          {yTicks.map((tick) => {
            const y = yFor(tick);
            return (
              <g key={tick}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="rgba(255,255,255,0.06)"
                  strokeDasharray={tick === 0 ? undefined : '4 4'}
                />
                <text
                  x={padLeft - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  fill="#71717a"
                  fontSize="10"
                  fontFamily="ui-monospace, monospace"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          {/* Deployment Bars */}
          {visibleSeries.deployments &&
            data.map((d, idx) => {
              const barW = 16;
              const x = xFor(idx) - barW / 2;
              const y = yFor(d.deployments);
              const h = Math.max(0, padTop + innerH - y);
              return (
                <motion.rect
                  key={`bar-${d.dateKey}`}
                  x={x}
                  width={barW}
                  rx="4"
                  fill="url(#cpPulseBar)"
                  initial={{ y: padTop + innerH, height: 0 }}
                  animate={{ y, height: h }}
                  transition={{ duration: 0.45, delay: idx * 0.04, ease: 'easeOut' }}
                  opacity={hoveredIdx === null || hoveredIdx === idx ? 0.9 : 0.35}
                />
              );
            })}

          {/* Task Area & Line */}
          {visibleSeries.tasks && taskPoints.length > 0 && (
            <>
              <path d={taskArea} fill="url(#cpPulseEmerald)" />
              <motion.path
                d={taskLine}
                fill="none"
                stroke="#34d399"
                strokeWidth="2.2"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.75, ease: 'easeOut' }}
              />
            </>
          )}

          {/* Events Area & Line */}
          {visibleSeries.events && eventPoints.length > 0 && (
            <>
              <path d={eventArea} fill="url(#cpPulseCyan)" />
              <motion.path
                d={eventLine}
                fill="none"
                stroke="#22d3ee"
                strokeWidth="2.2"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.85, ease: 'easeOut' }}
              />
            </>
          )}

          {/* Hover Vertical Crosshair & Active Dots */}
          {hoveredIdx !== null && data[hoveredIdx] && (
            <g>
              <line
                x1={xFor(hoveredIdx)}
                y1={padTop}
                x2={xFor(hoveredIdx)}
                y2={padTop + innerH}
                stroke="rgba(255,255,255,0.22)"
                strokeDasharray="3 3"
              />
              {visibleSeries.tasks && (
                <circle
                  cx={taskPoints[hoveredIdx].x}
                  cy={taskPoints[hoveredIdx].y}
                  r="4.5"
                  fill="#34d399"
                  stroke="#0b0c12"
                  strokeWidth="2"
                />
              )}
              {visibleSeries.events && (
                <circle
                  cx={eventPoints[hoveredIdx].x}
                  cy={eventPoints[hoveredIdx].y}
                  r="4.5"
                  fill="#22d3ee"
                  stroke="#0b0c12"
                  strokeWidth="2"
                />
              )}
            </g>
          )}

          {/* X-Axis Labels & Invisible Hit Targets */}
          {data.map((d, idx) => {
            const cx = xFor(idx);
            const sliceW = innerW / Math.max(data.length - 1, 1);
            return (
              <g key={`x-${d.dateKey}`}>
                <text
                  x={cx}
                  y={height - 8}
                  textAnchor="middle"
                  fill={hoveredIdx === idx ? '#f4f4f5' : '#71717a'}
                  fontSize="10"
                  fontFamily="ui-monospace, monospace"
                >
                  {d.label}
                </text>
                <rect
                  x={Math.max(padLeft - 10, cx - sliceW / 2)}
                  y={padTop}
                  width={sliceW}
                  height={innerH + 22}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredIdx(idx)}
                />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

export function InteractiveDonutChart({
  segments,
  centerLabel,
  emptyText,
}: {
  segments: DonutSegment[];
  centerLabel: string;
  emptyText?: string;
}) {
  const { L } = useLanguage();
  const resolvedEmptyText = emptyText ?? L('Belum ada data', 'No records yet');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  const size = 152;
  const strokeWidth = 17;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const activeSegment = segments.find((s) => s.id === hoveredId) || null;
  const activePct =
    activeSegment && total > 0 ? Math.round((activeSegment.value / total) * 100) : null;
  const arcs = segments.reduce<
    Array<DonutSegment & { length: number; dashOffset: number }>
  >((acc, seg) => {
    const used = acc.reduce((sum, item) => sum + item.length, 0);
    const length = total > 0 ? (seg.value / total) * circumference : 0;
    acc.push({
      ...seg,
      length,
      dashOffset: -used,
    });
    return acc;
  }, []);

  return (
    <div className="flex flex-col items-center justify-center gap-4 w-full min-w-0">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={strokeWidth}
          />
          {total > 0 &&
            arcs.map((seg) => {
              if (seg.value <= 0) return null;
              const isHovered = hoveredId === seg.id;
              return (
                <motion.circle
                  key={seg.id}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={isHovered ? strokeWidth + 3 : strokeWidth}
                  strokeLinecap="butt"
                  strokeDasharray={`${Math.max(seg.length - 1.5, 0)} ${circumference}`}
                  strokeDashoffset={seg.dashOffset}
                  initial={{ opacity: 0 }}
                  animate={{
                    opacity: hoveredId === null || isHovered ? 1 : 0.35,
                  }}
                  transition={{ duration: 0.3 }}
                  className="cursor-pointer transition-all"
                  onMouseEnter={() => setHoveredId(seg.id)}
                  onMouseLeave={() => setHoveredId(null)}
                />
              );
            })}
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-5">
          <span className="text-2xl font-bold font-mono text-white tabular-nums leading-none">
            {activeSegment ? activeSegment.value : total}
          </span>
          {activeSegment ? (
            <>
              <span className="text-[11px] font-mono text-indigo-300 mt-1 tabular-nums">
                {activePct}%
              </span>
              <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-400 truncate max-w-[96px]">
                {activeSegment.label}
              </span>
            </>
          ) : (
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 mt-1 truncate max-w-[96px]">
              {centerLabel}
            </span>
          )}
        </div>
      </div>

      {/* Interactive Breakdown Legend */}
      <div className="w-full min-w-0 space-y-1.5">
        {total === 0 ? (
          <div className="text-xs text-zinc-500 text-center py-2">{resolvedEmptyText}</div>
        ) : (
          segments.map((seg) => {
            const pct = total > 0 ? Math.round((seg.value / total) * 100) : 0;
            const isHovered = hoveredId === seg.id;
            return (
              <div
                key={seg.id}
                onMouseEnter={() => setHoveredId(seg.id)}
                onMouseLeave={() => setHoveredId(null)}
                className={`px-3 py-1.5 rounded-lg flex items-center justify-between gap-2 text-xs transition cursor-pointer min-w-0 ${
                  isHovered
                    ? 'bg-white/[0.07] border border-white/10'
                    : 'bg-zinc-950/75 border border-transparent hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${seg.tailwindDot}`} />
                  <span className="text-zinc-200 truncate">{seg.label}</span>
                </div>
                <div className="flex items-center gap-2 font-mono text-[11px] shrink-0">
                  <span className="text-white font-semibold tabular-nums">{seg.value}</span>
                  <span className="text-zinc-500 w-8 text-right tabular-nums">{pct}%</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export function RadialScoreGauge({
  score,
  label,
  sublabel,
}: {
  score: number;
  label: string;
  sublabel: string;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const size = 98;
  const strokeWidth = 9;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (clamped / 100) * circumference;

  const strokeColor =
    clamped >= 75 ? '#34d399' : clamped >= 50 ? '#22d3ee' : '#f59e0b';

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: dashOffset }}
          transition={{ duration: 0.85, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-xl font-bold font-mono text-white tabular-nums">{clamped}%</span>
        <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-400">
          {label}
        </span>
        <span className="text-[9px] text-zinc-500">{sublabel}</span>
      </div>
    </div>
  );
}

