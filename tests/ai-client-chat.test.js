/**
 * Chat coach ↔ trợ lý theo từng khách + hiển thị lý do chọn bài (2026-10-15).
 */
const test = require('node:test');
const assert = require('node:assert');
const s = require('fs').readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
const slice = (a, b) => s.slice(s.indexOf(a), s.indexOf(b, s.indexOf(a)));

test('form the trang: can it nhat mot tinh trang; prompt khong cho doi giao an goc', () => {
  const build = new Function(slice('function aiBuildReadyPrompt', '\nfunction aiFormOpen(') + '; return aiBuildReadyPrompt;')();
  assert.ok(build({}, 'Cindy').error);
  const r = build({ st0: 'Ngủ kém', st5: 'Đau khớp / chấn thương', pain: '4', where: 'vai phải', day: 'SessionB' }, 'Cindy');
  assert.ok(!r.error);
  assert.match(r.prompt, /Ngủ kém, Đau khớp \/ chấn thương/);
  assert.match(r.prompt, /4\/10/);
  assert.match(r.prompt, /KHÔNG đổi giáo án gốc/);
  assert.match(r.show, /SessionB/);
  assert.strictEqual(build({ notes: 'mệt', pain: '99' }, 'A').prompt.includes('10/10'), true, 'muc dau kep 0–10');
});

test('hai che do chat: luong theo khach luu lai, tra loi ve dung luong da hoi', () => {
  assert.match(s, /thread: _aiMode === 'client' && !!activeClient/);
  assert.match(s, /day: activeDay \|\| null/);
  assert.match(s, /const thread = _aiMsgs;/);
  assert.match(s, /thread\.push\(\{ role: 'assistant', text: d\.text/);
  assert.match(s, /collection\(db, 'clients', id, coll\), orderBy\('at', 'desc'\), limit\(30\)/);
  assert.match(s, /const coll = _aiMode === 'self' \? 'clientChat' : 'aiChat';/);
  assert.match(s, /httpsCallable\(_aiMode === 'self' \? 'clientAssistant' : 'coachAssistant'/);
  assert.match(s, /if \(typeof aiOnClientChange === 'function'\) aiOnClientChange\(\);/);
});

test('ly do chon bai hien cho MOI nguoi: o "i" va truong focus tren dau buoi', () => {
  assert.match(s, /id="modal-why"/);
  assert.match(s, /whyWrap\.style\.display = ex\.why \? '' : 'none'/);
  assert.match(s, /'<div class="day-focus"><span class="day-focus-k">Trọng tâm buổi<\/span>' \+ escHtml\(_focus\)/);
});

test('nut "Hoi AI ve khach nay" chi cho coach', () => {
  assert.match(s, /isCoach && typeof aiOpen === 'function' \? '<button class="cd-goto cd-ask-ai"/);
});
