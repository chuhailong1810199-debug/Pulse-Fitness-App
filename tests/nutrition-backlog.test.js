/**
 * Log bù dinh dưỡng (2026-11-14): khách quên log hôm nay thì mai log được — tối đa 30 ngày (hôm nay + 29 ngày trước),
 * khớp thời gian giữ dữ liệu (pruneOldNutrition xoá ngày cũ hơn 30). Lưu / xoá bữa đi theo ngày đang chọn.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const s = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const cut = (a, b) => { const i = s.indexOf(a); assert(i >= 0, 'missing ' + a); return s.slice(i, s.indexOf(b, i)); };

function load() {
  const src = 'var _lang="vi"; function T(x){return x}; var loaded=0; function loadNutritionData(){loaded++}; var document={getElementById:function(){return null}};'
    + cut('let _nlDate = null;', '\nasync function loadNutritionData') + cut('function _dateKeyDaysAgo(n)', '\n/** Delete nutrition docs')
    + '; return { key: _nutritionDateKey, set: nlSetDate, shift: nlShiftDate, today: _nlTodayKey, ago: _dateKeyDaysAgo, label: _nlDayLabel, get d(){return _nlDate}, set d(v){_nlDate=v}, get loaded(){return loaded} };';
  return new Function(src)();
}

test('mac dinh hom nay; lui duoc 29 ngay; khong qua tuong lai; ngay ngoai khung quay ve hom nay', () => {
  const n = load();
  assert.strictEqual(n.key(), n.today());
  n.set(n.ago(1));
  assert.strictEqual(n.key(), n.ago(1), 'hom qua log bu duoc');
  assert.strictEqual(n.label(n.ago(1)), 'Hôm qua');
  n.set(n.ago(29));
  assert.strictEqual(n.key(), n.ago(29), 'ngay thu 30 (29 ngay truoc) van duoc');
  n.shift(-1);
  assert.strictEqual(n.key(), n.ago(29), 'khong lui qua 30 ngay — xa hon se bi prune xoa');
  n.set('2099-01-01');
  assert.strictEqual(n.key(), n.today(), 'ngay tuong lai -> hom nay');
  assert.strictEqual(n.d, null, 'hom nay luu la null');
  n.d = n.ago(45);   // tab mo qua nhieu dem
  assert.strictEqual(n.key(), n.today(), 'ngay da roi khoi khung -> ghi vao hom nay, khong ghi vao ngay sap bi xoa');
  assert(n.loaded >= 3, 'doi ngay thi nap lai du lieu');
});

test('luu / xoa bua theo ngay dang chon; bua log bu co dau late; mo tab / doi khach ve hom nay; lich su bam duoc', () => {
  const save = cut('async function saveNutritionLog', '\nasync function deleteMealLog');
  assert.match(save, /const dateKey = _nutritionDateKey\(\);/);
  assert.match(save, /mealData\.late = true/);
  assert.match(cut('async function deleteMealLog', '\nfunction openMacroTargetsModal'), /const dateKey = _nutritionDateKey\(\);/);
  assert.match(s, /_nlDate = null;            \/\/ mở tab là về hôm nay/);
  assert.match(s, /_macroMeta = null; _nlDate = null; \/\/ clear nutrition for new client/);
  assert.match(s, /onclick="nlSetDate\('\$\{d\.date\}'\)"/);
  assert.match(s, /id="nlog-day" role="status" hidden/);
  assert.strictEqual(cut('const NUTRITION_BACKLOG_DAYS', ';'), 'const NUTRITION_BACKLOG_DAYS = 30');
});
