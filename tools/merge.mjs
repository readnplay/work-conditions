// 중복 합치기 (사용자가 승인한 것만 실행). 실행 전 seed/backups/ 에 전체 백업
// 사용:
//   node tools/merge.mjs product  <거래처> <남길 제품ID> <합칠 제품ID> [...]   기록을 남길 제품으로 옮기고, 비어 있는 칸은 합칠 제품 정보로 채운 뒤 목록에서 지움
//   node tools/merge.mjs customer <남길 거래처> <합칠 거래처>                   기록·제품목록·거래처 정보를 남길 거래처로 합침
//   node tools/merge.mjs add      <거래처> <제품ID> [제품명]                     기록에만 있던 제품을 제품목록에 새 제품으로 넣음
//   node tools/merge.mjs ignore   "<점검 key>"                                   "중복 아님" — 다음 점검부터 알리지 않음
import fs from 'node:fs';
import path from 'node:path';

const here = import.meta.dirname;
const seed = path.join(here, '../../seed');
const U = process.env.APP_URL || 'https://work-conditions.vercel.app';
const [cmd, ...args] = process.argv.slice(2);
if (!cmd) { console.error('사용법은 파일 맨 위 주석 참고'); process.exit(1); }

if (cmd === 'ignore') {
  const f = path.join(seed, 'dup_ignore.json');
  const list = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : [];
  if (!list.includes(args[0])) list.push(args[0]);
  fs.writeFileSync(f, JSON.stringify(list, null, 1));
  console.log('중복 아님으로 기록:', args[0]);
  process.exit(0);
}

let cookie = '';
async function call(p, opt = {}) {
  const r = await fetch(U + p, { ...opt, headers: { 'Content-Type': 'application/json', cookie } });
  const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
  const j = await r.json(); if (!r.ok) throw new Error(p + ' ' + JSON.stringify(j)); return j;
}
await call('/api/login', { method: 'POST', body: JSON.stringify({ pin: fs.readFileSync(path.join(seed, 'PIN.txt'), 'utf8').trim() }) });
const cat = await call('/api/catalog');
const { records } = await call('/api/records');
fs.mkdirSync(path.join(seed, 'backups'), { recursive: true });
const bk = path.join(seed, 'backups', `merge_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
fs.writeFileSync(bk, JSON.stringify({ cat, records }));
console.log('백업:', bk);

const idOf = p => p.code || p.name;
const fill = (to, from) => { for (const [k, v] of Object.entries(from || {})) if (v && !to[k]) to[k] = v; };
const move = async (r, fields) => {
  await call('/api/records', { method: 'POST', body: JSON.stringify({ id: r.id, customer: fields.customer || r.customer, product: fields.product || r.product, productName: fields.productName ?? r.productName }) });
};

if (cmd === 'product') {
  const [cname, keep, ...from] = args;
  const c = cat.customers.find(x => x.name === cname);
  if (!c) throw new Error('제품목록에 거래처 없음: ' + cname);
  let k = c.products.find(p => idOf(p) === keep);
  if (!k) throw new Error('남길 제품이 제품목록에 없음: ' + keep + ' (먼저 add 로 넣기)');
  for (const f of from) {
    const fp = c.products.find(p => idOf(p) === f);
    if (fp) { fill(k, { ...fp, code: '', name: '', note: '' }); if (fp.note && !(k.note || '').includes(fp.note)) k.note = [k.note, fp.note].filter(Boolean).join(' / '); }
    c.products = c.products.filter(p => idOf(p) !== f);
    for (const r of records.filter(r => r.customer === cname && r.product === f)) {
      await move(r, { product: keep, productName: k.code ? k.name : '' });
      console.log('기록 이동:', r.date, cname, f, '→', keep);
    }
  }
} else if (cmd === 'customer') {
  const [keep, from] = args;
  let k = cat.customers.find(x => x.name === keep);
  const f = cat.customers.find(x => x.name === from);
  if (!k) { k = { name: keep, info: {}, label: {}, products: [] }; cat.customers.push(k); }
  if (f) {
    k.info ||= {}; k.label ||= {}; fill(k.info, f.info); fill(k.label, f.label);
    for (const p of f.products || []) { const e = k.products.find(x => idOf(x) === idOf(p)); if (e) fill(e, p); else k.products.push(p); }
    cat.customers = cat.customers.filter(x => x.name !== from);
  }
  for (const r of records.filter(r => r.customer === from)) {
    await move(r, { customer: keep });
    console.log('기록 이동:', r.date, from, '→', keep, r.product);
  }
} else if (cmd === 'add') {
  const [cname, id, name] = args;
  let c = cat.customers.find(x => x.name === cname);
  if (!c) { c = { name: cname, info: {}, label: {}, products: [] }; cat.customers.push(c); }
  if (!c.products.some(p => idOf(p) === id)) {
    const isCode = /\d/.test(id) && !/[가-힣\s]/.test(id);
    c.products.push({ code: isCode ? id : '', name: isCode ? (name || '') : id, note: '현장 기록에서 추가' });
  }
  console.log('제품목록에 추가:', cname, id, name || '');
} else throw new Error('모르는 명령: ' + cmd);

await call('/api/catalog', { method: 'POST', body: JSON.stringify(cat) });
console.log('제품목록 저장 완료');
