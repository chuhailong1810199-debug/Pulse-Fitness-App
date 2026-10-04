/**
 * Mỗi trang showPage bật/tắt đều phải có luật CSS ẩn nó đi mặc định.
 *
 * showPage chỉ thêm/bớt class .active, nó KHÔNG tự ẩn gì cả. Thêm một thẻ
 * <div id="x-page"> mà quên cặp luật "#x-page{display:none}" + ".active
 * {display:block}" thì trang đó hiện ở MỌI tab. Đúng chuyện vừa xảy ra với
 * tab Health: nút bấm đúng, showPage đúng, chỉ thiếu hai dòng CSS.
 *
 * Kiểm tĩnh, không cần trình duyệt.
 */
const fs = require("fs"), path = require("path"), assert = require("assert");
const s = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

const css = [...s.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join("\n");

// Những trang mà showPage bật/tắt bằng class .active.
const pages = [...s.matchAll(/getElementById\('([a-z-]+)-page'\)\.classList\.toggle\('active'/g)]
  .map((m) => m[1]);
assert(pages.length >= 10, "chỉ thấy " + pages.length + " trang, bộ dò hỏng rồi");

// Ẩn được bằng #id hoặc bằng class .x-page — app dùng cả hai kiểu.
const hidden = (p) => {
  const byId = new RegExp("#" + p + "-page\\s*\\{[^}]*display\\s*:\\s*none", "i");
  const byClass = new RegExp("\\." + p + "-page\\s*\\{[^}]*display\\s*:\\s*none", "i");
  return byId.test(css) || byClass.test(css);
};
const shows = (p) => {
  const byId = new RegExp("#" + p + "-page\\.active\\s*\\{[^}]*display\\s*:\\s*(block|flex|grid)", "i");
  const byClass = new RegExp("\\." + p + "-page\\.active\\s*\\{[^}]*display\\s*:\\s*(block|flex|grid)", "i");
  return byId.test(css) || byClass.test(css);
};

const bad = [];
for (const p of pages) {
  if (!hidden(p)) bad.push(p + "-page: thiếu luật ẩn mặc định -> sẽ hiện ở MỌI tab");
  else if (!shows(p)) bad.push(p + "-page: có luật ẩn nhưng thiếu .active -> không bao giờ hiện");
}

console.log("Kiem " + pages.length + " trang: " + pages.join(", "));
if (bad.length) { console.log("\n" + bad.map((b) => "  HONG " + b).join("\n")); process.exit(1); }
// Tab Health là lý do bài test này tồn tại.
assert(pages.includes("health"), "khong thay trang health trong showPage");
console.log("\nTAT CA DAT — moi trang deu an mac dinh va hien khi .active");
