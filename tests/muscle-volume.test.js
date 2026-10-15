/**
 * Volume theo nhóm cơ + luật thư viện (rà lại 2026-10-15, docs/library-rules.md).
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const s = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const sl = (a, b) => s.slice(s.indexOf(a), s.indexOf(b, s.indexOf(a)));
const app = new Function('parsePrescription',
  sl('var CD_MUSCLE_MAP', 'var CD_REGION_VI') + sl('function cdFold', 'function cdT')
  + sl('var _cdMapMemo', 'function cdSessions').replace(/console\.warn\([^;]*\);/g, '')
  + sl('const MUSCLE_WEIGHTS', 'const phaseTagClass')
  + '; return { canonMuscle, muscleSetsForDay, MUSCLE_WEIGHTS, sessionMuscleSets };')(
  (x) => ({ sets: parseInt(String(x), 10) || 1 }));

test('trong so: P=1, S=0.5 (fractional, Pelland 2025), T=0', () => {
  assert.deepStrictEqual([app.MUSCLE_WEIGHTS.P, app.MUSCLE_WEIGHTS.S, app.MUSCLE_WEIGHTS.T], [1, 0.5, 0]);
});

test('ten nhom co chuan hoa: hai bo ten cua thu vien gop lam mot', () => {
  for (const [a, b] of [['GLUTES', 'Glutes'], ['LAT', 'Lats'], ['Latissimus Dorsi', 'Lats'], ['HAMSTRING', 'Hamstrings'],
    ['TRAP', 'Traps'], ['CALF', 'Calves'], ['Rear Deltoid', 'Rear Delts'], ['DELTOID', 'Deltoids'], ['ABDOMINALS', 'Abs']]) {
    assert.strictEqual(app.canonMuscle(a), b, a);
  }
  assert.strictEqual(app.canonMuscle('Mid/Lower Traps'), 'Mid/Lower Traps', 'ten chuan phai map nguoc ve chinh no');
});

test('set theo nhom co: bo warmup VA circuit, T khong cong, gop ten', () => {
  const day = { phases: [
    { name: 'Warm-up', tag: 'warmup', exercises: [{ setsReps: '2', muscles: { Glutes: 'P' } }] },
    { name: 'Main', tag: 'strength', exercises: [
      { setsReps: '4', muscles: { CHEST: 'P', TRICEPS: 'S', 'Rear Deltoid': 'T' } },
      { setsReps: '3', muscles: { GLUTES: 'P' } }, { setsReps: '2', muscles: { Glutes: 'S' } }] },
    { name: 'Finisher', tag: 'circuit', exercises: [{ setsReps: '8', muscles: { QUADS: 'P' } }] }] };
  assert.deepStrictEqual(app.muscleSetsForDay(day, () => true), { Chest: 4, Triceps: 2, Glutes: 4 });
});

test('buoi cu luu "GLUTES" + "Glutes" -> mot dong', () => {
  assert.deepStrictEqual(app.sessionMuscleSets({ muscleUnit: 'sets', volumeByMuscle: { GLUTES: 3, Glutes: 1.5, LAT: 2 } }), { Glutes: 4.5, Lats: 2 });
});

test('hinh co the: nhom co nhieu vung thi chia deu, khong cong du vao tung vung', () => {
  assert.match(s, /var n = i\.m\.regions\.length; i\.m\.regions\.forEach\(function \(k\) \{ reg\[k\] = \(reg\[k\] \|\| 0\) \+ i\.v \/ n; \}\)/);
});

test('chuan hoa thu vien: DELTOID theo kieu bai, sua bai sai, khong de trong', () => {
  const { normalize } = require('../scripts/normalize-library.js');
  const n = (name, muscles) => normalize({ name, muscles }).muscles;
  assert.deepStrictEqual(n('Barbell Bench Press', { CHEST: 'P', DELTOID: 'S', TRICEPS: 'S' }), { Chest: 'P', 'Front Delts': 'S', Triceps: 'S' });
  assert.deepStrictEqual(n('Shoulder Press (Dumbbell)', { DELTOID: 'P' }), { 'Front Delts': 'P', 'Side Delts': 'S' });
  assert.deepStrictEqual(n('Lateral Raise (Dumbbell)', { DELTOID: 'P' }), { 'Side Delts': 'P' });
  assert.deepStrictEqual(n('Rear Delt Fly (Dumbbell)', { DELTOID: 'P' }), { 'Rear Delts': 'P' });
  assert.deepStrictEqual(n('Slam (Battle Rope)', { DELTOID: 'P', LAT: 'S' }), { 'Front Delts': 'P', Lats: 'S' });
  assert.deepStrictEqual(n('Back Extension (Machine)', { ABDOMINALS: 'P' }), { 'Erector Spinae': 'P', Glutes: 'S', Hamstrings: 'S' });
  assert.ok(Object.keys(n('Bird Dog (Bodyweight)', {})).length, 'bai trong phai duoc dien');
  assert.deepStrictEqual(n('X', { QUADS: 'Q' }), { Quads: 'T' }, 'Q -> T');
});
