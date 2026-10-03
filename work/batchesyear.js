// work/batchesyear.js — 由 manifest<year>.json 生成 work/batches<year>.json 与单篇任务文件
// 用法: node work/batchesyear.js <manifestFile> <outDirName> [size=3]
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const [manifestFile, outName, sizeS] = process.argv.slice(2);
const size = +(sizeS || 3);
const m = JSON.parse(fs.readFileSync(path.join(ROOT, 'work', manifestFile), 'utf8'));
const items = m.filter(r => (r.imgs || []).length).map(r => ({ msgid: r.msgid, title: r.title, imgs: r.imgs.map(i => i.file) }));
const dir = path.join(ROOT, 'work', outName);
fs.mkdirSync(dir, { recursive: true });
for (const it of items) fs.writeFileSync(path.join(dir, it.msgid + '.json'), JSON.stringify(it, null, 1));
const ids = items.map(i => i.msgid);
fs.writeFileSync(path.join(ROOT, 'work', 'tmp', 'ids' + outName.replace('batches', '') + '.json'), JSON.stringify(ids));
console.log(`articles(with imgs)=${items.length} skippedEmpty=${m.length - items.length} total_imgs=${items.reduce((a, r) => a + r.imgs.length, 0)} -> work/${outName}/ + work/tmp/ids${outName.replace('batches','')}.json`);
