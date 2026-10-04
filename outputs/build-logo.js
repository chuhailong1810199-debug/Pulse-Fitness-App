#!/usr/bin/env node
/**
 * ĐÃ NGHỈ HƯU — 04/10/2026.
 *
 * Script này dựng bộ icon từ ảnh thiết kế logo CŨ (chữ P + nhịp tim tím), và
 * nó cần images/pulse-mark.png, file đó đã bị xoá cùng lúc logo mới về.
 * Logo mới (hành tinh + nhịp tim) do nhà thiết kế xuất sẵn đủ bộ: SVG cho
 * web, PNG cho icon — không phải dựng lại gì nữa.
 *
 * Giữ lại vì phần giải mã/mã hoá PNG và cách xoay sắc màu trong này còn dùng
 * được nếu sau này lại phải tự dựng icon. Chạy thẳng sẽ lỗi thiếu file.
 *
 * Dựng bộ logo Pulse từ ảnh thiết kế gốc.
 *
 *   node outputs/build-logo.js <anh-goc.png>
 *
 * Ba việc: đổi tím sang xanh của app, tách nền thành trong suốt, rồi cắt ra
 * từng phần dùng ở từng chỗ. Ảnh gốc là chữ trắng + nhịp tim tím trên nền đen,
 * nên nền tách được bằng độ sáng: đen là trong suốt, sáng là đặc.
 */
const fs = require("fs");
const path = require("path");
const { decode, encode, resize } = require("./png-tool.js");

/**
 * Chạy hai kiểu:
 *   node outputs/build-logo.js <anh-thiet-ke.png>   dựng lại TẤT CẢ từ ảnh gốc
 *   node outputs/build-logo.js                      chỉ dựng lại bộ icon từ
 *                                                   images/pulse-mark.png
 *
 * Tách làm hai vì ảnh thiết kế gốc là file coach gửi, không nằm trong repo.
 * Bản mark đã tách nền và đổi màu thì có, nên bộ icon luôn dựng lại được.
 */
const SRC = process.argv[2];
const OUT = path.join(__dirname, "..", "images");

// Màu app. Nhịp tim lấy màu nhấn, chữ P giữ trắng.
const ACCENT = [0x8f, 0xdb, 0xff];
const BG = [0x16, 0x11, 0x11];

const rgb2hsl = (r, g, b) => {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  const l = (mx + mn) / 2;
  const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
  return [h, s, l];
};
const hsl2rgb = (h, s, l) => {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0]; else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x]; else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c]; else [r, g, b] = [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
};
const ACC_H = rgb2hsl(...ACCENT)[0];

/**
 * Cắt một vùng, tách nền, đổi tím sang xanh.
 *
 * Ảnh gốc là tác phẩm đã ghép lên nền đen, nên điểm quan sát được bằng
 * màu thật nhân độ phủ. Muốn tách ra thì chia ngược lại, nếu không mọi
 * cạnh khử răng cưa sẽ xỉn đi khi đặt lên nền khác.
 */
function extract(src, x0, y0, x1, y1) {
  const w = x1 - x0, h = y1 - y0;
  const px = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = ((y + y0) * src.W + (x + x0)) * 4, j = (y * w + x) * 4;
      let r = src.px[i], g = src.px[i + 1], b = src.px[i + 2];
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;

      // Dưới 22 là nền, trên 80 là nét đặc, ở giữa là cạnh khử răng cưa.
      let a = (lum - 22) / 58;
      a = a < 0 ? 0 : a > 1 ? 1 : a;
      if (a === 0) { px[j + 3] = 0; continue; }

      r = Math.min(255, r / a); g = Math.min(255, g / a); b = Math.min(255, b / a);

      // Tím của ảnh gốc -> xanh của app. Giữ nguyên độ sáng và độ bão hoà nên
      // dải chuyển màu của nhịp tim còn nguyên, chỉ đổi sắc.
      const [hh, ss, ll] = rgb2hsl(r, g, b);
      if (ss > 0.12 && hh >= 240 && hh <= 330) {
        [r, g, b] = hsl2rgb(ACC_H, Math.min(1, ss * 1.05), ll);
      }
      px[j] = r; px[j + 1] = g; px[j + 2] = b; px[j + 3] = Math.round(a * 255);
    }
  }
  return { W: w, H: h, px };
}

/**
 * Canh ảnh vào khung vuông, chừa lề an toàn.
 *
 * `clear` = true thì giữ nền trong suốt. Chỉ dùng cho favicon: trình duyệt
 * ghép nó lên thanh tab nên trong suốt là hợp nhất. KHÔNG dùng cho icon
 * maskable (Android cắt theo mặt nạ, nền trong sẽ lộ nền hệ thống) và cũng
 * không dùng cho apple-touch-icon (iOS ghép lên nền TRẮNG, logo trắng bạc sẽ
 * biến mất).
 */
function onBg(img, size, inset, clear) {
  const out = Buffer.alloc(size * size * 4);
  if (!clear) {
    for (let i = 0; i < size * size; i++) {
      out[i * 4] = BG[0]; out[i * 4 + 1] = BG[1]; out[i * 4 + 2] = BG[2]; out[i * 4 + 3] = 255;
    }
  }
  const box = Math.round(size * inset);
  const sc = Math.min(box / img.W, box / img.H);
  const w = Math.max(1, Math.round(img.W * sc)), h = Math.max(1, Math.round(img.H * sc));
  const small = resize(img.W, img.H, img.px, w, h);
  const ox = Math.round((size - w) / 2), oy = Math.round((size - h) / 2);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const s = (y * w + x) * 4, d = ((y + oy) * size + (x + ox)) * 4;
      const a = small[s + 3] / 255;
      if (!a) continue;
      if (clear) {
        out[d] = small[s]; out[d + 1] = small[s + 1]; out[d + 2] = small[s + 2];
        out[d + 3] = small[s + 3];
        continue;
      }
      for (let k = 0; k < 3; k++) out[d + k] = Math.round(small[s + k] * a + out[d + k] * (1 - a));
    }
  }
  return out;
}

let mark;
if (SRC) {
  const src = decode(fs.readFileSync(SRC));
  console.log(`nguon ${src.W}x${src.H}`);
  // Toạ độ đo từ ảnh gốc, chừa viền bo ra ngoài.
  mark = extract(src, 288, 282, 1002, 714);     // chữ P + nhịp tim
// Không lấy dòng "BUILD. TRAIN. GROW.": chỗ dùng bản ghép cao 34-72px, ở đó
// tagline chỉ còn là một vệt xám không đọc được, mà vẫn chiếm 1/4 chiều cao
// nên đẩy phần đọc được nhỏ lại.
  const lock = extract(src, 238, 282, 1016, 845);   // chữ P + PULSE

  fs.writeFileSync(path.join(OUT, "pulse-mark.png"), encode(mark.W, mark.H, mark.px));
  fs.writeFileSync(path.join(OUT, "pulse-logo.png"), encode(lock.W, lock.H, lock.px));
  console.log(`pulse-mark.png  ${mark.W}x${mark.H}`);
  console.log(`pulse-logo.png  ${lock.W}x${lock.H}`);
} else {
  mark = decode(fs.readFileSync(path.join(OUT, "pulse-mark.png")));
  console.log(`dung lai pulse-mark.png ${mark.W}x${mark.H} — chi dung bo icon`);
}

// Icon: maskable cần nội dung nằm trong vùng an toàn giữa.
for (const [name, size, inset, clear] of [
  ["icon-512.png", 512, 0.62, false], ["icon-192.png", 192, 0.62, false],
  ["apple-touch-icon.png", 180, 0.70, false], ["favicon-32.png", 32, 0.86, true],
]) {
  fs.writeFileSync(path.join(OUT, name), encode(size, size, onBg(mark, size, inset, clear)));
  console.log(`${name.padEnd(22)} ${size}x${size}   ${clear ? "nền trong suốt" : "nền đặc"}`);
}
