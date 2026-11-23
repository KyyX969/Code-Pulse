import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config, isSupabaseConfigured } from './config.ts';
import { attachUser } from './middleware/auth.ts';
import { authRouter } from './routes/auth.ts';
import { deploymentsRouter } from './routes/deployments.ts';
import { gatekeeperRouter } from './routes/gatekeeper.ts';
import { invitationsRouter } from './routes/invitations.ts';
import { sessionsRouter } from './routes/sessions.ts';
import { tasksRouter } from './routes/tasks.ts';
import { webhooksRouter } from './routes/webhooks.ts';
import { workspacesRouter } from './routes/workspaces.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);

  app.use(
    cors({
      origin: (origin, callback) => {
        if (
          !origin ||
          origin === config.appUrl ||
          origin === config.apiPublicUrl ||
          origin.endsWith('.vercel.app')
        ) {
          callback(null, true);
          return;
        }
        callback(null, false);
      },
      credentials: true,
    }),
  );

  app.use(
    express.json({
      limit: '2mb',
      verify: (req, _res, buf) => {
        (req as Request).rawBody = buf;
      },
    }),
  );

  app.use(attachUser);

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'CodePulse API',
      mode: isSupabaseConfigured() ? 'supabase' : 'local',
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/invitations', invitationsRouter);
  app.use('/api/workspaces', workspacesRouter);
  app.use('/api/workspaces/:workspaceId/tasks', tasksRouter);
  app.use('/api/workspaces/:workspaceId/gatekeeper', gatekeeperRouter);
  app.use('/api/workspaces/:workspaceId/deployments', deploymentsRouter);
  app.use('/api/workspaces/:workspaceId/sessions', sessionsRouter);
  app.use('/api/webhooks', webhooksRouter);

  // Serve built frontend in non-Vercel Node production if dist/ exists
  const distDir = path.resolve(__dirname, '../../dist');
  if (!process.env.VERCEL && fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.use((req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/ws')) {
        next();
        return;
      }
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    void _next;
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[CodePulse API Error]', err);
    res.status(500).json({ error: message });
  });

  return app;
}

