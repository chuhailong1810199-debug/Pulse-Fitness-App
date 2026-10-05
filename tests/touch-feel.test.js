/**
 * Cảm giác chạm toàn app: nhún khi bấm, vòng lấy nét bàn phím, bỏ vệt xám.
 *
 * Phép kiểm quan trọng nhất ở đây là cái CUỐI: giữ cho luật transform đừng
 * bị nới rộng ra. transform biến phần tử thành khung chứa mới cho mọi con
 * position:fixed bên trong — quét bừa là popup nhảy lung tung, mà triệu chứng
 * thì xa chỗ sửa nên rất khó lần.
 */
const fs = require("fs"), path = require("path"), assert = require("assert");
const s = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const i = s.indexOf("══ CẢM GIÁC CHẠM TOÀN APP");
assert(i >= 0, "khong tim thay khoi CSS cam giac cham");
const css = s.slice(i, s.indexOf("══ BỘ CHỌN KHÁCH", i));

let fails = 0;
const ok = (n, f) => { try { f(); console.log("  OK   " + n); }
  catch (e) { fails++; console.log("  HONG " + n + "\n       " + e.message); } };

console.log("Cam giac cham\n");

ok("bo vet xam khi cham va do tre 300ms", () => {
  assert(/-webkit-tap-highlight-color:\s*transparent/.test(css), "thieu tap-highlight");
  assert(/touch-action:\s*manipulation/.test(css), "thieu touch-action");
});

ok("co vong lay net ban phim, dung mau nhan cua app", () => {
  const m = /:focus-visible[^{]*\{([^}]*)\}/.exec(css);
  assert(m, "thieu luat focus-visible");
  assert(/outline:\s*2px solid var\(--accent/.test(m[1]), "vong lay net khong dung --accent");
  // outline khong chiem cho -> khong xo bo cuc. border thi co.
  assert(!/\bborder:\s*\d/.test(m[1]), "dung border lam vong lay net se xo bo cuc, phai dung outline");
});

ok("nut nhun khi bam, nut dang khoa thi khong", () => {
  const m = /button:not\(:disabled\):active[^{]*\{([^}]*)\}/.exec(css);
  assert(m, "thieu luat nhun khi bam");
  assert(/transform:\s*scale\(\.9[0-9]\)/.test(m[1]), "gia tri scale: " + m[1]);
  assert(/:not\(:disabled\)/.test(css), "nut dang khoa van gia vo bam duoc");
});

ok("nut dai ngang thi mo di, khong thu nho ca khoi", () => {
  assert(/\.finish-btn:not\(:disabled\):active[\s\S]{0,140}transform:\s*none/.test(css),
    "nut trai het chieu ngang ma thu nho ca khoi thi trong nhu trang bi rung");
});

ok("he thong xin giam chuyen dong thi tat sach", () => {
  const m = /@media \(prefers-reduced-motion: reduce\)\{([\s\S]*?)\n\}/.exec(css);
  assert(m, "thieu khoi giam chuyen dong");
  assert(/transform:\s*none/.test(m[1]), "khong tat transform");
  assert(/transition:\s*none/.test(m[1]), "khong tat transition");
});

ok("hover chi tren may co chuot that", () => {
  assert(/@media \(hover: hover\) and \(pointer: fine\)/.test(css),
    "thieu chan hover — tren cam ung :hover dinh lai sau khi cham");
});

// ── Phep kiem giu pham vi ────────────────────────────────────────────
ok("luat transform KHONG duoc noi ra ngoai button", () => {
  // Lay moi selector co :active va co transform trong khoi nay
  const bad = [];
  const re = /([^{}]+):active[^{]*\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(css))) {
    if (!/transform:\s*scale/.test(m[2])) continue;
    const sel = (m[1] + ":active").replace(/\s+/g, " ").trim();
    // chi cho phep: button, va vai lop da biet la khong boc popup
    for (const part of sel.split(",")) {
      const p = part.trim();
      if (!p) continue;
      const okSel = /^button(:not\(:disabled\))?:active$/.test(p)
        || /^\.(nav-tab|day-tab):active$/.test(p);
      if (!okSel) bad.push(p);
    }
  }
  assert.strictEqual(bad.length, 0,
    "transform tren selector chua duoc dò: " + bad.join(", ")
    + ". transform tao khung chua moi cho con position:fixed — phai dò lai "
    + "24 selector position:fixed cua app truoc khi mo rong.");
});

ok("khong quet bang dau sao", () => {
  assert(!/^\s*\*\s*[,{]/m.test(css), "co selector * — se cham vao moi thu ke ca the layout");
});

console.log(fails ? "\n" + fails + " PHEP KIEM HONG" : "\nTAT CA DAT");
process.exit(fails ? 1 : 0);
