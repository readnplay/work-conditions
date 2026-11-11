// 현품표 PDF 파일 만들기 (대화로 요청받을 때)
// 사용: node tools/label.mjs <입력.json> <출력.pdf>
// 금형 표찰: { type:'mold', tag:{customer,code,name,mold,line,material,grade,color,weight,note,cond:[[라벨,값]],condDate,photo:<로컬 사진 경로>}, count }
// 입력: { customer:{name, label:{title, extra, extraValue, codeLabel, madeIn}}, product:{code,name,spec,material,grade,color,pack,ul,model}, qty, date, count }
//   customer/product 대신 { customerName, productId } 를 주면 앱의 제품 목록에서 찾아 씀
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const [inFile, outFile] = process.argv.slice(2);
if (!inFile || !outFile) { console.error('사용: node tools/label.mjs <입력.json> <출력.pdf>'); process.exit(1); }
const here = import.meta.dirname;
new Function(fs.readFileSync(path.join(here, '../label.js'), 'utf8'))();
const { LABEL_CSS, labelPagesHTML, MOLD_CSS, moldTagPagesHTML } = globalThis.GaonLabel;

const req = JSON.parse(fs.readFileSync(inFile, 'utf8').replace(/^\uFEFF/, ''));
let { customer, product } = req;
if (req.type !== 'mold' && (!customer || !product)) {
  const U = process.env.APP_URL || 'https://work-conditions.vercel.app';
  const pin = fs.readFileSync(path.join(here, '../../seed/PIN.txt'), 'utf8').trim();
  const lr = await fetch(U + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin }) });
  const cookie = (lr.headers.get('set-cookie') || '').split(';')[0];
  const cat = await (await fetch(U + '/api/catalog', { headers: { cookie } })).json();
  customer = cat.customers.find(c => c.name === req.customerName);
  if (!customer) throw new Error('거래처 없음: ' + req.customerName);
  product = customer.products.find(p => (p.code || p.name) === req.productId) || customer.products[0];
}
const logo = 'data:image/png;base64,' + fs.readFileSync(path.join(here, '../logo.png')).toString('base64');
const dataUrl = f => `data:image/${/.png$/i.test(f) ? 'png' : 'jpeg'};base64,` + fs.readFileSync(f).toString('base64');
const body = req.type === 'mold'
  ? moldTagPagesHTML({ ...req.tag, photo: req.tag.photo ? dataUrl(req.tag.photo) : '' }, req.count, logo)
  : labelPagesHTML(customer, product, { qty: req.qty, date: req.date, count: req.count, small: req.small }, logo);
const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${req.type === 'mold' ? '금형 표찰' : '현품표'}</title><style>body{margin:0}${req.type === 'mold' ? MOLD_CSS : LABEL_CSS}</style></head>
<body>${body}</body></html>`;
const htmlFile = outFile.replace(/\.pdf$/i, '') + '.html';
fs.writeFileSync(htmlFile, html);

const edge = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(f => fs.existsSync(f));
if (!edge) { console.log('Edge가 없어 HTML만 만들었습니다:', htmlFile); process.exit(0); }
execFileSync(edge, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', `--print-to-pdf=${path.resolve(outFile)}`, 'file:///' + path.resolve(htmlFile).replace(/\\/g, '/')], { stdio: 'ignore' });
console.log('PDF:', path.resolve(outFile), fs.statSync(outFile).size, 'bytes');
