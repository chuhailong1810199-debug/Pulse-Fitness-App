// Coach mới (2026-11-17, coach Vy): 0 khách và khách chưa có giáo án phải chỉ đường đưa giáo án vào — không còn "Bam + Add"
// không dấu, không còn "Rest day" cho giáo án trống.
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
function fn(name) { const i = html.indexOf('\nfunction ' + name + '(') + 1; let d = 0; for (let k = html.indexOf('{', i); k < html.length; k++) { if (html[k] === '{') d++; else if (html[k] === '}') { d--; if (!d) return html.slice(i, k + 1); } } }
const ctx = { escHtml: (s) => String(s), activeClient: { name: 'Lan' }, userRole: 'coach' };
vm.createContext(ctx);
vm.runInContext([fn('coachStartHTML'), fn('emptyProgramHTML'), 'this.a = coachStartHTML; this.b = emptyProgramHTML;'].join('\n'), ctx);
const start = ctx.a();
assert.ok(/Chào mừng, Coach!/.test(start) && /add-client-modal/.test(start) && /aiFormOpen\(\\?'client\\?'\)|aiFormOpen\('client'\)/.test(start));
assert.ok(!/Chao mung, Coach|Bam <strong>/.test(html), 'màn trống cũ không dấu còn sót');
const emp = ctx.b();
assert.ok(/Lan chưa có giáo án/.test(emp) && /launchPulse\(\)/.test(emp) && /startBlankProgram\(\)/.test(emp));
vm.runInContext('userRole = "client"', ctx); ctx.userRole = 'client';
assert.ok(/Coach chưa đưa giáo án lên/.test(ctx.b()) && !/launchPulse/.test(ctx.b()), 'khách không thấy nút của coach');
// Không dẫn coach sang migrate.html (ghi email thẳng, bỏ qua claimClientEmail).
assert.ok(!/href="\/migrate\.html"/.test(html));
// Giáo án trống ≠ ngày nghỉ; renderExercises chọn màn trống khi không có buổi SessionX nào.
assert.ok(/\/\^Session\[A-Z\]\$\/\.test\(k\) && prog\[k\]\) \? '<div class="loading">Rest day 💤<\/div>' : emptyProgramHTML\(\)/.test(html));
assert.ok(/document\.getElementById\('exercise-list'\)\.innerHTML = coachStartHTML\(\);/.test(html));
console.log('coach-start ok');
