import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  PublicUser,
  RTCIceServerConfig,
  RealtimeServerMessage,
} from '../../shared/types.ts';
import { useLanguage } from './i18nContext.ts';
import { realtimeClient } from './realtime.ts';

export interface VoiceParticipant {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  muted: boolean;
  speaking: boolean;
  connectionState: string;
  lastSeen: number;
}

export interface AudioInputDeviceOption {
  deviceId: string;
  label: string;
}

interface VoicePresencePayload {
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  muted?: boolean;
}

interface VoiceSdpPayload {
  offerId?: string;
  sdp: RTCSessionDescriptionInit;
}

interface UseTeamVoiceComsParams {
  workspaceId: string;
  currentUser: PublicUser;
  iceServers: RTCIceServerConfig[];
  onToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

interface AnalyserEntry {
  source: MediaStreamAudioSourceNode;
  analyser: AnalyserNode;
  data: Uint8Array<ArrayBuffer>;
  lastActiveAt: number;
}

export function useTeamVoiceComs({
  workspaceId,
  currentUser,
  iceServers,
  onToast,
}: UseTeamVoiceComsParams) {
  const { L } = useLanguage();

  const [voiceJoined, setVoiceJoined] = useState(false);
  const [joiningVoice, setJoiningVoice] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [localSpeaking, setLocalSpeaking] = useState(false);
  const [audioDevices, setAudioDevices] = useState<AudioInputDeviceOption[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [participants, setParticipants] = useState<Record<string, VoiceParticipant>>({});
  const [remoteAudioStreams, setRemoteAudioStreams] = useState<Record<string, MediaStream>>({});
  const [mutedPeerIds, setMutedPeerIds] = useState<Record<string, boolean>>({});

  const voiceJoinedRef = useRef(false);
  const micMutedRef = useRef(false);
  const localAudioRef = useRef<MediaStream | null>(null);
  const voicePeersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingIceRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const handledOfferIdsRef = useRef<Map<string, string>>(new Map());
  const participantsRef = useRef<Record<string, VoiceParticipant>>({});
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analysersRef = useRef<Map<string, AnalyserEntry>>(new Map());

  const ensureAudioContext = useCallback((): AudioContext | null => {
    if (typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new AudioCtx();
    }
    if (audioCtxRef.current.state === 'suspended') {
      void audioCtxRef.current.resume().catch(() => {});
    }
    return audioCtxRef.current;
  }, []);

  const detachAnalyser = useCallback((key: string) => {
    const existing = analysersRef.current.get(key);
    if (existing) {
      try {
        existing.source.disconnect();
        existing.analyser.disconnect();
      } catch {
        // Ignore disconnect errors
      }
      analysersRef.current.delete(key);
    }
  }, []);

  const attachAnalyser = useCallback(
    (key: string, stream: MediaStream) => {
      detachAnalyser(key);
      const ctx = ensureAudioContext();
      if (!ctx) return;
      try {
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.6;
        source.connect(analyser);
        const data = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
        analysersRef.current.set(key, {
          source,
          analyser,
          data,
          lastActiveAt: 0,
        });
      } catch {
        // Ignore audio analysis failures on unsupported streams
      }
    },
    [detachAnalyser, ensureAudioContext],
  );

  const closeVoicePeer = useCallback(
    (peerId: string) => {
      const pc = voicePeersRef.current.get(peerId);
      if (pc) {
        pc.onicecandidate = null;
        pc.ontrack = null;
        pc.onconnectionstatechange = null;
        pc.close();
        voicePeersRef.current.delete(peerId);
      }
      pendingIceRef.current.delete(peerId);
      handledOfferIdsRef.current.delete(peerId);
      detachAnalyser(peerId);
      setRemoteAudioStreams((prev) => {
        if (!prev[peerId]) return prev;
        const next = { ...prev };
        delete next[peerId];
        return next;
      });
    },
    [detachAnalyser],
  );

  const flushPendingIce = useCallback(async (peerId: string, pc: RTCPeerConnection) => {
    const queued = pendingIceRef.current.get(peerId);
    if (!queued || queued.length === 0) return;
    pendingIceRef.current.delete(peerId);
    for (const init of queued) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(init));
      } catch {
        // Ignore stale ICE candidates
      }
    }
  }, []);

  const buildVoicePeerConnection = useCallback(
    (peerId: string): RTCPeerConnection => {
      closeVoicePeer(peerId);
      const pc = new RTCPeerConnection({ iceServers });
      voicePeersRef.current.set(peerId, pc);

      const localStream = localAudioRef.current;
      if (localStream) {
        for (const track of localStream.getAudioTracks()) {
          pc.addTrack(track, localStream);
        }
      }

      pc.onicecandidate = (ev) => {
        if (!ev.candidate) return;
        realtimeClient.sendRtcSignal({
          workspaceId,
          fromUserId: currentUser.id,
          toUserId: peerId,
          signalType: 'voice-ice',
          payload: ev.candidate.toJSON(),
        });
      };

      pc.onconnectionstatechange = () => {
        const nextState = pc.connectionState;
        setParticipants((prev) => {
          const cur = prev[peerId];
          if (!cur) return prev;
          const updated = {
            ...prev,
            [peerId]: { ...cur, connectionState: nextState, lastSeen: Date.now() },
          };
          participantsRef.current = updated;
          return updated;
        });

        if (nextState === 'failed' || nextState === 'closed') {
          detachAnalyser(peerId);
        }
      };

      pc.ontrack = (ev) => {
        const stream = ev.streams[0] ?? new MediaStream([ev.track]);
        setRemoteAudioStreams((prev) => ({
          ...prev,
          [peerId]: stream,
        }));
        attachAnalyser(peerId, stream);
      };

      return pc;
    },
    [attachAnalyser, closeVoicePeer, currentUser.id, detachAnalyser, iceServers, workspaceId],
  );

  const createVoiceOffer = useCallback(
    async (peerId: string) => {
      if (!voiceJoinedRef.current || !localAudioRef.current) return;
      const existing = voicePeersRef.current.get(peerId);
      if (
        existing &&
        (existing.connectionState === 'connected' ||
          existing.connectionState === 'connecting' ||
          existing.signalingState === 'have-local-offer')
      ) {
        return;
      }

      const pc = buildVoicePeerConnection(peerId);
      const offer = await pc.createOffer({ offerToReceiveAudio: true });
      await pc.setLocalDescription(offer);

      const offerId = `${currentUser.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      realtimeClient.sendRtcSignal({
        workspaceId,
        fromUserId: currentUser.id,
        toUserId: peerId,
        signalType: 'voice-offer',
        payload: { offerId, sdp: offer } satisfies VoiceSdpPayload,
      });
    },
    [buildVoicePeerConnection, currentUser.id, workspaceId],
  );

  const sendPresence = useCallback(
    (toUserId: string, signalType: 'voice-join' | 'voice-presence' = 'voice-presence') => {
      realtimeClient.sendRtcSignal({
        workspaceId,
        fromUserId: currentUser.id,
        toUserId,
        signalType,
        payload: {
          username: currentUser.username,
          displayName: currentUser.displayName,
          avatarUrl: currentUser.avatarUrl,
          muted: micMutedRef.current,
        } satisfies VoicePresencePayload,
      });
    },
    [currentUser.avatarUrl, currentUser.displayName, currentUser.id, currentUser.username, workspaceId],
  );

  const upsertRemoteParticipant = useCallback(
    (peerId: string, info: VoicePresencePayload) => {
      setParticipants((prev) => {
        const existing = prev[peerId];
        const pc = voicePeersRef.current.get(peerId);
        const updated: Record<string, VoiceParticipant> = {
          ...prev,
          [peerId]: {
            userId: peerId,
            username: info.username || existing?.username || 'teammate',
            displayName: info.displayName || existing?.displayName || info.username || 'Teammate',
            avatarUrl: info.avatarUrl || existing?.avatarUrl || '',
            muted: typeof info.muted === 'boolean' ? info.muted : (existing?.muted ?? false),
            speaking: existing?.speaking ?? false,
            connectionState: pc?.connectionState || existing?.connectionState || 'idle',
            lastSeen: Date.now(),
          },
        };
        participantsRef.current = updated;
        return updated;
      });
    },
    [],
  );

  const removeRemoteParticipant = useCallback(
    (peerId: string) => {
      closeVoicePeer(peerId);
      setParticipants((prev) => {
        if (!prev[peerId]) return prev;
        const next = { ...prev };
        delete next[peerId];
        participantsRef.current = next;
        return next;
      });
    },
    [closeVoicePeer],
  );

  const refreshAudioDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputs = devices
        .filter((d) => d.kind === 'audioinput')
        .map((d, idx) => ({
          deviceId: d.deviceId,
          label: d.label || `${L('Mikrofon', 'Microphone')} ${idx + 1}`,
        }));
      setAudioDevices(inputs);
    } catch {
      // Ignore device enumeration errors
    }
  }, [L]);

  const leaveVoice = useCallback(
    (silent = false) => {
      const wasJoined = voiceJoinedRef.current;
      voiceJoinedRef.current = false;
      micMutedRef.current = false;
      setVoiceJoined(false);
      setMicMuted(false);
      setDeafened(false);
      setLocalSpeaking(false);

      detachAnalyser('local');
      if (localAudioRef.current) {
        for (const track of localAudioRef.current.getTracks()) {
          track.stop();
        }
        localAudioRef.current = null;
      }

      for (const peerId of Array.from(voicePeersRef.current.keys())) {
        closeVoicePeer(peerId);
      }
      pendingIceRef.current.clear();
      handledOfferIdsRef.current.clear();

      setParticipants((prev) => {
        const next: Record<string, VoiceParticipant> = {};
        for (const [id, p] of Object.entries(prev)) {
          next[id] = { ...p, speaking: false, connectionState: 'idle' };
        }
        participantsRef.current = next;
        return next;
      });

      if (wasJoined) {
        realtimeClient.sendRtcSignal({
          workspaceId,
          fromUserId: currentUser.id,
          toUserId: '*',
          signalType: 'voice-leave',
          payload: {},
        });
        if (!silent) {
          onToast(
            'info',
            L('Anda keluar dari ruang suara tim.', 'You left the team voice channel.'),
          );
        }
      }
    },
    [L, closeVoicePeer, currentUser.id, detachAnalyser, onToast, workspaceId],
  );

  const joinVoice = useCallback(async () => {
    if (voiceJoinedRef.current || joiningVoice) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      onToast(
        'error',
        L(
          'Mikrofon memerlukan browser modern melalui HTTPS atau localhost.',
          'Microphone requires a modern browser over HTTPS or localhost.',
        ),
      );
      return;
    }

    setJoiningVoice(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      const activeTrack = stream.getAudioTracks()[0];
      const activeSettings = activeTrack?.getSettings();
      if (activeSettings?.deviceId) {
        setSelectedDeviceId(activeSettings.deviceId);
      }

      localAudioRef.current = stream;
      voiceJoinedRef.current = true;
      micMutedRef.current = false;
      setVoiceJoined(true);
      setMicMuted(false);

      attachAnalyser('local', stream);
      void refreshAudioDevices();

      sendPresence('*', 'voice-join');

      // Initiate offers immediately for any teammate already in the channel whose userId sorts after ours
      for (const peerId of Object.keys(participantsRef.current)) {
        if (currentUser.id < peerId) {
          void createVoiceOffer(peerId);
        }
      }

      onToast(
        'success',
        L(
          'Terhubung ke Voice Coms tim — mikrofon aktif!',
          'Connected to Team Voice Coms — microphone live!',
        ),
      );
    } catch (err) {
      const name = err instanceof DOMException ? err.name : '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        onToast(
          'error',
          L(
            'Izin mikrofon ditolak browser. Aktifkan izin mikrofon di ikon gembok address bar lalu coba lagi.',
            'Microphone permission denied. Allow mic access from the browser address bar and try again.',
          ),
        );
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        onToast(
          'error',
          L(
            'Perangkat mikrofon tidak ditemukan di perangkat ini.',
            'No microphone device was found on this machine.',
          ),
        );
      } else {
        onToast(
          'error',
          err instanceof Error
            ? err.message
            : L('Gagal mengakses mikrofon.', 'Failed to access microphone.'),
        );
      }
    } finally {
      setJoiningVoice(false);
    }
  }, [
    L,
    attachAnalyser,
    createVoiceOffer,
    currentUser.id,
    joiningVoice,
    onToast,
    refreshAudioDevices,
    selectedDeviceId,
    sendPresence,
  ]);

  const toggleMute = useCallback(() => {
    const stream = localAudioRef.current;
    if (!stream || !voiceJoinedRef.current) return;
    const nextMuted = !micMutedRef.current;
    for (const track of stream.getAudioTracks()) {
      track.enabled = !nextMuted;
    }
    micMutedRef.current = nextMuted;
    setMicMuted(nextMuted);
    if (nextMuted) setLocalSpeaking(false);

    realtimeClient.sendRtcSignal({
      workspaceId,
      fromUserId: currentUser.id,
      toUserId: '*',
      signalType: 'voice-mute',
      payload: { muted: nextMuted },
    });
  }, [currentUser.id, workspaceId]);

  const toggleDeafen = useCallback(() => {
    setDeafened((prev) => !prev);
  }, []);

  const togglePeerMute = useCallback((peerId: string) => {
    setMutedPeerIds((prev) => ({
      ...prev,
      [peerId]: !prev[peerId],
    }));
  }, []);

  const switchMicDevice = useCallback(
    async (deviceId: string) => {
      setSelectedDeviceId(deviceId);
      if (!voiceJoinedRef.current || !navigator.mediaDevices?.getUserMedia) return;

      try {
        const nextStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: deviceId ? { exact: deviceId } : undefined,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });
        const newTrack = nextStream.getAudioTracks()[0];
        if (!newTrack) return;

        newTrack.enabled = !micMutedRef.current;

        for (const pc of voicePeersRef.current.values()) {
          const sender = pc.getSenders().find((s) => s.track?.kind === 'audio');
          if (sender) {
            await sender.replaceTrack(newTrack);
          }
        }

        if (localAudioRef.current) {
          for (const oldTrack of localAudioRef.current.getTracks()) {
            oldTrack.stop();
          }
        }
        localAudioRef.current = nextStream;
        attachAnalyser('local', nextStream);
        onToast('info', L('Perangkat mikrofon diganti.', 'Microphone input switched.'));
      } catch {
        onToast(
          'error',
          L('Gagal mengganti perangkat mikrofon.', 'Failed to switch microphone device.'),
        );
      }
    },
    [L, attachAnalyser, onToast],
  );

  // Subscribe to voice WebRTC signaling messages
  useEffect(() => {
    const unsubscribe = realtimeClient.subscribe((msg: RealtimeServerMessage) => {
      if (msg.type !== 'rtc:signal' || msg.workspaceId !== workspaceId) return;
      if (msg.fromUserId === currentUser.id) return;
      if (msg.toUserId !== '*' && msg.toUserId !== currentUser.id) return;

      const peerId = msg.fromUserId;

      if (msg.signalType === 'voice-probe') {
        if (voiceJoinedRef.current) {
          sendPresence(peerId, 'voice-presence');
        }
        return;
      }

      if (msg.signalType === 'voice-join') {
        const info = (msg.payload || {}) as VoicePresencePayload;
        upsertRemoteParticipant(peerId, info);
        if (voiceJoinedRef.current) {
          sendPresence(peerId, 'voice-presence');
          if (currentUser.id < peerId) {
            void createVoiceOffer(peerId);
          }
        }
        return;
      }

      if (msg.signalType === 'voice-presence') {
        const info = (msg.payload || {}) as VoicePresencePayload;
        upsertRemoteParticipant(peerId, info);
        if (voiceJoinedRef.current && currentUser.id < peerId && !voicePeersRef.current.has(peerId)) {
          void createVoiceOffer(peerId);
        }
        return;
      }

      if (msg.signalType === 'voice-leave') {
        removeRemoteParticipant(peerId);
        return;
      }

      if (msg.signalType === 'voice-mute') {
        const muted = Boolean((msg.payload as { muted?: boolean } | null)?.muted);
        setParticipants((prev) => {
          const cur = prev[peerId];
          if (!cur) return prev;
          const updated = {
            ...prev,
            [peerId]: {
              ...cur,
              muted,
              speaking: muted ? false : cur.speaking,
              lastSeen: Date.now(),
            },
          };
          participantsRef.current = updated;
          return updated;
        });
        return;
      }

      if (msg.signalType === 'voice-offer') {
        if (!voiceJoinedRef.current || !localAudioRef.current) return;
        const payload = msg.payload as VoiceSdpPayload | null;
        if (!payload?.sdp) return;

        // Deduplicate offer if delivered by both local WebSocket and Supabase Broadcast
        if (payload.offerId && handledOfferIdsRef.current.get(peerId) === payload.offerId) {
          return;
        }

        void (async () => {
          try {
            const pc = buildVoicePeerConnection(peerId);
            if (payload.offerId) {
              handledOfferIdsRef.current.set(peerId, payload.offerId);
            }
            await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
            await flushPendingIce(peerId, pc);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            realtimeClient.sendRtcSignal({
              workspaceId,
              fromUserId: currentUser.id,
              toUserId: peerId,
              signalType: 'voice-answer',
              payload: { offerId: payload.offerId, sdp: answer } satisfies VoiceSdpPayload,
            });
          } catch {
            // Ignore transient glare / teardown errors
          }
        })();
        return;
      }

      if (msg.signalType === 'voice-answer') {
        const payload = msg.payload as VoiceSdpPayload | null;
        if (!payload?.sdp) return;
        const pc = voicePeersRef.current.get(peerId);
        if (!pc || pc.signalingState !== 'have-local-offer') return;

        void (async () => {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
            await flushPendingIce(peerId, pc);
          } catch {
            // Ignore duplicate answer
          }
        })();
        return;
      }

      if (msg.signalType === 'voice-ice') {
        const candidateInit = msg.payload as RTCIceCandidateInit | null;
        if (!candidateInit) return;
        const pc = voicePeersRef.current.get(peerId);
        if (pc && pc.remoteDescription) {
          void pc.addIceCandidate(new RTCIceCandidate(candidateInit)).catch(() => {});
        } else {
          const list = pendingIceRef.current.get(peerId) || [];
          list.push(candidateInit);
          pendingIceRef.current.set(peerId, list);
        }
      }
    });

    return unsubscribe;
  }, [
    buildVoicePeerConnection,
    createVoiceOffer,
    currentUser.id,
    flushPendingIce,
    removeRemoteParticipant,
    sendPresence,
    upsertRemoteParticipant,
    workspaceId,
  ]);

  // Probe existing voice participants on mount & whenever realtime transport finishes connecting
  useEffect(() => {
    const sendProbe = () => {
      if (voiceJoinedRef.current) {
        sendPresence('*', 'voice-presence');
      } else {
        realtimeClient.sendRtcSignal({
          workspaceId,
          fromUserId: currentUser.id,
          toUserId: '*',
          signalType: 'voice-probe',
          payload: {},
        });
      }
    };

    sendProbe();
    const unsubStatus = realtimeClient.onStatusChange((status) => {
      if (status === 'connected') {
        sendProbe();
      }
    });
    return unsubStatus;
  }, [currentUser.id, sendPresence, workspaceId]);

  // Heartbeat presence (every 15s) & prune stale disconnected participants (>45s)
  useEffect(() => {
    const timer = setInterval(() => {
      if (voiceJoinedRef.current) {
        sendPresence('*', 'voice-presence');
      }
      const now = Date.now();
      const staleIds: string[] = [];
      for (const [id, p] of Object.entries(participantsRef.current)) {
        const pc = voicePeersRef.current.get(id);
        const connected = pc?.connectionState === 'connected';
        if (!connected && now - p.lastSeen > 45_000) {
          staleIds.push(id);
        }
      }
      if (staleIds.length > 0) {
        for (const id of staleIds) {
          removeRemoteParticipant(id);
        }
      }
    }, 15_000);
    return () => clearInterval(timer);
  }, [removeRemoteParticipant, sendPresence]);

  // Real-time speaking activity detector (Web Audio API RMS meter)
  useEffect(() => {
    const interval = setInterval(() => {
      if (analysersRef.current.size === 0) return;
      const now = Date.now();
      const speakingThreshold = 14; // Empirically smooth threshold for voice vs ambient noise
      const holdMs = 320;

      // Local mic speaking
      const localEntry = analysersRef.current.get('local');
      if (localEntry && voiceJoinedRef.current && !micMutedRef.current) {
        localEntry.analyser.getByteFrequencyData(localEntry.data);
        let sum = 0;
        for (let i = 0; i < localEntry.data.length; i++) sum += localEntry.data[i];
        const avg = sum / localEntry.data.length;
        if (avg >= speakingThreshold) localEntry.lastActiveAt = now;
        const isSpeaking = now - localEntry.lastActiveAt < holdMs;
        setLocalSpeaking((prev) => (prev === isSpeaking ? prev : isSpeaking));
      } else {
        setLocalSpeaking((prev) => (prev ? false : prev));
      }

      // Remote peers speaking
      let anyChanged = false;
      const updates: Record<string, boolean> = {};
      for (const [key, entry] of analysersRef.current.entries()) {
        if (key === 'local') continue;
        const p = participantsRef.current[key];
        if (!p) continue;
        entry.analyser.getByteFrequencyData(entry.data);
        let sum = 0;
        for (let i = 0; i < entry.data.length; i++) sum += entry.data[i];
        const avg = sum / entry.data.length;
        if (avg >= speakingThreshold && !p.muted) entry.lastActiveAt = now;
        const isSpeaking = !p.muted && now - entry.lastActiveAt < holdMs;
        if (p.speaking !== isSpeaking) {
          updates[key] = isSpeaking;
          anyChanged = true;
        }
      }

      if (anyChanged) {
        setParticipants((prev) => {
          const next = { ...prev };
          for (const [id, speaking] of Object.entries(updates)) {
            if (next[id]) {
              next[id] = { ...next[id], speaking };
            }
          }
          participantsRef.current = next;
          return next;
        });
      }
    }, 120);

    return () => clearInterval(interval);
  }, []);

  // Broadcast voice-leave on page unload & cleanup on unmount / workspace change
  useEffect(() => {
    const handleUnload = () => {
      if (voiceJoinedRef.current) {
        realtimeClient.sendRtcSignal({
          workspaceId,
          fromUserId: currentUser.id,
          toUserId: '*',
          signalType: 'voice-leave',
          payload: {},
        });
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      leaveVoice(true);
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        void audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
    };
  }, [currentUser.id, leaveVoice, workspaceId]);

  const remoteParticipants = Object.values(participants);

  return {
    voiceJoined,
    joiningVoice,
    micMuted,
    deafened,
    localSpeaking,
    audioDevices,
    selectedDeviceId,
    remoteParticipants,
    remoteAudioStreams,
    mutedPeerIds,
    joinVoice,
    leaveVoice,
    toggleMute,
    toggleDeafen,
    togglePeerMute,
    switchMicDevice,
  };
}

