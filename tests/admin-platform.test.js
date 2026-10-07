/**
 * Mỗi coach một cửa hàng — phần app: dashboard admin, quan sát chỉ xem, thu
 * tiền chỉ cho khách của admin nền tảng.
 */
const fs = require("fs"), path = require("path"), assert = require("assert");
const s = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
let fails = 0;
const ok = (n, f) => { try { f(); console.log("  OK   " + n); }
  catch (e) { fails++; console.log("  HONG " + n + "\n       " + e.message); } };
const fnBody = (name) => { const i = s.indexOf(name); assert(i >= 0, "không thấy " + name); return s.slice(i, s.indexOf("\n}\n", i)); };

console.log("Admin + moi coach mot cua hang\n");

ok("trang Admin chi admin mo duoc", () => {
  assert(/if \(page === 'platform' && !userIsAdmin\) return;/.test(s));
  assert(/platTab\.style\.display = userIsAdmin \? '' : 'none'/.test(s));
});
ok("dashboard co du so lieu coach", () => {
  const f = fnBody("async function renderPlatform()");
  for (const k of ["Coach đang hoạt động", "Tổng khách", "Khách tự đăng nhập", "Khách tập trong 14 ngày", "Quan sát"]) {
    assert(f.includes(k), "thiếu: " + k);
  }
});
ok("thu tien chi bat cho khach cua admin nen tang", () => {
  const f = fnBody("function billingOn(");
  assert(/c\.coachUid === _platformAdminUid/.test(f));
  assert(/if \(page === 'billing' && !billingOn\(\)\) return;/.test(s), "showPage phải chặn billing");
  assert(/function renderAccessAlert\(\) \{\s*if \(!billingOn\(\)\)/.test(s), "nhắc gia hạn phải tắt theo");
});
ok("admin goc cong khai uid o settings/platform", () => {
  const f = fnBody("async function _bindCoachUid(");
  assert(/doc\(db, 'settings', 'platform'\), \{ adminUid: user\.uid \}/.test(f));
});
ok("quan sat: bien chi xem + truy van theo coach dang quan sat", () => {
  assert(/function isObserving\(\)/.test(s) && /chỉ xem, không sửa được/.test(s));
  const q = fnBody("function clientsQuery()");
  assert(/_observeCoachUid\) \|\| currentUser\.uid/.test(q));
  const b = fnBody("function bookingsQuery(");
  assert(/_observeCoachUid\) \|\| currentUser\.uid/.test(b));
});
ok("doi khach la cap nhat bien quan sat + tab billing", () => {
  const f = fnBody("async function switchClient(id)");
  assert(/afterClientChange\(\);\s*$/.test(f.trim() + "\n") || /afterClientChange\(\);/.test(f));
});

console.log(fails ? "\n" + fails + " HONG" : "\nTAT CA DAT");
process.exit(fails ? 1 : 0);
