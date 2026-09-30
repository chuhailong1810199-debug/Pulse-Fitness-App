#!/usr/bin/env node
/**
 * Đăng ký / xem / xoá webhook Polar AccessLink. Chạy MỘT LẦN là xong.
 *
 * Webhook dùng xác thực khác với phần còn lại của API: Basic auth bằng
 * client_id:client_secret của ứng dụng, KHÔNG phải access token của người dùng.
 * Mỗi ứng dụng chỉ đăng ký được đúng một webhook.
 *
 * KHÔNG chứa bí mật trong file. Truyền qua biến môi trường:
 *
 *   # xem webhook hiện có
 *   POLAR_CLIENT_ID=xxx POLAR_CLIENT_SECRET=yyy node outputs/polar-webhook-setup.js list
 *
 *   # đăng ký (Polar sẽ PING vào URL, phải trả 200 thì mới nhận)
 *   POLAR_CLIENT_ID=xxx POLAR_CLIENT_SECRET=yyy \
 *     node outputs/polar-webhook-setup.js create https://<url-ham>/polarWebhook
 *
 *   # xoá
 *   POLAR_CLIENT_ID=xxx POLAR_CLIENT_SECRET=yyy node outputs/polar-webhook-setup.js delete <id>
 *
 * Lúc tạo, Polar trả về signature_secret_key MỘT LẦN DUY NHẤT và không xem lại
 * được. Lưu ngay:
 *   firebase functions:secrets:set POLAR_WEBHOOK_SECRET
 * rồi deploy lại polarWebhook.
 */
const API = "https://www.polaraccesslink.com/v3/webhooks";
const ID = process.env.POLAR_CLIENT_ID;
const SECRET = process.env.POLAR_CLIENT_SECRET;
const [, , cmd, arg] = process.argv;

if (!ID || !SECRET) {
  console.error("Thiếu POLAR_CLIENT_ID hoặc POLAR_CLIENT_SECRET.");
  process.exit(1);
}
const auth = "Basic " + Buffer.from(`${ID}:${SECRET}`).toString("base64");

const call = async (method, path, body) => {
  const r = await fetch(API + (path || ""), {
    method,
    headers: {
      Authorization: auth,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  let j = null;
  try { j = t ? JSON.parse(t) : null; } catch { /* để nguyên văn bản */ }
  return { status: r.status, json: j, text: t };
};

(async () => {
  if (cmd === "list") {
    const r = await call("GET");
    console.log("HTTP", r.status);
    console.log(JSON.stringify(r.json || r.text, null, 2));
    return;
  }

  if (cmd === "create") {
    if (!arg || !/^https:\/\//.test(arg)) {
      console.error("Cần URL https của hàm. VD: node ... create https://.../polarWebhook");
      process.exit(1);
    }
    // Chỉ đăng ký những sự kiện app thật sự dùng. Đăng ký thừa là tự bắn vào
    // chân: mỗi sự kiện là một lần chạy hàm, và hàm có tốn tiền.
    const events = ["SLEEP", "EXERCISE", "ACTIVITY_SUMMARY", "CONTINUOUS_HEART_RATE"];
    const r = await call("POST", "", { events, url: arg });
    console.log("HTTP", r.status);
    console.log(JSON.stringify(r.json || r.text, null, 2));
    const key = r.json && r.json.data && r.json.data.signature_secret_key;
    if (key) {
      console.log("\n────────────────────────────────────────────────────────");
      console.log("CHỈ HIỆN MỘT LẦN. Lưu ngay rồi deploy lại:");
      console.log("  firebase functions:secrets:set POLAR_WEBHOOK_SECRET");
      console.log("  (dán khoá ở trên khi được hỏi)");
      console.log("  firebase deploy --only functions:polarWebhook");
      console.log("────────────────────────────────────────────────────────");
    }
    return;
  }

  if (cmd === "delete") {
    if (!arg) { console.error("Cần id webhook. Chạy 'list' để lấy."); process.exit(1); }
    const r = await call("DELETE", "/" + arg);
    console.log("HTTP", r.status, r.text || "(xoá xong)");
    return;
  }

  console.error("Dùng: list | create <https url> | delete <id>");
  process.exit(1);
})();
