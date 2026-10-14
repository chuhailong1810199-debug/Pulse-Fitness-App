/**
 * Hình cơ thể trên dashboard khách: MỘT người nguyên khối, chạm để xoay ra sau.
 *
 * Bản cũ vẽ HAI người cạnh nhau trong một SVG (<g transform="translate(112 0)">),
 * mỗi người rộng ~38px ở màn 390 — 21 vùng cơ không đọc nổi. Bản mới vẽ một
 * người cao 400px và lật mặt.
 *
 * Điều dễ hỏng nhất, và là lý do file này tồn tại: 12 trong 21 vùng CHỈ có ở
 * mặt sau. Nếu hình luôn mở mặt trước thì coach nhìn một buổi kéo lưng và
 * tưởng khách chỉ tập 2 nhóm, trong khi thật ra là 6. Phần lớn phép kiểm dưới
 * đây bảo vệ đúng chuyện đó.
 */
const fs = require("fs"), vm = require("vm"), path = require("path"), assert = require("assert");
const s = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const css = [...s.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join("\n")
  .replace(/\/\*[\s\S]*?\*\//g, "");
const css1 = css.replace(/\s*\n\s*/g, "");

let fails = 0; const cases = [];
const ok = (n, f) => cases.push([n, f]);

// Mặt đang hiện = data-side TRÊN THẺ HÌNH. Không được dò /data-side="b"/ trong
// cả chuỗi: hai nút Trước/Sau cũng mang data-side, nên phép kiểm kiểu đó luôn
// xanh dù hình mở sai mặt — đúng lỗi đã lọt qua một vòng đột biến.
function matHienRa(html) {
  const m = /<div class="cd-fig[^"]*" data-side="([fb])"/.exec(html);
  assert(m, "khong doc duoc data-side tren the .cd-fig");
  return m[1];
}

// Dựng ĐÚNG khối cd* đang chạy, không chép tay.
function mk(byMuscle) {
  const ctx = {
    console, Math, Object, String, Array, JSON, Number, Date, isNaN, parseFloat, parseInt,
    userRole: "coach",
    activeClient: { id: "cindy", name: "Cindy", level: "Intermediate", program: {} },
    _cdash: { clientId: "cindy", byName: {}, loads: {}, sessions: [
      { at: new Date().toISOString(), day: "SessionA", done: 6, total: 6, byMuscle },
    ] },
    escHtml: (x) => String(x == null ? "" : x),
    clientAlert: () => null, parseSetsCount: () => 3,
    // cdReduce() hỏi matchMedia; VM không có nên phải giả lập, mặc định là
    // KHÔNG giảm chuyển động (đường chạy thường).
    matchMedia: () => ({ matches: false }),
  };
  ctx.globalThis = ctx; ctx.window = ctx; vm.createContext(ctx);
  const i0 = s.indexOf("var CD_STEP_GOAL");
  const i1 = s.indexOf("async function renderClientDash()", i0);
  assert(i0 > 0 && i1 > i0, "khong cat duoc khoi cd*");
  vm.runInContext(s.slice(i0, i1), ctx);
  vm.runInContext("_cdd.id = 'cindy'; _cdd.side = null; _cdd.sel = null; _cdd.scope = 'last';", ctx);
  return { ctx, html: () => vm.runInContext("cdBodyHTML(activeClient, true)", ctx) };
}

// Tên nhóm cơ phải có thật trong CD_MUSCLE_MAP, nếu không cdMapMuscle trả rỗng
// và cả bài kiểm thành vô nghĩa mà vẫn xanh.
const SAU = { "Latissimus Dorsi": 4, "Glutes": 4, "Hamstrings": 3, "Calves": 2, "Triceps": 2 };
const TRUOC = { "Chest": 5, "Quads": 5, "Abs": 3, "Biceps": 2 };

ok("du lieu mau co thuc su to duoc vung — neu khong, moi bai duoi deu vo nghia", async () => {
  for (const [ten, d] of [["sau", SAU], ["truoc", TRUOC]]) {
    const h = mk(d).html();
    assert((h.match(/class="cd-rg on/g) || []).length > 0,
      "bo du lieu " + ten + " khong to sang vung nao — ten nhom co sai so voi CD_MUSCLE_MAP");
  }
});

ok("chi con MOT hinh, khong con hai nguoi canh nhau", async () => {
  const h = mk(TRUOC).html();
  assert(!/translate\(112 0\)/.test(h), "van con <g transform=translate(112 0)> cua ban hai nguoi");
  assert.strictEqual((h.match(/<svg /g) || []).length, 1, "phai dung mot <svg> trong the hinh");
  // Hai mặt nằm sẵn trong SVG, CSS chọn mặt hiện — không dựng lại khi lật.
  assert(/cd-face-f/.test(h) && /cd-face-b/.test(h), "thieu mot trong hai mat");
  assert(/class="cd-body"/.test(h), "thieu <g class=cd-body> — chu the mang transform khi lat");
});

ok("du 21 vung co, khong thieu khong thua", async () => {
  const h = mk(TRUOC).html();
  const need = ["chest", "delt-f", "delt-s", "delt-r", "biceps", "triceps", "forearm", "abs",
    "obliques", "quads", "adductors", "hams", "glutes", "calves", "traps", "traps-lo",
    "rhomboids", "lats", "teres", "rotator", "erectors"];
  const have = new Set([...h.matchAll(/data-r="([^"]+)"/g)].map((m) => m[1]));
  assert.deepStrictEqual(need.filter((k) => !have.has(k)), [], "thieu vung");
  assert.deepStrictEqual([...have].filter((k) => !need.includes(k)), [], "co vung la");
});

// ── Luật quan trọng nhất: mở ở mặt mang nhiều khối lượng hơn ─────────
ok("buoi thien SAU thi mo ra la thay mat sau", async () => {
  assert.strictEqual(matHienRa(mk(SAU).html()), "b",
    "buoi keo lung/chan sau ma van mo mat truoc — coach se tuong khach tap it hon that");
});

ok("buoi thien TRUOC thi mo mat truoc", async () => {
  assert.strictEqual(matHienRa(mk(TRUOC).html()), "f");
});

ok("hoa thi mo mat truoc, khong nhay lung tung", async () => {
  // delt-s và forearm nằm ở CẢ HAI mặt nên khối lượng hai bên bằng nhau.
  assert.strictEqual(matHienRa(mk({ "Lateral Deltoid": 3, "Forearms": 2 }).html()), "f",
    "hoa ma khong mo mat truoc");
});

ok("mat coach da tu chon thi de nguyen, khong tu doi lai", async () => {
  const m = mk(SAU);                       // tự động sẽ chọn 'b'
  vm.runInContext("_cdd.side = 'f';", m.ctx);
  assert.strictEqual(matHienRa(m.html()), "f", "_cdd.side cua coach bi ghi de");
});

// ── Mặt đang khuất vẫn phải nói ra số ────────────────────────────────
ok("mat dang khuat van hien so vung da tap", async () => {
  const h = mk(Object.assign({}, SAU, TRUOC)).html();   // cả hai mặt đều có vùng sáng
  assert(/class="cd-side"/.test(h), "thieu nut Truoc/Sau");
  assert(/cd-has/.test(h),
    "mat dang khuat con vung sang ma khong duoc danh dau — day dung la loi 12/21 vung bi giau");
  assert(/cd-side-cap/.test(h), "thieu dong chu noi dang xem mat nao");
  assert(/Đang xem mặt (trước|sau)/.test(h), "dong chu khong noi ro mat dang xem");
});

ok("chua tap gi thi khong doa nguoi doc bang so 0", async () => {
  const h = mk({}).html();
  assert(/Chưa có vùng nào sáng/.test(h), "thieu cau cho truong hop chua tap");
  assert(!/cd-has/.test(h), "khong co vung nao sang ma van danh dau mat kia");
});

// ── Ràng buộc đã cắn dự án này nhiều lần ─────────────────────────────
ok("transform chi nam tren <g> trong SVG, khong tren hop HTML", async () => {
  // transform trên một hộp HTML tạo containing block cho con position:fixed.
  // Bảng chọn khách và khung trợ lý đều position:fixed; chuyện này đã làm hỏng
  // dự án BA lần. SVG <g> không chứa được HTML nên không dính bẫy.
  // Chỉ xét CHỦ THỂ của selector (compound cuối). `.cd-fig.cd-squash .cd-body`
  // có nhắc .cd-fig nhưng đặt transform lên .cd-body — <g> trong SVG, đúng ý đồ.
  const bad = [];
  for (const m of css.matchAll(/([^{}]*)\{([^}]*)\}/g)) {
    if (!/(^|[;{\s])(transform|backdrop-filter)\s*:/.test(m[2])) continue;
    for (const one of m[1].split(",")) {
      if (!/#cdash-page/.test(one)) continue;
      const subj = one.trim().split(/[\s>+~]+/).pop() || "";
      if (/\bcd-body\b/.test(subj)) continue;                 // <g> trong SVG: được phép
      if (/\bcd-(fig|figw|side|card|mus)\b/.test(subj)) bad.push(one.trim());
    }
  }
  assert.strictEqual(bad.length, 0,
    "transform/backdrop-filter dat len hop HTML: " + bad.join(" | "));
  assert(/#cdash-page \.cd-body\{[^}]*transform/.test(css1),
    "thieu transform tren .cd-body (<g> trong SVG)");
});

ok("lat mot lan roi dung han, va ton trong 'giam chuyen dong'", async () => {
  const i = s.indexOf("function cdFlip(");
  assert(i > 0, "khong co cdFlip");
  const f = s.slice(i, i + 900);
  assert(!/requestAnimationFrame|setInterval/.test(f), "cdFlip co vong lap chuyen dong");
  // Phải kiểm chính THÂN cdFlip gọi cdReduce(): dò chuỗi "prefers-reduced-motion"
  // quanh đó thì gỡ hẳn nhánh đi vẫn xanh, vì chữ còn ở dòng định nghĩa cdReduce.
  assert(/cdReduce\(\)/.test(f), "cdFlip khong hoi cdReduce() — nguoi bat giam chuyen dong van thay hoat anh");
  assert(/cdReduce\(\)\s*\)\s*\{[^}]*setAttribute\('data-side'/.test(f),
    "co goi cdReduce() nhung khong doi mat ngay lap tuc trong nhanh do");
  assert(/prefers-reduced-motion/.test(s), "khong con luat prefers-reduced-motion nao");
  assert(/clearTimeout/.test(f), "khong huy hen gio cu — lat nhanh hai lan se ket");
});

ok("nut Truoc/Sau bam duoc that: 44px, aria-pressed, aria-label", async () => {
  const h = mk(SAU).html();
  assert(/aria-pressed="(true|false)"/.test(h), "nut mat thieu aria-pressed");
  assert(/aria-label="[^"]*vùng đã tập"/.test(h), "nut mat thieu aria-label co so vung");
  assert(/#cdash-page \.cd-side button\{[^}]*min-height:44px/.test(css1),
    "nut mat khong du 44px");
});

ok("cham vung co KHONG con chon nhom co nua", async () => {
  // Một cú chạm không làm được hai việc, và vùng hẹp nhất chỉ 8px nên chạm
  // không trúng. Chạm bất kỳ đâu trên người = xoay; chọn nhóm cơ ở danh sách.
  assert(!/closest\('\.cd-rg\.on'\)/.test(s),
    "van con nhanh cham-vung-co-de-chon, no danh nhau voi cham-de-xoay");
  assert(/closest\('\.cd-fig'\)\) return cdFlip\(\)/.test(s), "cham vao hinh khong xoay");
});

ok("chon nhom co chi co o mat kia thi xoay nguoi lai", async () => {
  const i = s.indexOf("closest('.cd-muscle-row')");
  assert(i > 0, "khong tim thay nhanh bam danh sach nhom co");
  const f = s.slice(i, i + 600);
  assert(/cdSides\(\)/.test(f) && /_cdd\.side = cur === 'f' \? 'b' : 'f'/.test(f),
    "bam Hamstrings luc dang xem mat truoc ma hinh khong xoay — vung sang nam ngoai tam mat");
});

ok("doi khach hoac doi khoang thi chon lai mat tu dong", async () => {
  assert(/_cdd\.id !== c\.id\) \{[^}]*_cdd\.side = null/.test(s),
    "doi khach van giu mat cua khach truoc");
  assert(/_cdd\.scope = v === 'last'[^;]*;[^\n]*_cdd\.side = null/.test(s),
    "doi khoang thoi gian van giu mat cu");
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
