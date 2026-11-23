import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  PublicUser,
  RTCIceServerConfig,
  RealtimeServerMessage,
} from '../../shared/types.ts';
import { useLanguage } from './i18nContext.ts';
import { realtimeClient } from './realtime.ts';

export type VoiceMode = 'off' | 'mic' | 'listen';
export type VoiceTransportMode = 'connecting' | 'p2p' | 'relay' | 'failed' | 'idle';

export interface VoiceParticipant {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  muted: boolean;
  listenOnly: boolean;
  speaking: boolean;
  connectionState: string;
  transport: VoiceTransportMode;
  joinedAt: number;
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
  listenOnly?: boolean;
}

interface VoiceSdpPayload {
  offerId?: string;
  sdp: RTCSessionDescriptionInit;
}

interface VoiceAudioChunkPayload {
  sr: number;
  b64: string;
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

// --- Lightweight ITU-T G.711 u-law codec (zero deps) for firewall/NAT relay fallback ---
const RELAY_SAMPLE_RATE = 12000;
const MULAW_BIAS = 0x84;
const MULAW_CLIP = 32635;

function linearToMuLaw(sample: number): number {
  let pcm = Math.max(-1, Math.min(1, sample)) * 32767;
  let sign = 0;
  if (pcm < 0) {
    sign = 0x80;
    pcm = -pcm;
  }
  if (pcm > MULAW_CLIP) pcm = MULAW_CLIP;
  pcm += MULAW_BIAS;

  let exponent = 7;
  for (let expMask = 0x4000; (pcm & expMask) === 0 && exponent > 0; exponent--, expMask >>= 1) {
    // find highest bit
  }
  const mantissa = (pcm >> (exponent + 3)) & 0x0f;
  return ~(sign | (exponent << 4) | mantissa) & 0xff;
}

function muLawToLinear(uVal: number): number {
  const inverted = ~uVal & 0xff;
  const sign = inverted & 0x80;
  const exponent = (inverted >> 4) & 0x07;
  const mantissa = inverted & 0x0f;
  let t = ((mantissa << 3) + MULAW_BIAS) << exponent;
  t -= MULAW_BIAS;
  const pcm = sign ? -t : t;
  return pcm / 32768;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

export function useTeamVoiceComs({
  workspaceId,
  currentUser,
  iceServers,
  onToast,
}: UseTeamVoiceComsParams) {
  const { L } = useLanguage();

  const [voiceMode, setVoiceMode] = useState<VoiceMode>('off');
  const [joiningVoice, setJoiningVoice] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [micTestActive, setMicTestActive] = useState(false);
  const [localSpeaking, setLocalSpeaking] = useState(false);
  const [localLevel, setLocalLevel] = useState(0);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [audioDevices, setAudioDevices] = useState<AudioInputDeviceOption[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [participants, setParticipants] = useState<Record<string, VoiceParticipant>>({});
  const [remoteAudioStreams, setRemoteAudioStreams] = useState<Record<string, MediaStream>>({});
  const [mutedPeerIds, setMutedPeerIds] = useState<Record<string, boolean>>({});

  const voiceModeRef = useRef<VoiceMode>('off');
  const micMutedRef = useRef(false);
  const deafenedRef = useRef(false);
  const mutedPeerIdsRef = useRef<Record<string, boolean>>({});
  const localAudioRef = useRef<MediaStream | null>(null);
  const voicePeersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingIceRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const handledOfferIdsRef = useRef<Map<string, string>>(new Map());
  const retryCountsRef = useRef<Map<string, number>>(new Map());
  const participantsRef = useRef<Record<string, VoiceParticipant>>({});
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analysersRef = useRef<Map<string, AnalyserEntry>>(new Map());
  const loopbackNodeRef = useRef<{ source: MediaStreamAudioSourceNode; gain: GainNode } | null>(
    null,
  );
  const relayCaptureRef = useRef<{
    source: MediaStreamAudioSourceNode;
    processor: ScriptProcessorNode;
    muteGain: GainNode;
    lastVoiceAt: number;
  } | null>(null);
  const relayNextPlayTimeRef = useRef<Map<string, number>>(new Map());
  const relaySpeakingTimerRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

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

  const stopMicLoopback = useCallback(() => {
    if (loopbackNodeRef.current) {
      try {
        loopbackNodeRef.current.source.disconnect();
        loopbackNodeRef.current.gain.disconnect();
      } catch {
        // ignore
      }
      loopbackNodeRef.current = null;
    }
    setMicTestActive(false);
  }, []);

  const stopRelayCapture = useCallback(() => {
    if (relayCaptureRef.current) {
      try {
        relayCaptureRef.current.processor.onaudioprocess = null;
        relayCaptureRef.current.source.disconnect();
        relayCaptureRef.current.processor.disconnect();
        relayCaptureRef.current.muteGain.disconnect();
      } catch {
        // ignore
      }
      relayCaptureRef.current = null;
    }
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
        analyser.smoothingTimeConstant = 0.55;
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

  const syncRelayCapture = useCallback(() => {
    const shouldRelay =
      voiceModeRef.current === 'mic' &&
      Boolean(localAudioRef.current) &&
      Object.values(participantsRef.current).some((p) => p.transport === 'relay');

    if (!shouldRelay) {
      stopRelayCapture();
      return;
    }

    if (relayCaptureRef.current || !localAudioRef.current) return;
    const ctx = ensureAudioContext();
    if (!ctx) return;

    try {
      const source = ctx.createMediaStreamSource(localAudioRef.current);
      // 4096 frames @ 48kHz ~= 85ms; accumulate ~255ms chunks for smooth, low-rate relay
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      const muteGain = ctx.createGain();
      muteGain.gain.value = 0;

      const sampleRatio = ctx.sampleRate / RELAY_SAMPLE_RATE;
      let chunkBuf: number[] = [];
      let peakRms = 0;
      const targetChunkSamples = Math.round(RELAY_SAMPLE_RATE * 0.22); // ~220ms chunks

      const entry = {
        source,
        processor,
        muteGain,
        lastVoiceAt: 0,
      };
      relayCaptureRef.current = entry;

      processor.onaudioprocess = (ev) => {
        if (voiceModeRef.current !== 'mic' || micMutedRef.current) {
          chunkBuf = [];
          peakRms = 0;
          return;
        }

        const relayTargets = Object.values(participantsRef.current)
          .filter((p) => p.transport === 'relay')
          .map((p) => p.userId);
        if (relayTargets.length === 0) return;

        const input = ev.inputBuffer.getChannelData(0);
        let sqSum = 0;
        for (let i = 0; i < input.length; i++) {
          sqSum += input[i] * input[i];
        }
        const rms = Math.sqrt(sqSum / input.length);
        if (rms > peakRms) peakRms = rms;

        const outCount = Math.floor(input.length / sampleRatio);
        for (let i = 0; i < outCount; i++) {
          const start = Math.floor(i * sampleRatio);
          const end = Math.min(input.length, Math.floor((i + 1) * sampleRatio));
          let acc = 0;
          const count = Math.max(1, end - start);
          for (let j = start; j < end; j++) acc += input[j];
          chunkBuf.push(linearToMuLaw(acc / count));
        }

        if (chunkBuf.length >= targetChunkSamples) {
          const now = Date.now();
          if (peakRms >= 0.008) {
            entry.lastVoiceAt = now;
          }
          const isVoiceActive = now - entry.lastVoiceAt < 500;
          const bytes = new Uint8Array(chunkBuf);
          chunkBuf = [];
          peakRms = 0;

          if (!isVoiceActive) return;

          const b64 = bytesToBase64(bytes);
          for (const targetUserId of relayTargets) {
            realtimeClient.sendRtcSignal({
              workspaceId,
              fromUserId: currentUser.id,
              toUserId: targetUserId,
              signalType: 'voice-audio-chunk',
              payload: { sr: RELAY_SAMPLE_RATE, b64 } satisfies VoiceAudioChunkPayload,
            });
          }
        }
      };

      source.connect(processor);
      processor.connect(muteGain);
      muteGain.connect(ctx.destination);
    } catch {
      stopRelayCapture();
    }
  }, [currentUser.id, ensureAudioContext, stopRelayCapture, workspaceId]);

  const closeVoicePeer = useCallback(
    (peerId: string, keepPendingIce = false) => {
      const pc = voicePeersRef.current.get(peerId);
      if (pc) {
        pc.onicecandidate = null;
        pc.ontrack = null;
        pc.onconnectionstatechange = null;
        pc.oniceconnectionstatechange = null;
        pc.close();
        voicePeersRef.current.delete(peerId);
      }
      if (!keepPendingIce) {
        pendingIceRef.current.delete(peerId);
      }
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

  const updatePeerTransport = useCallback(
    (peerId: string, connectionState: string, transport: VoiceTransportMode) => {
      setParticipants((prev) => {
        const cur = prev[peerId];
        if (!cur) return prev;
        if (cur.connectionState === connectionState && cur.transport === transport) return prev;
        const updated = {
          ...prev,
          [peerId]: {
            ...cur,
            connectionState,
            transport,
            lastSeen: Date.now(),
          },
        };
        participantsRef.current = updated;
        return updated;
      });
    },
    [],
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
          muted: voiceModeRef.current === 'listen' ? true : micMutedRef.current,
          listenOnly: voiceModeRef.current === 'listen',
        } satisfies VoicePresencePayload,
      });
    },
    [currentUser.avatarUrl, currentUser.displayName, currentUser.id, currentUser.username, workspaceId],
  );

  const buildVoicePeerConnection = useCallback(
    (peerId: string): RTCPeerConnection => {
      // Preserve any early ICE candidates that arrived milliseconds before the SDP offer!
      closeVoicePeer(peerId, true);
      const pc = new RTCPeerConnection({ iceServers });
      voicePeersRef.current.set(peerId, pc);

      const localStream = localAudioRef.current;
      if (localStream && localStream.getAudioTracks().length > 0) {
        for (const track of localStream.getAudioTracks()) {
          pc.addTrack(track, localStream);
        }
      } else {
        // Listen-only mode: negotiate receive-only audio track cleanly
        pc.addTransceiver('audio', { direction: 'recvonly' });
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

      const handleStateChange = () => {
        const cState = pc.connectionState;
        const iState = pc.iceConnectionState;

        if (cState === 'connected' || iState === 'connected' || iState === 'completed') {
          retryCountsRef.current.set(peerId, 0);
          updatePeerTransport(peerId, 'connected', 'p2p');
          syncRelayCapture();
          return;
        }

        if (cState === 'failed' || iState === 'failed') {
          // Immediately fall back to Realtime Audio Relay so conversation stays uninterrupted!
          updatePeerTransport(peerId, 'failed', 'relay');
          syncRelayCapture();
          detachAnalyser(peerId);
          return;
        }

        if (cState === 'disconnected' || iState === 'disconnected') {
          const cur = participantsRef.current[peerId];
          updatePeerTransport(
            peerId,
            'disconnected',
            cur?.transport === 'relay' ? 'relay' : 'connecting',
          );
          return;
        }

        const cur = participantsRef.current[peerId];
        updatePeerTransport(
          peerId,
          cState || 'connecting',
          cur?.transport === 'relay' ? 'relay' : 'connecting',
        );
      };

      pc.onconnectionstatechange = handleStateChange;
      pc.oniceconnectionstatechange = handleStateChange;

      pc.ontrack = (ev) => {
        ev.track.enabled = true;
        const stream = ev.streams[0] ?? new MediaStream([ev.track]);
        setRemoteAudioStreams((prev) => ({
          ...prev,
          [peerId]: stream,
        }));
        attachAnalyser(peerId, stream);
      };

      return pc;
    },
    [
      attachAnalyser,
      closeVoicePeer,
      currentUser.id,
      detachAnalyser,
      iceServers,
      syncRelayCapture,
      updatePeerTransport,
      workspaceId,
    ],
  );

  const createVoiceOffer = useCallback(
    async (peerId: string, force = false) => {
      if (voiceModeRef.current === 'off') return;
      const existing = voicePeersRef.current.get(peerId);
      if (
        !force &&
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
        payload: {
          offerId,
          sdp: { type: offer.type, sdp: offer.sdp },
        } satisfies VoiceSdpPayload,
      });
    },
    [buildVoicePeerConnection, currentUser.id, workspaceId],
  );

  const upsertRemoteParticipant = useCallback((peerId: string, info: VoicePresencePayload) => {
    setParticipants((prev) => {
      const existing = prev[peerId];
      const pc = voicePeersRef.current.get(peerId);
      const pcState = pc?.connectionState || existing?.connectionState || 'idle';
      const transport: VoiceTransportMode =
        pcState === 'connected'
          ? 'p2p'
          : existing?.transport === 'relay'
            ? 'relay'
            : voiceModeRef.current !== 'off'
              ? 'connecting'
              : 'idle';

      const updated: Record<string, VoiceParticipant> = {
        ...prev,
        [peerId]: {
          userId: peerId,
          username: info.username || existing?.username || 'teammate',
          displayName: info.displayName || existing?.displayName || info.username || 'Teammate',
          avatarUrl: info.avatarUrl || existing?.avatarUrl || '',
          muted: typeof info.muted === 'boolean' ? info.muted : (existing?.muted ?? false),
          listenOnly:
            typeof info.listenOnly === 'boolean'
              ? info.listenOnly
              : (existing?.listenOnly ?? false),
          speaking: existing?.speaking ?? false,
          connectionState: pcState,
          transport,
          joinedAt: existing?.joinedAt ?? Date.now(),
          lastSeen: Date.now(),
        },
      };
      participantsRef.current = updated;
      return updated;
    });
  }, []);

  const removeRemoteParticipant = useCallback(
    (peerId: string) => {
      closeVoicePeer(peerId);
      retryCountsRef.current.delete(peerId);
      relayNextPlayTimeRef.current.delete(peerId);
      const timer = relaySpeakingTimerRef.current.get(peerId);
      if (timer) {
        clearTimeout(timer);
        relaySpeakingTimerRef.current.delete(peerId);
      }
      setParticipants((prev) => {
        if (!prev[peerId]) return prev;
        const next = { ...prev };
        delete next[peerId];
        participantsRef.current = next;
        return next;
      });
      syncRelayCapture();
    },
    [closeVoicePeer, syncRelayCapture],
  );

  const playRelayChunk = useCallback(
    (peerId: string, payload: VoiceAudioChunkPayload) => {
      if (voiceModeRef.current === 'off') return;
      if (deafenedRef.current || mutedPeerIdsRef.current[peerId]) return;
      // Avoid double audio if direct WebRTC P2P is already connected!
      const pc = voicePeersRef.current.get(peerId);
      if (pc && (pc.connectionState === 'connected' || pc.iceConnectionState === 'connected')) {
        return;
      }

      const ctx = ensureAudioContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        setAudioBlocked(true);
        return;
      }

      try {
        const bytes = base64ToBytes(payload.b64);
        if (bytes.length === 0) return;
        const sampleRate = payload.sr || RELAY_SAMPLE_RATE;
        const audioBuf = ctx.createBuffer(1, bytes.length, sampleRate);
        const channel = audioBuf.getChannelData(0);
        for (let i = 0; i < bytes.length; i++) {
          channel[i] = muLawToLinear(bytes[i]);
        }

        const source = ctx.createBufferSource();
        source.buffer = audioBuf;
        source.connect(ctx.destination);

        const now = ctx.currentTime;
        let startAt = relayNextPlayTimeRef.current.get(peerId) ?? now;
        if (startAt < now - 0.05 || startAt > now + 0.5) {
          startAt = now + 0.03;
        }
        source.start(startAt);
        relayNextPlayTimeRef.current.set(peerId, startAt + audioBuf.duration);

        // Mark peer as relay-active & speaking
        setParticipants((prev) => {
          const cur = prev[peerId];
          if (!cur) return prev;
          const updated = {
            ...prev,
            [peerId]: {
              ...cur,
              transport: 'relay' as const,
              speaking: true,
              lastSeen: Date.now(),
            },
          };
          participantsRef.current = updated;
          return updated;
        });

        const existingTimer = relaySpeakingTimerRef.current.get(peerId);
        if (existingTimer) clearTimeout(existingTimer);
        relaySpeakingTimerRef.current.set(
          peerId,
          setTimeout(() => {
            setParticipants((prev) => {
              const cur = prev[peerId];
              if (!cur || !cur.speaking) return prev;
              const updated = {
                ...prev,
                [peerId]: { ...cur, speaking: false },
              };
              participantsRef.current = updated;
              return updated;
            });
          }, 380),
        );
      } catch {
        // ignore malformed audio chunk
      }
    },
    [ensureAudioContext],
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
      const wasJoined = voiceModeRef.current !== 'off';
      voiceModeRef.current = 'off';
      micMutedRef.current = false;
      deafenedRef.current = false;
      setVoiceMode('off');
      setMicMuted(false);
      setDeafened(false);
      setLocalSpeaking(false);
      setLocalLevel(0);
      setAudioBlocked(false);

      stopMicLoopback();
      stopRelayCapture();
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
      retryCountsRef.current.clear();
      relayNextPlayTimeRef.current.clear();

      setParticipants((prev) => {
        const next: Record<string, VoiceParticipant> = {};
        for (const [id, p] of Object.entries(prev)) {
          next[id] = { ...p, speaking: false, connectionState: 'idle', transport: 'idle' };
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
    [
      L,
      closeVoicePeer,
      currentUser.id,
      detachAnalyser,
      onToast,
      stopMicLoopback,
      stopRelayCapture,
      workspaceId,
    ],
  );

  const joinVoice = useCallback(
    async (mode: 'mic' | 'listen' = 'mic') => {
      if (joiningVoice) return;
      if (voiceModeRef.current === mode) return;

      // Unlock AudioContext immediately inside click gesture!
      ensureAudioContext();
      setAudioBlocked(false);

      if (mode === 'listen') {
        stopMicLoopback();
        stopRelayCapture();
        detachAnalyser('local');
        if (localAudioRef.current) {
          for (const t of localAudioRef.current.getTracks()) t.stop();
          localAudioRef.current = null;
        }
        voiceModeRef.current = 'listen';
        micMutedRef.current = true;
        setVoiceMode('listen');
        setMicMuted(true);
        setLocalSpeaking(false);
        setLocalLevel(0);

        sendPresence('*', 'voice-join');
        for (const peerId of Object.keys(participantsRef.current)) {
          if (currentUser.id < peerId) {
            void createVoiceOffer(peerId, true);
          }
        }
        onToast(
          'success',
          L(
            'Bergabung dalam mode Dengar Saja — Anda dapat mendengar suara tim.',
            'Joined in Listen-Only mode — you can hear the team.',
          ),
        );
        return;
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        onToast(
          'error',
          L(
            'Mikrofon memerlukan browser modern melalui HTTPS atau localhost. Gunakan "Dengar Saja" jika hanya ingin mendengar.',
            'Microphone requires HTTPS or localhost. Use "Listen Only" if you only want to listen.',
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

        const wasListenOnly = voiceModeRef.current === 'listen';
        localAudioRef.current = stream;
        voiceModeRef.current = 'mic';
        micMutedRef.current = false;
        setVoiceMode('mic');
        setMicMuted(false);

        attachAnalyser('local', stream);
        void refreshAudioDevices();

        sendPresence('*', 'voice-join');

        // Initiate or upgrade offers for peers already in voice
        for (const peerId of Object.keys(participantsRef.current)) {
          if (currentUser.id < peerId || wasListenOnly) {
            void createVoiceOffer(peerId, wasListenOnly);
          }
        }

        syncRelayCapture();

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
              'Izin mikrofon ditolak browser. Aktifkan izin mic di address bar atau klik "Dengar Saja".',
              'Microphone permission denied. Allow mic in address bar or click "Listen Only".',
            ),
          );
        } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
          onToast(
            'error',
            L(
              'Mikrofon tidak terdeteksi di perangkat ini. Anda tetap bisa klik "Dengar Saja".',
              'No microphone detected on this device. You can still click "Listen Only".',
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
    },
    [
      L,
      attachAnalyser,
      createVoiceOffer,
      currentUser.id,
      detachAnalyser,
      ensureAudioContext,
      joiningVoice,
      onToast,
      refreshAudioDevices,
      selectedDeviceId,
      sendPresence,
      stopMicLoopback,
      stopRelayCapture,
      syncRelayCapture,
    ],
  );

  const toggleMute = useCallback(() => {
    if (voiceModeRef.current === 'listen') {
      void joinVoice('mic');
      return;
    }
    const stream = localAudioRef.current;
    if (!stream || voiceModeRef.current !== 'mic') return;
    const nextMuted = !micMutedRef.current;
    for (const track of stream.getAudioTracks()) {
      track.enabled = !nextMuted;
    }
    micMutedRef.current = nextMuted;
    setMicMuted(nextMuted);
    if (nextMuted) {
      setLocalSpeaking(false);
      setLocalLevel(0);
    }

    realtimeClient.sendRtcSignal({
      workspaceId,
      fromUserId: currentUser.id,
      toUserId: '*',
      signalType: 'voice-mute',
      payload: { muted: nextMuted },
    });
  }, [currentUser.id, joinVoice, workspaceId]);

  const toggleDeafen = useCallback(() => {
    setDeafened((prev) => {
      const next = !prev;
      deafenedRef.current = next;
      return next;
    });
  }, []);

  const togglePeerMute = useCallback((peerId: string) => {
    setMutedPeerIds((prev) => {
      const next = { ...prev, [peerId]: !prev[peerId] };
      mutedPeerIdsRef.current = next;
      return next;
    });
  }, []);

  const toggleMicTest = useCallback(() => {
    if (loopbackNodeRef.current) {
      stopMicLoopback();
      return;
    }
    const stream = localAudioRef.current;
    if (!stream || voiceModeRef.current !== 'mic') return;
    const ctx = ensureAudioContext();
    if (!ctx) return;
    try {
      const source = ctx.createMediaStreamSource(stream);
      const gain = ctx.createGain();
      gain.gain.value = 0.85;
      source.connect(gain);
      gain.connect(ctx.destination);
      loopbackNodeRef.current = { source, gain };
      setMicTestActive(true);
      onToast(
        'info',
        L(
          'Tes Mic aktif — bicaralah untuk mendengar suara mikrofon Anda sendiri.',
          'Mic Test active — speak to hear your own microphone playback.',
        ),
      );
    } catch {
      stopMicLoopback();
    }
  }, [L, ensureAudioContext, onToast, stopMicLoopback]);

  const unlockAudio = useCallback(() => {
    ensureAudioContext();
    setAudioBlocked(false);
    // Re-trigger playback on any mounted remote audio elements
    const audios = document.querySelectorAll<HTMLAudioElement>('audio[data-cp-voice-audio="true"]');
    audios.forEach((el) => {
      void el.play().catch(() => {});
    });
  }, [ensureAudioContext]);

  const reconnectPeer = useCallback(
    (peerId: string) => {
      if (voiceModeRef.current === 'off') return;
      ensureAudioContext();
      retryCountsRef.current.set(peerId, 0);
      updatePeerTransport(peerId, 'connecting', 'connecting');
      if (currentUser.id < peerId) {
        void createVoiceOffer(peerId, true);
      } else {
        // Ask the deterministic offerer to send a fresh offer
        sendPresence(peerId, 'voice-join');
      }
      onToast('info', L('Mencoba menghubungkan ulang audio...', 'Reconnecting audio stream...'));
    },
    [L, createVoiceOffer, currentUser.id, ensureAudioContext, onToast, sendPresence, updatePeerTransport],
  );

  const switchMicDevice = useCallback(
    async (deviceId: string) => {
      setSelectedDeviceId(deviceId);
      if (voiceModeRef.current !== 'mic' || !navigator.mediaDevices?.getUserMedia) return;

      const wasLoopback = Boolean(loopbackNodeRef.current);
      stopMicLoopback();
      stopRelayCapture();

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
        syncRelayCapture();
        if (wasLoopback) {
          toggleMicTest();
        }
        onToast('info', L('Perangkat mikrofon diganti.', 'Microphone input switched.'));
      } catch {
        onToast(
          'error',
          L('Gagal mengganti perangkat mikrofon.', 'Failed to switch microphone device.'),
        );
      }
    },
    [L, attachAnalyser, onToast, stopMicLoopback, stopRelayCapture, syncRelayCapture, toggleMicTest],
  );

  // Subscribe to voice WebRTC & relay signaling messages
  useEffect(() => {
    const unsubscribe = realtimeClient.subscribe((msg: RealtimeServerMessage) => {
      if (msg.type !== 'rtc:signal' || msg.workspaceId !== workspaceId) return;
      if (msg.fromUserId === currentUser.id) return;
      if (msg.toUserId !== '*' && msg.toUserId !== currentUser.id) return;

      const peerId = msg.fromUserId;

      if (msg.signalType === 'voice-audio-chunk') {
        const chunk = msg.payload as VoiceAudioChunkPayload | null;
        if (chunk?.b64) {
          playRelayChunk(peerId, chunk);
        }
        return;
      }

      if (msg.signalType === 'voice-probe') {
        if (voiceModeRef.current !== 'off') {
          sendPresence(peerId, 'voice-presence');
        }
        return;
      }

      if (msg.signalType === 'voice-join') {
        const info = (msg.payload || {}) as VoicePresencePayload;
        upsertRemoteParticipant(peerId, info);
        if (voiceModeRef.current !== 'off') {
          sendPresence(peerId, 'voice-presence');
          if (currentUser.id < peerId) {
            void createVoiceOffer(peerId, true);
          }
        }
        return;
      }

      if (msg.signalType === 'voice-presence') {
        const info = (msg.payload || {}) as VoicePresencePayload;
        upsertRemoteParticipant(peerId, info);
        if (voiceModeRef.current !== 'off' && currentUser.id < peerId) {
          const existing = voicePeersRef.current.get(peerId);
          if (!existing || existing.connectionState === 'failed' || existing.connectionState === 'closed') {
            void createVoiceOffer(peerId, false);
          }
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
        if (voiceModeRef.current === 'off') return;
        const payload = msg.payload as VoiceSdpPayload | null;
        if (!payload?.sdp) return;

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
              payload: {
                offerId: payload.offerId,
                sdp: { type: answer.type, sdp: answer.sdp },
              } satisfies VoiceSdpPayload,
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
    playRelayChunk,
    removeRemoteParticipant,
    sendPresence,
    upsertRemoteParticipant,
    workspaceId,
  ]);

  // Probe existing voice participants on mount & whenever realtime transport finishes connecting
  useEffect(() => {
    const sendProbe = () => {
      if (voiceModeRef.current !== 'off') {
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

  // Fast watchdog (every 3s): auto-promote peers stuck on connecting > 6s to Relay Fallback so audio NEVER stays silent behind strict NATs!
  useEffect(() => {
    const watchdog = setInterval(() => {
      if (voiceModeRef.current === 'off') return;
      const now = Date.now();
      let relayChanged = false;

      for (const [peerId, p] of Object.entries(participantsRef.current)) {
        const pc = voicePeersRef.current.get(peerId);
        const isP2pUp =
          pc && (pc.connectionState === 'connected' || pc.iceConnectionState === 'connected');

        if (isP2pUp) {
          if (p.transport !== 'p2p') {
            updatePeerTransport(peerId, 'connected', 'p2p');
            relayChanged = true;
          }
          continue;
        }

        // If still not connected via P2P after 5.5 seconds, activate Realtime Relay Fallback seamlessly
        if (p.transport !== 'relay' && now - p.joinedAt > 5_500) {
          updatePeerTransport(peerId, pc?.connectionState || 'connecting', 'relay');
          relayChanged = true;

          // Also schedule one quiet P2P retry for the offerer
          const retries = retryCountsRef.current.get(peerId) || 0;
          if (currentUser.id < peerId && retries < 1) {
            retryCountsRef.current.set(peerId, retries + 1);
            void createVoiceOffer(peerId, true);
          }
        }
      }

      if (relayChanged) {
        syncRelayCapture();
      }
    }, 3_000);

    return () => clearInterval(watchdog);
  }, [createVoiceOffer, currentUser.id, syncRelayCapture, updatePeerTransport]);

  // Heartbeat presence (every 12s) & prune stale disconnected participants (>45s)
  useEffect(() => {
    const timer = setInterval(() => {
      if (voiceModeRef.current !== 'off') {
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
    }, 12_000);
    return () => clearInterval(timer);
  }, [removeRemoteParticipant, sendPresence]);

  // Real-time speaking activity + mic volume level detector (Web Audio API)
  useEffect(() => {
    const interval = setInterval(() => {
      if (analysersRef.current.size === 0) return;
      const now = Date.now();
      const speakingThreshold = 12;
      const holdMs = 320;

      // Local mic level & speaking
      const localEntry = analysersRef.current.get('local');
      if (localEntry && voiceModeRef.current === 'mic' && !micMutedRef.current) {
        localEntry.analyser.getByteFrequencyData(localEntry.data);
        let sum = 0;
        for (let i = 0; i < localEntry.data.length; i++) sum += localEntry.data[i];
        const avg = sum / localEntry.data.length;
        const pct = Math.min(100, Math.round((avg / 64) * 100));
        setLocalLevel((prev) => (Math.abs(prev - pct) >= 3 || pct === 0 ? pct : prev));
        if (avg >= speakingThreshold) localEntry.lastActiveAt = now;
        const isSpeaking = now - localEntry.lastActiveAt < holdMs;
        setLocalSpeaking((prev) => (prev === isSpeaking ? prev : isSpeaking));
      } else {
        setLocalSpeaking((prev) => (prev ? false : prev));
        setLocalLevel((prev) => (prev !== 0 ? 0 : prev));
      }

      // Remote peers P2P speaking
      let anyChanged = false;
      const updates: Record<string, boolean> = {};
      for (const [key, entry] of analysersRef.current.entries()) {
        if (key === 'local') continue;
        const p = participantsRef.current[key];
        if (!p || p.transport === 'relay') continue;
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
    const timersMap = relaySpeakingTimerRef.current;
    const handleUnload = () => {
      if (voiceModeRef.current !== 'off') {
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
      for (const t of timersMap.values()) clearTimeout(t);
      timersMap.clear();
      leaveVoice(true);
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        void audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
    };
  }, [currentUser.id, leaveVoice, workspaceId]);

  const markAudioBlocked = useCallback(() => {
    setAudioBlocked(true);
  }, []);

  const remoteParticipants = Object.values(participants);

  return {
    voiceMode,
    voiceJoined: voiceMode !== 'off',
    joiningVoice,
    micMuted,
    deafened,
    micTestActive,
    localSpeaking,
    localLevel,
    audioBlocked,
    audioDevices,
    selectedDeviceId,
    remoteParticipants,
    remoteAudioStreams,
    mutedPeerIds,
    joinVoice,
    leaveVoice,
    toggleMute,
    toggleDeafen,
    toggleMicTest,
    togglePeerMute,
    switchMicDevice,
    reconnectPeer,
    unlockAudio,
    markAudioBlocked,
  };
}
