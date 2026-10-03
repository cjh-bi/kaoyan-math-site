// work/recover.js — 重扫所有文章 HTML，找回被尺寸过滤误杀的真题页
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const m = JSON.parse(fs.readFileSync(path.join(ROOT, 'work', 'manifest.json'), 'utf8'));
const kept = new Set();
for (const r of m) for (const i of (r.imgs || [])) kept.add(path.basename(i.file).replace(/\.\w+$/, '')); // msgid_n
function sniff(buf) {
  if (buf.length < 24) return null;
  if (buf.readUInt32BE(0) === 0x89504e47 && buf.toString('ascii', 12, 16) === 'IHDR') return { ext: 'png', w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    for (let p = 2; p < buf.length - 8; p++) if (buf[p] === 0xff && (buf[p + 1] === 0xc0 || buf[p + 1] === 0xc2)) return { ext: 'jpg', h: buf.readUInt16BE(p + 5), w: buf.readUInt16BE(p + 7) };
    return { ext: 'jpg', w: 0, h: 0 };
  }
  if (buf.toString('ascii', 0, 3) === 'GIF') return { ext: 'gif', w: buf.readUInt16LE(6), h: buf.readUInt16LE(8) };
  if (buf.toString('ascii', 8, 12) === 'WEBP') return { ext: 'webp', w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3) };
  return null;
}
async function get(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, 'Referer': 'https://mp.weixin.qq.com/' } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return Buffer.from(await r.arrayBuffer());
}
(async () => {
  let recovered = 0;
  for (const r of m) {
    const htmlPath = path.join(ROOT, 'work', 'arts', r.msgid + '.html');
    if (!fs.existsSync(htmlPath)) continue;
    const html = fs.readFileSync(htmlPath, 'utf8');
    const i0 = html.indexOf('id="js_content"'), i1 = html.indexOf('预览时标签不可点');
    const body = html.slice(i0, i1 > i0 ? i1 : html.length);
    const urls = [...body.matchAll(/data-src="(https:\/\/mmbiz[^"]+)"/g)].map(x => x[1].replace(/&amp;/g, '&'));
    for (let n = 0; n < urls.length; n++) {
      const key = r.msgid + '_' + (n + 1);
      if (kept.has(key)) continue;
      try {
        const buf = await get(urls[n]);
        const s = sniff(buf); if (!s || !s.w) continue;
        // 更宽松：宽>=1000 且 高>=700（真题页最矮见过 902；页眉1080x625、二维码520、广告gif 排除）
        const examish = s.w >= 1000 && s.h >= 700 && s.ext !== 'gif' && !(s.w === 1080 && s.h <= 700);
        if (examish) {
          const f = 'work/imgs/' + key + '.' + s.ext;
          fs.writeFileSync(path.join(ROOT, f), buf);
          recovered++;
          console.log('RECOVERED', key, s.w + 'x' + s.h, s.ext, r.title.slice(0, 24));
        }
      } catch (e) { console.log('skip', key, e.message); }
      await new Promise(s => setTimeout(s, 150));
    }
  }
  console.log('total recovered:', recovered);
})();
