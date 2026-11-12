/**
 * Nộp buổi từ dashboard (cdSubmitDay, 2026-11-05) — chạy thẳng hàm trong index.html.
 *
 * Coach không phải sang tab Workout để bấm Complete Workout nữa. Hàm phải:
 * đổi activeDay sang đúng buổi đang mở (finishWorkout chỉ biết activeDay),
 * và tính CẢ BUỔI là đã tập — bấm Nộp ở dashboard nghĩa là xong hết bài.
 */
const fs = require("fs"), vm = require("vm"), path = require("path"), assert = require("assert");
const s = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

const brace = (i) => { let j = s.indexOf("{", i), d = 0, k = j;
  for (; k < s.length; k++) { const c = s[k];
    if (c === "{") d++; else if (c === "}") { d--; if (!d) { k++; break; } } } return k; };
const take = (n) => { for (const pre of ["\nfunction ", "\nasync function "]) {
    const i = s.indexOf(pre + n + "("); if (i >= 0) return s.slice(i, brace(i)); } return null; };

const code = "var _cdSubmitting = false;\n" + ["cdSubmitDay"].map((n) => {
  const src = take(n); assert(src, "khong tim thay " + n); return src; }).join("\n");

let fails = 0;
const cases = [];
const ok = (name, fn) => cases.push([name, fn]);

const PROG = {
  SessionA: { label: "A", phases: [{ exercises: [{ name: "Squat" }, { name: "Row" }] }] },
  SessionB: { label: "B", phases: [{ exercises: [{ name: "RDL" }] }, { exercises: [{ name: "Curl" }, { name: "Plank" }] }] },
};

function mk({ activeDay = "SessionA", answer = true, ticks = {}, logged = false } = {}) {
  const log = { setDay: [], finish: 0, confirms: [], reload: 0, render: 0 };
  const ctx = {
    console, Math, Number, String, Array, JSON,
    activeClient: { id: "linh", program: PROG },
    activeDay, _sessionLogged: logged,
    exerciseState: { linh: { ...ticks } },
    getProgram: () => PROG,
    cdKeys: (c) => Object.keys(c.program),
    cdDayName: (c, k) => "Buổi " + k,
    T: (x) => x,
    confirm: (m) => { log.confirms.push(m); return answer; },
    setDay: async (d) => { log.setDay.push(d); ctx.activeDay = d; },
    finishWorkout: async () => { log.finish++; log.doneAtFinish = { ...ctx.exerciseState.linh }; },
    loadClientDash: async () => { log.reload++; },
    cdRender: () => { log.render++; },
    document: { getElementById: () => ({}) },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  const call = (k) => vm.runInContext(`cdSubmitDay(${JSON.stringify(k)}, null)`, ctx);
  return { ctx, log, call };
}

ok("doi sang dung buoi roi moi nop", async () => {
  const { log, call } = mk({ activeDay: "SessionA" });
  await call("SessionB");
  assert.deepStrictEqual(log.setDay, ["SessionB"]);
  assert.strictEqual(log.finish, 1);
  assert.strictEqual(log.reload, 1, "phai nap lai dashboard sau khi nop");
});

ok("nop = ca buoi xong: tich HET moi bai, KHONG hoi", async () => {
  const { log, call } = mk({ activeDay: "SessionB" });
  await call("SessionB");
  assert.deepStrictEqual(log.setDay, [], "dang o dung buoi thi khong doi");
  assert.strictEqual(log.confirms.length, 0);
  assert.deepStrictEqual(Object.keys(log.doneAtFinish).sort(), ["linh_SessionB_0_0", "linh_SessionB_1_0", "linh_SessionB_1_1"]);
});

ok("da tich mot phan -> van tinh ca buoi", async () => {
  const { log, call } = mk({ ticks: { linh_SessionA_0_0: true } });
  await call("SessionA");
  assert.strictEqual(log.confirms.length, 0);
  assert.deepStrictEqual(Object.keys(log.doneAtFinish).sort(), ["linh_SessionA_0_0", "linh_SessionA_0_1"]);
});

ok("da nop hom nay -> khong hoi, de finishWorkout hien lai ket qua", async () => {
  const { log, call } = mk({ logged: true });
  await call("SessionA");
  assert.strictEqual(log.confirms.length, 0);
  assert.strictEqual(log.finish, 1);
});

ok("nut nop co trong khung chi tiet va duoc noi vao click", async () => {
  assert.match(take("cdDetailHTML"), /class="cd-submit"/);
  assert.match(take("cdBind"), /\.cd-submit'\)\)\) return cdSubmitDay\(/);
});

(async () => {
  for (const [name, fn] of cases) {
    try { await fn(); console.log("  OK   " + name); }
    catch (e) { fails++; console.log("  HONG " + name + "\n       " + e.message); }
  }
  console.log(fails ? "\n" + fails + " PHEP KIEM HONG" : "\nTAT CA DAT");
  process.exit(fails ? 1 : 0);
})();
process.on("unhandledRejection", (e) => {
  console.log("  HONG (loi lot ra ngoai) " + (e && e.message));
  process.exit(1);
});
