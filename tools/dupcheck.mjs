// 중복 등록 의심 점검 (읽기만 함, 아무것도 바꾸지 않음)
// 사용: node tools/dupcheck.mjs [--json]
// 찾는 것:
//   1) 이름이 거의 같은 거래처 (띄어쓰기·㈜·주식회사·대소문자 무시)
//   2) 같은 거래처 안에서 코드나 이름이 거의 같은 제품 (제품목록 + 기록에 있는 제품)
//   3) 기록에 이름으로만 저장됐는데 제품목록에 같은 이름의 코드 제품이 있는 경우
//   4) 기록에만 있고 제품목록에 없는 제품 (새 제품이거나 오타)
// 사용자가 "중복 아님"이라고 한 묶음은 seed/dup_ignore.json 에 넣으면 다시 알리지 않음
import fs from 'node:fs';
import path from 'node:path';

const here = import.meta.dirname;
const U = process.env.APP_URL || 'https://work-conditions.vercel.app';
const pin = fs.readFileSync(path.join(here, '../../seed/PIN.txt'), 'utf8').trim();
const ignoreFile = path.join(here, '../../seed/dup_ignore.json');
const ignore = fs.existsSync(ignoreFile) ? JSON.parse(fs.readFileSync(ignoreFile, 'utf8')) : [];

let cookie = '';
async function call(p, opt = {}) {
  const r = await fetch(U + p, { ...opt, headers: { 'Content-Type': 'application/json', cookie } });
  const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
  const j = await r.json(); if (!r.ok) throw new Error(p + ' ' + JSON.stringify(j)); return j;
}
await call('/api/login', { method: 'POST', body: JSON.stringify({ pin }) });
const cat = await call('/api/catalog');
const { records } = await call('/api/records');

const norm = s => String(s || '').toLowerCase().replace(/㈜|\(주\)|주\)|주식회사|\s|[-_./·,()[\]]/g, '');
function lev(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 9;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
// 코드(숫자가 들어간 짧은 기호)는 정확히 같을 때만, 이름은 한 글자 차이까지 같다고 봄
const isCode = s => /\d/.test(s) && !/[가-힣\s]/.test(String(s).trim());
const digits = s => (s.match(/\d+/g) || []).join(',');
const similar = (a, b) => {
  const x = norm(a), y = norm(b);
  if (!x || !y) return false;
  if (x === y) return true;
  if (isCode(a) || isCode(b)) return false;
  // 숫자가 다르면(VD5 / VD9, 1번 / 2번) 다른 제품. 숫자가 같고 글자만 한 자 차이면 의심
  return digits(x) === digits(y) && Math.min(x.length, y.length) >= 6 && lev(x, y) <= 1;
};
const key = arr => arr.map(String).sort().join(' | ');
const ignored = k => ignore.includes(k);
const found = [];

// 1) 거래처
const custNames = [...new Set(cat.customers.map(c => c.name).concat(records.map(r => r.customer)))];
for (let i = 0; i < custNames.length; i++) for (let j = i + 1; j < custNames.length; j++) {
  if (!similar(custNames[i], custNames[j])) continue;
  const k = key(['거래처', custNames[i], custNames[j]]);
  if (ignored(k)) continue;
  const n = c => records.filter(r => r.customer === c).length + ' 기록 / 제품 ' + ((cat.customers.find(x => x.name === c) || {}).products || []).length;
  found.push({ kind: '거래처', key: k, items: [custNames[i], custNames[j]], detail: [`${custNames[i]} (${n(custNames[i])})`, `${custNames[j]} (${n(custNames[j])})`] });
}

// 2)~4) 제품
for (const cname of custNames) {
  const c = cat.customers.find(x => x.name === cname) || { products: [] };
  const recs = records.filter(r => r.customer === cname);
  const items = c.products.map(p => ({ id: p.code || p.name, code: p.code, name: p.name, src: '목록' }));
  for (const id of new Set(recs.map(r => r.product))) if (!items.some(x => x.id === id)) {
    const r = recs.find(x => x.product === id);
    items.push({ id, code: '', name: r.productName || id, src: '기록만' });
  }
  const cnt = id => recs.filter(r => r.product === id).length;
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const a = items[i], b = items[j];
    // 코드가 있는 목록 제품끼리는 이름이 같아도 색상·사양이 다른 정상 제품(예: 하이트론 RAL9016/BLACK)
    if (a.src === '목록' && b.src === '목록' && a.code && b.code && norm(a.code) !== norm(b.code)) continue;
    const why = similar(a.id, b.id) ? '코드/이름이 거의 같음'
      : (a.name && b.name && similar(a.name, b.name)) ? '제품명이 거의 같음'
      : (similar(a.id, b.name) || similar(b.id, a.name)) ? '한쪽 이름이 다른 쪽 코드/이름과 같음' : '';
    const typo = !why && (a.src === '기록만' || b.src === '기록만') && isCode(a.id) && isCode(b.id) && norm(a.id).length === norm(b.id).length && lev(norm(a.id), norm(b.id)) === 1;
    if (!why && !typo) continue;
    const k = key(['제품', cname, a.id, b.id]);
    if (ignored(k)) continue;
    found.push({ kind: typo ? '코드 확인 요청' : '제품', key: k, customer: cname, why: why || '현장에서 입력한 코드가 기존 코드와 한 자리만 다름(오타일 수 있음)', items: [a.id, b.id],
      detail: [a, b].map(x => `${x.id}${x.name && x.name !== x.id ? ' · ' + x.name : ''} (${x.src}, 기록 ${cnt(x.id)}건)`) });
  }
  for (const x of items.filter(x => x.src === '기록만')) {
    const k = key(['목록없음', cname, x.id]);
    if (ignored(k) || found.some(f => f.customer === cname && f.items.includes(x.id))) continue;
    found.push({ kind: '목록에 없음', key: k, customer: cname, items: [x.id], detail: [`${x.id} (기록 ${cnt(x.id)}건) — 새 제품이면 제품목록에 넣고, 기존 제품이면 합치기`] });
  }
}

if (process.argv.includes('--json')) { console.log(JSON.stringify(found, null, 1)); process.exit(0); }
if (!found.length) { console.log('중복 의심 없음 (거래처 ' + custNames.length + '곳, 기록 ' + records.length + '건 점검)'); process.exit(0); }
found.forEach((f, i) => {
  console.log(`\n[${i + 1}] ${f.kind}${f.customer ? ' · ' + f.customer : ''}${f.why ? ' · ' + f.why : ''}`);
  f.detail.forEach(d => console.log('   - ' + d));
  console.log('   key: ' + f.key);
});
