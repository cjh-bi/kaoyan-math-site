// work/slashfix.js — 清理面包屑中被转换后残留的孤立 "/" 与 "<span >"
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const SKIP = new Set(['work', 'wximg', 'wxarts', 'assets', '.git', 'deploy', 'extract', 'node_modules', '.playwright-mcp']);
function* walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) { if (!SKIP.has(e.name) && !e.name.startsWith('.')) yield* walk(f); }
    else if (e.name.endsWith('.html')) yield f;
  }
}
let t = 0;
for (const f of walk(ROOT)) {
  let s = fs.readFileSync(f, 'utf8'); const o = s;
  s = s.replace(/<\/a> \/[\r\n]+\/[\r\n]+/g, '</a> /\n');
  s = s.replace(/<span >/g, '<span>');
  if (s !== o) { fs.writeFileSync(f, s); t++; }
}
console.log('slashfix cleaned', t);
