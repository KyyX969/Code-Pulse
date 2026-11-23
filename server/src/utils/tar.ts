import crypto from 'node:crypto';
import zlib from 'node:zlib';

export interface ExtractedRepoFile {
  file: string;
  data: Buffer;
  sha: string;
  size: number;
}

const IGNORED_PATH_PREFIXES = ['.git/', 'node_modules/', '.next/', '.vercel/'];
const MAX_TOTAL_EXTRACTED_BYTES = 50 * 1024 * 1024; // 50 MB safety cap

function readTarString(buf: Buffer, start: number, end: number): string {
  const slice = buf.subarray(start, end);
  const nullIdx = slice.indexOf(0);
  const raw = nullIdx === -1 ? slice : slice.subarray(0, nullIdx);
  return raw.toString('utf8');
}

function parsePaxPath(content: Buffer): string | null {
  const text = content.toString('utf8');
  let cursor = 0;
  while (cursor < text.length) {
    const spaceIdx = text.indexOf(' ', cursor);
    if (spaceIdx === -1) break;
    const len = Number.parseInt(text.slice(cursor, spaceIdx), 10);
    if (!Number.isFinite(len) || len <= 0) break;
    const record = text.slice(spaceIdx + 1, cursor + len - 1);
    const eqIdx = record.indexOf('=');
    if (eqIdx !== -1 && record.slice(0, eqIdx) === 'path') {
      return record.slice(eqIdx + 1);
    }
    cursor += len;
  }
  return null;
}

function normalizeGitHubEntryPath(rawPath: string): string | null {
  const cleaned = rawPath.replace(/\\/g, '/').replace(/^\.\//, '');
  const firstSlash = cleaned.indexOf('/');
  if (firstSlash === -1) return null;
  const rel = cleaned.slice(firstSlash + 1).replace(/^\/+/, '');
  if (!rel || rel.endsWith('/')) return null;
  if (
    IGNORED_PATH_PREFIXES.some(
      (prefix) => rel.startsWith(prefix) || rel.includes(`/${prefix}`),
    )
  ) {
    return null;
  }
  return rel;
}

/**
 * Extracts a gzipped GitHub repository tarball (.tar.gz) in memory, strips the
 * top-level `<owner>-<repo>-<sha>/` folder, and computes SHA-1 digests for Vercel's `/v2/files` API.
 */
export function extractGitHubTarball(gzBuffer: Buffer): ExtractedRepoFile[] {
  const tarBuffer = zlib.gunzipSync(gzBuffer);
  const files: ExtractedRepoFile[] = [];
  let offset = 0;
  let totalBytes = 0;
  let nextPaxPath: string | null = null;
  let nextLongName: string | null = null;

  while (offset + 512 <= tarBuffer.length) {
    const header = tarBuffer.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) {
      break;
    }

    const name = readTarString(header, 0, 100);
    const sizeOctal = readTarString(header, 124, 136).trim();
    const size = Number.parseInt(sizeOctal || '0', 8) || 0;
    const typeflag = String.fromCharCode(header[156] || 0);
    const prefix = readTarString(header, 345, 500);

    const dataStart = offset + 512;
    const dataEnd = dataStart + size;
    if (dataEnd > tarBuffer.length) {
      throw new Error('Corrupted tarball archive returned from GitHub');
    }

    const payload = Buffer.from(tarBuffer.subarray(dataStart, dataEnd));
    offset = dataStart + Math.ceil(size / 512) * 512;

    if (typeflag === 'x') {
      const parsedPath = parsePaxPath(payload);
      if (parsedPath) nextPaxPath = parsedPath;
      continue;
    }

    if (typeflag === 'L') {
      nextLongName = payload.toString('utf8').replace(/\0+$/, '');
      continue;
    }

    if (typeflag === 'g') {
      continue;
    }

    const rawEntryPath = nextPaxPath || nextLongName || (prefix ? `${prefix}/${name}` : name);
    nextPaxPath = null;
    nextLongName = null;

    if (typeflag !== '0' && typeflag !== '\0') {
      continue;
    }

    const relPath = normalizeGitHubEntryPath(rawEntryPath);
    if (!relPath) continue;

    totalBytes += payload.length;
    if (totalBytes > MAX_TOTAL_EXTRACTED_BYTES) {
      throw new Error('Repository snapshot exceeds 50 MB deploy limit');
    }

    files.push({
      file: relPath,
      data: payload,
      sha: crypto.createHash('sha1').update(payload).digest('hex'),
      size: payload.length,
    });
  }

  return files;
}

