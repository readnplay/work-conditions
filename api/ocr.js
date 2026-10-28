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

양식 칸 연결 규칙 (화면에 해당 값이 있으면 빠짐없이 mapped 에 넣으세요. 항상 설정값을 쓰고 "(현재)" 값은 쓰지 않습니다)

1~3호기(녹색 바탕 한글 화면, 화면 제목 예: 사출, 보압, 계량, 히팅, 금형전진)
- "사출" 화면: 사출속도 설정 칸(보통 2줄 × 5칸) → 윗줄 왼쪽부터 사출속도1~5, 아랫줄 사출속도6~10.
  사출압력 설정(P6, bar) → 사출압력.
- "보압" 화면: 보압 값들을 화면 순서대로 → 보압1, 보압2, … 보압10 (P7~P16 묶음도 순서대로 이어서).
  보압시간(Z2) → 보압시간, 냉각시간(Z4) → 냉각시간.
- "계량" 화면: 계량스트로크(C1) → 계량스트로크, 스크류회전속도 1~5 → 스크류회전1~5, 배압 1~5 → 배압1~5.
- "히팅" 화면: 노즐 1 → 노즐1, 실린더 2 → 실2, 실린더 3 → 실3, 실린더 4 → 실4, 실린더 5 → 실5 (설정 온도).
- "고속 설정" 같은 요약 화면에 같은 값이 있으면 그것으로 채워도 됩니다(V, C1, Z2, Z4, PS 등).

4~6호기(Selex 화면, 화면 위에 "01 전체 기계 동작", "02 형체", "03 사출/계량" 같은 제목)
- "02 형체": 왼쪽 표(형폐 그림 아래, 번호 1→5) → 형폐 SP1~5(속도 %), 형폐 PR1~5(압력 bar), 형폐 POS1~4(거리 mm).
  오른쪽 표(형개 그림 아래, 번호 5→1) → 형개 SP5~1, 형개 PR5~1, 형개 POS5~1. 번호 칸 머리글을 보고 맞추세요.
  형폐시간 → 형폐시간(s), 형개시간 → 형개시간(s).
- "03 사출/계량": 사출 표(4→1) → 사출 SP/PR/POS 4~1, 사출시간 → 사출시간(s).
  보압 표(3H, 2H, 1H) → 보압 SP3H~1H(%), 보압 PR3H~1H(bar), 보압 TIME3H~1H(s).
  계량 표(1C~4C) → 계량 SP1C~4C(%), 계량 PR1C~4C(bar), 계량 BP1C~4C(%, 배압), 계량 POS1C~4C(mm).
  석백(2S) → 계량 POS2S(mm), 계량 SP2S(%), 계량 PR2S(bar). 냉각시간 → 냉각시간(s).
- "04 퍼지/노즐": 노즐 전진·후진의 속도/압력/거리 → 노즐전진 SP/PR/POS, 노즐후진 SP/PR/POS.
- "05 형조정/형체저속": 형조정 후진·전진 SP/PR, 형개저속·형폐저속 SP/PR.
- "06 에젝터": 전진1, 전진2, 후진2, 후진1 의 SP/PR/POS → 에젝터전진1 SP(%) 등. 횟수 → 에젝터횟수, 전진지연/후진지연 → 에젝터전진지연(s)/에젝터후진지연(s).
- "08 온도": EN, NZ(노즐), 1, 2, 3, 4 의 설정 온도 → 히터 EN(℃), 히터 NZ(℃), 히터1~4(℃).
- "01 전체 기계 동작"(모니터): 싸이클시간 → 사이클시간(s), 사출시간 → 실제 사출시간 (s), 계량시간 → 계량시간(s).`;

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
    // 사진이 많아 비용이 적은 Haiku 사용(사용자 선택). 서버 측 fallback 없음
    const response = await client.messages.create({
      model: 'claude-haiku-5-5',
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'high', format: { type: 'json_schema', schema: SCHEMA(keyList) } },
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
