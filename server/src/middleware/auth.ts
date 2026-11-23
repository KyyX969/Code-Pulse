import type { NextFunction, Request, Response } from 'express';
import { isWorkspaceLeader } from '../../../shared/permissions.js';
import { getStore } from '../db/index.js';
import type { StoredUser } from '../db/types.js';
import { verifySessionToken } from '../utils/crypto.js';

declare global {
  namespace Express {
    interface Request {
      currentUser?: StoredUser;
      rawBody?: Buffer;
    }
  }
}

export const SESSION_COOKIE_NAME = 'cp_session';

export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    try {
      out[key] = decodeURIComponent(val);
    } catch {
      out[key] = val;
    }
  }
  return out;
}

export async function attachUser(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const cookies = parseCookies(req.headers.cookie);
  const bearer = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7).trim()
    : undefined;
  const token = cookies[SESSION_COOKIE_NAME] || bearer;

  if (token) {
    const claims = verifySessionToken(token);
    if (claims) {
      const store = await getStore();
      const user = await store.getUserById(claims.userId);
      if (user) {
        req.currentUser = user;
      }
    }
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.currentUser) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  next();
}

export function requireLeader(req: Request, res: Response, next: NextFunction): void {
  if (!req.currentUser) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  if (req.currentUser.role !== 'leader') {
    res.status(403).json({
      error: 'Project Leader role required for this Gatekeeper or Deployment action.',
    });
    return;
  }
  next();
}

export async function requireWorkspaceLeader(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.currentUser) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const workspaceId = String(req.params.workspaceId || req.params.id || '');
  if (!workspaceId) {
    requireLeader(req, res, next);
    return;
  }
  const store = await getStore();
  const ws = await store.getWorkspaceById(workspaceId);
  if (!ws) {
    res.status(404).json({ error: 'Workspace not found' });
    return;
  }
  if (!isWorkspaceLeader(ws, req.currentUser)) {
    res.status(403).json({
      error: 'Project Leader role in this workspace is required for this action.',
    });
    return;
  }
  next();
}

