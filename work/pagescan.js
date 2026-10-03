// work/pagescan.js — 用 KaTeX 严格模式扫描全部 q/paper 页的数学段，找渲染错误
'use strict';
const fs = require('fs'), path = require('path');
const katex = require(path.join(__dirname, '..', 'assets', 'katex', 'katex.min.js'));
const D = String.fromCharCode(36);
const DD = D + D;

function extractSegments(text) {
  const segs = [];
  let i = 0, n = text.length;
  while (i < n) {
    if (text[i] === D) {
      if (text[i + 1] === D) {
        const end = text.indexOf(DD, i + 2);
        if (end > i + 1) { segs.push(text.slice(i + 2, end)); i = end + 2; continue; }
        return { segs, error: 'unclosed $$ at ' + i };
      }
      const end = text.indexOf(D, i + 1);
      if (end > i) { segs.push(text.slice(i + 1, end)); i = end + 1; continue; }
      return { segs, error: 'unclosed $ at ' + i };
    }
    i++;
  }
  return { segs, error: null };
}
function unmath(s) { return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/gi, "'").replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/<br>/g, '\n'); }

const files = [];
for (const d of ['q', 'paper']) for (const f of fs.readdirSync(d)) if (f.endsWith('.html')) files.push(d + '/' + f);
let ok = 0; const errs = [];
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');
  let zone = '';
  if (f.startsWith('q/')) {
    const i0 = s.indexOf('<div class="qstem">');
    if (i0 < 0) { errs.push(f + ' NO-QSTEM'); continue; }
    zone = s.slice(i0 + 19, s.indexOf('</div>', i0));
  } else {
    const i1 = s.indexOf('<div class="qlist">');
    if (i1 < 0) { errs.push(f + ' NO-QLIST'); continue; }
    zone = s.slice(i1, s.indexOf('</main>', i1));
  }
  const { segs, error } = extractSegments(unmath(zone));
  if (error) { errs.push(f + ' ' + error); continue; }
  let bad = false;
  for (const seg of segs) {
    try { katex.renderToString(seg, { throwOnError: true, strict: 'ignore' }); }
    catch (e) { errs.push(f + ' KaTeX: ' + e.message.slice(0, 90) + ' in [' + seg.slice(0, 60) + ']'); bad = true; break; }
  }
  if (!bad) ok++;
}
console.log(`scanned=${files.length} ok=${ok} bad=${errs.length}`);
fs.writeFileSync('work/pagescan_report.txt', errs.join('\n'));
if (errs.length) console.log(errs.slice(0, 30).join('\n'));
