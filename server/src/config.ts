import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RTCIceServerConfig } from '../../shared/types.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true });

const parseIceServers = (): RTCIceServerConfig[] => {
  const servers: RTCIceServerConfig[] = [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  ];

  if (process.env.VITE_TURN_URL) {
    servers.push({
      urls: process.env.VITE_TURN_URL,
      username: process.env.VITE_TURN_USERNAME || undefined,
      credential: process.env.VITE_TURN_CREDENTIAL || undefined,
    });
  }

  return servers;
};

const inferredVercelOrigin = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : '';

const resolvedAppUrl = (
  process.env.APP_URL ||
  inferredVercelOrigin ||
  'http://localhost:5173'
).replace(/\/$/, '');

const resolvedApiPublicUrl = (
  process.env.API_PUBLIC_URL ||
  process.env.APP_URL ||
  inferredVercelOrigin ||
  'http://localhost:4000'
).replace(/\/$/, '');

export const config = {
  port: Number(process.env.PORT || 4000),
  appUrl: resolvedAppUrl,
  apiPublicUrl: resolvedApiPublicUrl,
  sessionSecret: process.env.SESSION_SECRET || 'codepulse-dev-session-secret-change-in-prod',
  tokenEncryptionKey:
    process.env.TOKEN_ENCRYPTION_KEY || 'codepulse-dev-32byte-aes256-key!!',
  github: {
    clientId: process.env.GITHUB_CLIENT_ID || '',
    clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
    callbackUrl:
      process.env.GITHUB_CALLBACK_URL || `${resolvedApiPublicUrl}/api/auth/github/callback`,
    webhookSecret: process.env.GITHUB_WEBHOOK_SECRET || '',
  },
  vercel: {
    clientId: process.env.VERCEL_CLIENT_ID || '',
    clientSecret: process.env.VERCEL_CLIENT_SECRET || '',
    redirectUri:
      process.env.VERCEL_REDIRECT_URI || `${resolvedApiPublicUrl}/api/auth/vercel/callback`,
  },
  supabase: {
    url: (process.env.SUPABASE_URL || '')
      .trim()
      .replace(/\/rest\/v1\/?$/, '')
      .replace(/\/$/, ''),
    serviceRoleKey: (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
    anonKey: (process.env.VITE_SUPABASE_ANON_KEY || '').trim(),
  },
  iceServers: parseIceServers(),
  dataFilePath: process.env.VERCEL
    ? '/tmp/codepulse-db.json'
    : path.resolve(__dirname, '../data/codepulse-db.json'),
};

export const isSupabaseConfigured = (): boolean =>
  Boolean(config.supabase.url && config.supabase.serviceRoleKey);

export const isGitHubOAuthConfigured = (): boolean =>
  Boolean(config.github.clientId && config.github.clientSecret);

export const isVercelOAuthConfigured = (): boolean =>
  Boolean(config.vercel.clientId && config.vercel.clientSecret);

