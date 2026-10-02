#!/usr/bin/env node
/**
 * BƯỚC 0 — Kiểm chứng Polar AccessLink trước khi xây gì trong app.
 *
 * Trả lời đúng một câu hỏi: dữ liệu Nightly Recharge / Sleep / HRV của
 * Polar Loop (ra 9/2025) có thật sự chảy qua AccessLink v3 hay không.
 * Có số thật → đáng xây. Rỗng → dừng, không mất gì.
 *
 * KHÔNG chứa credential. Truyền qua biến môi trường:
 *
 *   POLAR_CLIENT_ID=xxx POLAR_CLIENT_SECRET=yyy node outputs/polar-check.js
 *
 * Trước khi chạy: vào https://admin.polaraccesslink.com → thêm redirect URL
 *   http://localhost:8123/callback
 */
const http = require('http');

const CLIENT_ID     = process.env.POLAR_CLIENT_ID;
const CLIENT_SECRET = process.env.POLAR_CLIENT_SECRET;
const PORT          = Number(process.env.POLAR_PORT || 8123);
const REDIRECT_URI  = process.env.POLAR_REDIRECT || `http://localhost:${PORT}/callback`;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Thiếu POLAR_CLIENT_ID hoặc POLAR_CLIENT_SECRET.\n' +
    'Chạy:  POLAR_CLIENT_ID=... POLAR_CLIENT_SECRET=... node outputs/polar-check.js');
  process.exit(1);
}

const AUTH_URL  = 'https://flow.polar.com/oauth2/authorization';
const TOKEN_URL = 'https://polarremote.com/v2/oauth2/token';
const API       = 'https://www.polaraccesslink.com';
const basic     = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
const state     = Math.random().toString(36).slice(2);

const short = s => String(s).slice(0, 6) + '…';   // không bao giờ in đủ token

function log(t)  { console.log(t); }
function head(t) { console.log('\n' + '─'.repeat(58) + '\n' + t + '\n' + '─'.repeat(58)); }

async function api(path, token) {
  const r = await fetch(API + path, {
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' }
  });
  const text = await r.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { status: r.status, body };
}

async function run(code) {
  head('BƯỚC 2 — đổi code lấy access token');
  const tr = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + basic,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json;charset=UTF-8'
    },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI })
  });
  const tok = await tr.json();
  if (!tr.ok || !tok.access_token) {
    console.error('LỖI lấy token:', tr.status, tok);
    process.exit(1);
  }
  const token = tok.access_token;
  const days  = Math.round((tok.expires_in || 0) / 86400);
  log(`  token = ${short(token)}  | x_user_id = ${tok.x_user_id}  | hết hạn sau ~${days} ngày`);

  head('BƯỚC 3 — đăng ký user với client (bắt buộc, hay bị bỏ sót)');
  const reg = await fetch(API + '/v3/users', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({ 'member-id': 'longchu' })
  });
  if (reg.status === 409) log('  409 — user đã đăng ký từ trước. Bình thường, đi tiếp.');
  else if (reg.ok)        log('  đăng ký OK: ' + JSON.stringify(await reg.json()));
  else                    log('  CẢNH BÁO ' + reg.status + ': ' + (await reg.text()).slice(0, 200));

  head('BƯỚC 4 — CÂU HỎI CHÍNH: có dữ liệu hồi phục không?');
  const today = new Date().toISOString().slice(0, 10);
  const from  = new Date(Date.now() - 27 * 864e5).toISOString().slice(0, 10);

  const probes = [
    ['Nightly Recharge', '/v3/users/nightly-recharge'],
    ['Sleep',            '/v3/users/sleep'],
    ['Nhịp tim liên tục', `/v3/users/continuous-heart-rate?from=${from}&to=${today}`],
  ];

  const summary = [];
  for (const [label, path] of probes) {
    const { status, body } = await api(path, token);
    let n = 0, keys = [];
    if (body && typeof body === 'object') {
      const arr = Array.isArray(body) ? body
        : (body.recharges || body.nights || body.heart_rates || body.data || null);
      if (Array.isArray(arr)) { n = arr.length; if (arr[0]) keys = Object.keys(arr[0]); }
      else { n = Object.keys(body).length ? 1 : 0; keys = Object.keys(body); }
    }
    const verdict = status === 200 && n > 0 ? 'CÓ DỮ LIỆU' : status === 200 ? 'rỗng' : 'HTTP ' + status;
    summary.push([label, verdict, n]);
    log(`\n  ${label}`);
    log(`    ${path}`);
    log(`    → ${verdict}${n ? '  (' + n + ' bản ghi)' : ''}`);
    if (keys.length) log('    trường: ' + keys.slice(0, 14).join(', '));
    if (status !== 200) log('    body: ' + JSON.stringify(body).slice(0, 300));
    else if (n > 0) log('    mẫu đầu tiên: ' + JSON.stringify(
      Array.isArray(body) ? body[0] : (body.recharges || body.nights || body.heart_rates || [body])[0]
    ).slice(0, 400));
  }

  head('KẾT LUẬN');
  const ok = summary.filter(s => s[1] === 'CÓ DỮ LIỆU');
  summary.forEach(([l, v, n]) => log(`  ${v === 'CÓ DỮ LIỆU' ? '✓' : '✗'} ${l.padEnd(20)} ${v}${n ? ' (' + n + ')' : ''}`));
  log('');
  if (ok.length) {
    log(`  ${ok.length}/3 endpoint trả về dữ liệu thật → ĐÁNG XÂY.`);
    log('  Bước tiếp: Cloud Function OAuth + scheduled pull + thẻ Recovery trong app.');
  } else {
    log('  Không endpoint nào có dữ liệu.');
    log('  Kiểm tra: Loop đã sync lên Polar Flow chưa? Đã ngủ đủ 1 đêm đeo máy chưa?');
    log('  Nếu Flow có số mà API rỗng → Loop chưa được AccessLink hỗ trợ. DỪNG, đừng xây.');
  }
  log('');
}

const url = `${AUTH_URL}?response_type=code&client_id=${encodeURIComponent(CLIENT_ID)}` +
            `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&state=${state}`;

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://localhost:${PORT}`);
  if (!u.pathname.startsWith('/callback')) { res.writeHead(404); res.end(); return; }
  const code = u.searchParams.get('code');
  const err  = u.searchParams.get('error');
  if (u.searchParams.get('state') !== state) {
    res.writeHead(400, {'Content-Type':'text/plain; charset=utf-8'});
    res.end('state không khớp — huỷ'); return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(err ? `<h2>Lỗi: ${err}</h2>` : '<h2>Xong. Quay lại cửa sổ terminal.</h2>');
  server.close();
  if (err) { console.error('\nPolar trả lỗi:', err); process.exit(1); }
  try { await run(code); } catch (e) { console.error('\nLỖI:', e.message); process.exit(1); }
});

server.listen(PORT, () => {
  head('BƯỚC 1 — cấp quyền');
  log('  Mở link này trong trình duyệt (đăng nhập tài khoản Polar Flow của mày):\n');
  log('  ' + url + '\n');
  log(`  Đang chờ callback ở ${REDIRECT_URI} …`);
  log('  (Nếu Polar báo redirect_uri sai → vào admin.polaraccesslink.com thêm đúng URL trên.)');
});
