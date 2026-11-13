/**
 * Ghi file của sync.py lên hồ sơ coach — trường `garmin` RIÊNG trong recovery/{ngày} và activity/{ngày}.
 *
 *   node scripts/garmin/write.js            # chạy thử: in ra sẽ ghi gì
 *   node scripts/garmin/write.js --write    # ghi thật
 *   node scripts/garmin/write.js --client longchu
 *
 * KHÔNG đụng trường của Polar (sleep, recharge, load, steps, workouts…): Polar vẫn đồng bộ mỗi ngày vào
 * cùng doc. Chỉ set-merge khoá `garmin` — chạy lại bao nhiêu lần cũng chỉ ghi đè bản Garmin cũ.
 *   recovery/{ngày}.garmin  — ngủ, HRV, RHR, Body Battery, stress, readiness
 *   activity/{ngày}.garmin  — bước, calo, phút cường độ + workouts[] (tab Work list đọc chỗ này)
 *   clients/{id}.garminSync — { at, workouts, from, to } cho dòng "Đồng bộ lúc …" của tab Work list
 * Luật Firestore hiện có (recovery / activity: coach + chính khách) áp nguyên, không mở thêm gì.
 */
const fs = require("fs"), path = require("path");
const R = require("module").createRequire(path.join(__dirname, "..", "..", "functions", "index.js"));
const { initializeApp } = R("firebase-admin/app");
const { getFirestore } = R("firebase-admin/firestore");

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const WRITE = process.argv.includes("--write");
const CLIENT = arg("--client", "longchu");
const FILE = path.join(__dirname, "out", "garmin-latest.json");
const DAY = /^\d{4}-\d{2}-\d{2}$/;

(async () => {
  if (!fs.existsSync(FILE)) { console.error("Chưa có " + FILE + " — chạy sync.py trước."); process.exit(1); }
  const { days = [], workouts = [] } = JSON.parse(fs.readFileSync(FILE, "utf8"));
  initializeApp({ projectId: "fitness-app-a22c8" });
  const db = getFirestore(), c = db.collection("clients").doc(CLIENT);
  if (!(await c.get()).exists) { console.error("Không có khách " + CLIENT); process.exit(1); }
  const at = new Date().toISOString();

  // Gom theo ngày: sức khoẻ + buổi tập (buổi tập có thể có ở ngày không kéo sức khoẻ — lịch sử cũ).
  const byDay = {};
  const slot = (d) => (byDay[d] = byDay[d] || { rec: null, act: {}, workouts: [] });
  for (const d of days) {
    if (!DAY.test(String(d.date))) continue;
    const s = slot(d.date);
    if (d.sleep || d.hrv || d.rhr || d.bodyBattery || d.readiness) {
      s.rec = { sleep: d.sleep, hrv: d.hrv, rhr: d.rhr, bodyBattery: d.bodyBattery, stressAvg: d.stressAvg, readiness: d.readiness, at };
    }
    if (d.steps != null) Object.assign(s.act, { steps: d.steps, calories: d.calories, activeCalories: d.activeCalories, intensityMin: d.intensityMin });
  }
  for (const w of workouts) {
    const d = String(w.at || "").slice(0, 10);
    if (DAY.test(d)) slot(d).workouts.push(w);
  }

  const ops = [];
  for (const [d, s] of Object.entries(byDay).sort()) {
    if (s.rec) ops.push([c.collection("recovery").doc(d), { date: d, garmin: s.rec }]);
    if (Object.keys(s.act).length || s.workouts.length) {
      // workouts LUÔN là mảng của Garmin cho ngày đó (thay cả mảng) — set-merge thay mảng, không cộng dồn.
      ops.push([c.collection("activity").doc(d), { date: d, garmin: { ...s.act, workouts: s.workouts, at } }]);
    }
  }
  const dates = Object.keys(byDay).sort();
  console.log(`${days.length} ngày sức khoẻ · ${workouts.length} buổi tập · ${dates[0] || "—"} → ${dates[dates.length - 1] || "—"}`);
  for (const w of workouts.slice(-6)) console.log(`  ${String(w.at).slice(0, 16)}  ${w.sport}  ${w.name || ""}  ${Math.round((w.sec || 0) / 60)}′  load ${w.load ?? "—"}`);
  if (!WRITE) { console.log(`\nCHẠY THỬ — ${ops.length} doc sẽ ghi vào clients/${CLIENT}. Thêm --write để ghi thật.`); return; }

  // Batch tối đa 500 thao tác.
  for (let i = 0; i < ops.length; i += 400) {
    const b = db.batch();
    for (const [ref, data] of ops.slice(i, i + 400)) b.set(ref, data, { merge: true });
    await b.commit();
  }
  await c.set({ garminSync: { at, workouts: workouts.length, from: dates[0] || null, to: dates[dates.length - 1] || null } }, { merge: true });
  console.log(`\n✓ Đã ghi ${ops.length} doc (trường garmin) + garminSync vào clients/${CLIENT}.`);
})().catch((e) => { console.error("LỖI", e.message); process.exit(1); });
