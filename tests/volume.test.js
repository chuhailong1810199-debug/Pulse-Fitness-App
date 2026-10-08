/**
 * Volume (tonnage) và mức tạ trong dashboard.
 *
 * Hai lỗi đã sửa 2026-10-08:
 *  1. Ô tạ được điền sẵn số buổi trước cho MỌI bài; lúc hoàn thành, mọi bài có
 *     số đều bị cộng volume và ghi lịch sử — kể cả bài không tập.
 *  2. Số sau dấu × luôn là rep: "4 × 250m" thành 250 rep, "3 × 30s" thành 30 rep.
 */
const fs = require("fs"), path = require("path"), assert = require("assert");
const s = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
let fails = 0;
const ok = (n, f) => { try { f(); console.log("  OK   " + n); }
  catch (e) { fails++; console.log("  HONG " + n + "\n       " + e.message); } };

const i = s.indexOf("function parsePrescription(");
const j = s.indexOf("// Split \"4 × 8\"", i);
const { parsePrescription: P, exerciseTonnage: T } = new Function(s.slice(i, j) + "; return { parsePrescription, exerciseTonnage };")();
const reps = (x) => { const r = P(x); return Array.from({ length: r.sets }, (_, k) => r.repsAt(k)); };

console.log("Volume + muc ta\n");

ok("dang thuong: 3 × 8, 3x10, 3 X 15, 4 × 5 reps", () => {
  assert.deepStrictEqual(reps("3 × 8"), [8, 8, 8]);
  assert.deepStrictEqual(reps("3x10"), [10, 10, 10]);
  assert.deepStrictEqual(reps("3 X 15"), [15, 15, 15]);
  assert.deepStrictEqual(reps("4 × 5 reps"), [5, 5, 5, 5]);
});
ok("khoang rep lay so thap: 3 × 6-8, 3 × 8–10", () => {
  assert.deepStrictEqual(reps("3 × 6-8"), [6, 6, 6]);
  assert.deepStrictEqual(reps("3 × 8–10"), [8, 8, 8]);
});
ok("rep theo tung set: 3 x 8.8.8, 4 x 6.6.8.8, 3 × 8/10/12", () => {
  assert.deepStrictEqual(reps("4 x 6.6.8.8"), [6, 6, 8, 8]);
  assert.deepStrictEqual(reps("3 × 8/10/12"), [8, 10, 12]);
  assert.strictEqual(T("3 × 8/10/12", [100, 100, 100]), 3000);
});
ok("mot ben tinh hai ben: /bên, /side, each leg, mỗi bên, /tay", () => {
  for (const x of ["2 × 10/bên", "2 × 10/side", "2 × 10 each leg", "2 × 10 mỗi bên", "2 × 10/tay", "2 × 10 each side"]) {
    assert.deepStrictEqual(reps(x), [20, 20], x);
  }
});
ok("bai thoi gian / quang duong / calo: KHONG co tonnage", () => {
  for (const x of ["3 × 30s", "4 × 250m", "1 × 5 min", "1 × 4 phút", "30 phút", "400m", "1 × 1km",
    "8 rounds × 10 cal", "2 × 45s/side", "3 × 20–30s", "7x1mín speed 8.5", "AMRAP × 250m", "—", ""]) {
    assert.strictEqual(P(x).lifting, false, x);
    assert.strictEqual(T(x, [100, 100], 100), 0, x);
  }
});
ok("loi cu: day xe 4 × 250m @100kg tung bi tinh 100.000kg", () => assert.strictEqual(T("4 × 250m", [100, 100, 100, 100]), 0));
ok("vong/round: 8 rounds × 6, 3 vòng × 12, AMRAP × 10", () => {
  assert.strictEqual(P("8 rounds × 6").sets, 8);
  assert.deepStrictEqual(reps("3 vòng × 12"), [12, 12, 12]);
  assert.deepStrictEqual(reps("AMRAP × 10"), [10]);
});
ok("tonnage: theo tung set neu co, khong thi sets × ta chung", () => {
  assert.strictEqual(T("3 × 8", [60, 70, 80]), 60 * 8 + 70 * 8 + 80 * 8);
  assert.strictEqual(T("3 × 8", [], 50), 3 * 8 * 50);
  assert.strictEqual(T("3 × 8", [null, 0, -5], 0), 0);
});
ok("chu thich trong ngoac khong lam sai: 3 × 10 (giữ 5s)", () => assert.deepStrictEqual(reps("3 × 10 (giữ 5s)"), [10, 10, 10]));

const fi = s.indexOf("async function finishWorkout(");
const fw = s.slice(fi, s.indexOf("\nasync function ", fi + 30));
ok("finishWorkout: chi bai DA TICH vao volume va lich su", () => {
  assert((fw.match(/if \(!_isDone\((key|exerciseKey)\)\) return;/g) || []).length >= 3,
    "pre-compute, volume chính và dòng lịch sử phải bỏ bài chưa tích");
});
ok("finishWorkout: hoi bai co ta ma chua tich", () => {
  assert(/CHƯA đánh dấu xong/.test(fw) && /confirm\(/.test(fw));
});
ok("finishWorkout: khong con cach doc sets×reps cu", () => {
  assert(!/\(\\d\+\)\\s\*\[x×\]\\s\*\(\\d\+\)/.test(fw), "còn regex cũ coi số sau × là rep");
  assert((fw.match(/exerciseTonnage\(/g) || []).length >= 3);
});
ok("mo lai tom tat hien so DA LUU, khong tinh lai tu o ta", () => {
  assert(/let replayVol = _lastSavedTonnage;/.test(fw));
  assert(/_lastSavedTonnage = null;/.test(s), "phải xoá khi đổi khách/buổi");
});

ok("bang lich su tung bai tinh lai bang bo doc moi (sua ca dong cu)", () => {
  const g = s.slice(s.indexOf("function getKgHistoryTable("), s.indexOf("function getKgHistoryTable(") + 3000);
  assert(/const vol = exerciseTonnage\(ex\?\.setsReps, sl, h\.kg\);/.test(g));
});

console.log(fails ? "\n" + fails + " HONG" : "\nTAT CA DAT");
process.exit(fails ? 1 : 0);
