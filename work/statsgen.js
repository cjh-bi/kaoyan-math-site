// work/statsgen.js — 从 data.js 重建 stats.html（词频表保留原标注快照）
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const V = '20260925135128';
const NOW = (() => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; })();
const raw = fs.readFileSync(path.join(ROOT, 'assets', 'data.js'), 'utf8');
const KY = JSON.parse(raw.slice('window.KY_DATA = '.length).replace(/;\s*$/, ''));
const Q = KY.questions, TOTAL = Q.length;
const enc = encodeURIComponent;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const yearOrder = y => { const m = /^(\d{4})/.exec(y); return m ? +m[1] : 9999; };
const shortYear = y => /^\d{4}$/.test(y) ? y : y.slice(2, 4) + '/' + y.slice(7, 9);
const FAVICON = `data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2064%2064'%3E%3Crect%20width='64'%20height='64'%20rx='14'%20fill='%231f5c46'/%3E%3Ctext%20x='32'%20y='45'%20font-size='40'%20text-anchor='middle'%20fill='%23ffffff'%20font-family='sans-serif'%3E%E8%80%83%3C/text%3E%3C/svg%3E`;

// —— 聚合 ——
const bySchool = {}, byPaper = {};
for (const q of Q) {
  (bySchool[q.school_name] = bySchool[q.school_name] || []).push(q);
  const pid = q.qid.replace(/-q\d{4}$/, '');
  (byPaper[pid] = byPaper[pid] || []).push(q);
}
const years = [...new Set(Q.map(q => q.year))].sort(yearOrder);
const yearCnt = {}; for (const q of Q) yearCnt[q.year] = (yearCnt[q.year] || 0) + 1;
const l1c = {}, l2c = {}, formc = {}, matrix = {};
for (const q of Q) {
  l1c[q.l1] = (l1c[q.l1] || 0) + 1;
  if (q.l2) l2c[q.l2] = (l2c[q.l2] || 0) + 1;
  formc[q.form] = (formc[q.form] || 0) + 1;
  (matrix[q.l1] = matrix[q.l1] || {})[q.form] = (matrix[q.l1][q.form] || 0) + 1;
}
const heat = {};
for (const q of Q) { const k = q.l1 + '|' + q.year; heat[k] = (heat[k] || 0) + 1; }

// —— 分值：扫描全部题页 h1 的 "N 分" ——
const scoreCnt = {}; let scoreKnown = 0;
for (const f of fs.readdirSync(path.join(ROOT, 'q'))) {
  if (!f.endsWith('.html')) continue;
  const s = fs.readFileSync(path.join(ROOT, 'q', f), 'utf8');
  const i0 = s.indexOf('<h1 class="qmeta">'), i1 = s.indexOf('</h1>');
  if (i0 < 0) continue;
  const m = s.slice(i0, i1).match(/>(\d+) 分</);
  if (m) { scoreKnown++; scoreCnt[m[1]] = (scoreCnt[m[1]] || 0) + 1; }
}

// —— 保留原词频表 ——
const old = fs.readFileSync(path.join(ROOT, 'stats.html'), 'utf8');
const kw0 = old.indexOf('<h2>高频解题方法');
const kw1 = old.indexOf('</section>', kw0);
const kwSeg = kw0 >= 0 ? old.slice(kw0, kw1) : '<h2>高频解题方法 / 考点词频</h2>';
const kwNote = kwSeg.replace('共 140 个关键词，来自逐题标注', '共 140 个关键词，来自逐题标注（仅覆盖原始导入题目；公众号合集新增题未做该方法标注）');

// —— 组件 ——
const barRows = (entries) => {
  if (!entries.length) return '';
  const max = entries[0][1];
  return entries.map(([k, n]) => `      <div class="bar-row">
        <span class="label" title="${esc(k)}">${esc(k)}</span>
        <div class="bar"><i style="width: ${Math.max(1, Math.round(n * 100 / max))}%"></i></div>
        <div class="val">${n}</div>
      </div>`).join('\n');
};
function svgBars() {
  const W0 = 40, W1 = 970, YB = 178, YT = 16, n = years.length;
  const max = Math.max(...years.map(y => yearCnt[y]));
  const slot = (W1 - W0) / n;
  const bw = slot * 0.6;
  let s = `<svg viewBox="0 0 980 230" role="img" aria-label="逐年题量柱状图">`;
  for (let k = 0; k <= 3; k++) {
    const yv = YB - k * (YB - YT) / 3, lab = Math.round(max * k / 3);
    s += `<line class="axis" x1="${W0}" y1="${yv.toFixed(1)}" x2="${W1}" y2="${yv.toFixed(1)}"/><text x="${W0 - 6}" y="${(yv + 4).toFixed(1)}" text-anchor="end">${lab}</text>`;
  }
  years.forEach((y, i) => {
    const c = yearCnt[y], h = Math.max(1, c / max * (YB - YT));
    const x = W0 + i * slot + (slot - bw) / 2;
    s += `<rect class="bar" x="${x.toFixed(1)}" y="${(YB - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="2"><title>${y}：${c} 题</title></rect>`;
    const cx = x + bw / 2;
    s += `<text x="${cx.toFixed(1)}" y="192" text-anchor="end" transform="rotate(-45 ${cx.toFixed(1)} 192)">${y}</text>`;
  });
  return s + '</svg>';
}
function heatGrid() {
  const l1s = Object.entries(l1c).sort((a, b) => b[1] - a[1]).map(x => x[0]);
  const maxCell = Math.max(...Object.values(heat));
  let s = `<div class="heat" style="grid-template-columns:150px repeat(${years.length}, minmax(16px, 1fr))"><div></div>`;
  for (const y of years) s += `<div class="collabel" title="${y}">${shortYear(y)}</div>`;
  for (const l1 of l1s) {
    s += `<div class="rowlabel" title="${esc(l1)}">${esc(l1)}</div>`;
    for (const y of years) {
      const c = heat[l1 + '|' + y] || 0;
      if (!c) { s += `<div class="cell"></div>`; continue; }
      const pct = Math.min(100, 30 + Math.round(c / maxCell * 70));
      s += `<div class="cell" title="${esc(l1)} · ${y}：${c} 题" style="background:color-mix(in srgb, var(--accent) ${pct}%, var(--surface-2))"></div>`;
    }
  }
  return s + '</div>';
}

const l1Sorted = Object.entries(l1c).sort((a, b) => b[1] - a[1]);
const l2Sorted = Object.entries(l2c).sort((a, b) => b[1] - a[1]).slice(0, 20);
const FORM_QT = { 证明: 'proof', 计算: 'calc / short', 填空: 'blank', 判断: 'judge', 综合: 'other / single' };
const formSorted = Object.entries(formc).sort((a, b) => b[1] - a[1]);
const schoolSorted = Object.entries(bySchool).sort((a, b) => b[1].length - a[1].length);
const subjOf = qs => SUBJECT_ORDER_FILTER([...new Set(qs.map(q => q.subject))]).join('、');
function SUBJECT_ORDER_FILTER(list) { const ord = ['数学分析', '高等代数', '空间解析几何和高等代数']; return list.sort((a, b) => (ord.indexOf(a) + 1 || 99) - (ord.indexOf(b) + 1 || 99)); }
const hasAns = Q.filter(q => q.has_answer).length;
const pending = Q.filter(q => q.answer_state === '待核对').length;
const cols = ['判断', '填空', '综合', '计算', '证明'];

const schoolRows = schoolSorted.map(([name, qs]) => {
  const code = qs[0].school;
  const ys = [...new Set(qs.map(q => q.year))].sort(yearOrder);
  const pids = new Set(qs.map(q => q.qid.replace(/-q\d{4}$/, ''))).size;
  return `      <tr>
        <td><a href="school/${code}.html">${esc(name)}</a></td>
        <td>${qs.length}</td>
        <td>${pids}</td>
        <td>${ys[0]}–${ys[ys.length - 1]}</td>
        <td>${subjOf(qs)}</td>
      </tr>`;
}).join('\n');

const scoreBars = Object.entries(scoreCnt).map(([k, v]) => [k + ' 分', v]).sort((a, b) => b[1] - a[1]);

const matrixRows = l1Sorted.map(([l1]) => {
  const row = matrix[l1] || {};
  const tot = l1c[l1];
  return `      <tr>
        <td><span>${esc(l1)}</span></td>
${cols.map(c => `        <td class="num">${row[c] ? row[c] : '·'}</td>`).join('\n')}
        <td class="num"><b>${tot}</b></td>
      </tr>`;
}).join('\n');

const items = [['index.html', '首页'], ['papers.html', '试卷'], ['knowledge.html', '知识点'], ['schools.html', '院校'], ['stars.html', '收藏'], ['stats.html', '统计'], ['about.html', '说明']];
const page = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>统计 · 数学考研真题库</title>
<meta name="description" content="全站统计：${TOTAL} 题、${Object.keys(byPaper).length} 套卷、${schoolSorted.length} 所院校的逐年/知识点/题型分布">
<link rel="icon" href="${FAVICON}">
<link rel="stylesheet" href="assets/katex/katex.min.css">
<link rel="stylesheet" href="assets/site.css?v=${V}">
</head>
<body class="page-stats">
<header class="topbar">
  <div class="wrap topbar-inner">
    <a class="brand" href="index.html"><span class="dot">考</span><span>数学考研真题库</span></a>
    <nav class="nav">
${items.map(([h, l]) => `      <a href="${h}"${h === 'stats.html' ? ' class="active"' : ''}>${l}</a>`).join('\n')}
    </nav>
    <span class="spacer"></span>
  </div>
</header>
<main>
  <div class="wrap">
<div class="section-head page-head">
  <h1>统计分析</h1>
  <p>年份趋势、知识点频次与形式分布 · 数据截至 ${NOW}（${TOTAL} 题 / ${Object.keys(byPaper).length} 套卷 / ${schoolSorted.length} 校）</p>
</div>

<section class="section">
  <div class="section-head">
    <h2>答案覆盖</h2>
    <p class="small muted">已导入答案/解析的题目占比；答案由 AI 生成、仅供参考，未经人工核对前不作为标准答案</p>
  </div>
  <div class="toolbar" style="margin-bottom:10px">
    <span class="chip accent">有答案 <span class="n">${hasAns}</span></span>
    <span class="chip ghost">待核对 <span class="n">${pending}</span></span>
    <span class="chip">已核对 <span class="n">0</span></span>
    <span class="chip">覆盖率 <span class="n">${(hasAns * 100 / TOTAL).toFixed(1)}%</span></span>
  </div>
  <table class="data">
    <thead><tr><th>来源</th><th>题数</th></tr></thead>
    <tbody>
      <tr><td>参考答案（AI 生成，仅供参考）</td><td>281</td></tr>
      <tr><td>证明思路（AI 生成，仅供参考）</td><td>160</td></tr>
      <tr><td>已人工复核</td><td>2</td></tr>
    </tbody>
  </table>
</section>

<section class="section">
  <div class="section-head">
    <h2>院校分布</h2>
    <p class="small muted">多校数据：各院校题量与覆盖年份（点院校进详情）</p>
  </div>
  <div class="table-responsive">
  <table class="data">
    <thead><tr><th>院校</th><th>题量</th><th>卷数</th><th>年份跨度</th><th>科目</th></tr></thead>
    <tbody>
${schoolRows}
    </tbody>
  </table>
  </div>
</section>

<section class="section">
  <div class="section-head">
    <h2>逐年题量</h2>
  </div>
  <div class="panel">
    <div class="chart">${svgBars()}</div>
  </div>
</section>

<section class="section">
  <div class="section-head">
    <h2>一级知识点分布</h2>
  </div>
  <div class="panel bars">
${barRows(l1Sorted)}
  </div>
</section>

<section class="section">
  <div class="section-head">
    <h2>知识点 × 年份 热力图</h2>
  </div>
  <div class="panel">
    <div class="heat-scroll"><div class="chart">${heatGrid()}</div></div>
  </div>
</section>

<section class="section">
  <div class="section-head">
    <h2>题型形式</h2>
  </div>
  <div class="panel">
    <table class="data">
      <thead><tr><th>形式</th><th class="num">题量</th><th class="num">占比</th><th>归一化题型</th></tr></thead>
      <tbody>
${formSorted.map(([k, v]) => `      <tr>
        <td><span>${k}</span></td>
        <td class="num">${v}</td>
        <td class="num">${(v * 100 / TOTAL).toFixed(1)}%</td>
        <td class="muted small">${FORM_QT[k] || 'other'}</td>
      </tr>`).join('\n')}
      </tbody>
    </table>
  </div>
</section>

<section class="section">
  <div class="section-head">
    <h2>二级知识点 Top 20</h2>
  </div>
  <div class="panel bars">
${barRows(l2Sorted)}
  </div>
</section>

<section class="section">
  <div class="section-head">
    <h2>分值分布</h2>
    <p>${scoreKnown} / ${TOTAL} 道题带卷面分值标注（含公众号合集卷面标注）</p>
  </div>
  <div class="panel bars">
${barRows(scoreBars)}
  </div>
</section>

<section class="section">
  <div class="section-head">
    ${kwNote}
  </div>
</section>

<section class="section">
  <div class="section-head">
    <h2>一级知识点 × 形式矩阵</h2>
    <p>哪个板块偏计算、哪个板块偏证明，一眼能看出复习重心</p>
  </div>
  <div class="panel">
    <div class="table-responsive">
      <table class="data">
        <thead>
          <tr>
            <th>一级知识点</th>
${cols.map(c => `            <th class="num">${c}</th>`).join('\n')}
            <th class="num">合计</th>
          </tr>
        </thead>
        <tbody>
${matrixRows}
        </tbody>
      </table>
    </div>
  </div>
</section>
  </div>
</main>
<footer class="site">
  <div class="wrap">
    <span>数学考研真题库 · 数据来自 各高校历年数学考研真题（经校对整理），共 ${TOTAL} 题</span>
    <span>生成于 ${NOW} · <a href="about.html">数据说明</a></span>
  </div>
</footer>
<script defer src="assets/katex/katex.min.js"></script>
<script defer src="assets/katex/auto-render.min.js"></script>
<script defer src="assets/math.js?v=${V}"></script>
</body>
</html>
`;
fs.writeFileSync(path.join(ROOT, 'stats.html'), page);
console.log(`stats.html rebuilt: ${TOTAL} q, ${schoolSorted.length} schools, scores scanned=${scoreKnown}`);
