// 거래처별 제품 목록(맵핑). catalog/catalog.json 한 파일
import { authed, deny, noindex, putFile, getFile } from './_lib.js';

const PATH = 'catalog/catalog.json';

function clean(input) {
  const s = (v, n) => String(v ?? '').trim().slice(0, n);
  const customers = [];
  for (const c of Array.isArray(input.customers) ? input.customers : []) {
    const name = s(c.name, 60);
    if (!name || customers.some(x => x.name === name)) continue;
    const seen = new Set();
    const products = [];
    for (const p of Array.isArray(c.products) ? c.products : []) {
      const code = s(p.code, 60), pname = s(p.name, 120);
      const id = code || pname;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      // 현품표 칸: 규격·원료·GRADE·색상·포장수량(소포장/BOX, 포대)·UL·MODEL. lcode/lname 은 현품표에 다르게 찍을 때(빈칸 포함)
      const item = { code, name: pname, note: s(p.note, 200) };
      for (const k of ['spec', 'material', 'grade', 'color', 'pack', 'pack2', 'ul', 'model', 'mold', 'weight']) if (p[k]) item[k] = s(p[k], 200);
      for (const k of ['lcode', 'lname']) if (typeof p[k] === 'string') item[k] = s(p[k], 200);
      products.push(item);
    }
    const i = c.info || {};
    const l = c.label || {};
    const label = { title: s(l.title, 80), extra: ['UL Number', 'MODEL'].includes(l.extra) ? l.extra : '', extraValue: s(l.extraValue, 80), codeLabel: s(l.codeLabel, 20), madeIn: !!l.madeIn,
      hide: (Array.isArray(l.hide) ? l.hide : []).filter(h => ['규격', '원료', 'GRADE', '색상', '생산일자'].includes(h)) };
    customers.push({ name, info: { rep: s(i.rep, 60), phone: s(i.phone, 60), memo: s(i.memo, 4000) }, label, products });
  }
  return { customers, updatedAt: new Date().toISOString() };
}

export default async function handler(req, res) {
  noindex(res);
  if (!authed(req)) return deny(res);
  if (req.method === 'GET') {
    const got = await getFile(PATH);
    return res.json(got ? JSON.parse(got.buffer.toString('utf8')) : { customers: [] });
  }
  if (req.method === 'POST') {
    const cat = clean(req.body || {});
    await putFile(PATH, JSON.stringify(cat), 'application/json');
    return res.json(cat);
  }
  res.status(405).end();
}
