// work/build.js — 一键构建：ingest → patchsite → slashfix → copyfix → papersgen → statsgen → validate → checklinks
'use strict';
const { execFileSync } = require('child_process'), path = require('path');
const W = p => path.join(__dirname, p);
const steps = ['ingest.js', 'patchsite.js', 'slashfix.js', 'copyfix.js', 'papersgen.js', 'statsgen.js', 'validate.js', 'checklinks.js'];
for (const s of steps) {
  console.log('=== ' + s + ' ===');
  try { console.log(execFileSync('node', [W(s)], { encoding: 'utf8', maxBuffer: 64e6 }).trim()); }
  catch (e) { console.log('FAILED:', s, (e.stdout || '') + (e.stderr || '')); process.exit(1); }
}
console.log('BUILD OK');
