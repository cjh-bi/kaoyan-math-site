// work/fix_footer_total.js — 把全站 footer 的「共 N 题」统一为当前数据总量
// 背景：paper/ 与 q/ 下的页面只在“新增/重建该卷”时才重写，footer 里的全库题量因此停留在各自生成时的数字
//（同一站点上出现 14706 / 20572 / 21428 …… 十几种），与首页、data.js 的口径不一致。
// 用法: node work/fix_footer_total.js [--dry]
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const DRY = process.argv.includes('--dry');
const KY = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'data.js'), 'utf8').slice('window.KY_DATA = '.length).replace(/;\s*$/, ''));
const TOTAL = KY.counts.questions;
const re = /（经校对整理），共 [\d,]+ 题/g;
const hit = `（经校对整理），共 ${TOTAL} 题`;

let changed = 0, same = 0, other = 0;
for (const sub of ['', 'paper', 'q', 'school']) {
  const dir = path.join(ROOT, sub);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.html')) continue;
    const abs = path.join(dir, f);
    const c = fs.readFileSync(abs, 'utf8');
    const n = (c.match(re) || []).length;
    if (!n) { other++; continue; }
    if (c.includes(hit) && n === 1) { same++; continue; }
    const out = c.replace(re, hit);
    if (out !== c) { changed++; if (!DRY) fs.writeFileSync(abs, out, 'utf8'); } else same++;
  }
}
console.log(`目标总量=${TOTAL} 改写=${changed} 已正确=${same} 无该 footer=${other} dry=${DRY}`);
