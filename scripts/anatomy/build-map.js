#!/usr/bin/env node
/*
 * Dựng lib/anatomy-map.js từ dữ liệu "body-muscles" (Ivan Vulović, Apache-2.0) + SỬA NHÃN cho đúng giải phẫu.
 *
 *   git clone --depth 1 https://github.com/vulovix/body-muscles /tmp/body-muscles
 *   node scripts/anatomy/build-map.js /tmp/body-muscles
 *
 * Vì sao phải sửa (soát 2026-11-16, coach báo "thiếu vai trước"): nhãn gốc lệch với vị trí thật —
 *  - "shoulder-side" là CẢ khối vai nhìn trước; "shoulder-front" chỉ là 2 mảnh nhỏ sát xương đòn → vai trước gần như
 *    không chạm được. Mảnh trong (giáp ngực) của shoulder-side → vai trước, mảnh ngoài → vai giữa.
 *  - "serratus-anterior" / "obliques" có mảnh nằm trên 2 hàng múi bụng trên; "abs-upper" thật ra là hông bụng, "abs-lower"
 *    là bụng dưới giữa. Quy tắc theo VỊ TRÍ: mảnh cách đường giữa < 3 đơn vị = cơ bụng thẳng; xa hơn = cơ răng trước
 *    (nếu vùng gốc là serratus) hoặc cơ chéo.
 *  - "lats-upper" (mặt sau) phủ xương bả vai + mặt sau vai; "deltoid-rear" chỉ là một mảnh nhỏ. Cắt dọc: phần ngoài →
 *    vai sau, phần trong → chóp xoay / cơ tròn (dưới gai, tròn bé, tròn lớn).
 *  - Dải ngoài của "biceps" = cơ cánh tay (brachialis); mảnh ngoài "forearm" = cơ cánh tay quay (nhóm duỗi);
 *    dải trong của "tibialis-anterior" = mép trong bắp chân.
 * Mỗi mục đầu ra: [id, mặt 'f'|'b', path, nhóm|null]. Mảnh cùng nhóm của một vùng gộp lại một path.
 */
const fs = require('fs'), path = require('path');
const P = require('./pathlib.js');

const src = process.argv[2];
if (!src) { console.error('dùng: node scripts/anatomy/build-map.js <thư mục body-muscles>'); process.exit(1); }
const sha = (() => { try { return require('child_process').execSync('git -C ' + JSON.stringify(src) + ' rev-parse --short HEAD').toString().trim(); } catch (_e) { return '?'; } })();

const raw = [];
for (const [f, v] of [['muscles.front.ts', 'f'], ['muscles.back.ts', 'b']]) {
  const s = fs.readFileSync(path.join(src, 'src', 'data', f), 'utf8').replace(/^\s*\/\/.*$/gm, '');
  const re = /id:\s*"([^"]+)",\s*name:\s*"([^"]+)",\s*view:\s*ViewSide\.\w+,\s*path:\s*"([^"]+)"/g;
  let m; while ((m = re.exec(s))) raw.push({ id: m[1], v, subs: P.parse(m[3]) });
}
if (raw.length !== 89) throw new Error('dữ liệu gốc đổi: ' + raw.length + ' vùng (mong 89) — soát lại quy tắc');

// Nhóm mặc định theo tên gốc (bỏ -left/-right). null = không phải cơ (chỉ vẽ nền).
const BASE = {
  'neck': 'neck', 'nape': 'neck',
  'shoulder-front': 'delt-f', 'shoulder-side': 'delt-s', 'deltoid-rear': 'delt-r',
  'traps-upper': 'traps', 'traps-mid': 'traps-lo', 'traps-lower': 'traps-lo',
  'lats-upper': 'lats', 'lats-mid': 'lats', 'lats-lower': 'lats',
  'biceps': 'biceps', 'triceps-long': 'triceps', 'triceps-lateral': 'triceps',
  'forearm': 'forearm-flex', 'forearm-flexors': 'forearm-flex', 'forearm-extensors': 'forearm-ext',
  'chest-upper': 'chest-upper', 'chest-lower': 'chest-lower',
  'abs-upper': 'obliques', 'abs-lower': 'abs', 'obliques': 'obliques', 'serratus-anterior': 'serratus',
  'hip-flexor': 'hip-flex', 'quads': 'quads', 'adductors': 'adductors', 'tibialis-anterior': 'tibialis',
  'lower-back-erectors': 'erectors', 'lower-back-ql': 'ql',
  'gluteus-maximus': 'glute-max', 'gluteus-medius': 'glute-med',
  'hamstrings-medial': 'hams', 'hamstrings-lateral': 'hams',
  'calves-gastroc-medial': 'gastroc', 'calves-gastroc-lateral': 'gastroc', 'calves-soleus': 'soleus',
};
const baseOf = (id) => id.replace(/-(left|right)$/, '');

// Đường giữa mỗi mặt = trung điểm tâm của một cặp trái / phải.
const cen = (r) => { const all = r.subs.flatMap(P.pts); return [all.reduce((a, q) => a + q[0], 0) / all.length, all.reduce((a, q) => a + q[1], 0) / all.length]; };
const mid = (a, b) => (cen(raw.find((r) => r.id === a))[0] + cen(raw.find((r) => r.id === b))[0]) / 2;
const MID = { f: mid('chest-lower-left', 'chest-lower-right'), b: mid('traps-upper-left', 'traps-upper-right') };
const dx = (v, sub) => Math.abs(P.centroid(sub)[0] - MID[v]);

const out = [];
for (const r of raw) {
  const b = baseOf(r.id);
  const g0 = BASE[b] || null;
  let parts = r.subs.map((s) => ({ s, g: g0 }));            // nhóm cho từng mảnh
  const far = () => parts.reduce((m, p) => (dx(r.v, p.s) > dx(r.v, m.s) ? p : m), parts[0]);
  const near = () => parts.reduce((m, p) => (dx(r.v, p.s) < dx(r.v, m.s) ? p : m), parts[0]);
  if (['abs-upper', 'abs-lower', 'obliques', 'serratus-anterior'].includes(b)) {
    parts.forEach((p) => { p.g = dx(r.v, p.s) < 3 ? 'abs' : (b === 'serratus-anterior' ? 'serratus' : 'obliques'); });
  } else if (b === 'shoulder-side' && parts.length === 2) {
    parts.forEach((p) => { p.g = 'delt-f'; }); far().g = 'delt-s';
  } else if (b === 'biceps' && parts.length === 3) {
    far().g = 'brachialis';
  } else if (b === 'forearm' && parts.length === 2) {
    far().g = 'forearm-ext';
  } else if (b === 'tibialis-anterior' && parts.length === 2) {
    near().g = 'gastroc';
  } else if (b === 'lats-upper' && parts.length === 1) {
    // Cắt dọc ở 8,6 đơn vị cách đường giữa (≈ bờ trong cơ delta sau): ngoài → vai sau, trong → chóp xoay / cơ tròn.
    const right = P.centroid(parts[0].s)[0] > MID.b;
    const cut = MID.b + (right ? 1 : -1) * 8.6;
    const outer = P.clipX(parts[0].s, cut, right), inner = P.clipX(parts[0].s, cut, !right);
    parts = [outer && { s: outer, g: 'delt-r' }, inner && { s: inner, g: 'rotator' }].filter(Boolean);
  }
  const by = {};
  parts.forEach((p) => { (by[p.g] = by[p.g] || []).push(p.s); });
  const keys = Object.keys(by);
  keys.forEach((g) => out.push([keys.length > 1 ? r.id + '~' + g : r.id, r.v, P.toD(by[g]), g === 'null' ? null : g]));
}

const head = `/*
 * Pulse · tab Anatomy — hình vùng cơ (SVG) nhìn trước / sau. TẠO BẰNG scripts/anatomy/build-map.js — đừng sửa tay.
 *
 * Đường vẽ lấy từ "body-muscles" của Ivan Vulović (https://github.com/vulovix/body-muscles, commit ${sha}),
 * Copyright 2024 Ivan Vulović, giấy phép Apache License 2.0 (https://www.apache.org/licenses/LICENSE-2.0).
 * This product includes software developed by Ivan Vulović.
 * Thay đổi: path chuẩn hoá về toạ độ tuyệt đối; một số vùng được tách / gán lại nhóm cơ cho đúng giải phẫu
 * (vai trước / giữa / sau, chóp xoay, cơ bụng thẳng / chéo / răng trước, cơ cánh tay, cơ cánh tay quay, mép bắp chân)
 * — xem chú thích đầu scripts/anatomy/build-map.js. Tên, nhóm, nội dung giải phẫu là của Pulse (index.html).
 * Mục: [id, mặt 'f'|'b', path, nhóm cơ | null]. Toạ độ: mặt trước viewBox "0 0 35 93", mặt sau "37 0 35 93".
 */
`;
fs.writeFileSync(path.join(__dirname, '..', '..', 'lib', 'anatomy-map.js'), head + 'window.ANATOMY_MAP = ' + JSON.stringify(out) + ';\n');
const count = {}; out.forEach((r) => { count[r[3]] = (count[r[3]] || 0) + 1; });
console.log(out.length + ' mục · đường giữa trước ' + MID.f.toFixed(2) + ' sau ' + MID.b.toFixed(2));
console.log(Object.entries(count).map(([g, n]) => g + ':' + n).join(' '));
