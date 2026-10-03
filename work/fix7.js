// work/fix7.js — 修正 fix6 造成的 "$2" 残留
'use strict';
const fs = require('fs');
const p = 'work/transcripts/2247529164.json';
const t = JSON.parse(fs.readFileSync(p, 'utf8'));
let n = 0;
for (const ex of t.exams) for (const q of ex.questions) {
  let s = q.stem;
  s = s.replace(/\}\$2其中/g, '}$，其中');
  s = s.replace(/\}\$2(?=[”"]|$|[^0-9])/g, '}$。');
  if (s !== q.stem) { q.stem = s; n++; }
}
fs.writeFileSync(p, JSON.stringify(t, null, 1));
console.log('repaired', n);
for (const ex of t.exams) for (const q of ex.questions) {
  const d = (q.stem.match(/\$/g) || []).length;
  if (d % 2) console.log('ODD', q.no);
  if (q.stem.includes('$2')) console.log('LEFTOVER $2 in q', q.no);
}
