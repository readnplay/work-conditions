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
    return rows.filter(([k]) => !hide.includes(k));
  }

  function oneLabel(c, p, opt, logo) {
    const sz = v => (String(v).length > 34 ? ' xs' : String(v).length > 19 ? ' s' : '');
    const rows = labelRows(c, p, opt);
    const h = Math.min(7.6, 62 / rows.length).toFixed(2); // 줄이 많아도 로고까지 한 칸 안에 들어가게
    return `<div class="gl-label"><table><tr><th class="gl-title" colspan="2">현품표</th></tr>
      ${rows.map(([k, v]) => `<tr><td class="gl-k" style="height:${h}mm">${esc(k)}</td><td class="gl-v${sz(v)}" style="height:${h}mm">${esc(v)}</td></tr>`).join('')}
      </table><div class="gl-logo">${logo ? `<img src="${esc(logo)}" alt="GAON TECH">` : ''}</div></div>`;
  }

  // count 장을 A4 페이지들로
  function labelPagesHTML(c, p, opt = {}, logo = 'logo.png') {
    const made = !!(c && c.label && c.label.madeIn);
    const n = Math.max(1, Math.min(300, parseInt(opt.count, 10) || (made ? 3 : 6)));
    const rowsHtml = [];
    if (made) for (let i = 0; i < n; i++) rowsHtml.push(`<div class="gl-row made">${oneLabel(c, p, opt, logo)}<div class="gl-made">MADE IN<br>KOREA</div></div>`);
    else for (let i = 0; i < n; i += 2) rowsHtml.push(`<div class="gl-row">${oneLabel(c, p, opt, logo)}${i + 1 < n ? oneLabel(c, p, opt, logo) : '<div class="gl-empty"></div>'}</div>`);
    const pages = [];
    for (let i = 0; i < rowsHtml.length; i += 3) {
      const r = rowsHtml.slice(i, i + 3);
      while (r.length < 3) r.push('<div></div>');
      pages.push(`<div class="gl-page">${r.join('')}</div>`);
    }
    return pages.join('');
  }

  // ───── 금형 표찰: 가로 200mm × 세로 70mm, A4 세로에 3장. 잘라서 금형에 붙임 ─────
  const MOLD_CSS = `
.mt-page{width:210mm;height:297mm;padding:12mm 5mm;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between;page-break-after:always;break-after:page;background:#fff;color:#000}
.mt-page:last-child{page-break-after:auto;break-after:auto}
.mt{width:200mm;height:70mm;box-sizing:border-box;border:1.5px solid #000;outline:1px dashed #999;outline-offset:2.5mm;display:grid;grid-template-columns:46mm 1fr;font-family:"Malgun Gothic","맑은 고딕","Apple SD Gothic Neo",sans-serif;overflow:hidden}
.mt-ph{border-right:1.2px solid #000;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2mm;gap:2mm}
.mt-ph img.p{max-width:42mm;max-height:44mm;object-fit:contain}
.mt-ph .np{width:42mm;height:40mm;border:1px dashed #999;display:flex;align-items:center;justify-content:center;color:#888;font-size:9pt}
.mt-ph img.l{max-width:30mm;max-height:13mm}
.mt-b{display:flex;flex-direction:column;min-width:0}
.mt-h{display:flex;align-items:baseline;gap:3mm;padding:1.5mm 3mm;border-bottom:1.2px solid #000;background:#eee;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.mt-h .c{font-size:17pt;font-weight:800;white-space:nowrap}
.mt-h .n{font-size:15pt;font-weight:800;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mt table{border-collapse:collapse;width:100%;table-layout:fixed;font-size:9.5pt}
.mt td{border-bottom:1px dotted #666;padding:0.6mm 1.5mm;height:5.6mm;vertical-align:middle;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.mt td.k{width:17mm;font-weight:700;background:#f6f6f6;border-right:1px dotted #666;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.mt td.v{font-weight:700}
.mt .cond{display:grid;grid-template-columns:repeat(6,1fr);border-top:1.2px solid #000;flex:1}
.mt .cond div{border-right:1px dotted #666;border-bottom:1px dotted #666;padding:0.4mm 1mm;font-size:7.5pt;line-height:1.15;overflow:hidden}
.mt .cond div b{display:block;font-size:10pt;min-height:4mm}
.mt .ct{grid-column:1/-1;font-size:8pt!important;font-weight:700;background:#f6f6f6;-webkit-print-color-adjust:exact;print-color-adjust:exact}
@media print{@page{size:A4 portrait;margin:0}}`;

  // 간단 작업조건: 양식(A: 1~3호기, B: 4~6호기)별로 많이 보는 값만. 값이 없으면 손으로 쓰는 빈칸
  const COND = {
    A: [['노즐 온도', '노즐1'], ['실2', '실2'], ['실3', '실3'], ['실4', '실4'], ['사출속도1', '사출속도1'], ['사출압력', '사출압력'],
        ['보압1', '보압1'], ['보압시간', '보압시간'], ['냉각시간', '냉각시간'], ['계량', '계량스트로크'], ['배압1', '배압1'], ['사이클', '']],
    B: [['노즐 NZ', '히터 NZ(℃)'], ['히터1', '히터1(℃)'], ['히터2', '히터2(℃)'], ['히터3', '히터3(℃)'], ['사출 SP1', '사출 SP1(%)'], ['사출 PR1', '사출 PR1(bar)'],
        ['보압 PR1H', '보압 PR1H(bar)'], ['보압 시간', '보압 TIME1H(s)'], ['냉각시간', '냉각시간(s)'], ['계량 POS', '계량 POS4C(mm)'], ['배압 BP1C', '계량 BP1C(%)'], ['사이클', '사이클시간(s)']],
  };
  function simpleCond(template, values = {}) {
    return (COND[template] || COND.B).map(([label, key]) => [label, key ? values[key] || '' : '']);
  }

  // d: {customer, code, name, mold, line, material, grade, color, weight, note, cond:[[라벨,값]], condDate, photo}
  function oneMoldTag(d, logo) {
    const row = (k, v, k2, v2) => k2 === undefined
      ? `<tr><td class="k">${esc(k)}</td><td class="v" colspan="3">${esc(v)}</td></tr>`
      : `<tr><td class="k">${esc(k)}</td><td class="v">${esc(v)}</td><td class="k">${esc(k2)}</td><td class="v">${esc(v2)}</td></tr>`;
    return `<div class="mt">
      <div class="mt-ph">${d.photo ? `<img class="p" src="${esc(d.photo)}" alt="">` : '<div class="np">제품 사진</div>'}${logo ? `<img class="l" src="${esc(logo)}" alt="GAON TECH">` : ''}</div>
      <div class="mt-b">
        <div class="mt-h"><span class="c">${esc(d.customer)}</span><span class="n">${esc(d.name)}</span></div>
        <table>
          ${row('품목번호', d.code, '생산 라인', d.line)}
          ${row('금형', d.mold, '중량', d.weight)}
          ${row('원료', [d.material, d.grade].filter(Boolean).join(' / '))}
          ${row('색상', d.color, '비고', d.note)}
        </table>
        <div class="cond"><div class="ct">간단 작업조건${d.condDate ? ` (${esc(d.condDate)} 기록)` : ' (작업 후 적어 주세요)'}</div>
          ${(d.cond || []).map(([k, v]) => `<div>${esc(k)}<b>${esc(v)}</b></div>`).join('')}</div>
      </div></div>`;
  }
  function moldTagPagesHTML(d, count = 3, logo = 'logo.png') {
    const n = Math.max(1, Math.min(60, parseInt(count, 10) || 3));
    const tags = Array.from({ length: n }, () => oneMoldTag(d, logo));
    const pages = [];
    for (let i = 0; i < tags.length; i += 3) pages.push(`<div class="mt-page">${tags.slice(i, i + 3).join('')}${'<div></div>'.repeat(3 - tags.slice(i, i + 3).length)}</div>`);
    return pages.join('');
  }

  g.GaonLabel = { LABEL_CSS, labelRows, labelPagesHTML, MOLD_CSS, simpleCond, moldTagPagesHTML };
})(typeof window !== 'undefined' ? window : globalThis);
