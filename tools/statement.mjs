// 거래명세서 PDF 만들기 (기존 ★★ 거래명세서.xlsx 양식: A4 한 장에 공급받는자용 + 공급자용)
// 사용: node tools/statement.mjs <입력.json> <출력.pdf>
// 입력: { customerName, date:'2026-11-11', items:[{date:'11/11', name, qty, price, note}], vat:true }
//   공급받는자 정보는 앱 제품목록의 거래처 info.bill 에서 가져옴(없으면 입력의 buyer 사용)
//   인장은 비공개 폴더 seed/stamp.jpg (공개 저장소에 넣지 않음)
// 발행하면 사용한 단가를 제품목록의 최종 단가(price)로 저장하고 단가 이력(priceHist)에 추가 (--no-update 로 끔)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const [inFile, outFile] = process.argv.slice(2);
const noUpdate = process.argv.includes('--no-update');
if (!inFile || !outFile) { console.error('사용: node tools/statement.mjs <입력.json> <출력.pdf> [--no-update]'); process.exit(1); }
const here = import.meta.dirname;
const seed = path.join(here, '../../seed');
const U = process.env.APP_URL || 'https://work-conditions.vercel.app';
const req = JSON.parse(fs.readFileSync(inFile, 'utf8').replace(/^\uFEFF/, ''));

// 공급자(우리 회사) 정보는 비공개 폴더 seed/supplier.json (공개 저장소에 넣지 않음)
const SUPPLIER = JSON.parse(fs.readFileSync(path.join(seed, 'supplier.json'), 'utf8'));

let cookie = '';
async function call(p, opt = {}) {
  const r = await fetch(U + p, { ...opt, headers: { 'Content-Type': 'application/json', cookie } });
  const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
  const j = await r.json(); if (!r.ok) throw new Error(p + ' ' + JSON.stringify(j)); return j;
}
await call('/api/login', { method: 'POST', body: JSON.stringify({ pin: fs.readFileSync(path.join(seed, 'PIN.txt'), 'utf8').trim() }) });
const cat = await call('/api/catalog');
const cust = cat.customers.find(c => c.name === req.customerName);
const buyer = req.buyer || (cust && cust.info && cust.info.bill);
if (!buyer) throw new Error('공급받는자 사업자 정보가 없습니다: ' + req.customerName);

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const won = n => (n === '' || n == null) ? '' : Number(n) === 0 ? '-' : Math.round(Number(n)).toLocaleString('ko-KR');
const items = req.items.map(it => {
  const qty = Number(String(it.qty).replace(/,/g, '')) || 0, price = Number(String(it.price).replace(/,/g, '')) || 0;
  const supply = Math.round(qty * price), tax = req.vat === false ? 0 : Math.round(supply * 0.1);
  return { ...it, qty, price, supply, tax };
});
const sum = k => items.reduce((a, b) => a + b[k], 0);
const total = { supply: sum('supply'), tax: sum('tax') };
const rowsN = Math.max(5, items.length);
const stamp = fs.existsSync(path.join(seed, 'stamp.jpg')) ? 'data:image/jpeg;base64,' + fs.readFileSync(path.join(seed, 'stamp.jpg')).toString('base64') : '';
const dateTxt = req.date || new Date().toISOString().slice(0, 10);

const party = (label, p, withStamp) => `
  <table class="pt"><tr><td class="side" rowspan="5">${label.split('').join('<br>')}</td>
    <td class="k">등록번호</td><td class="v b" colspan="3">${esc(p.bizNo)}</td></tr>
    <tr><td class="k">상호</td><td class="v b" colspan="3">${esc(p.name)}</td></tr>
    <tr><td class="k">성명</td><td class="v rel">${esc(p.ceo)}${withStamp && stamp ? `<img class="stamp" src="${stamp}">` : ''}</td><td class="k s">TEL</td><td class="v">${esc(p.tel)}</td></tr>
    <tr><td class="k">업태</td><td class="v">${esc(p.bizType)}</td><td class="k s">종목</td><td class="v">${esc(p.bizItem)}</td></tr>
    <tr><td class="k">주소</td><td class="v addr" colspan="3">${esc(p.addr)}</td></tr></table>`;

const copy = title => `<section class="cp">
  <div class="tt"><span>거 래 명 세 서</span><small>(${esc(title)})</small><em>${esc(dateTxt)}</em></div>
  <div class="parties">${party('공급자', SUPPLIER, true)}${party('공급받는자', buyer, false)}</div>
  <table class="it"><thead><tr><th style="width:9%">날짜</th><th>품명 및 규격</th><th style="width:10%">수량</th><th style="width:10%">단가</th><th style="width:14%">공급가액</th><th style="width:11%">세액</th><th style="width:11%">비고</th></tr></thead>
    <tbody>${Array.from({ length: rowsN }, (_, i) => { const it = items[i];
      return it ? `<tr><td>${esc(it.date)}</td><td class="l">${esc(it.name)}</td><td class="r">${won(it.qty)}</td><td class="r">${won(it.price)}</td><td class="r">${won(it.supply)}</td><td class="r">${won(it.tax)}</td><td>${esc(it.note || '')}</td></tr>`
        : '<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>'; }).join('')}</tbody></table>
  <table class="ft"><tr><td class="k" style="width:9%">인수인</td><td style="width:22%;text-align:right;padding-right:3mm">(인)</td>
    <td class="k" style="width:10%">공급가액</td><td class="r b">${won(total.supply)}</td><td class="k" style="width:8%">세액</td><td class="r b">${won(total.tax)}</td>
    <td class="k" style="width:8%">합계</td><td class="r b">${won(total.supply + total.tax)}</td></tr></table>
</section>`;

const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>거래명세서</title><style>
@page{size:A4 portrait;margin:0}
body{margin:0;font-family:"Malgun Gothic","맑은 고딕",sans-serif;color:#000}
.page{width:210mm;height:297mm;box-sizing:border-box;padding:10mm 10mm;display:flex;flex-direction:column;justify-content:space-between}
.cp{height:132mm;display:flex;flex-direction:column;gap:2mm}
.cut{border-top:1px dashed #888;margin:0 -4mm}
.tt{display:flex;align-items:baseline;gap:3mm;border-bottom:2px solid #000;padding-bottom:1mm}
.tt span{font-size:18pt;font-weight:800;letter-spacing:2mm}.tt small{font-size:10pt}.tt em{margin-left:auto;font-style:normal;font-size:10pt}
.parties{display:grid;grid-template-columns:1fr 1fr;gap:2mm}
table{border-collapse:collapse;width:100%;table-layout:fixed}
td,th{border:1px solid #000;padding:0.6mm 1.2mm;font-size:8.5pt;height:5.2mm;vertical-align:middle;overflow:hidden}
.pt .side{width:6mm;text-align:center;font-weight:700;background:#eee;line-height:1.2;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.pt .k{width:13mm;text-align:center;background:#f4f4f4;font-weight:700;-webkit-print-color-adjust:exact;print-color-adjust:exact}.pt .k.s{width:9mm}
.pt .addr{font-size:7.5pt;white-space:normal;line-height:1.15}
.rel{position:relative}.stamp{position:absolute;left:11mm;top:-3.5mm;width:13mm;height:12mm;object-fit:contain;mix-blend-mode:multiply;opacity:.9}
.b{font-weight:700}
.it th{background:#eee;font-size:8.5pt;-webkit-print-color-adjust:exact;print-color-adjust:exact}.it td{text-align:center;height:6mm}
.it td.l{text-align:left}.r{text-align:right!important}
.ft td{height:7mm;font-size:9.5pt}.ft .k{text-align:center;background:#f4f4f4;font-weight:700;-webkit-print-color-adjust:exact;print-color-adjust:exact}
</style></head><body><div class="page">${copy('공급받는자용')}<div class="cut"></div>${copy('공급자용_가온텍')}</div></body></html>`;

const htmlFile = outFile.replace(/\.pdf$/i, '') + '.html';
fs.writeFileSync(htmlFile, html);
const edge = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(f => fs.existsSync(f));
if (edge) execFileSync(edge, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', `--print-to-pdf=${path.resolve(outFile)}`, 'file:///' + path.resolve(htmlFile).replace(/\\/g, '/')], { stdio: 'ignore' });
console.log('PDF:', path.resolve(outFile), '공급가액', total.supply, '세액', total.tax, '합계', total.supply + total.tax);

// 발행 기록 + 최종 단가 갱신
const dataDir = path.join(here, '../../거래명세서/data');
fs.mkdirSync(dataDir, { recursive: true });
fs.writeFileSync(path.join(dataDir, `${dateTxt}_${req.customerName}_${Date.now()}.json`), JSON.stringify({ ...req, buyer, items, total, file: path.resolve(outFile) }, null, 1));
if (!noUpdate && cust) {
  let changed = false;
  for (const it of items) {
    if (!it.productId || !it.price) continue;
    const p = cust.products.find(x => (x.code || x.name) === it.productId);
    if (!p) { console.log('제품목록에 없어 단가 저장 안 함:', it.productId); continue; }
    p.price = String(it.price);
    p.priceHist = (p.priceHist || []).concat([{ date: dateTxt, price: it.price, qty: it.qty, src: '거래명세서' }]).slice(-50);
    changed = true;
    console.log('최종 단가 저장:', req.customerName, it.productId, it.price);
  }
  if (changed) await call('/api/catalog', { method: 'POST', body: JSON.stringify(cat) });
}
