// 작업조건 사진 1장 → 화면 값 읽기 (Claude). POST {path, machine, keys:[양식 칸 이름]}
import Anthropic from '@anthropic-ai/sdk';
import { authed, deny, noindex, getFile, safePath } from './_lib.js';

const SYSTEM = `당신은 사출성형기 컨트롤러 화면 사진을 읽어 작업조건을 기록하는 도우미입니다.

할 일
1. 사진 속 화면에 보이는 설정값을 하나도 빠짐없이 items 에 옮겨 적습니다.
   - label: 화면에 적힌 항목 이름(한국어 그대로, 예: "1차후진속도", "보압 시간")
   - code: 항목 옆 기호가 있으면 그대로(예: "V6", "W4", "SP1", "PR2H"), 없으면 ""
   - value: 화면에 표시된 숫자/글자 그대로(소수점 유지, 예: "30", "408.0", "아니오")
   - unit: 단위가 보이면 그대로(예: "%", "mm", "bar", "s", "℃"), 없으면 ""
   - 표 형태 화면(행×열)은 "행이름 열이름"으로 label을 만듭니다(예: label "형개 SP", code "SP1").
   - 실제값(현재값, 모니터 값)과 설정값이 함께 있으면 설정값을 기록하고, 실제값은 label 끝에 "(현재)"를 붙여 따로 기록합니다.
2. mapped 에는 아래 "양식 칸" 중 이 화면에서 확실히 대응되는 값만 넣습니다. 애매하면 넣지 않습니다. 추측 금지.
3. 읽을 수 없거나 가려진 값은 적지 않습니다. 화면이 아닌 사진(금형, 제품, 원료 등)이면 items 와 mapped 를 비워 두고 photo_kind 로 알려 줍니다.

양식 설명
- 1~3호기 양식(녹색 계열 한글 화면): 사출속도1~10 = 사출 속도 프로파일 단계별 값, 사출압력 = 사출 압력(bar),
  보압1~10 = 보압 단계별 값, 보압시간, 냉각시간, 계량스트로크(mm), 스크류회전1~5(%), 배압1~5(bar),
  노즐1·실2~실5 = 히터 온도 존(노즐 쪽부터 순서대로).
- 4~6호기 양식(Selex 화면): 칸 이름이 화면 표기와 같습니다. 예: "형개 SP1(%)" = 형개 화면 SP 1단, "보압 PR2H(bar)" = 보압 PR 2H,
  "계량 BP3C(%)" = 계량 배압 3C, "히터 NZ(℃)" = 노즐 히터 설정 온도, "사이클시간(s)" 등 모니터 화면의 시간 값.`;

const SCHEMA = keys => ({
  type: 'object',
  additionalProperties: false,
  required: ['photo_kind', 'screen_title', 'screen_time', 'mold_number', 'items', 'mapped'],
  properties: {
    photo_kind: { type: 'string', enum: ['조건화면', '금형', '제품', '원료', '기타'] },
    screen_title: { type: 'string', description: '화면 제목(예: 금형후진, 01 전체 기계 동작). 없으면 ""' },
    screen_time: { type: 'string', description: '화면에 표시된 날짜·시각. 없으면 ""' },
    mold_number: { type: 'string', description: '화면에 금형번호가 보이면(예: 금형 : 2603) 그 값. 없으면 ""' },
    items: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['label', 'code', 'value', 'unit'],
        properties: { label: { type: 'string' }, code: { type: 'string' }, value: { type: 'string' }, unit: { type: 'string' } },
      },
    },
    mapped: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['key', 'value'],
        properties: { key: { type: 'string', enum: keys }, value: { type: 'string' } },
      },
    },
  },
});

let client;

export default async function handler(req, res) {
  noindex(res);
  if (!authed(req)) return deny(res);
  if (req.method !== 'POST') return res.status(405).end();
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: '사진 인식 키(ANTHROPIC_API_KEY)가 아직 설정되지 않았습니다' });

  const { path, machine = '', keys } = req.body || {};
  if (!safePath(path, 'photos/')) return res.status(400).json({ error: 'bad path' });
  const keyList = Array.isArray(keys) ? keys.map(k => String(k).slice(0, 60)).filter(Boolean).slice(0, 300) : [];
  if (!keyList.length) return res.status(400).json({ error: 'keys 필요' });

  const got = await getFile(path);
  if (!got) return res.status(404).json({ error: '사진이 없습니다' });
  const mediaType = got.contentType === 'image/png' ? 'image/png' : 'image/jpeg';

  client ||= new Anthropic();
  try {
    const response = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA(keyList) } },
      system: SYSTEM,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: got.buffer.toString('base64') } },
          { type: 'text', text: `${machine ? machine + '호기' : '호기 미상'} 사진입니다.\n양식 칸 목록: ${keyList.join(', ')}` },
        ],
      }],
    });
    if (response.stop_reason === 'refusal') return res.status(422).json({ error: '이 사진은 읽지 못했습니다' });
    const text = response.content.find(b => b.type === 'text');
    if (!text) return res.status(502).json({ error: '읽은 결과가 비어 있습니다' });
    const out = JSON.parse(text.text);
    const allowed = new Set(keyList);
    out.mapped = (out.mapped || []).filter(m => allowed.has(m.key) && String(m.value).trim() !== '');
    return res.json({ result: out, truncated: response.stop_reason === 'max_tokens' });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return res.status(503).json({ error: '사진 인식 키가 올바르지 않습니다' });
    if (e instanceof Anthropic.RateLimitError) return res.status(429).json({ error: '잠시 후 다시 시도해 주세요(요청이 많음)' });
    if (e instanceof Anthropic.APIError) return res.status(502).json({ error: `사진 인식 오류 ${e.status}` });
    if (e instanceof SyntaxError) return res.status(502).json({ error: '읽은 결과를 해석하지 못했습니다' });
    throw e;
  }
}
