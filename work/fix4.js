// work/fix4.js — 2247537012 高代q6: $$ 显示块收尾应为 $$
'use strict';
const fs = require('fs');
const p = 'work/transcripts/2247537012.json';
const t = JSON.parse(fs.readFileSync(p, 'utf8'));
for (const ex of t.exams) for (const q of ex.questions) {
  if (q.stem.trimStart().startsWith('$$') && /\\underline\{\\hspace\{2\.5em\}\}\$。$/.test(q.stem)) {
    q.stem = q.stem.replace(/\\underline\{\\hspace\{2\.5em\}\}\$。$/, '\\underline{\\hspace{2.5em}}$$。');
    console.log('fixed q', q.no, 'dollars=' + (q.stem.match(/\$/g) || []).length);
  }
}
fs.writeFileSync(p, JSON.stringify(t, null, 1));
