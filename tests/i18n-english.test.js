/**
 * Giao diện mặc định TIẾNG ANH, trợ lý tên Pulse (2026-10-15).
 * Chạy bộ dịch của index.html offline lên những câu giao diện từng bị sót.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const s = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const a = s.indexOf('const I18N_VI_EN'), b = s.indexOf('/** Quét một nhánh DOM');
const api = new Function(s.slice(a, b) + '; _lang = "en"; _i18nBuild(); return { tr: (x) => { const r = _i18nText(x); return r == null ? x : r; }, T };')();
const VI = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;

test('mac dinh tieng Anh; ai da chon VI thi giu VI', () => {
  assert.match(s, /let _lang = 'en';/);
  assert.match(s, /localStorage\.getItem\(I18N_LANG_KEY\) === 'vi' \? 'vi' : 'en'/);
});

test('cau giao dien (tinh + ghep so) dich het, khong con tieng Viet', () => {
  const ui = ['← Tất cả khách', 'Bảng điều khiển', 'Hỏi AI về khách này', 'Đồng ý', 'Bỏ qua', 'Đẩy giáo án', 'Tạo lớp nhóm',
    'Soạn giáo án cho khách mới', 'Chỉnh buổi hôm nay', 'Quản lý coach', 'Vì sao bài này', 'Ghi bữa ăn',
    '12 bài', '+ 3 bài nữa', 'Chưa tập 122 ngày', 'Quá hạn đo InBody 9 tuần', '15 khách cần chú ý',
    'Khách đang xem: Cindy. 15 khách cần chú ý', 'Khách đang xem: Sang, Chưa tập. 15 khách cần chú ý',
    'Thứ Năm, 15/10/2026 · 21 khách · 15 cần chú ý', 'Tập 2 tuần trước · 10/10 bài · 2.805 kg',
    'Mặt trước, 3 vùng đã tập', 'Hình cơ thể, đang xem mặt sau. Mặt trước 0 vùng đã tập, mặt sau 2 vùng. Số liệu ở danh sách nhóm cơ.',
    'Còn 420 kcal', 'Hôm nay Cindy thế nào?', 'Vì sao chọn từng bài trong buổi A?', '1 tuần trước'];
  for (const x of ui) assert.doesNotMatch(api.tr(x), VI, x + ' -> ' + api.tr(x));
  assert.strictEqual(api.tr('Chưa tập 122 ngày'), 'No training for 122 days');
  assert.strictEqual(api.tr('Khách đang xem: Sang, Chưa tập. 15 khách cần chú ý'), 'Viewing: Sang, Not training. 15 clients need attention');
});

test('du lieu coach viet giu nguyen; bien so khong nuot chu', () => {
  // Nhãn buổi coach tự đặt — không được biến "tuần" thành "weeks".
  assert.strictEqual(api.tr('D — WOD dài nhất tuần'), 'D — WOD dài nhất tuần');
  // Tên bài / nhãn buổi trong câu ghép giữ nguyên, phần giao diện vẫn dịch.
  assert.strictEqual(api.tr('Mức tạ Landmine Press (50% tải cũ)'), 'Weight for Landmine Press (50% tải cũ)');
  assert.strictEqual(api.tr('Buổi B · B — WOD toàn thân'), 'Session B · B — WOD toàn thân');
  assert.strictEqual(api.tr('Chị Linh'), 'Chị Linh');
});

test('tro ly ten Pulse, tra loi theo ngon ngu app', () => {
  assert.match(s, /<span class="ai-title">Pulse<\/span>/);
  assert.match(s, /lang: typeof i18nGet === 'function' \? i18nGet\(\) : 'vi'/);
  const asst = fs.readFileSync(path.join(__dirname, '..', 'functions', 'assistant.js'), 'utf8');
  assert.match(asst, /Tên bạn là Pulse/);
  assert.match(asst, /reply in ENGLISH/);
  const idx = fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8');
  assert.ok((idx.match(/lang: request\.data && request\.data\.lang === "en" \? "en" : "vi"/g) || []).length >= 2, 'ca coach va khach deu truyen lang');
});

test('aria-label cung duoc dich va theo doi', () => {
  assert.match(s, /\['placeholder', 'title', 'aria-label'\]/);
  assert.match(s, /attributeFilter: \['placeholder', 'title', 'aria-label'\]/);
});
