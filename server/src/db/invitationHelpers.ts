import crypto from 'node:crypto';
import type { StoredUser } from './types.ts';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateInviteCode(): string {
  const bytes = crypto.randomBytes(6);
  let suffix = '';
  for (let i = 0; i < 6; i += 1) {
    suffix += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return `CP-${suffix}`;
}

export function extractInviteCode(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  try {
    if (trimmed.includes('://') || trimmed.includes('?')) {
      const url = new URL(trimmed.startsWith('http') ? trimmed : `https://codepulse.local/${trimmed.replace(/^\/+/, '')}`);
      const param = url.searchParams.get('invite');
      if (param) return param.trim().toUpperCase();
    }
  } catch {
    // not a URL, treat as raw code
  }
  return trimmed.toUpperCase();
}

export function doesInvitationMatchUser(
  inv: { inviteeUsername: string | null; inviteeEmail: string | null },
  user: Pick<StoredUser, 'username' | 'email'>,
): boolean {
  const targetUser = inv.inviteeUsername?.replace(/^@/, '').trim().toLowerCase();
  const targetEmail = inv.inviteeEmail?.trim().toLowerCase();

  if (targetUser && user.username.trim().toLowerCase() === targetUser) {
    return true;
  }
  if (targetEmail && user.email && user.email.trim().toLowerCase() === targetEmail) {
    return true;
  }
  return false;
}

