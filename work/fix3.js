// work/fix3.js — 手工修复三处校验错误
'use strict';
const fs = require('fs');

// 1) 2247537012 高代 q6：$$ 显示块未闭合（stem 以 `=$ ______.` 结尾且开头是 $$）
{
  const p = 'work/transcripts/2247537012.json';
  const t = JSON.parse(fs.readFileSync(p, 'utf8'));
  for (const ex of t.exams) for (const q of ex.questions) {
    const d = (q.stem.match(/\$/g) || []).length;
    if (d % 2 && q.stem.trimStart().startsWith('$$') && /=\s*\$?\s*_{2,}\s*[。.]?\s*$/.test(q.stem)) {
      q.stem = q.stem.replace(/=\s*\$?\s*_{2,}\s*[。.]?\s*$/, '= \\underline{\\hspace{2.5em}}$$。');
      console.log('fixed 2247537012', q.no, 'dollars=' + (q.stem.match(/\$/g) || []).length);
    }
  }
  fs.writeFileSync(p, JSON.stringify(t, null, 1));
}

// 2) 2247537120 高代"八. 未知."：stem 过短 → 描述性占位
{
  const p = 'work/transcripts/2247537120.json';
  const t = JSON.parse(fs.readFileSync(p, 'utf8'));
  let n = 0;
  for (const ex of t.exams) for (const q of ex.questions) {
    if (q.stem && q.stem.length < 5) {
      q.stem = '（回忆版缺题：卷面此题仅标注"未知"，无具体内容。）';
      q.l1 = '未分类'; q.l2 = '';
      n++;
    }
  }
  fs.writeFileSync(p, JSON.stringify(t, null, 1));
  console.log('stubbed 2247537120:', n);
}

// 3) 2247537459 高代 q1：\iddots → \ddots（KaTeX 不支持 iddots）
{
  const p = 'work/transcripts/2247537459.json';
  const t = JSON.parse(fs.readFileSync(p, 'utf8'));
  let n = 0;
  for (const ex of t.exams) for (const q of ex.questions) {
    if (q.stem && q.stem.includes('\\iddots')) { q.stem = q.stem.split('\\iddots').join('\\ddots'); n++; }
  }
  fs.writeFileSync(p, JSON.stringify(t, null, 1));
  console.log('iddots->ddots 2247537459:', n);
}
