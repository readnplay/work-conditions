// 현품표 그리기 (앱 화면과 tools/label.mjs 공용)
// 기존 엑셀 양식(★★ 현품표.xlsx)과 같은 칸: 업체명 / (UL Number·MODEL) / 품목번호 / 품명 / 규격 / 원료 / GRADE / 색상 / 수량 / 생산일자 + 가온텍 로고
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
.gl-logo{flex:1;display:flex;align-items:center;justify-content:center;min-height:0;padding:1mm}
.gl-logo img{max-height:14mm;max-width:42%}
.gl-made{border:1.2px solid #000;border-left:0;display:flex;align-items:center;justify-content:center;text-align:center;font:900 40pt/1.15 Arial,"Malgun Gothic",sans-serif}
.gl-row.made{column-gap:0}
.gl-empty{border:0}
/* 작게: A4 한 장에 10장(2×5) */
.gl-page.sm{grid-template-rows:repeat(5,1fr);row-gap:4mm;padding:7mm 7mm}
.sm .gl-label th.gl-title{font-size:9pt;padding:0.3mm 0}
.sm .gl-label td.gl-k{font-size:7.5pt}.sm .gl-label td.gl-v{font-size:8.5pt}
.sm .gl-label td.gl-v.s{font-size:7.5pt}.sm .gl-label td.gl-v.xs{font-size:6pt}
.sm .gl-logo{padding:0.5mm}.sm .gl-logo img{max-height:7.5mm}
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
    const h = (opt.small ? Math.min(4.6, 36 / rows.length) : Math.min(7.6, 62 / rows.length)).toFixed(2); // 줄이 많아도 로고까지 한 칸 안에 들어가게
    return `<div class="gl-label"><table><tr><th class="gl-title" colspan="2">현품표</th></tr>
      ${rows.map(([k, v]) => `<tr><td class="gl-k" style="height:${h}mm">${esc(k)}</td><td class="gl-v${sz(v)}" style="height:${h}mm">${esc(v)}</td></tr>`).join('')}
      </table><div class="gl-logo">${logo ? `<img src="${esc(logo)}" alt="GAON TECH">` : ''}</div></div>`;
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

  g.GaonLabel = { LABEL_CSS, labelRows, labelPagesHTML, MOLD_CSS, moldTagPagesHTML };
})(typeof window !== 'undefined' ? window : globalThis);
