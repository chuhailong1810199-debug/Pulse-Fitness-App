/**
 * claimMyClient (functions/claim-client.js) trên Firestore emulator.
 * Hai luồng từng hỏng: người lạ tự đăng ký, và khách được gán Gmail SAU khi
 * đã đăng nhập. Thêm các ca giữ chốt "một Gmail = một khách".
 */
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
process.env.GCLOUD_PROJECT = "demo-pulse-rules";
const path = require("path"), assert = require("assert");
const fnRequire = require("module").createRequire(path.join(__dirname, "..", "..", "functions", "index.js"));
const { initializeApp } = fnRequire("firebase-admin/app");
const { getFirestore } = fnRequire("firebase-admin/firestore");
initializeApp({ projectId: "demo-pulse-rules" });
const { claimMyClient } = require(path.join(__dirname, "..", "..", "functions", "claim-client.js"));

let fails = 0; const cases = [];
const ok = (n, f) => cases.push([n, f]);
const db = getFirestore();
const get = async (p) => (await db.doc(p).get());

(async () => {
  await db.doc("clients/kem").set({ name: "Kem", email: "ndqminh1705@gmail.com" });
  await db.doc("clientEmails/ndqminh1705@gmail.com").set({ clientId: "kem" });
  await db.doc("users/u_kem").set({ role: "client", email: "ndqminh1705@gmail.com" });   // đăng nhập TRƯỚC, chưa có clientId
  await db.doc("clients/old").set({ name: "Cũ", email: "cu@gmail.com" });                  // khách cũ, chưa có index
  await db.doc("clients/dup1").set({ email: "trung@gmail.com" });
  await db.doc("clients/dup2").set({ email: "trung@gmail.com" });

  ok("Kem: gan Gmail sau khi da dang nhap -> server gan clientId", async () => {
    const r = await claimMyClient(db, { uid: "u_kem", email: "NDQMinh1705@gmail.com", create: false });
    assert.deepStrictEqual(r, { clientId: "kem", created: false });
    const u = (await get("users/u_kem")).data();
    assert.strictEqual(u.clientId, "kem"); assert.strictEqual(u.role, "client");
  });

  ok("khach cu chua co index van tim thay", async () => {
    const r = await claimMyClient(db, { uid: "u_old", email: "cu@gmail.com", create: false });
    assert.strictEqual(r.clientId, "old");
  });

  ok("Gmail gan 2 ho so -> DUNG, khong tu chon (su co Soobin/Thai Son)", async () => {
    await assert.rejects(claimMyClient(db, { uid: "u_d", email: "trung@gmail.com", create: true }),
      (e) => e.code === "failed-precondition" && /dup1/.test(e.message));
    assert(!(await get("users/u_d")).exists, "không được gán gì");
  });

  ok("nguoi la, create:false -> null, khong tao gi", async () => {
    const r = await claimMyClient(db, { uid: "u_n", email: "la@gmail.com", create: false });
    assert.deepStrictEqual(r, { clientId: null, created: false });
    assert(!(await get("clientEmails/la@gmail.com")).exists);
  });

  ok("nguoi la tu dang ky -> tao index TRUOC, ho so, users", async () => {
    const r = await claimMyClient(db, { uid: "u_m", email: "Moi@Gmail.com", displayName: "Ngọc Ánh", create: true });
    assert(r.created && /^ngoc_anh_\d+$/.test(r.clientId), r.clientId);
    assert.strictEqual((await get("clientEmails/moi@gmail.com")).data().clientId, r.clientId);
    const c = (await get("clients/" + r.clientId)).data();
    assert.strictEqual(c.email, "moi@gmail.com"); assert.strictEqual(c.createdBy, "self-signup");
    assert.strictEqual((await get("users/u_m")).data().clientId, r.clientId);
  });

  ok("goi lai lan 2 -> dung ho so cu, khong tao them", async () => {
    const before = (await db.collection("clients").where("email", "==", "moi@gmail.com").get()).size;
    const r = await claimMyClient(db, { uid: "u_m", email: "moi@gmail.com", create: true });
    assert.strictEqual(r.created, false);
    assert.strictEqual((await db.collection("clients").where("email", "==", "moi@gmail.com").get()).size, before);
  });

  ok("hai may cung tu dang ky mot Gmail cung luc -> chi MOT ho so", async () => {
    const [a, b] = await Promise.all([
      claimMyClient(db, { uid: "u_r1", email: "dua@gmail.com", displayName: "A", create: true }),
      claimMyClient(db, { uid: "u_r2", email: "dua@gmail.com", displayName: "B", create: true }),
    ]);
    assert.strictEqual(a.clientId, b.clientId, a.clientId + " vs " + b.clientId);
    assert.strictEqual((await db.collection("clients").where("email", "==", "dua@gmail.com").get()).size, 1);
  });

  ok("thieu email/uid -> unauthenticated", async () => {
    await assert.rejects(claimMyClient(db, { uid: "x", email: "" }), (e) => e.code === "unauthenticated");
  });

  console.log("claimMyClient\n");
  for (const [n, f] of cases) {
    try { await f(); console.log("  OK   " + n); }
    catch (e) { fails++; console.log("  HONG " + n + "\n       " + (e && e.message || e)); }
  }
  console.log(fails ? "\n" + fails + " HONG" : "\nTAT CA DAT");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
