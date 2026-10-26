// 공용: 비밀번호(PIN) 확인 + 저장소(Vercel Blob, 로컬 개발 시 .localdata 폴더)
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const ACCESS = process.env.BLOB_ACCESS || 'private';
const USE_BLOB = !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
const LOCAL_DIR = path.join(process.cwd(), '.localdata');

export function pinToken(pin) {
  return crypto.createHash('sha256').update('wc-salt:' + pin).digest('hex');
}

export function authed(req) {
  const pin = process.env.APP_PIN;
  if (!pin) return true; // PIN 미설정이면 잠그지 않음(개발용)
  const m = /(?:^|;\s*)wc_auth=([a-f0-9]+)/.exec(req.headers.cookie || '');
  return !!m && m[1] === pinToken(pin);
}

export function deny(res) {
  res.status(401).json({ error: '비밀번호가 필요합니다' });
}

export function noindex(res) {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Cache-Control', 'no-store');
}

async function blobLib() {
  return await import('@vercel/blob');
}

// 파일 저장. pathname 그대로 저장(덮어쓰기 허용)
export async function putFile(pathname, body, contentType) {
  if (USE_BLOB) {
    const { put } = await blobLib();
    await put(pathname, body, { access: ACCESS, contentType, addRandomSuffix: false, allowOverwrite: true });
    return pathname;
  }
  const f = path.join(LOCAL_DIR, pathname);
  await fs.mkdir(path.dirname(f), { recursive: true });
  await fs.writeFile(f, body);
  return pathname;
}

// prefix 아래 파일 목록 [{pathname, uploadedAt}]
export async function listFiles(prefix) {
  if (USE_BLOB) {
    const { list } = await blobLib();
    const out = [];
    let cursor;
    do {
      const r = await list({ prefix, cursor, limit: 1000 });
      for (const b of r.blobs) out.push({ pathname: b.pathname, uploadedAt: String(b.uploadedAt) });
      cursor = r.hasMore ? r.cursor : undefined;
    } while (cursor);
    return out;
  }
  const dir = path.join(LOCAL_DIR, prefix);
  try {
    const names = await fs.readdir(dir);
    const out = [];
    for (const n of names) {
      const st = await fs.stat(path.join(dir, n));
      out.push({ pathname: prefix + n, uploadedAt: String(st.mtimeMs) });
    }
    return out;
  } catch { return []; }
}

// 파일 읽기 → {buffer, contentType} | null
export async function getFile(pathname) {
  if (USE_BLOB) {
    const { get } = await blobLib();
    const r = await get(pathname, { access: ACCESS, useCache: false });
    if (!r || r.statusCode !== 200) return null;
    const buffer = Buffer.from(await new Response(r.stream).arrayBuffer());
    return { buffer, contentType: r.blob.contentType };
  }
  try {
    const buffer = await fs.readFile(path.join(LOCAL_DIR, pathname));
    const ext = path.extname(pathname).toLowerCase();
    const contentType = ext === '.json' ? 'application/json' : ext === '.png' ? 'image/png' : 'image/jpeg';
    return { buffer, contentType };
  } catch { return null; }
}

export async function delFile(pathname) {
  if (USE_BLOB) {
    const { del } = await blobLib();
    await del(pathname);
    return;
  }
  await fs.rm(path.join(LOCAL_DIR, pathname), { force: true });
}

export function newId() {
  const d = new Date();
  const ymd = d.toISOString().slice(0, 10).replace(/-/g, '');
  return ymd + '-' + crypto.randomBytes(5).toString('hex');
}

// 저장 경로 검사(../ 등 차단)
export function safePath(p, prefix) {
  return typeof p === 'string' && p.startsWith(prefix) && /^[a-z]+\/[A-Za-z0-9_.-]+$/.test(p);
}
