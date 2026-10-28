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
      products.push({ code, name: pname, note: s(p.note, 200) });
    }
    customers.push({ name, products });
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
