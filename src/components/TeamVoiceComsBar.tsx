import { useEffect, useRef } from 'react';
import {
  AlertCircle,
  HeadphoneOff,
  Headphones,
  Mic,
  MicOff,
  PhoneOff,
  RefreshCw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { PublicUser } from '../../shared/types.ts';
import { useLanguage } from '../lib/i18nContext.ts';
import type {
  AudioInputDeviceOption,
  VoiceMode,
  VoiceParticipant,
} from '../lib/useTeamVoiceComs.ts';

interface TeamVoiceComsBarProps {
  currentUser: PublicUser;
  voiceMode: VoiceMode;
  voiceJoined: boolean;
  joiningVoice: boolean;
  micMuted: boolean;
  deafened: boolean;
  micTestActive: boolean;
  localSpeaking: boolean;
  localLevel: number;
  audioBlocked: boolean;
  audioDevices: AudioInputDeviceOption[];
  selectedDeviceId: string;
  remoteParticipants: VoiceParticipant[];
  remoteAudioStreams: Record<string, MediaStream>;
  mutedPeerIds: Record<string, boolean>;
  onJoinVoice: (mode?: 'mic' | 'listen') => void;
  onLeaveVoice: () => void;
  onToggleMute: () => void;
  onToggleDeafen: () => void;
  onToggleMicTest: () => void;
  onTogglePeerMute: (peerId: string) => void;
  onSwitchMicDevice: (deviceId: string) => void;
  onReconnectPeer: (peerId: string) => void;
  onUnlockAudio: () => void;
  onAudioBlocked: () => void;
}

export function TeamVoiceComsBar({
  currentUser,
  voiceMode,
  voiceJoined,
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
  onJoinVoice,
  onLeaveVoice,
  onToggleMute,
  onToggleDeafen,
  onToggleMicTest,
  onTogglePeerMute,
  onSwitchMicDevice,
  onReconnectPeer,
  onUnlockAudio,
  onAudioBlocked,
}: TeamVoiceComsBarProps) {
  const { L } = useLanguage();
  const totalInVoice = (voiceJoined ? 1 : 0) + remoteParticipants.length;
  const isListenOnly = voiceMode === 'listen';

  return (
    <div
      className={`rounded-2xl border p-4 transition-colors space-y-3.5 ${
        voiceJoined
          ? 'bg-emerald-950/20 border-emerald-500/30 shadow-lg shadow-emerald-950/20'
          : remoteParticipants.length > 0
            ? 'bg-indigo-950/25 border-indigo-400/35 shadow-lg shadow-indigo-950/20'
            : 'cp-panel border-white/10'
      }`}
    >
      {/* Accessible Off-Screen WebRTC Remote Audio Renderers (never display:none to prevent Chrome audio sink stall) */}
      {Object.entries(remoteAudioStreams).map(([peerId, stream]) => (
        <RemoteVoiceAudio
          key={peerId}
          stream={stream}
          muted={deafened || Boolean(mutedPeerIds[peerId])}
          onAutoplayBlocked={onAudioBlocked}
        />
      ))}

      {/* Browser Autoplay Unlock Banner (if Chrome ever blocks remote audio playback) */}
      {audioBlocked && voiceJoined && (
        <div className="px-3.5 py-2.5 rounded-xl bg-amber-500/15 border border-amber-500/35 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              {L(
                'Browser menahan pemutaran audio otomatis. Klik tombol di kanan agar suara rekan terdengar.',
                'Browser blocked automatic audio playback. Click the button on the right to hear teammates.',
              )}
            </span>
          </div>
          <button
            type="button"
            onClick={onUnlockAudio}
            className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 text-xs font-bold cursor-pointer shrink-0"
          >
            {L('Aktifkan Audio', 'Enable Audio')}
          </button>
        </div>
      )}

      {/* Top Control Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 transition ${
              voiceJoined
                ? isListenOnly
                  ? 'bg-cyan-500/15 border-cyan-500/35 text-cyan-300'
                  : micMuted
                    ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                    : 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300'
                : 'bg-indigo-500/15 border-indigo-500/25 text-indigo-300'
            }`}
          >
            {isListenOnly ? (
              <Headphones className="w-4 h-4" />
            ) : voiceJoined && micMuted ? (
              <MicOff className="w-4 h-4" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-white">
                {L('Voice Coms Tim (WebRTC P2P + Relay)', 'Team Voice Coms (WebRTC P2P + Relay)')}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono ${
                  totalInVoice > 0
                    ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                    : 'bg-zinc-900 border border-white/10 text-zinc-400'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    totalInVoice > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'
                  }`}
                />
                {totalInVoice > 0
                  ? L(`${totalInVoice} di ruang suara`, `${totalInVoice} in voice`)
                  : L('Ruang suara siap', 'Voice channel ready')}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              {voiceJoined
                ? remoteParticipants.length === 0
                  ? L(
                      'Anda sudah di ruang suara. Minta rekan di proyek yang sama mengklik "Gabung Voice" atau "Dengar Saja" untuk mulai berbicara.',
                      'You are in voice. Ask teammates in this same project to click "Join Voice" or "Listen Only" to start talking.',
                    )
                  : L(
                      'Terhubung dengan tim — otomatis berpindah ke Relay jika Wi-Fi/firewall memblokir P2P langsung.',
                      'Connected with team — automatically falls back to Relay if Wi-Fi/firewall blocks direct P2P.',
                    )
                : remoteParticipants.length > 0
                  ? L(
                      `${remoteParticipants.map((p) => `@${p.username}`).join(', ')} sudah berada di ruang suara — klik Gabung Voice (atau Dengar Saja) untuk mendengar!`,
                      `${remoteParticipants.map((p) => `@${p.username}`).join(', ')} already in voice — click Join Voice (or Listen Only) to hear them!`,
                    )
                  : L(
                      'Nyalakan mikrofon untuk komunikasi langsung antar tim di proyek ini (otomatis tembus NAT/firewall).',
                      'Turn on your microphone for live team voice coms in this project (NAT/firewall friendly).',
                    )}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {!voiceJoined ? (
            <>
              <button
                type="button"
                disabled={joiningVoice}
                onClick={() => onJoinVoice('mic')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold shadow-lg shadow-emerald-950/40 transition cursor-pointer disabled:opacity-50"
              >
                <Mic className="w-3.5 h-3.5" />
                <span>
                  {joiningVoice
                    ? L('Menghubungkan Mic...', 'Connecting Mic...')
                    : L('Gabung Voice', 'Join Voice')}
                </span>
              </button>
              <button
                type="button"
                disabled={joiningVoice}
                onClick={() => onJoinVoice('listen')}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-200 text-xs font-medium transition cursor-pointer disabled:opacity-50"
                title={L(
                  'Masuk tanpa mikrofon untuk mendengar suara tim',
                  'Join without a microphone to listen to teammates',
                )}
              >
                <Headphones className="w-3.5 h-3.5 text-cyan-400" />
                <span>{L('Dengar Saja', 'Listen Only')}</span>
              </button>
            </>
          ) : (
            <>
              {!isListenOnly && audioDevices.length > 1 && (
                <select
                  value={selectedDeviceId}
                  onChange={(e) => onSwitchMicDevice(e.target.value)}
                  aria-label={L('Pilih perangkat mikrofon', 'Select microphone device')}
                  className="max-w-[185px] px-2.5 py-2 rounded-xl bg-zinc-950 border border-white/10 text-[11px] text-zinc-200 focus:outline-none focus:border-emerald-500 truncate cursor-pointer"
                >
                  {audioDevices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId} className="bg-zinc-950 text-zinc-100">
                      {d.label}
                    </option>
                  ))}
                </select>
              )}

              <button
                type="button"
                onClick={onToggleMute}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                  isListenOnly
                    ? 'bg-indigo-500/15 hover:bg-indigo-500/25 border-indigo-500/35 text-indigo-200'
                    : micMuted
                      ? 'bg-rose-500/15 hover:bg-rose-500/25 border-rose-500/35 text-rose-200'
                      : 'bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/35 text-emerald-200'
                }`}
                title={
                  isListenOnly
                    ? L('Aktifkan Mikrofon', 'Enable Microphone')
                    : micMuted
                      ? L('Nyalakan Mikrofon', 'Unmute Microphone')
                      : L('Bisukan Mikrofon', 'Mute Microphone')
                }
              >
                {isListenOnly ? (
                  <Mic className="w-3.5 h-3.5" />
                ) : micMuted ? (
                  <MicOff className="w-3.5 h-3.5" />
                ) : (
                  <Mic className="w-3.5 h-3.5" />
                )}
                <span>
                  {isListenOnly
                    ? L('Nyalakan Mic', 'Enable Mic')
                    : micMuted
                      ? L('Mic Mati', 'Muted')
                      : L('Mic Aktif', 'Mic Live')}
                </span>
              </button>

              {!isListenOnly && (
                <button
                  type="button"
                  onClick={onToggleMicTest}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition cursor-pointer ${
                    micTestActive
                      ? 'bg-cyan-500/20 hover:bg-cyan-500/30 border-cyan-400/45 text-cyan-200'
                      : 'bg-zinc-900 hover:bg-zinc-800 border-white/10 text-zinc-300'
                  }`}
                  title={L(
                    'Dengar suara mikrofon Anda sendiri untuk memastikan mic bekerja',
                    'Hear your own microphone locally to verify input works',
                  )}
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">
                    {micTestActive ? L('Stop Tes', 'Stop Test') : L('Tes Mic', 'Test Mic')}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={onToggleDeafen}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition cursor-pointer ${
                  deafened
                    ? 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/35 text-amber-200'
                    : 'bg-zinc-900 hover:bg-zinc-800 border-white/10 text-zinc-200'
                }`}
                title={
                  deafened
                    ? L('Nyalakan Suara Rekan', 'Unmute Incoming Audio')
                    : L('Senyapkan Semua Audio Masuk', 'Deafen Incoming Audio')
                }
              >
                {deafened ? (
                  <HeadphoneOff className="w-3.5 h-3.5" />
                ) : (
                  <Headphones className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">
                  {deafened ? L('Audio Senyap', 'Deafened') : L('Audio Aktif', 'Audio On')}
                </span>
              </button>

              <button
                type="button"
                onClick={onLeaveVoice}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition cursor-pointer"
                title={L('Keluar dari Voice Coms', 'Leave Voice Coms')}
              >
                <PhoneOff className="w-3.5 h-3.5" />
                <span>{L('Keluar', 'Leave')}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Active Voice Participants Pills + Live Mic Input Meter */}
      {totalInVoice > 0 && (
        <div className="pt-3 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {voiceJoined && (
              <div
                className={`inline-flex items-center gap-2 pl-1.5 pr-3 py-1 rounded-full border text-xs transition ${
                  localSpeaking && !micMuted
                    ? 'bg-emerald-500/15 border-emerald-400/60 text-white shadow-[0_0_16px_rgba(16,185,129,0.28)]'
                    : 'bg-zinc-950/90 border-white/10 text-zinc-200'
                }`}
              >
                <div className="relative">
                  <img
                    src={currentUser.avatarUrl}
                    alt={currentUser.username}
                    className={`w-6 h-6 rounded-full bg-zinc-800 ${
                      localSpeaking && !micMuted
                        ? 'ring-2 ring-emerald-400'
                        : 'ring-1 ring-white/15'
                    }`}
                  />
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-[#0c0e16] ${
                      isListenOnly
                        ? 'bg-cyan-400'
                        : micMuted
                          ? 'bg-rose-500'
                          : 'bg-emerald-400'
                    }`}
                  />
                </div>
                <span className="font-medium">
                  {L('Anda', 'You')} (@{currentUser.username})
                </span>
                {isListenOnly ? (
                  <span className="text-[10px] font-mono text-cyan-300">
                    {L('Dengar', 'Listen')}
                  </span>
                ) : micMuted ? (
                  <MicOff className="w-3 h-3 text-rose-400" />
                ) : localSpeaking ? (
                  <SpeakingBars />
                ) : (
                  <Mic className="w-3 h-3 text-emerald-400/80" />
                )}
              </div>
            )}

            {remoteParticipants.map((peer) => {
              const peerLocallyMuted = Boolean(mutedPeerIds[peer.userId]);
              const isConnected = peer.transport === 'p2p' || peer.transport === 'relay';
              return (
                <div
                  key={peer.userId}
                  className={`inline-flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-full border text-xs transition ${
                    peer.speaking && !peer.muted && !deafened && !peerLocallyMuted
                      ? 'bg-emerald-500/15 border-emerald-400/60 text-white shadow-[0_0_16px_rgba(16,185,129,0.28)]'
                      : 'bg-zinc-950/90 border-white/10 text-zinc-200'
                  }`}
                >
                  <div className="relative">
                    {peer.avatarUrl ? (
                      <img
                        src={peer.avatarUrl}
                        alt={peer.username}
                        className={`w-6 h-6 rounded-full bg-zinc-800 ${
                          peer.speaking && !peer.muted
                            ? 'ring-2 ring-emerald-400'
                            : 'ring-1 ring-white/15'
                        }`}
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-200 flex items-center justify-center text-[10px] font-bold">
                        {peer.username.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-[#0c0e16] ${
                        peer.listenOnly
                          ? 'bg-cyan-400'
                          : peer.muted
                            ? 'bg-rose-500'
                            : isConnected
                              ? 'bg-emerald-400'
                              : 'bg-amber-400'
                      }`}
                    />
                  </div>

                  <span className="font-medium">@{peer.username}</span>

                  {peer.listenOnly ? (
                    <span className="text-[10px] font-mono text-cyan-300">
                      {L('Dengar', 'Listen')}
                    </span>
                  ) : peer.muted ? (
                    <MicOff className="w-3 h-3 text-rose-400" />
                  ) : peer.speaking && !deafened && !peerLocallyMuted ? (
                    <SpeakingBars />
                  ) : (
                    <Mic className="w-3 h-3 text-emerald-400/80" />
                  )}

                  {voiceJoined && (
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-mono uppercase ${
                        peer.transport === 'p2p'
                          ? 'bg-emerald-500/15 text-emerald-300'
                          : peer.transport === 'relay'
                            ? 'bg-cyan-500/15 text-cyan-300'
                            : 'bg-amber-500/15 text-amber-300'
                      }`}
                      title={
                        peer.transport === 'p2p'
                          ? L('Tersambung langsung WebRTC P2P', 'Direct WebRTC P2P connected')
                          : peer.transport === 'relay'
                            ? L(
                                'Audio berjalan lewat mode Relay anti-firewall',
                                'Audio running via firewall-safe Relay mode',
                              )
                            : L('Menegosiasikan koneksi audio...', 'Negotiating audio connection...')
                      }
                    >
                      {peer.transport === 'p2p'
                        ? 'P2P'
                        : peer.transport === 'relay'
                          ? 'RELAY'
                          : L('Konek...', 'Link...')}
                    </span>
                  )}

                  {voiceJoined && peer.transport !== 'p2p' && (
                    <button
                      type="button"
                      onClick={() => onReconnectPeer(peer.userId)}
                      className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                      title={L('Coba hubungkan ulang P2P', 'Retry direct P2P handshake')}
                    >
                      <RefreshCw className="w-3 h-3" />
                    </button>
                  )}

                  {voiceJoined && (
                    <button
                      type="button"
                      onClick={() => onTogglePeerMute(peer.userId)}
                      className={`p-1 rounded-full transition cursor-pointer ${
                        peerLocallyMuted
                          ? 'text-rose-400 bg-rose-500/15 hover:bg-rose-500/25'
                          : 'text-zinc-400 hover:text-white hover:bg-white/10'
                      }`}
                      title={
                        peerLocallyMuted
                          ? L(`Nyalakan suara @${peer.username}`, `Unmute @${peer.username}`)
                          : L(`Bisukan suara @${peer.username}`, `Mute @${peer.username} locally`)
                      }
                    >
                      {peerLocallyMuted ? (
                        <VolumeX className="w-3 h-3" />
                      ) : (
                        <Volume2 className="w-3 h-3" />
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Compact Live Mic Input Level Meter */}
          {voiceMode === 'mic' && !micMuted && (
            <div
              className="inline-flex items-center gap-2 text-[10px] font-mono text-zinc-400 shrink-0"
              title={L('Level input mikrofon Anda secara langsung', 'Your live microphone input level')}
            >
              <span>{L('Input Mic', 'Mic Level')}</span>
              <div className="w-16 h-1.5 rounded-full bg-zinc-900 border border-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-100"
                  style={{ width: `${Math.max(4, localLevel)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SpeakingBars() {
  return (
    <span className="inline-flex items-end gap-0.5 h-3 px-0.5" aria-hidden="true">
      <span className="w-0.5 h-2 rounded-full bg-emerald-400 animate-pulse" />
      <span className="w-0.5 h-3 rounded-full bg-emerald-300 animate-pulse" />
      <span className="w-0.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
    </span>
  );
}

function RemoteVoiceAudio({
  stream,
  muted,
  onAutoplayBlocked,
}: {
  stream: MediaStream;
  muted: boolean;
  onAutoplayBlocked: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const onBlockedRef = useRef(onAutoplayBlocked);

  useEffect(() => {
    onBlockedRef.current = onAutoplayBlocked;
  }, [onAutoplayBlocked]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.srcObject = stream;
    el.volume = 1;
    void el.play().catch(() => {
      onBlockedRef.current();
    });
  }, [stream]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.muted = muted;
    if (!muted && el.paused && el.srcObject) {
      void el.play().catch(() => {
        onBlockedRef.current();
      });
    }
  }, [muted]);

  return (
    <audio
      ref={audioRef}
      data-cp-voice-audio="true"
      autoPlay
      playsInline
      muted={muted}
      className="sr-only"
    />
  );
}
