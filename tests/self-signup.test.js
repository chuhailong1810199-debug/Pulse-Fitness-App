/**
 * Đăng nhập lần đầu / được gán Gmail sau: app KHÔNG tự làm hai việc luật cấm.
 * Hai việc đó từng chặn đăng nhập (tạo clients từ máy khách, tự đổi
 * users.clientId); nay đi qua callable claimMyClient.
 */
const fs = require("fs"), path = require("path"), assert = require("assert");
const s = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
let fails = 0;
const ok = (n, f) => { try { f(); console.log("  OK   " + n); }
  catch (e) { fails++; console.log("  HONG " + n + "\n       " + e.message); } };

const i = s.indexOf("async function loadUserProfile(");
const lup = s.slice(i, s.indexOf("\nasync function _verifyUserProfileBg", i));
console.log("Tu dang ky + gan Gmail sau\n");

ok("loadUserProfile khong tu tao clients", () =>
  assert(!/setDoc\(doc\(db, 'clients'/.test(lup), "còn setDoc(clients) trong loadUserProfile"));
ok("loadUserProfile khong tu doi users.clientId", () =>
  assert(!/updateDoc\(userRef, \{[^}]*clientId/.test(lup), "còn updateDoc(users, {clientId})"));
ok("tu dang ky TAT: app khong bao gio xin tao ho so", () => {
  assert(!/_claimMyClient\(true\)/.test(s), "còn _claimMyClient(true)");
  assert((lup.match(/_claimMyClient\(false\)/g) || []).length === 2, "hai nhánh đều chỉ tra, không tạo");
  assert(/chưa được coach nào thêm vào Pulse/.test(lup), "thiếu lời báo cho Gmail chưa được gán");
});
ok("server bo qua create tu may khach khi tu dang ky tat", () => {
  const f = fs.readFileSync(path.join(__dirname, "..", "functions", "index.js"), "utf8");
  assert(/const SELF_SIGNUP = false;/.test(f));
  assert(/create: SELF_SIGNUP && /.test(f));
});
ok("loi claim tra null, khong nem (de man bao loi khong bi de)", () => {
  const h = s.slice(s.indexOf("async function _claimMyClient("), s.indexOf("// Background re-verify"));
  assert(/return null;/.test(h) && !/throw e;/.test(h));
  assert((lup.match(/if \(!r\) return;/g) || []).length === 2);
});
ok("khong con quet ca bang users", () =>
  assert(!/collection\(db, 'users'\)/.test(s), "còn getDocs(collection(db,'users'))"));
ok("functions co callable claimMyClient, chan coach", () => {
  const f = fs.readFileSync(path.join(__dirname, "..", "functions", "index.js"), "utf8");
  const j = f.indexOf("exports.claimMyClient = onCall(");
  assert(j >= 0);
  assert(/authz\.isCoach\(/.test(f.slice(j, j + 900)), "phải chặn tài khoản coach");
});

console.log(fails ? "\n" + fails + " HONG" : "\nTAT CA DAT");
process.exit(fails ? 1 : 0);
