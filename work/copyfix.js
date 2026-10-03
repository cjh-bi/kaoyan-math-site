// work/copyfix.js — 清理删题库后的过时文案/死列
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
let schoolT = 0, idxT = 0;

for (const f of fs.readdirSync(path.join(ROOT, 'school'))) {
  if (!f.endsWith('.html')) continue;
  const p = path.join(ROOT, 'school', f);
  let s = fs.readFileSync(p, 'utf8'); const o = s;
  s = s.replace('<p class="small muted">点年份进入题库并自动套用筛选</p>', '<p class="small muted">收录年份</p>');
  s = s.replace('<th>题量</th><th>占比</th><th>检索</th>', '<th>题量</th><th>占比</th>');
  s = s.replace(/\s*<td><span[^>]*>筛选<\/span><\/td>/g, '');
  if (s !== o) { fs.writeFileSync(p, s); schoolT++; }
}

{
  const p = path.join(ROOT, 'index.html');
  let s = fs.readFileSync(p, 'utf8'); const o = s;
  s = s.replace(/<p><span[^>]*>到题库里按科目 \/ 知识点 \/ 形式多维筛选 →<\/span><\/p>/, '<p><a href="papers.html">按学校浏览整套试卷 →</a></p>');
  s = s.replace(/<span class="btn small">浏览该科目全部题目<\/span>/g, '<a class="btn small" href="knowledge.html">看该科目知识点树</a>');
  s = s.replace(/<span class="btn small">全部 22 个年份<\/span>/, '<a class="btn small" href="papers.html">全部试卷</a>');
  if (s !== o) { fs.writeFileSync(p, s); idxT++; }
}
console.log('school pages fixed:', schoolT, '| index fixed:', idxT);
