/**
 * Bộ chọn khách — mấy chỗ đã phải sửa khi lắp bản thiết kế vào, và cái giá
 * phải trả khi bỏ <select> gốc.
 */
const fs = require("fs"), path = require("path"), assert = require("assert");
const s = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

let fails = 0;
const ok = (n, f) => { try { f(); console.log("  OK   " + n); }
  catch (e) { fails++; console.log("  HONG " + n + "\n       " + e.message); } };

console.log("Bo chon khach\n");

ok("goi ban GOC _switchClient, khong goi lop vo hang doi", () => {
  const i = s.indexOf("function callSwitch(");
  assert(i >= 0, "khong tim thay callSwitch");
  const fn = s.slice(i, i + 500);
  assert(/window\._switchClient/.test(fn),
    "callSwitch khong dung window._switchClient — lop vo _q vut gia tri tra ve, "
    + ".then() khong bao gio chay va nut dung ten cu");
});

ok("bam theo #client-level de biet luc nao doi xong", () => {
  assert(/getElementById\('client-level'\)[\s\S]{0,200}MutationObserver/.test(s)
      || /client-level[\s\S]{0,120}MutationObserver/.test(s),
    "thieu observer tren #client-level — doi khach tu dashboard/lich se khong cap nhat nut");
});

ok("nut khong bi bop mat o man hep", () => {
  // .client-bar la dai cuon ngang: .client-bar > * deu flex:0 0 auto.
  // De .cp co min-width:0 thi no thanh thu duy nhat co, va bi bop con mui ten.
  assert(/#client-bar \.cp\{[^}]*min-width:\s*1[0-9]{2}px/.test(s),
    "thieu san min-width cho #client-bar .cp");
});

ok("script picker nam SAU script chinh", () => {
  const picker = s.lastIndexOf("window.ClientPicker");
  const app = s.lastIndexOf("window.switchClient           = function");
  assert(app >= 0 && picker >= 0, "khong tim thay moc");
  assert(picker > app,
    "picker chay TRUOC script chinh — se khong thay clientsData/_switchClient");
});

ok("khong dung ten class trung voi modal Ho so khach", () => {
  // App da dung tien to cp- cho Client Profile tu truoc (cp-input, cp-health…).
  const pickerStart = s.lastIndexOf("/* ═══ Pulse — client picker");
  const cssStart = s.indexOf("══ BỘ CHỌN KHÁCH");
  assert(cssStart >= 0, "khong tim thay khoi CSS picker");
  const pickerCss = s.slice(cssStart, s.indexOf("/* ── Healthspan", cssStart));
  const pickerJs = pickerStart >= 0 ? s.slice(pickerStart) : "";
  const mine = new Set([...(pickerCss + pickerJs).matchAll(/cp-[a-z0-9-]+/g)].map((m) => m[0]));
  // class cua modal Ho so khach, lay o phan con lai cua file
  const rest = s.slice(0, cssStart);
  const theirs = new Set([...rest.matchAll(/cp-[a-z0-9-]+/g)].map((m) => m[0]));
  const clash = [...mine].filter((x) => theirs.has(x));
  assert.strictEqual(clash.length, 0, "trung ten class voi modal Ho so khach: " + clash.join(", "));
});

ok("giu duoc nhung thu <select> goc cho khong", () => {
  const i = s.lastIndexOf("/* ═══ Pulse — client picker");
  assert(i >= 0, "khong tim thay picker");
  const js = s.slice(i);
  // ban phim
  for (const k of ["ArrowDown", "ArrowUp", "Enter", "Escape", "Tab", "Home", "End"]) {
    assert(js.includes("'" + k + "'"), "thieu xu ly phim " + k);
  }
  // may doc man hinh
  for (const a of ["role=\"listbox\"", "role=\"option\"", "aria-selected", "aria-expanded",
                   "aria-activedescendant", "aria-live"]) {
    assert(js.includes(a), "thieu thuoc tinh tro nang: " + a);
  }
  // IME tieng Viet: go Telex dang go dang chung ma Enter thi hong
  assert(/isComposing|keyCode === 229/.test(js), "khong chan IME dang go");
});

ok("vung cham du lon tren dien thoai", () => {
  const i = s.indexOf("══ BỘ CHỌN KHÁCH");
  const css = s.slice(i, s.indexOf("/* ── Healthspan", i));
  const m = /\.cp-opt\{[^}]*min-height:\s*(\d+)px/.exec(css);
  assert(m && +m[1] >= 44, "dong khach cao " + (m ? m[1] : "?") + "px, can >= 44px");
  const m2 = /\.cp-trigger\{[^}]*min-height:\s*(\d+)px/.exec(css);
  assert(m2 && +m2[1] >= 44, "nut mo cao " + (m2 ? m2[1] : "?") + "px, can >= 44px");
});

ok("o tim 16px — nho hon la Safari iOS tu phong to trang", () => {
  const i = s.indexOf("══ BỘ CHỌN KHÁCH");
  const css = s.slice(i, s.indexOf("/* ── Healthspan", i));
  const m = /\.cp-in\{[^}]*font:[^;]*?(\d+)px/.exec(css);
  assert(m && +m[1] >= 16, "o tim " + (m ? m[1] : "?") + "px");
});

ok("thanh khach canh giua o desktop, bang 'safe center'", () => {
  const m = /@media \(min-width: 701px\)\{\s*\.client-bar\{([^}]*)\}/.exec(s);
  assert(m, "thieu luat canh giua cho desktop");
  assert(/justify-content:\s*safe\s+center/.test(m[1]),
    "phai dung 'safe center'. 'center' tran + overflow-x:auto thi phan tran o DAU "
    + "bi day ra ngoai vung cuon va khong cuon toi duoc — do that tren may: -214px.");
});

console.log(fails ? "\n" + fails + " PHEP KIEM HONG" : "\nTAT CA DAT");
process.exit(fails ? 1 : 0);
