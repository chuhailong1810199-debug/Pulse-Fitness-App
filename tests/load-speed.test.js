/**
 * Tốc độ mở app (đo 2026-10-11, emulator, trễ 150ms/lượt, CPU 4x):
 * mở lại 2,27s → 1,78s; lượt đọc 40 → 21 (khách), 35 → 16 (coach).
 * Chặn ba kiểu làm chậm đã gỡ quay trở lại.
 */
const test = require('node:test');
const assert = require('node:assert');
const s = require('fs').readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
const fn = (name) => { const i = s.indexOf(name); assert(i >= 0, name); return s.slice(i, s.indexOf('\n}\n', i)); };

test('loadApp không chờ settings/platform trước khi đọc khách', () => {
  const f = fn('async function loadApp() {');
  assert(!/^\s*await loadPlatformInfo\(\);/m.test(f), 'await loadPlatformInfo() đứng riêng = thêm một lượt mạng');
  assert(/Promise\.all\(\[loadAllClients\(\), _platformP\]\)/.test(f));
  assert(/Promise\.all\(\[getDoc\(doc\(db, 'clients', userClientId\)\), _platformP\]\)/.test(f));
});

test('baseline của khách chạy cùng lượt với tải tạ / lịch sử', () => {
  const f = fn('async function loadApp() {');
  assert(!/^\s*await checkAndShowBaseline\(\);/m.test(f));
  assert(/userRole === 'client' \? checkAndShowBaseline\(\) : null/.test(f));
});

test('hydrate hỏi lịch sử song song với sessionLoads', () => {
  const f = fn('async function hydrateExerciseLoadsForActiveDay()');
  assert(f.indexOf('const _histP = getDocs(') < f.indexOf("'sessionLoads', activeDay"));
  assert(/const histSnap = await _histP;/.test(f));
});

test('video: một lần đọc collection, không đọc từng bài nối đuôi', () => {
  const f = fn('async function refreshVideoSlotsFromFirestore(');
  assert(!/for \(const vKey of vKeys\)/.test(f), 'vòng for + await = nối đuôi từng bài');
  assert(!/getDoc\(doc\(db, 'clients', [^)]*'videos'/.test(f), 'còn getDoc từng video');
  assert(/await _videoDocs\(\)/.test(f) && /_videoProbeDue\(/.test(f));
  assert((s.match(/_invalidateVideoDocs\(\);/g) || []).length >= 2, 'tải lên + xoá phải làm mới bộ nhớ đệm');
});
