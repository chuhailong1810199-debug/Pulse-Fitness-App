/**
 * Trục TẬP LUYỆN cho lời khuyên Recovery (2026-11-16) — đọc từ đúng nơi tab Work list đọc:
 * activity/{ngày}.garmin.workouts + activity/{ngày}.strava.workouts (bỏ buổi Strava trùng giờ một buổi Garmin ±2 phút,
 * giống loadWorklist), cộng buổi tạ khách ghi trong app (workoutHistory). Hồ sơ không có Garmin / Strava (Polar) →
 * lấy `workouts` gốc của doc activity.
 *
 * index.html có BẢN SAO (khối `// ── TẬP LUYỆN CHO RECOVERY`) để tab Recovery hiện cùng con số —
 * tests/training-context.test.js bắt hai bản ra cùng kết quả. Sửa một bản phải sửa cả hai.
 *
 * Không có ngưỡng "nghỉ / tập" ở đây — chỉ gom số. Quyết định là việc của prompt (đọc cùng trục Recovery).
 */

const DAY = 864e5;

function trCat(sport) {
  const s = String(sport || "").toLowerCase();
  if (/run/.test(s)) return "run";
  if (/strength|weight/.test(s)) return "strength";
  if (/hiit|cardio|boxing|crossfit|interval|bootcamp/.test(s)) return "hiit";
  if (/cycl|bik|spin/.test(s)) return "bike";
  return "other";
}

const trNum = (v) => (typeof v === "number" && isFinite(v) ? v : null);
function trT(at) {
  const m = String(at || "").match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  return m ? Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5]) : null;   // giờ địa phương đọc như UTC — chỉ để so / trừ
}
function trDays(a, b) {   // số ngày từ b tới a, hai chuỗi YYYY-MM-DD
  const p = String(a).split("-").map(Number), q = String(b).split("-").map(Number);
  return Math.round((Date.UTC(p[0], p[1] - 1, p[2]) - Date.UTC(q[0], q[1] - 1, q[2])) / DAY);
}

/** Buổi tập của Work list từ các doc activity (mới → cũ), đã chuẩn hoá. */
function worklistWorkouts(activityDocs) {
  const g = [], s = [], polar = [];
  for (const d of activityDocs || []) {
    if (!d) continue;
    for (const w of ((d.garmin || {}).workouts || [])) if (w && w.at) g.push({ ...w, src: "garmin" });
    for (const w of ((d.strava || {}).workouts || [])) if (w && w.at) s.push({ ...w, src: "strava" });
    if (!d.garmin && !d.strava) for (const w of (d.workouts || [])) if (w && w.at) polar.push({ ...w, src: "polar" });
  }
  const gT = g.map((w) => trT(w.at));
  const items = g.concat(s.filter((w) => !gT.some((t) => t != null && Math.abs(t - trT(w.at)) <= 120000)));
  const use = items.length ? items : polar;
  return use.map((w) => {
    const cat = trCat(w.sport), km = trNum(w.distM) ? w.distM / 1000 : null;
    return {
      date: String(w.at).slice(0, 10), at: String(w.at).replace(" ", "T").slice(0, 16), cat, src: w.src,
      name: w.name || null, sec: trNum(w.sec), km: km != null ? Math.round(km * 100) / 100 : null,
      paceSec: cat === "run" && trNum(w.speed) > 0 ? Math.round(1000 / w.speed) : null,
      hrAvg: trNum(w.hrAvg), hrMax: trNum(w.hrMax), load: trNum(w.load), teAer: trNum(w.teAer), teAna: trNum(w.teAna),
    };
  }).sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

/**
 * Tóm tắt tập luyện tới ngày `today` (YYYY-MM-DD, giờ VN).
 * sessions: buổi ghi trong app [{date, day, done, total, volume, muscles: {nhóm: set}}].
 * Buổi NẶNG: Training Effect của Garmin (aerobic ≥ 3,5 hoặc anaerobic ≥ 2,5); buổi không có TE thì tải ≥ 1,5 × trung vị
 * tải 28 ngày của chính người đó. Không đủ dữ liệu để biết → không gắn nặng.
 */
function trainingSummary(workouts, sessions, today) {
  const ws = (workouts || []).filter((w) => { const g = trDays(today, w.date); return g >= 0 && g < 28; });
  const ss = (sessions || []).filter((x) => x && x.date && (x.done || 0) > 0 && trDays(today, x.date) >= 0 && trDays(today, x.date) < 28);
  const loads = ws.map((w) => w.load).filter((v) => v != null && v > 0).sort((a, b) => a - b);
  const med = loads.length >= 4 ? loads[Math.floor((loads.length - 1) / 2)] : null;
  const hard = (w) => (w.teAer != null || w.teAna != null)
    ? ((w.teAer || 0) >= 3.5 || (w.teAna || 0) >= 2.5)
    : (med != null && w.load != null && w.load >= 1.5 * med);
  const win = (lo, hi) => {
    const a = ws.filter((w) => { const g = trDays(today, w.date); return g >= lo && g < hi; });
    const sd = new Set(a.filter((w) => w.cat === "strength").map((w) => w.date));
    ss.forEach((x) => { const g = trDays(today, x.date); if (g >= lo && g < hi) sd.add(x.date); });
    const byCat = {};
    a.forEach((w) => { byCat[w.cat] = (byCat[w.cat] || 0) + 1; });
    return {
      sessions: a.length + ss.filter((x) => { const g = trDays(today, x.date); return g >= lo && g < hi && !a.some((w) => w.cat === "strength" && w.date === x.date); }).length,
      byCat, strengthDays: sd.size,
      runKm: Math.round(a.filter((w) => w.cat === "run").reduce((t, w) => t + (w.km || 0), 0) * 10) / 10,
      min: Math.round(a.reduce((t, w) => t + (w.sec || 0), 0) / 60),
      load: Math.round(a.reduce((t, w) => t + (w.load || 0), 0)),
      loadN: a.filter((w) => w.load != null).length,
      hard: a.filter(hard).length,
    };
  };
  // Số tuần trước có DỮ LIỆU (tính từ buổi cũ nhất trong 28 ngày, tối đa 3): mới kết nối Garmin 2 tuần thì chia 2,
  // không chia 3 — chia 3 kéo trung bình xuống và thổi tỉ lệ tuần này lên.
  const oldest = Math.max(-1, ...ws.map((w) => trDays(today, w.date)), ...ss.map((x) => trDays(today, x.date)));
  const prevWeeks = Math.max(0, Math.min(3, Math.ceil((oldest - 6) / 7)));
  const d7 = win(0, 7), prev = win(7, 7 + 7 * prevWeeks);
  const avg = (v) => (prevWeeks ? Math.round((v / prevWeeks) * 10) / 10 : 0);
  const avg3 = { sessions: avg(prev.sessions), runKm: avg(prev.runKm), min: Math.round(avg(prev.min)), load: Math.round(avg(prev.load)) };
  // Tỉ lệ tuần này / TB 3 tuần trước — theo tải nếu đa số buổi có tải, không thì theo phút. Cần ≥ 2 tuần dữ liệu trước đó.
  const byLoad = d7.loadN > 0 && prev.loadN > 0 && d7.loadN >= (d7.sessions - d7.strengthDays) / 2;
  const base = byLoad ? avg3.load : avg3.min, cur = byLoad ? d7.load : d7.min;
  const ratio = prevWeeks >= 2 && base > 0 ? Math.round((cur / base) * 100) / 100 : null;
  const since = (pred) => { const w = ws.find(pred); return w ? trDays(today, w.date) : null; };
  const lastHardW = ws.find(hard);
  const lastApp = ss.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
  const appStrengthAgo = lastApp ? trDays(today, lastApp.date) : null;
  const sAgo = since((w) => w.cat === "strength");
  return {
    today,
    d7, avg3, ratio, ratioBasis: ratio == null ? null : byLoad ? "load" : "min",
    prevWeeks,
    daysSince: {
      any: [since(() => true), appStrengthAgo].filter((v) => v != null).sort((a, b) => a - b)[0] ?? null,
      run: since((w) => w.cat === "run"),
      strength: [sAgo, appStrengthAgo].filter((v) => v != null).sort((a, b) => a - b)[0] ?? null,
      hard: lastHardW ? trDays(today, lastHardW.date) : null,
    },
    lastHard: lastHardW ? { date: lastHardW.date, cat: lastHardW.cat, name: lastHardW.name, teAer: lastHardW.teAer, teAna: lastHardW.teAna, load: lastHardW.load } : null,
    // 48 giờ gần nhất (hôm nay + hôm qua): buổi Work list + nhóm cơ của buổi tạ ghi trong app.
    recent: ws.filter((w) => trDays(today, w.date) <= 1).map((w) => ({ ...w, hard: hard(w) })),
    recentApp: ss.filter((x) => trDays(today, x.date) <= 1).map((x) => ({
      date: x.date, day: x.day || null, done: x.done, total: x.total,
      top: Object.entries(x.muscles || {}).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([m, n]) => m + " " + Math.round(n * 10) / 10),
    })),
    list14: ws.filter((w) => trDays(today, w.date) < 14).map((w) => ({ ...w, hard: hard(w) })),
  };
}

/** Chữ ký để biết lời khuyên đã cũ: có buổi Work list / buổi app mới hơn lúc phân tích. */
function trainingSig(workouts, sessions) {
  // Chỉ buổi MỚI NHẤT — đếm tổng thì cửa sổ 28 ngày trượt qua ngày mới cũng làm chữ ký đổi.
  const w = (workouts || [])[0], s = (sessions || []).filter((x) => (x.done || 0) > 0).map((x) => x.at || x.date).sort().pop();
  return (w ? w.at : "") + "|" + (s || "");
}

module.exports = { trCat, worklistWorkouts, trainingSummary, trainingSig, trDays };
