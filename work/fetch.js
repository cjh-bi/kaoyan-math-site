// work/fetch.js — download all album articles + exam images
const fs = require('fs'), path = require('path');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const ROOT = path.join(__dirname, '..');
const ART = path.join(ROOT, 'work', 'arts'), IMG = path.join(ROOT, 'work', 'imgs');
fs.mkdirSync(ART, { recursive: true }); fs.mkdirSync(IMG, { recursive: true });

function loadList(f, year) {
  return fs.readFileSync(path.join(ROOT, f), 'utf8').trim().split(/\r?\n/).map(l => {
    const [msgid, title, link] = l.split('\t');
    return { msgid, title, link, year };
  }).filter(r => r.msgid);
}
const rows = [...loadList('album_2025_list.txt', '2025'), ...loadList('album_2026_list.txt', '2026')];

async function get(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, 'Referer': 'https://mp.weixin.qq.com/' } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return Buffer.from(await r.arrayBuffer());
    } catch (e) { if (i === tries - 1) throw e; await new Promise(s => setTimeout(s, 1500 * (i + 1))); }
  }
}
function sniff(buf) {
  if (buf.length < 24) return null;
  if (buf.readUInt32BE(0) === 0x89504e47 && buf.toString('ascii', 12, 16) === 'IHDR')
    return { ext: 'png', w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    for (let p = 2; p < buf.length - 8; p++) {
      if (buf[p] === 0xff && [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb].includes(buf[p + 1]))
        return { ext: 'jpg', h: buf.readUInt16BE(p + 5), w: buf.readUInt16BE(p + 7) };
      if (buf[p] === 0xff && [0xd8, 0x01].includes(buf[p + 1]) === false && buf[p + 1] >= 0xd0 && buf[p + 1] <= 0xd9) { p++; continue; }
    }
    return { ext: 'jpg', w: 0, h: 0 };
  }
  if (buf.toString('ascii', 0, 3) === 'GIF') return { ext: 'gif', w: buf.readUInt16LE(6), h: buf.readUInt16LE(8) };
  if (buf.toString('ascii', 8, 12) === 'WEBP') {
    if (buf.toString('ascii', 12, 16) === 'VP8X' && buf.length > 30)
      return { ext: 'webp', w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3) };
    if (buf.toString('ascii', 12, 16) === 'VP8 ')
      return { ext: 'webp', w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
    return { ext: 'webp', w: 0, h: 0 };
  }
  return null;
}
(async () => {
  const manifest = [];
  let done = 0;
  for (const row of rows) {
    const htmlFile = path.join(ART, row.msgid + '.html');
    let html;
    try {
      if (fs.existsSync(htmlFile) && fs.statSync(htmlFile).size > 50000) html = fs.readFileSync(htmlFile, 'utf8');
      else { html = (await get(row.link)).toString('utf8'); fs.writeFileSync(htmlFile, html); }
    } catch (e) { manifest.push({ ...row, error: 'article:' + e.message }); continue; }
    const blocked = html.includes('环境异常');
    const i0 = html.indexOf('id="js_content"'), i1 = html.indexOf('预览时标签不可点');
    const body = i0 >= 0 ? html.slice(i0, i1 > i0 ? i1 : html.length) : '';
    const urls = [...body.matchAll(/data-src="(https:\/\/mmbiz[^"]+)"/g)].map(m => m[1].replace(/&amp;/g, '&'));
    const imgs = [];
    if (!blocked) for (let n = 0; n < urls.length; n++) {
      try {
        const buf = await get(urls[n]);
        const s = sniff(buf); if (!s) continue;
        // exam pages: wide-ish typeset images, tall; exclude header(1080x625), QR(520), gifs, small ads
        const isExam = s.w >= 1000 && s.h >= 900 && s.ext !== 'gif' && !(s.w === 1080 && s.h <= 700);
        if (isExam) { const f = `work/imgs/${row.msgid}_${n + 1}.${s.ext}`; fs.writeFileSync(path.join(ROOT, f), buf); imgs.push({ file: f, w: s.w, h: s.h }); }
      } catch (e) { /* skip image */ }
      await new Promise(s => setTimeout(s, 200));
    }
    const m = row.title.match(/^(.+?)(2025|2026)年/);
    manifest.push({ msgid: row.msgid, title: row.title, year: row.year, school: m ? m[1] : row.title, blocked, imgs, htmlLen: body.length });
    process.stdout.write(`[${++done}/${rows.length}] ${row.title} -> ${imgs.length} exam imgs${blocked ? ' (BLOCKED)' : ''}\n`);
    await new Promise(s => setTimeout(s, 400));
  }
  fs.writeFileSync(path.join(ROOT, 'work', 'manifest.json'), JSON.stringify(manifest, null, 1));
  const tot = manifest.reduce((a, r) => a + r.imgs.length, 0);
  console.log(`DONE. articles=${manifest.length} exam-images=${tot} blocked=${manifest.filter(r => r.blocked).length}`);
})();
