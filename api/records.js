// 기록 목록/저장/삭제. 기록 1건 = records/<id>.json
import { authed, deny, noindex, putFile, listFiles, getFile, delFile, newId } from './_lib.js';

const cache = new Map(); // pathname -> {uploadedAt, rec}

async function loadAll() {
  const files = (await listFiles('records/')).filter(f => f.pathname.endsWith('.json'));
  const out = [];
  const queue = files.slice();
  async function worker() {
    while (queue.length) {
      const f = queue.shift();
      const c = cache.get(f.pathname);
      if (c && c.uploadedAt === f.uploadedAt) { out.push(c.rec); continue; }
      const got = await getFile(f.pathname);
      if (!got) continue;
      try {
        const rec = JSON.parse(got.buffer.toString('utf8'));
        cache.set(f.pathname, { uploadedAt: f.uploadedAt, rec });
        out.push(rec);
      } catch { /* 깨진 파일 무시 */ }
    }
  }
  await Promise.all(Array.from({ length: 16 }, worker));
  return out;
}

const TEXT_FIELDS = ['date', 'machine', 'customer', 'product', 'productName', 'material', 'mold', 'worker', 'notes', 'kind', 'source'];

function clean(input, existing) {
  const r = { ...(existing || {}) };
  for (const k of TEXT_FIELDS) if (k in input) r[k] = String(input[k] ?? '').slice(0, 5000).trim();
  if (input.params && typeof input.params === 'object') {
    const values = {};
    for (const [k, v] of Object.entries(input.params.values || {})) {
      const s = String(v ?? '').trim();
      if (s !== '') values[String(k).slice(0, 60)] = s.slice(0, 60);
    }
    r.params = { template: String(input.params.template || ''), values };
  }
  if (Array.isArray(input.photos)) {
    r.photos = input.photos
      .filter(p => p && typeof p.path === 'string' && /^photos\/[A-Za-z0-9_.-]+$/.test(p.path))
      .map(p => ({ path: p.path, tag: String(p.tag || '').slice(0, 20), w: p.w | 0, h: p.h | 0 }));
  }
  // 사진에서 읽은 화면 값(양식 칸에 없는 값까지 모두 보관)
  if (Array.isArray(input.screens)) {
    const s60 = v => String(v ?? '').slice(0, 60);
    r.screens = input.screens.slice(0, 60).map(s => ({
      photo: typeof s.photo === 'string' && /^photos\/[A-Za-z0-9_.-]+$/.test(s.photo) ? s.photo : '',
      title: s60(s.title), time: s60(s.time),
      items: (Array.isArray(s.items) ? s.items : []).slice(0, 200).map(i => ({ label: s60(i.label), code: s60(i.code), value: s60(i.value), unit: s60(i.unit) })),
    }));
  }
  return r;
}

export default async function handler(req, res) {
  noindex(res);
  if (!authed(req)) return deny(res);

  if (req.method === 'GET') {
    const recs = await loadAll();
    recs.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || ''));
    return res.json({ records: recs });
  }

  if (req.method === 'POST') {
    const input = req.body || {};
    if (!input.customer || !input.product) return res.status(400).json({ error: '거래처와 제품은 꼭 입력하세요' });
    let existing = null;
    let id = input.id;
    if (id) {
      if (!/^[A-Za-z0-9_-]+$/.test(id)) return res.status(400).json({ error: 'bad id' });
      const got = await getFile(`records/${id}.json`);
      if (!got) return res.status(404).json({ error: '기록이 없습니다' });
      existing = JSON.parse(got.buffer.toString('utf8'));
    } else {
      id = newId();
    }
    const rec = clean(input, existing);
    rec.id = id;
    rec.createdAt = existing ? existing.createdAt : new Date().toISOString();
    if (existing) rec.updatedAt = new Date().toISOString();
    if (!rec.date) rec.date = new Date().toISOString().slice(0, 10);
    await putFile(`records/${id}.json`, JSON.stringify(rec), 'application/json');
    return res.json({ record: rec });
  }

  if (req.method === 'DELETE') {
    const id = String(req.query.id || '');
    if (!/^[A-Za-z0-9_-]+$/.test(id)) return res.status(400).json({ error: 'bad id' });
    const got = await getFile(`records/${id}.json`);
    if (got) {
      const rec = JSON.parse(got.buffer.toString('utf8'));
      for (const p of rec.photos || []) await delFile(p.path).catch(() => {});
    }
    await delFile(`records/${id}.json`);
    cache.delete(`records/${id}.json`);
    return res.json({ ok: true });
  }

  res.status(405).end();
}
