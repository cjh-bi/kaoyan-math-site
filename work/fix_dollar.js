// work/fix_dollar.js — 修复题干里 "$ ______" 多空行美元符
'use strict';
const fs = require('fs');
for (const f of ['2247528911', '2247529158']) {
  const p = 'work/transcripts/' + f + '.json';
  const t = JSON.parse(fs.readFileSync(p, 'utf8'));
  let n = 0;
  for (const ex of t.exams) for (const q of ex.questions) {
    const fixed = q.stem.replace(/= ?\$ ?_{2,}\. ?$/g, '= ______.').replace(/= ?\$ ?_{2,}\./g, '= ______.');
    if (fixed !== q.stem) { q.stem = fixed; n++; }
  }
  fs.writeFileSync(p, JSON.stringify(t, null, 1));
  let bad = 0;
  for (const ex of t.exams) for (const q of ex.questions) if (((q.stem.match(/\$/g) || []).length) % 2) bad++;
  console.log(f, 'stems-fixed=' + n, 'remaining-unbalanced=' + bad);
}
