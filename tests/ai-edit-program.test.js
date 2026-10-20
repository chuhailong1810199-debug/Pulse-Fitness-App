/**
 * Pulse sửa giáo án ĐANG CÓ như coach sửa tay (2026-10-20, giáo án Lee bầm đùi sau): đổi ít nhất, giữ tên + tạ,
 * bỏ / giữ + lưu ý / giữ nguyên, rehab theo loại chấn thương, mốc quay lại; thẻ duyệt hiện bỏ / thêm / giữ.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const A = require('../functions/assistant.js');
const { buildLibIndex } = require('../functions/program-lib.js');

test('khung SUA GIAO AN co trong prompt: doi it nhat, 3 nhom bai, rehab theo loai, moc quay lai, co do', () => {
  const m = A.EDIT_METHOD;
  assert.match(A.SYSTEM, /SỬA GIÁO ÁN ĐANG CÓ/);
  assert.match(m, /ĐỔI ÍT NHẤT CÓ THỂ/);
  assert.match(m, /BỎ:[\s\S]*GIỮ \+ LƯU Ý:[\s\S]*GIỮ NGUYÊN/);
  for (const t of ['Bầm / dập cơ', 'Căng / rách cơ', 'Đau gân', 'Đau khớp', 'Sau mổ']) assert.ok(m.includes(t), t);
  assert.match(m, /cốt hoá cơ/);
  assert.match(m, /MỐC QUAY LẠI/);
  assert.match(m, /CỜ ĐỎ/);
});

test('gan nhom co cho ten cu khong co trong thu vien: chi so tu dong tac, bo dung cu, gop so it/nhieu', () => {
  const lib = [
    { name: 'Close Grip Bench Press (Barbell)', muscles: { Chest: 'P', Triceps: 'S' } },
    { name: 'Barbell Overhead Press', muscles: { 'Front Delts': 'P' } },
    { name: 'Seated Biceps Curl (Dumbbell)', muscles: { Biceps: 'P' } },
    { name: 'Medium Stance Leg Press (Leg Press Machine)', muscles: { Quads: 'P', Glutes: 'S' } },
  ];
  const prog = { SessionA: { phases: [
    { name: 'Rehab', tag: 'warmup', exercises: [{ name: 'Isometric Hamstring Heel Dig', setsReps: '4 × 30s' }] },
    { name: 'B1', tag: 'strength', exercises: [
      { name: 'Barbell Bench Press (hoặc Dumbbell)', setsReps: '3 × 8' }, { name: 'Bicep Curl', setsReps: '3 × 12' },
      { name: 'Leg Press', setsReps: '4 × 8' }, { name: 'Bài lạ hoàn toàn', setsReps: '3 × 8' },
      { name: 'Cable Row', setsReps: '3 × 10' }] }] } };
  const old = { SessionA: { phases: [{ name: 'x', tag: 'strength', exercises: [{ name: 'Cable Row', muscles: { Lats: 'P' } }] }] } };
  const filled = A.fillMuscles(prog, old, buildLibIndex(lib));
  const ex = prog.SessionA.phases[1].exercises;
  assert.deepStrictEqual(ex[0].muscles, { Chest: 'P', Triceps: 'S' }, 'bench KHONG duoc khop overhead press');
  assert.deepStrictEqual(ex[1].muscles, { Biceps: 'P' });
  assert.deepStrictEqual(ex[2].muscles, { Quads: 'P', Glutes: 'S' });
  assert.strictEqual(ex[3].muscles, undefined, 'khong giong du thi khong doan');
  assert.deepStrictEqual(ex[4].muscles, { Lats: 'P' }, 'uu tien nhom co cua chinh bai do trong giao an cu');
  assert.strictEqual(prog.SessionA.phases[0].exercises[0].muscles, undefined, 'rehab/khoi dong khong gan');
  assert.strictEqual(filled.length, 3);
});

test('the duyet: bo / them / giu theo ten bai, bo qua khoi dong va rehab', () => {
  const ph = (tag, names) => ({ name: tag, tag, exercises: names.map((n) => ({ name: n, setsReps: '3 × 8' })) });
  const old = { SessionA: { phases: [ph('strength', ['RDL', 'Leg Curl', 'Bench Press']), ph('accessories', ['Face Pull'])] } };
  const neu = { SessionA: { phases: [ph('warmup', ['Isometric Heel Dig']), ph('strength', ['Leg Press', 'Bench Press']), ph('accessories', ['Face Pull'])] } };
  assert.deepStrictEqual(A.programDiff(old, neu), { removed: ['RDL', 'Leg Curl'], added: ['Leg Press'], kept: 2 });
});

test('form Sua giao an: bat buoc vung dau khi chan thuong; prompt di theo khung sua, rehab theo loai, doi so buoi', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const a = html.indexOf('const _AI_EF_REASONS'), b = html.indexOf('function aiFormOpen');
  const api = new Function('escHtml', 'getProgram', 'activeClient', html.slice(a, b) + '; return { aiBuildEditPrompt, _aiEditForm };')(
    (x) => x, () => ({ SessionA: {}, SessionB: {} }), { id: 'lee', name: 'Lee' });
  assert.ok(api.aiBuildEditPrompt({ reason: 'Chấn thương / đau' }, 'Lee', 2).error);
  const r = api.aiBuildEditPrompt({ reason: 'Chấn thương / đau', area: 'đùi sau', injury: 'Bầm / dập cơ (va chạm)', pain: '3', hurts: 'RDL', notes: 'thêm rehab' }, 'Lee', 2);
  assert.match(r.prompt, /SỬA GIÁO ÁN ĐANG CÓ/);
  assert.match(r.prompt, /Rehab đùi sau/);
  assert.match(r.prompt, /Bầm \/ dập cơ/);
  assert.match(r.prompt, /coverageExceptions/);
  assert.match(r.prompt, /SessionA, SessionB/);
  const fewer = api.aiBuildEditPrompt({ reason: 'Đổi số buổi / tuần', spw: '2' }, 'Đạo', 3);
  assert.match(fewer.prompt, /3 → 2 buổi[\s\S]*dropSessions/);
  assert.match(api._aiEditForm(), /name="injury"/);
  assert.match(html, /aiFormOpen\(\\'edit\\'\)/);
  assert.match(html, /_aiForm === 'edit'\) \{ log\.innerHTML = _aiEditForm\(\)/);
  assert.match(html, /rows\.push\(\['Bỏ', p\.diff\.removed/);
});
