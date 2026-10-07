/**
 * Nối tài khoản đăng nhập với hồ sơ khách — làm PHÍA SERVER.
 *
 * Trước đây app tự làm hai việc mà luật Firestore cấm, nên cả hai đều hỏng:
 *   1. Người lạ đăng nhập lần đầu: app setDoc(clients/…) — luật chỉ cho coach
 *      tạo clients → permission-denied, kẹt ở màn tải.
 *   2. Khách đã từng đăng nhập, SAU ĐÓ coach mới gán Gmail (như Kem 04/10):
 *      app updateDoc(users, {clientId}) — luật cấm khách tự đổi clientId
 *      (đúng thế: đổi được thì trỏ sang khách khác được) → văng lỗi.
 *
 * Ở đây server tự tra /clientEmails — chốt một Gmail một khách — rồi mới gán.
 * Khách không bao giờ tự chọn clientId của mình.
 *
 *   email ──▶ /clientEmails/{email} có? ──có──▶ gán users.clientId
 *                  │ không
 *                  ▼
 *            clients where email== (khách cũ chưa có index)
 *                  │ 1 hồ sơ ──▶ gán      │ >1 ──▶ DỪNG, báo trùng (không tự chọn)
 *                  │ 0
 *                  ▼
 *            create? ──không──▶ { clientId: null }
 *                  │ có
 *                  ▼
 *            chiếm /clientEmails TRƯỚC (create — hỏng nếu ai chiếm rồi)
 *            → ghi clients/{id}   (hỏng thì gỡ index, không khoá Gmail vĩnh viễn)
 *            → gán users.clientId
 */
const { HttpsError } = require("firebase-functions/v2/https");
const { makeClientId } = require("./assistant.js");

async function claimMyClient(db, { uid, email, displayName, create, ownerUid }) {
  if (!uid || !email) throw new HttpsError("unauthenticated", "Cần đăng nhập.");
  const em = String(email).trim().toLowerCase();

  let clientId = null;
  const idx = await db.collection("clientEmails").doc(em).get();
  if (idx.exists) clientId = (idx.data() || {}).clientId || null;

  if (!clientId) {
    const legacy = await db.collection("clients").where("email", "==", em).limit(2).get();
    if (legacy.size > 1) {
      // Hai hồ sơ chung một Gmail: đúng sự cố Soobin/Thai Son. KHÔNG tự chọn.
      throw new HttpsError("failed-precondition",
        "Email " + em + " đang gắn với nhiều hồ sơ (" + legacy.docs.map((d) => d.id).join(", ")
        + "). Nhờ coach sửa.");
    }
    if (legacy.size === 1) clientId = legacy.docs[0].id;
  }

  let created = false;
  if (!clientId && create) {
    const id = makeClientId(displayName || em.split("@")[0]);
    try {
      await db.collection("clientEmails").doc(em).create({
        clientId: id, claimedAt: new Date().toISOString(), by: "self-signup",
      });
    } catch (e) {
      if (e.code === 6 || /already exists/i.test(e.message || "")) {
        // Vừa có người chiếm giữa lúc tra và lúc ghi — dùng đúng chủ đó.
        const again = await db.collection("clientEmails").doc(em).get();
        clientId = (again.data() || {}).clientId || null;
      } else throw e;
    }
    if (!clientId) {
      try {
        await db.collection("clients").doc(id).create({
          name: String(displayName || em).slice(0, 60),
          email: em,
          program: {},
          goal: "", level: "", sessionsPerWeek: 0,
          // Khách tự đăng ký thuộc về admin; admin chuyển cho coach khác sau.
          coachUid: ownerUid || null,
          createdAt: new Date().toISOString(),
          createdBy: "self-signup",
        });
      } catch (e) {
        // Index đã chiếm mà hồ sơ không ghi được = Gmail bị khoá vĩnh viễn cho
        // một khách không tồn tại (luật cấm update index). Gỡ ngay.
        await db.collection("clientEmails").doc(em).delete().catch(() => {});
        throw e;
      }
      clientId = id;
      created = true;
    }
  }

  if (!clientId) return { clientId: null, created: false };

  await db.collection("users").doc(uid).set(
    { email: em, role: "client", clientId }, { merge: true });
  return { clientId, created };
}

module.exports = { claimMyClient };
