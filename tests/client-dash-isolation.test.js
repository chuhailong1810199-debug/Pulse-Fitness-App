/**
 * Khách xem được dashboard của CHÍNH MÌNH, và không gì hơn.
 *
 * Luật Firestore mới là chốt chặn thật (isClientOwner so theo email). Mấy phép
 * kiểm này giữ phần giao diện: không mở được hồ sơ người khác, không bày ra
 * đường nhảy sang khách khác, và mọi đường dẫn Firestore đều mang đúng id của
 * chính họ.
 */
const fs = require("fs"), vm = require("vm"), path = require("path"), assert = require("assert");
const s = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

const brace = (i) => { let j = s.indexOf("{", i), d = 0, k = j;
  for (; k < s.length; k++) { const c = s[k];
    if (c === "{") d++; else if (c === "}") { d--; if (!d) { k++; break; } } } return k; };
const take = (n) => { for (const pre of ["\nfunction ", "\nasync function "]) {
    const i = s.indexOf(pre + n + "("); if (i >= 0) return s.slice(i, brace(i)); } 
  throw new Error("khong tim thay " + n); };

let fails = 0; const cases = [];
const ok = (n, f) => cases.push([n, f]);

// ── openClientDash ────────────────────────────────────────────────────
function mkOpen(role, ownId) {
  const log = { switched: [], shown: [] };
  const ctx = { console, userRole: role, activeClient: { id: ownId },
    switchClient: async (id) => { log.switched.push(id); },
    showPage: (p) => { log.shown.push(p); },
    window: {} };
  ctx.globalThis = ctx; vm.createContext(ctx);
  vm.runInContext(take("openClientDash"), ctx);
  return { log, call: (id) => vm.runInContext(
    "openClientDash(" + JSON.stringify(id) + ")", ctx) };
}

ok("khach mo ID NGUOI KHAC -> khong doi khach, khong mo trang", async () => {
  const { log, call } = mkOpen("client", "cindy");
  await call("longchu");
  assert.strictEqual(log.switched.length, 0, "da goi switchClient sang " + log.switched);
  assert.strictEqual(log.shown.length, 0, "van mo trang cdash cho ho so nguoi khac");
});

ok("khach mo ID CUA MINH -> mo binh thuong, khong can doi khach", async () => {
  const { log, call } = mkOpen("client", "cindy");
  await call("cindy");
  assert.deepStrictEqual(log.shown, ["cdash"]);
  assert.strictEqual(log.switched.length, 0, "khong duoc goi switchClient cho chinh minh");
});

ok("khach goi khong kem id -> van mo ho so cua minh", async () => {
  const { log, call } = mkOpen("client", "cindy");
  await call(undefined);
  assert.deepStrictEqual(log.shown, ["cdash"]);
});

ok("coach van mo duoc ho so bat ky", async () => {
  const { log, call } = mkOpen("coach", "longchu");
  await call("cindy");
  assert.deepStrictEqual(log.switched, ["cindy"], "coach phai doi duoc sang khach khac");
  assert.deepStrictEqual(log.shown, ["cdash"]);
});

// ── renderClientDash: cai gi hien ra cho ai ───────────────────────────
function mkRender(role) {
  let html = "";
  const el = { innerHTML: "", classList: { add() {}, toggle() {}, contains: () => false } };
  Object.defineProperty(el, "innerHTML", {
    get: () => html, set: (v) => { html = v; }, configurable: true });
  const ctx = {
    console, Math, Object, String, Array, JSON, Number,
    userRole: role,
    activeClient: { id: "cindy", name: "Cindy", level: "Intermediate",
      program: { SessionA: { phases: [{ name: "P", tag: "strength",
        exercises: [{ name: "Squat", setsReps: "3 × 8" }] }] } } },
    _cdash: { clientId: "cindy", byName: {}, sessions: [], loads: {} },
    document: { getElementById: (id) => (id === "cdash-body" ? el : null) },
    loadClientDash: async () => {},
    accessStatus: () => ({ state: "active", daysLeft: 20 }),
    ACCESS_LABEL: { active: "Đang hoạt động" },
    _daysSince: () => 2, inactiveThreshold: () => 5,
    _cdDate: () => "01/10", cdTrend: () => null, _cdSpark: () => "",
    cdMuscles: () => [], cdLoadValue: () => "", parseSetsCount: () => 3,
    escHtml: (x) => String(x == null ? "" : x),
    dashClientStrip: () => "<!--DAI-KHACH-->",
  };
  ctx.globalThis = ctx; vm.createContext(ctx);
  vm.runInContext(take("renderClientDash"), ctx);
  return { get html() { return html; },
    run: () => vm.runInContext("renderClientDash()", ctx) };
}

ok("khach KHONG thay nut 'Tat ca khach' va KHONG thay dai khach", async () => {
  const r = mkRender("client"); await r.run();
  assert(r.html.length > 100, "khong render ra gi");
  assert(!/Tất cả khách/.test(r.html), "van con nut quay ve trang tat ca khach");
  assert(!/DAI-KHACH/.test(r.html), "van con dai chuyen khach");
  assert(!/Mở giáo án để sửa/.test(r.html), "khach khong sua giao an, nhan phai khac");
  assert(/Mở giáo án/.test(r.html), "thieu nut mo giao an");
});

ok("coach VAN thay day du", async () => {
  const r = mkRender("coach"); await r.run();
  assert(/Tất cả khách/.test(r.html), "coach mat nut quay ve");
  assert(/DAI-KHACH/.test(r.html), "coach mat dai chuyen khach");
  assert(/Mở giáo án để sửa/.test(r.html));
});

ok("khach van thay phan tap cua minh", async () => {
  const r = mkRender("client"); await r.run();
  assert(/Cindy/.test(r.html), "thieu ten khach");
  assert(/Squat/.test(r.html), "thieu bai tap trong giao an");
  assert(/Session A|SessionA/.test(r.html), "thieu buoi tap");
});

// ── loadClientDash: moi duong dan deu mang id cua chinh khach ─────────
ok("moi duong dan Firestore deu la cua chinh khach", async () => {
  const paths = [];
  const ctx = { console, Object, Number, String, Promise, Array,
    activeClient: { id: "cindy" }, _cdash: null,
    db: {}, limit: () => "lim", orderBy: () => "ord",
    query: (c) => c, collection: (...a) => { const p = a.slice(1).join("/"); paths.push(p); return p; },
    getDocs: async () => ({ docs: [], forEach() {} }),
    _exNameKey: (x) => x };
  ctx.globalThis = ctx; vm.createContext(ctx);
  vm.runInContext(take("loadClientDash"), ctx);
  await vm.runInContext("loadClientDash(true)", ctx);
  assert(paths.length >= 2, "khong goi Firestore lan nao? " + JSON.stringify(paths));
  const la = paths.filter((p) => !p.startsWith("clients/cindy/"));
  assert.strictEqual(la.length, 0, "co duong dan khong thuoc ve khach: " + JSON.stringify(la));
});

(async () => {
  for (const [n, f] of cases) {
    try { await f(); console.log("  OK   " + n); }
    catch (e) { fails++; console.log("  HONG " + n + "\n       " + e.message); }
  }
  console.log(fails ? "\n" + fails + " PHEP KIEM HONG" : "\nTAT CA DAT");
  process.exit(fails ? 1 : 0);
})();
process.on("unhandledRejection", (e) => {
  console.log("  HONG (loi lot ra ngoai) " + (e && e.message)); process.exit(1); });
