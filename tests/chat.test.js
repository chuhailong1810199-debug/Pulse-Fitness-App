/**
 * Tin nhắn coach ↔ khách (2026-11-07).
 *
 * Ba thứ sai mà không ai thấy:
 *  - số chưa đọc đếm cả tin của chính mình / khách mình không phụ trách;
 *  - push gửi theo users.clientId — tự khai được — thì người lạ đọc trộm lời coach;
 *  - ghi tóm tắt `chat` lên doc khách làm vẽ lại bài tập đang gõ kg.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path'), vm = require('vm');
const s = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const fn = fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8');

function take(src, name) {
  const i = src.indexOf('\nfunction ' + name + '(');
  assert(i >= 0, 'khong tim thay ' + name);
  let j = src.indexOf('{', i), d = 0, k = j;
  for (; k < src.length; k++) { const c = src[k]; if (c === '{') d++; else if (c === '}') { d--; if (!d) { k++; break; } } }
  return src.slice(i, k);
}

const ts = (ms) => ({ toDate: () => new Date(ms) });
function sandbox(role, uid) {
  const ctx = { userRole: role, currentUser: { uid }, clientsData: [], Date };
  vm.createContext(ctx);
  vm.runInContext(['_toMs', 'chatMe', 'chatCanUse', 'chatMine', 'chatUnread', 'chatUnreadCount', '_chatText'].map((n) => take(s, n)).join('\n')
    + '\nfunction escHtml(x){return String(x).replace(/[&<>"\']/g,function(m){return "&#"+m.charCodeAt(0)+";"})}', ctx);
  return ctx;
}

test('so chua doc: chi tin cua BEN KIA, sau lan doc cuoi', () => {
  const c = sandbox('coach', 'coachA');
  c.clientsData = [
    { id: 'a', email: 'a@x', coachUid: 'coachA', chat: { lastAt: ts(2000), lastFrom: 'client', coachSeenAt: ts(1000) } },  // chưa đọc
    { id: 'b', email: 'b@x', coachUid: 'coachA', chat: { lastAt: ts(2000), lastFrom: 'client', coachSeenAt: ts(3000) } },  // đã đọc
    { id: 'c', email: 'c@x', coachUid: 'coachA', chat: { lastAt: ts(2000), lastFrom: 'coach' } },                          // tin của mình
    { id: 'd', email: 'd@x', coachUid: 'coachB', chat: { lastAt: ts(2000), lastFrom: 'client' } },                         // khách coach khác (admin quan sát)
    { id: 'e', email: '', coachUid: 'coachA', chat: { lastAt: ts(2000), lastFrom: 'client' } },                             // không đăng nhập được
    { id: 'f', email: 'f@x', coachUid: 'coachA' },                                                                         // chưa có chat
  ];
  assert.strictEqual(vm.runInContext('chatUnreadCount()', c), 1);
  const k = sandbox('client', 'u1');
  k.clientsData = [{ id: 'a', email: 'a@x', coachUid: 'coachA', chat: { lastAt: ts(2000), lastFrom: 'coach', clientSeenAt: ts(1000), coachSeenAt: ts(1) } }];
  assert.strictEqual(vm.runInContext('chatUnreadCount()', k), 1, 'khach thay tin coach');
  k.clientsData[0].chat.lastFrom = 'client';
  assert.strictEqual(vm.runInContext('chatUnreadCount()', k), 0);
});

test('chu cua tin: thoat HTML truoc roi moi gan link', () => {
  const c = sandbox('client', 'u1');
  const out = vm.runInContext('_chatText("<img src=x onerror=alert(1)>\\nxem https://youtu.be/abc")', c);
  assert(!/<img/.test(out), out);
  assert.match(out, /<br>/);
  assert.match(out, /<a href="https:\/\/youtu\.be\/abc" target="_blank" rel="noopener noreferrer">/);
});

test('push: coach nhan tin khach; khach nhan tin coach CHI khi email khop', () => {
  const ctx = { String, Set, Array };
  vm.createContext(ctx);
  vm.runInContext(take(fn, 'chatRecipients'), ctx);
  const r = (m, c, u) => JSON.parse(JSON.stringify(vm.runInContext('chatRecipients(' + JSON.stringify(m) + ',' + JSON.stringify(c) + ',' + JSON.stringify(u) + ')', ctx)));
  const cindy = { email: 'Cindy@gmail.com', coachUid: 'coachA' };
  assert.deepStrictEqual(r({ from: 'client', uid: 'u_c' }, cindy, []), ['coachA']);
  assert.deepStrictEqual(r({ from: 'coach', uid: 'coachA' }, cindy, [
    { uid: 'u_c', email: 'cindy@gmail.com' },
    { uid: 'u_spy', email: 'spy@gmail.com' },        // tự gắn users.clientId = cindy
  ]), ['u_c']);
  assert.deepStrictEqual(r({ from: 'coach', uid: 'coachA' }, { email: '', coachUid: 'coachA' }, [{ uid: 'x', email: '' }]), []);
  assert.deepStrictEqual(r({ from: 'hacker', uid: 'x' }, cindy, []), []);
});

test('ham nen push chat + luat chi hai ben doc', () => {
  assert.match(fn, /exports\.notifyChatMessage = onDocumentCreated\(\s*\{ document: "clients\/\{clientId\}\/messages\/\{msgId\}"/);
  const rules = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
  assert.match(rules, /match \/messages\/\{msgId\} \{\s*\n\s*allow read: if canAccess\(clientId\);/);
  assert.match(rules, /allow update, delete: if false;/);
});

test('tom tat chat tren doc khach KHONG ve lai bai tap', () => {
  const sub = take(s, 'subscribeProgram');
  assert.match(sub, /clientObj\.chat = data\.chat \|\| null;/);
  assert.match(sub, /if \(clientObj\._progJson === _pj\) return;/);
  assert.match(sub, /delete _co\._progJson/, 'luot nghe moi phai ve lan dau');
  assert(sub.indexOf('_progJson === _pj') < sub.indexOf('renderExercises()'));
});

test('tab Chat co trang, showPage bat/tat, khach va coach deu mount', () => {
  assert.match(s, /id="chat-nav-tab" data-page="chat"/);
  assert.match(s, /<div id="chat-page"><div id="chat-body"><\/div><\/div>/);
  assert.match(s, /if \(page === 'chat'\) chatPageOpen\(\); else chatPageClose\(\);/);
  assert.strictEqual((s.match(/\n\s+chatMount\(\);/g) || []).length, 2);
});

test('chu chat dich sang tieng Anh', () => {
  const a = s.indexOf('const I18N_VI_EN'), b = s.indexOf('/** Quét một nhánh DOM');
  const api = new Function(s.slice(a, b) + '; _lang = "en"; _i18nBuild(); return { tr: (x) => { const r = _i18nText(x); return r == null ? x : r; } };')();
  const want = { 'Hộp thư': 'Inbox', 'Nhắn cho coach…': 'Message your coach…', 'Nhắn cho Cindy…': 'Message Cindy…',
    'Chat · 3 tin chưa đọc': 'Chat · 3 unread', 'Đang gửi…': 'Sending…', 'Chưa có tin nhắn nào': 'No messages yet' };
  for (const [vi, en] of Object.entries(want)) assert.strictEqual(api.tr(vi), en, vi);
});
