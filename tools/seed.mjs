// 기존 엑셀 기록표 + 사진 폴더를 앱으로 옮기는 스크립트(한 번만 실행, 다시 실행하면 이미 있는 건 건너뜀)
// 사용: node tools/seed.mjs <seed폴더> <앱주소> [비밀번호]
//   seed폴더: excel_rows.json 과 photos/<원래 폴더명>/*.jpg 가 있는 곳
import fs from 'node:fs/promises';
import path from 'node:path';

const [seedDir, baseUrl, pin = ''] = process.argv.slice(2);
if (!seedDir || !baseUrl) { console.error('사용: node tools/seed.mjs <seed폴더> <앱주소> [비밀번호]'); process.exit(1); }

let cookie = '';
async function call(p, opt = {}) {
  const r = await fetch(baseUrl.replace(/\/$/, '') + p, { ...opt, headers: { 'Content-Type': 'application/json', cookie, ...(opt.headers || {}) } });
  const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(p + ' ' + r.status + ' ' + (j.error || ''));
  return j;
}

const A_KEYS = [
  ...Array.from({ length: 10 }, (_, i) => '사출속도' + (i + 1)), '사출압력',
  ...Array.from({ length: 10 }, (_, i) => '보압' + (i + 1)), '보압시간', '냉각시간', '계량스트로크',
  ...Array.from({ length: 5 }, (_, i) => '스크류회전' + (i + 1)), ...Array.from({ length: 5 }, (_, i) => '배압' + (i + 1)),
  '노즐1', '실2', '실3', '실4', '실5'];

const clean = v => { const s = String(v ?? '').trim(); return s === '-' ? '' : s; };
const sheets = JSON.parse((await fs.readFile(path.join(seedDir, 'excel_rows.json'), 'utf8')).replace(/^﻿/, ''));
const recs = [];
for (const [name, rows] of Object.entries(sheets)) {
  const isA = name.startsWith('1');
  const header = rows[0];
  const data = rows.slice(isA ? 2 : 1).filter(r => /^\d{4}-\d{2}-\d{2}$/.test(r[0]));
  for (const r of data) {
    const values = {};
    const keys = isA ? A_KEYS : header.slice(5);
    keys.forEach((k, i) => { const v = clean(r[5 + i]); if (v) values[k] = v; });
    recs.push({
      date: r[0], machine: r[1], customer: r[2], product: r[3], material: r[4],
      params: { template: isA ? 'A' : 'B', values }, notes: '', photos: [],
      source: `엑셀 기록표(${name})`,
    });
  }
}

// 사진 폴더: "完 3호기 260915 원일 4T 우드 가스켓"
const nospace = s => s.replace(/\s+/g, '');
const dirs = await fs.readdir(path.join(seedDir, 'photos'));
for (const d of dirs) {
  const m = /(\d+)호기\s+(\d{2})(\d{2})(\d{2})\s+(.*)$/.exec(d);
  if (!m) { console.log('건너뜀(폴더 이름 형식):', d); continue; }
  const [, mach, yy, mm, dd, rest] = m;
  const date = `20${yy}-${mm}-${dd}`;
  let cands = recs.filter(r => r.machine === mach && r.date === date);
  if (cands.length > 1) cands = cands.filter(r => nospace(rest).includes(nospace(r.product)) || nospace(rest).includes(nospace(r.customer) + nospace(r.product)));
  if (cands.length !== 1) { console.log('엑셀 짝을 못 찾음:', d, cands.length); continue; }
  const files = (await fs.readdir(path.join(seedDir, 'photos', d))).filter(f => /\.jpe?g$/i.test(f)).sort();
  cands[0].photoFiles = files.map(f => path.join(seedDir, 'photos', d, f));
  cands[0].source += ` + 사진 폴더 "${d}"`;
}

if (pin) await call('/api/login', { method: 'POST', body: JSON.stringify({ pin }) });
const existing = (await call('/api/records')).records;
const done = new Set(existing.map(r => r.source).filter(Boolean));

for (const r of recs) {
  if (done.has(r.source)) { console.log('이미 있음:', r.date, r.machine + '호기', r.product); continue; }
  for (const f of r.photoFiles || []) {
    const b64 = (await fs.readFile(f)).toString('base64');
    const j = await call('/api/photo', { method: 'POST', body: JSON.stringify({ data: 'data:image/jpeg;base64,' + b64 }) });
    r.photos.push({ path: j.path, tag: '작업조건' });
  }
  delete r.photoFiles;
  await call('/api/records', { method: 'POST', body: JSON.stringify(r) });
  console.log('올림:', r.date, r.machine + '호기', r.customer, r.product, '값', Object.keys(r.params.values).length, '사진', r.photos.length);
}
