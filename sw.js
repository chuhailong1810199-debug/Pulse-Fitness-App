/**
 * Service worker của Pulse — thông báo đẩy + MỞ NHANH (2026-11-20).
 *
 * Bẫy cũ (tháng 9): Pulse là MỘT file index.html không có tên băm; trình duyệt giữ bản cũ qua bốn lần deploy, triệu chứng
 * nhìn y như lỗi đồng bộ. Vì vậy file app KHÔNG được phục vụ theo kiểu "cache trước":
 *
 *   /index.html (điều hướng) = MẠNG TRƯỚC. Máy chủ trả trong SHELL_WAIT_MS → dùng bản mới (và lưu lại) — y như không có SW.
 *   Chỉ khi mạng chậm hơn thế / mất mạng mới mở bản đã lưu, rồi vẫn tải bản mới ngầm; bản mới khác bản đang chạy (etag)
 *   → nhắn trang 'pulse-new-build' → thanh "Có bản mới — chạm để tải lại". Lý do: khách mạng yếu (Lee 11/2026) đứng ở
 *   logo vì mỗi lần mở đều phải tải lại 1,5 MB trước khi hiện gì.
 *   SDK Firebase (gstatic, có số phiên bản cố định) + font Google = cache trước: URL đổi khi đổi phiên bản.
 *
 * Đổi cách lưu → đổi tên cache (SHELL / LIBS); activate xoá mọi cache không còn dùng. tests/sw-cache.test.js.
 */
const SHELL = 'pulse-shell-v1', LIBS = 'pulse-libs-v1', SHELL_URL = '/index.html';
const SHELL_WAIT_MS = (typeof self !== 'undefined' && self.__shellWait) || 2500;

async function shellResponse(event) {
  const cache = await caches.open(SHELL);
  const net = fetch(event.request).then(async (res) => {
    // Không lưu trang chuyển hướng (Safari từ chối trả điều hướng qua SW nếu bản lưu có redirect) / lỗi / khác nguồn.
    if (res && res.ok && res.type === 'basic' && !res.redirected) await cache.put(SHELL_URL, res.clone());
    return res;
  });
  const cached = await cache.match(SHELL_URL);
  if (!cached) return net;                                  // lần đầu trên máy: mạng như cũ
  const late = new Promise((r) => setTimeout(() => r(null), SHELL_WAIT_MS));
  const first = await Promise.race([net.catch(() => null), late]);
  if (first) return first;                                  // mạng kịp (kể cả trả lỗi) — dùng bản mạng
  event.waitUntil(net.then((res) => {
    if (res && res.ok && !res.redirected && res.headers.get('etag') !== cached.headers.get('etag')) return notifyNewBuild(event.resultingClientId);
  }).catch(() => {}));
  return cached;
}
async function notifyNewBuild(id) {
  for (let i = 0; i < 30; i++) {                            // trang có thể chưa kịp dựng xong khi bản mới về
    const c = id ? await self.clients.get(id) : null;
    if (c) { c.postMessage({ type: 'pulse-new-build' }); return; }
    await new Promise((r) => setTimeout(r, 500));
  }
  (await self.clients.matchAll({ type: 'window' })).forEach((c) => c.postMessage({ type: 'pulse-new-build' }));
}
async function libResponse(req) {
  const cache = await caches.open(LIBS);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()).catch(() => {});
  return res;
}
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (req.mode === 'navigate' && url.origin === self.location.origin && url.pathname === SHELL_URL) {
    event.respondWith(shellResponse(event));
    return;
  }
  if ((url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/'))
      || url.hostname === 'fonts.gstatic.com' || (url.hostname === 'fonts.googleapis.com' && url.pathname === '/css2')) {
    event.respondWith(libResponse(req));
  }
});

// Nhận bản mới ngay, không chờ tab cũ đóng — SW này không giữ trạng thái gì
// nên không có gì để mất khi thay nóng.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== SHELL && k !== LIBS) await caches.delete(k);
  await self.clients.claim();
})()));

self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (_e) { d = {}; }

  const title = d.title || 'Pulse';
  const opts = {
    body: d.body || '',
    icon: '/images/icon-192.png',
    badge: '/images/favicon-32.png',
    // tag gộp các thông báo cùng loại: nhắc lại cùng một buổi thì thay thế
    // cái cũ chứ không xếp chồng thành một đống trên màn khoá.
    tag: d.tag || 'pulse',
    renotify: true,
    data: { url: d.url || '/index.html' },
    // Buổi tập là việc có giờ giấc: để nó nằm im trên màn khoá tới khi bấm,
    // thay vì tự biến mất sau vài giây.
    requireInteraction: !!d.sticky,
  };
  event.waitUntil(self.registration.showNotification(title, opts));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/index.html';
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // Đang mở sẵn thì nhảy về tab đó, đừng mở thêm một cửa sổ nữa.
    for (const c of all) {
      if (c.url.includes('/index.html') || c.url.endsWith('/')) {
        await c.focus();
        if ('navigate' in c) { try { await c.navigate(url); } catch (_e) { /* không sao */ } }
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
