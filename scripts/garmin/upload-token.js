/**
 * Đưa token Garmin (KHÔNG phải mật khẩu) từ Mac lên máy chủ, để hàm nền garminSyncNow / garminSyncDaily dùng.
 *
 *   scripts/garmin/.venv/bin/python scripts/garmin/login.py     # đăng nhập trên Mac (mật khẩu tự gõ)
 *   node scripts/garmin/upload-token.js                          # rồi chạy lệnh này
 *
 * Ghi vào Firestore privateTokens/garmin_longchu — luật CHẶN mọi máy khách (kể cả admin trên web); chỉ hàm nền
 * (Admin SDK) đọc được. Không in token ra màn hình. Token có giá trị như mật khẩu: muốn thu hồi thì đổi mật khẩu
 * Garmin và chạy  node scripts/garmin/upload-token.js --delete
 */
const fs = require("fs"), os = require("os"), path = require("path");
const R = require("module").createRequire(path.join(__dirname, "..", "..", "functions", "index.js"));
const { initializeApp } = R("firebase-admin/app");
const { getFirestore, FieldValue } = R("firebase-admin/firestore");

const CLIENT = "longchu";
const FILE = path.join(process.env.GARMINTOKENS || path.join(os.homedir(), ".garminconnect"), "garmin_tokens.json");

(async () => {
  initializeApp({ projectId: "fitness-app-a22c8" });
  const ref = getFirestore().doc("privateTokens/garmin_" + CLIENT);
  if (process.argv.includes("--delete")) { await ref.delete(); console.log("✓ Đã xoá token Garmin trên máy chủ."); return; }
  if (!fs.existsSync(FILE)) { console.error("Chưa có " + FILE + " — chạy login.py trước."); process.exit(1); }
  const raw = fs.readFileSync(FILE, "utf8");
  try { JSON.parse(raw); } catch (_e) { console.error("File token hỏng — chạy lại login.py."); process.exit(1); }
  await ref.set({ tokens: raw, updatedAt: FieldValue.serverTimestamp(), from: "upload-token.js" });
  console.log("✓ Đã đưa token Garmin lên máy chủ (privateTokens/garmin_" + CLIENT + "). Bấm Sync trong tab Work list để thử.");
})().catch((e) => { console.error("LỖI", e.message); process.exit(1); });
