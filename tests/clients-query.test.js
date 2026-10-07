/**
 * Mọi truy vấn DANH SÁCH clients / bookings phải qua clientsQuery() /
 * bookingsQuery(). firestore.rules không lọc: coach truy vấn trần là bị từ
 * chối cả lần → màn hình trống trơn, không báo gì.
 *
 * Ngoại lệ phải ghi rõ lý do bằng chú thích `clients-scan-ok:` trên cùng dòng.
 */
const fs = require("fs"), path = require("path"), assert = require("assert");
const s = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const lines = s.split("\n");
let fails = 0;
const ok = (n, f) => { try { f(); console.log("  OK   " + n); }
  catch (e) { fails++; console.log("  HONG " + n + "\n       " + e.message); } };

console.log("Truy van danh sach theo coach\n");

ok("khong truy van tran clients ngoai helper (tru ngoai le co ghi chu)", () => {
  const bad = [];
  lines.forEach((l, i) => {
    const bare = /getDocs\(collection\(db,\s*'clients'\)\)/.test(l)
      || /\.collection\('clients'\)\.(get|where|orderBy|limit)\(/.test(l);
    if (bare && !/clients-scan-ok:/.test(l)) bad.push(i + 1);
  });
  assert(!bad.length, "dòng " + bad.join(", "));
});
ok("ngoai le chi o luong khach dang nhap hoac chi admin", () => {
  const ex = lines.filter((l) => /clients-scan-ok:/.test(l));
  assert(ex.length <= 6, "ngoại lệ tăng lên " + ex.length + " — kiểm lại có cần thật không");
  ex.forEach((l) => assert(/vai trò khách|chỉ admin/.test(l), "ngoại lệ thiếu lý do: " + l.trim()));
});
ok("loadAllClients dung clientsQuery", () => {
  const i = s.indexOf("async function loadAllClients()");
  assert(/getDocs\(clientsQuery\(\)\)/.test(s.slice(i, i + 200)));
});
ok("clientsQuery: coach luon kem where coachUid; truy van tran chi khi admin bat Tat ca", () => {
  const i = s.indexOf("function clientsQuery()");
  const f = s.slice(i, s.indexOf("\n}", i));
  assert(/if \(userIsAdmin && _allCoaches\) return collection\(db, 'clients'\);/.test(f));
  assert(/where\('coachUid', '==', currentUser\.uid\)/.test(f));
});
ok("bookings: khong truy van tran, tao moi co coachUid", () => {
  assert(!/query\(\s*collection\(db,\s*'bookings'\)/.test(s), "còn query(collection(db,'bookings')) trần");
  const i = s.indexOf("async function schedSaveNew(");
  assert(/coachUid: currentUser\.uid/.test(s.slice(i, i + 1400)), "lịch mới thiếu coachUid");
});
ok("index ghep bookings (coachUid, date) da khai", () => {
  const idx = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "firestore.indexes.json"), "utf8"));
  assert(idx.indexes.some((x) => x.collectionGroup === "bookings"
    && x.fields.map((f) => f.fieldPath).join(",") === "coachUid,date"));
});
ok("khong con danh sach email coach cung trong app", () => {
  assert(!/COACH_EMAILS/.test(s), "còn COACH_EMAILS");
});
ok("coach duoc nhan dien TRUOC khi khop khach", () => {
  const i = s.indexOf("async function loadUserProfile(");
  const f = s.slice(i, s.indexOf("\nasync function _verifyUserProfileBg", i));
  const a = f.indexOf("_resolveCoach(user)"), b = f.indexOf("doc(db, 'clientEmails'");
  assert(a > 0 && b > 0 && a < b, "_resolveCoach phải chạy trước tra /clientEmails");
});
ok("users.role 'coach' cu khong con cap quyen coach", () => {
  assert(/snap\.data\(\)\.role === 'coach' \? 'client'/.test(s));
});
ok("chi admin xac nhan da tra, sua bang gia, tai khoan studio", () => {
  const c = s.slice(s.indexOf("async function billConfirm("), s.indexOf("async function billConfirm(") + 300);
  assert(/if \(!userIsAdmin/.test(c));
  const b = s.slice(s.indexOf("async function saveBillSettings("), s.indexOf("async function saveBillSettings(") + 200);
  assert(/if \(!userIsAdmin\)/.test(b));
});

ok("nut Coach co chu (khong ra o trong vi font-size:0) va an that voi coach thuong", () => {
  assert(/#app-screen \.client-bar #coach-admin-btn\{[^}]*font-size:11px !important/.test(s),
    "nút Coach thiếu font-size riêng — sẽ ra ô trống");
  assert(/#app-screen \.client-bar \.add-client-btn\.hidden\{display:none !important;\}/.test(s),
    ".hidden không thắng được display:inline-flex !important của thanh");
});

console.log(fails ? "\n" + fails + " HONG" : "\nTAT CA DAT");
process.exit(fails ? 1 : 0);
