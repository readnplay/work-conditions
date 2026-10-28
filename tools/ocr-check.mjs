// 사진 인식 정확도 확인: 엑셀 값이 있는 기존 기록의 사진을 읽게 해서, 읽은 값과 엑셀 값을 비교
// 사용: node tools/ocr-check.mjs <앱주소> <비밀번호> [기록 수(기본 2)]
// 기록은 바꾸지 않고 비교 결과만 출력합니다.
const [baseUrl, pin, nArg = '2', outFile = ''] = process.argv.slice(2);
const dump = [];
if (!baseUrl || !pin) { console.error('사용: node tools/ocr-check.mjs <앱주소> <비밀번호> [기록 수]'); process.exit(1); }

let cookie = '';
async function call(p, opt = {}) {
  const r = await fetch(baseUrl.replace(/\/$/, '') + p, { ...opt, headers: { 'Content-Type': 'application/json', cookie } });
  const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(p + ' ' + r.status + ' ' + (j.error || ''));
  return j;
}

await call('/api/login', { method: 'POST', body: JSON.stringify({ pin }) });
const { records } = await call('/api/records');
// 4~6호기 하나, 1~3호기 하나씩 고르기
const withPh = records.filter(r => (r.photos || []).length && Object.keys(r.params?.values || {}).length);
const picks = [withPh.find(r => r.params.template === 'B'), withPh.find(r => r.params.template === 'A'), ...withPh].filter(Boolean)
  .filter((r, i, a) => a.indexOf(r) === i).slice(0, +nArg);

for (const r of picks) {
  const expect = r.params.values;
  const keys = Object.keys(expect);
  const got = {};
  let items = 0;
  const t0 = Date.now();
  for (const ph of r.photos) {
    try {
      const j = await call('/api/ocr', { method: 'POST', body: JSON.stringify({ path: ph.path, machine: r.machine, keys }) });
      items += j.result.items.length;
      dump.push({ record: r.id, photo: ph.path, ...j.result });
      for (const m of j.result.mapped) if (!(m.key in got)) got[m.key] = m.value;
    } catch (e) { console.log('  실패', ph.path, e.message); }
  }
  const num = v => String(v).replace(/[^\d.\-]/g, '').replace(/\.0+$/, '').replace(/^(-?)0+(?=\d)/, '$1');
  let ok = 0, wrong = [], missing = 0;
  for (const k of keys) {
    if (!(k in got)) { missing++; continue; }
    if (num(got[k]) === num(expect[k])) ok++; else wrong.push(`${k}: 엑셀 ${expect[k]} / 읽음 ${got[k]}`);
  }
  console.log(`\n${r.date} ${r.machine}호기 ${r.customer} ${r.product} — 사진 ${r.photos.length}장, ${Math.round((Date.now() - t0) / 1000)}초`);
  console.log(`  엑셀 칸 ${keys.length}개 중: 맞음 ${ok}, 틀림 ${wrong.length}, 못 찾음 ${missing} · 화면에서 읽은 값 총 ${items}개`);
  for (const w of wrong.slice(0, 15)) console.log('   ✗ ' + w);
}
if (outFile) (await import('node:fs')).writeFileSync(outFile, JSON.stringify(dump, null, 1));
