/**
 * Kiểm quyền cho callable — mô hình nhiều coach.
 *
 * Hàm nền chạy bằng Admin SDK nên BỎ QUA firestore.rules: luật kỹ đến đâu cũng
 * không gác được một callable quên tự kiểm. Mọi onCall phải gọi một hàm ở đây
 * (tests/callable-auth.test.js quét để bảo đảm).
 *
 * Logic CHÉP từ firestore.rules — đổi một bên thì đổi bên kia:
 *
 *   coaches/{email}  { active, isAdmin, uid }      ← chỉ admin ghi
 *   BOOTSTRAP_ADMIN luôn là admin (không bao giờ tự khoá mình ra ngoài)
 *
 *   requireAuth       đã đăng nhập, email đã xác minh
 *   requireCoach      coach đang active (kể cả admin)
 *   requireAdmin      admin
 *   assertCanManage   SỬA: chỉ coach có clients/{id}.coachUid == mình — admin cũng
 *                     chỉ sửa khách của chính mình (mỗi coach một cửa hàng riêng)
 *   assertCanView     XEM: như trên, HOẶC admin (quan sát mọi khách, chỉ xem)
 *   assertCanAccess   XEM: như assertCanView, HOẶC chính khách đó (email khớp)
 *   requireMember     coach, hoặc tài khoản đã gắn hồ sơ khách
 */
const { HttpsError } = require("firebase-functions/v2/https");
const { getFirestore } = require("firebase-admin/firestore");

const BOOTSTRAP_ADMIN = "chuhailong1810199@gmail.com";
// Tên cũ — functions/index.js vẫn dùng làm địa chỉ nhận mail lead và VAPID.
const COACH_EMAIL = BOOTSTRAP_ADMIN;

/** Email đã xác minh của người gọi, viết thường. Không có thì ném unauthenticated. */
function requireAuth(request) {
  const t = request && request.auth && request.auth.token;
  if (!t || !t.email) throw new HttpsError("unauthenticated", "Cần đăng nhập.");
  // Giống verifiedEmail() trong rules: chỉ chặn khi claim nói rõ là false.
  if (t.email_verified === false) throw new HttpsError("unauthenticated", "Email chưa xác minh.");
  return String(t.email).toLowerCase();
}

/**
 * Vai trò của người gọi: { coach, admin, email, uid }.
 * Đọc coaches/{email} mỗi lần — tắt active là mất quyền ngay, không chờ token.
 */
async function roleOf(request, db = getFirestore()) {
  const email = requireAuth(request);
  const uid = request.auth.uid;
  if (email === BOOTSTRAP_ADMIN) return { coach: true, admin: true, email, uid };
  const c = await db.collection("coaches").doc(email).get();
  const d = c.exists ? (c.data() || {}) : {};
  const coach = d.active === true;
  return { coach, admin: coach && d.isAdmin === true, email, uid };
}

async function isCoach(request, db = getFirestore()) {
  return (await roleOf(request, db)).coach;
}

async function requireCoach(request, db = getFirestore()) {
  const r = await roleOf(request, db);
  if (!r.coach) throw new HttpsError("permission-denied", "Chỉ coach.");
  return r;
}

async function requireAdmin(request, db = getFirestore()) {
  const r = await roleOf(request, db);
  if (!r.admin) throw new HttpsError("permission-denied", "Chỉ admin.");
  return r;
}

/** Cùng một câu cho "không tồn tại" và "không phải của mày" — khỏi lộ id nào có thật. */
const NO_ACCESS = () => new HttpsError("permission-denied", "Không có quyền với khách này.");

function checkClientId(clientId) {
  if (!clientId || typeof clientId !== "string") {
    throw new HttpsError("invalid-argument", "clientId is required");
  }
}

/** SỬA được không — thuần, không I/O. Admin KHÔNG có ngoại lệ. */
function canManageDoc(role, clientData) {
  if (!role || !role.coach || !clientData) return false;
  return clientData.coachUid === role.uid;
}
/** XEM được không — admin quan sát mọi khách. */
function canViewDoc(role, clientData) {
  if (!role || !role.coach || !clientData) return false;
  return role.admin || canManageDoc(role, clientData);
}

async function assertCanManage(request, clientId, db = getFirestore()) {
  checkClientId(clientId);
  const role = await roleOf(request, db);
  if (!role.coach) throw NO_ACCESS();
  const c = await db.collection("clients").doc(clientId).get();
  if (!c.exists || !canManageDoc(role, c.data())) throw NO_ACCESS();
  return role;
}

async function assertCanView(request, clientId, db = getFirestore()) {
  checkClientId(clientId);
  const role = await roleOf(request, db);
  if (!role.coach) throw NO_ACCESS();
  const c = await db.collection("clients").doc(clientId).get();
  if (!c.exists || !canViewDoc(role, c.data())) throw NO_ACCESS();
  return role;
}

async function assertCanAccess(request, clientId, db = getFirestore()) {
  checkClientId(clientId);
  const role = await roleOf(request, db);
  const c = await db.collection("clients").doc(clientId).get();
  const data = c.exists ? (c.data() || {}) : null;
  if (role.coach && canViewDoc(role, data)) return role;
  const owner = data ? String(data.email || "").toLowerCase() : "";
  // owner rỗng ('' — khách coach tự quản) không bao giờ khớp: requireAuth đã
  // bảo đảm email người gọi không rỗng.
  if (owner && owner === role.email) return role;
  throw NO_ACCESS();
}

/**
 * Coach hoặc một khách đã có hồ sơ. Cho callable không gắn với clientId nào
 * (phân tích ảnh bữa ăn) — để một Gmail lạ không đốt quota Gemini.
 */
async function requireMember(request, db = getFirestore()) {
  const role = await roleOf(request, db);
  if (role.coach) return role;
  const idx = await db.collection("clientEmails").doc(role.email).get();
  if (idx.exists) return role;
  // Khách cũ tạo trước khi có /clientEmails: dò thẳng trên clients.
  const legacy = await db.collection("clients").where("email", "==", role.email).limit(1).get();
  if (legacy.empty) throw new HttpsError("permission-denied", "Tài khoản chưa được gán hồ sơ khách.");
  return role;
}

/** uid của admin gốc — chủ mặc định của khách tự đăng ký. null nếu admin chưa đăng nhập lần nào sau đợt này. */
async function defaultOwnerUid(db = getFirestore()) {
  const c = await db.collection("coaches").doc(BOOTSTRAP_ADMIN).get();
  return (c.exists && (c.data() || {}).uid) || null;
}

module.exports = {
  BOOTSTRAP_ADMIN, COACH_EMAIL, requireAuth, roleOf, isCoach, requireCoach, requireAdmin,
  canManageDoc, canViewDoc, assertCanManage, assertCanView, assertCanAccess, requireMember, defaultOwnerUid,
};
