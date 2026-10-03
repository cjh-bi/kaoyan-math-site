// work/planfix.js — plan.html 页脚数字与时间同步到当前数据
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const raw = fs.readFileSync(path.join(ROOT, 'assets', 'data.js'), 'utf8');
const KY = JSON.parse(raw.slice('window.KY_DATA = '.length).replace(/;\s*$/, ''));
const p = path.join(ROOT, 'plan.html');
let s = fs.readFileSync(p, 'utf8');
const before = s;
s = s.replace(/共 \d+ 题/g, `共 ${KY.questions.length} 题`);
s = s.replace(/生成于 [\d: -]+ ·/, `生成于 ${KY.generated_at} ·`);
if (s !== before) { fs.writeFileSync(p, s); console.log('plan.html footer updated'); }
else console.log('plan.html unchanged');
