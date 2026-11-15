// Tab Anatomy (2026-11-15): hình cơ thể trước / sau + thông tin cơ + bài gợi ý từ thư viện.
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const mapSrc = fs.readFileSync(path.join(root, 'lib', 'anatomy-map.js'), 'utf8');

// 1. Ghi công giấy phép Apache-2.0 của body-muscles phải còn trong file hình + chân tab + bản LICENSE.
assert.ok(/Ivan Vulović/.test(mapSrc) && /Apache License 2\.0/.test(mapSrc), 'attribution in lib/anatomy-map.js');
assert.ok(fs.existsSync(path.join(root, 'lib', 'anatomy-map.LICENSE.txt')), 'LICENSE copy');
assert.ok(/body-muscles<\/a> · Ivan Vulović · Apache-2.0/.test(html), 'credit line in tab');

// 2. Nạp module Anatomy từ index.html (đoạn giữa hai mốc) + bộ map cơ của app.
function fn(name) { const i = html.indexOf('\nfunction ' + name + '(') + 1; let d = 0; for (let k = html.indexOf('{', i); k < html.length; k++) { if (html[k] === '{') d++; else if (html[k] === '}') { d--; if (!d) return html.slice(i, k + 1); } } }
function block(start) { const i = html.indexOf(start); let d = 0; for (let k = i; k < html.length; k++) { const c = html[k]; if (c === '{' || c === '[') d++; else if (c === '}' || c === ']') { d--; if (!d) return html.slice(i, html.indexOf('\n', k)); } } }
const mod = html.slice(html.indexOf('// ── ANATOMY ──'), html.indexOf('// ── EXERCISE LIBRARY CACHE (Step 6)'));
const ctx = { console: { warn() {}, log() {} }, window: {}, currentUser: { uid: 'me' }, activeClient: { coachUid: 'c1' }, _lang: 'en' };
vm.createContext(ctx);
vm.runInContext(mapSrc.replace('window.ANATOMY_MAP', 'this.ANATOMY_MAP'), ctx);
vm.runInContext([fn('escHtml'), block('var CD_MUSCLE_MAP = {'), block('var CD_MUSCLE_GUESS = ['), fn('cdFold'),
  'var _cdMapMemo = {}, _cdWarned = {};', fn('cdMapMuscle'), mod,
  'this.AN_REGION = AN_REGION; this.AN_GROUPS = AN_GROUPS; this.AN_AREAS = AN_AREAS; this.anExercises = anExercises; this.anFacing = anFacing;'].join('\n'), ctx);
const { AN_REGION, AN_GROUPS, AN_AREAS, anExercises, anFacing, ANATOMY_MAP } = ctx;

// 3. Hình: đủ 89 vùng, mỗi vùng hoặc không phải cơ (null) hoặc thuộc một nhóm có nội dung.
assert.strictEqual(ANATOMY_MAP.length, 89);
const used = new Set();
ANATOMY_MAP.forEach(([id, v, d]) => {
  assert.ok(v === 'f' || v === 'b', id);
  assert.ok(/^[mM]/.test(d), id + ' path');
  const g = AN_REGION(id);
  if (g) { assert.ok(AN_GROUPS[g], id + ' → ' + g); used.add(g); }
});
// Mọi nhóm có vùng để chạm, và có trong danh sách theo khu vực (đúng một lần).
const listed = AN_AREAS.flatMap((a) => a[2]);
assert.strictEqual(new Set(listed).size, listed.length, 'group listed twice');
Object.keys(AN_GROUPS).forEach((g) => {
  assert.ok(used.has(g), g + ' has no region on the map');
  assert.ok(listed.includes(g), g + ' missing from AN_AREAS');
  const G = AN_GROUPS[g];
  ['vi', 'en'].forEach((l) => {
    assert.ok(G[l] && G.where[l] && G.tip[l] && G.fn[l] && G.fn[l].length >= 1, g + ' content ' + l);
  });
  assert.ok(G.la && Array.isArray(G.lib) && Array.isArray(G.alt) && G.alt.length, g + ' meta');
});
// Vùng không phải cơ không chạm được.
['head', 'face', 'hand-left', 'foot-back-right', 'knee-left', 'elbow-right', 'spine'].forEach((id) => assert.strictEqual(AN_REGION(id), null, id));

// 4. Góc → mặt.
assert.strictEqual(anFacing(0), 'f'); assert.strictEqual(anFacing(180), 'b'); assert.strictEqual(anFacing(-100), 'b');
assert.strictEqual(anFacing(359), 'f'); assert.strictEqual(anFacing(450), 'b'); assert.strictEqual(anFacing(89), 'f');

// 5. Bài gợi ý: P trước S, bỏ bài riêng của coach khác, gộp trùng tên, ngực trên chỉ nhận bài dốc của ngực.
ctx._exerciseCache = [
  { name: 'Barbell Bench Press', muscles: { Chest: 'P', Triceps: 'S' } },
  { name: 'Incline Dumbbell Press', muscles: { Chest: 'P' } },
  { name: 'Incline Dumbbell Curl', muscles: { Biceps: 'P' } },
  { name: 'Push Up (Bodyweight)', muscles: { Chest: 'P' } },
  { name: 'Push-up', muscles: { Chest: 'P' } },
  { name: 'Private Fly', muscles: { Chest: 'P' }, ownerUid: 'other-coach' },
  { name: 'Own Fly', muscles: { Chest: 'P' }, ownerUid: 'c1' },
  { name: 'Close Grip Bench Press', muscles: { Triceps: 'P', Chest: 'S' } },
];
vm.runInContext('var _exerciseCache = this._exerciseCache;', ctx);
const low = anExercises('chest-lower').map((x) => x.name);
assert.ok(!low.includes('Private Fly'), 'other coach private exercise hidden');
assert.ok(low.includes('Own Fly'), "client's own coach private exercise shown");
assert.strictEqual(low.filter((n) => /push.?up/i.test(n)).length, 1, 'duplicate names merged');
assert.ok(low.indexOf('Barbell Bench Press') < low.indexOf('Close Grip Bench Press'), 'primary before secondary');
const up = anExercises('chest-upper').map((x) => x.name);
assert.strictEqual(JSON.stringify(up), JSON.stringify(['Incline Dumbbell Press']), 'upper chest = incline chest only');

// 6. Gắn vào app: nút tab, trang, showPage, file hình tải lười đúng đường dẫn.
assert.ok(/id="anatomy-nav-tab"[^>]*onclick="showPage\('anatomy'\)"/.test(html));
assert.ok(/<div id="anatomy-page" data-i18n-skip>/.test(html));
assert.ok(/if \(page === 'anatomy'\) renderAnatomy\(\);/.test(html));
assert.ok(html.includes("js.src = '/lib/anatomy-map.js'"));
// Không dựa vào backface-visibility (WebKit bỏ qua) — mặt quay đi phải bị ẩn bằng visibility.
assert.ok(/f\.style\.visibility = face === 'f'/.test(html));
console.log('anatomy OK');
