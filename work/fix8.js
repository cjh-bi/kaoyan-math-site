// work/fix8.js — 修复 "$$...= ______."（显示块未闭合）→ "$$...= \underline{...}$$。"
'use strict';
const fs = require('fs');
let n = 0;
for (const f of ['2247528911', '2247529158']) {
  const p = 'work/transcripts/' + f + '.json';
  const t = JSON.parse(fs.readFileSync(p, 'utf8'));
  for (const ex of t.exams) for (const q of ex.questions) {
    if (q.stem.trimStart().startsWith('$$') && /=\s*_{2,}\s*[。.]?\s*$/.test(q.stem)) {
      q.stem = q.stem.replace(/=\s*_{2,}\s*[。.]?\s*$/, '= \\underline{\\hspace{2.5em}}$$。');
      n++;
      const d = (q.stem.match(/[$]/g) || []).length;
      console.log(f, ex.subject, 'no', q.no, 'dollars=', d);
    }
  }
  fs.writeFileSync(p, JSON.stringify(t, null, 1));
}
console.log('fixed', n);
