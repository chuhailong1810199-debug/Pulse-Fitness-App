/**
 * Trợ lý hết lượt khi soạn giáo án dài (2026-10-16): coach nhờ soạn lại giáo án Anh Đạo
 * (5 buổi × 3 block × 2 bài) → "Câu này cần tra nhiều hơn mức cho phép", mất cả bản nháp.
 * Ba nguyên nhân: tra thư viện khớp cả chuỗi (ra rỗng, model tra lại mãi), propose_program
 * báo lỗi từng đợt (12 lỗi tên, rồi mới tới why/focus), và trần 8 vòng.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path'), Mod = require('module');

// Nạp assistant.js kèm execTool (thân tool, không gác quyền) để chạy với db giả.
const fn = path.join(__dirname, '..', 'functions', 'assistant.js');
const m = new Mod(fn); m.filename = fn; m.paths = Mod._nodeModulePaths(path.dirname(fn));
m._compile(fs.readFileSync(fn, 'utf8') + '\nmodule.exports.execTool = execTool;', fn);
const A = m.exports;

const LIB = [
  { id: 'e1', name: 'Swing (Kettlebell)', tool: 'Kettlebell', muscles: { Glutes: 'P', Hamstrings: 'S' } },
  { id: 'e2', name: "Farmer's Carry (Dumbbell)", tool: 'Dumbbell', muscles: { Forearms: 'P' } },
  { id: 'e3', name: 'Goblet Squat (Dumbbell)', tool: 'Dumbbell', muscles: { Quads: 'P', Glutes: 'S' } },
  { id: 'e4', name: 'Narrow Stance Zercher Good Morning (Barbell)', tool: 'Barbell', muscles: { Hamstrings: 'P' } },
  { id: 'e5', name: 'Narrow Push Up (BW)', tool: 'Bodyweight', muscles: { Chest: 'P', Triceps: 'S' } },
  { id: 'e6', name: 'Walking Lunge (Bodyweight)', tool: 'Bodyweight', muscles: { Quads: 'P', Glutes: 'S' } },
  { id: 'e7', name: 'Walking Lunge (Dumbbell)', tool: 'Dumbbell', muscles: { Quads: 'P', Glutes: 'P' } },
  // Đủ 8 mẫu chuyển động cho ca kiểm khung (thư viện được cache trong một lần chạy).
  { id: 'e8', name: 'Romanian Deadlift (Dumbbell)', tool: 'Dumbbell', muscles: { Hamstrings: 'P', Glutes: 'P' } },
  { id: 'e9', name: 'Shoulder Press (Dumbbell)', tool: 'Dumbbell', muscles: { 'Front Delts': 'P' } },
  { id: 'e10', name: 'Seated Row (Cable)', tool: 'Cable', muscles: { Lats: 'P' } },
  { id: 'e11', name: 'Lat Pulldown (Cable)', tool: 'Cable', muscles: { Lats: 'P' } },
  { id: 'e12', name: 'Plank (Bodyweight)', tool: 'Bodyweight', muscles: { Abs: 'P' } },
  { id: 'e13', name: 'Hip Thrust (Barbell)', tool: 'Barbell', muscles: { Glutes: 'P' } },
];
const db = { collection: (n) => ({
  doc: (id) => ({ get: async () => ({ exists: n === 'clients' && id === 'dao', id,
    data: () => ({ name: 'Anh Đạo', program: {} }) }) }),
  get: async () => ({ empty: false, docs: (n === 'exercises' ? LIB : []).map((x) => ({ id: x.id, data: () => x })) }),
}) };
const ROLE = { coach: true, admin: true, uid: 'u' };

test('tra thu vien khop theo tu: thu tu dao, viet tat, so nhieu; khong khop nham giua chuoi', () => {
  const f = (q) => LIB.filter((v) => A.exerciseHit(v, q)).map((v) => v.name);
  assert.deepStrictEqual(f('kettlebell swing'), ['Swing (Kettlebell)']);
  assert.deepStrictEqual(f('kb swing'), ['Swing (Kettlebell)']);
  assert.deepStrictEqual(f('farmer carry'), ["Farmer's Carry (Dumbbell)"]);
  assert.deepStrictEqual(f('pushup'), ['Narrow Push Up (BW)']);
  assert.strictEqual(f('walking lunges').length, 2);
  assert.deepStrictEqual(f('row erg'), [], 'khong duoc khop "naRROW ... zERcher Good morning"');
});

test('search_exercises nhan nhieu ten mot lan, ten khong co thi kem goi y', async () => {
  const r = await A.execTool(db, 'search_exercises', { queries: ['kettlebell swing', 'goblet squat', 'sled push'] }, ROLE, {});
  assert.strictEqual(r.results.length, 3);
  assert.deepStrictEqual(r.results[0].exercises, ['Swing (Kettlebell)']);
  assert.deepStrictEqual(r.results[1].exercises, ['Goblet Squat (Dumbbell)']);
  assert.strictEqual(r.results[2].empty, true);
  assert.ok(Array.isArray(r.results[2].closest));
});

test('propose_program bao MOI loi mot lan: ten bai lan why/focus, khong cat o 12', async () => {
  const day = (k) => ({ label: k, phases: [{ name: 'Block 1', tag: 'strength', exercises:
    [1, 2, 3, 4, 5, 6, 7].map((i) => ({ name: 'Bai La ' + k + i, setsReps: '3 × 10' })) }] });
  const prog = { SessionA: day('A'), SessionB: day('B') };   // 14 bài lạ + thiếu focus
  const ctx = { read: { 'get_client:dao': true, 'get_exercise_loads:dao': true } };
  const r = await A.execTool(db, 'propose_program', { clientId: 'dao', program: prog }, ROLE, ctx);
  assert.strictEqual(r.rejected, true);
  assert.strictEqual(r.errors.filter((e) => /không có trong thư viện/.test(e)).length, 14, 'thieu loi ten bai');
  assert.ok(r.errors.some((e) => /thiếu "focus"/.test(e)), 'loi focus phai bao cung luot');
});

const fake = (turns) => { let i = 0; return { interactions: { create: async () => {
  const s = turns[Math.min(i++, turns.length - 1)];
  return { steps: (s.calls || []).map((c, k) => ({ type: 'function_call', id: 'c' + i + k, name: c.name, arguments: c.args || {} })),
    output_text: s.text || '' };
} } }; };

test('soan giao an duoc nhieu vong hon hoi dap', async () => {
  const msg = (t) => [{ role: 'user', text: t }];
  const loop = [{ calls: [{ name: 'list_clients' }] }];
  const q = await A.runAssistant({ client: fake(loop), model: 'm', messages: msg('khách nào lâu chưa tập'), role: ROLE });
  assert.strictEqual(q.steps, A.MAX_STEPS);
  const d = await A.runAssistant({ client: fake(loop), model: 'm', messages: msg('design lại giáo án của anh Đạo'), role: ROLE });
  assert.strictEqual(d.steps, A.MAX_STEPS_DESIGN);
  assert.ok(A.MAX_STEPS_DESIGN > A.MAX_STEPS);
});

test('het thoi gian thi dung, khong de ham nen chet o 180 giay', async () => {
  const slow = { interactions: { create: async () => { await new Promise((r) => setTimeout(r, 30));
    return { steps: [{ type: 'function_call', id: 'x', name: 'list_clients', arguments: {} }], output_text: '' }; } } };
  const r = await A.runAssistant({ client: slow, model: 'm', messages: [{ role: 'user', text: 'soạn giáo án' }], role: ROLE, timeBudgetMs: 50 });
  assert.ok(r.hitLimit);
  assert.ok(r.steps < A.MAX_STEPS_DESIGN, 'chay ' + r.steps + ' vong du da het gio');
  assert.ok(A.TIME_BUDGET_MS + A.HARD_STOP_MS < 300000);
});

// ── Đẩy nhầm khách (2026-10-16): đang mở Anh Đạo, hỏi "giáo án của anh đạo", model đề xuất
// vào hồ sơ Long Chu, coach bấm đồng ý → giáo án của chính coach bị ghi đè.
test('propose_program tu choi de xuat vao khach khong duoc hoi toi', async () => {
  const people = { dao: { name: 'Anh Đạo', program: {} }, longchu: { name: 'Long Chu', program: {} } };
  const db2 = { collection: (n) => ({
    doc: (id) => ({ get: async () => ({ exists: n === 'clients' && !!people[id], id, data: () => people[id] }) }),
    get: async () => ({ empty: false, docs: (n === 'exercises' ? LIB : []).map((x) => ({ id: x.id, data: () => x })) }),
  }) };
  const prog = { SessionA: { label: 'A', focus: 'x', phases: [{ name: 'Main', tag: 'strength',
    exercises: [{ name: 'Goblet Squat (Dumbbell)', setsReps: '3 × 10', why: 'y' }] }] } };
  const read = { 'get_client:longchu': true, 'get_exercise_loads:longchu': true, 'get_client:dao': true, 'get_exercise_loads:dao': true };
  const ask = 'tao muốn design lại giáo án của anh đạo, gồm 3 block mỗi session';
  const bad = await A.execTool(db2, 'propose_program', { clientId: 'longchu', program: prog }, ROLE,
    { read, openClientId: 'dao', userText: ask });
  assert.strictEqual(bad.rejected, true, 'phai chan: hoi Anh Dao ma ghi vao Long Chu');
  // Ca này chỉ kiểm khách đích — miễn các mẫu chuyển động để giáo án một bài vẫn qua phần khung.
  const allEx = Object.fromEntries(require('../functions/program-check.js').PATTERN_KEYS.map((k) => [k, 'test']));
  const good = await A.execTool(db2, 'propose_program', { clientId: 'dao', program: prog, coverageExceptions: allEx }, ROLE,
    { read, openClientId: 'dao', userText: ask });
  assert.strictEqual(good.needsConfirm, true, JSON.stringify(good.errors));
  // Khong co khach dang mo, cau hoi khong neu ten khach dich → khong doan.
  const blind = await A.execTool(db2, 'propose_program', { clientId: 'longchu', program: prog }, ROLE,
    { read, openClientId: null, userText: ask });
  assert.strictEqual(blind.rejected, true);
  assert.strictEqual(A.nameInText('An', 'giáo án anh đạo'), false, '"giáo án" khong phai ten khach An');
});

test('the duyet canh bao do + hoi lai khi ghi vao khach khac khach dang mo', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.match(html, /function _aiOtherClient\(a\)/);
  assert.match(html, /class="ai-cf-warn"/);
  assert.match(html, /if \(_aiOtherClient\(m\.action\)\) \{[\s\S]{0,200}confirm\(/);
});

// Đề xuất mỗi SessionA → duyệt → B, C, D, E của Anh Đạo biến mất (2026-10-16).
test('de xuat vai buoi thi giu cac buoi con lai; bo buoi phai noi ro', async () => {
  const oldDay = (n) => ({ label: n, phases: [{ name: 'Main', tag: 'strength', exercises: [{ name: 'Goblet Squat (Dumbbell)', setsReps: '3 × 10' }] }] });
  const people = { dao: { name: 'Anh Đạo', program: { SessionA: oldDay('A'), SessionB: oldDay('B'), SessionC: oldDay('C'), SessionD: oldDay('D') } } };
  const db2 = { collection: (n) => ({
    doc: (id) => ({ get: async () => ({ exists: n === 'clients' && !!people[id], id, data: () => people[id] }) }),
    get: async () => ({ empty: false, docs: (n === 'exercises' ? LIB : []).map((x) => ({ id: x.id, data: () => x })) }),
  }) };
  const newA = { SessionA: { label: 'A2', focus: 'f', phases: [{ name: 'Block 1', tag: 'strength',
    exercises: [{ name: 'Goblet Squat (Dumbbell)', setsReps: '3 × 8', why: 'w' }] }] } };
  const ctx = { read: { 'get_client:dao': true, 'get_exercise_loads:dao': true }, openClientId: 'dao', userText: 'sửa buổi A của anh đạo' };
  const r = await A.execTool(db2, 'propose_program', { clientId: 'dao', program: newA }, ROLE, ctx);
  // Hành động chỉ mang buổi đổi + merge; coachApply ghép lên giáo án lúc bấm duyệt.
  assert.strictEqual(r.action.merge, true);
  assert.deepStrictEqual(Object.keys(r.action.program), ['SessionA']);
  assert.deepStrictEqual(r.preview.after.map((x) => x.day), ['SessionA', 'SessionB', 'SessionC', 'SessionD']);
  assert.deepStrictEqual(r.preview.kept, ['SessionB', 'SessionC', 'SessionD']);
  const merged = A.mergeProgram(people.dao.program, r.action.program, r.action.dropSessions);
  assert.deepStrictEqual(Object.keys(merged), ['SessionA', 'SessionB', 'SessionC', 'SessionD']);
  assert.strictEqual(merged.SessionA.label, 'A2');
  const d = await A.execTool(db2, 'propose_program', { clientId: 'dao', program: newA, dropSessions: ['SessionD'] }, ROLE, ctx);
  assert.deepStrictEqual(d.preview.dropped, ['SessionD']);
  assert.deepStrictEqual(Object.keys(A.mergeProgram(people.dao.program, d.action.program, d.action.dropSessions)),
    ['SessionA', 'SessionB', 'SessionC']);
  // Hai thẻ duyệt nối tiếp (A rồi B): thẻ sau ghép lên bản ĐÃ có A mới, không đè lại A cũ.
  const afterA = A.mergeProgram(people.dao.program, { SessionA: newA.SessionA }, []);
  const afterB = A.mergeProgram(afterA, { SessionB: { ...newA.SessionA, label: 'B2' } }, []);
  assert.strictEqual(afterB.SessionA.label, 'A2');
  assert.strictEqual(afterB.SessionB.label, 'B2');
});

test('cat cung luot goi model truoc khi ham nen bi giet; thoi han khop timeout cua ham + app', async () => {
  const hang = { interactions: { create: () => new Promise(() => {}) } };   // model treo mãi
  const t = Date.now();
  const r = await A.runAssistant({ client: hang, model: 'm', messages: [{ role: 'user', text: 'soạn giáo án' }], role: ROLE, timeBudgetMs: 40 });
  assert.ok(Date.now() - t < 2000, 'phai tu dung, khong treo');
  assert.ok(r.hitLimit && r.timedOut);
  assert.match(r.text, /tiếp tục/);
  const idx = fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8');
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const i = idx.indexOf('exports.coachAssistant'); const secs = +/timeoutSeconds: (\d+)/.exec(idx.slice(i, i + 800))[1];
  assert.ok((A.TIME_BUDGET_MS + A.HARD_STOP_MS) / 1000 < secs - 10, 'runAssistant phai dung truoc khi Cloud Run cat');
  assert.match(html, /'coachAssistant', \{ timeout: (\d+) \}/);
  assert.strictEqual(+/'coachAssistant', \{ timeout: (\d+) \}/.exec(html)[1], secs * 1000, 'app cho dung bang ham nen');
  assert.match(idx, /u\.input \?\? "\?"/, 'log token doc dung truong');
});

test('propose_program chan giao an vuot khung; sua 1 buoi thi loi cu khong chan, chi nhac', async () => {
  const ex = (name, setsReps, why) => ({ name, setsReps, why: why || 'w' });
  // Thư viện giả đủ bài cho 8 mẫu.
  const lib = [['Goblet Squat (Dumbbell)', { Quads: 'P', Glutes: 'S' }], ['Romanian Deadlift (Dumbbell)', { Hamstrings: 'P', Glutes: 'P' }],
    ['Narrow Push Up (BW)', { Chest: 'P' }], ['Shoulder Press (Dumbbell)', { 'Front Delts': 'P' }], ['Seated Row (Cable)', { Lats: 'P' }],
    ['Lat Pulldown (Cable)', { Lats: 'P' }], ['Plank (Bodyweight)', { Abs: 'P' }], ["Farmer's Carry (Dumbbell)", { Forearms: 'P' }],
    ['Hip Thrust (Barbell)', { Glutes: 'P' }]].map(([name, muscles], i) => ({ id: 'L' + i, name, muscles }));
  const week = { SessionA: { label: 'A', focus: 'f', phases: [{ name: 'Main', tag: 'strength', exercises: [
      ex('Goblet Squat (Dumbbell)', '3 × 10'), ex('Narrow Push Up (BW)', '3 × 8'), ex('Seated Row (Cable)', '3 × 10'), ex('Plank (Bodyweight)', '3 × 30s')] }] },
    SessionB: { label: 'B', focus: 'f', phases: [{ name: 'Main', tag: 'strength', exercises: [
      ex('Romanian Deadlift (Dumbbell)', '3 × 8'), ex('Shoulder Press (Dumbbell)', '3 × 10'), ex('Lat Pulldown (Cable)', '3 × 10'), ex("Farmer's Carry (Dumbbell)", '3 × 30s')] }] } };
  const people = { kim: { name: 'Kim', level: 'Beginner', program: {} } };
  const db3 = { collection: (n) => ({
    doc: (id) => ({ get: async () => ({ exists: n === 'clients' && !!people[id], id, data: () => people[id] }) }),
    get: async () => ({ empty: false, docs: (n === 'exercises' ? lib : []).map((x) => ({ id: x.id, data: () => x })) }),
  }) };
  const ctx = { read: { 'get_client:kim': true, 'get_exercise_loads:kim': true }, openClientId: 'kim', userText: 'soạn giáo án cho Kim' };
  const ok = await A.execTool(db3, 'propose_program', { clientId: 'kim', program: week, sessionMinutes: 60 }, ROLE, ctx);
  assert.strictEqual(ok.needsConfirm, true, JSON.stringify(ok.errors));
  assert.ok(ok.preview.volume.Glutes > 0 && ok.preview.minutes.SessionA > 0);
  // Dồn mông: thêm 3 bài × 4 set Hip Thrust → vượt trần Beginner → chặn; ghi lý do → qua, hiện "Ngoại lệ".
  const heavy = JSON.parse(JSON.stringify(week));
  heavy.SessionA.phases.push({ name: 'Glutes', tag: 'accessories', exercises: [ex('Hip Thrust (Barbell)', '4 × 10'), ex('Hip Thrust (Barbell)', '4 × 10')] });
  const bad = await A.execTool(db3, 'propose_program', { clientId: 'kim', program: heavy }, ROLE, ctx);
  assert.strictEqual(bad.rejected, true);
  assert.ok(bad.errors.some((e) => /Volume Glutes/.test(e)));
  const waived = await A.execTool(db3, 'propose_program', { clientId: 'kim', program: heavy, volumeExceptions: { Glutes: 'coach muốn ưu tiên mông' } }, ROLE, ctx);
  assert.strictEqual(waived.needsConfirm, true, JSON.stringify(waived.errors));
  assert.ok(waived.preview.waived.some((w) => /ưu tiên mông/.test(w)));
  // Giáo án cũ ĐÃ vượt (dồn mông) → sửa riêng SessionB không bị chặn vì lỗi của SessionA cũ.
  people.kim.program = JSON.parse(JSON.stringify(waived.action.program));   // bản đã gắn muscles, như trong Firestore
  const editB = await A.execTool(db3, 'propose_program', { clientId: 'kim', program: { SessionB: week.SessionB } }, ROLE, ctx);
  assert.strictEqual(editB.needsConfirm, true, JSON.stringify(editB.errors));
  assert.ok(editB.preview.warnings.some((w) => /Có sẵn từ giáo án cũ/.test(w)));
});

// ── Soạn như coach (2026-10-19) ───────────────────────────────────────────
test('ten thu vien cua bai khach dang tap duoc doi ve TEN CU de noi ta (Anh Dao: SessionA mat het ta)', () => {
  const { buildLibIndex, resolveProgram } = require('../functions/program-lib.js');
  const lib = [{ name: 'Goblet Squat (Dumbbell)', tool: 'Dumbbell', muscles: { Quads: 'P', Glutes: 'S' } },
    { name: 'Goblet Squat (Kettlebell)', tool: 'Kettlebell', muscles: { Quads: 'P', Glutes: 'S' } },
    { name: 'Dead Bug (Bodyweight)', tool: 'Bodyweight', muscles: { Abs: 'P' } },
    { name: 'Hip Thrust (Barbell)', tool: 'Barbell', muscles: { Glutes: 'P' } }];
  const prog = { SessionA: { phases: [{ name: 'Main', tag: 'strength', exercises: [
    { name: 'Goblet Squat (Dumbbell)', setsReps: '3 × 10' }, { name: 'Dead Bug (Bodyweight)', setsReps: '3 × 8' },
    { name: 'Hip Thrust (Barbell)', setsReps: '3 × 10' }, { name: 'Goblet Squat', setsReps: '3 × 10' }] }] } };
  const r = resolveProgram(prog, buildLibIndex(lib), { keepNames: new Set(['Goblet Squat', 'Dead Bug']) });
  const ex = r.program.SessionA.phases[0].exercises;
  assert.deepStrictEqual(ex.map((x) => x.name), ['Goblet Squat', 'Dead Bug', 'Hip Thrust (Barbell)', 'Goblet Squat']);
  assert.deepStrictEqual(ex[0].muscles, { Quads: 'P', Glutes: 'S' }, 'giu ten cu nhung van gan nhom co');
  assert.strictEqual(ex[1].bw, undefined, 'ten cu khong tu bat bw (doi nghia so kg)');
  assert.deepStrictEqual(ex[3].muscles, { Quads: 'P', Glutes: 'S' }, 'ten cu mo ho DB/KB cung nhom co van duoc gan');
  assert.strictEqual(r.reused.length, 2);
});

test('get_exercise_loads tra ta DANG DIEN SAN theo ten bai (khach chua log van co moc ta)', async () => {
  const program = { SessionB: { phases: [{ name: 'B1', tag: 'strength', exercises: [{ name: 'Romanian Deadlift' }, { name: 'Wide Grip Lat Pulldown (Cable)' }] }] } };
  const sl = { SessionB: { exerciseLoads: { dao_SessionB_0_0: 50, dao_SessionB_0_1: null }, setLoads: { dao_SessionB_0_1: [35, 37.5, 37.5] } } };
  const q = { orderBy() { return q; }, limit() { return q; }, get: async () => ({ docs: [], empty: true, forEach() {} }) };
  const db4 = { collection: () => ({ doc: () => ({
    get: async () => ({ exists: true, data: () => ({ program }) }),
    collection: (n) => n === 'sessionLoads'
      ? { get: async () => ({ forEach: (f) => Object.entries(sl).forEach(([id, v]) => f({ id, data: () => v })) }) }
      : q,
  }) }) };
  const r = await A.execTool(db4, 'get_exercise_loads', { clientId: 'dao' }, ROLE, {});
  assert.strictEqual(r.current['Romanian Deadlift'].kg, 50);
  assert.strictEqual(r.current['Wide Grip Lat Pulldown (Cable)'].kg, 37.5, 'khong co o chung thi lay set nang nhat');
});

test('prompt co quy trinh soan cua coach + vi du da duyet; form nhac tom tat', () => {
  assert.match(A.SYSTEM, /QUY TRÌNH SOẠN GIÁO ÁN/);
  assert.match(A.PLAYBOOK, /Last load/);
  assert.match(A.PLAYBOOK, /VÍ DỤ MỘT BUỔI ĐÃ ĐƯỢC COACH DUYỆT/);
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.match(html, /Làm theo QUY TRÌNH SOẠN GIÁO ÁN/);
  assert.match(html, /'Nối tạ cũ'/);
});
