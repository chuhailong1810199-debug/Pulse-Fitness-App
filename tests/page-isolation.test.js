/**
 * Mỗi trang chỉ hiện ở tab của nó. Lỗi 2026-10-15: một khối CSS viết sau
 * "#cdash-page{…display:flex…}" đè "#cdash-page{display:none}" → hồ sơ khách
 * hiện kèm dưới mọi tab. Quét: trang nào có luật #id{…display:X…} (X ≠ none)
 * không kèm .active thì phải có chốt #id:not(.active){display:none !important}.
 */
const test = require('node:test');
const assert = require('node:assert');
const s = require('fs').readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');

test('trang an khi khong .active, du co khoi CSS nao viet sau', () => {
  const sp = s.slice(s.indexOf('function showPage('), s.indexOf('\n}\n', s.indexOf('function showPage(')));
  const ids = [...sp.matchAll(/getElementById\('([a-z-]+-page)'\)\.classList\.toggle\('active'/g)].map((m) => m[1]);
  assert.ok(ids.length >= 10, 'khong tim thay danh sach trang trong showPage');
  const bad = [];
  for (const id of ids) {
    const re = new RegExp('#' + id + '\\s*\\{([^}]*)\\}', 'g');
    let m, leaks = false;
    while ((m = re.exec(s))) { const d = (m[1].match(/(?:^|;|\s)display\s*:\s*([a-z-]+)/) || [])[1]; if (d && d !== 'none') leaks = true; }
    const guarded = new RegExp('#' + id + ':not\\(\\.active\\)\\s*\\{\\s*display\\s*:\\s*none\\s*!important').test(s);
    if (leaks && !guarded) bad.push(id);
  }
  assert.deepStrictEqual(bad, [], 'trang co the hien o tab khac: ' + bad.join(', '));
});
