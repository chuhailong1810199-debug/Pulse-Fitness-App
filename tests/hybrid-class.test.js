/**
 * Lớp Hybrid / HYROX (2026-10-19): loại buổi theo cách các training club chạy lớp, chạy nhiều hơn
 * trạm ở buổi Compromised / Engine / Race Sim (server kiểm), form có giai đoạn block + chỗ chạy.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const C = require('../functions/program-check.js');
const A = require('../functions/assistant.js');

const ex = (name, setsReps) => ({ name, setsReps });
// Đúng mẫu Compromised 60 phút trong GROUP_METHOD.
const COMPROMISED = { label: 'Compromised — chạy xen SkiErg / Wall Ball', focus: 'f', phases: [
  { name: 'Khởi động', tag: 'warmup', exercises: [ex('Row nhẹ', '1 × 5 phút'), ex('Lunge + Squat bodyweight', '2 × 10')] },
  { name: 'Kỹ thuật — Sled Push', tag: 'circuit', exercises: [ex('Sled Push', '4 × 1 phút')] },
  { name: "Khối chính — 5 vòng: chạy 3 phút → trạm 2 phút (30')", tag: 'circuit', exercises: [ex('Run', '5 × 3 phút'), ex('SkiErg', '3 × 2 phút'), ex('Wall Ball', '2 × 2 phút')] },
  { name: "Finisher — EMOM 7'", tag: 'circuit', exercises: [ex('Run', '2 × 2 phút'), ex('Wall Ball', '3 × 1 phút')] },
] };

test('phut cua bai: thoi gian, quang chay, mac dinh', () => {
  assert.strictEqual(C.exerciseMinutes('5 × 3 phút'), 15);
  assert.ok(Math.abs(C.exerciseMinutes('4 × 400m') - 8.8) < 0.01);
  assert.ok(Math.abs(C.exerciseMinutes('1 × 1km') - 5.5) < 0.01);
});

test('buoi Compromised dung mau thi qua; tram nhieu hon chay thi bi chan', () => {
  const ok = C.checkProgram({ SessionA: COMPROMISED }, { isGroup: true, groupFormat: 'hyrox', minutes: 60 });
  assert.deepStrictEqual(ok.errors, [], JSON.stringify(ok.errors));
  assert.ok(ok.runSplit.SessionA.run > ok.runSplit.SessionA.station);
  const heavy = JSON.parse(JSON.stringify(COMPROMISED));
  heavy.phases[2].exercises[1].setsReps = '5 × 5 phút';   // trạm trong khối chính 29 phút > chạy 15
  const bad = C.checkProgram({ SessionA: heavy }, { isGroup: true, groupFormat: 'hyrox' });
  assert.ok(bad.errors.some((e) => e.k === 'run:SessionA'));
});

test('Strength Endurance duoc tram nhieu hon chay; bai "(thay chay)" tinh la chay; label thieu loai thi nhac', () => {
  const se = { label: 'Strength Endurance — sled + lunge', phases: [{ name: 'E2MOM 20 phút', tag: 'circuit',
    exercises: [ex('Sled Push', '10 × 1 phút'), ex('Sandbag Lunges', '10 × 1 phút'), ex('Run', '2 × 2 phút')] }] };
  assert.deepStrictEqual(C.hybridIssues({ SessionB: se }).errors, []);
  const noRun = { label: 'Engine — không chỗ chạy', phases: [{ name: 'Interval', tag: 'circuit',
    exercises: [ex('Row (thay chạy)', '5 × 4 phút'), ex('Farmers Carry', '5 × 1 phút')] }] };
  assert.deepStrictEqual(C.hybridIssues({ SessionC: noRun }).errors, []);
  const unlabeled = { label: 'Buổi A', phases: COMPROMISED.phases };
  assert.ok(C.hybridIssues({ SessionA: unlabeled }).warnings.length === 1);
  // Lớp strength / circuit không bị luật chạy.
  assert.deepStrictEqual(C.checkProgram({ SessionA: { label: 'x', phases: [{ name: 'c', tag: 'circuit', exercises: [ex('Burpee', '8 vòng × 10')] }] } },
    { isGroup: true, groupFormat: 'circuit' }).errors, []);
});

test('khung lop hybrid trong prompt: loai buoi, chay > tram, block 12 tuan, test 4 tuan, thay dung cu', () => {
  const g = A.GROUP_METHOD;
  for (const t of C.SESSION_TYPES) assert.ok(g.includes(t), t);
  assert.match(g, /CHẠY PHẢI\s+NHIỀU HƠN/);
  assert.match(g, /BLOCK 12 TUẦN/);
  assert.match(g, /1 km → 50 wall ball → chạy 1 km/);
  assert.match(g, /Sled push → đẩy đĩa tạ/);
  assert.match(g, /You go, I go/);
});

test('form lop: giai doan + cho chay; prompt gan loai buoi theo so buoi/tuan', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const a = html.indexOf('const _AI_GF_FORMATS'), b = html.indexOf('function aiFormSend');
  const api = new Function('escHtml', html.slice(a, b) + '; return { aiBuildGroupPrompt, _aiGroupForm };')((x) => x);
  const r = api.aiBuildGroupPrompt({ name: 'HYROX sáng', format: 'hyrox', equipment: '3 SkiErg, 2 Row', spw: '3', dur: '60 phút', phase: 'build', run: 'none', size: '10' });
  assert.match(r.prompt, /SessionA = Compromised, SessionB = Strength Endurance, SessionC = Engine/);
  assert.match(r.prompt, /tuần 5–8/);
  assert.match(r.prompt, /\(thay chạy\)/);
  const peak = api.aiBuildGroupPrompt({ name: 'X', format: 'hyrox', equipment: 'y', spw: '2', phase: 'peak' });
  assert.match(peak.prompt, /SessionB = Race Sim/);
  const circ = api.aiBuildGroupPrompt({ name: 'X', format: 'circuit', equipment: 'y', spw: '2' });
  assert.doesNotMatch(circ.prompt, /Compromised/);
  assert.match(api._aiGroupForm(), /name="phase"/);
  assert.match(api._aiGroupForm(), /name="run"/);
});

test('chay ghi trong ten pha hoac trong set×rep van duoc dem (10 lan de xuat bi tu choi 2026-10-19)', () => {
  // Chạy trong tên pha, dòng bài chỉ có trạm.
  const inName = { label: 'Compromised — x', phases: [{ name: 'Khối chính — 5 vòng: chạy 3 phút → trạm', tag: 'circuit',
    exercises: [{ name: 'SkiErg', setsReps: '5 × 1 phút' }, { name: 'Wall Ball', setsReps: '5 × 1 phút' }] },
    { name: 'Finisher', tag: 'circuit', exercises: [{ name: 'Burpee Broad Jump', setsReps: '3 × 1 phút' }] }] };
  const a = C.runStationMinutes(inName);
  assert.strictEqual(a.run, 15); assert.strictEqual(a.station, 10);
  assert.deepStrictEqual(C.hybridIssues({ SessionA: inName }).errors, []);
  // Chạy lồng trong set×rep của bài trạm.
  const inReps = { label: 'Compromised — x', phases: [{ name: 'Main', tag: 'circuit',
    exercises: [{ name: 'Wall Ball', setsReps: '4 vòng × (800m chạy + 15 wall ball)' }] }] };
  const b = C.runStationMinutes(inReps);
  assert.ok(b.run > b.station, JSON.stringify(b));
  // Không có chạy ở đâu cả → lỗi nói rõ server không thấy bài chạy + cách ghi đúng.
  const none = { label: 'Compromised — x', phases: [{ name: 'Main', tag: 'circuit', exercises: [{ name: 'SkiErg', setsReps: '3 × 1 phút' }] }] };
  const e = C.hybridIssues({ SessionA: none }).errors.find((x) => x.k === 'run:SessionA').m;
  assert.match(e, /KHÔNG thấy bài chạy/);
  assert.match(e, /DÒNG BÀI RIÊNG/);
});

// Buổi coach nhận được 2026-10-19 (ảnh): qua kiểm cũ nhưng sai mẫu — 2 trạm, chạy tách khỏi trạm, ~39'/60'.
const SHOT = { label: 'Compromised — Treadmill & Station Intervals', focus: 'x', phases: [
  { name: 'Warm-up', tag: 'warmup', exercises: [ex('Running (Treadmill)', '1 × 8 mins')] },
  { name: 'Main', tag: 'strength', exercises: [ex('Med Ball Squat + Wall Throw', '1 × 6 mins')] },
  { name: 'Accessory', tag: 'accessories', exercises: [ex('Running (Treadmill)', '4 × 5 mins'), ex("Farmer's Carry (Dumbbell)", '4 × 1 min')] },
  { name: 'Circuit', tag: 'circuit', exercises: [ex('Med Ball Squat + Wall Throw', '1 × 3 mins')] }] };
// Mẫu trong GROUP_METHOD.
const GOLD = { label: 'Compromised — Run + SkiErg / Wall Ball / Sled', focus: 'x', phases: [
  { name: "Khởi động (10')", tag: 'warmup', exercises: [ex('Row nhẹ', '1 × 4 phút'), ex("World's Greatest Stretch", '1 × 5/bên'), ex('Air Squat + Reverse Lunge', '2 × 10')] },
  { name: "Kỹ thuật — Sled Push (8')", tag: 'strength', exercises: [ex('Sled Push', '4 × 1 phút')] },
  { name: "Khối chính — 5 vòng: chạy 3' → trạm 2' (30')", tag: 'circuit', exercises: [ex('Run', '5 × 3 phút'), ex('SkiErg', '3 × 250m'), ex('Wall Ball', '2 × 20')] },
  { name: "Finisher — EMOM 7'", tag: 'circuit', exercises: [ex('Burpee Broad Jump', '7 × 6')] }] };

test('buoi trong anh coach gui bi chan dung 3 loi; buoi mau trong prompt qua het', () => {
  const bad = C.checkProgram({ SessionA: SHOT }, { isGroup: true, groupFormat: 'hyrox', minutes: 60 });
  const ks = bad.errors.map((e) => e.k.split(':')[0]).sort();
  assert.deepStrictEqual(ks, ['mix', 'short', 'st']);
  assert.ok(C.estimateMinutes(SHOT) >= 35 && C.estimateMinutes(SHOT) <= 45, 'bai theo phut trong pha strength/accessories tinh theo gio: ' + C.estimateMinutes(SHOT));
  const good = C.checkProgram({ SessionA: GOLD }, { isGroup: true, groupFormat: 'hyrox', minutes: 60 });
  assert.deepStrictEqual(good.errors, [], JSON.stringify(good.errors));
  assert.ok(C.estimateMinutes(GOLD) >= 50);
  assert.deepStrictEqual([...C.stationKeys(GOLD)].sort(), ['bbj', 'sledpush', 'ski', 'wallball'].sort());
  assert.match(A.GROUP_METHOD, /MẪU MỘT BUỔI COMPROMISED 60'/);
});
