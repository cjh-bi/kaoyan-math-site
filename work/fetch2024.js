// work/fetch2024.js — 从"标题<TAB>临时mp链接"清单下载 2024 文章+试卷图，落地为永久 mid-idx 记录
// 用法: node work/fetch2024.js <urlsFile> <outManifest>
'use strict';
const fs = require('fs'), path = require('path');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const ROOT = path.join(__dirname, '..');
const [urlsFile, outManifest] = process.argv.slice(2);
const ART = path.join(ROOT, 'work', 'arts2024'), IMG = path.join(ROOT, 'work', 'imgs');
fs.mkdirSync(ART, { recursive: true }); fs.mkdirSync(IMG, { recursive: true });
const rows = fs.readFileSync(path.join(ROOT, 'work', 'tmp', urlsFile), 'utf8').trim().split(/\r?\n/).map(l => { const [title, url] = l.split('\t'); return { title, url }; }).filter(r => r.url);
async function get(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url, { headers: { 'User-Agent': UA, 'Referer': 'https://mp.weixin.qq.com/' } }); if (!r.ok) throw new Error('HTTP ' + r.status); return Buffer.from(await r.arrayBuffer()); }
    catch (e) { if (i === tries - 1) throw e; await new Promise(s => setTimeout(s, 1500 * (i + 1))); }
  }
}
function sniff(buf) {
  if (buf.length < 24) return null;
  if (buf.readUInt32BE(0) === 0x89504e47 && buf.toString('ascii', 12, 16) === 'IHDR') return { ext: 'png', w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  if (buf[0] === 0xff && buf[1] === 0xd8) { for (let p = 2; p < buf.length - 8; p++) { if (buf[p] === 0xff && [0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb].includes(buf[p+1])) return { ext:'jpg', h: buf.readUInt16BE(p+5), w: buf.readUInt16BE(p+7) }; if (buf[p]===0xff && buf[p+1]>=0xd0 && buf[p+1]<=0xd9){p++;continue;} } return { ext:'jpg',w:0,h:0 }; }
  if (buf.toString('ascii',0,3)==='GIF') return { ext:'gif', w: buf.readUInt16LE(6), h: buf.readUInt16LE(8) };
  return null;
}
(async () => {
  const manifest = [];
  let done = 0;
  for (const row of rows) {
    let html;
    try { html = (await get(row.url)).toString('utf8'); }
    catch (e) { manifest.push({ title: row.title, error: 'article:' + e.message, imgs: [] }); continue; }
    const mid = (html.match(/var mid\s*=\s*"(\d+)"/) || html.match(/"mid":"?(\d+)"/) || [])[1];
    const idx = (html.match(/var idx\s*=\s*"(\d+)"/) || [])[1] || '1';
    const sn = (html.match(/var sn\s*=\s*"([a-f0-9]+)"/) || [])[1] || '';
    const biz = (html.match(/__biz=(Mz[A-Za-z0-9+\/=]+)/) || [])[1] || 'MzIxMDUwODY3Mw==';
    if (!mid) { manifest.push({ title: row.title, error: 'no-mid', imgs: [] }); continue; }
    const key = mid + '-' + idx;
    const perm = `http://mp.weixin.qq.com/s?__biz=${biz}&mid=${mid}&idx=${idx}&sn=${sn}`;
    fs.writeFileSync(path.join(ART, key + '.html'), html);
    const blocked = html.includes('环境异常');
    const i0 = html.indexOf('id="js_content"'), i1 = html.indexOf('预览时标签不可点');
    const body = i0 >= 0 ? html.slice(i0, i1 > i0 ? i1 : html.length) : '';
    const urls = [...body.matchAll(/data-src="(https:\/\/mmbiz[^"]+)"/g)].map(m => m[1].replace(/&amp;/g, '&'));
    const imgs = [];
    if (!blocked) for (let n = 0; n < urls.length; n++) {
      try { const buf = await get(urls[n]); const s = sniff(buf); if (!s) continue;
        const isExam = s.w >= 900 && s.h >= 850 && s.ext !== 'gif' && !(s.w === 1080 && s.h <= 700);
        if (isExam) { const f = `work/imgs/${key}_${n + 1}.${s.ext}`; fs.writeFileSync(path.join(ROOT, f), buf); imgs.push({ file: f, w: s.w, h: s.h }); }
      } catch (e) {}
      await new Promise(s => setTimeout(s, 180));
    }
    const m = row.title.match(/^(.+?)2024年/);
    manifest.push({ msgid: key, mid, idx, sn, perm, title: row.title, year: '2024', school: m ? m[1] : row.title, blocked, imgs, htmlLen: body.length });
    process.stdout.write(`[${++done}/${rows.length}] ${row.title} -> ${imgs.length} imgs${blocked?' (BLOCKED)':''}${!imgs.length?' (EMPTY)':''}\n`);
    await new Promise(s => setTimeout(s, 400));
  }
  fs.writeFileSync(path.join(ROOT, 'work', outManifest), JSON.stringify(manifest, null, 1));
  console.log(`DONE. articles=${manifest.length} imgs=${manifest.reduce((a,r)=>a+(r.imgs||[]).length,0)} empty=${manifest.filter(r=>!(r.imgs||[]).length).length} err=${manifest.filter(r=>r.error).length}`);
})();
