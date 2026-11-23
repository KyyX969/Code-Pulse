import crypto from 'node:crypto';
import { config } from '../config.js';

function deriveAesKey(secret: string): Buffer {
  return crypto.createHash('sha256').update(secret, 'utf8').digest();
}

/**
 * Encrypts sensitive OAuth tokens or webhook secrets using AES-256-GCM.
 */
export function encryptToken(plaintext: string): string {
  const key = deriveAesKey(config.tokenEncryptionKey);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${authTag.toString('base64')}.${encrypted.toString('base64')}`;
}

/**
 * Decrypts tokens previously encrypted with encryptToken().
 */
export function decryptToken(payload: string): string {
  const parts = payload.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted token format');
  }
  const [ivB64, tagB64, dataB64] = parts;
  const key = deriveAesKey(config.tokenEncryptionKey);
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(ivB64, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

export interface SessionClaims {
  userId: string;
  exp: number;
}

export function signSessionToken(userId: string, ttlMs = 7 * 24 * 60 * 60 * 1000): string {
  const claims: SessionClaims = { userId, exp: Date.now() + ttlMs };
  const body = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', config.sessionSecret)
    .update(body)
    .digest('base64url');
  return `${body}.${sig}`;
}

export function verifySessionToken(token: string): SessionClaims | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', config.sessionSecret)
    .update(body)
    .digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionClaims;
    if (!claims.userId || typeof claims.exp !== 'number' || claims.exp < Date.now()) {
      return null;
    }
    return claims;
  } catch {
    return null;
  }
}

/**
 * Verifies GitHub X-Hub-Signature-256 header against raw request payload.
 */
export function verifyGitHubWebhookSignature(
  rawBody: Buffer | string,
  signatureHeader: string | undefined,
  secret: string,
): boolean {
  if (!secret || !signatureHeader) return false;
  const expected =
    'sha256=' +
    crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

  const actualBuf = Buffer.from(signatureHeader, 'utf8');
  const expectedBuf = Buffer.from(expected, 'utf8');
  if (actualBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(actualBuf, expectedBuf);
}

/**
 * Extracts unique CodePulse task IDs such as #CP-01 or CP-12 from commit/PR text.
 */
export function extractTaskCodes(text: string): string[] {
  if (!text) return [];
  const matches = text.match(/#?(CP-\d+)/gi);
  if (!matches) return [];
  const normalized = new Set<string>();
  for (const m of matches) {
    const clean = m.replace(/^#/, '').toUpperCase();
    const numPart = clean.replace('CP-', '').padStart(2, '0');
    normalized.add(`CP-${numPart}`);
  }
  return Array.from(normalized);
}

/**
 * Hashes a user password with a random 16-byte salt using scrypt.
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

/**
 * Verifies a plaintext password against a stored scrypt hash.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(keyHex, 'hex');
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

