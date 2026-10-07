/**
 * TRỢ LÝ COACH — hỏi đáp về khách và giáo án, có tự tra dữ liệu.
 *
 * Bản 1 CHỈ ĐỌC. Không một tool nào ghi. Mở quyền ghi ở bản sau, khi mỗi thao
 * tác đã có bước xác nhận riêng. 19 khách thật đang dùng app này.
 *
 * Cách chạy: khai báo cho model một bộ hàm, nó tự quyết định gọi hàm nào, mình
 * chạy hàm đó trên Firestore rồi đưa kết quả lại cho nó, lặp tới khi nó trả lời
 * bằng chữ. Hình dạng lấy từ @google/genai v2.15.0:
 *   khai báo  { type:"function", name, description, parameters }
 *   model đòi { type:"function_call", id, name, arguments }
 *   mình đáp  { type:"function_result", call_id, name, result }
 */
const { canManageDoc } = require("./authz.js");
const { getFirestore } = require("firebase-admin/firestore");

/** Trần số vòng gọi tool cho một câu hỏi. */
const MAX_STEPS = 6;
/** Mức suy luận: "minimal" | "low" | "medium" | "high". Xem chú thích ở vòng lặp. */
const THINK_DISPATCH = "minimal";
const THINK_COMPOSE = "low";
/** Trần số bản ghi mỗi tool trả về, để một câu hỏi không kéo cả kho dữ liệu. */
const CAP = 40;

// ── Khai báo tool ────────────────────────────────────────────────────────
const TOOLS = [
  {
    type: "function",
    name: "list_clients",
    description:
      "Danh sách toàn bộ khách: tên, id, trình độ, mục tiêu, số buổi/tuần, " +
      "ngày tập gần nhất. Dùng khi câu hỏi nói về nhiều khách hoặc chưa rõ khách nào.",
    parameters: { type: "object", properties: {} },
  },
  {
    type: "function",
    name: "get_client",
    description:
      "Hồ sơ đầy đủ một khách: thông tin cơ bản, hồ sơ sức khoẻ (bệnh lý, thuốc " +
      "đang dùng, tiền sử tập), số đo nền và lần đo gần nhất.",
    parameters: {
      type: "object",
      properties: { clientId: { type: "string", description: "id của khách, ví dụ 'kem'" } },
      required: ["clientId"],
    },
  },
  {
    type: "function",
    name: "get_program",
    description: "Giáo án hiện tại của một khách: từng buổi, từng pha, từng bài kèm set/rep/tempo/cue.",
    parameters: {
      type: "object",
      properties: { clientId: { type: "string" } },
      required: ["clientId"],
    },
  },
  {
    type: "function",
    name: "get_training_history",
    description:
      "Lịch sử tập đã ghi của một khách: ngày, buổi nào, làm được bao nhiêu bài, " +
      "tổng khối lượng. Dùng để biết khách có theo được giáo án không.",
    parameters: {
      type: "object",
      properties: {
        clientId: { type: "string" },
        limit: { type: "integer", description: "số buổi gần nhất, mặc định 10" },
      },
      required: ["clientId"],
    },
  },
  {
    type: "function",
    name: "get_exercise_loads",
    description:
      "Mức tạ khách đã nâng cho từng bài, theo thời gian. Dùng khi cần biết nên " +
      "tăng tạ hay giữ nguyên.",
    parameters: {
      type: "object",
      properties: { clientId: { type: "string" } },
      required: ["clientId"],
    },
  },
  {
    type: "function",
    name: "search_exercises",
    description:
      "Tra thư viện bài tập của app theo tên, nhóm cơ hoặc dụng cụ. Chỉ gợi ý bài " +
      "CÓ trong thư viện này.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "từ khoá tên bài" },
        muscle: { type: "string", description: "nhóm cơ" },
        tool: { type: "string", description: "dụng cụ: barbell, dumbbell, cable, bodyweight…" },
      },
    },
  },
  {
    type: "function",
    name: "propose_program",
    description:
      "Đề xuất đẩy một giáo án cho khách. KHÔNG ghi ngay — chỉ gửi cho coach duyệt, " +
      "coach bấm đồng ý thì mới lưu. Khoá buổi bắt buộc SessionA, SessionB… " +
      "Gọi get_program trước để biết giáo án cũ, và nói rõ đổi những gì.",
    parameters: {
      type: "object",
      properties: {
        clientId: { type: "string" },
        program: {
          type: "object",
          description:
            "{ SessionA: { label, phases: [ { name, tag, exercises: " +
            "[ { name, setsReps, tempo, cue } ] } ] } }",
        },
        summary: { type: "string", description: "một câu nói rõ thay đổi gì so với giáo án cũ" },
      },
      required: ["clientId", "program"],
    },
  },
  {
    type: "function",
    name: "propose_new_client",
    description:
      "Đề xuất tạo một khách mới. KHÔNG tạo ngay — chờ coach duyệt. " +
      "Khách mới LUÔN bắt đầu không có email; muốn cho đăng nhập thì coach bổ sung sau. " +
      "Có thể kèm giáo án luôn nếu coach đã nói rõ muốn tập gì.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        email: { type: "string",
          description: "Gmail của khách, để khách tự đăng nhập. Bỏ trống nếu chưa có — "
            + "TUYỆT ĐỐI không bịa địa chỉ giữ chỗ." },
        level: { type: "string", description: "Beginner | Intermediate | Advanced" },
        goal: { type: "string" },
        sessionsPerWeek: { type: "integer", description: "1–7" },
        notes: { type: "string" },
        healthConditions: { type: "string", description: "chấn thương, bệnh lý coach vừa kể" },
        program: { type: "object", description: "giáo án ban đầu, cùng dạng propose_program" },
      },
      required: ["name"],
    },
  },
  {
    type: "function",
    name: "get_recovery",
    description:
      "Dữ liệu hồi phục từ vòng Polar: giấc ngủ, HRV, nhịp tim nghỉ, tải tập. " +
      "HIỆN CHỈ khách 'longchu' có dữ liệu này, khách khác sẽ trả về rỗng.",
    parameters: {
      type: "object",
      properties: {
        clientId: { type: "string" },
        days: { type: "integer", description: "số đêm gần nhất, mặc định 7" },
      },
      required: ["clientId"],
    },
  },
];

// ── Thực thi tool ────────────────────────────────────────────────────────
const num = (v) => (typeof v === "number" && isFinite(v) ? v : null);
const iso = (t) => (t && t.toDate ? t.toDate().toISOString().slice(0, 10) : (t || null));

/** Đếm bài trong một giáo án, không trả cả cây về cho model khi chỉ cần con số. */
function progSummary(prog) {
  const days = Object.keys(prog || {}).sort();
  return days.map((d) => {
    const phases = (prog[d].phases || []);
    const n = phases.reduce((s, p) => s + ((p.exercises || []).length), 0);
    return { day: d, label: prog[d].label || "", exercises: n };
  });
}

/**
 * Thư viện bài tập: 360 bài, ~175 KB, và nó gần như không đổi.
 * Trước đây mỗi lần search_exercises là đọc lại toàn bộ kho. Giữ trong bộ nhớ
 * của instance (Cloud Functions tái dùng instance giữa các lượt gọi) nên lượt
 * thứ hai trở đi khỏi chạm Firestore.
 */
let _exCache = null, _exAt = 0;
const EX_TTL_MS = 10 * 60 * 1000;

async function exerciseLibrary(db) {
  if (_exCache && Date.now() - _exAt < EX_TTL_MS) return _exCache;
  const snap = await db.collection("exercises").get();
  _exCache = snap.docs.map((d) => d.data() || {});
  _exAt = Date.now();
  console.log(`[assistant] nạp lại thư viện bài tập: ${_exCache.length} bài`);
  return _exCache;
}

/**
 * @param {object} role  vai trò người gọi từ authz.roleOf — { coach, admin, uid }.
 *   Hàm nền bỏ qua firestore.rules, nên mỗi tool phải tự lọc theo coach: coach
 *   B hỏi "giáo án của Cindy" (khách của A) phải nhận đúng câu như khi id không
 *   tồn tại — không lộ ai có thật.
 */
async function runTool(name, args, role) {
  const db = getFirestore();
  const a = args || {};
  if (!role || !role.coach) return { error: "Không xác định được coach đang hỏi." };

  // Chốt chung cho MỌI tool nhận clientId — tool mới thêm vào cũng tự được gác.
  if (a.clientId != null) {
    const id = String(a.clientId);
    if (!role.admin) {
      const c = await db.collection("clients").doc(id).get();
      if (!c.exists || !canManageDoc(role, c.data())) {
        return name.startsWith("propose_")
          ? { rejected: true, errors: [`Không có khách id '${id}'.`] }
          : { error: `Không có khách id '${id}'.` };
      }
    }
  }

  if (name === "list_clients") {
    // Admin xem tất cả; coach chỉ khách của mình.
    const snap = role.admin
      ? await db.collection("clients").get()
      : await db.collection("clients").where("coachUid", "==", role.uid).get();
    return {
      count: snap.size,
      clients: snap.docs.map((d) => {
        const v = d.data() || {};
        return {
          clientId: d.id,
          name: v.name || d.id,
          level: v.level || null,
          goal: v.goal || null,
          sessionsPerWeek: num(v.sessionsPerWeek),
          lastWorkoutAt: iso(v.lastWorkoutAt),
          hasLogin: !!(v.email || "").trim(),
          programDays: Object.keys(v.program || {}).length,
        };
      }),
    };
  }

  if (name === "get_client") {
    const ref = db.collection("clients").doc(a.clientId);
    const [c, prof, base, cps] = await Promise.all([
      ref.get(),
      ref.collection("profile").doc("data").get(),
      ref.collection("assessment").doc("baseline").get(),
      ref.collection("checkpoints").orderBy("date", "desc").limit(1).get(),
    ]);
    if (!c.exists) return { error: `Không có khách id '${a.clientId}'.` };
    const v = c.data() || {};
    const p = prof.exists ? prof.data() : null;
    // Nói rõ là CHƯA GHI, đừng để model hiểu nhầm trống nghĩa là khoẻ mạnh.
    const health = p && (p.healthConditions || "").trim() ? p.healthConditions : null;
    return {
      clientId: c.id,
      name: v.name || c.id,
      level: v.level || null,
      goal: v.goal || null,
      sessionsPerWeek: num(v.sessionsPerWeek),
      notes: v.notes || null,
      lastWorkoutAt: iso(v.lastWorkoutAt),
      program: progSummary(v.program),
      health: {
        conditions: health,
        medications: p ? (p.medications || null) : null,
        exerciseHistory: p ? (p.exerciseHistory || null) : null,
        dob: p ? (p.dob || null) : null,
        note: health
          ? null
          : "CHƯA GHI bệnh lý cho khách này trong hồ sơ. Không suy đoán — nói rõ là chưa có.",
      },
      baseline: base.exists ? base.data() : null,
      latestCheckpoint: cps.empty ? null : cps.docs[0].data(),
    };
  }

  if (name === "get_program") {
    const c = await db.collection("clients").doc(a.clientId).get();
    if (!c.exists) return { error: `Không có khách id '${a.clientId}'.` };
    const prog = (c.data() || {}).program || {};
    if (!Object.keys(prog).length) return { empty: true, note: "Khách này chưa có giáo án." };
    return { clientId: c.id, program: prog };
  }

  if (name === "get_training_history") {
    const lim = Math.min(num(a.limit) || 10, CAP);
    const snap = await db.collection("clients").doc(a.clientId)
      .collection("workoutHistory").orderBy("date", "desc").limit(lim).get();
    if (snap.empty) return { empty: true, note: "Khách này chưa ghi buổi tập nào." };
    return {
      sessions: snap.docs.map((d) => {
        const v = d.data() || {};
        return {
          date: iso(v.date), day: v.day || null,
          done: num(v.done), total: num(v.total),
          volumeKg: Math.round(num(v.totalVolume) || 0),
        };
      }),
    };
  }

  if (name === "get_exercise_loads") {
    const snap = await db.collection("clients").doc(a.clientId)
      .collection("workoutHistory").orderBy("date", "desc").limit(12).get();
    const byEx = {};
    await Promise.all(snap.docs.map(async (d) => {
      const date = iso(d.data().date);
      const ex = await d.ref.collection("exercises").get();
      ex.forEach((e) => {
        const v = e.data() || {};
        const kg = num(v.loadKg);
        if (!v.exerciseName || kg == null || kg <= 0) return;
        (byEx[v.exerciseName] = byEx[v.exerciseName] || []).push({ date, kg });
      });
    }));
    const keys = Object.keys(byEx);
    if (!keys.length) return { empty: true, note: "Chưa có mức tạ nào được ghi." };
    const out = {};
    for (const k of keys.slice(0, CAP)) {
      out[k] = byEx[k].sort((x, y) => String(x.date).localeCompare(String(y.date))).slice(-6);
    }
    return { loads: out };
  }

  if (name === "search_exercises") {
    const lib = await exerciseLibrary(db);
    const q = (a.query || "").toLowerCase().trim();
    const mu = (a.muscle || "").toLowerCase().trim();
    const tl = (a.tool || "").toLowerCase().trim();
    const hit = lib.filter((v) => {
      const name2 = String(v.name || "").toLowerCase();
      const mus = JSON.stringify(v.muscles || "").toLowerCase();
      const tool = String(v.tool || "").toLowerCase();
      return (!q || name2.includes(q)) && (!mu || mus.includes(mu)) && (!tl || tool.includes(tl));
    }).slice(0, CAP);
    if (!hit.length) return { empty: true, note: "Không có bài nào khớp trong thư viện." };
    return {
      count: hit.length,
      exercises: hit.map((v) => ({
        id: v.id, name: v.name, muscles: v.muscles, tool: v.tool, difficulty: v.difficulty,
      })),
    };
  }

  if (name === "get_recovery") {
    const lim = Math.min(num(a.days) || 7, 28);
    const snap = await db.collection("clients").doc(a.clientId)
      .collection("recovery").orderBy("date", "desc").limit(lim).get();
    if (snap.empty) {
      return { empty: true, note: `Khách '${a.clientId}' chưa nối vòng Polar — không có dữ liệu hồi phục.` };
    }
    return {
      nights: snap.docs.map((d) => {
        const v = d.data() || {};
        return {
          date: v.date,
          sleepHours: v.sleep ? Math.round((v.sleep.total || 0) / 360) / 10 : null,
          sleepScore: v.sleep ? num(v.sleep.score) : null,
          hrv: v.recharge ? num(v.recharge.hrv) : null,
          restingHr: v.sleep ? num(v.sleep.hrMin) : null,
          recharge: v.recharge ? num(v.recharge.status) : null,
          strain: v.load ? num(v.load.strain) : null,
        };
      }),
    };
  }

  // ── Hai tool "ghi" — thật ra KHÔNG ghi ────────────────────────────────
  // Chúng chỉ kiểm dữ liệu rồi dựng một đề xuất để coach duyệt. Model không
  // bao giờ chạm được vào Firestore; việc ghi nằm ở callable riêng, chỉ chạy
  // khi coach đã bấm đồng ý. Model sai thì cùng lắm là một đề xuất xấu.
  if (name === "propose_program") {
    const v = validateProgram(a.program);
    if (!v.ok) return { rejected: true, errors: v.errors, note: "Giáo án chưa hợp lệ, sửa rồi đề xuất lại." };
    const c = await db.collection("clients").doc(a.clientId).get();
    if (!c.exists) return { rejected: true, errors: [`Không có khách id '${a.clientId}'.`] };
    const old = (c.data() || {}).program || {};
    return {
      needsConfirm: true,
      action: { kind: "apply_program", clientId: a.clientId, program: a.program },
      preview: {
        client: (c.data() || {}).name || c.id,
        summary: a.summary || "",
        before: progSummary(old),
        after: progSummary(a.program),
        exercises: v.stats.exercises,
      },
      note: "Đã gửi cho coach duyệt. Nói cho coach biết thay đổi gì, rồi dừng — "
        + "đừng gọi lại tool này.",
    };
  }

  if (name === "propose_new_client") {
    const v = validateNewClient(a);
    if (!v.ok) return { rejected: true, errors: v.errors };
    const em = emailKey(a.email);
    // Dò sớm để coach thấy xung đột TRƯỚC khi bấm duyệt. Chốt chặn thật vẫn
    // nằm ở lúc ghi (create-only), vì giữa lúc đề xuất và lúc duyệt vẫn có
    // thể có người khác chiếm mất.
    if (em) {
      const taken = await db.collection("clientEmails").doc(em).get();
      if (taken.exists) {
        const owner = (taken.data() || {}).clientId;
        return { rejected: true, errors: [
          `Gmail ${em} đã thuộc về khách '${owner}'. Một Gmail chỉ được một khách — `
          + `hai người chung địa chỉ là đọc ghi được dữ liệu của nhau.`] };
      }
    }
    const id = makeClientId(a.name);
    return {
      needsConfirm: true,
      action: {
        kind: "create_client",
        clientId: id,
        name: String(a.name).trim(),
        level: a.level || "Beginner",
        goal: a.goal || "",
        sessionsPerWeek: Number(a.sessionsPerWeek) || 3,
        notes: a.notes || "",
        healthConditions: a.healthConditions || "",
        email: em,
        program: a.program || {},
      },
      preview: {
        clientId: id,
        name: String(a.name).trim(),
        level: a.level || "Beginner",
        goal: a.goal || "",
        sessionsPerWeek: Number(a.sessionsPerWeek) || 3,
        program: a.program ? progSummary(a.program) : [],
        login: em || "chưa có email — khách này coach tự quản",
      },
      note: "Đã gửi cho coach duyệt. Nói cho coach biết sẽ tạo gì, rồi dừng.",
    };
  }

  return { error: `Tool không tồn tại: ${name}` };
}

// ── KIỂM DỮ LIỆU TRƯỚC KHI GHI ──────────────────────────────────────────
//
// Model sinh ra JSON, và model thì sai được. Mấy hàm này là chỗ chặn: không
// qua được đây thì không có gì chạm tới Firestore. Thuần, không I/O, test được.

const LEVELS = ["Beginner", "Intermediate", "Advanced"];

/**
 * Địa chỉ -> khoá cho /clientEmails. Trả "" nếu không hợp lệ.
 *
 * Luôn viết thường: chỉ mục phân biệt hoa thường, nên "Ben@x.com" và
 * "ben@x.com" sẽ thành HAI khoá khác nhau cho cùng một hộp thư — đúng lỗ hổng
 * mà chỉ mục sinh ra để bịt.
 */
function emailKey(v) {
  const t = String(v == null ? "" : v).trim().toLowerCase();
  if (!t) return "";
  return /^[^\s@]+@[^\s@.]+\.[^\s@]+$/.test(t) ? t : "";
}
const DAY_KEY = /^Session[A-G]$/;
const str = (v) => (typeof v === "string" ? v.trim() : "");

/**
 * Kiểm giáo án. Khoá PHẢI là SessionA..G.
 *
 * Mon/Wed/Fri là định dạng cũ và nó làm app TREO Ở MÀN LOADING — khách mở ra
 * không thấy gì, không báo lỗi gì. Đó là lý do chỗ này chặn cứng chứ không
 * tự đổi tên khoá giúp: đổi ngầm thì lần sau model lại sinh sai y như cũ.
 *
 * @returns {{ok:boolean, errors:string[], stats:object}}
 */
function validateProgram(prog) {
  const e = [];
  if (!prog || typeof prog !== "object" || Array.isArray(prog)) {
    return { ok: false, errors: ["Giáo án phải là một object các buổi."], stats: {} };
  }
  const days = Object.keys(prog);
  if (!days.length) e.push("Giáo án rỗng.");
  if (days.length > 7) e.push(`Quá nhiều buổi (${days.length}), tối đa 7.`);

  let nEx = 0;
  for (const d of days) {
    if (!DAY_KEY.test(d)) {
      e.push(`Khoá buổi "${d}" sai định dạng — phải là SessionA…SessionG. `
        + `Định dạng cũ Mon/Wed/Fri làm app treo ở màn hình tải.`);
      continue;
    }
    const day = prog[d];
    if (!day || typeof day !== "object") { e.push(`${d}: không phải object.`); continue; }
    const phases = day.phases;
    if (!Array.isArray(phases) || !phases.length) { e.push(`${d}: thiếu phases.`); continue; }
    if (phases.length > 8) e.push(`${d}: ${phases.length} pha, tối đa 8.`);
    phases.forEach((p, pi) => {
      if (!p || typeof p !== "object") { e.push(`${d} pha ${pi + 1}: không phải object.`); return; }
      if (!str(p.name)) e.push(`${d} pha ${pi + 1}: thiếu tên pha.`);
      const ex = p.exercises;
      if (!Array.isArray(ex) || !ex.length) { e.push(`${d} pha "${str(p.name)}": không có bài nào.`); return; }
      if (ex.length > 20) e.push(`${d} pha "${str(p.name)}": ${ex.length} bài, tối đa 20.`);
      ex.forEach((x, xi) => {
        nEx++;
        if (!x || typeof x !== "object") { e.push(`${d} pha ${pi + 1} bài ${xi + 1}: không phải object.`); return; }
        if (!str(x.name)) e.push(`${d} pha ${pi + 1} bài ${xi + 1}: thiếu tên bài.`);
        if (!str(x.setsReps)) e.push(`${d} — "${str(x.name) || "?"}": thiếu set×rep.`);
      });
    });
  }
  return {
    ok: e.length === 0,
    errors: e.slice(0, 12),
    stats: { days: days.length, exercises: nEx },
  };
}

/**
 * Kiểm hồ sơ khách mới.
 *
 * email BẮT BUỘC rỗng. Khách coach tự quản mang `email: ''`, KHÔNG bao giờ
 * mang địa chỉ giữ chỗ — hai khách cùng một địa chỉ là đọc ghi được dữ liệu
 * của nhau, và chuyện đó đã xảy ra một lần. Muốn cho khách đăng nhập thì bổ
 * sung sau bằng đường riêng đi qua chỉ mục /clientEmails.
 */
function validateNewClient(c) {
  const e = [];
  const o = c || {};
  const name = str(o.name);
  if (!name) e.push("Thiếu tên khách.");
  if (name.length > 60) e.push("Tên khách quá dài.");
  if (o.level && !LEVELS.includes(o.level)) {
    e.push(`Trình độ "${o.level}" không hợp lệ — chỉ nhận ${LEVELS.join(", ")}.`);
  }
  const spw = Number(o.sessionsPerWeek);
  if (o.sessionsPerWeek != null && (!Number.isInteger(spw) || spw < 1 || spw > 7)) {
    e.push("Số buổi/tuần phải là số nguyên 1–7.");
  }
  const em = emailKey(o.email);
  if (str(o.email) && !em) e.push(`Địa chỉ "${str(o.email)}" không hợp lệ.`);
  // Địa chỉ giữ chỗ là thứ đã gây ra sự cố: hai khách cùng một địa chỉ thì đọc
  // ghi được dữ liệu của nhau. Khách chưa có Gmail thật thì để TRỐNG.
  if (em && /^(placeholder|noemail|none|test|abc|xxx)@/.test(em)) {
    e.push("Không dùng địa chỉ giữ chỗ. Khách chưa có Gmail thật thì bỏ trống email.");
  }
  if (o.program) {
    const v = validateProgram(o.program);
    if (!v.ok) e.push(...v.errors);
  }
  return { ok: e.length === 0, errors: e.slice(0, 12) };
}

/** Id khách, cùng kiểu với nút Add Client trên giao diện. */
function makeClientId(name, now) {
  const slug = String(name || "client").toLowerCase().normalize("NFD")
    .replace(/[̀-ͯ]/g, "")        // bỏ dấu tiếng Việt
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24) || "client";
  return slug + "_" + (now || Date.now());
}

// ── Chỉ dẫn hệ thống ─────────────────────────────────────────────────────
const SYSTEM = `Bạn là trợ lý của huấn luyện viên thể hình đang dùng app Pulse (studio của Long Chu).
Chỉ nói về khách mà tool trả về — đó là khách của coach đang hỏi; tool báo "không có khách" thì nói đúng như vậy.
Trả lời bằng TIẾNG VIỆT, ngắn gọn, giọng đồng nghiệp nói với đồng nghiệp. Không khách sáo, không mở bài.

DỮ LIỆU
- Luôn gọi tool để lấy số thật trước khi nói về một khách. Tuyệt đối không nhớ hay đoán.
- Tool trả về rỗng hoặc "CHƯA GHI" thì nói thẳng là chưa có dữ liệu. KHÔNG suy đoán, không lấp bằng
  phỏng đoán hợp lý. Coach đã nói rõ: thà thiếu còn hơn bịa.
- Riêng bệnh lý: hiện gần như chưa khách nào được ghi. Trống KHÔNG có nghĩa là khoẻ mạnh, chỉ có nghĩa
  là chưa ai nhập. Nói đúng như vậy, và gợi ý coach nhập vào hồ sơ khách.

GIÁO ÁN
- Khoá buổi tập BẮT BUỘC là SessionA, SessionB, SessionC… Không bao giờ dùng Mon/Wed/Fri — định dạng đó
  làm app treo ở màn hình tải.
- Mỗi bài có: name, setsReps ("3 × 8-10"), tempo ("3-1-1"), cue (ghi chú kỹ thuật và nghỉ bao lâu).
- Chỉ gợi ý bài CÓ trong thư viện; không chắc thì gọi search_exercises để tra.
- Soạn xong giáo án thì in ra bảng cho coach xem, VÀ gọi propose_program để gửi duyệt.

ĐỀ XUẤT THAY ĐỔI
- Bạn KHÔNG ghi thẳng vào dữ liệu. Hai tool propose_program và propose_new_client chỉ gửi đề xuất;
  coach bấm đồng ý thì app mới lưu.
- Vì vậy TUYỆT ĐỐI không nói "đã lưu", "đã đẩy xong", "đã tạo khách". Nói đúng sự thật: "đã gửi cho
  mày duyệt, bấm đồng ý là xong". Nói sai chỗ này là coach tưởng xong rồi bỏ đi, và không có gì được lưu.
- Gọi tool đề xuất MỘT LẦN rồi dừng, kể cả khi chưa thấy kết quả cuối. Đừng gọi lại.
- Trước khi đề xuất sửa giáo án, gọi get_program đọc bản cũ đã, rồi nói rõ đổi những gì và vì sao.
- Tool trả về rejected kèm errors thì đọc lỗi, sửa, đề xuất lại — đừng lặp lại y nguyên.
- Khách mới CÓ THỂ kèm Gmail để tự đăng nhập — chỉ khi coach đưa địa chỉ thật. Coach không nói thì
  bỏ trống. TUYỆT ĐỐI không tự bịa địa chỉ, không dùng địa chỉ giữ chỗ: một Gmail chỉ được thuộc về
  một khách, hai người chung địa chỉ là đọc ghi được dữ liệu của nhau.

AN TOÀN
- Khách dưới 18 tuổi (xem tuổi/ngày sinh trong hồ sơ): KHÔNG BAO GIỜ đề xuất ăn thâm hụt calo. Hạn chế
  năng lượng tuổi dậy thì ảnh hưởng chiều cao cuối cùng và là yếu tố nguy cơ rối loạn ăn uống.
- Bạn không phải bác sĩ. Đau dai dẳng, khớp sưng, tê bì, chóng mặt → khuyên đi khám chuyên khoa.
  Đưa hướng điều chỉnh tập luyện thì được, chẩn đoán thì không.
- Thấy dữ liệu đáng lo (nhịp tim nghỉ tăng vọt, mất ngủ kéo dài) thì nêu ra, kèm mức độ chắc chắn.`;

// ── Vòng lặp ─────────────────────────────────────────────────────────────
/**
 * @param {object} o
 * @param {object} o.client     đối tượng GoogleGenAI đã khởi tạo
 * @param {string} o.model      tên model
 * @param {Array}  o.messages   [{role:'user'|'assistant', text}] — lịch sử hội thoại
 * @param {string} [o.clientId] khách đang mở trên màn hình, để model khỏi phải hỏi lại
 * @param {object} o.role       vai trò người gọi (authz.roleOf) — mọi tool lọc theo nó
 * @returns {Promise<{text:string, toolLog:Array, steps:number, usage:object}>}
 */
async function runAssistant({ client, model, messages, clientId, role }) {
  const input = [];
  if (clientId) {
    input.push({
      type: "user_input",
      content: [{ type: "text", text: `(Coach đang mở hồ sơ khách: ${clientId})` }],
    });
  }
  for (const m of messages || []) {
    input.push({
      type: m.role === "assistant" ? "model_output" : "user_input",
      content: [{ type: "text", text: String(m.text || "").slice(0, 4000) }],
    });
  }

  const toolLog = [];
  const pending = [];        // đề xuất chờ coach duyệt
  let usage = null;
  let steps = 0;

  while (steps < MAX_STEPS) {
    steps++;
    // Gemini 3 mặc định suy luận dài. Chính chú thích trong callGemini ghi đó
    // là thứ từng đẩy lời gọi ảnh món ăn vượt trần 60 giây.
    //
    // Lượt ĐẦU chỉ là chọn tool nào để gọi — gần như không cần nghĩ, để
    // "minimal". Từ lượt hai trở đi dữ liệu đã về và model mới thật sự soạn
    // câu trả lời, nên nới lên "low".
    //
    // Thấy giáo án nó soạn hời hợt thì nâng THINK_COMPOSE lên "medium"; đây là
    // chỗ đánh đổi giữa nhanh và sâu, và nó nằm ở đúng một dòng.
    const interaction = await client.interactions.create({
      model, input, tools: TOOLS, system_instruction: SYSTEM,
      generation_config: { thinking_level: steps === 1 ? THINK_DISPATCH : THINK_COMPOSE },
    });
    usage = interaction.usage || usage;

    const calls = (interaction.steps || []).filter((s) => s.type === "function_call");
    if (!calls.length) {
      return { text: interaction.output_text || "", toolLog, pending, steps, usage };
    }

    // Giữ nguyên các bước model sinh ra rồi mới nối kết quả — bỏ qua là model
    // mất dấu nó vừa hỏi gì, và sẽ gọi lại đúng tool đó mãi.
    input.push(...calls);
    // Chạy SONG SONG. Model hay đòi 2–3 tool một lượt; chạy tuần tự thì thời
    // gian cộng dồn, mà chúng độc lập với nhau — đọc giáo án không phải chờ
    // đọc lịch sử tập xong.
    const results = await Promise.all(calls.map(async (c) => {
      try {
        return await runTool(c.name, c.arguments, role);
      } catch (e) {
        // Một tool hỏng không được làm chết cả câu trả lời: báo lỗi cho model,
        // để nó nói ra chỗ nào không đọc được thay vì im lặng bịa.
        return { error: String(e.message || e).slice(0, 200) };
      }
    }));
    // Nhét lại theo ĐÚNG THỨ TỰ model đã hỏi, không theo thứ tự chạy xong.
    calls.forEach((c, k) => {
      const result = results[k];
      toolLog.push({ name: c.name, args: c.arguments || {}, empty: !!(result && (result.empty || result.error)) });
      if (result && result.needsConfirm) pending.push({ action: result.action, preview: result.preview });
      input.push({
        type: "function_result",
        call_id: c.id,
        name: c.name,
        result: JSON.stringify(result).slice(0, 120000),
      });
    });
  }

  // Hết vòng mà model vẫn đòi gọi tool: trả lời thật thà thay vì lặng thinh.
  return {
    text: "Câu này cần tra nhiều hơn mức cho phép trong một lượt. Hỏi hẹp lại giúp tao "
      + "(ví dụ nêu rõ tên khách, hoặc hỏi từng khách một).",
    toolLog, pending, steps, usage, hitLimit: true,
  };
}

/**
 * Nặn kết quả runAssistant thành thứ trả về cho máy khách.
 *
 * Tách ra vì đã trượt một lần: hàm callable được viết hồi chưa có khái niệm
 * đề xuất, sau thêm `pending` vào runAssistant mà quên nới chỗ trả về — server
 * dựng đề xuất đúng, model báo "đã gửi", nhưng thẻ duyệt không bao giờ tới
 * trình duyệt. Một chỗ nặn duy nhất, có test, thì thêm trường mới không rơi nữa.
 */
function shapeReply(r) {
  return {
    text: (r && r.text) || "",
    toolLog: (r && r.toolLog) || [],
    pending: (r && r.pending) || [],
    steps: (r && r.steps) || 0,
    hitLimit: !!(r && r.hitLimit),
  };
}

/**
 * Nhãn tiếng Việt cho mức khuyến nghị. PHẢI khớp RC_STATUS trong index.html —
 * noti và màn hình Recovery nói khác nhau là coach không biết tin cái nào.
 */
const REC_LABEL = {
  train_hard: "Đẩy nặng được",
  moderate: "Tập vừa",
  easy: "Tập nhẹ",
  recovery: "Chỉ phục hồi",
  rest: "Nghỉ hẳn",
};

/** Cắt chuỗi cho vừa một dòng noti, không cắt giữa từ. */
function clip(s, n) {
  const t = String(s || "").replace(/\s+/g, " ").trim();
  if (t.length <= n) return t;
  const cut = t.slice(0, n);
  const sp = cut.lastIndexOf(" ");
  return (sp > n * 0.6 ? cut.slice(0, sp) : cut) + "…";
}

/**
 * Soạn nội dung noti buổi sáng: hôm nay mấy buổi, và dựa trên dữ liệu hồi
 * phục thì nên ăn uống / sinh hoạt / tập ra sao.
 *
 * Thuần, không I/O — để test được mà không cần mạng.
 *
 * @param {object} o
 * @param {Array}  o.bookings  lịch hôm nay, đã sắp theo giờ
 * @param {object} [o.rec]     doc recovery của hôm nay
 * @returns {{title:string, body:string}}
 */
function buildMorningPush({ bookings, rec }) {
  const list = bookings || [];
  const nS = list.length;
  const sessions = nS
    ? `${nS} buổi`
    : "không có buổi nào";

  const brief = rec && rec.brief && rec.brief.text ? rec.brief.text : null;
  const label = brief && REC_LABEL[brief.recommendation];

  const title = label
    ? `Hôm nay ${sessions} · ${label}`
    : `Hôm nay ${sessions}`;

  const lines = [];
  if (nS) lines.push(list.map((b) => `${b.startTime} ${b.title || "?"}`).join(" · "));

  if (brief) {
    // headline là câu chốt của bản phân tích; why dài hơn, chỉ dùng khi thiếu headline.
    const head = clip(brief.headline || brief.why, 120);
    if (head) lines.push(head);
    // Ăn uống và sinh hoạt nằm trong recoveryActions.
    const acts = (brief.recoveryActions || []).filter(Boolean).slice(0, 2);
    for (const a of acts) lines.push("• " + clip(a, 90));
  } else {
    // KHÔNG bịa lời khuyên khi chưa có dữ liệu. Nói thẳng là chưa có.
    lines.push("Chưa có dữ liệu hồi phục cho hôm nay — bấm Đồng bộ ngay trong app.");
  }

  return { title, body: lines.join("\n") };
}

module.exports = { TOOLS, buildMorningPush, REC_LABEL, emailKey, SYSTEM, MAX_STEPS, THINK_DISPATCH, THINK_COMPOSE, runTool, runAssistant, progSummary, shapeReply,
  validateProgram, validateNewClient, makeClientId, LEVELS };
