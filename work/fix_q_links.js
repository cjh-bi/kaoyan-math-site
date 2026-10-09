// work/fix_q_links.js — 修复题目页里指向已删除题目的链接
// 两类失效链接（都来自 work/tmp/purge_dups*.js 去重后未重建 q 页）：
//   1) 「同题异卷」推荐 chip：指向已删掉的 q 页 → 删除该 chip；整块没有候选时删除该提示块
//   2) 「上一题/下一题」pager：链上相邻题目被删 → 把断口两端重新接起来（接不上就删掉该链接）
// 用法: node work/fix_q_links.js [--dry]
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const DRY = process.argv.includes('--dry');

const KY = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'data.js'), 'utf8').slice('window.KY_DATA = '.length).replace(/;\s*$/, ''));
const byQid = new Map(KY.questions.map(q => [q.qid, q]));
const dir = path.join(ROOT, 'q');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));
const alive = new Set(files.map(f => f.replace(/\.html$/, '')));
const textOf = id => { const q = byQid.get(id); return q ? `${q.year} ${q.section}${q.number}` : null; };

// ---- 读入所有 pager 边 ----
const pager = new Map(); // qid -> {prev, next, block}
for (const f of files) {
  const qid = f.replace(/\.html$/, '');
  const c = fs.readFileSync(path.join(dir, f), 'utf8');
  const m = /<div class="pager">([\s\S]*?)<\/div>/.exec(c);
  if (!m) continue;
  const links = [...m[1].matchAll(/<a href="([^"]+)\.html">\s*(←\s*上一题|下一题)/g)];
  let prev = null, next = null;
  for (const l of links) { if (/上一题/.test(l[2])) prev = l[1]; else next = l[1]; }
  pager.set(qid, { prev, next, block: m[0], crlf: c.includes('\r\n') });
}

// ---- 找出断口：next 指向已删除题目 ----
const gaps = []; // {before, after, pid}
const prevByTarget = new Map(), nextByTarget = new Map();
for (const [qid, e] of pager) {
  if (e.next && !alive.has(e.next)) nextByTarget.set(e.next, qid);
  if (e.prev && !alive.has(e.prev)) prevByTarget.set(e.prev, qid);
}
const pidOf = id => id.replace(/-q\d{4}$/, '');
const deadByPid = new Map(); // pid -> {entryFrom, exitTo, first, last}
for (const [dead, before] of nextByTarget) {
  const pid = pidOf(dead);
  const g = deadByPid.get(pid) || {};
  g.before = before; g.first = dead;
  deadByPid.set(pid, g);
}
for (const [dead, after] of prevByTarget) {
  const pid = pidOf(dead);
  const g = deadByPid.get(pid) || {};
  g.after = after; g.last = dead;
  deadByPid.set(pid, g);
}
console.log(`失效 pager 链接：${nextByTarget.size + prevByTarget.size} 处，涉及 ${deadByPid.size} 个已删除的卷`);

// ---- 生成修复后的 pager 区块 ----
function buildPager(prev, next, crlf) {
  const nl = crlf ? '\r\n' : '\n';
  const pTxt = prev ? textOf(prev) : null;
  const nTxt = next ? textOf(next) : null;
  const left = prev ? `<a href="${prev}.html">← 上一题（${pTxt}）</a>` : '<span></span>';
  const right = next ? `<a href="${next}.html">下一题（${nTxt}）→</a>` : '';
  return `<div class="pager">${nl}${left}${right}    </div>`;
}
// 断口两端接续：before.next = after、after.prev = before（同一次删除只有一对端点）
const relink = new Map(); // qid -> {prev?, next?}
const dropped = [];
for (const [pid, g] of deadByPid) {
  if (g.before && g.after && g.before !== g.after) {
    const a = relink.get(g.before) || {}; a.next = g.after; relink.set(g.before, a);
    const b = relink.get(g.after) || {}; b.prev = g.before; relink.set(g.after, b);
  } else {
    if (g.before) { const a = relink.get(g.before) || {}; a.next = null; relink.set(g.before, a); dropped.push('next ' + g.before); }
    if (g.after) { const b = relink.get(g.after) || {}; b.prev = null; relink.set(g.after, b); dropped.push('prev ' + g.after); }
  }
}
console.log(`可接回的断口：${relink.size - dropped.length ? Object.keys(relink).length - dropped.length : 0} 个页面重接，${dropped.length} 处只能删链接`);

// ---- 写回 ----
let pagerFixed = 0, chipFixed = 0, noticeFixed = 0, filesTouched = 0;
const chipRe = /<a class="chip" href="([^"]+)\.html">[\s\S]*?<\/a>\s*/g;
for (const f of files) {
  const qid = f.replace(/\.html$/, '');
  const abs = path.join(dir, f);
  let c = fs.readFileSync(abs, 'utf8');
  const orig = c;
  const crlf = c.includes('\r\n');

  // 1) 同题异卷 chip 清理
  const noticeRe = /<div class="notice" style="margin-top:18px">(\r?\n)(\s*)<strong>同题异卷<\/strong>[\s\S]*?\n\s*<\/div>(\r?\n)\s*<\/div>/;
  const nm = noticeRe.exec(c);
  if (nm) {
    const chips = [...nm[0].matchAll(chipRe)];
    const keep = chips.filter(m => alive.has(m[1]));
    if (keep.length !== chips.length) {
      if (!keep.length) {
        c = c.replace(nm[0], '');
        noticeFixed++;
      } else {
        let block = nm[0];
        for (const m of chips) if (!alive.has(m[1])) { block = block.replace(m[0], ''); chipFixed++; }
        c = c.replace(nm[0], block);
      }
    }
  }

  // 2) pager 修复
  const e = pager.get(qid);
  const fix = relink.get(qid);
  if (e && fix) {
    let p = e.prev, nx = e.next;
    if ('prev' in fix) p = fix.prev === null ? (alive.has(e.prev) ? e.prev : null) : fix.prev;
    if ('next' in fix) nx = fix.next === null ? (alive.has(e.next) ? e.next : null) : fix.next;
    if (p && !alive.has(p)) p = null;
    if (nx && !alive.has(nx)) nx = null;
    c = c.replace(e.block, buildPager(p, nx, crlf));
    pagerFixed++;
  } else if (e && (e.prev && !alive.has(e.prev) || e.next && !alive.has(e.next))) {
    const p = e.prev && alive.has(e.prev) ? e.prev : null;
    const nx = e.next && alive.has(e.next) ? e.next : null;
    c = c.replace(e.block, buildPager(p, nx, crlf));
    pagerFixed++;
  }

  if (c !== orig) { filesTouched++; if (!DRY) fs.writeFileSync(abs, c, 'utf8'); }
}
console.log(JSON.stringify({ DRY, filesTouched, pagerFixed, chipFixed, noticeFixed }, null, 1));
