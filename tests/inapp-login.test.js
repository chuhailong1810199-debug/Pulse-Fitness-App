// Đăng nhập Google từ trình duyệt trong app + app đã cài (2026-11-17, coach Vy không vào được: chưa có tài khoản Auth nào).
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
function fn(name) { const i = html.indexOf('\nfunction ' + name + '(') + 1; let d = 0; for (let k = html.indexOf('{', i); k < html.length; k++) { if (html[k] === '{') d++; else if (html[k] === '}') { d--; if (!d) return html.slice(i, k + 1); } } }
const ctx = {}; vm.createContext(ctx); vm.runInContext(fn('inAppBrowserName') + ';this.f = inAppBrowserName;', ctx);
const f = ctx.f;
// 1. Nhận ra webview nhúng — Zalo là cái bản cũ bỏ sót.
const UA = {
  zaloIOS: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Zalo iOS/24.10.1 ZaloTheme/light',
  zaloAndroid: 'Mozilla/5.0 (Linux; Android 14; SM-A546E Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0 Mobile Safari/537.36 Zalo android/12100000 ZaloTheme/light',
  messenger: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/MessengerForiOS;FBAV/480.0]',
  facebook: 'Mozilla/5.0 (Linux; Android 13; Pixel 7; wv) AppleWebKit/537.36 Chrome/129 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/480.0.0]',
  tiktok: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 musical_ly_36.5.0 BytedanceWebview/d8a21c6',
  androidWv: 'Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0 Mobile Safari/537.36',
  safari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  chromeAndroid: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36',
  chromeMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
};
assert.strictEqual(f(UA.zaloIOS), 'Zalo'); assert.strictEqual(f(UA.zaloAndroid), 'Zalo');
assert.strictEqual(f(UA.messenger), 'Messenger'); assert.strictEqual(f(UA.facebook), 'Facebook');
assert.strictEqual(f(UA.tiktok), 'TikTok'); assert.strictEqual(f(UA.androidWv), 'app');
['safari', 'chromeAndroid', 'chromeMac'].forEach((k) => assert.strictEqual(f(UA[k]), null, k + ' là trình duyệt thật'));
// 2. Đăng nhập: trong webview thì hiện hướng dẫn thay vì gọi Google; app đã cài thì chuyển trang (cùng tên miền); popup hỏng thì lùi về chuyển trang.
const login = html.slice(html.indexOf('async function loginWithGoogle() {'), html.indexOf('async function logout() {'));
assert.ok(/if \(_inApp\) \{ inAppBanner\(true\); return; \}/.test(login));
assert.ok(/canRedirect && pwaInstalled\(\)\) \{ await signInWithRedirect/.test(login));
assert.ok(/const canRedirect = AUTH_HOSTS\.includes\(location\.hostname\)/.test(login), 'chỉ redirect khi authDomain là tên miền app');
assert.ok(/auth\/popup-blocked/.test(login) && /auth\/popup-closed-by-user/.test(login));
assert.ok(/const signInWithRedirect = \(auth, provider\) => auth\.signInWithRedirect\(provider\)/.test(html));
// 3. Không còn tự nhảy sang scheme giả (googlechromes:// / safari://); không mời cài app trong webview; có hộp hướng dẫn.
assert.ok(!/safari:\/\/' \+/.test(html) && !/googlechromes:\/\/'\)/.test(html));
assert.ok(/if \(_inApp\) \{ onDone\(\); inAppBanner\(false\); return; \}/.test(html));
assert.ok(/id="inapp-banner"/.test(html) && /package=com\.android\.chrome/.test(html));
console.log('inapp-login ok');
