/**
 * Dashboard coach: ngân sách blur và trần tương phản của lớp kính.
 *
 * Hai thứ dễ bị phá mà nhìn mắt thường không thấy:
 *
 * 1. NGÂN SÁCH BLUR. Dashboard có tới 21 dòng cảnh báo + 30 hoạt động + 21 chip.
 *    `backdrop-filter` đọc và làm mờ lại vùng phía sau mỗi lần vẽ, nên bật nó cho
 *    từng dòng là rớt khung hình đúng màn hình coach cuộn nhanh nhất. Bản thiết kế
 *    chốt: CHỈ 3 cột có blur, và chỉ từ 1024px. Thêm một `backdrop-filter` nữa vào
 *    khối này là phá thoả thuận đó.
 *
 * 2. `backdrop-filter` TẠO CONTAINING BLOCK cho con `position:fixed` — đúng cái bẫy
 *    của `transform` đã cắn dự án này một lần (press-scale phải thu về chỉ <button>).
 *    Bảng chọn khách và khung trợ lý đều `position:fixed`. Vì vậy blur phải nằm trên
 *    `.dsh-col::before`, KHÔNG nằm trên `.dsh-col`.
 *
 * 3. Màu nền phải là sắc TỐI. Thẻ phủ trắng sẽ nâng nền lên và ăn mất tương phản của
 *    chữ 10,5px; phủ tối thì kéo xuống. Bài kiểm tự tính lại tỉ lệ từ giá trị trong
 *    index.html, không chép số.
 *
 * Kiểm tĩnh, không cần trình duyệt.
 */
const fs = require("fs"), path = require("path"), assert = require("assert");
const s = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

// ── WCAG 2.x ──────────────────────────────────────────────────────────────
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const Y = (a) => 0.2126 * lin(a[0]) + 0.7152 * lin(a[1]) + 0.0722 * lin(a[2]);
const over = (fg, al, bg) => fg.map((v, i) => v * al + bg[i] * (1 - al));
const cr = (a, b) => { const x = Y(a), y = Y(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const WHITE = [255, 255, 255];
const AA = 4.5;

const bad = [];
const must = (c, m) => { if (!c) bad.push(m); };

// Khối CSS của dashboard, bóc bình luận để không khớp nhầm vào câu giải thích.
const i0 = s.indexOf("--dsh-pane:");
must(i0 > 0, "khong tim thay khoi CSS dashboard (--dsh-pane)");
const block = s.slice(i0, s.indexOf("#cdash-page{display:none;}", i0))
  .replace(/\/\*[\s\S]*?\*\//g, "");

// ── 1. ngân sách blur ─────────────────────────────────────────────────────
// Lay SELECTOR cua chinh rule, khong phai dong @media bao ngoai: bo qua moi
// doan bat dau bang @ roi moi khop.
const blurs = [...block.matchAll(/(?:^|[}\n])\s*([^@{}\n][^{}\n]*)\{[^{}]*backdrop-filter\s*:\s*(?!none)/g)]
  .map((m) => m[1].trim());
// -webkit- và không tiền tố đi theo cặp trên cùng selector, nên đếm selector duy nhất
const sel = [...new Set(blurs)];
console.log("Selector co backdrop-filter: " + (sel.join(" | ") || "(khong co)"));
must(sel.length > 0, "mat backdrop-filter — khong con kinh nua");
must(sel.length <= 2,
  "co " + sel.length + " selector mang backdrop-filter. Ngan sach la 1 (.dsh-col::before,"
  + " cong ban -webkit-). Them blur cho tung dong = 51+ be mat mo lai moi khung hinh.");
for (const x of sel) {
  must(/::before/.test(x),
    "backdrop-filter dat tren `" + x + "` chu khong phai ::before — no tao containing block"
    + " cho con position:fixed, lam bang chon khach / khung tro ly nhay vi tri.");
  must(/\.dsh-col/.test(x), "backdrop-filter nam ngoai .dsh-col: `" + x + "`");
}

// blur phải nằm trong @media min-width — điện thoại không được blur
// Phai nam trong @media min-width VA nguong phai du lon. Ha nguong xuong 1px
// cung la "co @media" nhung dien thoai van blur ca man hinh.
const mb = block.match(/@media[^{]*min-width\s*:\s*(\d+)px[^{]*\{[^@]*?backdrop-filter/s);
must(!!mb, "backdrop-filter khong nam trong @media min-width — dien thoai se blur ca man hinh,"
  + " ma tren dien thoai ba cot xep chong va phu het be ngang");
if (mb) {
  console.log("Nguong bat blur: >=" + mb[1] + "px");
  must(+mb[1] >= 1024,
    "blur bat tu " + mb[1] + "px — duoi 1024px ba cot xep chong va phu het be ngang,"
    + " moi khung hinh cuon phai lam mo lai gan nguyen man hinh");
}

// ── 2. nền phải là sắc TỐI, và chữ nhỏ phải qua AA ───────────────────────
const SKY = hexToRgb("#312C2A");   // tran bau troi, do tests/sky-contrast.test.js chot
const tok = (name) => {
  const m = block.match(new RegExp("--" + name + ":\\s*rgba\\((\\d+),(\\d+),(\\d+),\\s*([\\d.]+)\\)"));
  return m ? { rgb: [+m[1], +m[2], +m[3]], a: parseFloat(m[4]) } : null;
};
const pane = tok("dsh-pane"), item = tok("dsh-item"), hover = tok("dsh-item-hover");
must(pane && item, "thieu --dsh-pane hoac --dsh-item");

if (pane && item) {
  for (const [nm, t] of [["--dsh-pane", pane], ["--dsh-item", item], ["--dsh-item-hover", hover]]) {
    if (!t) continue;
    must(Y(t.rgb) < Y(SKY) * 1.6,
      nm + " = rgb(" + t.rgb + ") sang gan bang hoac hon tran bau troi. Phu sang se NANG nen"
      + " len va an mat tuong phan cua chu 10,5px — phu phai la sac TOI.");
  }
  // chồng lớp thật: bầu trời → cột kính → thẻ → chữ mờ 55%
  const surf = over(item.rgb, item.a, over(pane.rgb, pane.a, SKY));
  const ratio = cr(over(WHITE, 0.55, surf), surf);
  console.log("Chu mo 55% tren the, dat len sao sang nhat: " + ratio.toFixed(2) + ":1 (nguong " + AA + ")");
  must(ratio >= AA,
    "chu mo 55% tren the kinh chi dat " + ratio.toFixed(2) + ":1 — duoi AA " + AA
    + ". Lam the sang hon la .dsh-meta (10,5px) chet truoc.");
  if (hover) {
    const hs = over(hover.rgb, hover.a, over(pane.rgb, pane.a, SKY));
    const hr = cr(over(WHITE, 0.55, hs), hs);
    console.log("Chu mo 55% khi ro chuot:                 " + hr.toFixed(2) + ":1");
    must(hr >= AA, "nen khi ro chuot cho " + hr.toFixed(2) + ":1 — duoi AA " + AA);
  }
}

// ── 3. chuyển động: có chặn, có trần, và tắt được ────────────────────────
must(/_dshIntroDone\b\s*=\s*false/.test(s) && /_dshIntroDone\b\s*=\s*true/.test(s),
  "mat chot chi chay chuyen dong lan dau — renderDashboard() ghi de innerHTML moi lan"
  + " mo tab, khong chan thi hieu ung vao phat lai moi lan coach bam sang day");
must(/prefers-reduced-motion\s*:\s*reduce/.test(block),
  "khoi dashboard khong ton trong prefers-reduced-motion");
// MOI lan nhan var(--i) voi mot khoang thoi gian deu phai co tran. Chi can mot
// cho khong boc min() la dong thu 21 tre gap ba lan dong thu 8.
const stag = [...block.matchAll(/var\(--i[^)]*\)\s*\*\s*[\d.]+m?s/g)].map((m) => m[0]);
// .dsh-stat luon dung 3 the (dshStatsHTML phat --i:0/1/2) nen khong can tran:
// tre toi da 160ms. Chi danh sach CO THE DAI RA moi bat buoc — .dsh-row len toi
// 21 khach, .dsh-act len toi 30 hoat dong.
const GROWS = /\.dsh-(row|act)\b/;
const uncapped = stag.filter((x) => {
  const at = block.indexOf(x);
  const ctx = block.slice(Math.max(0, at - 220), at);
  if (!GROWS.test(ctx.split("}").pop())) return false;
  return !/min\([^()]*$/.test(block.slice(Math.max(0, at - 40), at));
});
console.log("Xep tang: " + stag.length + " cho, " + (stag.length - uncapped.length) + " co tran");
must(stag.length > 0, "khong thay xep tang nao dung var(--i)");
must(uncapped.length === 0,
  uncapped.length + " cho nhan var(--i) ma KHONG boc min(): " + uncapped.join(", ")
  + ". 21 dong x do tre moi dong se bat coach ngoi cho moi doc duoc danh sach cua chinh minh.");

// opacity < 1 trên cột biến nó thành backdrop root -> blur trang tron luc fade
must(!/\.dsh-col\s*\{[^}]*opacity\s*:\s*0/.test(block),
  "co opacity:0 tren .dsh-col — cot thanh backdrop root, blur se trang tron suot luc fade");

console.log("\nKiem dashboard kinh");
if (bad.length) { console.log("\n" + bad.map((b) => "  HONG " + b).join("\n")); process.exit(1); }
console.log("TAT CA DAT — ngan sach blur, tran tuong phan va chot chuyen dong deu con");
