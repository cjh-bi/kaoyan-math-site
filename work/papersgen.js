// work/papersgen.js — 重建 papers.html：按学校分组，chips 显示"年份+科目"
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const V = '20260925135128';
const raw = fs.readFileSync(path.join(ROOT, 'assets', 'data.js'), 'utf8');
const KY = JSON.parse(raw.slice('window.KY_DATA = '.length).replace(/;\s*$/, ''));
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const yearOrder = y => { const m = /^(\d{4})/.exec(y); return m ? +m[1] : 9999; };

const bySchool = {}, byPaper = {};
for (const q of KY.questions) {
  (bySchool[q.school_name] = bySchool[q.school_name] || []).push(q);
  const pid = q.qid.replace(/-q\d{4}$/, '');
  (byPaper[pid] = byPaper[pid] || []).push(q);
}
const schoolCount = {}; for (const n in bySchool) schoolCount[n] = bySchool[n].length;
const schoolOrder = Object.keys(schoolCount).sort((a, b) => schoolCount[b] - schoolCount[a]);

function topbar(active) {
  const items = [['index.html', '首页'], ['papers.html', '试卷'], ['knowledge.html', '知识点'], ['schools.html', '院校'], ['stars.html', '收藏'], ['stats.html', '统计'], ['about.html', '说明']];
  return `<header class="topbar">
  <div class="wrap topbar-inner">
    <a class="brand" href="index.html"><span class="dot">考</span><span>数学考研真题库</span></a>
    <nav class="nav">
${items.map(([h, l]) => `      <a href="${h}"${h === active ? ' class="active"' : ''}>${l}</a>`).join('\n')}
    </nav>
    <span class="spacer"></span>
  </div>
</header>`;
}
const FAVICON = `data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2064%2064'%3E%3Crect%20width='64'%20height='64'%20rx='14'%20fill='%231f5c46'/%3E%3Ctext%20x='32'%20y='45'%20font-size='40'%20text-anchor='middle'%20fill='%23ffffff'%20font-family='sans-serif'%3E%E8%80%83%3C/text%3E%3C/svg%3E`;

const sections = schoolOrder.map(name => {
  const qs = bySchool[name];
  const pids = [...new Set(qs.map(q => q.qid.replace(/-q\d{4}$/, '')))];
  const years = [...new Set(qs.map(q => q.year))].sort(yearOrder);
  const papers = pids.map(pid => { const pq = byPaper[pid]; return { pid, year: pq[0].year, subject: pq[0].subject }; })
    .sort((a, b) => yearOrder(b.year) - yearOrder(a.year) || a.subject.localeCompare(b.subject));
  return `<section class="section">
  <div class="section-head">
    <h2><a href="school/${qs[0].school}.html">${esc(name)}</a></h2>
    <p>${pids.length} 套卷 · ${qs.length} 题 · ${years[0]}–${years[years.length - 1]}</p>
  </div>
  <div class="toolbar" style="margin:0">
${papers.map(p => `    <a class="chip" href="paper/${p.pid}.html">${p.year} ${p.subject}</a>`).join('\n')}
  </div>
</section>`;
});

const page = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>试卷 · 数学考研真题库</title>
<meta name="description" content="按院校浏览全部 ${Object.keys(byPaper).length} 套考研数学真题试卷">
<link rel="icon" href="${FAVICON}">
<link rel="stylesheet" href="assets/katex/katex.min.css">
<link rel="stylesheet" href="assets/site.css?v=${V}">
</head>
<body class="page-papers">
${topbar('papers.html')}
<main>
  <div class="wrap">
<div class="section-head page-head">
  <h1>试卷</h1>
  <p>按院校浏览 · 共 ${schoolOrder.length} 所高校 · ${Object.keys(byPaper).length} 套真题卷，点击任一卷名进入整卷视图（可打印）</p>
</div>

${sections.join('\n')}
  </div>
</main>
<footer class="site">
  <div class="wrap">
    <span>数学考研真题库 · 数据来自 各高校历年数学考研真题（经校对整理），共 ${KY.questions.length} 题</span>
    <span>生成于 ${KY.generated_at} · <a href="about.html">数据说明</a></span>
  </div>
</footer>
<script defer src="assets/katex/katex.min.js"></script>
<script defer src="assets/katex/auto-render.min.js"></script>
<script defer src="assets/math.js?v=${V}"></script>
</body>
</html>
`;
fs.writeFileSync(path.join(ROOT, 'papers.html'), page);
console.log('papers.html rebuilt:', schoolOrder.length, 'schools,', Object.keys(byPaper).length, 'papers');
