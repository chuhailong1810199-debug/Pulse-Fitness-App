/**
 * Giáo án ↔ thư viện (functions/program-lib.js) + tag pha app/server khớp nhau.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const L = require('../functions/program-lib.js');

const LIB = [
  { name: 'Lateral Raise (Dumbbell)', tool: 'Dumbbell', muscles: { 'Lateral Deltoid': 'P' } },
  { name: 'Dumbbell Lateral Raise', tool: 'Dumbbell', muscles: { 'Lateral Deltoid': 'P' } },
  { name: 'Skull Crusher (Barbell)', tool: 'Barbell', muscles: { TRICEPS: 'P' } },
  { name: 'Skull Crusher (Ez Bar)', tool: 'Ez Bar', muscles: { TRICEPS: 'P' } },
  { name: 'Hip Thrust (Barbell)', tool: 'Barbell', muscles: { GLUTES: 'P' } },
  { name: 'Hip Thrust (Bodyweight)', tool: 'Bodyweight', muscles: { GLUTES: 'P', HAMSTRINGS: 'S' } },
  { name: 'Lat Pulldown', tool: 'Cable', muscles: { LATS: 'P' } },
  { name: 'Romanian Deadlift', tool: 'Barbell', muscles: { HAMSTRINGS: 'P', GLUTES: 'P' } },
  { name: 'Face Pull (Cable)', tool: 'Cable', muscles: { 'Rear Deltoid': 'P' } },
  { name: 'Facepull (Cable)', tool: 'Cable', muscles: { REAR_DELT: 'P' } },
  { name: 'Push Up (BW)', tool: 'Bodyweight', muscles: { CHEST: 'P' } },
];
const idx = L.buildLibIndex(LIB);
const m = (n) => L.matchExercise(n, idx);

test('khop ten: viet tat, cach/gach, thu tu dung cu, dung cu o truong tool', () => {
  assert.strictEqual(m('RDL').ex.name, 'Romanian Deadlift');
  assert.strictEqual(m('Lat pull-down').ex.name, 'Lat Pulldown');
  assert.strictEqual(m('Lat Pulldown (Cable)').ex.name, 'Lat Pulldown');
  assert.strictEqual(m('Cable Lat Pulldown').ex.name, 'Lat Pulldown');
  assert.strictEqual(m('Barbell Hip Thrust').ex.name, 'Hip Thrust (Barbell)');
  assert.strictEqual(m('push-up (bw)').ex.name, 'Push Up (BW)');
});
test('bai trung trong thu vien (cung dung cu + nhom co, hoac viet hai kieu) -> lay mot', () => {
  assert.ok(m('Lateral Raise').ex);
  assert.strictEqual(m('Face Pull (Cable)').ex.name, 'Face Pull (Cable)');
});
test('mo ho that ve dung cu -> ambiguous, kem muscles neu cung nhom co', () => {
  const r = m('Skull Crusher');
  assert.deepStrictEqual(r.ambiguous, ['Skull Crusher (Barbell)', 'Skull Crusher (Ez Bar)']);
  assert.deepStrictEqual(r.muscles, { TRICEPS: 'P' });
  assert.strictEqual(m('Hip Thrust').muscles, null, 'khac nhom co -> khong gan bua');
});
test('khong khop -> goi y', () => {
  const r = m('Lat Pull Machine Thing');
  assert.ok(r.none && r.suggestions.includes('Lat Pulldown'));
});

const prog = { SessionA: { phases: [
  { name: '🔥 Warm-up', tag: 'Warm-up', exercises: [{ name: 'Cat-cow', setsReps: '1 × 10' }] },
  { name: 'Block 1 - Heavy', tag: 'main', exercises: [{ name: 'RDL', setsReps: '3 × 8' }, { name: 'Skull Crusher', setsReps: '3 × 10' }] },
  { name: 'Finisher', tag: 'finisher', exercises: [{ name: 'SkiErg', setsReps: '4 × 250m' }] },
] } };
test('resolve nghiem: doi ten + gan muscles + tag; bai mo ho o pha chinh la loi; warmup/circuit tu do', () => {
  const r = L.resolveProgram(prog, idx);
  const ph = r.program.SessionA.phases;
  assert.deepStrictEqual(ph.map((p) => p.tag), ['warmup', 'strength', 'circuit']);
  assert.strictEqual(ph[1].exercises[0].name, 'Romanian Deadlift');
  assert.deepStrictEqual(ph[1].exercises[0].muscles, { HAMSTRINGS: 'P', GLUTES: 'P' });
  assert.strictEqual(r.errors.length, 1);
  assert.match(r.errors[0], /Skull Crusher.*nhiều bản/);
});
test('keepNames: bai cu giu ten, khong bao loi', () => {
  const r = L.resolveProgram(prog, idx, { keepNames: new Set(['RDL', 'Skull Crusher']) });
  assert.strictEqual(r.errors.length, 0);
  assert.strictEqual(r.program.SessionA.phases[1].exercises[0].name, 'RDL');
  assert.ok(r.program.SessionA.phases[1].exercises[0].muscles, 'van gan muscles');
});
test('backfill (khong nghiem): khong doi ten, khong bat bw, mo ho cung nhom co van gan', () => {
  const p2 = { SessionA: { phases: [{ name: 'Main', tag: 'strength', exercises: [{ name: 'Skull Crusher', setsReps: '3 × 10' }, { name: 'Push-up', setsReps: '3 × 10' }] }] } };
  const r = L.resolveProgram(p2, idx, { strict: false, rename: false, setBw: false });
  const ex = r.program.SessionA.phases[0].exercises;
  assert.deepStrictEqual(ex[0].muscles, { TRICEPS: 'P' });
  assert.strictEqual(ex[1].name, 'Push-up');
  assert.strictEqual(ex[1].bw, undefined);
  assert.strictEqual(r.errors.length, 0);
});

test('tag pha: app (index.html) va server (program-lib) cho cung ket qua', () => {
  const s = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const a = s.indexOf('const PHASE_TAGS'), b = s.indexOf('function isWarmupPhase', a);
  const appNorm = new Function(s.slice(a, b) + '; return normPhaseTag;')();
  const cases = [['🔥 Warm-up', 'warmup'], ['Warm-up', 'Warm-up'], ['Rehab', 'warmup'], ['Block 1 - Heavy', 'main'],
    ['Block 3 - Isolation', 'isolation'], ['Finisher', 'finisher'], ['Circuit', 'Conditioning'], ['⚡ Core', 'core'],
    ['💪 Strength', 'strength'], ['03 — Mobility Cooldown', 'accessories'], ['04 — Mobility Cooldown', 'core'],
    ['⚡ WOD — 8 ROUNDS', 'circuit'], ['Khởi động', ''], ['Bài chính', ''], ['🏃 LISS Cardio', 'accessories'], ['', '']];
  for (const [name, tag] of cases) {
    const want = L.normalizePhaseTag({ name, tag });
    assert.strictEqual(appNorm({ name, tag }), want, name + '|' + tag);
    assert.ok(L.PHASE_TAGS.includes(want));
  }
  assert.strictEqual(L.normalizePhaseTag({ name: 'Block 1 - Heavy', tag: 'main' }), 'strength');
  assert.strictEqual(L.normalizePhaseTag({ name: 'Finisher', tag: 'finisher' }), 'circuit');
  assert.strictEqual(L.normalizePhaseTag({ name: '⚡ Core', tag: 'core' }), 'accessories');
});

test('o chon tag khi them pha chi con 4 gia tri chuan', () => {
  const s = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const sel = s.slice(s.indexOf('id="new-phase-tag"'), s.indexOf('</select>', s.indexOf('id="new-phase-tag"')));
  assert.deepStrictEqual([...sel.matchAll(/value="(\w+)"/g)].map((x) => x[1]), L.PHASE_TAGS);
});
