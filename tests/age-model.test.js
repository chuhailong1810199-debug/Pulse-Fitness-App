/**
 * Mô hình Tuổi Pulse (_hsAge) — chạy thẳng hàm trong index.html.
 *
 * Bản đầu cho ra "15 tuổi" với người 27 tuổi tập đều, vì công thức Gompertz
 * ra độ lệch không phụ thuộc tuổi. Mấy phép kiểm dưới đây giữ cho chuyện đó
 * không quay lại khi ai đó chỉnh hệ số.
 */
const fs = require("fs"), vm = require("vm"), path = require("path"), assert = require("assert");

const s = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const brace = (i) => { let j = s.indexOf("{", i), d = 0, k = j;
  for (; k < s.length; k++) { const c = s[k];
    if (c === "{") d++; else if (c === "}") { d--; if (!d) { k++; break; } } } return k; };
const take = (n) => {
  let i = s.indexOf("\nfunction " + n + "("); if (i >= 0) return s.slice(i, brace(i));
  for (const kw of ["const", "let"]) { i = s.indexOf("\n" + kw + " " + n + " =");
    if (i >= 0) { let d = 0, k = s.indexOf("=", i);
      for (; k < s.length; k++) { const c = s[k];
        if ("{[(".includes(c)) d++; else if ("}])".includes(c)) d--;
        else if (c === ";" && d === 0) { k++; break; } } return s.slice(i, k); } }
  return null; };
const have = new Map(), q = ["_hsCompute", "_hsAge"];
while (q.length) { const n = q.shift(); if (have.has(n)) continue;
  const src = take(n); if (src === null) { have.set(n, ""); continue; } have.set(n, src);
  for (const m of src.matchAll(/\b((?:_rc|_hs|RC_|HS_)\w+)/g)) if (!have.has(m[1])) q.push(m[1]); }
const ctx = { console, Math, Date, Array, String, Number, JSON, isFinite, Intl };
ctx.globalThis = ctx; vm.createContext(ctx);
vm.runInContext([...have.values()].filter(Boolean).join("\n"), ctx);

/**
 * Dựng N đêm giả. `liftEvery` = cứ mấy đêm thì có một buổi tạ.
 *
 * KHÔNG dùng Math.random() ở đây. Bản đầu random số buổi tạ, nên phép kiểm
 * đơn điệu lúc đạt lúc hỏng tuỳ lần chạy — và cái hỏng là fixture chứ không
 * phải mô hình. Một bài test chập chờn còn tệ hơn không có bài test nào.
 */
function nights({ n = 14, sleepH = 7.5, rhr = 55, hrv = 55, zoneMin = 30, liftEvery = 3 }) {
  return [...Array(n)].map((_, i) => ({
    date: "2026-09-" + String(10 + i).padStart(2, "0"),
    sleep: { total: sleepH * 3600, hrMin: rhr },
    recharge: { hrv },
    load: { zoneSec: [0, 0, zoneMin * 60, 0, 0],
            workouts: liftEvery && i % liftEvery === 0 ? [{ sport: "STRENGTH_TRAINING" }] : [] },
  }));
}
const steps = (n, v) => [...Array(n)].map((_, i) => ({ date: "2026-09-" + String(10 + i).padStart(2, "0"), steps: v }));

const age = (opts, stepCount, birthdate) => {
  ctx.rec = nights(opts); ctx.act = steps(opts.n || 14, stepCount); ctx.prof = { birthdate };
  return vm.runInContext("_hsAge(_hsCompute(rec, act), rec, prof)", ctx);
};

// Sinh 1999 -> khoảng 27 tuổi; sinh 1966 -> khoảng 60.
const YOUNG = "1999-10-18", OLD = "1966-05-02";
let fails = 0;
const ok = (name, fn) => { try { fn(); console.log("  OK   " + name); }
  catch (e) { fails++; console.log("  HONG " + name + "\n       " + e.message); } };

console.log("Mo hinh Tuoi Pulse\n");

ok("nguoi tre khoe KHONG duoc ra tuoi thieu nien", () => {
  const a = age({ sleepH: 7.5, rhr: 45, hrv: 95, zoneMin: 40, liftEvery: 2 }, 11000, YOUNG);
  assert(a, "phai ra so");
  assert(a.bioAge >= 18, "tuoi Pulse " + a.bioAge + " < 18");
  assert(a.bioAge > a.age * 0.7, "tuoi Pulse " + a.bioAge + " thap phi ly so voi " + a.age);
});

ok("lech khong vuot 22% tuoi that", () => {
  for (const bd of [YOUNG, OLD])
    for (const o of [{ rhr: 40, hrv: 120, sleepH: 8.5, zoneMin: 60, liftEvery: 1 },
                     { rhr: 95, hrv: 15, sleepH: 4.5, zoneMin: 0, liftEvery: 0 }]) {
      const a = age(o, o.rhr > 80 ? 1500 : 12000, bd);
      assert(Math.abs(a.delta) <= a.age * 0.22 + 0.11,
        "lech " + a.delta + " vuot 22% cua " + a.age);
    }
});

ok("loi song kem -> GIA hon tuoi that", () => {
  const a = age({ rhr: 88, hrv: 18, sleepH: 5, zoneMin: 0, liftEvery: 0 }, 2200, OLD);
  assert(a.delta > 0, "lech phai duong, dang la " + a.delta);
  assert(a.pace > 1, "nhip phai > 1x, dang la " + a.pace);
});

ok("nhip lao hoa khop voi do lech (cung mot mo hinh)", () => {
  for (const o of [{ rhr: 45, hrv: 90 }, { rhr: 85, hrv: 20 }, { rhr: 62, hrv: 50 }]) {
    const a = age(o, 6000, YOUNG);
    const expect = Math.round(Math.exp(a.delta * Math.LN2 / 8) * 100) / 100;
    assert(Math.abs(expect - a.pace) < 0.011,
      "pace " + a.pace + " khong khop delta " + a.delta + " (phai la " + expect + ")");
  }
});

ok("nhip tim nghi thap hon thi tre hon (don dieu)", () => {
  let prev = -Infinity;
  for (const rhr of [42, 50, 58, 66, 74, 82]) {
    const a = age({ rhr }, 6000, OLD);
    assert(a.delta >= prev - 1e-9,
      "rhr " + rhr + ": lech " + a.delta + " thap hon muc truoc " + prev);
    prev = a.delta;
  }
});

ok("thieu ngay ngu thi tra null chu khong doan bua", () => {
  ctx.rec = nights({ n: 2 }); ctx.act = steps(2, 6000); ctx.prof = { birthdate: YOUNG };
  assert.strictEqual(vm.runInContext("_hsAge(_hsCompute(rec, act), rec, prof)", ctx), null);
});

ok("khong co ngay sinh thi tra null", () => {
  assert.strictEqual(age({}, 6000, undefined), null);
  assert.strictEqual(age({}, 6000, "khong-phai-ngay"), null);
});

console.log(fails ? "\n" + fails + " PHEP KIEM HONG" : "\nTAT CA DAT");
process.exit(fails ? 1 : 0);
