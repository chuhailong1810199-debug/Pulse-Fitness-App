// KG gợi ý (2026-11-16): tạ tuần tới cho bài strength từ lịch sử của khách — sóng 3 tuần tăng + 1 tuần nhẹ.
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
function fn(name) { const i = html.indexOf('\nfunction ' + name + '(') + 1; let d = 0; for (let k = html.indexOf('{', i); k < html.length; k++) { if (html[k] === '{') d++; else if (html[k] === '}') { d--; if (!d) return html.slice(i, k + 1); } } }
const mod = html.slice(html.indexOf('// ── KG GỢI Ý'), html.indexOf('/**\n * Huy hiệu ↑/↓ kg + Stats chạy NỀN'));
assert.ok(mod.length > 500, 'module found');
const ctx = { _lang: 'vi', T: (s) => s };
vm.createContext(ctx);
vm.runInContext([fn('parsePrescription'), fn('escHtml'), mod, 'this.core = kgSuggestCore; this.pct = kgPct; this.chip = kgChipHTML;'].join('\n'), ctx);
const { core, pct, chip } = ctx;

// Công thức %1RM (streprogen): 1 rep = 97,5; 5 rep ≈ 84,3; 8 rep ≈ 75,45.
assert.strictEqual(pct(1), 97.5);
assert.ok(Math.abs(pct(5) - 84.3) < 0.01 && Math.abs(pct(8) - 75.45) < 0.01);

const NOW = new Date(2026, 10, 18, 9);   // thứ Tư 18/11/2026
const ago = (days) => new Date(NOW.getTime() - days * 864e5);
const h = (days, kg, reps = 5) => ({ date: ago(days), kg, reps });

// 1. Tuần trước 100 × 5 → tuần này +2,5% = 102,5.
let s = core([h(7, 100)], '4 x 5', 'Back Squat', NOW);
assert.strictEqual(s.mode, 'up'); assert.strictEqual(s.kg, 102.5); assert.strictEqual(s.reps, 5);

// 2. Đổi rep: 100 × 5 tuần trước, hôm nay 3 × 8 → đổi theo %1RM rồi +2,5% ≈ 91,7 → 92,5.
s = core([h(7, 100)], '3 x 8', 'Back Squat', NOW);
assert.strictEqual(s.kg, 92.5);

// 3. Đã tăng 3 tuần liền → tuần 4 nhẹ (×0,9).
s = core([h(7, 105), h(14, 102.5), h(21, 100)], '4 x 5', 'Bench Press', NOW);
assert.strictEqual(s.mode, 'light'); assert.strictEqual(s.kg, 95);   // 105 × 0,9 = 94,5 → 95

// 4. Vừa xong tuần nhẹ → quay lại đỉnh trước rồi tăng tiếp (105 → 107,5), không tăng từ mức nhẹ.
s = core([h(7, 95), h(14, 105), h(21, 102.5), h(28, 100)], '4 x 5', 'Bench Press', NOW);
assert.strictEqual(s.mode, 'up'); assert.strictEqual(s.kg, 107.5);

// 5. Nghỉ > 14 ngày → ×0,95 lần cuối.
s = core([h(30, 100)], '4 x 5', 'Deadlift', NOW);
assert.strictEqual(s.mode, 'hold'); assert.strictEqual(s.kg, 95);

// 6. Đã tập bài này đầu tuần (thứ Hai) → buổi thứ 2 trong tuần giữ nguyên mức đó.
s = core([h(2, 100), h(9, 97.5)], '4 x 5', 'Deadlift', NOW);
assert.strictEqual(s.mode, 'same'); assert.strictEqual(s.kg, 100);

// 7. Buổi HÔM NAY không tính (gợi ý đứng yên sau khi lưu buổi).
s = core([{ date: new Date(NOW), kg: 120, reps: 5 }, h(7, 100)], '4 x 5', 'Squat', NOW);
assert.strictEqual(s.kg, 102.5);

// 8. Tạ nhỏ: +2,5% làm tròn về số cũ thì vẫn nhích một nấc; tạ đơn nấc 1 kg.
assert.strictEqual(core([h(7, 40)], '3 x 5', 'Overhead Press', NOW).kg, 42.5);
assert.strictEqual(core([h(7, 20, 10)], '3 x 10', 'Dumbbell Row', NOW).kg, 21);

// 8b. Tên ghi cả hai dụng cụ → theo cái đứng trước: 55 × 0,95 = 52,25 → 52,5 (thanh đòn), không phải 52.
assert.strictEqual(core([h(30, 55, 8)], '3 x 8', 'Barbell Bench Press (hoặc Dumbbell)', NOW).kg, 52.5);
assert.strictEqual(core([h(30, 20, 8)], '3 x 8', 'Dumbbell Press (hoặc Barbell)', NOW).kg, 19);

// 9. Không gợi ý: chưa có lịch sử, rep > 12, chuỗi không phải rep (giây / mét).
assert.strictEqual(core([], '4 x 5', 'Squat', NOW), null);
assert.strictEqual(core([h(7, 20, 15)], '3 x 15', 'Leg Press', NOW), null);
assert.strictEqual(core([h(7, 20)], '3 x 30s', 'Plank', NOW), null);

// 10. Chip: chạm điền ô trống, tuần nhẹ có nhãn.
assert.ok(/kgUseSuggest\('k1'\)/.test(chip('k1', { kg: 102.5, reps: 5, mode: 'up' })));
assert.ok(/102,5kg × 5/.test(chip('k1', { kg: 102.5, reps: 5, mode: 'up' })));
assert.ok(/tuần nhẹ/.test(chip('k1', { kg: 95, reps: 5, mode: 'light' })));

// 11. Nối dây: chỉ pha strength, bỏ BW / lớp nhóm / khách < 18; thẻ bài hiện chip + placeholder; tuổi tải nền.
assert.ok(/normPhaseTag\(phase\) !== 'strength'/.test(mod) && /ex\.bw/.test(mod) && /isGroup/.test(mod));
assert.ok(/_kgAge\.minor !== false/.test(mod), 'chỉ gợi ý khi chắc chắn không phải trẻ vị thành niên');
assert.ok(/\$\{getStrengthBadge\(key, ex\.name\)\}\$\{kgChipHTML\(key, sug\)\}/.test(html));
assert.ok(/placeholder="\$\{ex\.bw\?'\+0':\(sug\?sug\.kg:'—'\)\}"/.test(html));
assert.ok(/Promise\.all\(\[loadStrengthHistory\(\), cid \? kgLoadAge\(cid\) : null\]\)/.test(html));
console.log('kg-suggest ok');
