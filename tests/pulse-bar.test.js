/**
 * Thanh Pulse ở đáy màn hình (pbarMount, 2026-11-07) — chỉ coach, thay nút trợ lý tròn.
 * Thiết kế: claude.ai/artifact/K77Ya2HeZ5iDhGFbHLnfi2.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const s = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('chi coach moi co thanh; khach van dung nut tron', () => {
  assert.match(s, /aiMount\(\);\s+\/\/ nút trợ lý nổi, mọi tab, chỉ coach\n\s+pbarMount\(\);/);
  assert.strictEqual((s.match(/\bpbarMount\(\);/g) || []).length, 1, 'pbarMount chi duoc goi o nhanh coach');
  assert.match(s, /function pbarMount\(\) \{\n\s+if \(userRole !== 'coach'/);
  assert.match(s, /body\.has-pbar #ai-fab\{ display: none; \}/);
});

test('thanh an khi khung tro ly mo, toast khong bi che', () => {
  assert.match(s, /body:has\(#ai-sheet\.open\) #pbar/);
  assert.match(s, /body\.has-pbar #workout-toast/);
  assert.match(s, /body\.has-pbar\{ padding-bottom:/);
});

test('dashboard va thanh dung chung MOT lan doc lich hom nay', () => {
  assert.match(s, /async function _todayBookings\(\)/);
  assert.match(s, /const \{ count, unlogged: list \} = await _todayBookings\(\);\n\s+pbarSetToday\(count, list\);/);
});

test('chu tren thanh dich sang tieng Anh', () => {
  const a = s.indexOf('const I18N_VI_EN'), b = s.indexOf('/** Quét một nhánh DOM');
  const api = new Function(s.slice(a, b) + '; _lang = "en"; _i18nBuild(); return { tr: (x) => { const r = _i18nText(x); return r == null ? x : r; } };')();
  const want = { '3 cần chú ý': '3 need attention', '2 chưa log': '2 to log', 'Hôm nay · 5': 'Today · 5', '19 khách': '19 clients',
    'Lịch': 'Schedule', 'Chưa log': 'To log', 'Hỏi Pulse về khách…': 'Ask Pulse about a client…', 'Mở': 'Open',
    'Buổi 07:00–08:00 · chưa log': 'Session 07:00–08:00 · not logged' };
  for (const [vi, en] of Object.entries(want)) assert.strictEqual(api.tr(vi), en, vi);
});
