// work/fix10.js — 显示块未闭合：stem 以 $$ 开头、以 }$。结尾且 $ 数为奇 → 补一个 $（纯拼接，不用 replace）
'use strict';
const fs = require('fs');
const D = String.fromCharCode(36);
const TAIL = '}' + D + '。';
let fixed = 0;
for (const fn of fs.readdirSync('work/transcripts')) {
  if (!fn.endsWith('.json')) continue;
  const p = 'work/transcripts/' + fn;
  const t = JSON.parse(fs.readFileSync(p, 'utf8'));
  let mod = false;
  for (const ex of t.exams) for (const q of ex.questions) {
    const s = q.stem;
    if (!s.endsWith(TAIL)) continue;
    const d = (s.match(/[[$]/g) || []).length;
    if (d % 2 === 1 && s.trimStart().startsWith(D + D)) {
      q.stem = s.slice(0, s.length - 1) + D + '。'; // }$。 -> }$$。
      mod = true; fixed++;
      console.log('fixed', fn, ex.subject, 'no', q.no, 'dollars', d, '->', d + 1);
    }
  }
  if (mod) fs.writeFileSync(p, JSON.stringify(t, null, 1));
}
console.log('total fixed:', fixed);
