/**
 * Nhắc coach log buổi tập sau khi buổi kết thúc (2026-10-15).
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const L = require('../functions/log-reminder.js');
const CL = [{ id: 'thaison', name: 'Thai Son' }, { id: 'kem', name: 'Kem' }, { id: 'linh', name: 'Chị Linh' },
  { id: 'soobin', name: 'anh Soobin' }, { id: 'an', name: 'An' }, { id: 'tien', name: 'Trần Văn Tiến' }, { id: 'nam', name: 'Nam' }];

test('khop tieu de lich voi khach: bo dau, xung ho, ten goi vs ho ten day du; khong doan bua', () => {
  const m = (t) => (L.matchClient({ title: t }, CL) || {}).id || null;
  assert.strictEqual(m('Thái Sơn'), 'thaison');
  assert.strictEqual(m('Chị Linh'), 'linh');
  assert.strictEqual(m('chị linh'), 'linh');
  assert.strictEqual(m('Soobin'), 'soobin');
  assert.strictEqual(m('Anh Tiến'), 'tien');
  assert.strictEqual(m('Kem - leg day'), 'kem');
  assert.strictEqual(m('Họp team'), null);
  assert.strictEqual(m('Group class'), null);
  assert.strictEqual(L.matchClient({ title: 'x', clientId: 'kem' }, CL).id, 'kem', 'clientId thang thi dung luon');
});

test('ban sao trong app khop y server', () => {
  const s = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const a = s.indexOf('function _lrFold'), b = s.indexOf('async function loadUnloggedToday');
  const app = new Function(s.slice(a, b) + '; return _lrMatchClient;')();
  for (const t of ['Thái Sơn', 'Chị Linh', 'Soobin', 'Anh Tiến', 'Kem - leg day', 'Họp team', 'An', 'Nam + An', 'Mr.O']) {
    assert.strictEqual((app({ title: t }, CL) || {}).id || null, (L.matchClient({ title: t }, CL) || {}).id || null, t);
  }
});

test('toi han kiem log: xong 30–180 phut, chua kiem, khong huy; thieu endTime = 60 phut', () => {
  const list = [
    { id: 'a', startTime: '16:00', endTime: '17:00' },
    { id: 'b', startTime: '16:00', endTime: '17:00', logCheckedAt: 'x' },
    { id: 'c', startTime: '16:00', endTime: '17:00', status: 'cancelled' },
    { id: 'd', startTime: '17:00' },
    { id: 'e', startTime: '10:00', endTime: '11:00' },
  ];
  assert.deepStrictEqual(L.dueLogChecks(list, 17 * 60 + 29).map((b) => b.id), []);
  assert.deepStrictEqual(L.dueLogChecks(list, 18 * 60 + 30).map((b) => b.id), ['a', 'd']);
});

test('da log = buoi tap ghi tu 60 phut truoc gio bat dau (gio VN)', () => {
  const b = { date: '2026-10-15', startTime: '17:00' };
  const startUtc = Date.UTC(2026, 9, 15, 10, 0);   // 17:00 VN = 10:00 UTC
  assert.strictEqual(L.ictToUtcMs('2026-10-15', '17:00'), startUtc);
  assert.strictEqual(L.isLogged(b, startUtc + 3600e3), true);
  assert.strictEqual(L.isLogged(b, startUtc - 30 * 60e3), true);
  assert.strictEqual(L.isLogged(b, startUtc - 2 * 3600e3), false, 'buoi hom qua khong tinh');
  assert.strictEqual(L.isLogged(b, 0), false);
});

test('server: nhac sau buoi trong scheduleReminders + tong ket 21:30; link mo thang tab workout', () => {
  const f = fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8');
  const sr = f.slice(f.indexOf('exports.scheduleReminders'), f.indexOf('exports.logDigest'));
  assert.match(sr, /dueLogChecks\(await bookingsOn\(now\.date\), now\.minutes\)/);
  assert.match(sr, /url: "\/index\.html\?client=" \+ encodeURIComponent\(x\.client\.id\) \+ "&tab=workout"/);
  assert.match(sr, /logCheckedAt: new Date\(\)\.toISOString\(\)/, 'phai danh dau de khong nhac trung');
  assert.match(f, /exports\.logDigest = onSchedule\(\s*\{\s*schedule: "30 21 \* \* \*"/);
  const s = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.match(s, /showScreen\('app'\);\s*_applyDeepLink\(\);/);
  assert.match(s, /window\.history\.replaceState\(\{\}, '', window\.location\.pathname\);/);
});
