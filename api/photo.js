// 사진 올리기(POST, base64 JPEG) / 보기(GET ?p=photos/...)
import { authed, deny, noindex, putFile, getFile, newId, safePath } from './_lib.js';

export default async function handler(req, res) {
  if (!authed(req)) { noindex(res); return deny(res); }

  if (req.method === 'GET') {
    const p = String(req.query.p || '');
    if (!safePath(p, 'photos/')) return res.status(400).end();
    const got = await getFile(p);
    if (!got) return res.status(404).end();
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('Content-Type', got.contentType || 'image/jpeg');
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    return res.end(got.buffer);
  }

  if (req.method === 'POST') {
    noindex(res);
    const data = String((req.body && req.body.data) || '');
    const m = /^data:image\/(jpeg|png);base64,(.+)$/.exec(data);
    if (!m) return res.status(400).json({ error: '사진 형식이 아닙니다' });
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > 4 * 1024 * 1024) return res.status(413).json({ error: '사진이 너무 큽니다' });
    const ext = m[1] === 'png' ? 'png' : 'jpg';
    const p = await putFile(`photos/${newId()}.${ext}`, buf, `image/${m[1]}`);
    return res.json({ path: p });
  }

  res.status(405).end();
}
