// Đăng nhập Google trên iPhone: authDomain phải là tên miền app, và Vercel phải
// chuyển tiếp /__/auth + /__/firebase sang firebaseapp.com. Thiếu một trong hai
// là khách kẹt ở "Unable to save initial state … sessionStorage is inaccessible".
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

test('index.html dùng tên miền app làm authDomain trên longchucoaching.com', () => {
  const h = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(h, /const AUTH_HOSTS = \[[^\]]*'longchucoaching\.com'/);
  assert.match(h, /authDomain: AUTH_HOSTS\.includes\(location\.hostname\) \? location\.hostname :/);
});

test('vercel.json chuyển tiếp /__/auth và /__/firebase, đứng trước filesystem', () => {
  const routes = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8')).routes;
  const i = routes.findIndex(r => r.src === '/__/(auth|firebase)/(.*)');
  assert.ok(i >= 0, 'thiếu route proxy');
  assert.strictEqual(routes[i].dest, 'https://fitness-app-a22c8.firebaseapp.com/__/$1/$2');
  assert.ok(i < routes.findIndex(r => r.handle === 'filesystem'));
});
