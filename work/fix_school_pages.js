// work/fix_school_pages.js — 用 assets/data.js 重建过期的 school/*.html 页面
// 背景：work/tmp/purge_dups*.js 去重时删除了 paper/ 与 q/ 下的文件和 data.js 里的题目，
// 但只重建了「本次新增试卷涉及的院校页」，导致 7 所院校的 school/*.html 仍列出已删除的卷，
// 点「查看整卷」落到 404（表现为空白页）。
// 本脚本：从 assets/data.js 重新生成这些院校页（模板与现有页面一致），
//        已登记分值沿用原页面；顺带把所有院校页 footer 的总题量校正为当前值。
// 用法: node work/fix_school_pages.js [--dry] [--all]
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const DRY = process.argv.includes('--dry');
const ALL = process.argv.includes('--all');
const V = '20260925135128';
const NOW = (() => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; })();

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const raw = fs.readFileSync(path.join(ROOT, 'assets', 'data.js'), 'utf8');
const KY = JSON.parse(raw.slice('window.KY_DATA = '.length).replace(/;\s*$/, ''));
const NQ = KY.counts.questions;

const bySchool = {}, byPaper = {};
for (const q of KY.questions) {
  (bySchool[q.school_name] = bySchool[q.school_name] || []).push(q);
  const pid = q.qid.replace(/-q\d{4}$/, '');
  (byPaper[pid] = byPaper[pid] || []).push(q);
}
const SUBJECT_ORDER = ['数学分析', '高等代数', '空间解析几何和高等代数'];
const yearOrder = y => { const m = /^(\d{4})/.exec(y); return m ? +m[1] : 9999; };
const byYear = (a, b) => yearOrder(a) - yearOrder(b) || String(a).localeCompare(String(b));

// 现有院校页里每题卷的分值单元格，按 pid 保留
const rowRe = /<tr>\s*<td>([^<]*)<\/td>\s*<td>([^<]*)<\/td>\s*<td>(\d+)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<td><a href="\.\.\/paper\/([^"]+)\.html">查看整卷<\/a><\/td>\s*<\/tr>/g;

const diskPapers = new Set(fs.readdirSync(path.join(ROOT, 'paper')).map(x => x.replace(/\.html$/, '')));

let rewritten = 0, touchedFooter = 0;
const lines = [];
for (const name of Object.keys(bySchool).sort((a, b) => bySchool[b].length - bySchool[a].length)) {
  const code = bySchool[name][0].school;
  const rel = 'school/' + code + '.html';
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) { lines.push(`NO PAGE  ${rel} (${name})`); continue; }
  const old = fs.readFileSync(abs, 'utf8');
  const qs = bySchool[name];
  const pids = [...new Set(qs.map(q => q.qid.replace(/-q\d{4}$/, '')))];
  const years = [...new Set(qs.map(q => q.year))].sort(byYear);
  const subs = SUBJECT_ORDER.filter(s => qs.some(q => q.subject === s));

  // 该页是否存在失效链接 / 统计口径与 data.js 不符
  const htmlPids = [...old.matchAll(/paper\/([^"]+)\.html/g)].map(m => m[1]);
  const ghost = [...new Set(htmlPids.filter(x => !diskPapers.has(x)))];
  const m = /共 (\d+) 题 · (\d+) 套卷 ·\s*覆盖 (\d+) 个年份标签（([^）]*)）/.exec(old);
  const stale = !m || +m[1] !== qs.length || +m[2] !== pids.length || +m[3] !== years.length || ghost.length > 0;

  // footer 总题量统一校正（与模板无关，安全的小修补）
  let base = old.replace(/（经校对整理），共 [\d,]+ 题/, `（经校对整理），共 ${NQ} 题`);
  if (base !== old) touchedFooter++;

  if (!stale && !ALL) { if (base !== old && !DRY) fs.writeFileSync(abs, base, 'utf8'); continue; }

  const scoreOf = new Map();
  for (const r of old.matchAll(rowRe)) scoreOf.set(r[5], r[4].trim());

  const papers = pids.map(pid => {
    const pq = byPaper[pid];
    return { pid, year: pq[0].year, subject: pq[0].subject, n: pq.length, score: scoreOf.get(pid) };
  }).sort((a, b) => yearOrder(b.year) - yearOrder(a.year) || a.subject.localeCompare(b.subject));

  const l1c = {}; qs.forEach(q => l1c[q.l1] = (l1c[q.l1] || 0) + 1);
  const l1top = Object.entries(l1c).sort((a, b) => b[1] - a[1]).slice(0, 6);

  const p = '../';
  const page = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(name)} · 数学考研真题库</title>
<meta name="description" content="${esc(name)} 考研数学真题 ${qs.length} 题">
<link rel="icon" href="data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2064%2064'%3E%3Crect%20width='64'%20height='64'%20rx='14'%20fill='%231f5c46'/%3E%3Ctext%20x='32'%20y='45'%20font-size='40'%20text-anchor='middle'%20fill='%23ffffff'%20font-family='sans-serif'%3E%E8%80%83%3C/text%3E%3C/svg%3E">
<link rel="stylesheet" href="${p}assets/katex/katex.min.css">
<link rel="stylesheet" href="${p}assets/site.css?v=${V}">
</head>
<body class="page-schools">
<header class="topbar">
  <div class="wrap topbar-inner">
    <a class="brand" href="${p}index.html"><span class="dot">考</span><span>数学考研真题库</span></a>
    <nav class="nav">
      <a href="${p}index.html">首页</a>
<a href="${p}papers.html">试卷</a>
      <a href="${p}knowledge.html">知识点</a>
      <a href="${p}schools.html" class="active">院校</a>
      <a href="${p}stars.html">收藏</a>
      <a href="${p}stats.html">统计</a>
      <a href="${p}about.html">说明</a>
    </nav>
    <span class="spacer"></span>
  </div>
</header>
<main>
  <div class="wrap">
<div class="crumbs">
  <a href="${p}index.html">首页</a> /
  <a href="${p}schools.html">院校</a> /
  ${esc(name)}
</div>
<div class="section-head page-head">
  <h1>${esc(name)}</h1>
  <p>
    共 ${qs.length} 题 · ${pids.length} 套卷 ·
    覆盖 ${years.length} 个年份标签（${years[0]}–${years[years.length - 1]}）·
    ${subs.join('、')}
  </p>
</div>

<section class="section">
  <div class="section-head">
    <h2>知识点构成</h2>
    <p class="small muted">按题量排序，前 6 个一级知识点</p>
  </div>
  <table class="data">
    <thead><tr><th>一级知识点</th><th>题量</th><th>占比</th></tr></thead>
    <tbody>
${l1top.map(([l1, n]) => `      <tr>
        <td>${l1}</td>
        <td>${n}</td>
        <td>${(n * 100 / qs.length).toFixed(1)}%</td>
      </tr>`).join('\n')}
    </tbody>
  </table>
</section>

<section class="section">
  <div class="section-head">
    <h2>该校真题卷（${pids.length} 套）</h2>
    <p class="small muted">点击进入整卷视图，可打印本卷</p>
  </div>
  <table class="data">
    <thead><tr><th>年份</th><th>科目</th><th>题数</th><th>已登记分值</th><th>操作</th></tr></thead>
    <tbody>
${papers.map(x => `      <tr>
        <td>${x.year}</td>
        <td>${x.subject}</td>
        <td>${x.n}</td>
        <td>${x.score || '<span class="muted">—</span>'}</td>
        <td><a href="${p}paper/${x.pid}.html">查看整卷</a></td>
      </tr>`).join('\n')}
    </tbody>
  </table>
</section>

<section class="section">
  <div class="section-head">
    <h2>按年份检索</h2>
    <p class="small muted">收录年份</p>
  </div>
  <div class="toolbar">
${years.map(y => `    <span class="chip" >${y}</span>`).join('\n')}
  </div>
</section>
  </div>
</main>
<footer class="site">
  <div class="wrap">
    <span>数学考研真题库 · 数据来自 各高校历年数学考研真题（经校对整理），共 ${NQ} 题</span>
    <span>生成于 ${NOW} · <a href="${p}about.html">数据说明</a></span>
  </div>
</footer>
<script defer src="${p}assets/katex/katex.min.js"></script>
<script defer src="${p}assets/katex/auto-render.min.js"></script>
<script defer src="${p}assets/math.js?v=${V}"></script>
</body>
</html>
`;
  if (!DRY) fs.writeFileSync(abs, page, 'utf8');
  rewritten++;
  lines.push(`${stale ? 'REBUILD' : 'rebuild(all)'} ${rel}  ${name}: ${qs.length} 题/${pids.length} 套  清除失效卷=${ghost.length}`);
}
console.log(lines.join('\n'));
console.log(`rewritten=${rewritten} footer-only=${touchedFooter - rewritten} dry=${DRY}`);
