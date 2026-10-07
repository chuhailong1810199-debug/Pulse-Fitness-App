/**
 * Kiểm quyền cho callable.
 *
 * Hàm nền chạy bằng Admin SDK nên BỎ QUA firestore.rules — luật kỹ đến đâu cũng
 * không gác được một callable quên tự kiểm. Bốn callable từng không kiểm gì:
 * recommendMacros trả số liệu InBody của bất kỳ clientId cho người chưa đăng
 * nhập; pulseGenerate đọc hồ sơ + lịch sử tập của bất kỳ khách nào.
 *
 * Logic ở đây CHÉP từ firestore.rules (isCoach / isClientOwner). Đổi một bên
 * thì đổi bên kia — tests/authz.test.js giữ hai bên khớp nhau.
 */
const { HttpsError } = require("firebase-functions/v2/https");
const { getFirestore } = require("firebase-admin/firestore");

const COACH_EMAIL = "chuhailong1810199@gmail.com";

/** Email đã xác minh của người gọi, viết thường. Không có thì ném unauthenticated. */
function requireAuth(request) {
  const t = request && request.auth && request.auth.token;
  if (!t || !t.email) throw new HttpsError("unauthenticated", "Cần đăng nhập.");
  // Giống verifiedEmail() trong rules: Google luôn có claim này; chỉ chặn khi nó
  // nói rõ là false, để không khoá ai nếu claim vắng mặt.
  if (t.email_verified === false) throw new HttpsError("unauthenticated", "Email chưa xác minh.");
  return String(t.email).toLowerCase();
}

/** Có phải coach không — cùng điều kiện với isCoach() trong firestore.rules. */
async function isCoach(request, db = getFirestore()) {
  const email = requireAuth(request);
  if (email === COACH_EMAIL) return true;
  const u = await db.collection("users").doc(request.auth.uid).get();
  return u.exists && (u.data() || {}).role === "coach";
}

async function requireCoach(request, db = getFirestore()) {
  if (!(await isCoach(request, db))) throw new HttpsError("permission-denied", "Chỉ coach.");
}

/** Coach, HOẶC chính khách đó (email hồ sơ khớp email đăng nhập). */
async function assertCanAccess(request, clientId, db = getFirestore()) {
  const email = requireAuth(request);
  if (!clientId || typeof clientId !== "string") {
    throw new HttpsError("invalid-argument", "clientId is required");
  }
  if (await isCoach(request, db)) return;
  const c = await db.collection("clients").doc(clientId).get();
  const owner = c.exists ? String((c.data() || {}).email || "").toLowerCase() : "";
  // owner rỗng ('' — khách coach tự quản) không bao giờ khớp: requireAuth đã
  // bảo đảm email người gọi không rỗng.
  if (!owner || owner !== email) {
    // Cùng một câu cho "không tồn tại" và "không phải của mày" — khỏi lộ id nào có thật.
    throw new HttpsError("permission-denied", "Không có quyền với khách này.");
  }
}

/**
 * Coach hoặc một khách đã có hồ sơ. Dùng cho callable không gắn với clientId
 * nào (phân tích ảnh bữa ăn) — để một Gmail lạ không đốt quota Gemini.
 */
async function requireMember(request, db = getFirestore()) {
  const email = requireAuth(request);
  if (await isCoach(request, db)) return;
  const idx = await db.collection("clientEmails").doc(email).get();
  if (idx.exists) return;
  // Khách cũ tạo trước khi có /clientEmails: dò thẳng trên clients, như app
  // vẫn làm lúc đăng nhập (loadUserProfile, nhánh legacy).
  const legacy = await db.collection("clients").where("email", "==", email).limit(1).get();
  if (legacy.empty) throw new HttpsError("permission-denied", "Tài khoản chưa được gán hồ sơ khách.");
}

module.exports = { COACH_EMAIL, requireAuth, isCoach, requireCoach, assertCanAccess, requireMember };
