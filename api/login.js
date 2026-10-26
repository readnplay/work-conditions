import { pinToken, authed, noindex } from './_lib.js';

export default async function handler(req, res) {
  noindex(res);
  if (req.method === 'GET') return res.json({ ok: authed(req), locked: !!process.env.APP_PIN });
  if (req.method !== 'POST') return res.status(405).end();
  const pin = process.env.APP_PIN;
  const given = String((req.body && req.body.pin) || '');
  if (pin && given !== pin) return res.status(401).json({ error: '비밀번호가 틀렸습니다' });
  const token = pinToken(pin || '');
  const secure = process.env.VERCEL ? '; Secure' : '';
  res.setHeader('Set-Cookie', `wc_auth=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure}`);
  res.json({ ok: true });
}
