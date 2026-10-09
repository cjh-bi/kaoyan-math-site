// work/checklinks.js — 全站内部链接与结构体检
// 用法: node work/checklinks.js [--verbose] [--json=out.json]
// 说明：扫描纳入站点的 html（跳过 work/extract/deploy/wx 快照等），
//       校验每个内部 href 指向的文件是否存在，并检查每页只有一个 body/doctype。
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const SCAN_SKIP = new Set(['work', 'extract', 'deploy', 'node_modules', '.git', '.playwright-mcp', 'wxarts', 'wximg']);
const COLLECT_SKIP = new Set(['.git', 'node_modules', '.playwright-mcp']);

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SCAN_SKIP.has(e.name) && !e.name.startsWith('.')) walk(path.join(dir, e.name), out); }
    else if (e.name.endsWith('.html')) out.push(path.join(dir, e.name));
  }
  return out;
}
const files = walk(ROOT, []).filter(f => !/[\\\/]wx_|album_|sogou\.html$/.test(f));

const exists = new Set();
(function collect(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!COLLECT_SKIP.has(e.name)) collect(path.join(dir, e.name)); }
    else exists.add(path.join(dir, e.name).toLowerCase());
  }
})(ROOT);

const bad = [];
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');
  for (const m of s.matchAll(/href="([^"]+)"/g)) {
    let u = m[1].split('#')[0].split('?')[0];
    if (!u || /^(https?:|mailto:|data:|javascript:|tel:)/.test(u)) continue;
    const t = path.normalize(path.join(path.dirname(f), decodeURIComponent(u))).toLowerCase();
    if (!exists.has(t)) bad.push([path.relative(ROOT, f).replace(/\\/g, '/'), u]);
  }
}
const broken = [];
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');
  const b = (s.match(/<body[\s>]/g) || []).length, be = (s.match(/<\/body>/g) || []).length, d = (s.match(/<!doctype/gi) || []).length;
  if (b !== 1 || be !== 1 || d !== 1) broken.push([path.relative(ROOT, f).replace(/\\/g, '/'), `doctype=${d} body=${b} /body=${be}`]);
}
console.log(`scanned html: ${files.length}`);
console.log(`BROKEN LINKS: ${bad.length}`);
const byFile = {};
for (const [f, u] of bad) (byFile[f] = byFile[f] || []).push(u);
for (const [f, us] of Object.entries(byFile)) console.log(`  ${f}: ${us.length}${process.argv.includes('--verbose') ? ' -> ' + [...new Set(us)].join(', ') : ''}`);
console.log(`STRUCTURE PROBLEMS: ${broken.length}`);
for (const [f, w] of broken) console.log(`  ${f}: ${w}`);
fs.mkdirSync(path.join(ROOT, 'work', 'tmp'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'work', 'tmp', 'badlinks.json'), JSON.stringify({ bad, broken }, null, 1));
if (bad.length || broken.length) { console.log('链接/结构体检未通过'); process.exitCode = 1; }
else console.log('链接/结构体检通过');
