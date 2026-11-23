import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import type { RealtimeServerMessage } from '../../shared/types.ts';

export type SocketConnectionState = 'disconnected' | 'connecting' | 'connected';

type Listener = (message: RealtimeServerMessage) => void;
type StatusListener = (status: SocketConnectionState) => void;

class RealtimeClient {
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private statusListeners = new Set<StatusListener>();
  private status: SocketConnectionState = 'disconnected';
  private workspaceId: string | null = null;
  private userId: string | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = false;
  private wsEverOpened = false;
  private wsFailedAttempts = 0;
  private supabaseConnected = false;
  private supabase: SupabaseClient | null = null;
  private supabaseChannel: RealtimeChannel | null = null;

  constructor() {
    const rawUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const sbAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
    const sbUrl = rawUrl
      ?.trim()
      .replace(/\/rest\/v1\/?$/, '')
      .replace(/\/$/, '');
    if (sbUrl && sbAnon) {
      this.supabase = createClient(sbUrl, sbAnon.trim());
    }
  }

  private setStatus(next: SocketConnectionState): void {
    this.status = next;
    for (const listener of this.statusListeners) {
      listener(next);
    }
  }

  getStatus(): SocketConnectionState {
    return this.status;
  }

  onStatusChange(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  connect(workspaceId: string, userId: string): void {
    this.workspaceId = workspaceId;
    this.userId = userId;
    this.shouldReconnect = true;

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendSubscribe();
      this.setStatus('connected');
    } else if ((!this.ws || this.ws.readyState === WebSocket.CLOSED) && this.wsFailedAttempts < 2) {
      this.openSocket();
    }

    this.connectSupabaseChannel(workspaceId);
  }

  private openSocket(): void {
    if (!this.supabaseConnected) {
      this.setStatus('connecting');
    }
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}/ws`;
    const socket = new WebSocket(url);
    this.ws = socket;

    socket.onopen = () => {
      this.wsEverOpened = true;
      this.wsFailedAttempts = 0;
      this.sendSubscribe();
      this.setStatus('connected');
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(String(event.data)) as RealtimeServerMessage;
        for (const listener of this.listeners) {
          listener(msg);
        }
      } catch {
        // Ignore malformed server payload
      }
    };

    socket.onclose = () => {
      this.ws = null;
      if (!this.wsEverOpened) {
        this.wsFailedAttempts += 1;
      }
      this.setStatus(this.supabaseConnected ? 'connected' : 'disconnected');
      const canRetry = this.shouldReconnect && (this.wsEverOpened || this.wsFailedAttempts < 2);
      if (canRetry) {
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => this.openSocket(), 1500);
      }
    };
  }

  private sendSubscribe(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.workspaceId) return;
    this.ws.send(
      JSON.stringify({
        type: 'subscribe',
        workspaceId: this.workspaceId,
        userId: this.userId,
      }),
    );
  }

  private connectSupabaseChannel(workspaceId: string): void {
    if (!this.supabase) return;
    if (this.supabaseChannel) {
      this.supabase.removeChannel(this.supabaseChannel);
      this.supabaseChannel = null;
    }

    this.supabaseChannel = this.supabase
      .channel(`codepulse-rtc:${workspaceId}`)
      .on('broadcast', { event: 'rtc:signal' }, ({ payload }) => {
        if (!payload) return;
        const msg = payload as RealtimeServerMessage;
        if (
          msg.type === 'rtc:signal' &&
          msg.fromUserId !== this.userId &&
          (msg.toUserId === '*' || msg.toUserId === this.userId)
        ) {
          for (const listener of this.listeners) {
            listener(msg);
          }
        }
      })
      .subscribe((channelStatus) => {
        if (channelStatus === 'SUBSCRIBED') {
          this.supabaseConnected = true;
          this.setStatus('connected');
        } else if (channelStatus === 'CLOSED' || channelStatus === 'CHANNEL_ERROR') {
          this.supabaseConnected = false;
          if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.setStatus('disconnected');
          }
        }
      });
  }

  sendRtcSignal(params: {
    workspaceId: string;
    fromUserId: string;
    toUserId: string;
    signalType: 'offer' | 'answer' | 'ice-candidate' | 'viewer-join' | 'broadcaster-ready';
    payload: unknown;
  }): void {
    const packet = {
      type: 'rtc:signal' as const,
      ...params,
    };

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(packet));
    }

    if (this.supabaseChannel) {
      void this.supabaseChannel.send({
        type: 'broadcast',
        event: 'rtc:signal',
        payload: packet,
      });
    }
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.supabase && this.supabaseChannel) {
      this.supabase.removeChannel(this.supabaseChannel);
      this.supabaseChannel = null;
    }
    this.supabaseConnected = false;
    this.wsFailedAttempts = 0;
    this.setStatus('disconnected');
  }
}

export const realtimeClient = new RealtimeClient();
