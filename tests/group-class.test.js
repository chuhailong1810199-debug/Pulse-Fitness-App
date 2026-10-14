/**
 * Lớp nhóm phía app: form dựng prompt, thẻ duyệt, cảnh báo dashboard, billing.
 * (Phía server: tests/coach-assistant.test.js + tests/rules/assistant-scope.test.js)
 */
const test = require('node:test');
const assert = require('node:assert');
const s = require('fs').readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
const slice = (a, b) => s.slice(s.indexOf(a), s.indexOf(b, s.indexOf(a)));

const build = new Function('escHtml', slice('const _AI_GF_FORMATS', 'function aiFormOpen(') + '; return { aiBuildGroupPrompt, _aiGroupForm };')(String);

test('form lop: thieu ten / kieu lop / dung cu thi bao loi', () => {
  assert.ok(build.aiBuildGroupPrompt({ format: 'hyrox', equipment: 'x' }).error);
  assert.ok(build.aiBuildGroupPrompt({ name: 'A', format: 'yoga', equipment: 'x' }).error);
  assert.ok(build.aiBuildGroupPrompt({ name: 'A', format: 'hyrox' }).error);
});

test('prompt lop: isGroup, groupFormat, khoa buoi, khong email, dung cu nguyen van', () => {
  const r = build.aiBuildGroupPrompt({ name: 'HYROX sáng', format: 'hyrox', size: '10', dur: '60 phút', spw: '3', level: 'Mixed', equipment: '3 SkiErg, 1 sled' });
  assert.ok(!r.error);
  assert.match(r.prompt, /isGroup: true/);
  assert.match(r.prompt, /groupFormat "hyrox"/);
  assert.match(r.prompt, /SessionA, SessionB, SessionC\./);
  assert.match(r.prompt, /KHÔNG email/);
  assert.match(r.prompt, /3 SkiErg, 1 sled/);
  assert.match(r.prompt, /groupSize 10/);
  assert.strictEqual(r.email, '');
});

test('form lop co o an kind=group de aiFormSend chon dung bo dung prompt', () => {
  assert.match(build._aiGroupForm(), /name="kind" value="group"/);
  assert.match(s, /data\.kind === 'group' \? aiBuildGroupPrompt\(data\)\s*: data\.kind === 'ready' \? aiBuildReadyPrompt\(/);
});

test('canh bao dashboard: lop chi bao khi chua co giao an', () => {
  const f = slice('function clientAlert(c) {', '\nconst _ALERT_RANK');
  const clientAlert = new Function('accessStatus', '_diffDays', '_ymd', '_daysSince', 'inactiveThreshold', 'fmtVnd',
    f + '; return clientAlert;')(() => ({ state: 'expired', daysLeft: -9 }), () => 99, () => '', () => 99, () => 3, String);
  assert.strictEqual(clientAlert({ isGroup: true, program: { SessionA: {} }, lastWorkoutAt: 'x' }), null);
  assert.strictEqual(clientAlert({ isGroup: true, program: {} }).kind, 'noprogram');
  assert.strictEqual(clientAlert({ program: { SessionA: {} } }).kind, 'expired', 'khach thuong van bao nhu cu');
});

test('billing khong bat cho lop; the duyet lop khong co o Gmail', () => {
  assert.match(slice('function billingOn(c)', '\n}'), /!c\.isGroup/);
  assert.match(s, /if \(!a\.isGroup\) rows\.push\(\['Gmail', null\]\);/);
  assert.match(s, /a\.isGroup \? 'Tạo lớp nhóm' : 'Tạo khách mới'/);
});
