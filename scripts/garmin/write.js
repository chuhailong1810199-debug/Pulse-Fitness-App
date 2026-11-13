/**
 * Ghi file của sync.py lên hồ sơ coach — trường `garmin` RIÊNG trong recovery/{ngày} và activity/{ngày}.
 *
 *   node scripts/garmin/write.js            # chạy thử: in ra sẽ ghi gì
 *   node scripts/garmin/write.js --write    # ghi thật
 *   node scripts/garmin/write.js --client longchu
 *
 * KHÔNG đụng trường của Polar (sleep, recharge, load, steps…): Polar vẫn đồng bộ mỗi ngày vào cùng
 * doc. Chỉ set-merge đúng một khoá `garmin` — chạy lại bao nhiêu lần cũng chỉ ghi đè bản Garmin cũ.
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

(async () => {
  if (!fs.existsSync(FILE)) { console.error("Chưa có " + FILE + " — chạy sync.py trước."); process.exit(1); }
  const { days } = JSON.parse(fs.readFileSync(FILE, "utf8"));
  initializeApp({ projectId: "fitness-app-a22c8" });
  const db = getFirestore(), c = db.collection("clients").doc(CLIENT);
  if (!(await c.get()).exists) { console.error("Không có khách " + CLIENT); process.exit(1); }
  const at = new Date().toISOString();
  const batch = db.batch();
  let n = 0;
  for (const d of days || []) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d.date))) continue;
    const rec = { sleep: d.sleep, hrv: d.hrv, rhr: d.rhr, bodyBattery: d.bodyBattery, stressAvg: d.stressAvg, readiness: d.readiness, at };
    const act = { steps: d.steps, calories: d.calories, activeCalories: d.activeCalories, intensityMin: d.intensityMin, workouts: d.workouts || [], at };
    const hasRec = !!(d.sleep || d.hrv || d.rhr || d.bodyBattery || d.readiness);
    const hasAct = d.steps != null || (d.workouts || []).length > 0;
    console.log(`${d.date}  recovery:${hasRec ? "có" : "—"}  activity:${hasAct ? "có" : "—"}`
      + `  ngủ ${d.sleep ? (d.sleep.total / 3600).toFixed(1) + "h" : "—"}  HRV ${d.hrv ? d.hrv.lastNight : "—"}  bước ${d.steps ?? "—"}`);
    if (hasRec) { batch.set(c.collection("recovery").doc(d.date), { date: d.date, garmin: rec }, { merge: true }); n++; }
    if (hasAct) { batch.set(c.collection("activity").doc(d.date), { date: d.date, garmin: act }, { merge: true }); n++; }
  }
  if (!WRITE) { console.log(`\nCHẠY THỬ — ${n} lần ghi vào clients/${CLIENT}. Thêm --write để ghi thật.`); return; }
  await batch.commit();
  console.log(`\n✓ Đã ghi ${n} doc (trường garmin) vào clients/${CLIENT}.`);
})().catch((e) => { console.error("LỖI", e.message); process.exit(1); });
