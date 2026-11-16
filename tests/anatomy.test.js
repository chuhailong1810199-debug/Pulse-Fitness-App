// Tab Anatomy (2026-11-15): hình cơ thể trước / sau + thông tin cơ + bài gợi ý từ thư viện.
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const mapSrc = fs.readFileSync(path.join(root, 'lib', 'anatomy-map.js'), 'utf8');

// 1. Ghi công giấy phép Apache-2.0 của body-muscles phải còn trong file hình + chân tab + bản LICENSE.
assert.ok(/Ivan Vulović/.test(mapSrc) && /Apache License 2\.0/.test(mapSrc) && /Thay đổi:/.test(mapSrc), 'attribution + change notice in lib/anatomy-map.js');
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
  'this.AN_REGION = AN_REGION; this.AN_GROUPS = AN_GROUPS; this.AN_AREAS = AN_AREAS; this.anExercises = anExercises; this.anFacing = anFacing; this.AN_SPORTS = AN_SPORTS; this.AN_SPORT_ORDER = AN_SPORT_ORDER; this.anSportLevel = anSportLevel; this.anDose = anDose; this.anExName = anExName;'].join('\n'), ctx);
const { AN_REGION, AN_GROUPS, AN_AREAS, anExercises, anFacing, ANATOMY_MAP, AN_SPORTS, AN_SPORT_ORDER, anSportLevel, anDose, anExName } = ctx;

// 3. Hình (scripts/anatomy/build-map.js): mỗi mục hoặc không phải cơ (null) hoặc thuộc một nhóm có nội dung.
assert.ok(ANATOMY_MAP.length >= 89, 'map entries');
const used = new Set();
ANATOMY_MAP.forEach((r) => {
  const [id, v, d] = r;
  assert.ok(v === 'f' || v === 'b', id);
  assert.ok(/^M /.test(d), id + ' path');
  const g = AN_REGION(r);
  if (g) { assert.ok(AN_GROUPS[g], id + ' → ' + g); used.add(g); }
});
// Soát 2026-11-16 (coach báo thiếu vai trước): các nhóm này phải có vùng chạm được, ở ĐÚNG mặt và đủ lớn.
const P = require(path.join(root, 'scripts', 'anatomy', 'pathlib.js'));
const area = (g, v) => ANATOMY_MAP.filter((r) => r[3] === g && r[1] === v).reduce((a, r) => a + P.parse(r[2]).reduce((b, sub) => {
  const p = P.pts(sub); let s2 = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; s2 += p[i][0] * q[1] - q[0] * p[i][1]; } return b + Math.abs(s2) / 2; }, 0), 0);
[['delt-f', 'f', 6], ['delt-s', 'f', 3], ['delt-r', 'b', 4], ['rotator', 'b', 4], ['serratus', 'f', 2], ['obliques', 'f', 6], ['abs', 'f', 20], ['brachialis', 'f', 1]]
  .forEach(([g, v, min]) => assert.ok(area(g, v) >= min, g + ' too small on ' + v + ': ' + area(g, v).toFixed(2)));
// Cơ răng trước ở mạn sườn, không nằm trên cột cơ bụng giữa.
const MIDF = 15.85;
ANATOMY_MAP.filter((r) => r[3] === 'serratus').forEach((r) => P.parse(r[2]).forEach((sub) => assert.ok(Math.abs(P.centroid(sub)[0] - MIDF) > 3, 'serratus on the midline')));
ANATOMY_MAP.filter((r) => r[3] === 'abs').forEach((r) => P.parse(r[2]).forEach((sub) => assert.ok(Math.abs(P.centroid(sub)[0] - MIDF) < 3, 'abs off the midline')));
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
['head', 'face', 'hand-left', 'foot-back-right', 'knee-left', 'elbow-right', 'spine'].forEach((id) => assert.strictEqual(AN_REGION(ANATOMY_MAP.find((r) => r[0] === id)), null, id));

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

// Thể thao (2026-11-16): Boxing + Chạy bộ — cơ tham chiếu phải có thật, nội dung đủ 2 thứ tiếng, liều dịch được.
assert.deepStrictEqual(JSON.stringify(AN_SPORT_ORDER), JSON.stringify(['boxing', 'running', 'basketball']));
AN_SPORT_ORDER.forEach((k) => {
  const S = AN_SPORTS[k];
  assert.ok(S.vi && S.en && S.sum.vi && S.sum.en, k + ' names');
  ['demands', 'risk', 'plan'].forEach((f) => assert.ok(S[f].vi.length >= 3 && S[f].vi.length === S[f].en.length, k + ' ' + f));
  Object.entries(S.key).forEach(([g, r]) => { assert.ok(AN_GROUPS[g], k + ' key ' + g); assert.ok(r.vi && r.en, k + ' role ' + g); });
  S.k2.forEach((g) => { assert.ok(AN_GROUPS[g], k + ' k2 ' + g); assert.ok(!S.key[g], k + ' ' + g + ' cả k1 lẫn k2'); });
  assert.ok(Object.keys(S.key).length >= 5, k + ' key muscles');
  // Cơ chủ lực phải chạm được trên hình.
  Object.keys(S.key).forEach((g) => assert.ok(ANATOMY_MAP.some((r) => r[3] === g), k + ' ' + g + ' not on map'));
  assert.ok(S.blocks.length >= 4, k + ' blocks');
  S.blocks.forEach((b) => {
    assert.ok(b.vi && b.en && b.why.vi && b.why.en && b.ex.length >= 3, k + ' block ' + b.vi);
    b.ex.forEach(([n, d]) => { assert.ok(n && d, k + ' ex'); assert.ok(!/bên|giây|phút|nghỉ|lần|bước|hướng|nặng|hiệp|làm/.test(anDose(d) + ' ' + anExName(n)), 'EN chưa dịch: ' + n + ' ' + anDose(d)); });
  });
});
assert.strictEqual(anSportLevel('boxing', 'serratus'), 1);
assert.strictEqual(anSportLevel('running', 'soleus'), 1);
assert.strictEqual(anSportLevel('running', 'tibialis'), 2);
assert.strictEqual(anSportLevel('running', 'biceps'), 0);
assert.strictEqual(anSportLevel('basketball', 'glute-med'), 1);
assert.strictEqual(anSportLevel('basketball', 'tibialis'), 2);
// Nối dây: công tắc chế độ, chọn môn, tô cơ, thẻ môn, vai trò cơ trong môn.
['anSetMode(', 'anSetSport(', "' an-k' + lv", 'anSportCard()', 'an-sp-role', 'an-legend'].forEach((t) => assert.ok(html.includes(t), 'wiring ' + t));
assert.ok(/\.an-m\.an-k1\{/.test(html) && /\.an-m\.an-k1\.on/.test(html), 'css k1 + selected');
assert.ok(html.includes(".an-chip[data-g]').forEach"), 'chọn cơ không được tắt chip môn');
// 2026-11-16: bài cơ PHỤ không lọt danh sách nhờ điểm dụng cụ; "jump" chung không kéo Jumping Jack vào bắp chân.
{
  const save = ctx._exerciseCache;
  ctx._exerciseCache = [{ name: 'Seated Calf Raise (Machine)', muscles: { Calves: 'P' } }, { name: 'Burpee (Bodyweight)', muscles: { Quads: 'P', Glutes: 'P', Calves: 'S' } },
    { name: 'Jumping Jack (Bodyweight)', muscles: { Calves: 'S', Glutes: 'S' } }, { name: 'Jump Rope', muscles: { Calves: 'P' } }];
  vm.runInContext('_exerciseCache = this._exerciseCache;', ctx);
  ['soleus', 'gastroc'].forEach((g) => { const n = anExercises(g).map((x) => x.name).join('|'); assert.ok(!/Burpee|Jumping Jack/.test(n), g + ': ' + n); });
  ctx._exerciseCache = save; vm.runInContext('_exerciseCache = this._exerciseCache;', ctx);
}
console.log('anatomy ok');
