// work/focusgen.js — 分校备考重点：focus/<code>.html × 每校 + focus.html 总览 + 院校页入口
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const V = '20260925135128';
const raw = fs.readFileSync(path.join(ROOT, 'assets', 'data.js'), 'utf8');
const KY = JSON.parse(raw.slice('window.KY_DATA = '.length).replace(/;\s*$/, ''));
const enc = encodeURIComponent;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const yearOrder = y => { const m = /^(\d{4})/.exec(y); return m ? +m[1] : 9999; };
const FAVICON = `data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2064%2064'%3E%3Crect%20width='64'%20height='64'%20rx='14'%20fill='%231f5c46'/%3E%3Ctext%20x='32'%20y='45'%20font-size='40'%20text-anchor='middle'%20fill='%23ffffff'%20font-family='sans-serif'%3E%E8%80%83%3C/text%3E%3C/svg%3E`;

const bySchool = {}, byPaper = {};
for (const q of KY.questions) {
  (bySchool[q.school_name] = bySchool[q.school_name] || []).push(q);
  const pid = q.qid.replace(/-q\d{4}$/, '');
  (byPaper[pid] = byPaper[pid] || []).push(q);
}
const schoolCount = {}; for (const n in bySchool) schoolCount[n] = bySchool[n].length;
const schoolOrder = Object.keys(schoolCount).sort((a, b) => schoolCount[b] - schoolCount[a]);

function topbar(p, active) {
  const items = [['index.html', '首页'], ['papers.html', '试卷'], ['knowledge.html', '知识点'], ['schools.html', '院校'], ['focus.html', '备考重点'], ['plan.html', '复习计划'], ['stars.html', '收藏'], ['stats.html', '统计'], ['about.html', '说明']];
  return `<header class="topbar">
  <div class="wrap topbar-inner">
    <a class="brand" href="${p}index.html"><span class="dot">考</span><span>数学考研真题库</span></a>
    <nav class="nav">
${items.map(([h, l]) => `      <a href="${p}${h}"${h === active ? ' class="active"' : ''}>${l}</a>`).join('\n')}
    </nav>
    <span class="spacer"></span>
  </div>
</header>`;
}
function head(title, desc, p) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="icon" href="${FAVICON}">
<link rel="stylesheet" href="${p}assets/katex/katex.min.css">
<link rel="stylesheet" href="${p}assets/site.css?v=${V}">
</head>`;
}
const foot = p => `<footer class="site">
  <div class="wrap">
    <span>数学考研真题库 · 数据来自 各高校历年数学考研真题（经校对整理），共 ${KY.questions.length} 题</span>
    <span>生成于 ${KY.generated_at} · <a href="${p}about.html">数据说明</a></span>
  </div>
</footer>
<script defer src="${p}assets/katex/katex.min.js"></script>
<script defer src="${p}assets/katex/auto-render.min.js"></script>
<script defer src="${p}assets/math.js?v=${V}"></script>
</body>
</html>`;

function bars(entries, max, labelCls) {
  return entries.map(([label, n]) => `      <div class="bar-row">
        <span class="label" title="${esc(label)}">${esc(label)}</span>
        <div class="bar"><i style="width: ${Math.max(2, Math.round(n * 100 / max))}%"></i></div>
        <div class="val">${n}</div>
      </div>`).join('\n');
}

fs.mkdirSync(path.join(ROOT, 'focus'), { recursive: true });
for (const name of schoolOrder) {
  const qs = bySchool[name], code = qs[0].school, p = '../';
  const years = [...new Set(qs.map(q => q.year))].sort(yearOrder);
  const subs = [...new Set(qs.map(q => q.subject))];
  const pids = [...new Set(qs.map(q => q.qid.replace(/-q\d{4}$/, '')))];
  const l1c = {}, l2c = {}, formc = {};
  for (const q of qs) { l1c[q.l1] = (l1c[q.l1] || 0) + 1; if (q.l2) l2c[q.l2] = (l2c[q.l2] || 0) + 1; formc[q.form] = (formc[q.form] || 0) + 1; }
  const l1top = Object.entries(l1c).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const l2top = Object.entries(l2c).sort((a, b) => b[1] - a[1]).slice(0, 12);
  const formOrder = ['计算', '证明', '填空', '判断', '综合'];
  const formRows = Object.entries(formc).sort((a, b) => formOrder.indexOf(a[0]) - formOrder.indexOf(b[0]));
  const yearRows = years.map(y => {
    const yq = qs.filter(q => q.year === y);
    const yl1 = {}; for (const q of yq) yl1[q.l1] = (yl1[q.l1] || 0) + 1;
    const top3 = Object.entries(yl1).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k).join('、');
    const ypids = [...new Set(yq.map(q => q.qid.replace(/-q\d{4}$/, '')))];
    return `      <tr>
        <td>${y}</td>
        <td>${yq.length}</td>
        <td>${esc(top3)}</td>
        <td>${ypids.map(pid => `<a href="${p}paper/${pid}.html">${byPaper[pid][0].subject}</a>`).join(' · ')}</td>
      </tr>`;
  }).join('\n');

  const page = `${head(`${name} · 备考重点`, `${name}考研数学备考重点：${qs.length} 道真题的知识点重心、题型构成与逐年考察重点。`, p)}
<body class="page-schools">
${topbar(p, 'focus.html')}
<main>
  <div class="wrap">
<div class="crumbs">
  <a href="${p}index.html">首页</a> /
  <a href="${p}focus.html">备考重点</a> /
  ${esc(name)}
</div>
<div class="section-head page-head">
  <h1>${esc(name)} · 备考重点</h1>
  <p>
    基于本校 ${qs.length} 道收录真题（${pids.length} 套卷 · ${years[0]}–${years[years.length - 1]} · ${subs.join('、')}）统计。
    <a href="${p}school/${code}.html">院校页</a> · <a href="${p}papers.html">全部试卷</a>
  </p>
</div>

<section class="section">
  <div class="section-head">
    <h2>考察重心（一级知识点 Top 10）</h2>
    <p class="small muted">按本校题量排序；占比 = 该校该知识点题量 / 该校总题量</p>
  </div>
  <div class="panel">
    <div class="bars">
${bars(l1top, l1top[0][1])}
    </div>
  </div>
</section>

<section class="section">
  <div class="section-head">
    <h2>高频细目（二级知识点 Top 12）</h2>
  </div>
  <div class="panel">
    <div class="toolbar" style="margin:0">
${l2top.map(([k, n]) => `      <span class="chip">${esc(k)}<span class="n">${n}</span></span>`).join('\n')}
    </div>
  </div>
</section>

<section class="section">
  <div class="section-head">
    <h2>题型构成</h2>
  </div>
  <div class="panel">
    <div class="toolbar" style="margin:0">
${formRows.map(([k, n]) => `      <span class="chip ghost">${k}<span class="n">${n}</span> <span class="muted">${(n * 100 / qs.length).toFixed(0)}%</span></span>`).join('\n')}
    </div>
  </div>
</section>

<section class="section">
  <div class="section-head">
    <h2>逐年考察重点</h2>
    <p class="small muted">每年题量、出现最多的一级知识点与对应试卷</p>
  </div>
  <table class="data">
    <thead><tr><th>年份</th><th>题量</th><th>高频知识点（Top 3）</th><th>试卷</th></tr></thead>
    <tbody>
${yearRows}
    </tbody>
  </table>
</section>
  </div>
</main>
${foot(p)}`;
  fs.writeFileSync(path.join(ROOT, 'focus', code + '.html'), page);
}

// focus.html 总览：按校卡片
const cards = schoolOrder.map(name => {
  const qs = bySchool[name], code = qs[0].school;
  const l1c = {}; for (const q of qs) l1c[q.l1] = (l1c[q.l1] || 0) + 1;
  const top = Object.entries(l1c).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const pids = new Set(qs.map(q => q.qid.replace(/-q\d{4}$/, ''))).size;
  return `    <a class="card" href="focus/${code}.html">
      <div class="card-head">
        <h3>${esc(name)}</h3>
        <span class="chip">${qs.length} 题</span>
      </div>
      <p class="small muted">${pids} 套卷</p>
      <div class="toolbar" style="margin:10px 0 0">
${top.map(([k, n]) => `        <span class="chip ghost">${esc(k)}<span class="n">${n}</span></span>`).join('\n')}
      </div>
    </a>`;
}).join('\n');

const index = `${head('备考重点 · 数学考研真题库', '按院校生成备考重点：考察重心、高频细目、题型构成与逐年重点。', '')}
<body class="page-knowledge">
${topbar('', 'focus.html')}
<main>
  <div class="wrap">
<div class="crumbs"><a href="index.html">首页</a> / 备考重点</div>
<div class="section-head page-head">
  <h1>备考重点 · 分校总览</h1>
  <p>每校单独一页：考察重心 / 高频细目 / 题型构成 / 逐年重点，基于 ${KY.questions.length} 道收录真题统计 · ${schoolOrder.length} 所高校</p>
</div>

<section class="section">
  <div class="grid cards">
${cards}
  </div>
</section>
  </div>
</main>
${foot('')}`;
fs.writeFileSync(path.join(ROOT, 'focus.html'), index);

// 院校页插入"备考重点"入口
let linked = 0;
for (const name of schoolOrder) {
  const code = bySchool[name][0].school;
  const f = path.join(ROOT, 'school', code + '.html');
  if (!fs.existsSync(f)) continue;
  let s = fs.readFileSync(f, 'utf8');
  if (s.includes('focus/' + code + '.html')) continue;
  s = s.replace(/(<div class="section-head page-head">\s*<h1>[^<]*<\/h1>\s*<p>[\s\S]*?<\/p>)(\s*<\/div>)/, (m, a, b) => a + `\n  <p style="margin-top:8px"><a class="btn small" href="../focus/${code}.html">查看该校备考重点 →</a></p>` + b);
  fs.writeFileSync(f, s); linked++;
}
console.log(`focus pages: ${schoolOrder.length}, index + ${linked} school-page links`);
