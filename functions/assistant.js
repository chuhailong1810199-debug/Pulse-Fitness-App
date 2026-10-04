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
const { getFirestore } = require("firebase-admin/firestore");

/** Trần số vòng gọi tool cho một câu hỏi. */
const MAX_STEPS = 6;
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

async function runTool(name, args) {
  const db = getFirestore();
  const a = args || {};

  if (name === "list_clients") {
    const snap = await db.collection("clients").get();
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
    const snap = await db.collection("exercises").get();
    const q = (a.query || "").toLowerCase().trim();
    const mu = (a.muscle || "").toLowerCase().trim();
    const tl = (a.tool || "").toLowerCase().trim();
    const hit = snap.docs.map((d) => d.data() || {}).filter((v) => {
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

  return { error: `Tool không tồn tại: ${name}` };
}

// ── Chỉ dẫn hệ thống ─────────────────────────────────────────────────────
const SYSTEM = `Bạn là trợ lý của Long Chu, huấn luyện viên thể hình, làm việc ngay trong app Pulse của anh ấy.
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
- Bản này CHƯA ghi được vào dữ liệu. Soạn xong thì in ra bảng rõ ràng để coach tự dán vào, và nói rõ
  là coach cần tự lưu.

AN TOÀN
- Khách dưới 18 tuổi (Antony 15, Sang 14, Rome, Kem): KHÔNG BAO GIỜ đề xuất ăn thâm hụt calo. Hạn chế
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
 * @returns {Promise<{text:string, toolLog:Array, steps:number, usage:object}>}
 */
async function runAssistant({ client, model, messages, clientId }) {
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
  let usage = null;
  let steps = 0;

  while (steps < MAX_STEPS) {
    steps++;
    const interaction = await client.interactions.create({
      model, input, tools: TOOLS, system_instruction: SYSTEM,
    });
    usage = interaction.usage || usage;

    const calls = (interaction.steps || []).filter((s) => s.type === "function_call");
    if (!calls.length) {
      return { text: interaction.output_text || "", toolLog, steps, usage };
    }

    // Giữ nguyên các bước model sinh ra rồi mới nối kết quả — bỏ qua là model
    // mất dấu nó vừa hỏi gì, và sẽ gọi lại đúng tool đó mãi.
    input.push(...calls);
    for (const c of calls) {
      let result;
      try {
        result = await runTool(c.name, c.arguments);
      } catch (e) {
        // Một tool hỏng không được làm chết cả câu trả lời: báo lỗi cho model,
        // để nó nói ra chỗ nào không đọc được thay vì im lặng bịa.
        result = { error: String(e.message || e).slice(0, 200) };
      }
      toolLog.push({ name: c.name, args: c.arguments || {}, empty: !!(result && (result.empty || result.error)) });
      input.push({
        type: "function_result",
        call_id: c.id,
        name: c.name,
        result: JSON.stringify(result).slice(0, 120000),
      });
    }
  }

  // Hết vòng mà model vẫn đòi gọi tool: trả lời thật thà thay vì lặng thinh.
  return {
    text: "Câu này cần tra nhiều hơn mức cho phép trong một lượt. Hỏi hẹp lại giúp tao "
      + "(ví dụ nêu rõ tên khách, hoặc hỏi từng khách một).",
    toolLog, steps, usage, hitLimit: true,
  };
}

module.exports = { TOOLS, SYSTEM, MAX_STEPS, runTool, runAssistant, progSummary };
