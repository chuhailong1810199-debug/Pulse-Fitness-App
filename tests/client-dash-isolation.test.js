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

// ── the Nhom co: hai loi da gap tren desktop ─────────────────────────
ok("khong co luat grid nao xe doi the .cd-mus", async () => {
  // .cd-mus truoc kia la DANH SACH nhom co chia hai cot. Ban moi dung lai dung
  // ten class do cho ca THE chua hinh. Luat cu con lai thi the bi xe doi: hang
  // hinh nam trong cot 274px, grid con can 220px + noi dung nen cot hai sap ve
  // 0 va chu tran ra ngoai the. Chi thay khi khach CO du lieu Polar (the bi hep
  // lai), nen rat de lot.
  const css = [...s.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join("\n")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  const bad = [...css.matchAll(/([^{}]*\.cd-mus)\s*\{([^}]*)\}/g)]
    .filter((m) => !/\.cd-mus[-\w]/.test(m[1]) && /grid-template-columns/.test(m[2]));
  assert.strictEqual(bad.length, 0,
    "luat dat grid-template-columns thang len .cd-mus: " + bad.map((b) => b[1].trim()).join(" | ")
    + " — se xe doi the chua hinh co the");
});

ok("the moi khong mang class bi luat layout cu cua tab khac chiem", async () => {
  // LUAT CHUNG, khong chi khoa rieng chu "ac-hero".
  // Da gap HAI lan cung mot kieu: ban thiet ke moi dung lai ten class ma CSS cu
  // cua tab khac dang so huu, luat cu van ap va be nat the moi.
  //   .cd-mus  — danh sach nhom co chia hai cot  -> xe doi THE chua hinh
  //   .ac-hero — luoi 2 cot cua tab Active       -> tieu de/.ac-row/dong tong
  //              bi xep canh nhau, ba chip KPI tut tu 114px xuong 48px
  //              ("0kcal / buoi / tap", moi tu mot dong)
  // Ca hai deu IM LANG: khong loi, khong canh bao, chi nhin man hinh moi thay.
  // Nen: moi class tren the cua dashboard gop phai KHONG co luat layout nao
  // ngoai pham vi #cdash-page dat len. Muon dat luoi cho the nay thi scope vao
  // #cdash-page, de tab khac doi CSS khong keo do man nay.
  const css = [...s.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join("\n")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  const secs = [...s.matchAll(/<section class="(cd-card[^"]*)"/g)].map((m) => m[1]);
  assert(secs.length >= 2, "khong tim thay the .cd-card nao — regex da lac khoi code that");
  const toks = [...new Set(secs.flatMap((x) => x.split(/\s+/)).filter(Boolean))];
  const bad = [];
  for (const t of toks) {
    for (const m of css.matchAll(/([^{}]*)\{([^}]*)\}/g)) {
      const sel = m[1].trim(), body = m[2];
      if (sel.includes("#cdash-page")) continue;          // scope dung -> co y
      if (!new RegExp("\\." + t.replace(/[-]/g, "\\-") + "(?![-\\w])").test(sel)) continue;
      if (/grid-template-columns|display\s*:\s*grid|display\s*:\s*flex/.test(body))
        bad.push(t + " <- " + sel.replace(/\s+/g, " ").slice(0, 80));
    }
  }
  assert.strictEqual(bad.length, 0,
    "luat layout ngoai #cdash-page dang chiem class cua the dashboard gop:\n       "
    + bad.join("\n       ") + "\n       — day la kieu loi da be the Nhom co va the Hoat dong");
});

ok("khong co luat ngoai #cdash-page nao moi chiem class cua man nay", async () => {
  // LAN THU TU cung mot nguyen nhan, nen khoa ca ho chu khong khoa tung ca:
  //   .cd-mus      -> xe doi the chua hinh co the
  //   .ac-hero     -> ba chip KPI tut tu 114px xuong 48px
  //   .cd-mus-row  -> ep cot hinh xuong dung 78px va cat cut ten nhom co
  // Ca ba deu la LUAT CHET cua mot man cu, con sot lai va de len man moi dung
  // trung ten class. Deu im lang: khong loi, khong canh bao, chi nhin moi thay.
  //
  // Dau hieu that: class co CA luat scope #cdash-page (y do cua man nay) LAN
  // luat khong scope dat them thuoc tinh layout ma luat scope khong de lai.
  //
  // CHIN truong hop duoi day la hien trang luc viet bai kiem nay: phan dung
  // chung co y voi tab Active cu, do thuc te khong gay hai. Chung o day de
  // DANH SACH KHONG DAI THEM — cai thu muoi se lam bai kiem nay hong. Go duoc
  // cai nao khoi danh sach thi go, dung them vao.
  const DA_BIET = new Set(["ac-ring", "ac-side", "ac-tot", "cd-day-c", "cd-ex-n",
    "cd-ex-r", "cd-muscle-list", "cd-muscle-rank", "cd-spark",
    // cd-kpi: luat khong-scope `.cd-kpi{white-space:nowrap}` nam trong CHINH khoi
    // CSS dashboard doi cu da sinh ra .cd-mus-row. Chi #cdash-page phat ra class
    // nay (chip KPI cua the Hoat dong), nen luat do rat co the cung la code chet
    // — nhung nowrap dang thuc su ap len chip 114px, va kiem chung viec go no
    // can do lai the Hoat dong. CHUA LAM. Dung coi day la da duyet.
    "cd-kpi"]);
  const LAYOUT = new Set(["display", "grid-template-columns", "grid-auto-flow",
    "flex-direction", "white-space", "text-overflow", "position", "float", "width", "max-width"]);
  const i0 = s.indexOf("var CD_STEP_GOAL"), i1 = s.indexOf("async function renderClientDash()", i0);
  assert(i0 > 0 && i1 > i0, "khong cat duoc khoi cd* — regex da lac khoi code that");
  // KHONG doi dau " dong: class hay duoc noi chuoi, vd
  //   '<div class="cd-fig' + (sel.length ? ' has-sel' : '') + '" ...'
  // nen literal ket thuc ngay sau cd-fig. Doi dau dong la bo sot dung cai
  // container chinh cua hinh — bai kiem tung xanh oan vi loi nay.
  const toks = new Set();
  for (const m of s.slice(i0, i1).matchAll(/class="([^"'<>]*)/g))
    for (const t of m[1].split(/\s+/)) if (/^[a-z][-a-z0-9]*$/.test(t)) toks.add(t);
  assert(toks.has("cd-fig") && toks.has("cd-card"),
    "khong thu duoc class ghep dong (cd-fig) — regex lai doi dau nhay dong");
  assert(toks.size > 40, "chi thay " + toks.size + " class — doan cat sai");
  const sheet = [...s.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join("\n")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  // Quyen so huu tinh theo CO luat #cdash-page hay khong — khong doi luat do
  // cung phai dat layout. #cdash-page .cd-fig chi dat cursor/touch-action, nhung
  // .cd-fig van la class cua man nay; mot luat ngoai dat display len no van la
  // chiem. (Bai kiem ban dau bo sot dung truong hop nay.)
  const laCua = new Set(), scoped = {}, un = {};
  for (const m of sheet.matchAll(/([^{}]*)\{([^}]*)\}/g)) {
    const props = m[2].split(";").filter((p) => p.includes(":"))
      .map((p) => p.split(":")[0].trim()).filter((p) => LAYOUT.has(p));
    for (let one of m[1].split(",")) {
      one = one.trim();
      if (!one || one.startsWith("@")) continue;
      const subj = one.split(/[\s>+~]+/).pop();
      for (const t of toks) {
        if (!new RegExp("\\." + t.replace(/-/g, "\\-") + "(?![-\\w])").test(subj)) continue;
        if (one.includes("#cdash-page")) {
          laCua.add(t);
          (scoped[t] = scoped[t] || new Set()); props.forEach((p) => scoped[t].add(p));
        } else if (props.length) {
          (un[t] = un[t] || new Set()); props.forEach((p) => un[t].add(p));
        }
        break;
      }
    }
  }
  const moi = [];
  for (const t of Object.keys(un)) {
    if (!laCua.has(t) || DA_BIET.has(t)) continue;
    const chong = [...un[t]].filter((p) => !(scoped[t] || new Set()).has(p));
    if (chong.length) moi.push(t + " (" + chong.join(", ") + ")");
  }
  assert.strictEqual(moi.length, 0,
    "luat ngoai #cdash-page dang chiem class cua man dashboard khach: " + moi.join(" | ")
    + " — dung kieu loi da be .cd-mus, .ac-hero va .cd-mus-row");
});

ok("cau bao rong khong chen thang _cdd.scope vao 'N ngay qua'", async () => {
  // _cdd.scope la 'last' | 7 | 28. Chen thang vao cau dem ngay thi khi dang o
  // "Buoi gan nhat" se ra "Khong co buoi nao trong last ngay qua".
  const hits = [...s.matchAll(/'[^']*trong ' \+ _cdd\.scope \+ ' ngày/g)];
  for (const h of hits) {
    const at = s.indexOf(h[0]);
    const ctx = s.slice(Math.max(0, at - 260), at);
    assert(/_cdd\.scope === 'last'/.test(ctx),
      "cau \"trong N ngay qua\" chen thang _cdd.scope ma khong tach nhanh 'last'");
  }
  assert(hits.length > 0, "khong tim thay cau dem ngay, bo do hong");
});

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
  assert(/id="cdash-nav-tab"/.test(tabs[0].attrs), "tab dau phai la cdash (ho so mot khach)");
  assert(/id="dash-nav-tab"/.test(tabs[1].attrs), "tab thu hai phai la dash (tat ca khach)");
  for (const t of tabs.slice(0, 2))
    assert(/display:none/.test(t.attrs), "hai the nay phai an san, chi bat theo vai tro");
  assert.strictEqual(tabs[2].label, "Workout", "sau hai the do phai la Workout");
  // Luat that: hai the KHONG duoc trung ten. Truoc day ca hai deu la "Dashboard",
  // nen chi duoc bat mot cai; gio coach thay ca hai nen ten phai phan biet duoc.
  assert.notStrictEqual(tabs[0].label, tabs[1].label,
    'hai tab dau cung ten "' + tabs[0].label + '" — coach thay ca hai se khong biet cai nao la cai nao');
  assert(tabs[0].label && tabs[1].label, "tab dau khong duoc de trong nhan");
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
