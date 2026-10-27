/**
 * Pulse hỏng toàn bộ 2026-10-27: Gemini 3 trả 400 "Request contains an invalid argument" ở lượt thứ hai vì code chỉ
 * gửi lại function_call, bỏ bước thought có chữ ký. Kèm: schema giáo án đầy đủ, trạm HYROX ngoài thư viện, nhấc tham
 * số Gemini nhét nhầm vào program.
 */
const test = require('node:test');
const assert = require('node:assert');
const A = require('../functions/assistant.js');

test('luot sau gui lai DU cac buoc cua luot truoc (thought co chu ky + function_call)', async () => {
  const seen = [];
  let turn = 0;
  const client = { interactions: { create: async (req) => {
    seen.push(JSON.parse(JSON.stringify(req.input)));
    turn++;
    if (turn === 1) return { steps: [{ type: 'thought', signature: 'SIG123' }, { type: 'function_call', id: 'c1', name: 'search_exercises', arguments: { query: 'row' } }] };
    return { steps: [], output_text: 'xong' };
  } } };
  const r = await A.runAssistant({ client, model: 'm', messages: [{ role: 'user', text: 'tra bài row' }], role: { coach: true, admin: true, uid: 'u' } });
  assert.strictEqual(r.text, 'xong');
  const second = seen[1];
  const th = second.find((x) => x.type === 'thought');
  assert.ok(th && th.signature === 'SIG123', 'thieu buoc thought co chu ky -> Gemini 400');
  assert.ok(second.findIndex((x) => x.type === 'thought') < second.findIndex((x) => x.type === 'function_call'), 'giu dung thu tu');
  assert.ok(second.some((x) => x.type === 'function_result' && x.call_id === 'c1'));
});

test('schema giao an day du: SessionA..G, phases co tag enum, bai co name + setsReps', () => {
  const p = A.TOOLS.find((t) => t.name === 'propose_program').parameters.properties.program;
  assert.deepStrictEqual(Object.keys(p.properties), ['SessionA', 'SessionB', 'SessionC', 'SessionD', 'SessionE', 'SessionF', 'SessionG']);
  const ph = p.properties.SessionA.properties.phases.items;
  assert.deepStrictEqual(ph.properties.tag.enum, ['warmup', 'strength', 'accessories', 'circuit']);
  assert.deepStrictEqual(ph.properties.exercises.items.required, ['name', 'setsReps']);
  const pn = A.TOOLS.find((t) => t.name === 'propose_new_client').parameters.properties.program;
  assert.ok(pn.properties.SessionA, 'propose_new_client dung cung schema');
});

test('nhac tham so Gemini nhet nham vao program ra ngoai; khoa buoi sai that van giu de bi chan', () => {
  const a = { program: { SessionA: { phases: [] }, sessionMinutes: 60, sessionsPerWeek: 2, Mon: { phases: [] } } };
  A.liftProgramParams(a);
  assert.strictEqual(a.sessionMinutes, 60);
  assert.strictEqual(a.sessionsPerWeek, 2);
  assert.deepStrictEqual(Object.keys(a.program).sort(), ['Mon', 'SessionA']);
  const b = { sessionMinutes: 45, program: { SessionA: {}, sessionMinutes: 90 } };
  A.liftProgramParams(b);
  assert.strictEqual(b.sessionMinutes, 45, 'tham so that cua tool duoc uu tien');
});
