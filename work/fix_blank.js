// work/fix_blank.js — 修复 "……= ______." 类题干中未闭合的 $ 定界符
'use strict';
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, 'transcripts');
let fixed = 0, left = 0;
for (const fn of fs.readdirSync(dir)) {
  if (!fn.endsWith('.json')) continue;
  const p = path.join(dir, fn);
  const t = JSON.parse(fs.readFileSync(p, 'utf8'));
  let changed = false;
  for (const ex of t.exams) for (const q of ex.questions) {
    let s = q.stem || '';
    const d0 = (s.match(/\$/g) || []).length;
    if (!(d0 % 2)) continue;
    const tail = /=\s*\$?\s*_{2,}\s*[。.]?\s*$/;
    if (!tail.test(s)) { console.log('ODD-NO-BLANK', fn, ex.subject, q.no); left++; continue; }
    if (s.trimStart().startsWith('$$')) s = s.replace(tail, '= \\underline{\\hspace{2.5em}}$$。');
    else s = s.replace(tail, '= \\underline{\\hspace{2.5em}}$。');
    q.stem = s; changed = true; fixed++;
    const d = (s.match(/\$/g) || []).length;
    if (d % 2) { left++; console.log('STILL-ODD', fn, ex.subject, q.no); }
  }
  if (changed) fs.writeFileSync(p, JSON.stringify(t, null, 1));
}
console.log(`stems-fixed=${fixed} still-odd=${left}`);
