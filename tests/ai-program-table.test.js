/**
 * Khung trợ lý: bảng giáo án màu theo pha + lọc LaTeX (coach báo khó đọc 2026-10-15).
 */
const test = require('node:test');
const assert = require('node:assert');
const s = require('fs').readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
const slice = (a, b) => s.slice(s.indexOf(a), s.indexOf(b, s.indexOf(a)));
const escHtml = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

test('_aiClean: dung doan chu trong anh coach gui', () => {
  const clean = new Function(slice('function _aiClean', 'function _aiFmt') + '; return _aiClean;')();
  const raw = "#### Session A: Anterior 1\n- `Front Toss (Med Ball)`: $3 \\times 5$ (Power)\n- `High Bar Squat (Barbell)`: $4 \\times 4\\text{--}6$\n"
    + "Bike $\\to$ Shoulder CARs ($2 \\times 5$/bên)";
  const out = clean(raw);
  assert.ok(!/[$\\`#]/.test(out), out);
  assert.match(out, /\*\*Session A: Anterior 1\*\*/);
  assert.match(out, /Front Toss \(Med Ball\): 3 × 5/);
  assert.match(out, /4 × 4–6/);
  assert.match(out, /Bike → Shoulder CARs \(2 × 5\/bên\)/);
});

test('bang giao an: mot hang moi bai, mau theo pha, bam vao de hoi', () => {
  const r = new Function('escHtml', slice('const _AI_PH', '\nfunction aiQuick') + '; return _aiProgramHTML;')(escHtml);
  const html = r({ SessionA: { label: 'Anterior', focus: 'squat nặng', phases: [
    { name: 'Warm-up', tag: 'warmup', exercises: [{ name: 'CARs', setsReps: '2 × 5' }] },
    { name: 'Main', tag: 'strength', exercises: [{ name: 'Squat <x>', setsReps: '4 × 4-6' }, { name: 'Press', setsReps: '4 × 6' }] }] } });
  assert.strictEqual((html.match(/<tr class="ph-/g) || []).length, 3);
  assert.match(html, /class="ph-w"/); assert.match(html, /class="ph-s"/);
  assert.match(html, /rowspan="2"><span title="Main">Chính<\/span>/);
  assert.match(html, /Squat &lt;x&gt;/, 'ten bai phai duoc escape');
  assert.match(html, /onclick="aiQuick\(this\.dataset\.q\)"/);
  assert.match(html, /Buổi A/); assert.match(html, /squat nặng/);
});

test('may khach hien bang tu displays va tu the duyet; luong luu lai van con bang', () => {
  assert.match(s, /for \(const dsp of \(d\.displays \|\| \[\]\)\) thread\.push\(\{ role: 'program', display: dsp \}\);/);
  assert.match(s, /if \(m\.role === 'program'\) return/);
  assert.match(s, /p\.table && Object\.keys\(p\.table\)\.length/);
  assert.match(s, /\(m\.displays \|\| \[\]\)\.forEach\(\(dsp\) => old\.push\(\{ role: 'program', display: dsp \}\)\)/);
});
