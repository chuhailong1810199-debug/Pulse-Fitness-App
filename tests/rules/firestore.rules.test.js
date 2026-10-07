/**
 * firestore.rules chạy THẬT trên emulator.
 *
 * Bản đầu phủ hai lỗ vừa vá và chốt "một Gmail = một khách" đang có — để mọi
 * lần sửa luật sau này (multi-coach, docs/plan-multi-coach.md) không làm vỡ
 * nó mà không ai biết.
 */
const fs = require("fs"), path = require("path");
const {
  initializeTestEnvironment, assertSucceeds, assertFails,
} = require("@firebase/rules-unit-testing");

const ROOT = path.join(__dirname, "..", "..");
let fails = 0;
const cases = [];
const ok = (n, f) => cases.push([n, f]);

const COACH = { uid: "coach1", email: "chuhailong1810199@gmail.com", email_verified: true };
const CINDY = { uid: "u_cindy", email: "cindy@gmail.com", email_verified: true };
const SANG = { uid: "u_sang", email: "sang@gmail.com", email_verified: true };
const STRANGER = { uid: "u_x", email: "la@gmail.com", email_verified: true };

(async () => {
  const env = await initializeTestEnvironment({
    projectId: "demo-pulse-rules",
    firestore: { rules: fs.readFileSync(path.join(ROOT, "firestore.rules"), "utf8"), host: "127.0.0.1", port: 8080 },
  });
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.doc("clients/cindy").set({ name: "Cindy", email: "cindy@gmail.com" });
    await db.doc("clients/sang").set({ name: "Sang", email: "sang@gmail.com" });
    await db.doc("clientEmails/cindy@gmail.com").set({ clientId: "cindy" });
    await db.doc("users/u_cindy").set({ role: "client", clientId: "cindy", email: "cindy@gmail.com" });
  });
  const db = (who) => {
    if (!who) return env.unauthenticatedContext().firestore();
    const { uid, ...claims } = who;
    return env.authenticatedContext(uid, claims).firestore();
  };

  // ── users: không tự cấp vai trò ────────────────────────────────
  ok("nguoi moi tu tao users voi role client", () =>
    assertSucceeds(db(STRANGER).doc("users/u_x").set({ role: "client", email: "la@gmail.com" })));
  ok("nguoi moi tu tao users khong co role", () =>
    assertSucceeds(db(SANG).doc("users/u_sang").set({ email: "sang@gmail.com" })));
  ok("KHONG tu tao users role coach", () =>
    assertFails(db(STRANGER).doc("users/u_x2").set({ role: "coach" })));
  ok("KHONG tu tao users role admin (lo cu: chi chan dung chu 'coach')", () =>
    assertFails(db({ ...STRANGER, uid: "u_x3" }).doc("users/u_x3").set({ role: "admin" })));
  ok("KHONG tao users cho uid nguoi khac", () =>
    assertFails(db(STRANGER).doc("users/u_cindy2").set({ role: "client" })));
  ok("khach KHONG tu doi role cua minh", () =>
    assertFails(db(CINDY).doc("users/u_cindy").update({ role: "coach" })));
  ok("khach KHONG tu doi clientId", () =>
    assertFails(db(CINDY).doc("users/u_cindy").update({ clientId: "sang" })));
  ok("khach sua ten cua minh duoc", () =>
    assertSucceeds(db(CINDY).doc("users/u_cindy").update({ name: "Cindy K" })));

  // ── pushSubs: không tự khai là coach ───────────────────────────
  ok("khach dang ky push role client", () =>
    assertSucceeds(db(CINDY).doc("pushSubs/a1").set({ uid: CINDY.uid, role: "client", endpoint: "e" })));
  ok("KHACH KHONG dang ky push role coach (lo cu: nhan lich + brief)", () =>
    assertFails(db(CINDY).doc("pushSubs/a2").set({ uid: CINDY.uid, role: "coach", endpoint: "e" })));
  ok("KHACH KHONG doi push cua minh sang role coach", () =>
    assertFails(db(CINDY).doc("pushSubs/a1").update({ role: "coach" })));
  ok("coach dang ky push role coach", () =>
    assertSucceeds(db(COACH).doc("pushSubs/c1").set({ uid: COACH.uid, role: "coach", endpoint: "e" })));
  ok("khong ghi push mang uid nguoi khac", () =>
    assertFails(db(STRANGER).doc("pushSubs/a3").set({ uid: CINDY.uid, role: "client" })));
  ok("khong ai doc pushSubs tu may khach", () => assertFails(db(COACH).doc("pushSubs/c1").get()));

  // ── Chốt một Gmail = một khách (CLAUDE.md) ─────────────────────
  ok("KHONG chiem lai Gmail da co chu, ke ca coach", () =>
    assertFails(db(COACH).doc("clientEmails/cindy@gmail.com").set({ clientId: "sang" })));
  ok("coach chiem Gmail con trong", () =>
    assertSucceeds(db(COACH).doc("clientEmails/moi@gmail.com").set({ clientId: "sang" })));
  ok("nguoi la chi chiem duoc dung email cua minh", () =>
    assertFails(db(STRANGER).doc("clientEmails/khac@gmail.com").set({ clientId: "x" })));
  ok("khach KHONG tu doi clients.email", () =>
    assertFails(db(CINDY).doc("clients/cindy").update({ email: "la@gmail.com" })));

  // ── Khách chỉ thấy mình ────────────────────────────────────────
  ok("khach doc ho so cua minh", () => assertSucceeds(db(CINDY).doc("clients/cindy").get()));
  ok("khach KHONG doc ho so khach khac", () => assertFails(db(CINDY).doc("clients/sang").get()));
  ok("khach KHONG liet ke clients", () => assertFails(db(CINDY).collection("clients").get()));
  ok("chua dang nhap khong doc clients", () => assertFails(db(null).doc("clients/cindy").get()));

  console.log("firestore.rules\n");
  for (const [n, f] of cases) {
    try { await f(); console.log("  OK   " + n); }
    catch (e) { fails++; console.log("  HONG " + n + "\n       " + (e && e.message || e)); }
  }
  await env.cleanup();
  console.log(fails ? "\n" + fails + " HONG" : "\nTAT CA DAT");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
