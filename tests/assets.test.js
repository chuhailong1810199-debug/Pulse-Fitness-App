/**
 * Mọi ảnh được trỏ tới phải có thật, và bộ icon phải đúng như đã khai.
 *
 * Kiểu lỗi hay gặp nhất khi thay logo: đổi tên file xong quên một chỗ trỏ,
 * thế là một màn hình nào đó hiện ô vỡ — mà thường là màn ít mở nên lâu lắm
 * mới phát hiện. Bài test này quét tất cả.
 */
const fs = require("fs"), path = require("path"), assert = require("assert");
const ROOT = path.join(__dirname, "..");
const { decode } = require(path.join(ROOT, "outputs", "png-tool.js"));

let fails = 0;
const ok = (n, f) => { try { f(); console.log("  OK   " + n); }
  catch (e) { fails++; console.log("  HONG " + n + "\n       " + e.message); } };

const FILES = ["index.html", "landing.html", "manifest.json"];

ok("moi duong dan images/ deu co file that", () => {
  const missing = [];
  for (const f of FILES) {
    const src = fs.readFileSync(path.join(ROOT, f), "utf8");
    for (const m of src.matchAll(/["'(]\/?(images\/[A-Za-z0-9._-]+\.(?:png|jpg|jpeg|svg|webp))/g)) {
      if (!fs.existsSync(path.join(ROOT, m[1]))) missing.push(f + " -> " + m[1]);
    }
  }
  assert.strictEqual(missing.length, 0, "thieu file:\n       " + missing.join("\n       "));
});

ok("khong con tro toi logo PNG cu", () => {
  for (const f of FILES) {
    const src = fs.readFileSync(path.join(ROOT, f), "utf8");
    assert(!/pulse-(mark|logo)\.png/.test(src), f + " van tro toi logo PNG cu");
  }
});

ok("manifest khai dung kich thuoc icon", () => {
  const man = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8"));
  assert(man.icons && man.icons.length >= 2, "manifest thieu icon");
  for (const ic of man.icons) {
    const p = path.join(ROOT, ic.src);
    assert(fs.existsSync(p), "thieu " + ic.src);
    const img = decode(fs.readFileSync(p));
    const [w, h] = ic.sizes.split("x").map(Number);
    assert.strictEqual(img.W, w, ic.src + " rong " + img.W + ", khai " + w);
    assert.strictEqual(img.H, h, ic.src + " cao " + img.H + ", khai " + h);
  }
});

/**
 * Icon khai "maskable" thì Android sẽ cắt theo mặt nạ, thường là hình tròn.
 * Nội dung phải nằm trong vòng tròn bán kính 40% chiều rộng tính từ tâm, nếu
 * không là cụt mất rìa logo trên máy thật mà máy mình nhìn vẫn đẹp.
 */
ok("icon maskable nam gon trong vung an toan", () => {
  const man = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8"));
  for (const ic of man.icons.filter((i) => /maskable/.test(i.purpose || ""))) {
    const img = decode(fs.readFileSync(path.join(ROOT, ic.src)));
    const { W, H, px } = img;
    const bg = [px[0], px[1], px[2]];
    const cx = (W - 1) / 2, cy = (H - 1) / 2;
    let maxR = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (px[i + 3] < 16) continue;
      if (Math.abs(px[i] - bg[0]) + Math.abs(px[i + 1] - bg[1]) + Math.abs(px[i + 2] - bg[2]) < 30) continue;
      const r = Math.hypot(x - cx, y - cy);
      if (r > maxR) maxR = r;
    }
    const safe = W * 0.40;
    assert(maxR <= safe, ic.src + ": noi dung toi ban kinh " + (maxR / W * 100).toFixed(1) +
      "%, vuot vung an toan 40% -> Android se cat");
  }
});

ok("app va landing dung chung mot bo icon", () => {
  const idx = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const lan = fs.readFileSync(path.join(ROOT, "landing.html"), "utf8");
  for (const needle of ["favicon.svg", "favicon-32.png", "apple-touch-icon.png"]) {
    assert(idx.includes(needle), "index.html thieu " + needle);
    assert(lan.includes(needle), "landing.html thieu " + needle);
  }
});

console.log(fails ? "\n" + fails + " PHEP KIEM HONG" : "\nTAT CA DAT");
process.exit(fails ? 1 : 0);
