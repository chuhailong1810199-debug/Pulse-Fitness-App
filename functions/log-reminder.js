/**
 * Nhắc coach LOG buổi tập sau khi buổi kết thúc (coach hay quên — 2026-10-15).
 * Thuần, không I/O, không đồng hồ — test được. Phần gửi push ở functions/index.js.
 *
 * Lịch (bookings) gần như không mang clientId: tên khách nằm trong title
 * ("Thái Sơn", "Kem", "Chị Linh"). Khớp title ↔ tên khách sau khi bỏ dấu; không
 * khớp được đúng MỘT khách thì bỏ qua — đó là việc riêng của coach, hoặc mơ hồ.
 */

const fold = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/đ/gi, "d").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
// Xưng hô hay đứng trước tên trong lịch / hồ sơ: "Chị Linh", "anh Soobin".
const HONORIFIC = /^(chi|anh|em|co|chu|bac|ong|ba|pt|lop)\s+/;
const core = (s) => fold(s).replace(HONORIFIC, "").trim();

/**
 * @param {object} b        booking { clientId?, title }
 * @param {Array}  clients  [{ id, name, isGroup? }] của đúng coach đó
 * @returns {object|null}   khách khớp duy nhất
 */
function matchClient(b, clients) {
  if (b.clientId) return clients.find((c) => c.id === b.clientId) || null;
  const t = fold(b.title), tc = core(b.title);
  if (!t) return null;
  const hits = clients.filter((c) => {
    const n = fold(c.name), nc = core(c.name);
    if (!n) return false;
    if (n === t || (nc && nc === tc)) return true;
    const word = (needle, hay) => needle.length >= 3 && new RegExp("(^| )" + needle + "( |$)").test(hay);
    // Tiêu đề dài hơn tên ("Kem - leg day"), hoặc lịch ghi tên gọi còn hồ sơ ghi
    // họ tên đầy đủ ("Anh Tiến" ↔ "Trần Văn Tiến"): khớp NGUYÊN TỪ, ≥ 3 ký tự.
    return word(nc, t) || word(tc, n);
  });
  return hits.length === 1 ? hits[0] : null;
}

const hhmm = (s) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || "").trim()); return m ? +m[1] * 60 + +m[2] : null; };
/** Giờ kết thúc (phút từ 0h VN); thiếu endTime thì coi buổi dài 60 phút. */
const endMin = (b) => hhmm(b.endTime) != null ? hhmm(b.endTime) : (hhmm(b.startTime) != null ? hhmm(b.startTime) + 60 : null);

/**
 * Buổi HÔM NAY tới hạn kiểm log: đã kết thúc 30–180 phút, chưa kiểm lần nào.
 * Cửa sổ rộng để một lượt chạy trễ vẫn bắt được; chống gửi trùng là cờ logCheckedAt.
 */
function dueLogChecks(list, nowMin) {
  return (list || []).filter((b) => {
    if (b.logCheckedAt || b.status === "cancelled") return false;
    const e = endMin(b);
    if (e == null) return false;
    const since = nowMin - e;
    return since >= 30 && since <= 180;
  });
}

/** Mốc UTC (ms) của "date HH:mm" theo giờ VN. */
function ictToUtcMs(dateStr, hm) {
  const [y, mo, d] = String(dateStr).split("-").map(Number);
  const min = hhmm(hm) || 0;
  return Date.UTC(y, mo - 1, d, Math.floor(min / 60), min % 60) - 7 * 3600 * 1000;
}

/**
 * Buổi coi là ĐÃ LOG nếu khách có buổi tập ghi từ 60 phút trước giờ bắt đầu trở đi
 * (coach hay bấm Hoàn thành sớm, hoặc khách tự log trước khi tới).
 */
function isLogged(b, lastWorkoutMs) {
  if (!lastWorkoutMs) return false;
  return lastWorkoutMs >= ictToUtcMs(b.date, b.startTime) - 60 * 60 * 1000;
}

module.exports = { fold, matchClient, dueLogChecks, isLogged, ictToUtcMs, endMin };
