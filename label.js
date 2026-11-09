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
.gl-logo img{max-height:15mm;max-width:42%}
.gl-made{border:1.2px solid #000;border-left:0;display:flex;align-items:center;justify-content:center;text-align:center;font:900 30pt/1.15 Arial,"Malgun Gothic",sans-serif}
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
    return `<div class="gl-label"><table><tr><th class="gl-title" colspan="2">현품표</th></tr>
      ${labelRows(c, p, opt).map(([k, v]) => `<tr><td class="gl-k">${esc(k)}</td><td class="gl-v${sz(v)}">${esc(v)}</td></tr>`).join('')}
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

  g.GaonLabel = { LABEL_CSS, labelRows, labelPagesHTML };
})(typeof window !== 'undefined' ? window : globalThis);
