/**
 * Hỏi về khách nào thì Pulse đọc + app mở đúng khách đó (2026-10-22): coach đang mở Long Chu, hỏi về Anh Đạo,
 * Pulse đọc nhầm hồ sơ Long Chu. Tên khách trùng từ thường nên luật chặt: tên một chữ phải viết hoa.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const A = require('../functions/assistant.js');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const a = html.indexOf('function _aiNamedClient'), b = html.indexOf('async function _aiFollowNamedClient');
const app = new Function(html.slice(a, b) + '; return _aiNamedClient;')();

const CL = [['chị_nguyệt', 'Chị Nguyệt'], ['cindy', 'Cindy'], ['giao', 'Giao'], ['kem', 'Kem'], ['lee', 'Lee'], ['longchu', 'Long Chu'],
  ['nam', 'Nam'], ['nguyen', 'Nguyên'], ['sang', 'Sang'], ['soobin', 'anh Soobin'], ['an', 'An'], ['dao', 'Anh Đạo'],
  ['linh', 'Chị Linh'], ['tam', 'Chị Tâm'], ['thaison', 'Thai Son'], ['tien', 'Trần Văn Tiến']].map(([clientId, name]) => ({ clientId, name }));
const CASES = [
  ['sửa giáo án của anh đạo', 'dao'], ['giáo án Đạo thế nào', 'dao'], ['dao động nhịp tim', null], ['chuyển sang buổi B', null],
  ['Sang tập thế nào', 'sang'], ['sang tập thế nào', null], ['khách nam 30 tuổi', null], ['Nam tiến bộ không', 'nam'],
  ['giáo án An', 'an'], ['giáo án của tao', null], ['so sánh Cindy với Lee', null], ['thai son vai đỡ chưa', 'thaison'],
  ['anh Tiến đau gối', 'tien'], ['ăn kem được không', null], ['Kem nhảy cao hơn chưa', 'kem'], ['giao hàng', null],
  ['Giao chạy 5km', 'giao'], ['chi linh tập mông', 'linh'], ['Lee bầm đùi sau', 'lee'],
];

test('nhan ten khach: dung, khong nham tu thuong, nhac 2 khach thi khong doi', () => {
  for (const [t, want] of CASES) assert.strictEqual(A.namedClientId(t, CL), want, t);
});

test('ban sao trong app khop y server', () => {
  for (const [t] of CASES) assert.strictEqual(app(t, CL), A.namedClientId(t, CL), t);
});

test('app chuyen ho so + luong chat truoc khi gui; server doc khach duoc goi ten', () => {
  assert.match(html, /if \(text == null\) await _aiFollowNamedClient\(q\);/);
  assert.match(html, /await openClientDash\(id\)/);
  const idx = fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8');
  assert.match(idx, /const clientId = named \|\| openId;/);
  assert.match(idx, /namedClientId\(lastText/);
  assert.match(idx, /await authz\.assertCanView\(request, id\);/, 'khach duoc goi ten van phai qua quyen xem');
});
