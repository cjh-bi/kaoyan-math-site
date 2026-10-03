// work/fix9.js — 纠正 tmp4 过度修补：以 }$$。 结尾但 $ 总数为奇数的行内式改回 }$。
'use strict';
const fs = require('fs');
const D = String.fromCharCode(36);
let changed = 0, checked = 0;
for (const fn of fs.readdirSync('work/transcripts')) {
  if (!fn.endsWith('.json')) continue;
  const p = 'work/transcripts/' + fn;
  const t = JSON.parse(fs.readFileSync(p, 'utf8'));
  let mod = false;
  for (const ex of t.exams) for (const q of ex.questions) {
    if (!q.stem.endsWith(D + D + '。') || !q.stem.includes('hspace{2.5em}')) continue;
    checked++;
    const d = (q.stem.match(/[$]/g) || []).length;
    if (d % 2 === 1) { // 行内式被多加了一个 $ → 还原
      q.stem = q.stem.slice(0, q.stem.length - 3) + D + '。';
      mod = true; changed++;
    }
  }
  if (mod) fs.writeFileSync(p, JSON.stringify(t, null, 1));
}
console.log('checked', checked, 'reverted', changed);
