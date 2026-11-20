// Mở nhanh (2026-11-20): sw.js — /index.html MẠNG TRƯỚC, chỉ dùng bản lưu khi mạng chậm / mất; bản mới khác → nhắn trang.
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function makeEnv(netImpl) {
  const stores = {};
  const caches = {
    open: async (n) => { stores[n] = stores[n] || new Map(); const m = stores[n];
      return { match: async (k) => m.get(typeof k === 'string' ? k : k.url) || undefined, put: async (k, v) => { m.set(typeof k === 'string' ? k : k.url, v); } }; },
    keys: async () => Object.keys(stores), delete: async (n) => delete stores[n],
  };
  const listeners = {}, posted = [];
  const client = { postMessage: (m) => posted.push(m) };
  const self = { __shellWait: 60, location: { origin: 'https://app.test' }, addEventListener: (t, f) => { listeners[t] = f; },
    clients: { get: async (id) => (id === 'c1' ? client : null), matchAll: async () => [client], claim: async () => {} },
    skipWaiting: () => {}, registration: {} };
  const ctx = { self, caches, fetch: (req) => netImpl(req), URL, setTimeout, Promise, console };
  vm.createContext(ctx); vm.runInContext(src, ctx);
  return { listeners, stores, posted, caches };
}
const res = (body, o = {}) => ({ body, ok: o.ok !== false, type: o.type || 'basic', redirected: !!o.redirected,
  headers: { get: (h) => (h === 'etag' ? o.etag || null : null) }, clone() { return this; } });
const nav = (u) => ({ method: 'GET', mode: 'navigate', url: 'https://app.test' + u });
async function run(env, req) {
  let p = null; const waits = [];
  env.listeners.fetch({ request: req, resultingClientId: 'c1', respondWith: (x) => { p = x; }, waitUntil: (x) => waits.push(x) });
  return { r: p ? await p : 'passthrough', waits };
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  // 1. Lần đầu (chưa có bản lưu): đi mạng, lưu lại.
  let e = makeEnv(async () => res('v1', { etag: 'a' }));
  let { r } = await run(e, nav('/index.html'));
  assert.strictEqual(r.body, 'v1'); assert.strictEqual(e.stores['pulse-shell-v1'].get('/index.html').body, 'v1');
  // 2. Có bản lưu + mạng NHANH: luôn bản mạng (bản mới nhất), cập nhật bản lưu — không lặp bẫy bản cũ tháng 9.
  e = makeEnv(async () => res('v2', { etag: 'b' }));
  (await e.caches.open('pulse-shell-v1')).put('/index.html', res('v1', { etag: 'a' }));
  ({ r } = await run(e, nav('/index.html?client=lee')));
  assert.strictEqual(r.body, 'v2'); assert.strictEqual(e.stores['pulse-shell-v1'].get('/index.html').body, 'v2');
  // 3. Mạng CHẬM hơn SHELL_WAIT_MS: mở bản lưu ngay; bản mới về sau, etag khác → nhắn trang 'pulse-new-build'.
  e = makeEnv(async () => { await sleep(150); return res('v3', { etag: 'c' }); });
  (await e.caches.open('pulse-shell-v1')).put('/index.html', res('v1', { etag: 'a' }));
  let t0 = Date.now(), out = await run(e, nav('/index.html'));
  assert.strictEqual(out.r.body, 'v1'); assert.ok(Date.now() - t0 < 140, 'không chờ mạng chậm');
  await Promise.all(out.waits);
  assert.deepStrictEqual(e.posted.map((m) => m.type), ['pulse-new-build']);
  assert.strictEqual(e.stores['pulse-shell-v1'].get('/index.html').body, 'v3', 'bản mới được lưu cho lần sau');
  // 3b. Mạng chậm nhưng bản mới GIỐNG bản đang chạy (cùng etag) → không làm phiền.
  e = makeEnv(async () => { await sleep(150); return res('v1', { etag: 'a' }); });
  (await e.caches.open('pulse-shell-v1')).put('/index.html', res('v1', { etag: 'a' }));
  out = await run(e, nav('/index.html')); await Promise.all(out.waits);
  assert.strictEqual(e.posted.length, 0);
  // 4. Mất mạng: bản lưu.
  e = makeEnv(async () => { throw new Error('offline'); });
  (await e.caches.open('pulse-shell-v1')).put('/index.html', res('v1', { etag: 'a' }));
  ({ r } = await run(e, nav('/index.html'))); assert.strictEqual(r.body, 'v1');
  // 5. Trang chuyển hướng / lỗi không được lưu đè bản tốt.
  e = makeEnv(async () => res('login', { redirected: true }));
  (await e.caches.open('pulse-shell-v1')).put('/index.html', res('v1', { etag: 'a' }));
  await run(e, nav('/index.html')); assert.strictEqual(e.stores['pulse-shell-v1'].get('/index.html').body, 'v1');
  // 6. Chỉ /index.html — trang chủ, API, POST đi thẳng mạng như cũ. SDK Firebase / font: cache trước.
  e = makeEnv(async (req) => res('x' + req.url));
  assert.strictEqual((await run(e, nav('/'))).r, 'passthrough');
  assert.strictEqual((await run(e, { method: 'GET', mode: 'cors', url: 'https://firestore.googleapis.com/x' })).r, 'passthrough');
  assert.strictEqual((await run(e, { method: 'POST', mode: 'navigate', url: 'https://app.test/index.html' })).r, 'passthrough');
  let n = 0; e = makeEnv(async (req) => { n++; return res('sdk', { type: 'opaque', ok: false }); });
  const sdk = { method: 'GET', mode: 'no-cors', url: 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js' };
  await run(e, sdk); await sleep(5); await run(e, sdk);
  assert.strictEqual(n, 1, 'SDK có phiên bản cố định: tải một lần');
  // 7. activate xoá cache lạ (đổi tên cache = bỏ bản cũ).
  e = makeEnv(async () => res('v'));
  await e.caches.open('pulse-shell-v0'); await e.caches.open('pulse-shell-v1');
  let done; e.listeners.activate({ waitUntil: (p) => { done = p; } }); await done;
  assert.deepStrictEqual(Object.keys(e.stores), ['pulse-shell-v1']);
  // 8. App: SW đăng ký cho mọi người sau khi tải xong; thanh "Có bản mới"; mở nhanh bằng hồ sơ lưu, không chờ quá BOOT_WAIT_MS.
  assert.ok(/window\.addEventListener\('load', \(\) => setTimeout\(\(\) => \{ _swRegister\(\)/.test(html));
  assert.ok(/e\.data\.type === 'pulse-new-build'\) showNewBuildBar\(\)/.test(html));
  assert.ok(/const BOOT_WAIT_MS = 1200;/.test(html) && /readClientDocCache\(currentUser\.uid, userClientId\)/.test(html));
  assert.ok(/Promise\.race\(\[_bootData\.then/.test(html), 'tạ / cân nặng không chặn mở app quá BOOT_WAIT_MS');
  assert.ok(/const \{ avatar, \.\.\.rest \} = data/.test(html), 'bản lưu bỏ avatar');
  assert.ok(/_reapplyHydrateEdits\(\);\n\s+saveExerciseLoadsToLocal\(\);/.test(html), 'số vừa gõ không bị số máy chủ đè');
  console.log('sw-cache ok');
})().catch((e) => { console.error(e); process.exit(1); });
