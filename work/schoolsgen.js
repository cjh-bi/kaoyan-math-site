// work/schoolsgen.js — 从 assets/data.js 重建 schools.html（院校总览页）
// 背景：work/ingest.js 的 renderSchools() 用 `src.slice(0, src.indexOf('<body'))` 复用旧文件做页头，
// 而它自己输出的页头里没有 "<body"（只有 body class=…），于是 indexOf 返回 -1、
// slice(0,-1) 把整份旧文件保留下来再追加新内容 —— 每跑一次 build 就多叠一份，
// 现在 schools.html 里叠了 15 份、首屏是最旧（2026-09-25）的数据。
// 本脚本不读旧文件，整页重生成（模板与现有卡片标记一致）。
// 用法: node work/schoolsgen.js [--dry]
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const DRY = process.argv.includes('--dry');
const V = '20260925135128';
const NOW = (() => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; })();
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const raw = fs.readFileSync(path.join(ROOT, 'assets', 'data.js'), 'utf8');
const KY = JSON.parse(raw.slice('window.KY_DATA = '.length).replace(/;\s*$/, ''));
const bySchool = {};
for (const q of KY.questions) (bySchool[q.school_name] = bySchool[q.school_name] || []).push(q);

const SUBJECT_ORDER = ['数学分析', '高等代数', '空间解析几何和高等代数'];
const yearOrder = y => { const m = /^(\d{4})/.exec(y); return m ? +m[1] : 9999; };
const byYear = (a, b) => yearOrder(a) - yearOrder(b) || String(a).localeCompare(String(b));

const names = Object.keys(bySchool).sort((a, b) => bySchool[b].length - bySchool[a].length || a.localeCompare(b));
const cards = names.map(name => {
  const qs = bySchool[name];
  const code = qs[0].school;
  const pids = [...new Set(qs.map(q => q.qid.replace(/-q\d{4}$/, '')))];
  const subs = SUBJECT_ORDER.filter(s => qs.some(q => q.subject === s));
  const years = [...new Set(qs.map(q => q.year))].sort(byYear);
  const l1c = {}; qs.forEach(q => l1c[q.l1] = (l1c[q.l1] || 0) + 1);
  const top = Object.entries(l1c).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3);
  return `    <a class="card" href="school/${code}.html">
      <div class="card-head">
        <h3>${esc(name)}</h3>
        <span class="chip">${qs.length} 题</span>
      </div>
      <p class="small muted">${pids.length} 套卷 · ${subs.join('、')}</p>
      <p class="small muted">年份：${years[0]}–${years[years.length - 1]}（${years.length} 个年份标签）</p>
      <div class="toolbar" style="margin:10px 0 0">
${top.map(([l1, n]) => `        <span class="chip ghost">${l1}<span class="n">${n}</span></span>`).join('\n')}
      </div>
    </a>`;
}).join('\n');

const page = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>院校 · 数学考研真题库</title>
<meta name="description" content="各院校真题卷数、题量与年份分布">
<link rel="icon" href="data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2064%2064'%3E%3Crect%20width='64'%20height='64'%20rx='14'%20fill='%231f5c46'/%3E%3Ctext%20x='32'%20y='45'%20font-size='40'%20text-anchor='middle'%20fill='%23ffffff'%20font-family='sans-serif'%3E%E8%80%83%3C/text%3E%3C/svg%3E">
<link rel="stylesheet" href="assets/katex/katex.min.css">
<link rel="stylesheet" href="assets/site.css?v=${V}">
</head>
<body class="page-schools">
<header class="topbar">
  <div class="wrap topbar-inner">
    <a class="brand" href="index.html"><span class="dot">考</span><span>数学考研真题库</span></a>
    <nav class="nav">
      <a href="index.html">首页</a>
<a href="papers.html">试卷</a>
      <a href="knowledge.html">知识点</a>
      <a href="schools.html" class="active">院校</a>
      <a href="stars.html">收藏</a>
      <a href="stats.html">统计</a>
      <a href="about.html">说明</a>
    </nav>
    <span class="spacer"></span>
  </div>
</header>
<main>
  <div class="wrap">
<div class="crumbs"><a href="index.html">首页</a> / 院校</div>
<div class="section-head page-head">
  <h1>院校</h1>
  <p>共 ${names.length} 所院校 · 按院校看真题卷数、题量与年份分布</p>
</div>

<section class="section">
  <div class="grid cards">
${cards}
  </div>
</section>
  </div>
</main>
<footer class="site">
  <div class="wrap">
    <span>数学考研真题库 · 数据来自 各高校历年数学考研真题（经校对整理），共 ${KY.counts.questions} 题</span>
    <span>生成于 ${NOW} · <a href="about.html">数据说明</a></span>
  </div>
</footer>
<script defer src="assets/katex/katex.min.js"></script>
<script defer src="assets/katex/auto-render.min.js"></script>
<script defer src="assets/math.js?v=${V}"></script>
</body>
</html>
`;
const old = fs.readFileSync(path.join(ROOT, 'schools.html'), 'utf8');
console.log(`old: ${(old.length / 1024).toFixed(0)}KB  copies=${(old.match(/<\/body>/g) || []).length}  new: ${(page.length / 1024).toFixed(0)}KB  cards=${names.length}`);
if (DRY) console.log('--- new head 900 ---\n' + page.slice(0, 900));
else fs.writeFileSync(path.join(ROOT, 'schools.html'), page, 'utf8');
