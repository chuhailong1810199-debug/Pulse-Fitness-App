/**
 * Đẩy giáo án mới: ô tạ điền sẵn chuyển THEO TÊN BÀI, không theo vị trí.
 * (Sang 2026-10-13: nếu không, RDL 45 kg rơi vào ô Incline Press cùng vị trí.)
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { remapSessionLoads } = require('../functions/session-loads.js');

const P = (day, ...phases) => ({ [day]: { phases: phases.map((ex) => ({ name: 'p', exercises: ex.map((name) => ({ name, setsReps: '3 × 8' })) })) } });

test('bai giu lai mang ta theo du doi vi tri; bai moi de trong; vi tri cu khong lan sang', () => {
  const oldP = P('SessionA', ['Warm'], ['Goblet Squat', 'Romanian Deadlift (Dumbbell)']);
  const newP = P('SessionA', ['Warm'], ['Incline DB Press', 'Goblet Squat']);
  const oldDocs = { SessionA: { exerciseLoads: { c_SessionA_1_0: 20, c_SessionA_1_1: 45 }, setLoads: { c_SessionA_1_0: [20, 20, 20], c_SessionA_1_1: [40, 45, 45] } } };
  const { docs, carried } = remapSessionLoads('c', oldP, newP, oldDocs);
  const d = docs.SessionA;
  assert.strictEqual(d.exerciseLoads.c_SessionA_1_0, null, 'Incline (moi) KHONG duoc nhan 20 kg cua Goblet');
  assert.deepStrictEqual(d.setLoads.c_SessionA_1_0, []);
  assert.strictEqual(d.exerciseLoads.c_SessionA_1_1, 20, 'Goblet doi cho van mang 20 kg');
  assert.deepStrictEqual(d.setLoads.c_SessionA_1_1, [20, 20, 20]);
  assert.ok('c_SessionA_0_0' in d.exerciseLoads, 'moi vi tri deu co khoa de de so cu tren may');
  assert.deepStrictEqual(carried, ['Goblet Squat']);
});

test('bai chuyen sang buoi khac van mang ta; ten khac hoa/thuong/khoang trang van khop', () => {
  const oldP = P('SessionA', ['Lat Pulldown']);
  const newP = { ...P('SessionA', ['Squat']), ...P('SessionB', ['lat  pulldown']) };
  const { docs } = remapSessionLoads('c', oldP, newP, { SessionA: { exerciseLoads: { c_SessionA_0_0: 22.5 }, setLoads: {} } });
  assert.strictEqual(docs.SessionB.exerciseLoads.c_SessionB_0_0, 22.5);
  assert.strictEqual(docs.SessionA.exerciseLoads.c_SessionA_0_0, null);
});

test('khoa la / o trong / sessionLoads khong co thi khong vo', () => {
  const r = remapSessionLoads('c', P('SessionA', ['X']), P('SessionA', ['X']), { SessionA: { exerciseLoads: { c_SessionA_9_9: 50, c_SessionA_0_0: 0 } } });
  assert.strictEqual(r.docs.SessionA.exerciseLoads.c_SessionA_0_0, null);
  assert.deepStrictEqual(remapSessionLoads('c', {}, P('SessionA', ['X']), {}).carried, []);
});

test('coachApply ghi giao an + o ta trong CUNG mot batch; app nap lai khi bo cuc doi', () => {
  const f = fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8');
  const blk = f.slice(f.indexOf('if (act.kind === "apply_program")'), f.indexOf('if (act.kind === "create_client")'));
  assert.match(blk, /remapSessionLoads\(/);
  assert.match(blk, /batch\.update\(ref, \{ program: act\.program \}\)/);
  assert.match(blk, /batch\.set\(ref\.collection\("sessionLoads"\)\.doc\(day\)/);
  assert.ok(!/await ref\.update\(\{ program/.test(blk), 'khong ghi giao an rieng le ngoai batch');
  const s = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.match(s, /if \(dayChanged \|\| layoutChanged\) \{\s*clearTimeout\(_saveLoadsFBTimer\);\s*hydrateExerciseLoadsForActiveDay\(\)/);
  assert.match(s, /await hydrateExerciseLoadsForActiveDay\(\);\s*renderExercises\(\);/);
});
