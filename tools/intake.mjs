// 대화로 받은 거래처·제품 정보/사진을 앱에 넣는 도구
// 사용: node tools/intake.mjs <입력.json> [--dry]
//   --dry: 저장하지 않고 사진 판독 결과만 출력(사진 확인용). 기존 사진만 쓰면 아무것도 바뀌지 않음
// 입력: 항목 배열
//   { customer*, product*(코드 또는 이름), productName, machine, date, material, mold, worker, notes,
//     photos:[로컬 파일], photoPaths:[이미 올린 photos/...], tag:'작업조건' }
//   기록 내용(원료·금형·특이사항·사진)이 없으면 제품 목록에만 넣음
import fs from 'node:fs';
import path from 'node:path';

const U = process.env.APP_URL || 'https://work-conditions.vercel.app';
const file = process.argv[2];
const dry = process.argv.includes('--dry');
if (!file) { console.error('사용: node tools/intake.mjs <입력.json> [--dry]'); process.exit(1); }
const pin = fs.readFileSync(path.join(import.meta.dirname, '../../seed/PIN.txt'), 'utf8').trim();

let cookie = '';
async function call(p, opt = {}) {
  const r = await fetch(U + p, { ...opt, headers: { 'Content-Type': 'application/json', cookie } });
  const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${p} ${r.status} ${j.error || ''}`);
  return j;
}

// 양식 칸 목록은 index.html 의 TEMPLATES 를 그대로 사용
const html = fs.readFileSync(path.join(import.meta.dirname, '../index.html'), 'utf8');
const src = html.slice(html.indexOf('const range = '), html.indexOf('const MACHINES'));
const TEMPLATES = new Function(src + '; return TEMPLATES;')();
const keysOf = t => TEMPLATES[t].grids.flatMap(g => g.rows.flatMap(r => r.keys)).filter(Boolean).concat(TEMPLATES[t].singles.map(s => s[0]));
const templateFor = m => (parseInt(m, 10) >= 4 ? 'B' : 'A');
const looksLikeCode = s => /^[A-Za-z0-9-]*\d[A-Za-z0-9-]*$/.test(s);

await call('/api/login', { method: 'POST', body: JSON.stringify({ pin }) });
const catalog = await call('/api/catalog');
const entries = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
let catalogChanged = false;

for (const e of entries) {
  if (!e.customer || !e.product) { console.log('건너뜀(거래처/제품 없음):', JSON.stringify(e)); continue; }
  const tag = e.tag || '작업조건';
  const stored = (e.photoPaths || []).map(p => ({ path: p, tag }));
  if (!dry || !stored.length) for (const f of e.photos || []) {
    const ext = path.extname(f).toLowerCase() === '.png' ? 'png' : 'jpeg';
    const data = `data:image/${ext};base64,` + fs.readFileSync(f).toString('base64');
    const j = await call('/api/photo', { method: 'POST', body: JSON.stringify({ data }) });
    stored.push({ path: j.path, tag });
  }

  // 사진 판독(작업조건 사진 + 호기를 알 때)
  const values = {}, screens = [];
  if (tag === '작업조건' && e.machine) {
    const keys = keysOf(templateFor(e.machine));
    for (const ph of stored) {
      const { result: r } = await call('/api/ocr', { method: 'POST', body: JSON.stringify({ path: ph.path, machine: e.machine, keys }) });
      console.log(`  판독 ${ph.path}: [${r.photo_kind}] ${r.screen_title} 시각 ${r.screen_time || '-'} 금형 ${r.mold_number || '-'} · 값 ${r.items.length}개, 칸 ${r.mapped.length}개`);
      for (const m of r.mapped) if (!(m.key in values)) values[m.key] = m.value;
      screens.push({ photo: ph.path, title: r.screen_title, time: r.screen_time, items: r.items });
      if (r.mold_number && !e.mold) e.mold = r.mold_number;
    }
  }
  if (dry) { console.log('확인만(저장 안 함):', e.customer, e.product, '금형', e.mold || '-', '칸', Object.keys(values).length); continue; }

  // 제품 목록에 추가(없을 때만)
  let c = catalog.customers.find(x => x.name === e.customer);
  if (!c) { c = { name: e.customer, products: [] }; catalog.customers.push(c); catalogChanged = true; }
  const code = looksLikeCode(e.product) ? e.product : '';
  const name = code ? (e.productName || '') : e.product;
  const hit = c.products.find(p => (p.code || p.name) === e.product);
  if (!hit) { c.products.push({ code, name, note: '' }); catalogChanged = true; console.log('제품 목록 추가:', e.customer, e.product, name); }
  else if (code && name && !hit.name) { hit.name = name; catalogChanged = true; }

  if (e.material || e.mold || e.notes || stored.length) {
    const rec = { ...e, photos: stored, screens, params: { template: templateFor(e.machine || '1'), values } };
    delete rec.photoPaths; delete rec.tag;
    const j = await call('/api/records', { method: 'POST', body: JSON.stringify(rec) });
    console.log('기록 저장:', j.record.date, (j.record.machine || '?') + '호기', e.customer, e.product, '사진', stored.length, '칸', Object.keys(values).length);
  }
}
if (catalogChanged) {
  const j = await call('/api/catalog', { method: 'POST', body: JSON.stringify(catalog) });
  console.log('제품 목록 저장:', j.customers.map(c => `${c.name} ${c.products.length}개`).join(', '));
}
