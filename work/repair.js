// work/repair.js — 修复转录 JSON 里的非法控制字符（字符串内裸换行/制表符）
'use strict';
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, 'transcripts');
let fixed = 0, bad = 0;
for (const fn of fs.readdirSync(dir)) {
  if (!fn.endsWith('.json')) continue;
  const p = path.join(dir, fn);
  const s = fs.readFileSync(p, 'utf8');
  try { JSON.parse(s); continue; } catch (e) { /* repair below */ }
  let out = '', inStr = false, esc = false, changed = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) { out += ch; esc = false; continue; }
      if (ch === '\\') { out += ch; esc = true; continue; }
      if (ch === '"') { out += ch; inStr = false; continue; }
      if (ch === '\n') { out += '\\n'; changed++; continue; }
      if (ch === '\r') { continue; }
      if (ch === '\t') { out += '\\t'; changed++; continue; }
      if (ch < ' ') { changed++; continue; }
      out += ch;
    } else {
      if (ch === '"') inStr = true;
      out += ch;
    }
  }
  try { JSON.parse(out); fs.writeFileSync(p, out); fixed++; console.log('fixed', fn, `(${changed} chars)`); }
  catch (e2) { bad++; console.log('UNREPAIRABLE', fn, e2.message.slice(0, 100)); }
}
console.log(`fixed=${fixed} unrepairable=${bad}`);
