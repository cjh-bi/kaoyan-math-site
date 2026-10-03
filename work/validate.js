// work/validate.js — 转录质量门禁：schema + KaTeX 渲染 + 词表符合度
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const katex = require(path.join(ROOT, 'assets', 'katex', 'katex.min.js'));
const vocab = JSON.parse(fs.readFileSync(path.join(ROOT, 'work', 'vocab.json'), 'utf8'));
const L1 = new Set(vocab.l1), L2P = new Set(vocab.l2.map(x => x.l1 + '|' + x.l2));
const FORMS = new Set(['填空', '计算', '证明', '判断', '综合']);
const tDir = path.join(ROOT, 'work', 'transcripts');
let files = 0, exams = 0, qs = 0, errs = 0, warns = 0, qmarks = 0;
const report = [];
function err(f, msg) { errs++; report.push(`ERR ${f}: ${msg}`); }
function warn(f, msg) { warns++; if (report.length < 400) report.push(`WARN ${f}: ${msg}`); }
for (const fn of fs.readdirSync(tDir)) {
  if (!fn.endsWith('.json')) continue;
  files++;
  let t;
  try { t = JSON.parse(fs.readFileSync(path.join(tDir, fn), 'utf8')); } catch (e) { err(fn, 'JSON parse: ' + e.message); continue; }
  if (!Array.isArray(t.exams) || !t.exams.length) { err(fn, 'no exams'); continue; }
  for (const ex of t.exams) {
    exams++;
    const tag = `${fn}/${ex.school || '?'}/${ex.subject || '?'}`;
    if (!ex.school || !/^\d{4}$/.test(ex.year || '') || !ex.subject) { err(tag, 'missing school/year/subject'); continue; }
    if (!Array.isArray(ex.questions) || !ex.questions.length) { err(tag, 'no questions'); continue; }
    for (const [i, q] of ex.questions.entries()) {
      qs++;
      if (!q.stem || q.stem.length < 4) { err(tag, `q${i + 1} empty stem`); continue; }
      if (q.stem.includes('【?】')) qmarks++;
      if (!FORMS.has(q.form)) warn(tag, `q${i + 1} bad form=${q.form}`);
      if (q.l1 && !L1.has(q.l1)) warn(tag, `q${i + 1} l1 not in vocab: ${q.l1}`);
      if (q.l2 && !L2P.has((q.l1 || '') + '|' + q.l2)) warn(tag, `q${i + 1} l2 pair invalid: ${q.l1}/${q.l2}`);
      // 摘出 $$..$$ 显示段与 $..$ 行内段，逐段 KaTeX 校验
      const segs = [];
      let rest = q.stem;
      const disp = /[$][$]([\s\S]+?)[$][$]/;
      let m;
      while ((m = rest.match(disp))) { segs.push(m[1]); rest = rest.slice(0, m.index) + ' X ' + rest.slice(m.index + m[0].length); }
      const inl = /[$]([^$]+)[$]/;
      while ((m = rest.match(inl))) { segs.push(m[1]); rest = rest.slice(0, m.index) + ' X ' + rest.slice(m.index + m[0].length); }
      if ((rest.match(/[$]/g) || []).length) err(tag, `q${i + 1} unbalanced $`);
      for (const s of segs) {
        try { katex.renderToString(s, { throwOnError: true, displayMode: false }); }
        catch (e) { err(tag, `q${i + 1} KaTeX: ${e.message.slice(0, 90)} in [${s.slice(0, 60)}]`); }
      }
    }
  }
}
console.log(`files=${files} exams=${exams} questions=${qs} errors=${errs} warnings=${warns} blanks=${qmarks}`);
fs.writeFileSync(path.join(ROOT, 'work', 'validate_report.txt'), report.join('\n'));
if (errs) console.log(report.filter(r => r.startsWith('ERR')).slice(0, 60).join('\n'));
