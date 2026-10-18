/**
 * Khung phương pháp được kiểm bằng CODE (2026-10-19): volume theo trình độ, đủ mẫu chuyển động,
 * thời lượng buổi, ngoại lệ có lý do, và chỉ chặn lỗi MỚI khi sửa vài buổi.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const C = require('../functions/program-check.js');

const ex = (name, setsReps, muscles) => ({ name, setsReps, muscles });
const day = (phases) => ({ label: 'x', focus: 'f', phases });
const ph = (tag, exercises, name) => ({ name: name || tag, tag, exercises });
// Một tuần toàn thân đủ 8 mẫu, volume vừa Beginner.
const FULL = {
  SessionA: day([ph('warmup', [ex('Jumping Jacks', '2 phút')]),
    ph('strength', [ex('Goblet Squat (Dumbbell)', '3 × 10', { Quads: 'P', Glutes: 'S' }), ex('Push Up', '3 × 8', { Chest: 'P', Triceps: 'S' })]),
    ph('accessories', [ex('Lat Pulldown (Cable)', '3 × 10', { Lats: 'P', Biceps: 'S' }), ex('Dead Bug', '3 × 8/bên', { Abs: 'P' })])]),
  SessionB: day([ph('strength', [ex('Romanian Deadlift (Dumbbell)', '3 × 8', { Hamstrings: 'P', Glutes: 'P' }), ex('Shoulder Press (Dumbbell)', '3 × 10', { 'Front Delts': 'P' })]),
    ph('accessories', [ex('Seated Cable Row', '3 × 10', { Lats: 'P', Rhomboids: 'S' }), ex("Farmer's Carry (Dumbbell)", '3 × 30s', { Forearms: 'P' })])]),
};

test('dem set giong app: bo warmup/circuit, chinh 1, phu 0.5; gop ten cu "GLUTES"/"Glutes"', () => {
  const p = { SessionA: day([ph('warmup', [ex('Bridge', '3 × 10', { Glutes: 'P' })]),
    ph('strength', [ex('Hip Thrust', '4 × 8', { GLUTES: 'P', HAMSTRING: 'S' })]),
    ph('accessories', [ex('Kickback', '3 × 12', { Glutes: 'P' })]),
    ph('circuit', [ex('Swing', '5 × 15', { Glutes: 'P' })])]) };
  const { totals } = C.muscleSets(p);
  assert.strictEqual(totals.Glutes, 7);
  assert.strictEqual(totals.Hamstrings, 2);
  assert.strictEqual(C.parseSets('4 vòng × 15'), 4);
  assert.strictEqual(C.parseSets('3 x 10/bên'), 3);
});

test('ten nhom co server khop canonMuscle cua app', () => {
  const s = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const sl = (a, b) => s.slice(s.indexOf(a), s.indexOf(b, s.indexOf(a)));
  const app = new Function(sl('var CD_MUSCLE_MAP', 'var CD_REGION_VI') + sl('function cdFold', 'function cdT')
    + sl('var _cdMapMemo', 'function cdSessions').replace(/console\.warn\([^;]*\);/g, '')
    + sl('const MUSCLE_CANON_LABEL', 'function isWarmupPhase') + '; return canonMuscle;')();
  for (const n of ['GLUTES', 'HAMSTRING', 'Latissimus Dorsi', 'LAT', 'DELTOID', 'Rear Deltoid', 'Anterior Deltoid',
    'Lateral Deltoid', 'ABDOMINALS', 'QUADS', 'TRAP', 'Lower Traps', 'ADDUCTOR', 'CHEST', 'Glutes', 'Front Delts', 'Erector Spinae']) {
    assert.strictEqual(C.canonMuscle(n), app(n), n);
  }
});

test('1. volume vuot tran trinh do bi chan; coach chu y thi ghi ngoai le co ly do', () => {
  const heavy = { SessionA: day([ph('strength', [ex('Hip Thrust', '5 × 8', { Glutes: 'P' }), ex('RDL', '4 × 8', { Glutes: 'P' })])]),
    SessionB: day([ph('strength', [ex('Hip Thrust', '5 × 8', { Glutes: 'P' })])]) };   // 14 set Glutes
  const r = C.volumeIssues(heavy, 'Beginner');
  assert.ok(r.errors.some((e) => e.k === 'vol:Glutes'));
  assert.strictEqual(C.volumeIssues(heavy, 'Advanced').errors.length, 0, 'Advanced 14–20 thi 14 la hop le');
  const w = C.volumeIssues(heavy, 'Beginner', { Glutes: 'coach muốn ưu tiên mông' });
  assert.strictEqual(w.errors.filter((e) => e.k === 'vol:Glutes').length, 0);
  assert.match(w.waived[0], /ưu tiên mông/);
  // Trần mỗi buổi vẫn giữ dù có ngoại lệ tuần.
  const one = { SessionA: day([ph('strength', [ex('Hip Thrust', '6 × 8', { Glutes: 'P' }), ex('RDL', '6 × 8', { Glutes: 'P' })])]) };
  assert.ok(C.volumeIssues(one, 'Advanced', { Glutes: 'x' }).errors.some((e) => e.k === 'sess:SessionA:Glutes'));
});

test('2. thieu mau chuyen dong bi chan; may cardio ten "Row" khong tinh la keo; bo vi chan thuong phai ghi ly do', () => {
  assert.deepStrictEqual(C.coverageIssues(FULL).errors, []);
  const noVPush = JSON.parse(JSON.stringify(FULL)); noVPush.SessionB.phases[0].exercises.pop();
  assert.ok(C.coverageIssues(noVPush).errors.some((e) => e.k === 'cov:vpush'));
  assert.deepStrictEqual(C.coverageIssues(noVPush, { vpush: 'vai phải đang hồi phục' }).errors, []);
  const erg = { SessionA: day([ph('circuit', [ex('Row Intervals', '4 × 250m'), ex('Ski Erg Intervals', '3 × 200m')])]) };
  assert.ok(!C.patternsCovered(erg).has('hpull'));
});

test('4. buoi dai qua thoi luong bi chan; superset tinh nhanh hon', () => {
  const long = { SessionA: day([ph('strength', Array.from({ length: 8 }, (_, i) => ex('Bai ' + i, '4 × 8', {})))]) };   // 32 set ≈ 80'
  assert.ok(C.durationIssues(long, 45).errors.length === 1);
  assert.strictEqual(C.durationIssues(long, 90).errors.length, 0);
  assert.strictEqual(C.durationIssues(long, null).errors.length, 0, 'khong co thoi luong dich thi bo qua');
  const ss = day([ph('strength', [ex('A', '3 × 8'), ex('B', '3 × 8')], 'Block 1 — Superset')]);
  const plain = day([ph('strength', [ex('A', '3 × 8'), ex('B', '3 × 8')], 'Main')]);
  assert.ok(C.estimateMinutes(ss) < C.estimateMinutes(plain));
  assert.strictEqual(C.parseMinutes('60 phút'), 60);
});

test('sua vai buoi: loi co san o giao an cu khong chan, loi moi thi chan', () => {
  const before = [{ k: 'vol:Glutes', m: 'old' }];
  const r = C.newErrors([{ k: 'vol:Glutes', m: 'g' }, { k: 'cov:vpull', m: 'v' }], before);
  assert.deepStrictEqual(r.errors.map((e) => e.k), ['cov:vpull']);
  assert.deepStrictEqual(r.inherited, ['g']);
});

test('lop nhom: khong ap khung volume / mau chuyen dong 1-1', () => {
  const r = C.checkProgram({ SessionA: day([ph('circuit', [ex('Burpee', '8 vòng × 10')])]) }, { isGroup: true, level: 'Mixed' });
  assert.deepStrictEqual(r.errors, []);
});

test('3 + 5. form: nhac focus/why, truyen sessionMinutes, co kieu buoi mat do; khung co muc giam mo (b)', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const a = html.indexOf('function aiBuildProgramPrompt'), b = html.indexOf('function aiFormSend');
  const build = new Function('escHtml', html.slice(a, b) + '; return aiBuildProgramPrompt;')((x) => x);
  const r = build({ name: 'Minh', goal: 'giảm mỡ', level: 'Beginner', spw: '3', dur: '45 phút', style: 'density' });
  assert.match(r.prompt, /"focus"/);
  assert.match(r.prompt, /"why"/);
  assert.match(r.prompt, /sessionMinutes = 45/);
  assert.match(r.prompt, /3 block superset × 2 bài/);
  assert.match(html, /<select name="style">/);
  const A = require('../functions/assistant.js');
  assert.match(A.METHOD, /MẬT ĐỘ/);
  assert.match(A.METHOD, /SERVER TỰ KIỂM/);
});
