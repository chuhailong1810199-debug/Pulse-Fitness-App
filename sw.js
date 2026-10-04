/**
 * Service worker của Pulse — CHỈ làm thông báo đẩy.
 *
 * KHÔNG cache gì ở đây. Không fetch handler, không precache, không gì hết.
 *
 * Pulse là một file index.html duy nhất, không có tên băm. Dự án này từng mất
 * nhiều ngày vì trình duyệt giữ bản cũ: coach mở app ra thấy giao diện từ bốn
 * lần deploy trước, triệu chứng nhìn y như lỗi đồng bộ dữ liệu. Đã chữa bằng
 * header no-cache trong vercel.json. Một service worker có cache sẽ dựng lại
 * đúng cái bẫy đó, lần này còn khó gỡ hơn vì SW sống sót qua cả reload cứng.
 *
 * Muốn thêm cache offline sau này thì phải gắn liền với một chuỗi phiên bản
 * đổi theo mỗi lần deploy, và xoá sạch cache cũ lúc activate. Đừng thêm vội.
 */

// Nhận bản mới ngay, không chờ tab cũ đóng — SW này không giữ trạng thái gì
// nên không có gì để mất khi thay nóng.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

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
