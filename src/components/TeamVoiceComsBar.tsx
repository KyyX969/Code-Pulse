import { useEffect, useRef } from 'react';
import {
  HeadphoneOff,
  Headphones,
  Mic,
  MicOff,
  PhoneOff,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { PublicUser } from '../../shared/types.ts';
import { useLanguage } from '../lib/i18nContext.ts';
import type { AudioInputDeviceOption, VoiceParticipant } from '../lib/useTeamVoiceComs.ts';

interface TeamVoiceComsBarProps {
  currentUser: PublicUser;
  voiceJoined: boolean;
  joiningVoice: boolean;
  micMuted: boolean;
  deafened: boolean;
  localSpeaking: boolean;
  audioDevices: AudioInputDeviceOption[];
  selectedDeviceId: string;
  remoteParticipants: VoiceParticipant[];
  remoteAudioStreams: Record<string, MediaStream>;
  mutedPeerIds: Record<string, boolean>;
  onJoinVoice: () => void;
  onLeaveVoice: () => void;
  onToggleMute: () => void;
  onToggleDeafen: () => void;
  onTogglePeerMute: (peerId: string) => void;
  onSwitchMicDevice: (deviceId: string) => void;
}

export function TeamVoiceComsBar({
  currentUser,
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
  onJoinVoice,
  onLeaveVoice,
  onToggleMute,
  onToggleDeafen,
  onTogglePeerMute,
  onSwitchMicDevice,
}: TeamVoiceComsBarProps) {
  const { L } = useLanguage();
  const totalInVoice = (voiceJoined ? 1 : 0) + remoteParticipants.length;

  return (
    <div
      className={`rounded-2xl border p-4 transition-colors space-y-3.5 ${
        voiceJoined
          ? 'bg-emerald-950/20 border-emerald-500/30 shadow-lg shadow-emerald-950/20'
          : 'cp-panel border-white/10'
      }`}
    >
      {/* Hidden WebRTC Remote Audio Renderers */}
      {Object.entries(remoteAudioStreams).map(([peerId, stream]) => (
        <RemoteVoiceAudio
          key={peerId}
          stream={stream}
          muted={deafened || Boolean(mutedPeerIds[peerId])}
        />
      ))}

      {/* Top Control Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 transition ${
              voiceJoined
                ? micMuted
                  ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                  : 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300'
                : 'bg-indigo-500/15 border-indigo-500/25 text-indigo-300'
            }`}
          >
            {voiceJoined && micMuted ? (
              <MicOff className="w-4 h-4" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-white">
                {L('Voice Coms Tim (WebRTC P2P)', 'Team Voice Coms (WebRTC P2P)')}
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
                  ? L(
                      `${totalInVoice} di ruang suara`,
                      `${totalInVoice} in voice`,
                    )
                  : L('Ruang suara siap', 'Voice channel ready')}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              {voiceJoined
                ? L(
                    'Audio terenkripsi Peer-to-Peer aktif — rekan satu proyek bisa langsung berbicara sambil memantau IDE.',
                    'Encrypted Peer-to-Peer audio active — teammates can talk live while monitoring IDE screens.',
                  )
                : L(
                    'Nyalakan mikrofon untuk komunikasi langsung antar tim tanpa keluar dari Monitor Langsung.',
                    'Turn on your microphone for instant team voice coms right inside Live Monitor.',
                  )}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {!voiceJoined ? (
            <button
              type="button"
              disabled={joiningVoice}
              onClick={onJoinVoice}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold shadow-lg shadow-emerald-950/40 transition cursor-pointer disabled:opacity-50"
            >
              <Mic className="w-3.5 h-3.5" />
              <span>
                {joiningVoice
                  ? L('Menghubungkan Mic...', 'Connecting Mic...')
                  : L('Gabung Voice', 'Join Voice')}
              </span>
            </button>
          ) : (
            <>
              {audioDevices.length > 1 && (
                <select
                  value={selectedDeviceId}
                  onChange={(e) => onSwitchMicDevice(e.target.value)}
                  aria-label={L('Pilih perangkat mikrofon', 'Select microphone device')}
                  className="max-w-[190px] px-2.5 py-2 rounded-xl bg-zinc-950 border border-white/10 text-[11px] text-zinc-200 focus:outline-none focus:border-emerald-500 truncate cursor-pointer"
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
                  micMuted
                    ? 'bg-rose-500/15 hover:bg-rose-500/25 border-rose-500/35 text-rose-200'
                    : 'bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/35 text-emerald-200'
                }`}
                title={micMuted ? L('Nyalakan Mikrofon', 'Unmute Microphone') : L('Bisukan Mikrofon', 'Mute Microphone')}
              >
                {micMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                <span>{micMuted ? L('Mic Mati', 'Muted') : L('Mic Aktif', 'Mic Live')}</span>
              </button>

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

      {/* Active Voice Participants Pills */}
      {totalInVoice > 0 && (
        <div className="pt-3 border-t border-white/[0.08] flex flex-wrap items-center gap-2">
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
                    micMuted ? 'bg-rose-500' : 'bg-emerald-400'
                  }`}
                />
              </div>
              <span className="font-medium">
                {L('Anda', 'You')} (@{currentUser.username})
              </span>
              {micMuted ? (
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
            const isConnected = peer.connectionState === 'connected';
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
                      peer.muted
                        ? 'bg-rose-500'
                        : isConnected
                          ? 'bg-emerald-400'
                          : 'bg-amber-400'
                    }`}
                  />
                </div>

                <span className="font-medium">@{peer.username}</span>

                {peer.muted ? (
                  <MicOff className="w-3 h-3 text-rose-400" />
                ) : peer.speaking && !deafened && !peerLocallyMuted ? (
                  <SpeakingBars />
                ) : voiceJoined && !isConnected ? (
                  <span className="text-[10px] font-mono text-amber-300">
                    {L('menghubungkan...', 'linking...')}
                  </span>
                ) : (
                  <Mic className="w-3 h-3 text-emerald-400/80" />
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

function RemoteVoiceAudio({ stream, muted }: { stream: MediaStream; muted: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.srcObject = stream;
    void el.play().catch(() => {
      // Autoplay will resume on next user interaction if blocked
    });
  }, [stream]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.muted = muted;
  }, [muted]);

  return <audio ref={audioRef} autoPlay playsInline className="hidden" />;
}

