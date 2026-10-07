/**
 * storage.rules chạy THẬT trên emulator: ảnh tiến độ và video của khách chỉ
 * coach và chính khách đó đọc ghi được.
 *
 * Trước bản này luật là `allow read, write: if request.auth != null` — bất kỳ
 * Gmail nào đăng nhập cũng tải được ảnh cơ thể của mọi khách. Các ca "người lạ"
 * và "khách khác" dưới đây là đúng lỗ đó.
 *
 * Chạy: ./run-tests.sh  (tự bật emulator)  — hoặc riêng:
 *   firebase emulators:exec --only firestore,storage "node tests/rules/storage.rules.test.js"
 */
const fs = require("fs"), path = require("path");
const {
  initializeTestEnvironment, assertSucceeds, assertFails,
} = require("@firebase/rules-unit-testing");

const ROOT = path.join(__dirname, "..", "..");
const PROJECT = "demo-pulse-rules";

let fails = 0;
const cases = [];
const ok = (n, f) => cases.push([n, f]);

const COACH = { uid: "coach1", email: "chuhailong1810199@gmail.com", email_verified: true };
const COACH_A = { uid: "coachA", email: "pta@gmail.com", email_verified: true };   // coach qua coaches/{email}
const COACH_B = { uid: "coachB", email: "ptb@gmail.com", email_verified: true };
const COACH_OFF = { uid: "coachOff", email: "nghi@gmail.com", email_verified: true };
const CINDY = { uid: "u_cindy", email: "cindy@gmail.com", email_verified: true };
const SANG = { uid: "u_sang", email: "sang@gmail.com", email_verified: true };
const STRANGER = { uid: "u_x", email: "la@gmail.com", email_verified: true };

const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

(async () => {
  const env = await initializeTestEnvironment({
    projectId: PROJECT,
    firestore: { rules: fs.readFileSync(path.join(ROOT, "firestore.rules"), "utf8"), host: "127.0.0.1", port: 8080 },
    storage: { rules: fs.readFileSync(path.join(ROOT, "storage.rules"), "utf8"), host: "127.0.0.1", port: 9199 },
  });

  // Dữ liệu nền: hai khách, một coach phụ, và sẵn một file của Cindy.
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.doc("clients/cindy").set({ name: "Cindy", email: "cindy@gmail.com", coachUid: "coachA" });
    await db.doc("clients/sang").set({ name: "Sang", email: "sang@gmail.com", coachUid: "coachB" });
    await db.doc("coaches/pta@gmail.com").set({ active: true, isAdmin: false });
    await db.doc("coaches/ptb@gmail.com").set({ active: true, isAdmin: false });
    await db.doc("coaches/nghi@gmail.com").set({ active: false, isAdmin: false });
    await db.doc("clients/tien").set({ name: "Tiến", email: "" });      // khách coach tự quản
    await db.doc("users/coach2").set({ role: "coach", email: "cu@gmail.com" });   // vai trò cũ — KHÔNG còn là coach
    await db.doc("users/u_x").set({ role: "client", email: "la@gmail.com" });
    const st = ctx.storage();
    await st.ref("progressPhotos/cindy/2026-10-01.jpg").put(JPG, { contentType: "image/jpeg" });
    await st.ref("videos/cindy/squat/client").put(JPG, { contentType: "video/mp4" });
  });

  // Token giả: uid đi riêng, phần còn lại (email, email_verified) là claim.
  const ctxOf = (who) => {
    if (!who) return env.unauthenticatedContext();
    const { uid, ...claims } = who;
    return env.authenticatedContext(uid, claims);
  };
  const as = (who) => ctxOf(who).storage();
  const photo = (st, cid = "cindy") => st.ref(`progressPhotos/${cid}/2026-10-01.jpg`);
  const video = (st, cid = "cindy") => st.ref(`videos/${cid}/squat/client`);

  // ── Chính khách ────────────────────────────────────────────────
  ok("khach doc anh cua minh", () => assertSucceeds(photo(as(CINDY)).getDownloadURL()));
  ok("khach tai anh moi cua minh", () =>
    assertSucceeds(as(CINDY).ref("progressPhotos/cindy/2026-10-02.jpg").put(JPG, { contentType: "image/jpeg" })));
  ok("khach doc video cua minh", () => assertSucceeds(video(as(CINDY)).getDownloadURL()));
  ok("khach liet ke thu muc cua minh (do dung luong)", () =>
    assertSucceeds(as(CINDY).ref("videos/cindy").listAll()));
  ok("email viet hoa trong token van khop", () =>
    assertSucceeds(photo(as({ ...CINDY, email: "Cindy@Gmail.com" })).getDownloadURL()));

  // ── Khách khác: đúng lỗ hổng cũ ────────────────────────────────
  ok("khach KHAC khong doc duoc anh cua Cindy", () => assertFails(photo(as(SANG)).getDownloadURL()));
  ok("khach KHAC khong xoa duoc anh cua Cindy", () => assertFails(photo(as(SANG)).delete()));
  ok("khach KHAC khong ghi de video cua Cindy", () =>
    assertFails(video(as(SANG)).put(JPG, { contentType: "video/mp4" })));
  ok("khach KHAC khong liet ke duoc thu muc Cindy", () => assertFails(as(SANG).ref("progressPhotos/cindy").listAll()));

  // ── Người lạ đăng nhập, chưa đăng nhập ─────────────────────────
  ok("nguoi la dang nhap khong doc duoc", () => assertFails(photo(as(STRANGER)).getDownloadURL()));
  ok("nguoi la khong tai len duoc", () =>
    assertFails(as(STRANGER).ref("progressPhotos/cindy/x.jpg").put(JPG, { contentType: "image/jpeg" })));
  ok("chua dang nhap khong doc duoc", () => assertFails(photo(as(null)).getDownloadURL()));
  ok("email chua xac minh bi chan", () =>
    assertFails(photo(as({ ...CINDY, email_verified: false })).getDownloadURL()));
  ok("tai khoan khong co email khong khop khach email rong ('')", () =>
    assertFails(as({ uid: "u_noemail" }).ref("videos/tien/a/client").getDownloadURL()));

  // ── Coach ──────────────────────────────────────────────────────
  ok("coach (email) doc anh khach", () => assertSucceeds(photo(as(COACH)).getDownloadURL()));
  ok("coach (email) tai video demo", () =>
    assertSucceeds(as(COACH).ref("videos/sang/squat/coach").put(JPG, { contentType: "video/mp4" })));
  ok("coach A doc anh khach CUA MINH", () => assertSucceeds(photo(as(COACH_A)).getDownloadURL()));
  ok("coach B KHONG doc anh khach cua A", () => assertFails(photo(as(COACH_B)).getDownloadURL()));
  ok("coach B KHONG xoa video khach cua A", () => assertFails(video(as(COACH_B)).delete()));
  ok("coach bi tat KHONG doc", () => assertFails(photo(as(COACH_OFF)).getDownloadURL()));
  ok("users.role 'coach' cu KHONG con mo kho", () =>
    assertFails(photo(as({ uid: "coach2", email: "cu@gmail.com", email_verified: true })).getDownloadURL()));
  ok("coach xoa anh khach", () => assertSucceeds(as(COACH).ref("progressPhotos/cindy/2026-10-02.jpg").delete()));

  // ── Giới hạn ──────────────────────────────────────────────────
  ok("anh qua 10MB bi chan", () =>
    assertFails(as(CINDY).ref("progressPhotos/cindy/big.jpg").put(new Uint8Array(11 * 1024 * 1024), { contentType: "image/jpeg" })));
  ok("duong dan ngoai hai thu muc bi chan, ke ca coach", () =>
    assertFails(as(COACH).ref("misc/a.txt").put(JPG)));
  ok("khach khong tu dat role coach qua users de mo kho", async () => {
    // users/u_x co role 'client' — doi thanh 'coach' phai bi firestore.rules chan,
    // neu khong thi storage.rules isCoach() tin theo.
    const db = ctxOf(STRANGER).firestore();
    await assertFails(db.doc("users/u_x").update({ role: "coach" }));
  });

  console.log("storage.rules\n");
  for (const [n, f] of cases) {
    try { await f(); console.log("  OK   " + n); }
    catch (e) { fails++; console.log("  HONG " + n + "\n       " + (e && e.message || e)); }
  }
  await env.cleanup();
  console.log(fails ? "\n" + fails + " HONG" : "\nTAT CA DAT");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
