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
function mkRender(role, avatar) {
  let html = "";
  // Phan tu gia: cdBind()/cdDeck() gan su kien va do kich thuoc. Bai kiem nay
  // chi soi HTML dung ra, nen cac phuong thuc DOM chi can ton tai.
  const noop = () => {};
  const el = {
    innerHTML: "", classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    addEventListener: noop, removeEventListener: noop,
    querySelector: () => null, querySelectorAll: () => [],
    getBoundingClientRect: () => ({ width: 375, height: 600, left: 0, top: 0 }),
    scrollTo: noop, scrollLeft: 0, clientWidth: 375, offsetLeft: 0,
    style: {}, dataset: {}, setAttribute: noop, removeAttribute: noop,
    hasAttribute: () => false, getAttribute: () => null, closest: () => null,
  };
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
    loadActive: async () => {},
    // CD_MQ doc window.matchMedia luc nap khoi; VM khong co window.
    window: { matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }) },
    requestAnimationFrame: (f) => { f(0); return 1; },
    setTimeout: (f) => { if (typeof f === 'function') f(); return 1; },
    clearTimeout: () => {}, setInterval: () => 1, clearInterval: () => {},
    performance: { now: () => 0 },
    cancelAnimationFrame: () => {},
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    accessStatus: () => ({ state: "active", daysLeft: 20 }),
    ACCESS_LABEL: { active: "Đang hoạt động" },
    _daysSince: () => 2, inactiveThreshold: () => 5,
    _cdDate: () => "01/10", cdTrend: () => null, _cdSpark: () => "",
    cdMuscles: () => [], cdLoadValue: () => "", parseSetsCount: () => 3,
    escHtml: (x) => String(x == null ? "" : x),
    dashClientStrip: () => "<!--DAI-KHACH-->",
    // Ban moi dung cdChipsHTML(), doc thang clientsData.
    clientsData: [{ id: "cindy", name: "Cindy" }, { id: "kem", name: "Kem" }],
    clientAlert: () => null,
    CD_AV_CAM: "<!--CAM-->",
  };
  if (avatar !== undefined) ctx.activeClient.avatar = avatar;
  ctx.globalThis = ctx; vm.createContext(ctx);
  // Hàm avatar chạy THẬT, cắt từ index.html như mọi hàm khác ở đây.
  vm.runInContext(take("cdHasAvatar"), ctx);
  vm.runInContext(take("cdAvatarHTML"), ctx);
  // renderClientDash giờ chỉ uỷ quyền cho cdRender; nạp trọn khối cd* để màn
  // hình được dựng bằng ĐÚNG code đang chạy, không phải bản chép tay.
  const i0 = s.indexOf("var CD_STEP_GOAL");
  const i1 = s.indexOf("async function renderClientDash()", i0);
  vm.runInContext(s.slice(i0, i1), ctx);
  vm.runInContext(take("renderClientDash"), ctx);
  return { get html() { return html; },
    run: () => vm.runInContext("renderClientDash()", ctx) };
}

ok("khach KHONG thay nut 'Tat ca khach' va KHONG thay dai khach", async () => {
  const r = mkRender("client"); await r.run();
  assert(r.html.length > 100, "khong render ra gi");
  assert(!/Tất cả khách/.test(r.html), "van con nut quay ve trang tat ca khach");
  assert(!/DAI-KHACH|cd-chips|openClientDash\(/.test(r.html),
    "van con duong nhay sang khach khac");
  assert(!/Mở giáo án để sửa/.test(r.html), "khach khong sua giao an, nhan phai khac");
  assert(/Mở giáo án/.test(r.html), "thieu nut mo giao an");
});

ok("coach VAN thay day du", async () => {
  const r = mkRender("coach"); await r.run();
  assert(/Tất cả khách/.test(r.html), "coach mat nut quay ve");
  assert(/cd-chips|openClientDash\(/.test(r.html), "coach mat dai chuyen khach");
  assert(/Mở giáo án để sửa/.test(r.html));
});

ok("khach van thay phan tap cua minh", async () => {
  const r = mkRender("client"); await r.run();
  assert(/Cindy/.test(r.html), "thieu ten khach");
  assert(/Squat/.test(r.html), "thieu bai tap trong giao an");
  assert(/Session\s?A|Bu\u1ed5i A|cd-sess/.test(r.html), "thieu buoi tap");
});

// ── loadClientDash: moi duong dan deu mang id cua chinh khach ─────────

// ── anh dai dien: theo vai, va khong cho chuoi la vao src ─────────────
const AV = "data:image/jpeg;base64," + "A".repeat(64);

ok("KHACH khong doi duoc anh dai dien", async () => {
  const r = mkRender("client", AV); await r.run();
  assert(/<img src="data:image\/jpeg/.test(r.html), "khach phai thay anh cua chinh minh");
  assert(!/cd-av-cam|cdPickAvatar\(/.test(r.html), "khach khong duoc co nut doi anh");
  assert(!/cdPickAvatar/.test(r.html), "khach khong duoc goi duoc cdPickAvatar");
  assert(!/Bỏ ảnh/.test(r.html), "khach khong duoc co nut bo anh");
});

ok("COACH doi va bo duoc anh", async () => {
  const r = mkRender("coach", AV); await r.run();
  assert(/cd-av-cam[^>]*onclick="cdPickAvatar\(\)"/.test(r.html), "coach thieu nut doi anh");
  assert(/cdRemoveAvatar\(\)/.test(r.html), "coach thieu nut bo anh khi da co anh");
});

ok("chua co anh thi hien chu cai, va khong co nut bo anh", async () => {
  const r = mkRender("coach", ""); await r.run();
  assert(!/<img src=/.test(r.html), "khong co anh ma van dung the img");
  assert(/>C</.test(r.html), "thieu chu cai dau thay cho anh");
  assert(!/cdRemoveAvatar/.test(r.html), "chua co anh ma van bay nut bo anh");
});

// Truong avatar la chuoi tu Firestore, duoc ghep thang vao thuoc tinh src.
// Mot chuoi khong phai data URL anh thi phai bi tu choi, khong duoc render.
for (const bad of [
  "javascript:alert(1)",
  "https://ke-khac.example/theo-doi.gif",
  'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
  'x" onerror="alert(1)',
]) {
  ok("tu choi avatar khong hop le: " + bad.slice(0, 28), async () => {
    const r = mkRender("coach", bad); await r.run();
    assert(!/<img/.test(r.html), "chuoi la van duoc dung lam anh: " + bad);
    assert(!r.html.includes(bad), "chuoi la van lot vao HTML: " + bad);
  });
}

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

// ── Thanh tab: Dashboard dung dau ─────────────────────────────────────
ok("hai the Dashboard nam dau thanh tab va deu an san", async () => {
  const nav = s.slice(s.indexOf('<div class="nav">'), s.indexOf("</div>", s.indexOf('<div class="nav">') + 2000));
  const tabs = [...nav.matchAll(/<div class="nav-tab[^"]*"([^>]*)>([^<]*)</g)]
    .map((m) => ({ attrs: m[1], label: m[2].trim() }));
  assert(tabs.length > 8, "doc duoc " + tabs.length + " tab, bo do hong");
  assert.strictEqual(tabs[0].label, "Dashboard", "tab dau tien la " + tabs[0].label);
  assert.strictEqual(tabs[1].label, "Dashboard", "tab thu hai la " + tabs[1].label);
  assert(/id="cdash-nav-tab"/.test(tabs[0].attrs), "tab dau phai la cdash (cua khach)");
  assert(/id="dash-nav-tab"/.test(tabs[1].attrs), "tab thu hai phai la dash (cua coach)");
  for (const t of tabs.slice(0, 2))
    assert(/display:none/.test(t.attrs), "the Dashboard phai an san, chi bat theo vai tro");
  assert.strictEqual(tabs[2].label, "Workout", "sau hai the Dashboard phai la Workout");
  // Chỉ một trong hai được bật, nếu không coach thấy hai tab cùng tên.
  assert.strictEqual(tabs.filter((t) => t.label === "Dashboard").length, 2);
});

ok("moi the Dashboard chi duoc bat o dung mot cho", async () => {
  for (const id of ["cdash-nav-tab", "dash-nav-tab"]) {
    const n = (s.match(new RegExp("getElementById\\('" + id + "'\\)", "g")) || []).length;
    assert.strictEqual(n, 1, id + " duoc dong vao " + n + " cho, de bat nham ca hai");
  }
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
