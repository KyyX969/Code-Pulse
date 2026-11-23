import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  Gauge,
  Maximize2,
  Minimize2,
  Monitor,
  MonitorOff,
  Radio,
  ShieldCheck,
  Users,
  Wifi,
} from 'lucide-react';
import type {
  LiveSession,
  PublicUser,
  RTCIceServerConfig,
  RealtimeServerMessage,
  Task,
  Workspace,
} from '../../shared/types.ts';
import { api } from '../lib/api.ts';
import { useLanguage } from '../lib/i18nContext.ts';
import { realtimeClient } from '../lib/realtime.ts';

type StreamPresetId = 'smooth_60' | 'crisp_30' | 'saver_720';

interface StreamPreset {
  id: StreamPresetId;
  label: string;
  shortLabel: string;
  width: number;
  height: number;
  fps: number;
  maxBitrate: number;
  contentHint: 'detail' | 'motion';
  degradationPreference: 'maintain-resolution' | 'balanced';
}

const STREAM_PRESETS: Record<StreamPresetId, StreamPreset> = {
  smooth_60: {
    id: 'smooth_60',
    label: '1080p · 60 FPS (Ultra Smooth)',
    shortLabel: '60 FPS Smooth',
    width: 1920,
    height: 1080,
    fps: 60,
    maxBitrate: 6_000_000,
    contentHint: 'motion',
    degradationPreference: 'balanced',
  },
  crisp_30: {
    id: 'crisp_30',
    label: '1080p · 30 FPS (Crisp Code)',
    shortLabel: '30 FPS Crisp',
    width: 1920,
    height: 1080,
    fps: 30,
    maxBitrate: 3_000_000,
    contentHint: 'detail',
    degradationPreference: 'maintain-resolution',
  },
  saver_720: {
    id: 'saver_720',
    label: '720p · 30 FPS (Low Bandwidth)',
    shortLabel: '720p Saver',
    width: 1280,
    height: 720,
    fps: 30,
    maxBitrate: 1_500_000,
    contentHint: 'detail',
    degradationPreference: 'maintain-resolution',
  },
};

async function applySenderEncodingPreset(
  sender: RTCRtpSender,
  preset: StreamPreset,
): Promise<void> {
  if (sender.track?.kind !== 'video') return;
  try {
    const params = sender.getParameters();
    if (!params.encodings || params.encodings.length === 0) {
      params.encodings = [{}];
    }
    params.encodings[0] = {
      ...params.encodings[0],
      maxBitrate: preset.maxBitrate,
      maxFramerate: preset.fps,
    };
    params.degradationPreference = preset.degradationPreference;
    await sender.setParameters(params);
  } catch {
    // Some browsers disallow certain parameter fields depending on codec/state
  }
}

interface LiveMonitorPanelProps {
  workspace: Workspace;
  tasks: Task[];
  sessions: LiveSession[];
  currentUser: PublicUser;
  iceServers: RTCIceServerConfig[];
  onSessionsChange: (sessions: LiveSession[]) => void;
  onToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

interface RemoteStreamEntry {
  userId: string;
  stream: MediaStream;
  fps: number | null;
  kbps: number | null;
  connectionState: string;
}

export function LiveMonitorPanel({
  workspace,
  tasks,
  sessions,
  currentUser,
  iceServers,
  onSessionsChange,
  onToast,
}: LiveMonitorPanelProps) {
  const { L } = useLanguage();
  const [selectedTaskCode, setSelectedTaskCode] = useState<string>(
    tasks.find((t) => t.status === 'in_progress')?.taskCode || tasks[0]?.taskCode || '',
  );
  const [presetId, setPresetId] = useState<StreamPresetId>('smooth_60');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [localMetrics, setLocalMetrics] = useState<{ fps?: number; resolution?: string }>({});
  const [remoteStreams, setRemoteStreams] = useState<Record<string, RemoteStreamEntry>>({});
  const [focusedUserId, setFocusedUserId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const localStreamRef = useRef<MediaStream | null>(null);
  const presetRef = useRef<StreamPreset>(STREAM_PRESETS.smooth_60);
  const broadcasterPeersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const viewerPeersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const prevBytesRef = useRef<Map<string, { bytes: number; ts: number }>>(new Map());

  const activePreset = STREAM_PRESETS[presetId];

  function getPresetLabels(id: StreamPresetId): { label: string; shortLabel: string } {
    switch (id) {
      case 'smooth_60':
        return {
          label: L('1080p · 60 FPS (Sangat Halus)', '1080p · 60 FPS (Ultra Smooth)'),
          shortLabel: L('60 FPS Halus', '60 FPS Smooth'),
        };
      case 'crisp_30':
        return {
          label: L('1080p · 30 FPS (Kode Tajam)', '1080p · 30 FPS (Crisp Code)'),
          shortLabel: L('30 FPS Tajam', '30 FPS Crisp'),
        };
      case 'saver_720':
        return {
          label: L('720p · 30 FPS (Hemat Bandwidth)', '720p · 30 FPS (Low Bandwidth)'),
          shortLabel: L('720p Hemat', '720p Saver'),
        };
    }
  }

  const cleanupPeerMaps = useCallback(() => {
    for (const pc of broadcasterPeersRef.current.values()) pc.close();
    broadcasterPeersRef.current.clear();
  }, []);

  const stopBroadcast = useCallback(async () => {
    if (localStreamRef.current) {
      for (const track of localStreamRef.current.getTracks()) {
        track.stop();
      }
      localStreamRef.current = null;
    }
    setLocalStream(null);
    setLocalMetrics({});
    cleanupPeerMaps();
    try {
      const { sessions: updated } = await api.stopLiveSession(workspace.id);
      onSessionsChange(updated);
    } catch {
      // Ignore cleanup errors
    }
  }, [cleanupPeerMaps, onSessionsChange, workspace.id]);

  // Clean up on unmount
  useEffect(() => {
    const broadcasterPeers = broadcasterPeersRef.current;
    const viewerPeers = viewerPeersRef.current;
    return () => {
      if (localStreamRef.current) {
        for (const track of localStreamRef.current.getTracks()) {
          track.stop();
        }
      }
      for (const pc of broadcasterPeers.values()) pc.close();
      for (const pc of viewerPeers.values()) pc.close();
    };
  }, []);

  const createBroadcasterOffer = useCallback(
    async (viewerUserId: string) => {
      const stream = localStreamRef.current;
      if (!stream) return;

      const existing = broadcasterPeersRef.current.get(viewerUserId);
      if (existing) existing.close();

      const pc = new RTCPeerConnection({ iceServers });
      broadcasterPeersRef.current.set(viewerUserId, pc);

      for (const track of stream.getTracks()) {
        const sender = pc.addTrack(track, stream);
        if (track.kind === 'video') {
          await applySenderEncodingPreset(sender, presetRef.current);
        }
      }

      pc.onicecandidate = (ev) => {
        if (ev.candidate) {
          realtimeClient.sendRtcSignal({
            workspaceId: workspace.id,
            fromUserId: currentUser.id,
            toUserId: viewerUserId,
            signalType: 'ice-candidate',
            payload: ev.candidate.toJSON(),
          });
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      realtimeClient.sendRtcSignal({
        workspaceId: workspace.id,
        fromUserId: currentUser.id,
        toUserId: viewerUserId,
        signalType: 'offer',
        payload: offer,
      });
    },
    [currentUser.id, iceServers, workspace.id],
  );

  // Listen for WebRTC signaling messages over WebSocket / Supabase Realtime
  useEffect(() => {
    const unsubscribe = realtimeClient.subscribe((msg: RealtimeServerMessage) => {
      if (msg.type !== 'rtc:signal' || msg.workspaceId !== workspace.id) return;
      if (msg.fromUserId === currentUser.id) return;
      if (msg.toUserId !== '*' && msg.toUserId !== currentUser.id) return;

      const peerUserId = msg.fromUserId;

      if (msg.signalType === 'viewer-join') {
        if (localStreamRef.current) {
          void createBroadcasterOffer(peerUserId);
        }
        return;
      }

      if (msg.signalType === 'broadcaster-ready') {
        realtimeClient.sendRtcSignal({
          workspaceId: workspace.id,
          fromUserId: currentUser.id,
          toUserId: peerUserId,
          signalType: 'viewer-join',
          payload: {},
        });
        return;
      }

      if (msg.signalType === 'offer') {
        void (async () => {
          const existing = viewerPeersRef.current.get(peerUserId);
          if (existing) existing.close();

          const pc = new RTCPeerConnection({ iceServers });
          viewerPeersRef.current.set(peerUserId, pc);

          pc.onicecandidate = (ev) => {
            if (ev.candidate) {
              realtimeClient.sendRtcSignal({
                workspaceId: workspace.id,
                fromUserId: currentUser.id,
                toUserId: peerUserId,
                signalType: 'ice-candidate',
                payload: ev.candidate.toJSON(),
              });
            }
          };

          pc.onconnectionstatechange = () => {
            setRemoteStreams((prev) => {
              const cur = prev[peerUserId];
              if (!cur) return prev;
              return {
                ...prev,
                [peerUserId]: { ...cur, connectionState: pc.connectionState },
              };
            });
          };

          pc.ontrack = (ev) => {
            const stream = ev.streams[0];
            if (!stream) return;
            setRemoteStreams((prev) => ({
              ...prev,
              [peerUserId]: {
                userId: peerUserId,
                stream,
                fps: prev[peerUserId]?.fps ?? null,
                kbps: prev[peerUserId]?.kbps ?? null,
                connectionState: pc.connectionState,
              },
            }));
          };

          await pc.setRemoteDescription(
            new RTCSessionDescription(msg.payload as RTCSessionDescriptionInit),
          );
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          realtimeClient.sendRtcSignal({
            workspaceId: workspace.id,
            fromUserId: currentUser.id,
            toUserId: peerUserId,
            signalType: 'answer',
            payload: answer,
          });
        })();
        return;
      }

      if (msg.signalType === 'answer') {
        const pc = broadcasterPeersRef.current.get(peerUserId);
        if (pc) {
          void pc.setRemoteDescription(
            new RTCSessionDescription(msg.payload as RTCSessionDescriptionInit),
          );
        }
        return;
      }

      if (msg.signalType === 'ice-candidate') {
        const candidate = new RTCIceCandidate(msg.payload as RTCIceCandidateInit);
        const bp = broadcasterPeersRef.current.get(peerUserId);
        if (bp) void bp.addIceCandidate(candidate).catch(() => {});
        const vp = viewerPeersRef.current.get(peerUserId);
        if (vp) void vp.addIceCandidate(candidate).catch(() => {});
      }
    });

    return unsubscribe;
  }, [createBroadcasterOffer, currentUser.id, iceServers, workspace.id]);

  // Request WebRTC streams for active remote broadcasters
  useEffect(() => {
    const activeRemoteIds = new Set(
      sessions.filter((s) => s.userId !== currentUser.id).map((s) => s.userId),
    );

    for (const remoteId of activeRemoteIds) {
      if (!viewerPeersRef.current.has(remoteId)) {
        realtimeClient.sendRtcSignal({
          workspaceId: workspace.id,
          fromUserId: currentUser.id,
          toUserId: remoteId,
          signalType: 'viewer-join',
          payload: {},
        });
      }
    }

    for (const [uid, pc] of viewerPeersRef.current.entries()) {
      if (!activeRemoteIds.has(uid)) {
        pc.close();
        viewerPeersRef.current.delete(uid);
        setRemoteStreams((prev) => {
          const copy = { ...prev };
          delete copy[uid];
          return copy;
        });
      }
    }
  }, [sessions, currentUser.id, workspace.id]);

  // Poll WebRTC getStats() for live FPS & bitrate telemetry
  useEffect(() => {
    const interval = setInterval(async () => {
      for (const [broadcasterId, pc] of viewerPeersRef.current.entries()) {
        try {
          const stats = await pc.getStats();
          let fps: number | null = null;
          let kbps: number | null = null;

          stats.forEach((report) => {
            if (report.type === 'inbound-rtp' && report.kind === 'video') {
              if (typeof report.framesPerSecond === 'number') {
                fps = Math.round(report.framesPerSecond);
              }
              if (typeof report.bytesReceived === 'number') {
                const now = Date.now();
                const prev = prevBytesRef.current.get(broadcasterId);
                if (prev && now > prev.ts) {
                  kbps = Math.round(
                    ((report.bytesReceived - prev.bytes) * 8) / (now - prev.ts),
                  );
                }
                prevBytesRef.current.set(broadcasterId, {
                  bytes: report.bytesReceived,
                  ts: now,
                });
              }
            }
          });

          setRemoteStreams((prev) => {
            const cur = prev[broadcasterId];
            if (!cur) return prev;
            return {
              ...prev,
              [broadcasterId]: {
                ...cur,
                fps: fps ?? cur.fps,
                kbps: kbps ?? cur.kbps,
                connectionState: pc.connectionState,
              },
            };
          });
        } catch {
          // ignore stats errors
        }
      }
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  async function handlePresetChange(nextId: StreamPresetId) {
    const nextPreset = STREAM_PRESETS[nextId];
    const nextLabels = getPresetLabels(nextId);
    setPresetId(nextId);
    presetRef.current = nextPreset;

    const stream = localStreamRef.current;
    if (!stream) return;

    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) return;

    try {
      if ('contentHint' in videoTrack) {
        videoTrack.contentHint = nextPreset.contentHint;
      }
      await videoTrack.applyConstraints({
        frameRate: { ideal: nextPreset.fps, max: nextPreset.fps },
        width: { ideal: nextPreset.width },
        height: { ideal: nextPreset.height },
      });

      for (const pc of broadcasterPeersRef.current.values()) {
        for (const sender of pc.getSenders()) {
          await applySenderEncodingPreset(sender, nextPreset);
        }
      }

      const settings = videoTrack.getSettings();
      const fps = settings.frameRate ? Math.round(settings.frameRate) : nextPreset.fps;
      const resolution =
        settings.width && settings.height ? `${settings.width}x${settings.height}` : `${nextPreset.width}x${nextPreset.height}`;

      setLocalMetrics({ fps, resolution });
      const { sessions: updated } = await api.startLiveSession(workspace.id, {
        activeTaskCode: selectedTaskCode || null,
        streamLabel: videoTrack.label || 'IDE Window',
        fps,
        resolution,
      });
      onSessionsChange(updated);
      onToast(
        'info',
        L(
          `Kualitas stream diperbarui ke ${nextLabels.label}.`,
          `Stream quality updated to ${nextLabels.label}.`,
        ),
      );
    } catch {
      onToast(
        'info',
        L(
          `Preset kualitas disimpan (${nextLabels.shortLabel}); akan berlaku pada frame/sesi berikutnya.`,
          `Quality preset saved (${nextLabels.shortLabel}); will apply on next frame/session.`,
        ),
      );
    }
  }

  async function handleStartLiveSession() {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      onToast(
        'error',
        L(
          'Berbagi layar memerlukan browser modern melalui HTTPS atau localhost.',
          'Screen sharing requires a modern browser over HTTPS or localhost.',
        ),
      );
      return;
    }

    const preset = STREAM_PRESETS[presetId];
    const presetLabels = getPresetLabels(presetId);
    presetRef.current = preset;

    setStarting(true);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: { ideal: preset.fps, max: preset.fps },
          width: { ideal: preset.width },
          height: { ideal: preset.height },
        },
        audio: false,
      });

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack && 'contentHint' in videoTrack) {
        videoTrack.contentHint = preset.contentHint;
      }
      const settings = videoTrack?.getSettings();
      const fps = settings?.frameRate ? Math.round(settings.frameRate) : preset.fps;
      const resolution =
        settings?.width && settings?.height
          ? `${settings.width}x${settings.height}`
          : `${preset.width}x${preset.height}`;

      videoTrack?.addEventListener('ended', () => {
        void stopBroadcast();
      });

      localStreamRef.current = stream;
      setLocalStream(stream);
      setLocalMetrics({ fps, resolution });

      const { sessions: updated } = await api.startLiveSession(workspace.id, {
        activeTaskCode: selectedTaskCode || null,
        streamLabel: videoTrack?.label || 'IDE Window',
        fps,
        resolution,
      });
      onSessionsChange(updated);

      realtimeClient.sendRtcSignal({
        workspaceId: workspace.id,
        fromUserId: currentUser.id,
        toUserId: '*',
        signalType: 'broadcaster-ready',
        payload: { fps, resolution },
      });

      onToast(
        'success',
        L(
          `Sesi IDE langsung dimulai pada ${resolution} · ${fps} FPS (${presetLabels.shortLabel})!`,
          `Live IDE session started at ${resolution} · ${fps} FPS (${presetLabels.shortLabel})!`,
        ),
      );
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : L('Izin tangkapan layar ditolak', 'Screen capture permission declined');
      onToast(
        'info',
        L(`Berbagi layar dibatalkan: ${msg}`, `Screen share cancelled: ${msg}`),
      );
    } finally {
      setStarting(false);
    }
  }

  const remoteSessions = sessions.filter((s) => s.userId !== currentUser.id);
  const activePresetLabels = getPresetLabels(presetId);

  return (
    <div className="space-y-6">
      {/* Studio Control Banner */}
      <div className="cp-panel rounded-2xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[11px] font-semibold">
              <Radio className="w-3 h-3 animate-pulse" />
              {L('MONITOR LAYAR WEBRTC P2P', 'WEBRTC P2P SCREEN MONITOR')}
            </span>
            <span className="text-xs font-mono text-zinc-400 tabular-nums">
              {sessions.length}{' '}
              {L('stream aktif', sessions.length === 1 ? 'active stream' : 'active streams')}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-md">
              <ShieldCheck className="w-3 h-3" />
              {L('Sementara • Tanpa Rekaman Cloud', 'Ephemeral • No Cloud Recording')}
            </span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            {L(
              'Grid Kolaborasi IDE Langsung (Hingga 60 FPS)',
              'Live IDE Collaboration Grid (Up to 60 FPS)',
            )}
          </h2>
          <p className="text-xs text-zinc-400">
            {L(
              'Bagikan jendela Antigravity / VS Code Anda langsung dari Chrome melalui ',
              'Share your Antigravity / VS Code window straight from Chrome via ',
            )}
            <code>getDisplayMedia</code>
            {L(
              ' — mendukung mode halus 60 FPS atau mode teks tajam 30 FPS.',
              ' — supports 60 FPS smooth mode or crisp 30 FPS text mode.',
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-950 border border-white/10">
            <Gauge className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <select
              value={presetId}
              onChange={(e) => void handlePresetChange(e.target.value as StreamPresetId)}
              aria-label={L('Preset kualitas stream', 'Stream quality preset')}
              className="bg-transparent text-xs text-zinc-200 focus:outline-none cursor-pointer pr-1"
            >
              {(Object.values(STREAM_PRESETS) as StreamPreset[]).map((p) => (
                <option key={p.id} value={p.id} className="bg-zinc-950 text-zinc-100">
                  {getPresetLabels(p.id).label}
                </option>
              ))}
            </select>
          </div>

          <select
            value={selectedTaskCode}
            onChange={(e) => setSelectedTaskCode(e.target.value)}
            disabled={Boolean(localStream)}
            className="px-3 py-2.5 rounded-xl bg-zinc-950 border border-white/10 text-xs text-zinc-200 focus:outline-none focus:border-cyan-500 disabled:opacity-50"
          >
            <option value="">{L('Tanpa tugas tertaut', 'No linked task')}</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.taskCode}>
                #{t.taskCode} — {t.title.slice(0, 30)}
              </option>
            ))}
          </select>

          {!localStream ? (
            <button
              type="button"
              disabled={starting}
              onClick={handleStartLiveSession}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-500 hover:from-cyan-400 hover:to-sky-400 text-zinc-950 text-xs font-bold shadow-lg shadow-cyan-950/50 transition cursor-pointer disabled:opacity-50"
            >
              <Monitor className="w-4 h-4" />
              <span>
                {starting
                  ? L('Meminta Layar...', 'Requesting Screen...')
                  : L('Mulai Sesi Langsung', 'Start Live Session')}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void stopBroadcast()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg transition cursor-pointer"
            >
              <MonitorOff className="w-4 h-4" />
              <span>{L('Hentikan Berbagi', 'Stop Sharing')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Live WebRTC Info Bar */}
      <div className="px-4 py-3 rounded-xl bg-indigo-500/10 border border-indigo-500/25 flex items-center gap-2.5 text-xs text-indigo-200">
        <Users className="w-4 h-4 text-indigo-400 shrink-0" />
        <span>
          <strong>{L('Berbagi IDE Peer-to-Peer:', 'Peer-to-Peer IDE Sharing:')}</strong>{' '}
          {L('Klik ', 'Click ')}
          <strong>{L('Mulai Sesi Langsung', 'Start Live Session')}</strong>{' '}
          {L(
            'untuk menyiarkan jendela IDE Anda ke rekan satu workspace secara real-time melalui Chrome WebRTC.',
            'to broadcast your IDE window to workspace teammates in real time via Chrome WebRTC.',
          )}
        </span>
      </div>

      {/* Live Video Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {localStream && (
          <div className="cp-panel rounded-2xl border-cyan-500/45 overflow-hidden shadow-2xl">
            <div className="px-4 py-2.5 bg-zinc-950/90 border-b border-white/10 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-mono text-[10px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                  LIVE
                </span>
                <span className="text-xs font-semibold text-white truncate">
                  {L('Anda', 'You')} (@{currentUser.username})
                </span>
                {selectedTaskCode && (
                  <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono text-[11px]">
                    #{selectedTaskCode}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 font-mono text-[11px] text-cyan-300 shrink-0 tabular-nums">
                <span>{localMetrics.resolution || 'HD'}</span>
                <span>•</span>
                <span>{localMetrics.fps || activePreset.fps} FPS</span>
                <span className="hidden sm:inline px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-[10px]">
                  {activePresetLabels.shortLabel}
                </span>
              </div>
            </div>
            <div className="aspect-video bg-black relative">
              <StreamVideo stream={localStream} muted />
            </div>
          </div>
        )}

        {remoteSessions.map((session) => {
          const entry = remoteStreams[session.userId];
          const isFocused = focusedUserId === session.userId;

          return (
            <div
              key={session.id}
              className={`cp-panel rounded-2xl overflow-hidden shadow-2xl ${
                isFocused ? 'md:col-span-2 border-indigo-400/50' : ''
              }`}
            >
              <div className="px-4 py-2.5 bg-zinc-950/90 border-b border-white/10 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <img
                    src={session.avatarUrl}
                    alt={session.username}
                    className="w-5 h-5 rounded-full ring-1 ring-white/15"
                  />
                  <span className="text-xs font-semibold text-white truncate">
                    @{session.username}
                  </span>
                  {session.activeTaskCode && (
                    <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono text-[11px]">
                      #{session.activeTaskCode}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-300 tabular-nums">
                    <Wifi className="w-3 h-3" />
                    {entry?.fps ? `${entry.fps} FPS` : `${session.fps || 30} FPS`}
                    {entry?.kbps ? ` • ${entry.kbps} kbps` : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setFocusedUserId(isFocused ? null : session.userId)
                    }
                    className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer"
                    title={
                      isFocused
                        ? L('Keluar dari fokus', 'Exit spotlight')
                        : L('Fokuskan stream', 'Spotlight stream')
                    }
                  >
                    {isFocused ? (
                      <Minimize2 className="w-3.5 h-3.5" />
                    ) : (
                      <Maximize2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="aspect-video bg-zinc-950 relative flex items-center justify-center">
                {entry?.stream ? (
                  <StreamVideo stream={entry.stream} muted />
                ) : (
                  <div className="text-center space-y-2.5 p-6">
                    <Activity className="w-6 h-6 text-cyan-400 animate-pulse mx-auto" />
                    <div className="text-xs text-zinc-300">
                      {L(
                        `Menegosiasikan koneksi WebRTC P2P dengan @${session.username}...`,
                        `Negotiating WebRTC P2P connection with @${session.username}...`,
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        realtimeClient.sendRtcSignal({
                          workspaceId: workspace.id,
                          fromUserId: currentUser.id,
                          toUserId: session.userId,
                          signalType: 'viewer-join',
                          payload: {},
                        })
                      }
                      className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 cursor-pointer"
                    >
                      {L('Ulangi Handshake', 'Retry Handshake')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {!localStream && remoteSessions.length === 0 && (
          <div className="md:col-span-2 rounded-2xl border border-dashed border-white/12 bg-zinc-900/35 p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-white/10 flex items-center justify-center mx-auto">
              <Monitor className="w-6 h-6 text-cyan-400" />
            </div>
            <div className="text-sm font-semibold text-zinc-200">
              {L(
                `Belum ada sesi berbagi layar IDE aktif di ${workspace.name}`,
                `No active IDE screen shares in ${workspace.name}`,
              )}
            </div>
            <p className="text-xs text-zinc-500 max-w-md mx-auto leading-relaxed">
              {L('Anggota tim dapat mengklik ', 'Team members can click ')}
              <strong>{L('Mulai Sesi Langsung', 'Start Live Session')}</strong>{' '}
              {L(
                'untuk menayangkan jendela IDE mereka langsung ke Ketua Proyek melalui WebRTC Peer-to-Peer terenkripsi.',
                'to stream their IDE window directly to the Project Leader via encrypted WebRTC Peer-to-Peer.',
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function StreamVideo({ stream, muted }: { stream: MediaStream; muted?: boolean }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.srcObject = stream;
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={muted}
      className="w-full h-full object-contain bg-black"
    />
  );
}
