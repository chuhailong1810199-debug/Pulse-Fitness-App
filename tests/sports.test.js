// Bổ trợ theo môn thể thao (2026-11-16): một nguồn functions/sports.js cho tab Anatomy + trợ lý Pulse soạn giáo án.
const assert = require('assert'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const SP = require(path.join(root, 'functions', 'sports.js'));
const sync = require(path.join(root, 'scripts', 'sports', 'sync.js'));
const PC = require(path.join(root, 'functions', 'program-check.js'));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const asst = fs.readFileSync(path.join(root, 'functions', 'assistant.js'), 'utf8');

// 1. App chép ĐÚNG Y dữ liệu của máy chủ (sửa functions/sports.js rồi chạy node scripts/sports/sync.js).
assert.strictEqual(sync.current(html), sync.appBlock(), 'index.html lệch functions/sports.js — chạy node scripts/sports/sync.js');
assert.ok(/const AN_SPORTS = SPORTS;/.test(html));

// 2. Dữ liệu: khối có id duy nhất, tag hợp lệ, mỗi môn ≥ 2 khối bắt buộc; bài ngoài thư viện chỉ ở khối circuit;
//    giai đoạn đủ 3 mùa, 2 thứ tiếng.
const TAGS = ['warmup', 'strength', 'accessories', 'circuit'];
const newNames = new Set(SP.NEW_LIBRARY.map((e) => e.name.toLowerCase()));
SP.SPORT_ORDER.forEach((k) => {
  const S = SP.SPORTS[k];
  const ids = S.blocks.map((b) => b.id);
  assert.strictEqual(new Set(ids).size, ids.length, k + ' block id trùng');
  assert.ok(S.blocks.filter((b) => b.need).length >= 2, k + ' khối bắt buộc');
  S.blocks.forEach((b) => {
    assert.ok(TAGS.includes(b.tag), k + ' tag ' + b.tag);
    b.ex.forEach(([n, d, lib]) => { if (!lib) assert.strictEqual(b.tag, 'circuit', k + ': "' + n + '" ngoài thư viện nhưng khối ' + b.id + ' không phải circuit'); });
    if (b.need) assert.ok(b.ex.every(([, , lib]) => lib), k + ' khối bắt buộc ' + b.id + ' phải toàn bài thư viện');
  });
  Object.keys(SP.SPORT_PHASES).forEach((p) => assert.ok(S.season[p] && S.season[p].vi && S.season[p].en, k + ' season ' + p));
  Object.keys(S.key).concat(S.k2).forEach((g) => assert.ok(SP.GROUP_VI[g], k + ' GROUP_VI thiếu ' + g));
});
// Bài mới: tên theo kiểu thư viện "Tên (Dụng cụ)", nhóm cơ chỉ dùng tên chuẩn có trên hình, P/S.
const CANON = ['Chest', 'Front Delts', 'Side Delts', 'Rear Delts', 'Biceps', 'Triceps', 'Forearms', 'Abs', 'Obliques', 'Quads', 'Adductors',
  'Hamstrings', 'Glutes', 'Calves', 'Traps', 'Mid/Lower Traps', 'Rhomboids', 'Lats', 'Teres Major', 'Rotator Cuff', 'Erector Spinae'];
SP.NEW_LIBRARY.forEach((e) => {
  assert.ok(/\([^)]+\)$/.test(e.name), 'tên thư viện: ' + e.name);
  assert.ok(Object.entries(e.muscles).length && Object.entries(e.muscles).every(([m, r]) => CANON.includes(m) && /^[PS]$/.test(r)), 'cơ: ' + e.name);
  assert.ok(e.tool && e.types.length && e.difficulty, e.name);
});
// Mọi bài mới đều có khung môn dùng tới (không thêm thừa).
const used = new Set(); Object.values(SP.SPORTS).forEach((S) => S.blocks.forEach((b) => b.ex.forEach(([, , l]) => l && used.add(l.toLowerCase()))));
newNames.forEach((n) => assert.ok(used.has(n), 'bài mới không môn nào dùng: ' + n));

// 3. Hồ sơ khách: sport { id, phase }; phase lạ → off; môn lạ → null.
assert.deepStrictEqual(SP.clientSport({ sport: { id: 'basketball', phase: 'in' } }), { id: 'basketball', phase: 'in' });
assert.deepStrictEqual(SP.clientSport({ sport: { id: 'boxing', phase: 'x' } }), { id: 'boxing', phase: 'off' });
assert.strictEqual(SP.clientSport({ sport: { id: 'golf' } }), null);
assert.strictEqual(SP.clientSport({ sport: null }), null);

// 4. Khung cho trợ lý: tên bài = tên thư viện, khối bắt buộc đánh dấu, giai đoạn hiện tại.
const g = SP.sportGuide('basketball', 'in');
assert.strictEqual(g.phaseName, 'Trong mùa');
assert.ok(/48 giờ/.test(g.seasonNow));
const landing = g.blocks.find((b) => b.id === 'landing');
assert.ok(landing.required && landing.plyometric && landing.exercises.some((x) => x.name === 'Drop Landing (Bodyweight)'));
assert.ok(g.blocks.find((b) => b.id === 'cond').exercises.some((x) => x.outsideLibrary));
assert.ok(SP.sportGuide('golf').error);

// 5. Kiểm giáo án: thiếu khối bắt buộc → lỗi có khoá sport:<id>; có ≥ 1 bài → qua; ngoại lệ có lý do → miễn.
const day = (names) => ({ label: 'A', phases: [{ name: 'Main', tag: 'strength', exercises: names.map((n) => ({ name: n, setsReps: '3 x 5' })) }] });
const sp = { id: 'basketball', phase: 'off' };
let r = SP.sportIssues({ SessionA: day(['Front Squat (Barbell)']) }, sp, {});
assert.deepStrictEqual(r.errors.map((e) => e.k).sort(), ['sport:decel', 'sport:landing', 'sport:prehab']);
r = SP.sportIssues({ SessionA: day(['Front Squat (Barbell)', 'Drop Landing (Bodyweight)', 'Copenhagen Plank (Bodyweight)']),
  SessionB: day(['Spanish Squat (Band)']) }, sp, {});
assert.strictEqual(r.errors.length, 0, JSON.stringify(r.errors));
r = SP.sportIssues({ SessionA: day(['Front Squat (Barbell)', 'Drop Landing (Bodyweight)', 'Copenhagen Plank (Bodyweight)']) }, sp, { 'sport:prehab': 'đang tập vật lý trị liệu riêng' });
assert.strictEqual(r.errors.length, 0); assert.ok(/vật lý trị liệu/.test(r.waived[0]));
// checkProgram: lỗi môn vào errors khi khách có sport, không đụng khách không có môn / lớp nhóm.
const prog = { SessionA: day(['Front Squat (Barbell)']) };
assert.ok(PC.checkProgram(prog, { level: 'Beginner', sport: sp }).errors.some((e) => e.k === 'sport:landing'));
assert.ok(!PC.checkProgram(prog, { level: 'Beginner' }).errors.some((e) => /^sport:/.test(e.k)));
assert.ok(!PC.checkProgram(prog, { isGroup: true, sport: sp }).errors.some((e) => /^sport:/.test(e.k)));

// 6. Trợ lý: tool get_sport_guide, get_client trả sport, propose_program đòi đọc khung môn, luật môn trong prompt.
const A = require(path.join(root, 'functions', 'assistant.js'));
assert.ok(A.TOOLS.some((t) => t.name === 'get_sport_guide'));
assert.ok(A.SYSTEM.includes('BỔ TRỢ THEO MÔN THỂ THAO'));
assert.ok(/need\.push\("get_sport_guide"\)/.test(asst), 'propose_program chặn khi chưa đọc khung môn');
assert.ok(/sport: SPORT\.clientSport\(v\)/.test(asst) && /sport: cd\.isGroup === true \? null : SPORT\.clientSport\(cd\)/.test(asst));

// 7. App: gắn môn cho khách (coach phụ trách, khách 1-1), nút nhờ Pulse, nhãn Bắt buộc, theo giai đoạn.
['anAssignSport(', 'anAskPulse()', "anS('Bắt buộc', 'Required')", 'an-season', "updateDoc(doc(db, 'clients', activeClient.id), { sport: val })"].forEach((t) => assert.ok(html.includes(t), 'app ' + t));
assert.ok(/!activeClient\.isGroup/.test(html) && /isObserving\(\)\)/.test(html));
console.log('sports ok');
