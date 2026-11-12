/**
 * Tab Lớp nhóm (renderGroups, 2026-11-12) — thiết kế Claude Design "Pulse · Tab Lớp nhóm".
 * Chạy hàm THẬT cắt từ index.html trên dữ liệu giả.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const s = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const fn = fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8');
const cut = (a, b) => { const i = s.indexOf(a); assert(i >= 0, 'missing ' + a); return s.slice(i, s.indexOf(b, i)); };

function load(clients, user = { uid: 'c1' }, admin = false) {
  const src = 'var userRole = "coach", userIsAdmin = ' + admin + ', currentUser = ' + JSON.stringify(user) + ', activeClient = null, clientsData = ' + JSON.stringify(clients) + ';\n'
    + 'function T(x){return x} function escHtml(x){return String(x==null?"":x).replace(/[&<>"\']/g,function(m){return "&#"+m.charCodeAt(0)+";"})}\n'
    + 'function _toMs(v){if(!v)return 0;var t=new Date(v).getTime();return isNaN(t)?0:t}\n'
    + cut('const PHASE_TAGS', '\n// Whether a checkpoint') + '\n' + cut('// ── TAB LỚP NHÓM', '// ── TIN NHẮN coach')
    + '; return { grpFmt, grpClasses, grpEquip, grpCueLevel, grpTimeline, grpListHTML, grpClassHTML, grpSessionHTML, grpLastPush, grpIsNew, grpShort, _grp };';
  return new Function(src)();
}
const S = { label: 'Strength + Interval', durationMin: 50, pushedAt: new Date().toISOString(), phases: [
  { name: 'Warm-up', tag: 'warmup', format: 'mobility', durationMin: 5, exercises: [{ name: 'Hip 90/90', setsReps: '1 vòng' }] },
  { name: 'Interval — EMOM 12', tag: 'circuit', format: 'emom', rounds: 4, durationMin: 12, exercises: [{ name: 'Row', setsReps: '12 cal', minute: 1 }, { name: 'KB Swing', setsReps: '12', minute: 2 }] },
  { name: 'Hồi phục', tag: 'warmup', format: 'recovery', durationMin: 3, exercises: [{ name: 'Đi bộ', setsReps: '3 phút' }] },
  { name: 'A. Lower', tag: 'strength', format: 'straight', durationMin: 30, exercises: [{ name: 'Goblet Squat', setsReps: '4 × 6', regression: 'Box Squat', cue: 'Dễ: box squat / Chuẩn: goblet / Khó: tempo 3-1-1' }] }] };
const CLS = { id: 'lop_a', name: 'Lớp · A', isGroup: true, coachUid: 'c1', groupFormat: 'hyrox', durationMin: 50, groupSize: 8,
  equipment: '10 KB 12–24kg, 8 cặp DB 5–22,5kg; 1 sled', program: { SessionB: S } };

test('chi lop cua CHINH coach; khach 1-1 khong vao tab', () => {
  const g = load([CLS, { id: 'k', name: 'Khách', coachUid: 'c1' }, { ...CLS, id: 'lop_b', coachUid: 'c2' }]);
  assert.deepStrictEqual(g.grpClasses().map((c) => c.id), ['lop_a']);
  const adm = load([CLS, { ...CLS, id: 'lop_b', coachUid: 'c2' }], { uid: 'c1' }, true);
  assert.strictEqual(adm.grpClasses().length, 2, 'admin quan sat thay lop cua moi coach');
});

test('kieu block: format, khong co thi suy tu tag (giao an cu)', () => {
  const g = load([]);
  assert.strictEqual(g.grpFmt({ format: 'emom', tag: 'circuit' }), 'emom');
  assert.strictEqual(g.grpFmt({ tag: 'warmup' }), 'mobility');
  assert.strictEqual(g.grpFmt({ tag: 'accessories' }), 'superset');
  assert.ok(['mobility', 'emom', 'recovery', 'straight', 'superset', 'circuit'].includes(g.grpFmt({ tag: 'weird', format: 'zumba' })), 'tag / format la -> kieu hop le, khong vo');
  assert.strictEqual(g.grpShort(S.phases[1]), 'EMOM · 4 vòng');
  assert.strictEqual(g.grpShort(S.phases[3]), 'A · Lower');
});

test('dung cu: so thap phan "22,5kg" khong bi cat doi; muc Kho/De doc tu cue', () => {
  const g = load([]);
  assert.deepStrictEqual(g.grpEquip(CLS), ['10 KB 12–24kg', '8 cặp DB 5–22,5kg', '1 sled']);
  assert.strictEqual(g.grpCueLevel(S.phases[3].exercises[0].cue, 'Khó'), 'tempo 3-1-1');
  assert.strictEqual(g.grpCueLevel(S.phases[3].exercises[0].cue, 'Dễ'), 'box squat');
  assert.strictEqual(g.grpCueLevel('Giữ lưng thẳng', 'Khó'), '');
});

test('thanh thoi gian: khop thi xanh, lech / thieu phut thi do + nut nho Pulse can lai', () => {
  const g = load([CLS]);
  const ok = g.grpTimeline(CLS, S, true);
  assert.strictEqual(ok.off, false);
  assert.strictEqual(ok.total, '50 / 50 phút');
  const bad = JSON.parse(JSON.stringify(S)); bad.phases[3].durationMin = 40; delete bad.phases[0].durationMin;
  const r = g.grpTimeline(CLS, bad, true);
  assert.strictEqual(r.off, true);
  assert.match(r.total, /^55\+\? \/ 50 phút$/);
  assert.match(r.html, /Dư 5 phút so với độ dài lớp/);
  assert.match(r.html, /1 block chưa ghi số phút: Warm-up/);
  assert.match(r.html, /Nhờ Pulse cân lại về 50′/);
});

test('danh sach / trang lop / chi tiet buoi ve du, nhan Moi theo pushedAt', () => {
  const g = load([CLS]);
  const list = g.grpListHTML();
  assert.match(list, /data-gcid="lop_a"/);
  assert.match(list, /class="gp-new">Mới/);
  assert.match(list, /1\/7/);
  const cls = g.grpClassHTML(CLS);
  assert.match(cls, /Buổi mới/);
  assert.match(cls, /grpPulse\('lop_a','SessionA'\)/, 'o trong dau tien = buoi moi');
  const det = g.grpSessionHTML(CLS, 'SessionB');
  assert.match(det, /grpTeach\('lop_a','SessionB'\)/);
  assert.match(det, /Vòng 4/, 'EMOM ve luoi phut x vong');
  assert.match(det, /Dễ hơn: Box Squat/);
  const old = { ...CLS, program: { SessionA: { label: 'Cũ', phases: [{ name: 'A', tag: 'strength', exercises: [{ name: 'Squat', setsReps: '3 × 5' }] }] } } };
  assert.match(load([old]).grpSessionHTML(old, 'SessionA'), /đồng hồ bấm giờ tự do/);
  assert.match(load([]).grpListHTML(), /Chưa có lớp nhóm nào/);
});

test('noi vao app: tab chi coach, Pulse chon san khoa, sau Dong y hien buoi vua day', () => {
  assert.match(s, /if \(page === 'groups' && userRole !== 'coach'\) return;/);
  assert.match(s, /id="groups-nav-tab" data-page="groups"/);
  assert.match(s, /grpAfterPush\(m\.action\.clientId, m\.action\.program, _changedKeys\)/);
  assert.match(s, /\(pick === next \? ' selected' : ''\)/);
  // Server đóng giờ đẩy cho buổi lớp TRƯỚC khi ghép, buổi cũ giữ giờ cũ.
  const i = fn.indexOf('pushedAt: at'), j = fn.indexOf('if (act.merge === true) act.program = mergeProgram');
  assert(i > 0 && i < j, 'pushedAt phai dong truoc khi ghep');
});
