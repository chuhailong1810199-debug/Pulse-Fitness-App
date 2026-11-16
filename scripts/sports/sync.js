#!/usr/bin/env node
/*
 * Chép dữ liệu môn thể thao từ functions/sports.js (NGUỒN) vào index.html (khối `// ── SPORTS — TẠO TỪ`).
 *   node scripts/sports/sync.js          # ghi
 *   node scripts/sports/sync.js --check  # chỉ kiểm, lệch thì thoát mã 1 (tests/sports.test.js dùng cùng hàm)
 */
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..", "..");
const BEGIN = "// ── SPORTS — TẠO TỪ functions/sports.js (node scripts/sports/sync.js) — đừng sửa tay", END = "// ── HẾT SPORTS ──";

function appBlock() {
  const src = fs.readFileSync(path.join(root, "functions", "sports.js"), "utf8");
  const a = src.indexOf("const SPORTS = "), b = src.indexOf("/** Tên nhóm cơ");
  if (a < 0 || b < a) throw new Error("functions/sports.js: không thấy SPORTS … SPORT_PHASES");
  return BEGIN + "\n" + src.slice(a, b).trim() + "\n" + END;
}
function current(html) {
  const a = html.indexOf(BEGIN), b = html.indexOf(END);
  return a >= 0 && b > a ? html.slice(a, b + END.length) : null;
}
module.exports = { appBlock, current, BEGIN, END };

if (require.main === module) {
  const file = path.join(root, "index.html");
  const html = fs.readFileSync(file, "utf8"), cur = current(html), want = appBlock();
  if (!cur) { console.error("index.html chưa có khối SPORTS"); process.exit(1); }
  if (process.argv.includes("--check")) { if (cur !== want) { console.error("index.html lệch functions/sports.js — chạy node scripts/sports/sync.js"); process.exit(1); } console.log("khớp"); process.exit(0); }
  if (cur === want) { console.log("đã khớp, không đổi"); process.exit(0); }
  fs.writeFileSync(file, html.replace(cur, () => want));
  console.log("đã chép SPORTS vào index.html");
}
