/**
 * Mọi callable phải tự kiểm quyền — hàm nền bỏ qua firestore.rules.
 *
 * Bốn callable từng không kiểm gì (recommendMacros trả InBody của bất kỳ
 * khách nào cho người chưa đăng nhập). Bài này quét functions/index.js: thêm
 * onCall mới mà quên kiểm là hỏng ngay.
 */
const fs = require("fs"), path = require("path"), assert = require("assert");
const s = fs.readFileSync(path.join(__dirname, "..", "functions", "index.js"), "utf8");

// Công khai CÓ CHỦ ĐÍCH — thêm vào đây phải có lý do.
const PUBLIC = {
  pulseGenerateFree: "form tạo giáo án miễn phí trên landing, người chưa có tài khoản",
};

let fails = 0;
const ok = (n, f) => { try { f(); console.log("  OK   " + n); }
  catch (e) { fails++; console.log("  HONG " + n + "\n       " + e.message); } };

console.log("Callable tu kiem quyen\n");
const re = /exports\.(\w+)\s*=\s*onCall\(/g;
const found = [];
let m;
while ((m = re.exec(s))) found.push([m[1], m.index]);
assert(found.length >= 10, "quét được quá ít onCall: " + found.length);

found.forEach(([name, at], i) => {
  if (PUBLIC[name]) return;
  const end = i + 1 < found.length ? found[i + 1][1] : s.length;
  // Chỉ xét ~60 dòng đầu thân hàm: kiểm quyền phải đứng TRƯỚC mọi lần đọc dữ liệu.
  const head = s.slice(at, end).split("\n").slice(0, 60).join("\n");
  ok(name + " kiem quyen o dau ham", () => {
    assert(/authz\.(require\w+|assertCanAccess)\(|request\.auth/.test(head),
      name + " không gọi authz.* cũng không đọc request.auth");
  });
});

ok("4 callable tung bo ngo nay da qua authz", () => {
  for (const n of ["generateProgram", "pulseGenerate", "analyzeMealPhoto", "recommendMacros"]) {
    const i = s.indexOf("exports." + n + " = onCall(");
    assert(i >= 0, "không thấy " + n);
    assert(/authz\.\w+\(/.test(s.slice(i, i + 2500)), n + " chưa gọi authz");
  }
});

console.log(fails ? "\n" + fails + " HONG" : "\nTAT CA DAT");
process.exit(fails ? 1 : 0);
