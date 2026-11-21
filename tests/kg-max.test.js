// Trần kg một set (2026-11-21): anh Tiến gõ 22222 kg cho Bodyweight Reverse Lunge → volume buổi 715.952 kg.
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
function fn(name) { const i = html.indexOf('\nfunction ' + name + '(') + 1; let d = 0; for (let k = html.indexOf('{', i); k < html.length; k++) { if (html[k] === '{') d++; else if (html[k] === '}') { d--; if (!d) return html.slice(i, k + 1); } } }
const ctx = { toasts: [] }; vm.createContext(ctx);
vm.runInContext(['const KG_MAX = 500;', fn('parsePrescription'), fn('resolveSetLoads'), fn('exerciseTonnage'), fn('kgTooBig'),
  'function showToast(m) { toasts.push(m); }', 'this.T = exerciseTonnage; this.bad = kgTooBig;'].join('\n'), ctx);
// 1. Volume bỏ qua số > 500 kg: đúng ca của anh Tiến không còn ra 711.104 kg.
assert.strictEqual(ctx.T('2 × 8/chân', [22222, 22222], 22222), 0);
assert.strictEqual(ctx.T('3 x 10', [50, 50, 50], 50), 1500);
assert.strictEqual(ctx.T('3 x 10', [50, 9999, 50], 50), 1500, 'set lỗi lấy mức set trước');
assert.strictEqual(ctx.T('1 x 1', [500], 500), 500, '500 kg vẫn hợp lệ');
// 2. Ô nhập: > 500 → đỏ + nhắc một lần, coi như trống; sửa lại thì hết đỏ.
const cls = new Set(); const el = { classList: { toggle: (c, on) => (on ? cls.add(c) : cls.delete(c)) } };
assert.strictEqual(ctx.bad('22222', el), true); assert.ok(cls.has('kg-bad')); assert.strictEqual(ctx.toasts.length, 1);
ctx.bad('222222', el); assert.strictEqual(ctx.toasts.length, 1, 'không nhắc dồn từng phím');
assert.strictEqual(ctx.bad('22', el), false); assert.ok(!cls.has('kg-bad'));
assert.strictEqual(ctx.bad('80'), false);
// 3. Nối dây: hai ô kg gửi chính ô đó, hai hàm lưu chặn trước khi ghi.
assert.ok(/oninput="setSetLoad\('\$\{key\}',\$\{si\},this\.value,this\)"/.test(html));
assert.ok(/oninput="setExerciseLoad\('\$\{key\}', this\.value, this\)"/.test(html));
assert.strictEqual((html.match(/if \(kgTooBig\(rawValue, el\)\) rawValue = '';/g) || []).length, 2);
console.log('kg-max ok');
