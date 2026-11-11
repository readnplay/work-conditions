// 현품표 그리기 (앱 화면과 tools/label.mjs 공용)
// 기존 엑셀 양식(★★ 현품표.xlsx)과 같은 칸: 업체명 / (UL Number·MODEL) / 품목번호 / 품명 / 규격 / 원료 / GRADE / 색상 / 수량 / 생산일자
// 가온텍 로고는 맨 위 제목 줄 왼쪽에 크게(사용자 요청 2026-11-12)
// A4 세로 한 장에 3줄. 보통은 2장씩(6장), MADE IN KOREA 거래처는 현품표 + MADE IN KOREA 한 쌍씩(3장)
(function (g) {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const LABEL_CSS = `
.gl-page{width:210mm;height:297mm;padding:8mm 7mm;box-sizing:border-box;display:grid;grid-template-rows:repeat(3,1fr);row-gap:6mm;page-break-after:always;break-after:page;background:#fff;color:#000}
.gl-page:last-child{page-break-after:auto;break-after:auto}
.gl-row{display:grid;grid-template-columns:1fr 1fr;column-gap:6mm;min-height:0}
.gl-label{border:1.2px solid #000;overflow:hidden;display:flex;flex-direction:column;min-height:0;font-family:"Malgun Gothic","맑은 고딕","Apple SD Gothic Neo",sans-serif;font-weight:700}
.gl-label table{border-collapse:collapse;width:100%;table-layout:fixed}
.gl-label th.gl-title{background:#d9d9d9;border-bottom:1.2px solid #000;font-size:12pt;padding:1mm 0;text-align:center;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.gl-label td{border-bottom:1px dotted #555;height:7.6mm;padding:0 1.5mm;text-align:center;vertical-align:middle;overflow:hidden;word-break:keep-all;overflow-wrap:anywhere;line-height:1.1}
.gl-label td.gl-k{width:27%;border-right:1px dotted #555;font-size:10pt}
.gl-label td.gl-v{font-size:11pt}
.gl-label td.gl-v.s{font-size:9pt}.gl-label td.gl-v.xs{font-size:7pt}
.gl-head{display:flex;align-items:center;gap:2mm;padding:1mm 2mm;border-bottom:1.2px solid #000}
.gl-head img{height:15mm;width:auto}
.gl-head span{flex:1;text-align:center;font-size:17pt;font-weight:800;letter-spacing:3mm;padding-right:15mm}
.gl-made{border:1.2px solid #000;border-left:0;display:flex;align-items:center;justify-content:center;text-align:center;font:900 40pt/1.15 Arial,"Malgun Gothic",sans-serif}
.gl-row.made{column-gap:0}
.gl-empty{border:0}
/* 작게: A4 한 장에 10장(2×5) */
.gl-page.sm{grid-template-rows:repeat(5,1fr);row-gap:4mm;padding:7mm 7mm}
.sm .gl-head{padding:0.6mm 1.5mm}.sm .gl-head img{height:10mm}.sm .gl-head span{font-size:12pt;letter-spacing:2mm;padding-right:10mm}
.sm .gl-label td.gl-k{font-size:7.5pt}.sm .gl-label td.gl-v{font-size:8.5pt}
.sm .gl-label td.gl-v.s{font-size:7.5pt}.sm .gl-label td.gl-v.xs{font-size:6pt}

@media print{@page{size:A4 portrait;margin:0}}`;

  // 거래처(c)·제품(p)·출력 옵션(opt: qty, date) → 현품표 칸 목록
  function labelRows(c, p, opt = {}) {
    const L = (c && c.label) || {};
    const rows = [['업체명', L.title || (c && c.name) || '']];
    if (L.extra === 'UL Number') rows.push(['UL Number', p.ul || L.extraValue || '']);
    else if (L.extra === 'MODEL') rows.push(['MODEL', p.model || L.extraValue || '']);
    rows.push([L.codeLabel || '품목번호', p.lcode ?? p.code ?? '']);
    rows.push(['품명', p.lname ?? p.name ?? '']);
    rows.push(['규격', p.spec || '']);
    rows.push(['원료', p.material || '']);
    rows.push(['GRADE', p.grade || '']);
    rows.push(['색상', p.color || '']);
    rows.push(['수량', opt.qty ?? p.pack ?? '']);
    rows.push(['생산일자', opt.date || '']);
    const hide = L.hide || [];
    return rows.filter(([k, v]) => !hide.includes(k) && !(k === '규격' && !String(v).trim()));
  }

  function oneLabel(c, p, opt, logo) {
    const sz = v => (String(v).length > 34 ? ' xs' : String(v).length > 19 ? ' s' : '');
    const rows = labelRows(c, p, opt);
    const h = (opt.small ? Math.min(5, 38 / rows.length) : Math.min(8.6, 72 / rows.length)).toFixed(2); // 줄이 많아도 한 칸 안에 들어가게
    return `<div class="gl-label"><div class="gl-head">${logo ? `<img src="${esc(logo)}" alt="GAON TECH">` : ''}<span>현품표</span></div><table>
      ${rows.map(([k, v]) => `<tr><td class="gl-k" style="height:${h}mm">${esc(k)}</td><td class="gl-v${sz(v)}" style="height:${h}mm">${esc(v)}</td></tr>`).join('')}
      </table></div>`;
  }

  // count 장을 A4 페이지들로
  function labelPagesHTML(c, p, opt = {}, logo = 'logo.png') {
    const made = !!(c && c.label && c.label.madeIn);
    const per = opt.small ? 5 : 3; // 한 장의 줄 수
    const n = Math.max(1, Math.min(300, parseInt(opt.count, 10) || (made ? per : per * 2)));
    const rowsHtml = [];
    if (made) for (let i = 0; i < n; i++) rowsHtml.push(`<div class="gl-row made">${oneLabel(c, p, opt, logo)}<div class="gl-made">MADE IN<br>KOREA</div></div>`);
    else for (let i = 0; i < n; i += 2) rowsHtml.push(`<div class="gl-row">${oneLabel(c, p, opt, logo)}${i + 1 < n ? oneLabel(c, p, opt, logo) : '<div class="gl-empty"></div>'}</div>`);
    const pages = [];
    for (let i = 0; i < rowsHtml.length; i += per) {
      const r = rowsHtml.slice(i, i + per);
      while (r.length < per) r.push('<div></div>');
      pages.push(`<div class="gl-page${opt.small ? ' sm' : ''}">${r.join('')}</div>`);
    }
    return pages.join('');
  }

  // ───── 금형 표찰: 가로 200mm × 세로 70mm, A4 세로에 3장. 잘라서 금형에 붙임 ─────
  const MOLD_CSS = `
.mt-page{width:210mm;height:297mm;padding:12mm 5mm;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between;page-break-after:always;break-after:page;background:#fff;color:#000}
.mt-page:last-child{page-break-after:auto;break-after:auto}
.mt{width:200mm;height:70mm;box-sizing:border-box;border:1.5px solid #000;outline:1px dashed #999;outline-offset:2.5mm;display:grid;grid-template-columns:36mm 1fr;font-family:"Malgun Gothic","맑은 고딕","Apple SD Gothic Neo",sans-serif;overflow:hidden;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.mt-ph{border-right:1.2px solid #000;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:1.5mm;gap:2mm}
.mt-ph img.p{max-width:33mm;max-height:42mm;object-fit:contain}
.mt-ph .np{width:32mm;height:30mm;border:1px dashed #bbb;display:flex;align-items:center;justify-content:center;color:#999;font-size:8pt}
.mt-ph img.l{max-width:26mm;max-height:11mm}
.mt-b{display:flex;flex-direction:column;min-width:0}
.mt-h{display:flex;align-items:baseline;gap:3mm;padding:0.8mm 2.5mm;border-bottom:1.2px solid #000;background:#eee}
.mt-h .c{font-size:12pt;font-weight:800;white-space:nowrap}
.mt-h .n{font-size:11.5pt;font-weight:800;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mt table.i{border-collapse:collapse;width:100%;table-layout:fixed;font-size:7.8pt}
.mt table.i td{border-bottom:1px dotted #777;padding:0.2mm 1.2mm;height:3.8mm;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.mt table.i td.k{width:13mm;font-weight:700;background:#f3f3f3;border-right:1px dotted #777}
.mt table.i td.v{font-weight:700;border-right:1px dotted #777}
.mt .cd{border-top:1.2px solid #000;flex:1;display:flex;flex-direction:column;padding:0.6mm 1mm;gap:0.7mm;min-height:0}
.mt .cd .ttl{font-size:7pt;font-weight:800}
.mt .cd .rw{display:flex;gap:1.2mm;align-items:flex-start}
.mt table.m{border-collapse:collapse;font-size:6.6pt;line-height:1}
.mt table.m th,.mt table.m td{border:0.6px solid #888;padding:0.15mm 0.6mm;text-align:center;white-space:nowrap;height:2.85mm}
.mt table.m th{background:#ececec;font-weight:700}
.mt table.m caption{caption-side:top;text-align:left;font-weight:800;font-size:6.8pt;padding-bottom:0.2mm}
.mt table.m td{font-weight:700;min-width:5.5mm}
.mt .sg{display:flex;flex-wrap:wrap;gap:0.6mm 0.8mm;font-size:6.4pt;margin-top:1mm}
.mt .col{display:flex;flex-direction:column;min-width:0;flex:1}
.mt .sg span{border:0.6px solid #888;padding:0.2mm 0.8mm;white-space:nowrap}
.mt .sg b{font-weight:800}
.mt .msg{font-size:8.5pt;color:#555;flex:1;display:flex;align-items:center}
@media print{@page{size:A4 portrait;margin:0}}`;

  // 작업조건 표: 작업조건표에 기록된 값. 키 이름은 앱 양식(index.html TEMPLATES)과 같음. 값 없는 표는 넣지 않음(손으로 쓰는 칸 없음)
  const R = (a, b) => { const r = []; for (let i = a; a <= b ? i <= b : i >= b; i += a <= b ? 1 : -1) r.push(i); return r; };
  const EJ = ['전진1', '전진2', '후진2', '후진1'];
  const DETAIL = {
    B: [
      [
        ['사출', R(4, 1), [['SP%', R(4, 1).map(i => `사출 SP${i}(%)`)], ['PRbar', R(4, 1).map(i => `사출 PR${i}(bar)`)], ['POS', R(4, 1).map(i => `사출 POS${i}(mm)`)]]],
        ['보압', ['3H', '2H', '1H'], [['SP%', [3, 2, 1].map(i => `보압 SP${i}H(%)`)], ['PRbar', [3, 2, 1].map(i => `보압 PR${i}H(bar)`)], ['TIME', [3, 2, 1].map(i => `보압 TIME${i}H(s)`)]]],
        ['계량', ['1C', '2C', '3C', '4C'], [['SP%', R(1, 4).map(i => `계량 SP${i}C(%)`)], ['PRbar', R(1, 4).map(i => `계량 PR${i}C(bar)`)], ['배압%', R(1, 4).map(i => `계량 BP${i}C(%)`)], ['POS', R(1, 4).map(i => `계량 POS${i}C(mm)`)]]],
        ['온도 ℃', ['EN', 'NZ', '1', '2', '3', '4'], [['설정', ['히터 EN(℃)', '히터 NZ(℃)', '히터1(℃)', '히터2(℃)', '히터3(℃)', '히터4(℃)']]]],
      ],
      [
        ['형폐', R(1, 5), [['SP%', R(1, 5).map(i => `형폐 SP${i}(%)`)], ['PRbar', R(1, 5).map(i => `형폐 PR${i}(bar)`)], ['POS', R(1, 4).map(i => `형폐 POS${i}(mm)`).concat([''])]]],
        ['형개', R(5, 1), [['SP%', R(5, 1).map(i => `형개 SP${i}(%)`)], ['PRbar', R(5, 1).map(i => `형개 PR${i}(bar)`)], ['POS', R(5, 1).map(i => `형개 POS${i}(mm)`)]]],
        ['에젝터', ['전1', '전2', '후2', '후1'], [['SP%', EJ.map(k => `에젝터${k} SP(%)`)], ['PRbar', EJ.map(k => `에젝터${k} PR(bar)`)], ['POS', EJ.map(k => `에젝터${k} POS(mm)`)]]],
      ],
    ],
    A: [
      [
        ['사출속도 mm/s', R(1, 5), [['1~5', R(1, 5).map(i => '사출속도' + i)], ['6~10', R(6, 10).map(i => '사출속도' + i)]]],
        ['보압 bar', R(1, 5), [['1~5', R(1, 5).map(i => '보압' + i)], ['6~10', R(6, 10).map(i => '보압' + i)]]],
        ['계량', R(1, 5), [['회전%', R(1, 5).map(i => '스크류회전' + i)], ['배압bar', R(1, 5).map(i => '배압' + i)]]],
        ['온도 ℃', ['노즐1', '실2', '실3', '실4', '실5'], [['설정', ['노즐1', '실2', '실3', '실4', '실5']]]],
      ],
    ],
  };
  const SINGLES = {
    B: [['사출시간', '사출시간(s)', 's'], ['냉각', '냉각시간(s)', 's'], ['사이클', '사이클시간(s)', 's'], ['형폐시간', '형폐시간(s)', 's'], ['형개시간', '형개시간(s)', 's'],
        ['석백 POS', '계량 POS2S(mm)', 'mm'], ['석백 SP', '계량 SP2S(%)', '%'], ['노즐전진 SP/PR', ['노즐전진 SP(%)', '노즐전진 PR(bar)'], ''], ['에젝터 횟수', '에젝터횟수', '회']],
    A: [['사출압력', '사출압력', 'bar'], ['보압시간', '보압시간', 's'], ['냉각', '냉각시간', 's'], ['계량스트로크', '계량스트로크', 'mm']],
  };
  function condHTML(template, values = {}) {
    const v = k => (k && values[k]) || '';
    const tables = row => row.map(([title, cols, body]) => {
      if (!body.some(([, keys]) => keys.some(v))) return '';
      return `<table class="m"><caption>${esc(title)}</caption><tr><th></th>${cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr>` +
        body.map(([lb, keys]) => `<tr><th>${esc(lb)}</th>${keys.map(k => `<td>${esc(v(k))}</td>`).join('')}</tr>`).join('') + '</table>';
    }).join('');
    // 시간 등 낱개 값: 앞쪽은 첫 줄 오른쪽 표 아래, 나머지는 마지막 줄 오른쪽
    const chips = (SINGLES[template] || SINGLES.B).map(([lb, k, u]) => {
      const val = Array.isArray(k) ? k.map(v).filter(Boolean).join('/') : v(k);
      return val ? `<span>${esc(lb)} <b>${esc(val)}${u}</b></span>` : '';
    }).filter(Boolean);
    const half = Math.ceil(chips.length / 2);
    const sg = [chips.slice(0, half).join(''), chips.slice(half).join('')];
    const rows = DETAIL[template] || DETAIL.B;
    return rows.map((row, i) => {
      const h = row.map((t, j) => {
        const tb = tables([t]);
        return i === 0 && j === row.length - 1 && rows.length > 1 && tb ? `<div class="col" style="flex:0 1 auto">${tb}<div class="sg">${sg[0]}</div></div>` : tb;
      }).join('') + (i === rows.length - 1 ? `<div class="col"><div class="sg">${rows.length > 1 ? sg[1] : sg.join('')}</div></div>` : '');
      return h ? `<div class="rw">${h}</div>` : '';
    }).join('');
  }

  // d: {customer, code, name, mold, line, material, grade, color, weight, note, template, values, condDate, photo}
  function oneMoldTag(d, logo) {
    const cd = d.values ? condHTML(d.template || 'B', d.values) : '';
    return `<div class="mt">
      <div class="mt-ph">${d.photo ? `<img class="p" src="${esc(d.photo)}" alt="">` : '<div class="np">제품 사진</div>'}${logo ? `<img class="l" src="${esc(logo)}" alt="GAON TECH">` : ''}</div>
      <div class="mt-b">
        <div class="mt-h"><span class="c">${esc(d.customer)}</span><span class="n">${esc(d.name)}</span></div>
        <table class="i">
          <tr><td class="k">품목번호</td><td class="v">${esc(d.code)}</td><td class="k">생산 라인</td><td class="v">${esc(d.line)}</td><td class="k">금형</td><td class="v">${esc(d.mold)}</td></tr>
          <tr><td class="k">원료</td><td class="v" colspan="3">${esc([d.material, d.grade].filter(Boolean).join(' / '))}</td><td class="k">색상</td><td class="v">${esc(d.color)}</td></tr>
          <tr><td class="k">중량</td><td class="v" colspan="5">${esc(d.weight)}</td></tr>
          <tr><td class="k">비고</td><td class="v" colspan="5">${esc(d.note)}</td></tr>
        </table>
        <div class="cd">${cd
          ? `<div class="ttl">작업조건 (작업조건표 ${esc(d.condDate || '')} 기록)</div>${cd}`
          : '<div class="ttl">작업조건</div><div class="msg">작업조건표에 아직 기록이 없습니다. 설비 화면 사진을 앱에 올리면 다음 표찰부터 자동으로 들어갑니다.</div>'}</div>
      </div></div>`;
  }
  function moldTagPagesHTML(d, count = 3, logo = 'logo.png') {
    const n = Math.max(1, Math.min(60, parseInt(count, 10) || 3));
    const tags = Array.from({ length: n }, () => oneMoldTag(d, logo));
    const pages = [];
    for (let i = 0; i < tags.length; i += 3) {
      const t = tags.slice(i, i + 3);
      pages.push(`<div class="mt-page">${t.join('')}${'<div></div>'.repeat(3 - t.length)}</div>`);
    }
    return pages.join('');
  }

  // ───── 포대(박스) 라벨: A4 가로 1/3 크기(200×93mm), 한 장에 3장 ─────
  // 멀리서도 보이게 제품명·수량을 크게, 잉크를 아끼려고 제품 사진은 윤곽선 그림으로 바꿔 찍음(outlineImages)
  const BAG_CSS = `
.bg-page{width:210mm;height:297mm;padding:5mm;box-sizing:border-box;display:grid;grid-template-rows:repeat(3,1fr);row-gap:3mm;page-break-after:always;break-after:page;background:#fff;color:#000}
.bg-page:last-child{page-break-after:auto;break-after:auto}
.bg{border:1px dashed #999;display:grid;grid-template-columns:92mm 1fr;min-height:0;font-family:"Malgun Gothic","맑은 고딕",sans-serif;overflow:hidden}
.bg-ph{display:flex;align-items:center;justify-content:center;gap:2mm;padding:3mm}
.bg-ph img,.bg-ph canvas{max-width:100%;max-height:86mm;object-fit:contain}
.bg-ph.two img,.bg-ph.two canvas{max-width:48%}
.bg-tx{display:flex;flex-direction:column;justify-content:center;padding:3mm 5mm 3mm 2mm;min-width:0;position:relative}
.bg-cu{font-size:13pt;font-weight:700;color:#333}
.bg-nm{font-size:46pt;font-weight:900;line-height:1.05;letter-spacing:-0.5mm;word-break:keep-all}
.bg-nm.m{font-size:38pt}.bg-nm.s{font-size:28pt}
.bg-sub{display:flex;gap:3mm;align-items:center;margin-top:2mm;flex-wrap:wrap}
.bg-tag{border:1.5mm solid #000;border-radius:3mm;padding:0.5mm 3mm;font-size:24pt;font-weight:900;line-height:1.1}
.bg-code{font-size:16pt;font-weight:800}
.bg-qty{margin-top:3mm;font-size:50pt;font-weight:900;line-height:1}
.bg-qty small{font-size:16pt;font-weight:700;margin-right:3mm}
.bg-logo{position:absolute;right:4mm;bottom:3mm;height:9mm;opacity:.85}
@media print{@page{size:A4 portrait;margin:0}}`;

  // d: {customer, name, sub(예: '일반' / '전도성'), code, qty, photos:[이미지 주소], outline:true}
  function oneBagLabel(d, logo) {
    const nmLen = String(d.name || '').length;
    const ph = (d.photos || []).slice(0, d.twoPhotos ? 2 : 1); // 기본은 크게 1장
    return `<div class="bg">
      <div class="bg-ph${ph.length > 1 ? ' two' : ''}">${ph.map(src => `<img${d.outline === false ? '' : ' data-outline="1"'} src="${esc(src)}" alt="">`).join('')}</div>
      <div class="bg-tx">
        <div class="bg-cu">${esc(d.customer || '')}</div>
        <div class="bg-nm${nmLen > 14 ? ' s' : nmLen > 9 ? ' m' : ''}">${esc(d.name || '')}</div>
        <div class="bg-sub">${d.sub ? `<span class="bg-tag">${esc(d.sub)}</span>` : ''}${d.code ? `<span class="bg-code">${esc(d.code)}</span>` : ''}</div>
        ${d.qty ? `<div class="bg-qty"><small>수량</small>${esc(d.qty)}</div>` : ''}
        ${logo ? `<img class="bg-logo" src="${esc(logo)}" alt="GAON TECH">` : ''}
      </div></div>`;
  }
  function bagLabelPagesHTML(d, count = 3, logo = 'logo.png') {
    const n = Math.max(1, Math.min(60, parseInt(count, 10) || 3));
    const tags = Array.from({ length: n }, () => oneBagLabel(d, logo));
    const pages = [];
    for (let i = 0; i < tags.length; i += 3) {
      const t = tags.slice(i, i + 3);
      pages.push(`<div class="bg-page">${t.join('')}${'<div></div>'.repeat(3 - t.length)}</div>`);
    }
    return pages.join('');
  }
  // 어두운 제품 사진 → 흑백으로 밝게: 배경은 흰색, 제품은 최대 약 55% 회색(잉크 절약, 모양은 사진 그대로)
  function outlineImages(root) {
    const imgs = [...(root || document).querySelectorAll('img[data-outline]')];
    return Promise.all(imgs.map(img => new Promise(done => {
      const run = () => {
        try {
          const W = img.naturalWidth, H = img.naturalHeight;
          const c = document.createElement('canvas'); c.width = W; c.height = H;
          const x = c.getContext('2d'); x.drawImage(img, 0, 0);
          const d = x.getImageData(0, 0, W, H), px = d.data, n = W * H;
          const lum = new Float32Array(n);
          for (let i = 0; i < n; i++) lum[i] = 0.3 * px[i * 4] + 0.59 * px[i * 4 + 1] + 0.11 * px[i * 4 + 2];
          const srt = Array.from(lum).sort((p, q) => p - q);
          const dark = srt[Math.floor(n * 0.03)], bg = srt[Math.floor(n * 0.6)]; // 제품(어두움)·배경(밝은 쪽) 밝기
          const hi = dark + (bg - dark) * 0.55; // 이보다 밝으면 흰색(배경 무늬 지움)
          for (let i = 0; i < n; i++) {
            let t = (lum[i] - dark) / (hi - dark); t = t < 0 ? 0 : t > 1 ? 1 : t; // 0 = 제품, 1 = 배경
            t = Math.pow(t, 0.8);
            const v = 255 - (1 - t) * 255 * 0.55; // 가장 진한 곳도 55% 잉크
            px[i * 4] = px[i * 4 + 1] = px[i * 4 + 2] = v;
          }
          x.putImageData(d, 0, 0);
          c.style.cssText = img.style.cssText; c.className = img.className; img.replaceWith(c);
        } catch (e) { /* 실패하면 원래 사진 그대로 */ }
        done();
      };
      img.complete && img.naturalWidth ? run() : (img.onload = run, img.onerror = done);
    })));
  }

  g.GaonLabel = { LABEL_CSS, labelRows, labelPagesHTML, MOLD_CSS, moldTagPagesHTML, BAG_CSS, bagLabelPagesHTML, outlineImages };
})(typeof window !== 'undefined' ? window : globalThis);
