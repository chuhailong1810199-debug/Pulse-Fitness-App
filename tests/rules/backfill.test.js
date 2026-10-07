/** scripts/backfill-multi-coach.js trên emulator: chạy thử không ghi, --write ghi đúng thứ thiếu, chạy lại không đổi gì. */
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
const path = require("path"), assert = require("assert");
const fnRequire = require("module").createRequire(path.join(__dirname, "..", "..", "functions", "index.js"));
const { initializeApp } = fnRequire("firebase-admin/app");
const { getFirestore } = fnRequire("firebase-admin/firestore");
initializeApp({ projectId: "demo-pulse-rules" });
const { main } = require(path.join(__dirname, "..", "..", "scripts", "backfill-multi-coach.js"));

let fails = 0; const cases = [];
const ok = (n, f) => cases.push([n, f]);
const quiet = () => {};

(async () => {
  const db = getFirestore();
  await db.doc("clients/cindy").set({ email: "cindy@gmail.com" });                 // thiếu coachUid + thiếu index
  await db.doc("clients/kem").set({ email: "kem@gmail.com", coachUid: "admin1" });
  await db.doc("clientEmails/kem@gmail.com").set({ clientId: "kem" });
  await db.doc("clients/d1").set({ email: "trung@gmail.com" });                    // Gmail ở 2 hồ sơ
  await db.doc("clients/d2").set({ email: "trung@gmail.com" });
  await db.doc("clients/hoa").set({ email: "Hoa@Gmail.com " });                     // chữ hoa
  await db.doc("bookings/b1").set({ date: "2026-10-08" });
  await db.doc("bookings/b2").set({ date: "2026-10-08", coachUid: "x" });          // coach thật (có trong coaches)
  await db.doc("coaches/x@gmail.com").set({ active: true, uid: "x" });
  await db.doc("clients/la").set({ email: "", coachUid: "uid_cu_khong_ai" });       // coachUid lạ
  await db.doc("bookings/b3").set({ date: "2026-10-08", coachUid: "uid_cu_khong_ai" });

  ok("chay thu KHONG ghi gi", async () => {
    const p = await main({ db, adminUid: "admin1", write: false, log: quiet });
    assert.deepStrictEqual(p.clients.sort(), ["cindy", "d1", "d2", "hoa", "la"]);
    assert.deepStrictEqual(p.strays, ["la (uid_cu_khong_ai)"]);
    assert.deepStrictEqual(p.bookings.sort(), ["b1", "b3"]);
    assert(!(await db.doc("coaches/chuhailong1810199@gmail.com").get()).exists);
    assert(!(await db.doc("clients/cindy").get()).data().coachUid);
  });
  ok("--write ghi dung thu thieu", async () => {
    const p = await main({ db, adminUid: "admin1", write: true, log: quiet });
    const c = (await db.doc("coaches/chuhailong1810199@gmail.com").get()).data();
    assert(c.active && c.isAdmin && c.uid === "admin1");
    assert.strictEqual((await db.doc("clients/cindy").get()).data().coachUid, "admin1");
    assert.strictEqual((await db.doc("bookings/b1").get()).data().coachUid, "admin1");
    assert.strictEqual((await db.doc("bookings/b2").get()).data().coachUid, "x", "không đè chủ là coach thật");
    assert.strictEqual((await db.doc("clients/la").get()).data().coachUid, "admin1", "coachUid lạ gom về admin");
    assert.strictEqual((await db.doc("clientEmails/cindy@gmail.com").get()).data().clientId, "cindy");
    assert(p.conflicts.some((x) => /trung@gmail\.com/.test(x)), "phải báo Gmail trùng");
    assert(!(await db.doc("clientEmails/trung@gmail.com").get()).exists, "KHÔNG tự chọn khi trùng");
    assert(p.badEmails.some((x) => /hoa/.test(x)), "phải báo email chữ hoa");
  });
  ok("chay lai: khong con gi de lam (tru xung dot da bao)", async () => {
    const p = await main({ db, adminUid: "admin1", write: false, log: quiet });
    assert.strictEqual(p.coachDoc, null);
    assert.strictEqual(p.clients.length, 0);
    assert.strictEqual(p.bookings.length, 0);
    assert.strictEqual(p.emailIndex.filter((x) => x.email !== "hoa@gmail.com").length, 0);
  });

  console.log("Backfill multi-coach\n");
  for (const [n, f] of cases) {
    try { await f(); console.log("  OK   " + n); }
    catch (e) { fails++; console.log("  HONG " + n + "\n       " + (e && e.message || e)); }
  }
  console.log(fails ? "\n" + fails + " HONG" : "\nTAT CA DAT");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
