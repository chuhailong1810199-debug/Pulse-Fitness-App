// Hình động minh hoạ bài tập (2026-11-17): người dạng nét SVG, lib/exercise-anim.js — mọi bài bổ trợ theo môn đều có hình.
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const ctx = { window: {}, Math, Object, Array, String, Number, Set };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'lib', 'exercise-anim.js'), 'utf8'), ctx);
const A = ctx.window.EXERCISE_ANIM;
const { SPORTS } = require(path.join(root, 'functions', 'sports.js'));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

// 1. Mọi bài trong khung môn (tên thư viện lẫn tên hiển thị) đều có hình + câu hướng dẫn 2 thứ tiếng.
for (const [k, S] of Object.entries(SPORTS)) for (const b of S.blocks) for (const [n, , lib] of b.ex) {
  assert.ok(A.has(lib || n), k + ': thiếu hình cho ' + (lib || n));
  assert.ok(A.has(n), k + ': tên hiển thị không tra ra hình: ' + n);
  assert.ok(A.cue(lib || n, 'vi') && A.cue(lib || n, 'en') !== A.cue(lib || n, 'vi'), 'cue ' + n);
}
// 1b. TOÀN BỘ thư viện chung (ảnh chụp tên bài: tests/fixtures/library-names.json — cập nhật khi thêm bài) đều có hình.
const LIBN = require(path.join(root, 'tests', 'fixtures', 'library-names.json'));
const noAnim = LIBN.filter((n) => !A.has(n));
assert.deepStrictEqual(noAnim, [], 'bài thư viện chưa có hình: ' + noAnim.join(', '));
// 2. Vẽ được mọi khung: không NaN, toạ độ hữu hạn, người không chui xuống đất quá sâu.
for (const name of new Set(A.names().concat(LIBN))) {
  const ex = A.find(name);
  for (let i = 0; i < 40; i++) {
    const u = i / 40, svg = A.svgFor(ex, u);
    assert.ok(!/NaN|undefined|Infinity/.test(svg), name + ' @' + u);
    const P = A.poseAt(ex, u), S = A.skel(P, ex);
    const ys = [S.hip, S.sho].concat(...S.legs.map((g) => [g.kn, g.an, g.ft]), ...S.arms.map((a) => [a.el, a.wr])).map((p) => p[1]);
    assert.ok(Math.min(...ys) > -6, name + ' xuyên đất ' + Math.min(...ys).toFixed(1) + ' @' + u);
  }
}
// 3. Bàn chân bám điểm (IK) đúng chỗ khi trong tầm với: mắt cá = đích.
{ const ex = A._EX['front squat (barbell)'], P = A.poseAt(ex, 0.3), S = A.skel(P, ex);
  assert.ok(Math.hypot(S.legs[0].an[0] - P.F[0][0], S.legs[0].an[1] - P.F[0][1]) < 0.5, 'IK chân'); }
// 4. App: tải lười, hộp thông tin bài + thẻ môn Anatomy, chỉ vẽ khi còn trên trang.
assert.ok(html.includes("js.src = '/lib/exercise-anim.js'"));
assert.ok(/exaShow\(document\.getElementById\('modal-anim'\), ex\.name\)/.test(html));
assert.ok(/onclick="anExDemo\(this\)"/.test(html) && /function anExDemo\(li\)/.test(html));
assert.ok(/_anExList\.push\(x\.name\)/.test(html), 'Bài tập gợi ý của thẻ cơ cũng mở hình');
assert.ok(/it\.el\.isConnected/.test(fs.readFileSync(path.join(root, 'lib', 'exercise-anim.js'), 'utf8')), 'dừng khi hình bị gỡ');
console.log('exercise-anim ok');
