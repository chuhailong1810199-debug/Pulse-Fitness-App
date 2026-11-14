// Màn chờ không được im lặng mãi (2026-11-15): coach kẹt ở logo trên iPhone, không lỗi nào hiện.
const assert = require('assert');
const html = require('fs').readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');

// 1. Script canh màn chờ phải chạy TRƯỚC script Firebase / app (bắt được lỗi của chúng).
const wd = html.indexOf('window._bootFail = function');
const fb = html.indexOf('const app  = initializeApp(');
assert.ok(wd > 0 && fb > 0 && wd < fb, 'script canh màn chờ phải nằm trước script app');
assert.ok(/setTimeout\(show, 15000\)/.test(html), 'hiện trợ giúp sau 15 giây');

// 2. Nhánh coach của loadApp phải bắt lỗi và báo lên màn chờ.
assert.ok(/if \(userRole !== 'client'\) return loadApp\(\)\s*\.then\([^]*?\.catch\([^]*?_bootFail/.test(html),
  'nhánh coach phải .catch(...) → _bootFail');

// 3. Nút xoá bộ nhớ tạm chỉ xoá cache của Pulse, không đăng xuất.
assert.ok(/pulse_\(user_v2\|prog\)_/.test(html));
assert.ok(!/boot-clear[^]{0,600}(signOut|indexedDB\.deleteDatabase|localStorage\.clear)/.test(html), 'không đăng xuất / xoá sạch');
console.log('boot-watchdog OK');
