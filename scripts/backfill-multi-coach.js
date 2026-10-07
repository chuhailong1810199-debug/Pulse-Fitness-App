#!/usr/bin/env node
/**
 * Chuẩn bị dữ liệu cho mô hình nhiều coach — chạy TRƯỚC khi deploy luật mới.
 *
 *   node scripts/backfill-multi-coach.js            # CHẠY THỬ: chỉ in ra sẽ đổi gì
 *   node scripts/backfill-multi-coach.js --write    # ghi thật
 *
 * Cần quyền Admin SDK vào project fitness-app-a22c8:
 *   gcloud auth application-default login
 * (hoặc GOOGLE_APPLICATION_CREDENTIALS trỏ tới file service account).
 *
 * Làm gì:
 *   1. coaches/<admin gốc> { active, isAdmin, uid } + settings/platform { adminUid }
 *   2. clients thiếu coachUid  → uid admin   (luật mới: coach không thấy khách không chủ)
 *   3. bookings thiếu coachUid → uid admin   (luật mới từ chối lịch không chủ)
 *   4. /clientEmails cho khách có email mà thiếu chỉ mục — trừ khi Gmail đó
 *      đang ở NHIỀU hồ sơ: in ra để xử lý tay, KHÔNG tự chọn.
 *   5. Báo (không sửa): email có chữ hoa/khoảng trắng — luật so viết thường,
 *      khách đó sẽ không mở được hồ sơ/ảnh của chính mình.
 *
 * Chạy lại bao nhiêu lần cũng được: chỉ đụng tới thứ còn thiếu.
 */
const path = require("path");
const fnRequire = require("module").createRequire(path.join(__dirname, "..", "functions", "index.js"));
const { initializeApp } = fnRequire("firebase-admin/app");
const { getFirestore } = fnRequire("firebase-admin/firestore");
const { getAuth } = fnRequire("firebase-admin/auth");

const BOOTSTRAP_ADMIN = "chuhailong1810199@gmail.com";
const WRITE = process.argv.includes("--write");
const argAdminUid = (process.argv.find((a) => a.startsWith("--admin-uid=")) || "").split("=")[1];

async function main({ db, adminUid, write, log = console.log }) {
  const plan = { coachDoc: null, clients: [], strays: [], bookings: [], emailIndex: [], conflicts: [], badEmails: [] };

  // 1. Doc admin
  const cRef = db.collection("coaches").doc(BOOTSTRAP_ADMIN);
  const cur = await cRef.get();
  const want = { active: true, isAdmin: true, uid: adminUid };
  const d = cur.exists ? cur.data() : {};
  if (!cur.exists || d.active !== true || d.isAdmin !== true || d.uid !== adminUid) {
    plan.coachDoc = want;
  }
  // App đọc uid admin ở đây để biết khách nào được bật thu tiền.
  const pf = await db.collection("settings").doc("platform").get();
  plan.platform = (pf.exists && (pf.data() || {}).adminUid === adminUid) ? null : { adminUid };

  // 2 + 4 + 5. Khách
  // coachUid "lạ" = không phải admin và không thuộc coach nào trong coaches/
  // (ví dụ khách tạo từ một tài khoản khác trước đợt này). Không gom lại thì
  // admin mở app sẽ chỉ thấy một phần khách.
  const coachUids = new Set([adminUid]);
  (await db.collection("coaches").get()).forEach((d) => { const u = (d.data() || {}).uid; if (u) coachUids.add(u); });
  const clients = await db.collection("clients").get();
  const byEmail = new Map();
  clients.forEach((doc) => {
    const v = doc.data() || {};
    if (!v.coachUid) plan.clients.push(doc.id);
    else if (!coachUids.has(v.coachUid)) { plan.clients.push(doc.id); plan.strays.push(`${doc.id} (${v.coachUid})`); }
    const raw = typeof v.email === "string" ? v.email : "";
    if (raw && raw !== raw.trim().toLowerCase()) plan.badEmails.push(`${doc.id}: "${raw}"`);
    const em = raw.trim().toLowerCase();
    if (em) byEmail.set(em, [...(byEmail.get(em) || []), doc.id]);
  });
  for (const [em, ids] of byEmail) {
    const idx = await db.collection("clientEmails").doc(em).get();
    if (ids.length > 1) { plan.conflicts.push(`${em} → ${ids.join(", ")}`); continue; }
    if (!idx.exists) plan.emailIndex.push({ email: em, clientId: ids[0] });
    else if ((idx.data() || {}).clientId !== ids[0]) {
      plan.conflicts.push(`${em}: chỉ mục trỏ '${idx.data().clientId}', hồ sơ là '${ids[0]}'`);
    }
  }

  // 3. Lịch
  const bookings = await db.collection("bookings").get();
  bookings.forEach((doc) => {
    const u = (doc.data() || {}).coachUid;
    if (!u || !coachUids.has(u)) plan.bookings.push(doc.id);
  });

  log(`Admin gốc: ${BOOTSTRAP_ADMIN} (uid ${adminUid})`);
  log(`  coaches/${BOOTSTRAP_ADMIN}: ${plan.coachDoc ? "SẼ GHI " + JSON.stringify(plan.coachDoc) : "đã đúng"}`);
  log(`  settings/platform: ${plan.platform ? "SẼ GHI " + JSON.stringify(plan.platform) : "đã đúng"}`);
  log(`  clients sẽ gán cho admin: ${plan.clients.length}${plan.clients.length ? " — " + plan.clients.join(", ") : ""}`);
  if (plan.strays.length) log(`    trong đó coachUid lạ (không phải admin, không thuộc coach nào): ${plan.strays.join(", ")}`);
  log(`  bookings thiếu coachUid: ${plan.bookings.length}`);
  log(`  chỉ mục Gmail còn thiếu: ${plan.emailIndex.length}${plan.emailIndex.length ? " — " + plan.emailIndex.map((x) => x.email).join(", ") : ""}`);
  if (plan.conflicts.length) log("  ⚠ XUNG ĐỘT (xử lý tay, script KHÔNG đụng):\n    " + plan.conflicts.join("\n    "));
  if (plan.badEmails.length) log("  ⚠ Email có chữ hoa/khoảng trắng (sửa qua màn Edit khách):\n    " + plan.badEmails.join("\n    "));

  if (!write) { log("\nCHẠY THỬ — chưa ghi gì. Thêm --write để ghi."); return plan; }

  if (plan.coachDoc) await cRef.set({ name: "Long Chu", ...plan.coachDoc }, { merge: true });
  if (plan.platform) await db.collection("settings").doc("platform").set(plan.platform, { merge: true });
  // Batch 400 thao tác một lần (giới hạn 500).
  const ops = [
    ...plan.clients.map((id) => (b) => b.update(db.collection("clients").doc(id), { coachUid: adminUid })),
    ...plan.bookings.map((id) => (b) => b.update(db.collection("bookings").doc(id), { coachUid: adminUid })),
  ];
  for (let i = 0; i < ops.length; i += 400) {
    const b = db.batch();
    ops.slice(i, i + 400).forEach((f) => f(b));
    await b.commit();
  }
  // Chỉ mục: create() từng cái — hỏng nếu ai vừa chiếm, đúng như chốt chặn muốn.
  for (const { email, clientId } of plan.emailIndex) {
    await db.collection("clientEmails").doc(email)
      .create({ clientId, claimedAt: new Date().toISOString(), by: "backfill-multi-coach" })
      .catch((e) => log(`  ⚠ không tạo được chỉ mục ${email}: ${e.message}`));
  }
  log("\nĐÃ GHI.");
  return plan;
}

if (require.main === module) {
  (async () => {
    initializeApp({ projectId: process.env.GCLOUD_PROJECT || "fitness-app-a22c8" });
    let adminUid = argAdminUid;
    if (!adminUid) {
      try { adminUid = (await getAuth().getUserByEmail(BOOTSTRAP_ADMIN)).uid; } catch (e) {
        console.error("Không tìm được uid admin (" + e.message + "). Chạy lại với --admin-uid=<uid>.");
        process.exit(1);
      }
    }
    await main({ db: getFirestore(), adminUid, write: WRITE });
    process.exit(0);
  })().catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { main };
