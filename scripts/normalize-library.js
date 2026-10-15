#!/usr/bin/env node
/**
 * Chuẩn hoá nhóm cơ trong thư viện bài tập (exercises) — luật ở docs/library-rules.md.
 *
 *   node scripts/normalize-library.js            # CHẠY THỬ: in ra sẽ đổi gì
 *   node scripts/normalize-library.js --write    # ghi thật (sao lưu trước vào exerciseBackups/<thời điểm>)
 *
 * Làm:
 *  1. Tên nhóm cơ về MỘT bộ chuẩn (khớp vùng trên hình cơ thể): "GLUTES"/"Glutes" → "Glutes".
 *  2. "DELTOID" chung → đầu vai cụ thể theo kiểu bài (bench press không tô vai sau).
 *  3. Điền nhóm cơ cho bài đang trống; sửa vài bài ghi sai rõ ràng.
 *  4. Vai trò Q → T. BÁO CÁO (không tự sửa) biến thể cùng bài mà hồ sơ cơ khác nhau.
 * Không đổi tên bài, không đụng bài riêng của coach (có ownerUid).
 */
const path = require("path");
const fs = require("fs");
const fnRequire = require("module").createRequire(path.join(__dirname, "..", "functions", "index.js"));
const WRITE = process.argv.includes("--write");

// Dùng CHÍNH bảng map của app để tên chuẩn ở thư viện khớp với hình cơ thể.
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const sl = (a, b) => html.slice(html.indexOf(a), html.indexOf(b, html.indexOf(a)));
const app = new Function(
  sl("var CD_MUSCLE_MAP", "var CD_REGION_VI") + sl("function cdFold", "function cdT")
  + sl("var _cdMapMemo", "function cdSessions").replace(/console\.warn\([^;]*\);/g, "")
  + sl("const MUSCLE_CANON_LABEL", "function isWarmupPhase")
  + "; return { canonMuscle, cdMapMuscle };")();

/** DELTOID chung → đầu vai theo kiểu bài. [regex tên bài, [[đầu, vai trò|null=giữ]]] — khớp đầu tiên thắng. */
const DELT_RULES = [
  [/rear delt|reverse fly|face ?pull|pull[- ]?apart|supported rear|bent.*fly|pull across/i, [["Rear Delts", null]]],
  [/lateral|side raise|y lateral|upright row|y[- ]raise|lying lateral/i, [["Side Delts", null]]],
  [/front.*raise|shoulder raise|battle rope|\(battle rope\)/i, [["Front Delts", null]]],
  [/shoulder press|overhead|military|arnold|push press|behind the neck|pike|handstand|thruster|jerk|landmine.*press|clean/i,
    [["Front Delts", null], ["Side Delts", "S"]]],
  [/bench|chest|push ?up|press up|dip|fly|pec|floor press|incline|decline|toss/i, [["Front Delts", null]]],
  [/row|pull|chin|pulldown|neck/i, [["Rear Delts", null]]],
];

/** Bài trống nhóm cơ / ghi sai rõ ràng → hồ sơ đúng. Tên phải khớp y thư viện. */
const FIX = {
  "Sumo Squat (Bodyweight)": { Quads: "P", Glutes: "P", Adductors: "S" },
  "Single Leg Kickstand Deadlift (Dumbbell)": { Hamstrings: "P", Glutes: "P" },
  "Bird Dog (Bodyweight)": { Abs: "P", "Erector Spinae": "S", Glutes: "S" },
  "Bird Dog (Weighted)": { Abs: "P", "Erector Spinae": "S", Glutes: "S" },
  "Standing Wood Chop (Med Ball)": { Obliques: "P", Abs: "S" },
  "Half Kneeling Wood Chop (Med Ball)": { Obliques: "P", Abs: "S" },
  "Standing Reverse Wood Chop (Med Ball)": { Obliques: "P", Abs: "S" },
  "Half Kneeling Reverse Wood Chop (Med Ball)": { Obliques: "P", Abs: "S" },
  "Sand Bag Carry": { Abs: "P", Traps: "S", Forearms: "S" },
  "External Rotation (Bodyweight)": { "Rotator Cuff": "P", "Rear Delts": "S" },
  "I Raise (Bodyweight)": { "Mid/Lower Traps": "P", "Rear Delts": "S" },
  "One Arm Cable Row (Cable)": { Lats: "P", Rhomboids: "S", "Rear Delts": "S", Biceps: "S" },
  // Ghi sai: máy back extension là cơ dựng sống + mông, không phải cơ bụng.
  "Back Extension (Machine)": { "Erector Spinae": "P", Glutes: "S", Hamstrings: "S" },
  "Back Extension Hold (Bodyweight)": { "Erector Spinae": "P", Glutes: "S" },
  "Back Extension Hold (Weighted)": { "Erector Spinae": "P", Glutes: "S" },
  // Mang vác: tay cầm + cầu vai là chính, cơ bụng giữ thân.
  "Farmer's Carry (Dumbbell)": { Forearms: "P", Traps: "S", Abs: "S" },
  "Suitcase Carry (Kettlebell)": { Obliques: "P", Forearms: "S", Traps: "S" },
  "Bear Crawl (Bodyweight)": { Abs: "P", "Front Delts": "S", Quads: "S" },
};

const ROLE_RANK = { P: 0, S: 1, T: 2 };
function normalize(x) {
  if (FIX[x.name]) return { muscles: FIX[x.name], why: "sửa tay" };
  const out = {}; const notes = [];
  const put = (m, r) => { if (!out[m] || ROLE_RANK[r] < ROLE_RANK[out[m]]) out[m] = r; };
  for (const [raw, role0] of Object.entries(x.muscles || {})) {
    const role = role0 === "Q" ? "T" : role0;
    const c = app.canonMuscle(raw);
    if (c === "Deltoids") {
      const rule = DELT_RULES.find(([re]) => re.test(x.name));
      if (rule) { rule[1].forEach(([head, r]) => put(head, r || role)); notes.push("DELTOID→" + rule[1].map((h) => h[0]).join("+")); }
      else { put("Deltoids", role); notes.push("DELTOID giữ chung (không nhận ra kiểu bài)"); }
    } else put(c, role);
  }
  return { muscles: out, why: notes.join(", ") };
}
const same = (a, b) => JSON.stringify(Object.entries(a || {}).sort()) === JSON.stringify(Object.entries(b || {}).sort());

async function main({ db, write, log = console.log }) {
  const snap = await db.collection("exercises").get();
  const docs = snap.docs.filter((d) => !(d.data() || {}).ownerUid);
  const changes = [], stillEmpty = [];
  for (const d of docs) {
    const x = d.data();
    const r = normalize(x);
    if (!Object.keys(r.muscles).length) stillEmpty.push(x.name);
    if (!same(r.muscles, x.muscles)) changes.push({ ref: d.ref, name: x.name, before: x.muscles || {}, after: r.muscles, why: r.why });
  }
  // Biến thể cùng bài (bỏ phần dụng cụ trong ngoặc) mà hồ sơ cơ sau chuẩn hoá vẫn khác nhau.
  const byBase = {};
  for (const d of docs) {
    const x = d.data(), after = (changes.find((c) => c.ref.id === d.id) || {}).after || x.muscles || {};
    const base = String(x.name).replace(/\s*\(.*?\)\s*/g, " ").trim().toLowerCase();
    (byBase[base] = byBase[base] || []).push({ name: x.name, prof: JSON.stringify(Object.entries(after).sort()) });
  }
  const variants = Object.values(byBase).filter((g) => g.length > 1 && new Set(g.map((v) => v.prof)).size > 1);

  const fmt = (m) => Object.entries(m).map(([k, v]) => k + ":" + v).join(", ") || "—";
  log(`Thư viện gốc: ${docs.length} bài · sẽ đổi: ${changes.length} · vẫn trống nhóm cơ: ${stillEmpty.length} (${stillEmpty.join(", ") || "không"})`);
  const kinds = {};
  changes.forEach((c) => { const k = c.why.startsWith("sửa tay") ? "sửa tay" : c.why.includes("DELTOID") ? "vai cụ thể" : "chỉ đổi tên chuẩn"; kinds[k] = (kinds[k] || 0) + 1; });
  log("Loại thay đổi:", JSON.stringify(kinds));
  log("\nVí dụ:");
  changes.filter((c) => c.why).slice(0, 40).forEach((c) => log(`  ${c.name.padEnd(44)} ${fmt(c.before)}  →  ${fmt(c.after)}  [${c.why}]`));
  log(`\nBiến thể cùng bài nhưng nhóm cơ khác nhau (${variants.length} nhóm, KHÔNG tự sửa):`);
  variants.slice(0, 25).forEach((g) => log("  · " + g.map((v) => v.name + " {" + JSON.parse(v.prof).map(([k, r]) => k + ":" + r).join(",") + "}").join("  |  ")));

  if (write && changes.length) {
    const stamp = new Date().toISOString();
    const backup = {}; changes.forEach((c) => { backup[c.ref.id] = { name: c.name, muscles: c.before }; });
    await db.collection("exerciseBackups").doc(stamp).set({ reason: "normalize-library", at: stamp, exercises: backup });
    for (let i = 0; i < changes.length; i += 400) {
      const b = db.batch();
      changes.slice(i, i + 400).forEach((c) => b.update(c.ref, { muscles: c.after }));
      await b.commit();
    }
    log(`\nĐÃ GHI ${changes.length} bài. Bản cũ: exerciseBackups/${stamp}`);
  } else if (!write) log("\nChạy thử — chưa ghi gì. Thêm --write để ghi.");
  return { changes, variants, stillEmpty };
}

module.exports = { normalize, DELT_RULES, FIX, main };

if (require.main === module) {
  const { initializeApp } = fnRequire("firebase-admin/app");
  const { getFirestore } = fnRequire("firebase-admin/firestore");
  initializeApp({ projectId: "fitness-app-a22c8" });
  main({ db: getFirestore(), write: WRITE }).then(() => process.exit(0)).catch((e) => { console.error(e.message); process.exit(1); });
}
