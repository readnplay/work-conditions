// 로컬 확인용 서버: index.html + api/*.js 를 Vercel과 비슷하게 실행
// 사용: node tools/dev-server.mjs  (BLOB_READ_WRITE_TOKEN 없으면 .localdata 폴더에 저장)
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const port = +process.env.PORT || 3000;

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  res.status = c => { res.statusCode = c; return res; };
  res.json = o => { if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(o)); };
  try {
    if (url.pathname.startsWith('/api/')) {
      const name = url.pathname.slice(5).replace(/[^a-z]/g, '');
      // 키 없이 화면 흐름을 확인할 때: OCR_MOCK=1 이면 가짜 판독 결과
      if (name === 'ocr' && process.env.OCR_MOCK) {
        const chunks = []; for await (const c of req) chunks.push(c);
        const { keys = [] } = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
        await new Promise(r => setTimeout(r, 800));
        return res.json({ result: { photo_kind: '조건화면', screen_title: '모의 화면', screen_time: '', mold_number: '2603',
          items: [{ label: '1차후진속도', code: 'V6', value: '30', unit: '%' }, { label: '금형후진행정', code: 'A', value: '408.0', unit: 'mm' }],
          mapped: keys.slice(0, 3).map((key, i) => ({ key, value: String(11 + i) })) } });
      }
      const mod = await import(pathToFileURL(path.join(root, 'api', name + '.js')).href);
      req.query = Object.fromEntries(url.searchParams);
      const chunks = []; for await (const c of req) chunks.push(c);
      const raw = Buffer.concat(chunks).toString('utf8');
      req.body = raw && (req.headers['content-type'] || '').includes('json') ? JSON.parse(raw) : raw;
      return await mod.default(req, res);
    }
    const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    const buf = await fs.readFile(path.join(root, path.normalize(file)));
    const ext = path.extname(file);
    res.setHeader('Content-Type', ext === '.html' ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8');
    res.end(buf);
  } catch (e) {
    if (!res.headersSent) res.statusCode = e.code === 'ENOENT' ? 404 : 500;
    res.end(String(e.message || e));
  }
}).listen(port, () => console.log('http://localhost:' + port));
