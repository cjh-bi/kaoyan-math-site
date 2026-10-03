// work/fix5.js — 数学环境内裸下划线填空 → \underline；过短"未知"题干 → 描述性占位
'use strict';
const fs = require('fs');

// 1) 2247529164：$...$ 内的 ______ 换成 \underline{\hspace{2.5em}}
{
  const p = 'work/transcripts/2247529164.json';
  const t = JSON.parse(fs.readFileSync(p, 'utf8'));
  let n = 0;
  for (const ex of t.exams) for (const q of ex.questions) {
    const fixed = q.stem.replace(/\$([^$]*)\$/g, (m, inner) => '$' + inner.replace(/_{2,}/g, '\\underline{\\hspace{2.5em}}') + '$');
    if (fixed !== q.stem) { q.stem = fixed; n++; }
  }
  fs.writeFileSync(p, JSON.stringify(t, null, 1));
  console.log('2247529164 math-blank fixed:', n);
}

// 2) 2247537613：q4 "未知。" → 占位描述
{
  const p = 'work/transcripts/2247537613.json';
  const t = JSON.parse(fs.readFileSync(p, 'utf8'));
  let n = 0;
  for (const ex of t.exams) for (const q of ex.questions) {
    if (q.stem && q.stem.length < 5) {
      q.stem = '（回忆版缺题：卷面此题仅标注"未知"，无具体内容。）';
      q.l1 = '未分类'; q.l2 = ''; q.form = '综合';
      n++;
    }
  }
  fs.writeFileSync(p, JSON.stringify(t, null, 1));
  console.log('2247537613 stubbed:', n);
}
