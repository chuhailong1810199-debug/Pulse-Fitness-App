#!/usr/bin/env node
/**
 * Chuẩn hoá giáo án ĐANG CÓ theo thư viện bài tập.
 *
 *   node scripts/backfill-program-library.js            # CHẠY THỬ: chỉ in ra sẽ đổi gì
 *   node scripts/backfill-program-library.js --write    # ghi thật (có bản sao lưu)
 *
 * Cần quyền Admin SDK vào project fitness-app-a22c8:
 *   gcloud auth application-default login
 *
 * Làm gì, cho mỗi clients/{id}.program:
 *   1. Tag pha → warmup | strength | accessories | circuit.
 *   2. Bài khớp thư viện (kể cả mơ hồ về dụng cụ nhưng cùng nhóm cơ) → gắn `muscles`.
 *      Bài đã có muscles thì GIỮ NGUYÊN — coach có thể đã chỉnh tay.
 *
 * KHÔNG làm:
 *   - Không đổi tên bài: lịch sử tạ và biểu đồ tiến bộ nối theo tên bài.
 *   - Không bật `bw`: đổi nghĩa số kg coach đã gõ cho bài đó.
 *   - Không đụng khách không có thay đổi.
 *
 * Trước khi ghi, sao lưu giáo án cũ vào clients/{id}/profile/program-backup-<ngày>-library
 * (cùng chỗ với các bản sao lưu đã có). Chạy lại bao nhiêu lần cũng được.
 */
const path = require("path");
const fnRequire = require("module").createRequire(path.join(__dirname, "..", "functions", "index.js"));
const { buildLibIndex, resolveProgram } = require("../functions/program-lib.js");

const WRITE = process.argv.includes("--write");

/** Gộp: tag chuẩn + muscles mới chỉ điền vào chỗ còn trống. Trả về {program, changes}. */
function plan(prog, idx) {
  const r = resolveProgram(prog, idx, { strict: false, rename: false, setBw: false });
  const changes = { tags: 0, muscles: 0 };
  const out = {};
  for (const [dk, day] of Object.entries(prog || {})) {
    const nd = r.program[dk];
    if (!day || !Array.isArray(day.phases)) { out[dk] = day; continue; }
    out[dk] = {
      ...day,
      phases: day.phases.map((ph, pi) => {
        const np = nd.phases[pi];
        if (!ph || typeof ph !== "object") return ph;
        if (np.tag !== ph.tag) changes.tags++;
        return {
          ...ph, tag: np.tag,
          exercises: (ph.exercises || []).map((x, xi) => {
            const nx = np.exercises[xi];
            const has = x && x.muscles && typeof x.muscles === "object" && Object.keys(x.muscles).length;
            if (x && !has && nx && nx.muscles) { changes.muscles++; return { ...x, muscles: nx.muscles }; }
            return x;
          }),
        };
      }),
    };
  }
  return { program: out, changes, matched: r.matched, total: r.total };
}

async function main({ db, write, log = console.log }) {
  const lib = (await db.collection("exercises").get()).docs.map((d) => d.data() || {});
  if (!lib.length) throw new Error("Thư viện bài tập rỗng — dừng.");
  const idx = buildLibIndex(lib);
  const day = new Date().toISOString().slice(0, 10);
  const res = [];
  for (const c of (await db.collection("clients").get()).docs) {
    const prog = (c.data() || {}).program;
    if (!prog || !Object.keys(prog).length) continue;
    const p = plan(prog, idx);
    const n = p.changes.tags + p.changes.muscles;
    res.push({ id: c.id, ...p.changes, matched: p.matched, total: p.total });
    log(`${n ? "ĐỔI " : "    "} ${c.id.padEnd(26)} tag ${String(p.changes.tags).padStart(2)} · gắn nhóm cơ ${String(p.changes.muscles).padStart(2)}`
      + ` · khớp thư viện ${p.matched}/${p.total}`);
    if (write && n) {
      await c.ref.collection("profile").doc(`program-backup-${day}-library`).set({ program: prog, savedAt: new Date(), reason: "backfill-program-library" });
      await c.ref.update({ program: p.program });
    }
  }
  const sum = (k) => res.reduce((a, r) => a + r[k], 0);
  log(`\nTổng: ${sum("tags")} tag pha, ${sum("muscles")} bài được gắn nhóm cơ, khớp thư viện ${sum("matched")}/${sum("total")} bài.`);
  log(write ? "ĐÃ GHI (bản cũ ở profile/program-backup-*-library)." : "Chạy thử — chưa ghi gì. Thêm --write để ghi.");
  return res;
}

module.exports = { plan, main };

if (require.main === module) {
  const { initializeApp } = fnRequire("firebase-admin/app");
  const { getFirestore } = fnRequire("firebase-admin/firestore");
  initializeApp({ projectId: "fitness-app-a22c8" });
  main({ db: getFirestore(), write: WRITE }).then(() => process.exit(0)).catch((e) => { console.error(e.message); process.exit(1); });
}
