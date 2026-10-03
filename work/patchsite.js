// work/patchsite.js — 全局改造：删题库（导航/搜索/所有 questions.html 链接转纯文本）
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const SKIP = new Set(['work', 'wximg', 'wxarts', 'assets', '.git', 'deploy', 'extract', 'node_modules', '.playwright-mcp']);

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP.has(e.name) && !e.name.startsWith('.')) yield* walk(path.join(dir, e.name)); }
    else if (e.name.endsWith('.html')) yield path.join(dir, e.name);
  }
}
let touched = 0, navRm = 0, formRm = 0, crumbRm = 0, linkConv = 0;
for (const f of walk(ROOT)) {
  const rel = path.relative(ROOT, f).replace(/\\/g, '/');
  if (rel === 'questions.html') continue; // 单独删除
  let s = fs.readFileSync(f, 'utf8');
  const orig = s;
  s = s.replace(/^[ \t]*<a href="[^"]*questions\.html"( class="active")?>题库<\/a>\r?\n?[ \t]*/gm, (m) => { navRm++; return ''; });
  s = s.replace(/[ \t]*<form class="search-mini"[\s\S]*?<\/form>\r?\n?/g, (m) => { formRm++; return ''; });
  s = s.replace(/<a href="[^"]*questions\.html">题库<\/a>\s*\/\s*/g, (m) => { crumbRm++; return ''; });
  s = s.replace(/<a([^>]*)href="[^"]*questions\.html[^"]*"([^>]*)>([\s\S]*?)<\/a>/g, (m, a1, a2, inner) => { linkConv++; return '<span' + a1 + a2 + '>' + inner + '</span>'; });
  if (s !== orig) { fs.writeFileSync(f, s); touched++; }
}
for (const del of ['questions.html', 'assets/app.js', 'assets/search-core.js']) {
  const p = path.join(ROOT, del);
  if (fs.existsSync(p)) { fs.unlinkSync(p); console.log('deleted', del); }
}
console.log(`touched=${touched} nav-removed=${navRm} searchforms=${formRm} crumbs=${crumbRm} links->text=${linkConv}`);
// 残留检查
let left = [];
for (const f of walk(ROOT)) {
  const s = fs.readFileSync(f, 'utf8');
  if (s.includes('questions.html')) left.push(path.relative(ROOT, f));
}
console.log('remaining files referencing questions.html:', left.length, left.slice(0, 10).join(', '));
