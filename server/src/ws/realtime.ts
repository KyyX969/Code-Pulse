import crypto from 'node:crypto';
import type { Server as HttpServer } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import type { RealtimeServerMessage, RtcSignalType } from '../../../shared/types.js';

interface ClientMeta {
  clientId: string;
  ws: WebSocket;
  workspaceId: string | null;
  userId: string | null;
}

class RealtimeHub {
  private wss: WebSocketServer | null = null;
  private clients = new Set<ClientMeta>();

  attach(server: HttpServer): void {
    if (this.wss) return;
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws) => {
      const meta: ClientMeta = {
        clientId: crypto.randomUUID(),
        ws,
        workspaceId: null,
        userId: null,
      };
      this.clients.add(meta);

      this.send(ws, { type: 'connected', clientId: meta.clientId });

      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString()) as Record<string, unknown>;
          if (msg.type === 'subscribe') {
            meta.workspaceId = typeof msg.workspaceId === 'string' ? msg.workspaceId : null;
            meta.userId = typeof msg.userId === 'string' ? msg.userId : null;
            return;
          }

          if (msg.type === 'rtc:signal' && typeof msg.workspaceId === 'string') {
            const toUserId = String(msg.toUserId || '*');
            const fromUserId = String(msg.fromUserId || meta.userId || '');
            const outgoing: RealtimeServerMessage = {
              type: 'rtc:signal',
              workspaceId: msg.workspaceId,
              fromUserId,
              toUserId,
              signalType: msg.signalType as RtcSignalType,
              payload: msg.payload,
            };

            for (const target of this.clients) {
              if (target === meta) continue;
              if (target.workspaceId !== msg.workspaceId) continue;
              if (toUserId !== '*' && target.userId !== toUserId) continue;
              this.send(target.ws, outgoing);
            }
          }
        } catch {
          // Ignore malformed ws messages
        }
      });

      ws.on('close', () => {
        this.clients.delete(meta);
      });
    });
  }

  private send(ws: WebSocket, message: RealtimeServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  broadcastToWorkspace(workspaceId: string, message: RealtimeServerMessage): void {
    for (const client of this.clients) {
      if (client.workspaceId === workspaceId) {
        this.send(client.ws, message);
      }
    }
  }
}

export const realtimeHub = new RealtimeHub();
