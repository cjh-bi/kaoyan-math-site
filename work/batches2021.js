// work/batches2021.js — 由 manifest2021.json 生成转录批次 work/batches2021.json（每批约3篇）
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const m = JSON.parse(fs.readFileSync(path.join(ROOT, 'work', 'manifest2021.json'), 'utf8'));
const items = m.map(r => ({ msgid: r.msgid, title: r.title, imgs: r.imgs.map(i => i.file) }));
const size = +(process.argv[2] || 3);
const batches = [];
for (let i = 0; i < items.length; i += size) batches.push(items.slice(i, i + size));
fs.writeFileSync(path.join(ROOT, 'work', 'batches2021.json'), JSON.stringify(batches));
console.log(`articles=${items.length} batches=${batches.length} (size<=${size}) total_imgs=${items.reduce((a, r) => a + r.imgs.length, 0)}`);
