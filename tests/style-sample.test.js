/**
 * pulseGenerateFree là callable công khai: mẫu giáo án đưa vào prompt KHÔNG
 * được mang thông tin cá nhân của khách thật.
 */
const path = require("path"), assert = require("assert"), fs = require("fs");
const { styleSampleFromProgram: pick } = require(path.join(__dirname, "..", "functions", "style-sample.js"));

let fails = 0;
const ok = (n, f) => { try { f(); console.log("  OK   " + n); }
  catch (e) { fails++; console.log("  HONG " + n + "\n       " + e.message); } };

const real = {
  SessionB: { label: "Pull", phases: [{ name: "Main", exercises: [{ name: "Row", setsReps: "3 × 10" }] }] },
  SessionA: {
    label: "Cindy — Lower",
    note: "Cindy đau lưng dưới, bác sĩ dặn tránh gập",
    phases: [
      { name: "⚡ Warmup", tag: "w", exercises: [{ name: "Glute bridge", setsReps: "2 × 12", tempo: "2-1-1",
        cue: "Cindy siết mông, đừng ưỡn — thoát vị L5", notes: "SĐT 0909..." }] },
      { name: "⚡ Strength", exercises: [{ name: "Goblet squat", setsReps: "3 × 8", tempo: "3-1-1", cue: "gối hướng mũi chân" }] },
      { name: "rỗng", exercises: [] },
    ],
  },
};

console.log("Mau phong cach cho callable cong khai\n");

ok("lay buoi dau theo thu tu khoa (SessionA)", () => {
  assert.strictEqual(pick(real).phases[0].exercises[0].name, "Glute bridge");
});
ok("giu khung: ten phase, ten bai, sets x reps, tempo", () => {
  const p = pick(real).phases[1].exercises[0];
  assert.deepStrictEqual(p, { name: "Goblet squat", setsReps: "3 × 8", tempo: "3-1-1" });
});
ok("KHONG mang cue, notes, label, note cua khach", () => {
  const j = JSON.stringify(pick(real));
  for (const leak of ["Cindy", "lưng", "thoát vị", "0909", "gối", "bác sĩ"]) {
    assert(!j.includes(leak), "lọt ra: " + leak);
  }
});
ok("bo phase rong", () => assert.strictEqual(pick(real).phases.length, 2));
ok("giao an rong/sai dang -> null, khong nem loi", () => {
  for (const x of [null, undefined, {}, { SessionA: {} }, { SessionA: { phases: "x" } }, "abc"]) {
    assert.strictEqual(pick(x), null);
  }
});
ok("index.js khong con dua clientGoal vao prompt cong khai", () => {
  const s = fs.readFileSync(path.join(__dirname, "..", "functions", "index.js"), "utf8");
  const i = s.indexOf("exports.pulseGenerateFree");
  const body = s.slice(i, s.indexOf("exports.", i + 30));
  assert(!/clientGoal/.test(body), "còn clientGoal");
  assert(/styleSampleFromProgram\(/.test(body), "không qua styleSampleFromProgram");
  assert(!/collection\("clients"\)\.get\(\)/.test(body), "còn đọc TOÀN BỘ clients mỗi lượt gọi công khai");
});

console.log(fails ? "\n" + fails + " HONG" : "\nTAT CA DAT");
process.exit(fails ? 1 : 0);
