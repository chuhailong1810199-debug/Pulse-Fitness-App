/**
 * firestore.rules chạy THẬT trên emulator — ma trận quyền nhiều coach.
 *
 *   ADMIN (gốc)   ADMIN2 (coaches.isAdmin)   COACH_A   COACH_B   COACH_OFF (active:false)
 *   CINDY = khách của A      SANG = khách của B      STRANGER      ANON
 *
 * Ca nào ghi "lỗ cũ" là lỗ có thật trước đợt này.
 */
const fs = require("fs"), path = require("path");
const {
  initializeTestEnvironment, assertSucceeds, assertFails,
} = require("@firebase/rules-unit-testing");

const ROOT = path.join(__dirname, "..", "..");
// emulators:exec đặt sẵn địa chỉ emulator vào biến môi trường — đọc từ đó để
// chạy được trên cổng khác khi một phiên khác đang giữ 8080/9199.
const hp = (v, port) => { const m = String(v || "").match(/^(.*):(\d+)$/); return m ? { host: m[1], port: +m[2] } : { host: "127.0.0.1", port }; };
let fails = 0;
const cases = [];
const ok = (n, f) => cases.push([n, f]);

const V = { email_verified: true };
const ADMIN = { uid: "admin1", email: "chuhailong1810199@gmail.com", ...V };
const ADMIN2 = { uid: "admin2", email: "quanly@gmail.com", ...V };
const COACH_A = { uid: "coachA", email: "pta@gmail.com", ...V };
const COACH_B = { uid: "coachB", email: "ptb@gmail.com", ...V };
const COACH_OFF = { uid: "coachOff", email: "nghi@gmail.com", ...V };
const CINDY = { uid: "u_cindy", email: "cindy@gmail.com", ...V };
const SANG = { uid: "u_sang", email: "sang@gmail.com", ...V };
const STRANGER = { uid: "u_x", email: "la@gmail.com", ...V };

(async () => {
  const env = await initializeTestEnvironment({
    projectId: "demo-pulse-rules",
    firestore: { rules: fs.readFileSync(path.join(ROOT, "firestore.rules"), "utf8"), ...hp(process.env.FIRESTORE_EMULATOR_HOST, 8080) },
  });
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.doc("coaches/quanly@gmail.com").set({ name: "QL", active: true, isAdmin: true, uid: "admin2" });
    await db.doc("coaches/pta@gmail.com").set({ name: "A", active: true, isAdmin: false, uid: "coachA" });
    await db.doc("coaches/ptb@gmail.com").set({ name: "B", active: true, isAdmin: false });
    await db.doc("coaches/nghi@gmail.com").set({ name: "Off", active: false, isAdmin: false, uid: "coachOff" });
    await db.doc("clients/cindy").set({ name: "Cindy", email: "cindy@gmail.com", coachUid: "coachA",
      access: { planId: "pro", paidUntil: "2026-12-01" } });
    await db.doc("clients/sang").set({ name: "Sang", email: "sang@gmail.com", coachUid: "coachB" });
    await db.doc("clients/nocoach").set({ name: "Mồ côi", email: "", coachUid: null });
    await db.doc("clients/longchu").set({ name: "Long", email: "", coachUid: "admin1",
      access: { planId: "pro", paidUntil: "2026-12-01" } });
    await db.doc("clients/longchu/invoices/i9").set({ status: "unpaid", kind: "access", planId: "pro", amount: 1 });
    await db.doc("exercises/squat").set({ name: "Squat" });                       // thư viện gốc
    await db.doc("exercises/a_bai").set({ name: "Bài của A", ownerUid: "coachA" });
    await db.doc("clients/cindy/checkpoints/c1").set({ weight: 58 });
    await db.doc("clients/sang/checkpoints/c1").set({ weight: 50 });
    await db.doc("clients/cindy/invoices/i1").set({ status: "unpaid", kind: "access", planId: "pro", amount: 1 });
    await db.doc("clientEmails/cindy@gmail.com").set({ clientId: "cindy" });
    await db.doc("clientEmails/sang@gmail.com").set({ clientId: "sang" });
    await db.doc("bookings/b1").set({ coachUid: "coachA", date: "2026-10-08", clientId: "cindy" });
    await db.doc("bookings/b2").set({ coachUid: "coachB", date: "2026-10-08", clientId: "sang" });
    await db.doc("users/u_cindy").set({ role: "client", clientId: "cindy", email: "cindy@gmail.com" });
    await db.doc("leads/l1").set({ name: "x", email: "x@gmail.com" });
    await db.doc("settings/plans").set({ pro: { price: 1, months: 1 } });
  });
  const db = (who) => {
    if (!who) return env.unauthenticatedContext().firestore();
    const { uid, ...claims } = who;
    return env.authenticatedContext(uid, claims).firestore();
  };
  const q = (who, coll, uid) => db(who).collection(coll).where("coachUid", "==", uid).get();

  // ── Danh sách khách ────────────────────────────────────────────
  ok("admin goc truy van tran clients", () => assertSucceeds(db(ADMIN).collection("clients").get()));
  ok("admin (coaches.isAdmin) truy van tran clients", () => assertSucceeds(db(ADMIN2).collection("clients").get()));
  ok("coach A truy van where coachUid==A", () => assertSucceeds(q(COACH_A, "clients", "coachA")));
  ok("coach A truy van TRAN bi tu choi ca lan", () => assertFails(db(COACH_A).collection("clients").get()));
  ok("coach A truy van where coachUid==B bi chan", () => assertFails(q(COACH_A, "clients", "coachB")));
  ok("coach A doc khach cua minh", () => assertSucceeds(db(COACH_A).doc("clients/cindy").get()));
  ok("coach A KHONG doc khach cua B", () => assertFails(db(COACH_A).doc("clients/sang").get()));
  ok("coach bi tat KHONG doc gi", () => assertFails(q(COACH_OFF, "clients", "coachOff")));
  ok("coach B (chua co uid trong doc) van truy van duoc khach cua minh", () =>
    assertSucceeds(q(COACH_B, "clients", "coachB")));
  ok("khach doc chinh minh", () => assertSucceeds(db(CINDY).doc("clients/cindy").get()));
  ok("khach KHONG doc khach khac", () => assertFails(db(CINDY).doc("clients/sang").get()));
  ok("khach KHONG liet ke clients", () => assertFails(db(CINDY).collection("clients").get()));
  ok("chua dang nhap khong doc", () => assertFails(db(null).doc("clients/cindy").get()));

  // ── Subcollection ──────────────────────────────────────────────
  ok("coach A doc checkpoint khach minh", () => assertSucceeds(db(COACH_A).doc("clients/cindy/checkpoints/c1").get()));
  ok("coach A KHONG doc checkpoint khach B", () => assertFails(db(COACH_A).doc("clients/sang/checkpoints/c1").get()));
  ok("coach A KHONG ghi checkpoint khach B", () =>
    assertFails(db(COACH_A).doc("clients/sang/checkpoints/c2").set({ weight: 1 })));
  ok("admin doc checkpoint moi khach", () => assertSucceeds(db(ADMIN).doc("clients/sang/checkpoints/c1").get()));
  ok("khach ghi checkpoint cua minh", () =>
    assertSucceeds(db(CINDY).doc("clients/cindy/checkpoints/c3").set({ weight: 57 })));

  // ── Tạo / sửa / xoá khách ──────────────────────────────────────
  ok("coach A tao khach cho chinh minh (khong email)", () =>
    assertSucceeds(db(COACH_A).doc("clients/moi_a").set({ name: "Mới", email: "", coachUid: "coachA" })));
  ok("coach A KHONG tao khach gan cho B", () =>
    assertFails(db(COACH_A).doc("clients/moi_b").set({ name: "x", email: "", coachUid: "coachB" })));
  ok("coach A KHONG tao khach voi email chua chiem chi muc", () =>
    assertFails(db(COACH_A).doc("clients/moi_c").set({ name: "x", email: "chuachiem@gmail.com", coachUid: "coachA" })));
  ok("coach A chiem chi muc roi tao khach co email", async () => {
    await assertSucceeds(db(COACH_A).doc("clientEmails/moi2@gmail.com").set({ clientId: "moi_d" }));
    await assertSucceeds(db(COACH_A).doc("clients/moi_d").set({ name: "x", email: "moi2@gmail.com", coachUid: "coachA" }));
  });
  ok("coach A sua ten khach minh", () => assertSucceeds(db(COACH_A).doc("clients/cindy").update({ name: "Cindy K" })));
  ok("coach A doi goi (access.planId) cho khach minh", () =>
    assertSucceeds(db(COACH_A).doc("clients/cindy").update({ "access.planId": "basic" })));
  ok("coach A KHONG tu gia han access.paidUntil", () =>
    assertFails(db(COACH_A).doc("clients/cindy").update({ "access.paidUntil": "2027-12-01" })));
  ok("coach A KHONG chuyen khach sang coach khac", () =>
    assertFails(db(COACH_A).doc("clients/cindy").update({ coachUid: "coachB" })));
  ok("coach A KHONG sua khach cua B", () => assertFails(db(COACH_A).doc("clients/sang").update({ name: "x" })));
  ok("coach A KHONG ghi thang clients.email khong qua chi muc", () =>
    assertFails(db(COACH_A).doc("clients/cindy").update({ email: "khac@gmail.com" })));
  ok("admin chuyen khach sang coach B", () =>
    assertSucceeds(db(ADMIN).doc("clients/nocoach").update({ coachUid: "coachB" })));
  ok("admin gia han paidUntil khach CUA MINH", () =>
    assertSucceeds(db(ADMIN).doc("clients/longchu").update({ "access.paidUntil": "2027-01-01" })));

  // ── Admin QUAN SÁT: xem mọi thứ, KHÔNG sửa khách của coach khác ─
  ok("admin KHONG sua giao an khach cua coach A", () =>
    assertFails(db(ADMIN).doc("clients/cindy").update({ program: {} })));
  ok("admin KHONG sua ten khach cua coach A", () =>
    assertFails(db(ADMIN).doc("clients/cindy").update({ name: "x" })));
  ok("admin KHONG ghi checkpoint khach cua coach A", () =>
    assertFails(db(ADMIN).doc("clients/cindy/checkpoints/c9").set({ weight: 1 })));
  ok("admin KHONG xoa khach cua coach A", () => assertFails(db(ADMIN).doc("clients/cindy").delete()));
  ok("admin KHONG tao khach gan cho coach A", () =>
    assertFails(db(ADMIN).doc("clients/x_a").set({ name: "x", email: "", coachUid: "coachA" })));
  ok("admin chuyen khach (chi doi coachUid) giua coach", () =>
    assertSucceeds(db(ADMIN).doc("clients/sang").update({ coachUid: "coachA" }).then(() =>
      db(ADMIN).doc("clients/sang").update({ coachUid: "coachB" }))));
  ok("admin KHONG doi coachUid kem sua truong khac", () =>
    assertFails(db(ADMIN).doc("clients/sang").update({ coachUid: "coachA", name: "x" })));
  ok("admin KHONG tao lich cho coach B", () =>
    assertFails(db(ADMIN).doc("bookings/bx").set({ coachUid: "coachB", date: "2026-10-09" })));
  ok("admin KHONG sua lich cua coach A", () =>
    assertFails(db(ADMIN).doc("bookings/b1").update({ title: "x" })));
  ok("admin tao lich cua chinh minh", () =>
    assertSucceeds(db(ADMIN).doc("bookings/bm").set({ coachUid: "admin1", date: "2026-10-09" })));
  ok("admin KHONG chiem Gmail tro vao khach coach A", () =>
    assertFails(db(ADMIN).doc("clientEmails/moi9@gmail.com").set({ clientId: "cindy" })));
  ok("admin sua khach cua chinh minh", () =>
    assertSucceeds(db(ADMIN).doc("clients/longchu").update({ name: "Long C" })));

  // ── Thư viện bài tập ─────────────────────────────────────────
  ok("moi tai khoan dang nhap doc thu vien", () => assertSucceeds(db(CINDY).collection("exercises").get()));
  ok("coach KHONG sua bai trong thu vien goc", () =>
    assertFails(db(COACH_A).doc("exercises/squat").update({ name: "x" })));
  ok("coach KHONG xoa bai trong thu vien goc", () => assertFails(db(COACH_A).doc("exercises/squat").delete()));
  ok("coach tao bai rieng mang ownerUid cua minh", () =>
    assertSucceeds(db(COACH_A).doc("exercises/a_moi").set({ name: "Moi", ownerUid: "coachA" })));
  ok("coach KHONG tao bai gia danh coach khac / thu vien goc", async () => {
    await assertFails(db(COACH_A).doc("exercises/gia1").set({ name: "x", ownerUid: "coachB" }));
    await assertFails(db(COACH_A).doc("exercises/gia2").set({ name: "x" }));
  });
  ok("coach sua/xoa bai rieng cua minh", async () => {
    await assertSucceeds(db(COACH_A).doc("exercises/a_bai").update({ name: "Đổi" }));
    await assertSucceeds(db(COACH_A).doc("exercises/a_moi").delete());
  });
  ok("coach B KHONG sua/xoa bai rieng cua coach A", async () => {
    await assertFails(db(COACH_B).doc("exercises/a_bai").update({ name: "x" }));
    await assertFails(db(COACH_B).doc("exercises/a_bai").delete());
  });
  ok("coach KHONG chuyen bai rieng thanh bai goc", () =>
    assertFails(db(COACH_A).doc("exercises/a_bai").update({ ownerUid: null })));
  ok("admin sua thu vien goc", () => assertSucceeds(db(ADMIN).doc("exercises/squat").update({ name: "Back Squat" })));
  ok("admin KHONG sua bai rieng cua coach A", () =>
    assertFails(db(ADMIN).doc("exercises/a_bai").update({ name: "x" })));
  ok("khach KHONG ghi thu vien", () => assertFails(db(CINDY).doc("exercises/k").set({ name: "x" })));
  ok("coach A KHONG xoa khach cua B", () => assertFails(db(COACH_A).doc("clients/sang").delete()));
  ok("khach KHONG tu doi coachUid/access/email", async () => {
    await assertFails(db(CINDY).doc("clients/cindy").update({ coachUid: "coachB" }));
    await assertFails(db(CINDY).doc("clients/cindy").update({ "access.paidUntil": "2030-01-01" }));
    await assertFails(db(CINDY).doc("clients/cindy").update({ email: "la@gmail.com" }));
  });
  ok("khach sua ten minh", () => assertSucceeds(db(CINDY).doc("clients/cindy").update({ name: "C" })));

  // ── Chỉ mục Gmail — một Gmail = một khách ──────────────────────
  ok("KHONG chiem lai Gmail da co chu, ke ca admin", () =>
    assertFails(db(ADMIN).doc("clientEmails/cindy@gmail.com").set({ clientId: "sang" })));
  ok("coach B KHONG xoa chi muc Gmail khach cua A (lo moi khi co 2 coach)", () =>
    assertFails(db(COACH_B).doc("clientEmails/cindy@gmail.com").delete()));
  ok("coach B KHONG chiem Gmail tro vao khach cua A", () =>
    assertFails(db(COACH_B).doc("clientEmails/khac@gmail.com").set({ clientId: "cindy" })));
  ok("coach A xoa chi muc Gmail khach minh (de doi email)", async () => {
    await env.withSecurityRulesDisabled((c) => c.firestore().doc("clientEmails/tam@gmail.com").set({ clientId: "cindy" }));
    await assertSucceeds(db(COACH_A).doc("clientEmails/tam@gmail.com").delete());
  });
  ok("nguoi la chi chiem dung email cua minh", () =>
    assertFails(db(STRANGER).doc("clientEmails/khac2@gmail.com").set({ clientId: "x" })));

  // ── Hoá đơn ────────────────────────────────────────────────────
  ok("coach A doc hoa don khach minh", () => assertSucceeds(db(COACH_A).doc("clients/cindy/invoices/i1").get()));
  ok("coach A KHONG danh dau da tra (studio thu chung)", () =>
    assertFails(db(COACH_A).doc("clients/cindy/invoices/i1").update({ status: "paid" })));
  ok("coach A huy hoa don chua tra", () =>
    assertSucceeds(db(COACH_A).doc("clients/cindy/invoices/i1").update({ status: "cancelled" })));
  ok("coach A lap hoa don chua tra cho khach minh", () =>
    assertSucceeds(db(COACH_A).doc("clients/cindy/invoices/i2").set({ status: "unpaid", amount: 5 })));
  ok("coach A KHONG lap hoa don 'paid'", () =>
    assertFails(db(COACH_A).doc("clients/cindy/invoices/i3").set({ status: "paid", amount: 5 })));
  ok("admin KHONG danh dau da tra hoa don khach coach A", () =>
    assertFails(db(ADMIN).doc("clients/cindy/invoices/i2").update({ status: "paid" })));
  ok("admin danh dau da tra hoa don khach cua minh", () =>
    assertSucceeds(db(ADMIN).doc("clients/longchu/invoices/i9").update({ status: "paid" })));
  ok("admin van DOC hoa don khach coach A (quan sat)", () =>
    assertSucceeds(db(ADMIN).doc("clients/cindy/invoices/i1").get()));
  ok("coach B KHONG doc hoa don khach cua A", () => assertFails(db(COACH_B).doc("clients/cindy/invoices/i1").get()));

  // ── Lịch ───────────────────────────────────────────────────────
  ok("coach A truy van lich cua minh", () => assertSucceeds(q(COACH_A, "bookings", "coachA")));
  ok("coach A KHONG truy van tran lich", () => assertFails(db(COACH_A).collection("bookings").get()));
  ok("coach A KHONG doc lich cua B", () => assertFails(db(COACH_A).doc("bookings/b2").get()));
  ok("coach A tao lich mang coachUid cua minh", () =>
    assertSucceeds(db(COACH_A).doc("bookings/b3").set({ coachUid: "coachA", date: "2026-10-09" })));
  ok("coach A KHONG tao lich thieu coachUid", () =>
    assertFails(db(COACH_A).doc("bookings/b4").set({ date: "2026-10-09" })));
  ok("coach A KHONG chuyen lich sang B", () => assertFails(db(COACH_A).doc("bookings/b1").update({ coachUid: "coachB" })));
  ok("admin xem moi lich", () => assertSucceeds(db(ADMIN).collection("bookings").get()));
  ok("khach KHONG doc lich", () => assertFails(db(CINDY).doc("bookings/b1").get()));

  // ── Coaches / users / leads / settings ────────────────────────
  ok("coach doc doc coaches cua chinh minh", () => assertSucceeds(db(COACH_A).doc("coaches/pta@gmail.com").get()));
  ok("coach KHONG doc doc cua coach khac", () => assertFails(db(COACH_A).doc("coaches/ptb@gmail.com").get()));
  ok("coach KHONG tu nang minh len admin", () =>
    assertFails(db(COACH_A).doc("coaches/pta@gmail.com").update({ isAdmin: true })));
  ok("coach bi tat KHONG tu bat lai", () =>
    assertFails(db(COACH_OFF).doc("coaches/nghi@gmail.com").update({ active: true })));
  ok("coach lan dau ghi uid cua minh", () =>
    assertSucceeds(db(COACH_B).doc("coaches/ptb@gmail.com").update({ uid: "coachB", lastLoginAt: "x" })));
  ok("KHONG ghi de uid nguoi khac vao doc coach", () =>
    assertFails(db({ ...COACH_A, uid: "hacker" }).doc("coaches/pta@gmail.com").update({ uid: "hacker" })));
  ok("nguoi la KHONG tu tao doc coaches", () =>
    assertFails(db(STRANGER).doc("coaches/la@gmail.com").set({ active: true, isAdmin: true })));
  ok("admin moi coach moi", () =>
    assertSucceeds(db(ADMIN).doc("coaches/moi@gmail.com").set({ name: "Mới", active: true, isAdmin: false })));
  ok("coach thuong KHONG doc users", () => assertFails(db(COACH_A).doc("users/u_cindy").get()));
  ok("admin doc users", () => assertSucceeds(db(ADMIN).doc("users/u_cindy").get()));
  ok("coach thuong KHONG doc leads", () => assertFails(db(COACH_A).doc("leads/l1").get()));
  ok("admin doc leads", () => assertSucceeds(db(ADMIN).doc("leads/l1").get()));
  ok("coach thuong KHONG sua bang gia", () => assertFails(db(COACH_A).doc("settings/plans").set({ pro: { price: 0 } })));
  ok("coach thuong doc bang gia", () => assertSucceeds(db(COACH_A).doc("settings/plans").get()));
  ok("coach thuong KHONG tao bai goc (khong ownerUid)", () =>
    assertFails(db(COACH_A).doc("exercises/e1").set({ name: "Squat" })));

  // ── Tự cấp vai trò (lỗ cũ) ─────────────────────────────────────
  ok("KHONG tu tao users role admin", () =>
    assertFails(db({ ...STRANGER, uid: "u_x3" }).doc("users/u_x3").set({ role: "admin" })));
  ok("nguoi moi tu tao users role client", () =>
    assertSucceeds(db(STRANGER).doc("users/u_x").set({ role: "client", email: "la@gmail.com" })));
  ok("khach KHONG tu doi role/clientId", async () => {
    await assertFails(db(CINDY).doc("users/u_cindy").update({ role: "coach" }));
    await assertFails(db(CINDY).doc("users/u_cindy").update({ clientId: "sang" }));
  });
  ok("KHACH KHONG dang ky push role coach", () =>
    assertFails(db(CINDY).doc("pushSubs/a2").set({ uid: CINDY.uid, role: "coach", endpoint: "e" })));
  ok("coach A dang ky push role coach", () =>
    assertSucceeds(db(COACH_A).doc("pushSubs/c1").set({ uid: COACH_A.uid, role: "coach", endpoint: "e" })));
  ok("coach bi tat KHONG dang ky push role coach", () =>
    assertFails(db(COACH_OFF).doc("pushSubs/c2").set({ uid: COACH_OFF.uid, role: "coach", endpoint: "e" })));

  console.log("firestore.rules\n");
  for (const [n, f] of cases) {
    try { await f(); console.log("  OK   " + n); }
    catch (e) { fails++; console.log("  HONG " + n + "\n       " + (e && e.message || e)); }
  }
  await env.cleanup();
  console.log(fails ? "\n" + fails + " HONG" : "\nTAT CA DAT");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
