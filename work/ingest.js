// work/ingest.js — 把转录的真题并入静态站
// 用法: node work/ingest.js [--dry]
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..');
const DRY = process.argv.includes('--dry');
const V = '20260925135128'; // 与现有页面一致的 cache buster
const NOW = (() => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; })();

const enc = encodeURIComponent;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const stemHtml = s => esc(s).replace(/\n/g, '<br>');
function plainStem(s) { // meta description 用：去 $ 定界、常见命令转可读
  let t = s.replace(/\$\$?/g, ' ').replace(/\\[a-zA-Z]+/g, m => ({ '\\lim': 'lim', '\\to': '→', '\\infty': '∞', '\\dfrac': '', '\\frac': '', '\\left': '', '\\right': '', '\\int': '∫', '\\sum': '∑' }[m] ?? ' ')).replace(/\s+/g, ' ').trim();
  return t.slice(0, 150);
}
function truncateStem(s, max = 120) { // stem_display：安全截断，不在 $..$ 内切断
  const one = s.replace(/\n/g, ' ');
  if (one.length <= max) return one;
  let cut = one.slice(0, max);
  const dollars = (cut.match(/\$/g) || []).length;
  if (dollars % 2) cut = cut.slice(0, cut.lastIndexOf('$'));
  return cut.trim() + '…';
}
const sha8 = str => crypto.createHash('sha1').update(str).digest('hex').slice(0, 8);

// ---------- 载入现有数据 ----------
const dataPath = path.join(ROOT, 'assets', 'data.js');
const raw = fs.readFileSync(dataPath, 'utf8');
const KY = JSON.parse(raw.slice('window.KY_DATA = '.length).replace(/;\s*$/, ''));
const vocab = JSON.parse(fs.readFileSync(path.join(ROOT, 'work', 'vocab.json'), 'utf8'));
const codes = JSON.parse(fs.readFileSync(path.join(ROOT, 'work', 'school_codes.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'work', 'manifest.json'), 'utf8'));
for (const mf of fs.readdirSync(path.join(ROOT, 'work'))) {
  const mm = /^manifest(20\d\d)\.json$/.exec(mf);
  if (!mm) continue;
  try { const extra = JSON.parse(fs.readFileSync(path.join(ROOT, 'work', mf), 'utf8')); let n = 0; for (const r of extra) if (!manifest.some(x => x.msgid === r.msgid)) { manifest.push(r); n++; } console.log(`merged ${mf}: ${extra.length} articles (+${n})`); } catch (e) { console.log(`skip ${mf}:`, e.message); }
}

const existingPapers = new Set(KY.questions.map(q => q.qid.replace(/-q\d{4}$/, '')));
const existingPaperKey = new Map(); // school|year|subject -> paperid
const paperMeta = new Map(); // paperid -> {yearLabel, subject, school, count, scoreKnown, scoreTotal, structure}
for (const q of KY.questions) {
  const pid = q.qid.replace(/-q\d{4}$/, '');
  if (!existingPaperKey.has(q.school_name + '|' + q.year + '|' + q.subject)) existingPaperKey.set(q.school_name + '|' + q.year + '|' + q.subject, pid);
}

// 解析 papers.html 全部试卷表 → 现有试卷的分值/结构信息
const papersHtml = fs.readFileSync(path.join(ROOT, 'papers.html'), 'utf8');
{
  const rows = papersHtml.matchAll(/<tr>\s*<td class="text-nowrap">([^<]*)<\/td>\s*<td><a href="paper\/([^"]+)\.html">([^<]*)<\/a><\/td>\s*<td class="num">(\d+)<\/td>\s*<td class="num">\s*([\s\S]*?)<\/td>\s*<td class="small muted">\s*([\s\S]*?)\s*<\/td>/g);
  for (const m of rows) {
    const pid = m[2];
    const sc = /（(\d+)\/\d+/.exec(m[5]); const tot = /(\d+)\s*分/.exec(m[5]);
    paperMeta.set(pid, { yearLabel: m[1], subject: m[3], count: +m[4], known: sc ? +sc[1] : 0, total: tot ? +tot[1] : null, structure: m[6].trim() });
  }
}

// ---------- 载入转录 ----------
const tDir = path.join(ROOT, 'work', 'transcripts');
const transcripts = [];
if (fs.existsSync(tDir)) for (const f of fs.readdirSync(tDir)) if (f.endsWith('.json')) {
  try { transcripts.push(JSON.parse(fs.readFileSync(path.join(tDir, f), 'utf8'))); }
  catch (e) { console.log('BAD JSON', f, e.message); }
}

// 新学校代码补充表 + 名称/科目规范化
const EXTRA_CODES = { '中国石油大学(北京)': 'cupb', '重庆市统考': 'cqtongkao' };
const SCHOOL_ALIAS = { '中国矿业大学': '中国矿业大学(徐州)' };
const SUBJECT_ALIAS = { '空间解析几何与高等代数': '空间解析几何和高等代数' };
// 吉林大学 2026 的"高等代数与解析几何"与原站"空间解析几何和高等代数"为同卷（已逐题核对）
const SCHOOL_SUBJECT_ALIAS = { '吉林大学|高等代数与解析几何': '空间解析几何和高等代数', '电子科技大学|线性代数': '高等代数', '东北师范大学|高等代数与解析几何': '高等代数', '山东大学|线性代数与常微分方程': '高等代数', '中国科学技术大学|线性代数与解析几何': '高等代数' };
function schoolCode(name) {
  if (codes[name]) return codes[name];
  if (EXTRA_CODES[name]) return EXTRA_CODES[name];
  const c = 'u' + sha8(name).slice(0, 7);
  EXTRA_CODES[name] = c; return c;
}
const FORM2TYPE = { 填空: 'blank', 计算: 'calc', 证明: 'proof', 判断: 'judge', 综合: 'other' };
const L1SET = new Set(vocab.l1), L2PAIR = new Set(vocab.l2.map(x => x.subject + '|' + x.l1 + '|' + x.l2));
const L2ANY = new Set(vocab.l2.map(x => x.l1 + '|' + x.l2));

const newPapers = [], newQuestions = [];
const seenPaper = new Set();
for (const t of transcripts) {
  for (const ex of (t.exams || [])) {
    ex.school = SCHOOL_ALIAS[ex.school] || ex.school;
    ex.subject = SUBJECT_ALIAS[ex.subject] || ex.subject;
    ex.subject = SCHOOL_SUBJECT_ALIAS[ex.school + '|' + ex.subject] || ex.subject;
    const t2 = { ...ex, key: `${t.msgid}_${ex.school}_${ex.subject}` };
    if (!t2.school || !t2.year || !t2.subject || !Array.isArray(t2.questions) || !t2.questions.length) { console.log('skip bad exam in', t.msgid); continue; }
    const key = t2.school + '|' + t2.year + '|' + t2.subject;
    if (existingPaperKey.has(key) || seenPaper.has(key)) { console.log('skip dup paper', key); continue; }
    seenPaper.add(key);
    const code = schoolCode(t2.school);
    let pid = `major-0701-${t2.year}-${code}-${sha8(t2.key + '|' + t2.school + '|' + t2.subject)}`;
    while (existingPapers.has(pid)) pid += 'x';
    const qs = [];
    t2.questions.forEach((q, i) => {
      let l1 = q.l1 && L1SET.has(q.l1) ? q.l1 : '未分类';
      let l2 = q.l2 && L2ANY.has(l1 + '|' + q.l2) ? q.l2 : '';
      if (l1 === '未分类') l2 = '';
      const rec = {
        qid: `${pid}-q${String(i + 1).padStart(4, '0')}`,
        subject: t2.subject, year: t2.year, section: q.section || '一', number: String(q.no || i + 1),
        l1, l2, form: FORM2TYPE[q.form] ? q.form : '综合', school: code, school_name: t2.school,
        answer_state: '无答案', q_type: FORM2TYPE[FORM2TYPE[q.form] ? q.form : '综合'],
        sub_count: ((q.stem.match(/\(\s*\d\s*\)/g) || []).length) || 0,
        note: '', source_row: i + 1,
        stem_display: truncateStem(q.stem || ''), has_answer: false,
        _stem: q.stem || '', _score: typeof q.score === 'number' ? q.score : null, _instr: q.section_instruction || ''
      };
      qs.push(rec);
    });
    if (!qs.length) continue;
    const known = qs.filter(q => q._score != null);
    newPapers.push({ pid, school: t2.school, code, year: t2.year, subject: t2.subject, header: t2.header_note || '', qs, knownTotal: known.reduce((a, q) => a + q._score, 0), knownCount: known.length });
    newQuestions.push(...qs);
  }
}
console.log(`transcripts=${transcripts.length} new papers=${newPapers.length} new questions=${newQuestions.length}`);

// ---------- 公共模板 ----------
const FAVICON = `data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2064%2064'%3E%3Crect%20width='64'%20height='64'%20rx='14'%20fill='%231f5c46'/%3E%3Ctext%20x='32'%20y='45'%20font-size='40'%20text-anchor='middle'%20fill='%23ffffff'%20font-family='sans-serif'%3E%E8%80%83%3C/text%3E%3C/svg%3E`;
function topbar(p, active) {
  const items = [['index.html', '首页'], ['questions.html', '题库'], ['papers.html', '试卷'], ['knowledge.html', '知识点'], ['schools.html', '院校'], ['stars.html', '收藏'], ['stats.html', '统计'], ['about.html', '说明']];
  return `<header class="topbar">
  <div class="wrap topbar-inner">
    <a class="brand" href="${p}index.html"><span class="dot">考</span><span>数学考研真题库</span></a>
    <nav class="nav">
${items.map(([h, l]) => `      <a href="${p}${h}"${h === active ? ' class="active"' : ''}>${l}</a>`).join('\n')}
    </nav>
    <span class="spacer"></span>
    <form class="search-mini" action="${p}questions.html" method="get">
      <svg class="icon-search" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false"><circle cx="7" cy="7" r="4.6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10.6 10.6 14 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      <input type="search" name="q" placeholder="题干或知识点" aria-label="搜索题库">
    </form>
  </div>
</header>`;
}
function footer(p, count) {
  return `<footer class="site">
  <div class="wrap">
    <span>数学考研真题库 · 数据来自 各高校历年数学考研真题（经校对整理），共 ${count} 题</span>
    <span>生成于 ${NOW} · <a href="${p}about.html">数据说明</a></span>
  </div>
</footer>`;
}
const scripts = p => `<script defer src="${p}assets/katex/katex.min.js"></script>
<script defer src="${p}assets/katex/auto-render.min.js"></script>
<script defer src="${p}assets/math.js?v=${V}"></script>`;
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
const w = (f, s) => { const full = path.join(ROOT, f); if (!DRY) { fs.mkdirSync(path.dirname(full), { recursive: true }); fs.writeFileSync(full, s); } };

// ---------- 题目页 ----------
function renderQ(paper, qi, count) {
  const q = paper.qs[qi], p = '../';
  const prev = qi > 0 ? paper.qs[qi - 1] : null, next = qi < paper.qs.length - 1 ? paper.qs[qi + 1] : null;
  const scoreTag = q._score != null ? `\n<span class="sep">|</span><span class="t">${q._score} 分</span>` : '';
  return `${head(`${q.year} ${q.subject} ${q.section}${q.number} · 数学考研真题库`, plainStem(q._stem), p)}
<body class="page-question">
${topbar(p, 'questions.html')}
<main>
  <div class="wrap">
<div class="crumbs">
  <a href="${p}index.html">首页</a> /
  <a href="${p}questions.html">题库</a> /
<a href="${p}paper/${paper.pid}.html">${q.year} 试卷</a> /  <a href="${p}questions.html?subject=${enc(q.subject)}">${q.subject}</a> /
  ${q.year} ${q.section}${q.number}
</div>

<div class="detail">
  <article class="panel">
    <h1 class="qmeta">
      <span class="no">${q.year} · ${q.subject} · ${q.section}${q.number}</span>
      <span class="sep">|</span>
      <span class="t">${q.form}</span>${scoreTag}    </h1>
    <div class="qstem">${stemHtml(q._stem)}</div>
    <div class="toolbar" style="margin-top:14px">
      <button class="btn small star-btn" id="star-btn" type="button" aria-label="收藏此题">☆ 收藏</button>
      <button class="btn small copy-btn" data-stem="${esc(q._stem)}" title="复制题干原文（含 LaTeX，保留换行）">复制题干</button>
      <a class="btn small" href="${p}paper/${paper.pid}.html#${q.qid}">在试卷中查看</a>
    </div>
    <div class="notice" style="margin-top:18px">
      <strong>来源</strong>：扬数林数学专业考研公众号「${q.year}考研真题收集」合集（图片转录，公式经排版校对）
    </div>
    <div class="pager">
${prev ? `<a href="${prev.qid}.html">← 上一题（${prev.year} ${prev.section}${prev.number}）</a>` : ''}${next ? `<a href="${next.qid}.html">下一题（${next.year} ${next.section}${next.number}）→</a>` : ''}    </div>
  </article>

  <aside class="panel">
    <h2 class="side-title">题目信息</h2>
    <div class="meta-list">
      <div><span class="k">题号</span><br>${q.year} 年 ${q.section} ${q.number} 题</div>
      <div><span class="k">一级知识点</span><br><a class="chip accent" href="${p}questions.html?subject=${enc(q.subject)}&l1=${enc(q.l1)}">${q.l1}</a></div>
${q.l2 ? `<div><span class="k">二级知识点</span><br><a class="chip" href="${p}questions.html?subject=${enc(q.subject)}&l2=${enc(q.l2)}">${q.l2}</a></div>` : ''}      <div><span class="k">形式 / 题型</span><br>${q.form}（${q.q_type}）</div>
<div><span class="k">分值</span><br>${q._score != null ? q._score + ' 分' : '未标注'}</div>      <div><span class="k">来源</span><br><span class="mono">扬数林数学专业考研（公众号整理）</span></div>
<div><span class="k">所属试卷</span><br><a href="${p}paper/${paper.pid}.html">${q.year} ${q.subject}（${paper.qs.length} 题）</a></div>      <div><span class="k">记录 ID</span><br><span class="mono">${q.qid}</span></div>
    </div>
  </aside>
</div>
  </div>
</main>
${footer(p, count)}
${scripts(p)}
<script defer src="${p}assets/stars.js?v=${V}"></script>
<script defer src="${p}assets/copy.js?v=${V}"></script>
<script defer>
document.addEventListener("DOMContentLoaded", function () {
  var btn = document.getElementById("star-btn");
  if (!btn || !window.KYStars) return;
  var qid = "${q.qid}";
  function paint(on) {
    btn.textContent = on ? "★ 已收藏" : "☆ 收藏";
    btn.classList.toggle("on", on);
    btn.setAttribute("aria-label", on ? "取消收藏" : "收藏此题");
  }
  paint(window.KYStars.has(qid));
  btn.addEventListener("click", function () { paint(window.KYStars.toggle(qid)); });
});
</script>
</body>
</html>`;
}

// ---------- 试卷页 ----------
function renderPaper(paper, count) {
  const p = '../', qs = paper.qs;
  const secs = {}; qs.forEach(q => secs[q.section] = (secs[q.section] || 0) + 1);
  const l1c = {}; qs.forEach(q => l1c[q.l1] = (l1c[q.l1] || 0) + 1);
  return `${head(`${paper.year} ${paper.subject} · 数学考研真题库`, `${paper.year} 年 ${paper.subject} 试卷（${paper.school}），共 ${qs.length} 题`, p)}
<body class="page-papers">
${topbar(p, 'papers.html')}
<main>
  <div class="wrap">
<div class="print-only">
  <div class="t">${paper.year} 年 ${paper.subject}</div>
  <div class="s">数学考研真题库 · 共 ${qs.length} 题 · 已知分值合计 ${paper.knownTotal} 分</div>
</div>

<div class="crumbs">
  <a href="${p}index.html">首页</a> /
  <a href="${p}papers.html">试卷</a> /
<a href="${p}school/${paper.code}.html">${esc(paper.school)}</a> / ${paper.year} ${paper.subject}
</div>

<div class="section-head page-head">
  <h1>${paper.year} 年 · ${paper.subject}</h1>
  <p>
院校：${esc(paper.school)} ·     共 ${qs.length} 题
· 已知分值合计 ${paper.knownTotal} 分（${paper.knownCount}/${qs.length} 题有分值）
  </p>
</div>

<div class="toolbar" style="margin-bottom:18px">
  <button class="btn small" id="print-paper">打印本卷</button>
  <span class="small muted">打印时会自动隐藏导航、筛选与按钮，只留题干</span>
</div>

<div class="panel paper-meta" style="margin-bottom:26px">
  <div class="small muted" style="margin-bottom:8px">卷面结构</div>
  <div class="toolbar" style="margin:0">
${Object.entries(secs).map(([s, n]) => `    <span class="chip">${s}<span class="n muted">${n} 题</span></span>`).join('\n')}
  </div>
  <div class="small muted" style="margin:14px 0 8px">本卷知识点分布</div>
  <div class="toolbar" style="margin:0">
${Object.entries(l1c).sort((a, b) => b[1] - a[1]).map(([l1, n]) => `    <a class="chip accent" href="${p}questions.html?subject=${enc(paper.subject)}&l1=${enc(l1)}">${l1}<span class="n">${n}</span></a>`).join('\n')}
  </div>
</div>
${Object.entries(secs).map(([s]) => `
<section class="section">
  <div class="section-head">
    <h2>${s}</h2>
    <p>${qs.filter(q => q.section === s).length} 题${(qs.find(q => q.section === s && q._instr) || {})._instr ? ' · ' + esc(qs.find(q => q.section === s && q._instr)._instr) : ''}</p>
  </div>
  <div class="qlist">
${qs.filter(q => q.section === s).map(q => `    <article class="qcard" id="${q.qid}">
      <div class="qmeta">
        <span class="no"><span class="sec">${q.section}</span>${q.number}</span>${q._score != null ? `\n<span class="sep">|</span><span class="t">${q._score} 分</span>` : ''}      </div>
      <div class="stem">${stemHtml(q._stem)}</div>
      <div class="foot">
        <a href="${p}questions.html?l1=${enc(q.l1)}">${q.l1}</a>
${q.l2 ? `<span class="chip">${q.l2}</span>` : ''}        <span class="chip ghost">${q.form}</span>
        <a class="small" style="margin-left:auto" href="${p}q/${q.qid}.html">查看详情 →</a>
        <button class="btn small copy-btn" data-stem="${esc(q._stem)}" title="复制题干原文（含 LaTeX，保留换行）">复制题干</button>
        <button class="btn small star-btn" type="button" data-qid="${q.qid}" aria-label="收藏此题">☆</button>
      </div>
    </article>`).join('\n')}
  </div>
</section>`).join('')}
  </div>
</main>
${footer(p, count)}
${scripts(p)}
<script defer src="${p}assets/stars.js?v=${V}"></script>
<script defer src="${p}assets/copy.js?v=${V}"></script>
<script defer>
document.addEventListener("DOMContentLoaded", function () {
  if (window.KYStars) {
    document.querySelectorAll(".star-btn[data-qid]").forEach(function (btn) {
      var qid = btn.dataset.qid;
      var paint = function (on) {
        btn.textContent = on ? "★" : "☆";
        btn.classList.toggle("on", on);
        btn.setAttribute("aria-label", on ? "取消收藏" : "收藏此题");
      };
      paint(window.KYStars.has(qid));
      btn.addEventListener("click", function () { paint(window.KYStars.toggle(qid)); });
    });
  }
  var btn = document.getElementById("print-paper");
  if (btn) btn.addEventListener("click", function () { window.print(); });
});
</script>
</body>
</html>`;
}

// ---------- 聚合数据 ----------
const ALL = KY.questions.concat(newQuestions);
const bySchool = {}, byPaper = {};
for (const q of ALL) {
  (bySchool[q.school_name] = bySchool[q.school_name] || []).push(q);
  const pid = q.qid.replace(/-q\d{4}$/, '');
  (byPaper[pid] = byPaper[pid] || []).push(q);
}
const newPidSet = new Set(newPapers.map(x => x.pid));
const paperScore = {}; // pid -> {known, total}
for (const [pid, qs] of Object.entries(byPaper)) {
  if (newPidSet.has(pid)) { const np = newPapers.find(x => x.pid === pid); paperScore[pid] = { known: np.knownCount, total: np.knownTotal }; }
  else if (paperMeta.has(pid)) { const m = paperMeta.get(pid); paperScore[pid] = { known: m.known, total: m.total }; }
  else paperScore[pid] = { known: 0, total: null };
}
const yearOrder = y => { const m = /^(\d{4})/.exec(y); return m ? +m[1] : 9999; };
const byYear = (a, b) => yearOrder(a) - yearOrder(b) || String(a).localeCompare(String(b));
const schoolCount = {}; for (const n of Object.keys(bySchool)) schoolCount[n] = bySchool[n].length;
const schoolOrder = Object.keys(schoolCount).sort((a, b) => schoolCount[b] - schoolCount[a]);
const SUBJECT_ORDER = ['数学分析', '高等代数', '空间解析几何和高等代数'];
const subjOf = s => SUBJECT_ORDER.includes(s) ? s : (s || '');

// ---------- schools.html ----------
function renderSchools() {
  const cards = schoolOrder.map(name => {
    const qs = bySchool[name]; const code = qs[0].school;
    const pids = [...new Set(qs.map(q => q.qid.replace(/-q\d{4}$/, '')))];
    const subs = SUBJECT_ORDER.filter(s => qs.some(q => q.subject === s));
    const years = [...new Set(qs.map(q => q.year))].sort(byYear);
    const l1c = {}; qs.forEach(q => l1c[q.l1] = (l1c[q.l1] || 0) + 1);
    const top = Object.entries(l1c).sort((a, b) => b[1] - a[1]).slice(0, 3);
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
  const src = fs.readFileSync(path.join(ROOT, 'schools.html'), 'utf8');
  const head = src.slice(0, src.indexOf('<div class="grid cards">'));
  const tail = src.slice(src.indexOf('</main>'));
  const page = src.slice(0, src.indexOf('<body')) + `body class="page-schools">
${topbar('', 'schools.html')}
<main>
  <div class="wrap">
<div class="crumbs"><a href="index.html">首页</a> / 院校</div>
<div class="section-head page-head">
  <h1>院校</h1>
  <p>共 ${schoolOrder.length} 所院校 · 按院校看真题卷数、题量与年份分布</p>
</div>

<section class="section">
  <div class="grid cards">
${cards}
  </div>
</section>
  </div>
</main>
${footer('', ALL.length)}
${scripts('')}
</body>
</html>`;
  return page;
}

// ---------- school/<code>.html ----------
function renderSchoolPage(name) {
  const qs = bySchool[name], code = qs[0].school, p = '../';
  const pids = [...new Set(qs.map(q => q.qid.replace(/-q\d{4}$/, '')))];
  const subs = SUBJECT_ORDER.filter(s => qs.some(q => q.subject === s));
  const years = [...new Set(qs.map(q => q.year))].sort(byYear);
  const l1c = {}; qs.forEach(q => l1c[q.l1] = (l1c[q.l1] || 0) + 1);
  const l1top = Object.entries(l1c).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const papers = pids.map(pid => {
    const pq = qs.filter(q => q.qid.startsWith(pid));
    return { pid, year: pq[0].year, subject: pq[0].subject, n: pq.length };
  }).sort((a, b) => yearOrder(b.year) - yearOrder(a.year) || a.subject.localeCompare(b.subject));
  return `${head(`${name} · 数学考研真题库`, `${name} 考研数学真题 ${qs.length} 题`, p)}
<body class="page-schools">
${topbar(p, 'schools.html')}
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
    <thead><tr><th>一级知识点</th><th>题量</th><th>占比</th><th>检索</th></tr></thead>
    <tbody>
${l1top.map(([l1, n]) => `      <tr>
        <td>${l1}</td>
        <td>${n}</td>
        <td>${(n * 100 / qs.length).toFixed(1)}%</td>
        <td><a href="${p}questions.html?school=${enc(name)}&l1=${enc(l1)}">筛选</a></td>
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
${papers.map(pp => { const sc = paperScore[pp.pid]; return `      <tr>
        <td>${pp.year}</td>
        <td>${pp.subject}</td>
        <td>${pp.n}</td>
        <td>${sc.total != null ? sc.total + ' 分 <span class="muted small">（' + sc.known + '/' + pp.n + '）</span>' : '<span class="muted">—</span>'}</td>
        <td><a href="${p}paper/${pp.pid}.html">查看整卷</a></td>
      </tr>`; }).join('\n')}
    </tbody>
  </table>
</section>

<section class="section">
  <div class="section-head">
    <h2>按年份检索</h2>
    <p class="small muted">点年份进入题库并自动套用筛选</p>
  </div>
  <div class="toolbar">
${years.map(y => `    <a class="chip" href="${p}questions.html?school=${enc(name)}&year=${enc(y)}">${y}</a>`).join('\n')}
  </div>
</section>
  </div>
</main>
${footer(p, ALL.length)}
${scripts(p)}
</body>
</html>`;
}

// ---------- papers.html ----------
function renderPapers() {
  const allPapers = Object.entries(byPaper).map(([pid, qs]) => ({ pid, year: qs[0].year, subject: qs[0].subject, school: qs[0].school_name, n: qs.length, isNew: newPidSet.has(pid) }));
  const yearLabels = [...new Set(allPapers.map(x => x.year))].sort(byYear);
  const sections = yearLabels.map(y => {
    const ps = allPapers.filter(x => x.year === y);
    const label = /^\d{4}$/.test(y) ? `${y} 年` : `${y.replace('-', '/')} 年`;
    return `<section class="section">
  <div class="section-head">
    <h2>${label}</h2>
    <p>
${ps.map(x => `      <a class="chip" href="paper/${x.pid}.html">${x.isNew ? esc(x.school) + ' · ' : ''}${x.subject}<span class="n muted">${x.n} 题</span></a>`).join('\n')}
    </p>
  </div>
</section>`;
  }).join('\n');
  const rows = allPapers.sort((a, b) => yearOrder(a.year) - yearOrder(b.year) || a.school.localeCompare(b.school)).map(x => {
    const sc = paperScore[x.pid];
    const secs = {}; x.pid && byPaper[x.pid].forEach(q => secs[q.section] = (secs[q.section] || 0) + 1);
    const struct = Object.entries(secs).map(([s, n]) => `${s}（${n}）`).join(' · ');
    return `          <tr>
            <td class="text-nowrap">${x.year}</td>
            <td><a href="paper/${x.pid}.html">${x.subject}</a>${x.isNew ? ` <span class="muted small">· ${esc(x.school)}</span>` : ''}</td>
            <td class="num">${x.n}</td>
            <td class="num">
${sc.total != null ? `${sc.total} 分
                <span class="muted small">（${sc.known}/${x.n} 题已知）</span>` : '<span class="muted">原卷未印分值</span>'}
            </td>
            <td class="small muted">
${struct}
            </td>
          </tr>`;
  }).join('\n');
  return `${head('试卷 · 数学考研真题库', '按年份浏览整套试卷，看卷面结构与分值分布', '')}
<body class="page-papers">
${topbar('', 'papers.html')}
<main>
  <div class="wrap">
${sections}

<section class="section">
  <div class="section-head">
    <h2>全部试卷</h2>
    <p>题数与已知分值合计</p>
  </div>
  <div class="panel">
    <div class="table-responsive">
      <table class="data">
        <thead>
          <tr><th>年份</th><th>科目</th><th class="num">题数</th><th class="num">已知分值合计</th><th>卷面结构</th></tr>
        </thead>
        <tbody>
${rows}
        </tbody>
      </table>
    </div>
  </div>
</section>
  </div>
</main>
${footer('', ALL.length)}
${scripts('')}
</body>
</html>`;
}

// ---------- knowledge.html ----------
function renderKnowledge() {
  const subjCnt = {}; for (const q of ALL) subjCnt[q.subject] = (subjCnt[q.subject] || 0) + 1;
  const subs = Object.keys(subjCnt).sort((a, b) => (SUBJECT_ORDER.indexOf(a) + 1 || 99) - (SUBJECT_ORDER.indexOf(b) + 1 || 99) || subjCnt[b] - subjCnt[a]);
  let l1total = 0, l2total = 0;
  const body = subs.map(s => {
    const l1c = {}, pairs = {};
    for (const q of ALL.filter(x => x.subject === s)) { l1c[q.l1] = (l1c[q.l1] || 0) + 1; if (q.l2) pairs[q.l1 + '|' + q.l2] = (pairs[q.l1 + '|' + q.l2] || 0) + 1; }
    l1total += Object.keys(l1c).length; l2total += Object.keys(pairs).length;
    const l1s = Object.entries(l1c).sort((a, b) => b[1] - a[1]);
    return `<section class="section">
  <div class="section-head">
    <h2>${s}</h2>
    <p>${subjCnt[s]} 道题</p>
  </div>
  <div class="tree">
${l1s.map(([l1, n]) => {
      const l2s = Object.entries(pairs).filter(([k]) => k.startsWith(l1 + '|')).map(([k, v]) => [k.split('|')[1], v]).sort((a, b) => b[1] - a[1]);
      const yearsOf = l2 => [...new Set(ALL.filter(x => x.subject === s && x.l1 === l1 && x.l2 === l2).map(x => x.year))].sort(byYear).join('、');
      return `    <details open>
      <summary>
        <span class="grow">${l1}</span>
        <span class="n">${n} 题</span>
      </summary>
      <div class="l2list">
        <a class="chip accent" href="questions.html?subject=${enc(s)}&l1=${enc(l1)}">全部 ${n} 题</a>
${l2s.map(([l2, m]) => `        <a class="chip" href="questions.html?subject=${enc(s)}&l1=${enc(l1)}&l2=${enc(l2)}" title="出现年份：${yearsOf(l2)}">${l2}<span class="n muted">${m}</span></a>`).join('\n')}
      </div>
    </details>`;
    }).join('\n')}
  </div>
</section>`;
  }).join('\n');
  return `${head('知识点 · 数学考研真题库', '知识点树与题量分布', '')}
<body class="page-knowledge">
${topbar('', 'knowledge.html')}
<main>
  <div class="wrap">
<div class="crumbs"><a href="index.html">首页</a> / 知识点</div>
<div class="section-head">
  <h1>知识点总览</h1>
  <p>${l1total} 个一级知识点 · ${l2total} 个二级细目 · 点击进入对应题目</p>
</div>

${body}
  </div>
</main>
${footer('', ALL.length)}
${scripts('')}
</body>
</html>`;
}

// ---------- index.html ----------
function renderIndex() {
  const nQ = ALL.length, nP = Object.keys(byPaper).length;
  const years = [...new Set(ALL.map(q => q.year))].sort(byYear);
  const l1s = new Set(ALL.map(q => q.l1)).size;
  const subjCnt = {}; for (const q of ALL) subjCnt[q.subject] = (subjCnt[q.subject] || 0) + 1;
  const cards = SUBJECT_ORDER.filter(s => subjCnt[s]).map(s => {
    const qs = ALL.filter(q => q.subject === s);
    const ys = new Set(qs.map(q => q.year)).size;
    const l1c = {}; qs.forEach(q => l1c[q.l1] = (l1c[q.l1] || 0) + 1);
    const top = Object.entries(l1c).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const max = top.length ? top[0][1] : 1;
    return `    <div class="panel subject-card">
      <a class="name" href="questions.html?subject=${enc(s)}">${s}</a>
      <div class="muted small" style="margin-top:4px">${qs.length} 道题 · ${ys} 个年份</div>
      <div class="bars">
${top.map(([l1, n]) => `        <div class="bar-row">
          <a class="label" href="questions.html?subject=${enc(s)}&l1=${enc(l1)}" title="${l1}">${l1}</a>
          <div class="bar"><i style="width: ${Math.round(n * 100 / max)}%"></i></div>
          <div class="val">${n}</div>
        </div>`).join('\n')}
      </div>
      <div class="small muted" style="margin-top:10px">仅列出题量前 6 的一级知识点</div>
      <div class="cta">
        <a class="btn small" href="questions.html?subject=${enc(s)}">浏览该科目全部题目</a>
      </div>
    </div>`;
  }).join('\n');
  const recent = years.slice(-6).reverse();
  const yc = {}; ALL.forEach(q => yc[q.year] = (yc[q.year] || 0) + 1);
  const l2c = {}; ALL.forEach(q => { if (q.l2) l2c[q.l2] = (l2c[q.l2] || 0) + 1; });
  const topL2 = Object.entries(l2c).sort((a, b) => b[1] - a[1]).slice(0, 12);
  const maxL2 = topL2[0][1];
  const nSchool = schoolOrder.length;
  const yMin = years[0], yMax = years[years.length - 1];
  return `${head('数学考研真题库 · 首页', `${nSchool} 所高校 ${yMin}–${yMax} 年数学分析与高等代数真题 ${nQ} 道（${nP} 套卷），按院校、年份、知识点、题型多维检索。`, '')}
<body class="page-home">
${topbar('', 'index.html')}
<main>
  <div class="wrap">
<section class="hero">
  <h1>数学考研真题库</h1>
  <p class="lede">${nSchool} 所高校 ${yMin}–${yMax} 年数学分析与高等代数真题 ${nQ} 道（${nP} 套卷），按院校、年份、知识点、题型多维检索。</p>
</section>

<section class="stat-grid">
  <div class="stat"><div class="num">${nQ}</div><div class="label">道题目</div></div>
  <div class="stat"><div class="num">${nP}</div><div class="label">套试卷</div></div>
  <div class="stat"><div class="num">${years.length}</div><div class="label">个年份（${yMin}–${yMax}）</div></div>
  <div class="stat"><div class="num">${l1s}</div><div class="label">个一级知识点</div></div>
</section>

<section class="section">
  <div class="section-head">
    <h2>按科目进入</h2>
    <p><a href="knowledge.html">完整知识点树 →</a></p>
  </div>
  <div class="card-grid">
${cards}
  </div>
</section>

<section class="section">
  <div class="section-head">
    <h2>最近年份</h2>
    <p><a href="questions.html">到题库里按科目 / 知识点 / 形式多维筛选 →</a></p>
  </div>
  <div class="panel">
    <div class="toolbar" style="margin:0">
${recent.map(y => `      <a class="chip" href="questions.html?year=${enc(y)}">${y}<span class="n muted">${yc[y]}</span></a>`).join('\n')}
      <span style="flex:1"></span>
      <a class="btn small" href="questions.html?sort=year-asc">全部 ${years.length} 个年份</a>
      <a class="btn small" href="stats.html">看统计分析</a>
    </div>
  </div>
</section>

<section class="section">
  <div class="section-head">
    <h2>高频二级知识点</h2>
    <p><a href="stats.html">完整统计与热力图 →</a></p>
  </div>
  <div class="panel">
    <div class="bars">
${topL2.map(([l2, n]) => `      <div class="bar-row">
        <a class="label" href="questions.html?l2=${enc(l2)}" title="${l2}">${l2}</a>
        <div class="bar"><i style="width: ${Math.round(n * 100 / maxL2)}%"></i></div>
        <div class="val">${n}</div>
      </div>`).join('\n')}
    </div>
  </div>
</section>
  </div>
</main>
${footer('', nQ)}
${scripts('')}
</body>
</html>`;
}

// ---------- data.js ----------
const clean = ALL.map(q => { const c = { ...q }; delete c._stem; delete c._score; delete c._instr; return c; });
const counts = {
  questions: ALL.length, docs: Object.keys(byPaper).length,
  subjects: new Set(ALL.map(q => q.subject)).size, schools: schoolOrder.length,
  years: new Set(ALL.map(q => q.year)).size, l1: new Set(ALL.map(q => q.l1)).size,
  l2: new Set(ALL.filter(q => q.l2).map(q => q.subject + '|' + q.l1 + '|' + q.l2)).size
};
const meta = { schools: {}, multi_school: true };
for (const n of schoolOrder) meta.schools[n] = schoolCount[n];
const newData = 'window.KY_DATA = ' + JSON.stringify({ counts, generated_at: NOW, meta, questions: clean }) + ';';

// ---------- 落盘 ----------
const count = ALL.length;
for (const paper of newPapers) {
  w(`paper/${paper.pid}.html`, renderPaper(paper, count));
  paper.qs.forEach((q, i) => w(`q/${q.qid}.html`, renderQ(paper, i, count)));
}
const touchedSchools = new Set(newPapers.map(x => x.school));
for (const s of touchedSchools) w(`school/${schoolCode(s)}.html`, renderSchoolPage(s));
w('schools.html', renderSchools());
w('papers.html', renderPapers());
w('knowledge.html', renderKnowledge());
w('index.html', renderIndex());
w('assets/data.js', newData);
Object.assign(codes, EXTRA_CODES);
w('work/school_codes.json', JSON.stringify(codes, null, 1));
console.log(`OK papers=${newPapers.length} questions=${newQuestions.length} total=${count} schools=${schoolOrder.length} dry=${DRY}`);
