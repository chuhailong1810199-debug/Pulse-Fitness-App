/**
 * Lớp nhóm: MỖI LỆNH ĐÚNG 1 BUỔI + buổi soạn theo BLOCK có đồng hồ (2026-11-12).
 *
 * Coach chỉnh lớp liên tục — soạn cả tuần một lượt là phí công. Buổi mẫu: Strength + Interval 50'
 * (warm-up 5 → EMOM 12 → hồi phục 3 → A 9 → B superset 9 → C 8 → cool-down 4).
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const A = require('../functions/assistant.js');
const PC = require('../functions/program-check.js');
const s = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const slice = (a, b) => s.slice(s.indexOf(a), s.indexOf(b, s.indexOf(a)));

const SAMPLE = {
  label: 'Strength + Interval', focus: 'Interval đầu buổi, tạ RPE 7.', durationMin: 50, level: 'Phổ thông',
  coachNotes: ['Hồi đủ nhịp sau interval rồi mới vào block A.', 'Yếu cardio: EMOM còn 3 vòng hoặc 40s làm / 20s nghỉ.'],
  phases: [
    { name: 'Warm-up', tag: 'warmup', format: 'mobility', durationMin: 5, exercises: [{ name: 'Hip 90/90', setsReps: '1 vòng' }, { name: 'Row nhẹ', setsReps: '2 phút', intensity: 'RPE 4–5' }] },
    { name: 'Interval — EMOM 12', tag: 'circuit', format: 'emom', rounds: 4, durationMin: 12, exercises: [
      { name: 'Row', setsReps: '12–15 cal', minute: 1, intensity: 'RPE 8' }, { name: 'KB Swing', setsReps: '12', minute: 2 },
      { name: 'Mountain Climber', setsReps: '30s', minute: 3 }] },
    { name: 'Hồi phục', tag: 'warmup', format: 'recovery', durationMin: 3, exercises: [{ name: 'Đi bộ, uống nước', setsReps: '3 phút' }] },
    { name: 'A. Lower', tag: 'strength', format: 'straight', durationMin: 9, exercises: [{ name: 'Goblet Squat', setsReps: '4 × 6', intensity: 'RPE 7', rest: '75s', regression: 'Box Squat' }] },
    { name: 'B. Upper superset', tag: 'accessories', format: 'superset', durationMin: 9, exercises: [
      { name: 'DB Bench Press', setsReps: '3 × 8', group: 'B1', intensity: 'RPE 7', regression: 'Push-up' },
      { name: '1-arm DB Row', setsReps: '3 × 8/bên', group: 'B2', rest: '60s sau cặp' }] },
    { name: 'C. Posterior + carry', tag: 'accessories', format: 'superset', durationMin: 8, exercises: [
      { name: 'DB RDL', setsReps: '3 × 10', group: 'C1', tempo: '3-0-1' }, { name: 'Farmer Carry', setsReps: '3 × 30m', group: 'C2', rest: '60s' }] },
    { name: 'Cool-down', tag: 'warmup', format: 'mobility', durationMin: 4, exercises: [{ name: 'Hip flexor stretch', setsReps: '30s/bài' }] },
  ],
};
const clone = (x) => JSON.parse(JSON.stringify(x));

test('server: lop nhom moi lenh DUNG 1 buoi', () => {
  assert.strictEqual(A.groupOneSession({ SessionC: SAMPLE }), null);
  assert.match(A.groupOneSession({ SessionA: SAMPLE, SessionB: SAMPLE }), /ĐÚNG 1 buổi.*2 buổi \(SessionA, SessionB\)/);
  assert.match(A.GROUP_METHOD, /MỖI LỆNH ĐÚNG 1 BUỔI/);
});

test('buoi mau 50 phut qua kiem; tong block = do dai buoi', () => {
  const r = PC.checkProgram({ SessionA: SAMPLE }, { isGroup: true, requireBlocks: true, groupFormat: 'strength', minutes: 50 });
  assert.deepStrictEqual(r.errors, []);
  assert.strictEqual(r.est.SessionA, 50, 'phut tinh tu durationMin cac pha, khong uoc tinh');
});

test('lech tong / thieu phut / tạ ngay sau interval bi chan; RPE > 7 sau interval chi nhac', () => {
  const off = clone(SAMPLE); off.phases[3].durationMin = 20;
  assert.match(PC.blockIssues({ SessionA: off }, 50, true).errors[0].m, /tổng các block 61 phút, buổi 50 phút/);
  const miss = clone(SAMPLE); delete miss.phases[1].durationMin;
  assert.match(PC.blockIssues({ SessionA: miss }, 50, true).errors[0].m, /"Interval — EMOM 12" thiếu durationMin/);
  const noRec = clone(SAMPLE); noRec.phases.splice(2, 1); noRec.phases[0].durationMin = 8;
  assert.match(PC.blockIssues({ SessionA: noRec }, 50, true).errors[0].m, /chèn block recovery/);
  const hard = clone(SAMPLE); hard.phases[3].exercises[0].intensity = 'RPE 8–9';
  const h = PC.blockIssues({ SessionA: hard }, 50, true);
  assert.deepStrictEqual(h.errors, []);
  assert.match(h.warnings[0], /RPE 9 sau interval/);
  // Buổi cũ không soạn theo block: chỉ bị đòi phút khi đề xuất mới bắt buộc.
  const old = { phases: [{ name: 'Khởi động', tag: 'warmup', exercises: [{ name: 'x', setsReps: '1' }] }] };
  assert.deepStrictEqual(PC.blockIssues({ SessionA: old }, 50, false).errors, []);
  assert.strictEqual(PC.blockIssues({ SessionA: old }, 50, true).errors.length, 1);
});

test('compactProgram giu truong block (the duyet + get_program thay duoc), giao an cu khong phinh null', () => {
  const c = A.compactProgram({ SessionA: SAMPLE }).SessionA;
  assert.strictEqual(c.durationMin, 50);
  assert.strictEqual(c.coachNotes.length, 2);
  assert.deepStrictEqual([c.phases[1].format, c.phases[1].rounds, c.phases[1].durationMin], ['emom', 4, 12]);
  assert.deepStrictEqual(c.phases[4].exercises[1], { name: '1-arm DB Row', setsReps: '3 × 8/bên', why: null, group: 'B2', rest: '60s sau cặp' });
  const o = A.compactProgram({ SessionA: { label: 'x', phases: [{ name: 'p', tag: 'strength', exercises: [{ name: 'Squat', setsReps: '3 × 5' }] }] } }).SessionA;
  assert.deepStrictEqual(Object.keys(o.phases[0]), ['name', 'tag', 'exercises']);
  assert.deepStrictEqual(Object.keys(o.phases[0].exercises[0]), ['name', 'setsReps', 'why']);
});

test('app: buoi soan theo block GIU thu tu pha (interval dau buoi); buoi cu van xep theo tag', () => {
  const api = new Function('var activeClient = null; function T(x){return x}\n' + slice('const PHASE_TAGS', '\n// Whether a checkpoint')
    + '; return { sortPhases, blockPhaseMeta, exRest, blockTotals };')();
  assert.deepStrictEqual(api.sortPhases(SAMPLE.phases).map((p) => p.name), SAMPLE.phases.map((p) => p.name));
  const legacy = [{ name: 'C', tag: 'circuit' }, { name: 'S', tag: 'strength' }, { name: 'W', tag: 'warmup' }];
  assert.deepStrictEqual(api.sortPhases(legacy).map((p) => p.name), ['W', 'S', 'C']);
  assert.strictEqual(api.blockPhaseMeta(SAMPLE.phases[1]), "EMOM · 4 vòng · 12'");
  assert.strictEqual(api.blockPhaseMeta({ name: 'x', tag: 'weird' }), '', 'pha cu khong co gi them');
  assert.strictEqual(api.exRest({ rest: '75s' }), '75s');
  assert.strictEqual(api.exRest({ cue: 'Giữ lưng thẳng | nghỉ 90s' }), '90s', 'khong co rest thi doc tu cue');
  assert.deepStrictEqual(api.blockTotals(SAMPLE), { sum: 50, target: 50, missing: 0, off: false });
  assert.strictEqual(api.blockTotals({ durationMin: 50, phases: [{ durationMin: 30 }] }).off, true);
  assert.strictEqual(api.blockTotals({ phases: [{ name: 'x' }] }), null);
});

test('app: form lop dang mo -> 1 buoi, khoa trong ke tiep hoac lam lai dung khoa', () => {
  const api = new Function('escHtml', 'var _aiMode = "client", activeClient = null;' + slice('const _AI_GF_FORMATS', 'function aiFormOpen(')
    + '; return { aiBuildGroupPrompt, _aiGroupForm };')(String);
  const cls = { id: 'lop_sang', name: 'Lớp · Sáng', isGroup: true, groupFormat: 'strength', durationMin: 50, equipment: '10 KB',
    program: { SessionA: { label: 'Strength + Interval' }, SessionB: { label: 'Circuit' } } };
  const form = api._aiGroupForm(cls);
  assert.match(form, /name="cid" value="lop_sang"/);
  assert.match(form, /<option value="SessionC">Buổi mới \(Buổi C\)<\/option>/);
  assert.match(form, /Làm lại Buổi A · Strength \+ Interval/);
  const fresh = api.aiBuildGroupPrompt({ slot: 'SessionC', dur: '50 phút', stype: 'Strength + Interval' }, cls);
  assert.ok(!fresh.error, fresh.error);
  assert.match(fresh.prompt, /propose_program clientId "lop_sang" với program CHỈ có SessionC, sessionMinutes 50/);
  assert.match(fresh.prompt, /Tổng durationMin các pha = 50 phút/);
  assert.match(fresh.prompt, /10 KB/, 'dung cu lay tu ho so lop');
  const redo = api.aiBuildGroupPrompt({ slot: 'SessionA', notes: 'EMOM nặng quá, còn 3 vòng' }, cls);
  assert.match(redo.prompt, /SessionA — LÀM LẠI buổi đang có/);
  assert.match(redo.prompt, /EMOM nặng quá, còn 3 vòng/);
  const full = { ...cls, program: Object.fromEntries('ABCDEFG'.split('').map((x) => ['Session' + x, {}])) };
  assert.doesNotMatch(api._aiGroupForm(full), /Buổi mới/);
  assert.match(api.aiBuildGroupPrompt({ slot: '' }, full).error, /đủ 7 buổi/);
});
