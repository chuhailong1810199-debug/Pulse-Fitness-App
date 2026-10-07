/**
 * Nền bầu trời sao không được sáng quá mức chữ còn đọc được.
 *
 * Thẻ trong app phủ 7% trắng, tức là 93% nền phía sau vẫn hiện ra. Một ngôi sao
 * nằm dưới thẻ gần như không bị thẻ che. Nên độ sáng của sao bị chặn trần, và
 * biên an toàn rất mỏng: sao sáng nhất cho 4,61:1, ngưỡng AA là 4,50 — chỉ dư
 * 0,11. Ai đó chỉnh --sky-star-4 sáng lên một chút là tụt xuống dưới chuẩn mà
 * nhìn mắt thường không thấy gì sai.
 *
 * Bài kiểm này tự tính lại tương phản từ đúng giá trị trong index.html, không
 * chép số. Sửa màu sao thì số ở đây đổi theo.
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

/** nền → thẻ rgba(255,255,255,.07) → chữ rgba(255,255,255,.55) */
function onCard(bg) {
  const card = over(WHITE, 0.07, bg);
  return cr(over(WHITE, 0.55, card), card);
}

const AA = 4.5;
const bad = [];
const must = (c, m) => { if (!c) bad.push(m); };

// ── trần độ sáng của sao ──────────────────────────────────────────────────
const tiers = [...s.matchAll(/--sky-star-(\d):\s*(#[0-9A-Fa-f]{6})/g)]
  .map((m) => ({ n: +m[1], hex: m[2] }));
must(tiers.length >= 4, "khong tim thay du 4 tang sao --sky-star-N");

let worst = null;
for (const t of tiers) {
  const r = onCard(hexToRgb(t.hex));
  if (!worst || r < worst.r) worst = { ...t, r };
  must(r >= AA,
    `--sky-star-${t.n} = ${t.hex} cho ${r.toFixed(2)}:1 cho chu 0,55 tren the 0,07`
    + ` — duoi nguong AA ${AA}. Sao nay nam duoi the thi chu bi nuot.`);
}
if (worst) console.log(`Sao sang nhat: --sky-star-${worst.n} ${worst.hex} -> ${worst.r.toFixed(2)}:1`
  + `  (nguong ${AA}, du ${(worst.r - AA).toFixed(2)})`);

// Tinh van cung nam sau noi dung, cung phai qua nguong.
const flood = s.match(/flood-color='%23([0-9A-Fa-f]{6})'\s*flood-opacity='([\d.]+)'/);
if (flood) {
  const peak = over(hexToRgb("#" + flood[1]), parseFloat(flood[2]), hexToRgb("#161111"));
  const r = onCard(peak);
  console.log(`Dinh tinh van: ${r.toFixed(2)}:1`);
  must(r >= AA, `dinh tinh van cho ${r.toFixed(2)}:1 — duoi nguong AA ${AA}`);
}

// ── dải an toàn của lớp sao sáng ở lề phải phủ hết cột nội dung ──────────
// Lop nay dung sao rat sang (1,11:1). No chi an toan khi bi che kin ngang
// toan bo cot noi dung. Ban ban giao de 460px trong khi .app rong 1080px.
const safe = s.match(/--sky-safe:\s*(\d+)px/);
const appW = [...s.matchAll(/\.app\{[^}]*max-width:\s*(\d+)px/g)].map((m) => +m[1]);
if (safe && appW.length) {
  const widest = Math.max(...appW);
  console.log(`Dai an toan: ${safe[1]}px · cot noi dung rong nhat: ${widest}px`);
  must(+safe[1] >= widest,
    `--sky-safe = ${safe[1]}px nhung .app rong toi ${widest}px`
    + ` — ~${Math.round((widest - +safe[1]) / 2)}px noi dung moi ben se nam tren sao sang.`);
}

// ── mấy điều bản thiết kế đã chốt, đừng lặng lẽ quay lại ─────────────────
// Bóc bình luận CSS trước khi quét: khối bầu trời có câu "removes
// background-attachment:fixed ..." và "no animation", quét thô sẽ khớp vào đó
// rồi báo hỏng trong khi code hoàn toàn đúng.
const code = s.replace(/\/\*[\s\S]*?\*\//g, "");

must(/html body\{background:transparent\}/.test(code),
  "mat `html body{background:transparent}` — nen cua body se phu len bau troi o z-index:-1");
must(!/background-attachment:\s*fixed/.test(code),
  "background-attachment:fixed quay lai — giat tren iOS Safari va ve lai ca nen moi lan cuon");
must(!/linear-gradient\(rgba\(255,255,255,0\.025\) 1px/.test(code),
  "luoi 40px cu quay lai — chong len bau troi thanh nhieu, va cong them do sang len moi ngoi sao");

const i0 = code.indexOf("--sky-star-1");
const sky = i0 >= 0 ? code.slice(i0, i0 + 12000) : "";
must(i0 >= 0, "khong tim thay khoi CSS bau troi");
must(!/[;{\s]animation\s*:/.test(sky) && !/@keyframes/.test(sky),
  "bau troi co animation — day la nen tinh, khong duoc chay vong lap tren dien thoai");

console.log("\nKiem nen bau troi sao");
if (bad.length) { console.log("\n" + bad.map((b) => "  HONG " + b).join("\n")); process.exit(1); }
console.log("TAT CA DAT — tran do sang, dai an toan, va cac chot cu deu con");
