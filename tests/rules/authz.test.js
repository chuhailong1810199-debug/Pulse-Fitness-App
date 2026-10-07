/**
 * functions/authz.js chạy trên Firestore emulator — cùng các ca với
 * firestore.rules, để quyền ở callable và ở luật không lệch nhau.
 */
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
process.env.GCLOUD_PROJECT = "demo-pulse-rules";
const path = require("path"), assert = require("assert");
// Nạp firebase-admin TỪ functions/ — cùng một bản với authz.js dùng, nếu không
// getFirestore() bên kia sẽ là một app khác chưa khởi tạo.
const fnRequire = require("module").createRequire(path.join(__dirname, "..", "..", "functions", "index.js"));
const { initializeApp } = fnRequire("firebase-admin/app");
const { getFirestore } = fnRequire("firebase-admin/firestore");
initializeApp({ projectId: "demo-pulse-rules" });
const authz = require(path.join(__dirname, "..", "..", "functions", "authz.js"));

const req = (uid, email, extra = {}) => (uid ? { auth: { uid, token: { email, email_verified: true, ...extra } } } : {});
const COACH = req("coach1", "chuhailong1810199@gmail.com");
const COACH_A = req("coachA", "pta@gmail.com");
const COACH_B = req("coachB", "ptb@gmail.com");
const COACH_OFF = req("coachOff", "nghi@gmail.com");
const ADMIN2 = req("admin2", "quanly@gmail.com");
const OLD_ROLE = req("coach2", "cu@gmail.com");          // users.role 'coach' kiểu cũ
const CINDY = req("u_cindy", "Cindy@gmail.com");          // viết hoa: vẫn phải khớp
const SANG = req("u_sang", "sang@gmail.com");
const STRANGER = req("u_x", "la@gmail.com");
const LEGACY = req("u_old", "cu@gmail.com");
const ANON = req(null);

let fails = 0; const cases = [];
const ok = (n, f) => cases.push([n, f]);
const denied = async (p, code) => {
  try { await p; } catch (e) { if (!code || e.code === code) return; throw new Error("sai mã lỗi: " + e.code); }
  throw new Error("đáng lẽ bị từ chối");
};

(async () => {
  const db = getFirestore();
  await db.doc("clients/cindy").set({ email: "cindy@gmail.com", coachUid: "coachA" });
  await db.doc("clients/sang").set({ email: "sang@gmail.com", coachUid: "coachB" });
  await db.doc("coaches/pta@gmail.com").set({ active: true, isAdmin: false, uid: "coachA" });
  await db.doc("coaches/ptb@gmail.com").set({ active: true, isAdmin: false });
  await db.doc("coaches/nghi@gmail.com").set({ active: false, isAdmin: false });
  await db.doc("coaches/quanly@gmail.com").set({ active: true, isAdmin: true });
  await db.doc("coaches/chuhailong1810199@gmail.com").set({ active: true, isAdmin: true, uid: "admin1" });
  await db.doc("clients/tien").set({ email: "" });
  await db.doc("clients/old").set({ email: "cu@gmail.com" });              // khách cũ, không có index
  await db.doc("clientEmails/cindy@gmail.com").set({ clientId: "cindy" });
  await db.doc("clientEmails/sang@gmail.com").set({ clientId: "sang" });
  await db.doc("users/coach2").set({ role: "coach" });   // không còn tác dụng
  await db.doc("users/u_x").set({ role: "client" });

  ok("chua dang nhap -> unauthenticated", () => denied(authz.assertCanAccess(ANON, "cindy", db), "unauthenticated"));
  ok("email chua xac minh -> unauthenticated", () =>
    denied(authz.assertCanAccess(req("u_cindy", "cindy@gmail.com", { email_verified: false }), "cindy", db), "unauthenticated"));
  ok("khach doc chinh minh", () => authz.assertCanAccess(CINDY, "cindy", db));
  ok("khach KHAC bi chan", () => denied(authz.assertCanAccess(SANG, "cindy", db), "permission-denied"));
  ok("nguoi la bi chan", () => denied(authz.assertCanAccess(STRANGER, "cindy", db), "permission-denied"));
  ok("khach email rong khong khop ai", () => denied(authz.assertCanAccess(STRANGER, "tien", db), "permission-denied"));
  ok("id khong ton tai: cung loi voi khong co quyen", () =>
    denied(authz.assertCanAccess(STRANGER, "khong_co", db), "permission-denied"));
  ok("thieu clientId -> invalid-argument", () => denied(authz.assertCanAccess(CINDY, "", db), "invalid-argument"));
  ok("coach (email) vao moi khach", () => authz.assertCanAccess(COACH, "sang", db));
  ok("coach A vao khach cua minh", () => authz.assertCanManage(COACH_A, "cindy", db));
  ok("coach A KHONG vao khach cua B", () => denied(authz.assertCanManage(COACH_A, "sang", db), "permission-denied"));
  ok("coach A KHONG assertCanAccess khach cua B", () => denied(authz.assertCanAccess(COACH_A, "sang", db), "permission-denied"));
  ok("coach bi tat bi chan", () => denied(authz.assertCanManage(COACH_OFF, "cindy", db), "permission-denied"));
  ok("users.role 'coach' kieu cu KHONG con la coach", () => denied(authz.requireCoach(OLD_ROLE, db), "permission-denied"));
  ok("admin (coaches.isAdmin) vao moi khach", () => authz.assertCanManage(ADMIN2, "cindy", db));
  ok("khach KHONG assertCanManage chinh minh (chi Access)", () =>
    denied(authz.assertCanManage(CINDY, "cindy", db), "permission-denied"));

  ok("requireCoach: khach bi chan", () => denied(authz.requireCoach(CINDY, db), "permission-denied"));
  ok("requireCoach: coach qua", () => authz.requireCoach(COACH_B, db));
  ok("requireAdmin: coach thuong bi chan", () => denied(authz.requireAdmin(COACH_A, db), "permission-denied"));
  ok("requireAdmin: admin goc + admin2 qua", async () => { await authz.requireAdmin(COACH, db); await authz.requireAdmin(ADMIN2, db); });
  ok("defaultOwnerUid = uid admin goc", async () => assert.strictEqual(await authz.defaultOwnerUid(db), "admin1"));
  ok("canManageDoc thuan", () => {
    assert(authz.canManageDoc({ coach: true, uid: "coachA" }, { coachUid: "coachA" }));
    assert(!authz.canManageDoc({ coach: true, uid: "coachA" }, { coachUid: "coachB" }));
    assert(!authz.canManageDoc({ coach: false, uid: "coachA" }, { coachUid: "coachA" }));
    assert(authz.canManageDoc({ coach: true, admin: true, uid: "x" }, { coachUid: "y" }));
    assert(!authz.canManageDoc({ coach: true, uid: "coachA" }, null));
  });
  ok("requireMember: khach co index", () => authz.requireMember(SANG, db));
  ok("requireMember: khach cu chua co index", () => authz.requireMember(LEGACY, db));
  ok("requireMember: Gmail la bi chan (khong dot quota Gemini)", () =>
    denied(authz.requireMember(STRANGER, db), "permission-denied"));
  ok("requireMember: chua dang nhap", () => denied(authz.requireMember(ANON, db), "unauthenticated"));

  console.log("functions/authz\n");
  for (const [n, f] of cases) {
    try { await f(); console.log("  OK   " + n); }
    catch (e) { fails++; console.log("  HONG " + n + "\n       " + (e && e.message || e)); }
  }
  console.log(fails ? "\n" + fails + " HONG" : "\nTAT CA DAT");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
