// work/fix6.js — ① 数学段内裸 ______ → \underline；② validate.js 支持 $$ 配对
'use strict';
const fs = require('fs');
{
  const p = 'work/transcripts/2247529164.json';
  const t = JSON.parse(fs.readFileSync(p, 'utf8'));
  let n = 0;
  for (const ex of t.exams) for (const q of ex.questions) {
    const fixed = q.stem.replace(/=\$(_{2,})([，。.]?)/g, '= \\underline{\\hspace{2.5em}}$$2');
    if (fixed !== q.stem) { q.stem = fixed; n++; }
  }
  fs.writeFileSync(p, JSON.stringify(t, null, 1));
  console.log('2247529164 q1 rewritten:', n);
}
// 升级 validate.js：先摘出 $$..$$，再配对 $..$
{
  const vp = 'work/validate.js';
  let v = fs.readFileSync(vp, 'utf8');
  const old = "      const segs = [...q.stem.matchAll(/\\$([^$]+)\\$/g)].map(m => m[1]);\n      const dollarCount = (q.stem.match(/\\$/g) || []).length;\n      if (dollarCount % 2) err(tag, `q${i + 1} unbalanced $`);";
  const neu = "      const segs = [];\n      for (const m of q.stem.matchAll(/\\$\\$([\\s\\S]+?)\\$\\$/g)) segs.push(m[1]);\n      const noDisp = q.stem.replace(/\\$\\$[\\s\\S]+?\\$\\$/g, '');\n      for (const m of noDisp.matchAll(/\\$([^$]+)\\$/g)) segs.push(m[1]);\n      if (((q.stem.match(/\\$\\$/g) || []).length * 2 + (noDisp.match(/\\$/g) || []).length) % 2) err(tag, `q${i + 1} unbalanced $`);";
  if (v.includes(old)) { v = v.replace(old, neu); fs.writeFileSync(vp, v); console.log('validate.js upgraded'); }
  else console.log('validate.js pattern MISS — manual check needed');
}
