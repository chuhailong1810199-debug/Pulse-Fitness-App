// Thanh tab cuộn ngang ở MỌI bề rộng (2026-11-24): > 700px trước đây căn giữa + không cuộn → tab hai đầu bị cắt mất.
const assert = require('assert'), fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const css = html.slice(html.indexOf('/* Thanh tab cuộn ngang ở MỌI bề rộng'), html.indexOf('</style>', html.indexOf('/* Thanh tab cuộn ngang ở MỌI bề rộng')));
assert.ok(/#app-screen \.nav\{[^}]*justify-content:flex-start !important;[^}]*overflow-x:auto/.test(css), 'nav cuộn, bắt đầu từ trái');
assert.ok(/#app-screen \.nav-tab\{flex:1 0 auto;white-space:nowrap;max-width:none;\}/.test(css), 'tab không co, không xuống dòng');
// Quy tắc này phải nằm SAU '#app-screen .nav{' gốc (cùng độ đặc hiệu, cái sau thắng).
assert.ok(html.indexOf('/* Thanh tab cuộn ngang ở MỌI bề rộng') > html.indexOf('#app-screen .nav{\n  background:linear-gradient'));
const fn = html.slice(html.indexOf('function centerActiveNavTab()'), html.indexOf('function showPage('));
assert.ok(!/max-width: 700px/.test(fn), 'tab đang mở cuộn vào giữa ở mọi bề rộng');
assert.ok(/nav\.scrollTo\(/.test(fn) && /classList\.toggle\('nav-over'/.test(fn));
console.log('nav-scroll ok');
