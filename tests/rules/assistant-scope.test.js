/**
 * Trợ lý AI chạy bằng Admin SDK — bỏ qua firestore.rules. Mọi tool phải tự
 * lọc theo coach đang hỏi: coach B hỏi "giáo án của Cindy" (khách của A)
 * nhận đúng câu như id không tồn tại.
 */
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
process.env.GCLOUD_PROJECT = "demo-pulse-rules";
const path = require("path"), assert = require("assert");
const fnRequire = require("module").createRequire(path.join(__dirname, "..", "..", "functions", "index.js"));
const { initializeApp } = fnRequire("firebase-admin/app");
const { getFirestore } = fnRequire("firebase-admin/firestore");
initializeApp({ projectId: "demo-pulse-rules" });
const A = require(path.join(__dirname, "..", "..", "functions", "assistant.js"));

const RA = { coach: true, admin: false, uid: "coachA" };
const RB = { coach: true, admin: false, uid: "coachB" };
const ADM = { coach: true, admin: true, uid: "admin1" };
const prog = { SessionA: { label: "A", phases: [{ name: "Main", exercises: [{ name: "Squat", setsReps: "3 × 5" }] }] } };

let fails = 0; const cases = [];
const ok = (n, f) => cases.push([n, f]);

(async () => {
  const db = getFirestore();
  await db.doc("clients/cindy").set({ name: "Cindy", email: "cindy@gmail.com", coachUid: "coachA", program: prog });
  await db.doc("clients/sang").set({ name: "Sang", email: "sang@gmail.com", coachUid: "coachB", program: prog });

  ok("list_clients: coach A chi thay khach minh", async () => {
    const r = await A.runTool("list_clients", {}, RA);
    assert.deepStrictEqual(r.clients.map((c) => c.clientId).sort(), ["cindy", "lop_hyrox"]);   // lop_hyrox: lớp nhóm seed ở dưới, cũng của coach A
  });
  ok("list_clients: admin thay tat ca", async () => {
    const r = await A.runTool("list_clients", {}, ADM);
    assert.deepStrictEqual(r.clients.map((c) => c.clientId).sort(), ["cindy", "lop_hyrox", "sang"]);
  });
  ok("get_program khach cua minh", async () => {
    const r = await A.runTool("get_program", { clientId: "cindy" }, RA);
    assert(r.program && !r.error, JSON.stringify(r));
  });
  ok("get_program khach cua coach khac -> 'khong co khach', khong lo du lieu", async () => {
    const r = await A.runTool("get_program", { clientId: "cindy" }, RB);
    assert.strictEqual(r.error, "Không có khách id 'cindy'.");
    assert(!r.program);
  });
  ok("tra loi giong het id khong ton tai", async () => {
    const a = await A.runTool("get_program", { clientId: "cindy" }, RB);
    const b = await A.runTool("get_program", { clientId: "cindy" }, { ...RB, uid: "x" });
    assert.strictEqual(a.error, b.error);
  });
  ok("propose_program cho khach coach khac bi tu choi", async () => {
    const r = await A.runTool("propose_program", { clientId: "cindy", program: prog }, RB);
    assert(r.rejected && !r.needsConfirm, JSON.stringify(r));
  });
  ok("admin XEM giao an khach cua coach A (quan sat)", async () => {
    const r = await A.runTool("get_program", { clientId: "cindy" }, ADM);
    assert(r.program && !r.error, JSON.stringify(r));
  });
  ok("admin KHONG de xuat sua giao an khach cua coach A", async () => {
    const r = await A.runTool("propose_program", { clientId: "cindy", program: prog }, ADM);
    assert(r.rejected && /chỉ quan sát/.test(r.errors[0]), JSON.stringify(r));
  });

  // ── Soạn giáo án: đọc hồ sơ trước + bài phải có trong thư viện (2026-10-12) ──
  await db.doc("exercises/1").set({ name: "Goblet Squat (Dumbbell)", tool: "Dumbbell", muscles: { QUADS: "P", GLUTES: "S" } });
  await db.doc("exercises/2").set({ name: "Goblet Squat (Kettlebell)", tool: "Kettlebell", muscles: { QUADS: "P", GLUTES: "S" } });
  await db.doc("exercises/3").set({ name: "Lat Pulldown", tool: "Cable", muscles: { LATS: "P", BICEPS: "S" } });
  const newProg = (name) => ({ SessionA: { label: "A", phases: [
    { name: "Warm-up", tag: "Warm-up", exercises: [{ name: "Cat-cow", setsReps: "1 × 10" }] },
    { name: "Main", tag: "main", exercises: [{ name, setsReps: "3 × 8" }] }] } });
  ok("propose_program trong luot tro ly: CHUA doc get_client/get_exercise_loads -> tu choi", async () => {
    const r = await A.runTool("propose_program", { clientId: "cindy", program: newProg("Lat pull down") }, RA, { read: {} });
    assert(r.rejected && /get_client và get_exercise_loads/.test(r.errors[0]), JSON.stringify(r));
  });
  const READ = { read: { "get_client:cindy": true, "get_exercise_loads:cindy": true } };
  ok("da doc ho so: bai khop thu vien -> doi ten dung, gan muscles, chuan hoa tag", async () => {
    const r = await A.runTool("propose_program", { clientId: "cindy", program: newProg("Lat pull down") }, RA, READ);
    assert(r.needsConfirm, JSON.stringify(r));
    const ph = r.action.program.SessionA.phases;
    assert.deepStrictEqual(ph.map((p) => p.tag), ["warmup", "strength"]);
    assert.strictEqual(ph[1].exercises[0].name, "Lat Pulldown");
    assert.deepStrictEqual(ph[1].exercises[0].muscles, { LATS: "P", BICEPS: "S" });
    assert.deepStrictEqual(r.preview.renamed, [["Lat pull down", "Lat Pulldown"]]);
    assert.strictEqual(ph[0].exercises[0].name, "Cat-cow", "warmup duoc dung bai ngoai thu vien");
  });
  ok("bai mo ho (Goblet Squat: Dumbbell/Kettlebell) -> tu choi, liet ke lua chon", async () => {
    const r = await A.runTool("propose_program", { clientId: "cindy", program: newProg("Goblet Squat") }, RA, READ);
    assert(r.rejected && /Goblet Squat \(Dumbbell\)/.test(r.errors[0]), JSON.stringify(r));
  });
  ok("bai la -> tu choi kem goi y", async () => {
    const r = await A.runTool("propose_program", { clientId: "cindy", program: newProg("Pulldown thần thánh") }, RA, READ);
    assert(r.rejected && /không có trong thư viện/.test(r.errors[0]), JSON.stringify(r));
  });
  ok("bai DANG CO trong giao an cu giu nguyen ten (lich su ta noi theo ten)", async () => {
    // giao an cu cua cindy co "Squat" — khong co trong thu vien nhung la bai cu
    const r = await A.runTool("propose_program", { clientId: "cindy", program: newProg("Squat") }, RA, READ);
    assert(r.needsConfirm && r.action.program.SessionA.phases[1].exercises[0].name === "Squat", JSON.stringify(r));
  });
  ok("propose_new_client: giao an kem theo cung bi kiem thu vien", async () => {
    const r = await A.runTool("propose_new_client", { name: "Khach Thu", program: newProg("Pulldown thần thánh") }, RA);
    assert(r.rejected, JSON.stringify(r));
    const r2 = await A.runTool("propose_new_client", { name: "Khach Thu", program: newProg("Lat Pulldown (Cable)") }, RA);
    assert(r2.needsConfirm && r2.action.program.SessionA.phases[1].exercises[0].name === "Lat Pulldown", JSON.stringify(r2));
  });

  // ── Lớp nhóm (2026-10-13) ──
  await db.doc("clients/lop_hyrox").set({ name: "Lớp · HYROX", email: "", coachUid: "coachA", isGroup: true, groupFormat: "hyrox", program: prog });
  ok("lop nhom: propose_program chi can get_client (khong co muc ta chung)", async () => {
    const r0 = await A.runTool("propose_program", { clientId: "lop_hyrox", program: newProg("Lat Pulldown") }, RA, { read: {} });
    assert(r0.rejected && /get_client/.test(r0.errors[0]) && !/get_exercise_loads/.test(r0.errors[0]), JSON.stringify(r0));
    const r = await A.runTool("propose_program", { clientId: "lop_hyrox", program: newProg("Lat Pulldown") }, RA, { read: { "get_client:lop_hyrox": true } });
    assert(r.needsConfirm, JSON.stringify(r));
  });
  ok("tao lop: action mang isGroup + thong tin lop, ten co tien to, khong email", async () => {
    const r = await A.runTool("propose_new_client", { name: "HYROX sáng", isGroup: true, groupFormat: "hyrox", groupSize: 10,
      durationMin: 60, equipment: "3 SkiErg", level: "Mixed", program: newProg("Lat Pulldown") }, RA);
    assert(r.needsConfirm, JSON.stringify(r));
    const x = r.action;
    assert.strictEqual(x.isGroup, true); assert.strictEqual(x.groupFormat, "hyrox"); assert.strictEqual(x.groupSize, 10);
    assert.strictEqual(x.name, "Lớp · HYROX sáng"); assert.strictEqual(x.email, "");
    assert(/HYROX/.test(r.preview.group) && /không đăng nhập/.test(r.preview.login));
  });
  ok("get_client / list_clients cho model biet day la lop", async () => {
    const g = await A.runTool("get_client", { clientId: "lop_hyrox" }, RA);
    assert(g.group && g.group.isGroup && g.group.format === "hyrox", JSON.stringify(g.group));
    const l = await A.runTool("list_clients", {}, RA);
    assert(l.clients.find((c) => c.clientId === "lop_hyrox").isGroup === true);
  });

  ok("khong co role -> tu choi, khong doc Firestore", async () => {
    const r = await A.runTool("list_clients", {}, undefined);
    assert(r.error && !r.clients);
  });
  ok("coach bi tat (coach:false) -> tu choi", async () => {
    const r = await A.runTool("list_clients", {}, { coach: false, uid: "coachA" });
    assert(r.error && !r.clients);
  });

  console.log("Tro ly AI loc theo coach\n");
  for (const [n, f] of cases) {
    try { await f(); console.log("  OK   " + n); }
    catch (e) { fails++; console.log("  HONG " + n + "\n       " + (e && e.message || e)); }
  }
  console.log(fails ? "\n" + fails + " HONG" : "\nTAT CA DAT");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
