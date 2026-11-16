#!/usr/bin/env node
/**
 * Thêm bài bổ trợ theo môn (functions/sports.js → NEW_LIBRARY) vào thư viện `exercises`.
 *
 *   node scripts/sports/add-library.js           # CHẠY THỬ: in bài nào sẽ thêm, bài nào đã có
 *   node scripts/sports/add-library.js --write   # ghi thật (chỉ TẠO doc mới, không sửa / xoá bài có sẵn)
 *
 * Doc id = slug tên ("pogo-jump-bodyweight"). Tên đã có trong thư viện (không phân biệt hoa thường) → bỏ qua.
 * Mỗi bài mang `sports: [...]` = các môn dùng nó, để tra ngược. Kèm kiểm: mọi tên thư viện mà khung môn tham chiếu
 * phải có thật sau khi thêm — thiếu thì báo và KHÔNG ghi.
 */
const path = require("path");
const fnRequire = require("module").createRequire(path.join(__dirname, "..", "..", "functions", "index.js"));
const { SPORTS, NEW_LIBRARY } = require(path.join(__dirname, "..", "..", "functions", "sports.js"));
const WRITE = process.argv.includes("--write");
const slug = (n) => String(n).toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const key = (n) => String(n || "").trim().toLowerCase();

(async () => {
  const { initializeApp } = fnRequire("firebase-admin/app");
  const { getFirestore } = fnRequire("firebase-admin/firestore");
  initializeApp({ projectId: "fitness-app-a22c8" });
  const db = getFirestore();
  const snap = await db.collection("exercises").get();
  const have = new Set(snap.docs.filter((d) => !d.data().ownerUid).map((d) => key(d.data().name)));
  const ids = new Set(snap.docs.map((d) => d.id));

  const usedBy = {};
  for (const [sid, S] of Object.entries(SPORTS)) for (const b of S.blocks) for (const [, , lib] of b.ex) if (lib) (usedBy[key(lib)] = usedBy[key(lib)] || new Set()).add(sid);

  const add = NEW_LIBRARY.filter((e) => !have.has(key(e.name)));
  const skip = NEW_LIBRARY.filter((e) => have.has(key(e.name)));
  const after = new Set([...have, ...add.map((e) => key(e.name))]);
  const missing = Object.keys(usedBy).filter((n) => !after.has(n));
  console.log(`Thư viện: ${have.size} bài chung. Sẽ thêm ${add.length}, đã có ${skip.length}.`);
  add.forEach((e) => console.log("  + " + e.name + "  [" + e.tool + "] " + Object.entries(e.muscles).map(([m, r]) => m + " " + r).join(", ")
    + "  · môn: " + [...(usedBy[key(e.name)] || [])].join(", ")));
  skip.forEach((e) => console.log("  = " + e.name + " (đã có)"));
  if (missing.length) { console.error("THIẾU trong thư viện (khung môn tham chiếu nhưng không có và không nằm trong NEW_LIBRARY):\n  " + missing.join("\n  ")); process.exit(1); }
  if (!WRITE) { console.log("\nChạy thử — thêm --write để ghi."); return; }
  const batch = db.batch();
  for (const e of add) {
    let id = slug(e.name); while (ids.has(id)) id += "-s";
    ids.add(id);
    const { note, ...doc } = e;
    batch.create(db.collection("exercises").doc(id), { ...doc, sports: [...(usedBy[key(e.name)] || [])].sort(), addedAt: new Date().toISOString(), addedBy: "sports-library" });
  }
  await batch.commit();
  console.log(`Đã thêm ${add.length} bài.`);
})().catch((e) => { console.error(e); process.exit(1); });
