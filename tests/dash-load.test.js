/**
 * Ghi tạ từ dashboard (cdSetLoad) — chạy thẳng hàm trong index.html.
 *
 * Điểm sống còn: phải ghi CẢ setLoads, không chỉ exerciseLoads. Ô nhập từng
 * set bên tab Workout đọc đúng setLoads[key][si]; chỉ ghi exerciseLoads thì
 * bên đó vẫn trống trơn và coi như mất dữ liệu.
 */
const fs = require("fs"), vm = require("vm"), path = require("path"), assert = require("assert");
const s = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

const brace = (i) => { let j = s.indexOf("{", i), d = 0, k = j;
  for (; k < s.length; k++) { const c = s[k];
    if (c === "{") d++; else if (c === "}") { d--; if (!d) { k++; break; } } } return k; };
const take = (n) => { for (const pre of ["\nfunction ", "\nasync function "]) {
    const i = s.indexOf(pre + n + "("); if (i >= 0) return s.slice(i, brace(i)); } return null; };

const code = ["cdSetLoad", "cdLoadValue"].map((n) => {
  const src = take(n); assert(src, "khong tim thay " + n); return src; }).join("\n");

// PHẢI await. Bản đầu gọi fn() không await, nên mọi lỗi trong hàm async rơi ra
// thành unhandled rejection còn dòng "OK" vẫn in ra — bài test báo đạt bất kể
// code đúng hay sai. Thà không có test còn hơn có một bài test luôn xanh.
let fails = 0;
const cases = [];
const ok = (name, fn) => cases.push([name, fn]);

/** Dựng sandbox, trả về cả ngữ cảnh lẫn những lần ghi Firestore bắt được. */
function mk({ bodyweight = null, activeDay = "SessionA" } = {}) {
  const writes = [];
  const ctx = {
    console, Math, Number, String, Array, JSON, parseFloat, isFinite, setTimeout,
    activeClient: { id: "longchu" },
    activeDay,
    _clientBodyweight: bodyweight,
    exerciseLoads: {}, setLoads: {},
    _cdash: { loads: {} },
    saveExerciseLoadsToLocal: () => {}, saveSetLoadsToLocal: () => {},
    db: {}, doc: (...a) => a.slice(1).join("/"), serverTimestamp: () => "TS",
    setDoc: async (ref, data, opts) => { writes.push({ ref, data, opts }); },
  };
  ctx.globalThis = ctx; vm.createContext(ctx); vm.runInContext(code, ctx);
  return { ctx, writes, call: (...a) => vm.runInContext(
    "cdSetLoad(" + a.map((x) => JSON.stringify(x)).join(",") + ")", ctx) };
}

console.log("Ghi ta tu dashboard\n");

ok("mot so -> MOI set deu bang so do", async () => {
  const { writes, call } = mk();
  await call("SessionA", 1, 2, 4, false, "42.5");
  assert.strictEqual(writes.length, 1);
  const k = "longchu_SessionA_1_2";
  assert.strictEqual(JSON.stringify(writes[0].data.setLoads[k]), "[42.5,42.5,42.5,42.5]",
    "setLoads phai la 4 set bang nhau, dang la " + JSON.stringify(writes[0].data.setLoads[k]));
  assert.strictEqual(writes[0].data.exerciseLoads[k], 42.5);
  // So từng trường, không deepStrictEqual: object dựng trong vm khác realm nên
  // prototype lệch và phép so sẽ hỏng dù giá trị y hệt.
  assert.strictEqual(writes[0].opts && writes[0].opts.merge, true,
    "phai merge, khong duoc ghi de ca buoi");
});

ok("so set lay dung tu giao an (3 set thi 3 gia tri)", async () => {
  const { writes, call } = mk();
  await call("SessionC", 0, 0, 3, false, "20");
  assert.strictEqual(writes[0].data.setLoads["longchu_SessionC_0_0"].length, 3);
});

ok("xoa trang -> ghi null, khong de lai so cu", async () => {
  const { writes, call } = mk();
  await call("SessionA", 0, 1, 3, false, "");
  const k = "longchu_SessionA_0_1";
  assert.strictEqual(writes[0].data.exerciseLoads[k], null);
  assert.strictEqual(writes[0].data.setLoads[k], null);
});

ok("so am hoac so rac -> coi nhu xoa", async () => {
  for (const bad of ["-5", "0", "abc"]) {
    const { writes, call } = mk();
    await call("SessionA", 0, 0, 3, false, bad);
    assert.strictEqual(writes[0].data.exerciseLoads["longchu_SessionA_0_0"], null,
      "gia tri " + bad + " dang duoc nhan");
  }
});

ok("bai bodyweight: go phan CONG THEM, luu tai that su nang", async () => {
  const { writes, call } = mk({ bodyweight: 78 });
  await call("SessionE", 1, 3, 3, true, "12");
  const k = "longchu_SessionE_1_3";
  assert.strictEqual(JSON.stringify(writes[0].data.setLoads[k]), "[90,90,90]",
    "78kg + 12kg phai ra 90, dang la " + JSON.stringify(writes[0].data.setLoads[k]));
});

ok("sua DUNG buoi dang mo thi cap nhat ca bo nho trong", async () => {
  const { ctx, call } = mk({ activeDay: "SessionA" });
  await call("SessionA", 0, 0, 3, false, "60");
  const k = "longchu_SessionA_0_0";
  assert.strictEqual(ctx.exerciseLoads[k], 60, "exerciseLoads trong bo nho chua cap nhat");
  assert.strictEqual(JSON.stringify(ctx.setLoads[k]), "[60,60,60]", "setLoads trong bo nho chua cap nhat");
});

ok("sua buoi KHAC thi khong dung vao bo nho cua buoi dang mo", async () => {
  const { ctx, call } = mk({ activeDay: "SessionA" });
  await call("SessionC", 0, 0, 3, false, "60");
  assert.strictEqual(Object.keys(ctx.exerciseLoads).length, 0, "da ghi nham vao bo nho cua SessionA");
  assert.strictEqual(Object.keys(ctx.setLoads).length, 0);
});

ok("cdLoadValue doc lai dung so vua ghi", async () => {
  const { ctx, call } = mk({ bodyweight: 78 });
  await call("SessionA", 0, 0, 3, false, "55");
  await call("SessionE", 1, 3, 3, true, "12");
  const v = (d, pi, ei, bw) => vm.runInContext(
    `cdLoadValue(${JSON.stringify(d)},${pi},${ei},${bw})`, ctx);
  assert.strictEqual(v("SessionA", 0, 0, false), "55");
  assert.strictEqual(v("SessionE", 1, 3, true), "12", "bai BW phai hien lai phan cong them");
  assert.strictEqual(v("SessionA", 9, 9, false), "", "bai chua co ta phai tra chuoi rong");
});

(async () => {
  for (const [name, fn] of cases) {
    try { await fn(); console.log("  OK   " + name); }
    catch (e) { fails++; console.log("  HONG " + name + "\n       " + e.message); }
  }
  console.log(fails ? "\n" + fails + " PHEP KIEM HONG" : "\nTAT CA DAT");
  process.exit(fails ? 1 : 0);
})();
// Không để lỗi nào lọt ra ngoài mà vẫn tính là đạt.
process.on("unhandledRejection", (e) => {
  console.log("  HONG (loi lot ra ngoai) " + (e && e.message));
  process.exit(1);
});
