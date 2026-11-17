// Nhập giáo án cũ từ Excel (2026-11-17): app đọc file → importProgramSheet (Gemini, KHÔNG ghi) → xem trước → coachApply.
const assert = require('assert'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const PI = require(path.join(root, 'functions', 'program-import.js'));
const { buildLibIndex, matchExercise, resolveProgram } = require(path.join(root, 'functions', 'program-lib.js'));
const { validateProgram } = require(path.join(root, 'functions', 'assistant.js'));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const idx = fs.readFileSync(path.join(root, 'functions', 'index.js'), 'utf8');

// 1. Chữ gửi model: bỏ dòng / cột trống, ghép ô bằng " | ", cắt ô dài, dừng ở trần ký tự.
const t = PI.sheetsToText([
  { name: 'Session A', rows: [['Exercise', '', 'Sets', 'Reps', ''], ['', '', '', '', ''], ['Back Squat', '', '4', '6-8', ''], ['Note: ' + 'x'.repeat(500), '', '', '', '']] },
  { name: 'Empty', rows: [['', ''], []] },
]);
assert.ok(t.text.includes('### Sheet: Session A') && t.text.includes('Back Squat | 4 | 6-8'), t.text);
assert.ok(!t.text.includes('Empty') && !t.truncated);
assert.ok(t.text.split('\n').every((l) => l.length <= PI.LIMITS.cell * PI.LIMITS.cols + 50));
const big = PI.sheetsToText([{ name: 'Big', rows: Array.from({ length: 300 }, (_, i) => ['Exercise ' + i, 'y'.repeat(230), 'z'.repeat(230)]) }]);
assert.ok(big.truncated && big.text.length <= PI.LIMITS.chars);
assert.ok(/CHÉP ĐÚNG/.test(PI.importPrompt('a.xlsx', 'x', false)) && /bị cắt/.test(PI.importPrompt('a.xlsx', 'x', true)));
assert.deepStrictEqual(PI.IMPORT_SCHEMA.properties.sessions.items.properties.phases.items.properties.tag.enum, ['warmup', 'strength', 'accessories', 'circuit']);

// 2. Kết quả model → giáo án SessionA…: bỏ phần rỗng, gộp load vào cue, khoá đúng định dạng app, qua validateProgram.
const parsed = { sessions: [
  { label: 'Lower', focus: 'Squat', phases: [
    { name: 'Warm-up', tag: 'warmup', exercises: [{ name: 'Leg swings', setsReps: '2 x 10' }] },
    { name: 'Main', tag: 'strength', exercises: [{ name: 'Back Squat', setsReps: '4 x 6-8', load: '80 kg', cue: 'Ngồi sâu' }, { name: '', setsReps: '3 x 5' }] },
    { name: 'Empty', tag: 'accessories', exercises: [] }] },
  { label: '', phases: [] },
  { label: 'Upper', phases: [{ name: 'Main', tag: 'weird', exercises: [{ name: 'Zorbo Press 3000', setsReps: '' }] }] },
], notes: ['Tuần 2–4 lặp lại, chỉ lấy tuần 1'] };
const { program, notes } = PI.toProgram(parsed);
assert.deepStrictEqual(Object.keys(program), ['SessionA', 'SessionB']);
assert.strictEqual(program.SessionA.focus, 'Squat');
assert.strictEqual(program.SessionA.phases.length, 2);
assert.strictEqual(program.SessionA.phases[1].exercises[0].cue, 'Ngồi sâu | Load: 80 kg');
assert.strictEqual(program.SessionB.phases[0].tag, 'accessories');
assert.strictEqual(program.SessionB.phases[0].exercises[0].setsReps, '1 x —');
assert.ok(validateProgram(program).ok, JSON.stringify(validateProgram(program).errors));
assert.strictEqual(notes[0], 'Tuần 2–4 lặp lại, chỉ lấy tuần 1');
const eight = PI.toProgram({ sessions: Array.from({ length: 9 }, (_, i) => ({ label: 'S' + i, phases: [{ name: 'M', tag: 'strength', exercises: [{ name: 'Squat', setsReps: '3 x 5' }] }] })) });
assert.strictEqual(Object.keys(eight.program).length, 7); assert.ok(/hơn 7 buổi/.test(eight.notes.join(' ')));

// 3. Khớp thư viện: bài khớp đổi tên + gắn cơ; bài lạ vẫn nhập (không nghiêm) nhưng được báo.
const lib = buildLibIndex([{ name: 'High Bar Squat (Barbell)', muscles: { Quads: 'P' }, tool: 'Barbell' }, { name: 'Back Squat (Barbell)', muscles: { Quads: 'P', Glutes: 'P' }, tool: 'Barbell' }]);
const r = resolveProgram(program, lib, { strict: false, setBw: false });
assert.strictEqual(r.errors.length, 0);
const sq = r.program.SessionA.phases[1].exercises[0];
assert.strictEqual(sq.name, 'Back Squat (Barbell)'); assert.ok(sq.muscles.Quads);
assert.deepStrictEqual(PI.unmatched(r.program, lib, matchExercise), ['SessionB · Zorbo Press 3000']);

// 4. Máy chủ: callable kiểm quyền coach của khách, không ghi Firestore, trả xem trước.
const fnSrc = idx.slice(idx.indexOf('exports.importProgramSheet'), idx.indexOf('exports.coachApply'));
assert.ok(/authz\.assertCanManage\(request, clientId, db\)/.test(fnSrc));
assert.ok(!/\.set\(|\.update\(|\.add\(|batch\(/.test(fnSrc), 'importProgramSheet không được ghi');
assert.ok(/strict: false/.test(fnSrc) && /callGemini\(/.test(fnSrc));

// 5. App: nút chỉ coach, đọc file trên máy (SheetJS cdnjs, giới hạn 5 MB), lưu qua coachApply (sao lưu bản cũ), chế độ thêm buổi.
assert.ok(/id="excel-imp-btn" style="display:none"/.test(html) && /xlBtn\.style\.display = ''/.test(html));
assert.ok(/cdnjs\.cloudflare\.com\/ajax\/libs\/xlsx\/0\.18\.5\/xlsx\.full\.min\.js/.test(html));
assert.ok(/XL_MAX_BYTES = 5 \* 1024 \* 1024/.test(html));
assert.ok(/httpsCallable\('importProgramSheet'/.test(html) && /kind: 'apply_program', clientId: cid, program, merge: add/.test(html));
assert.ok(/onclick="xlOpen\(\)">⇪ Nhập từ Excel/.test(html), 'màn giáo án trống có lối nhập Excel');
console.log('program-import ok');
