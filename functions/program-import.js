/**
 * Nhập giáo án cũ từ Excel (2026-11-17) — coach mới (Vy) có sẵn giáo án trong file Excel theo định dạng của riêng mình.
 *
 * App đọc file bằng SheetJS → gửi CÁC Ô CHỮ (không gửi file) → importProgramSheet (index.js) → Gemini đổi về khuôn
 * giáo án của app → resolveProgram khớp tên bài với thư viện. KHÔNG ghi gì: app hiện bản xem trước, coach bấm lưu thì đi
 * qua coachApply (kiểm quyền, kiểm giáo án, sao lưu bản cũ, chuyển tạ theo tên bài) như mọi giáo án khác.
 *
 * Phần thuần (không I/O) nằm ở đây để test: giới hạn kích thước, dựng chữ gửi model, đổi kết quả model → program.
 */

const LIMITS = { sheets: 12, rows: 300, cols: 14, cell: 240, chars: 60000 };
const PHASE_TAGS = ["warmup", "strength", "accessories", "circuit"];

/** [{name, rows: string[][]}] → chữ gọn: bỏ dòng / cột trống, cắt ô dài, dừng ở trần ký tự. */
function sheetsToText(sheets) {
  const out = [];
  let total = 0, truncated = false;
  for (const sh of (Array.isArray(sheets) ? sheets : []).slice(0, LIMITS.sheets)) {
    if (!sh || !Array.isArray(sh.rows)) continue;
    const rows = sh.rows.slice(0, LIMITS.rows).map((r) => (Array.isArray(r) ? r : []).slice(0, LIMITS.cols)
      .map((c) => String(c == null ? "" : c).replace(/\s+/g, " ").trim().slice(0, LIMITS.cell)));
    const used = rows.filter((r) => r.some((c) => c));
    if (!used.length) continue;
    // Bỏ cột trống ở mọi dòng (file Excel hay kéo theo cả chục cột rỗng).
    const width = Math.max(...used.map((r) => r.length));
    const keepCol = Array.from({ length: width }, (_, i) => used.some((r) => r[i]));
    const lines = used.map((r) => r.filter((_, i) => keepCol[i]).join(" | "));
    const block = "### Sheet: " + String(sh.name || "?").slice(0, 60) + "\n" + lines.join("\n");
    if (total + block.length > LIMITS.chars) { out.push(block.slice(0, Math.max(0, LIMITS.chars - total))); truncated = true; break; }
    out.push(block); total += block.length;
  }
  return { text: out.join("\n\n"), truncated };
}

const IMPORT_SCHEMA = {
  type: "object",
  properties: {
    sessions: {
      type: "array",
      description: "Các buổi tập theo đúng thứ tự trong file (tối đa 7).",
      items: {
        type: "object",
        properties: {
          label: { type: "string", description: "Tên buổi như trong file, vd 'Session A — Lower body'." },
          focus: { type: "string", description: "Mục tiêu buổi nếu file có ghi, không thì chuỗi rỗng." },
          phases: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                tag: { type: "string", enum: PHASE_TAGS },
                exercises: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      setsReps: { type: "string", description: "Dạng '3 x 10', '4 x 6-8', '3 x 30s', '1 x 12 phút'." },
                      tempo: { type: "string" },
                      load: { type: "string", description: "Mức tạ / RPE / ghi chú tải nếu có." },
                      cue: { type: "string", description: "Ghi chú kỹ thuật của coach, giữ nguyên lời." },
                    },
                    required: ["name", "setsReps"],
                  },
                },
              },
              required: ["name", "tag", "exercises"],
            },
          },
        },
        required: ["label", "phases"],
      },
    },
    notes: { type: "array", items: { type: "string" }, description: "Điều cần coach kiểm lại: ô khó đọc, chỗ đoán, phần bỏ qua." },
  },
  required: ["sessions"],
};

function importPrompt(fileName, text, truncated) {
  return `Bạn chuyển giáo án tập luyện từ file Excel của một huấn luyện viên sang dạng có cấu trúc. File: "${String(fileName || "").slice(0, 80)}".
LUẬT
- CHÉP ĐÚNG những gì file ghi. KHÔNG thêm bài, KHÔNG bỏ bài, KHÔNG đổi liều, KHÔNG sáng tác ghi chú. Ô không đọc được → ghi vào notes.
- Mỗi BUỔI tập (Session / Day / Buổi / Ngày / tab sheet riêng…) là một phần tử sessions, theo thứ tự trong file. Tối đa 7 buổi.
  File chia theo TUẦN mà các tuần lặp lại cùng buổi → chỉ lấy tuần đầu (hoặc tuần đầy đủ nhất) và ghi notes.
- Pha (phase): nhóm bài trong buổi (Warm-up, Main, Strength, Accessory, Superset A, Finisher, Conditioning, Cool-down…).
  tag CHỈ một trong: warmup (khởi động, mobility, activation, cool-down, giãn cơ) | strength (bài chính, nặng, power, plyo)
  | accessories (bài phụ, isolation, core) | circuit (circuit, conditioning, finisher, AMRAP, EMOM, interval, cardio).
  File không chia pha → tự chia: bài khởi động / bài chính / bài phụ theo vị trí và tính chất bài.
- Tên bài: giữ tên trong file (tiếng Anh hoặc tiếng Việt), chỉ sửa lỗi gõ rõ ràng.
- setsReps dạng "3 x 10" (set x rep). Có cột Sets và Reps riêng thì ghép. Thời gian: "3 x 30s". Chỉ có rep: "1 x 10".
  Không ghi set/rep → "1 x —" và ghi notes.
- load: tạ / kg / RPE / %1RM nếu có. cue: ghi chú kỹ thuật nếu có. tempo nếu có.
- Bỏ qua phần không phải bài tập (thông tin khách, bảng đo, lịch thanh toán…).
${truncated ? "- File dài, phần cuối đã bị cắt — ghi notes rằng có thể thiếu buổi.\n" : ""}
NỘI DUNG FILE (mỗi dòng là một hàng, các ô cách nhau bằng " | "):
${text}`;
}

/** Kết quả model → { program: {SessionA…}, notes }. Bỏ buổi / pha / bài rỗng; tối đa 7 buổi, 8 pha, 20 bài. */
function toProgram(parsed) {
  const program = {};
  const notes = (parsed && Array.isArray(parsed.notes) ? parsed.notes : []).map(String).filter(Boolean).slice(0, 12);
  const s = (v) => String(v == null ? "" : v).trim();
  let i = 0;
  for (const ses of (parsed && Array.isArray(parsed.sessions) ? parsed.sessions : [])) {
    if (i >= 7) { notes.push("File có hơn 7 buổi — chỉ lấy 7 buổi đầu."); break; }
    const phases = [];
    for (const ph of (ses && Array.isArray(ses.phases) ? ses.phases : []).slice(0, 8)) {
      const ex = (ph && Array.isArray(ph.exercises) ? ph.exercises : []).slice(0, 20)
        .filter((x) => x && s(x.name))
        .map((x) => {
          const cue = [s(x.cue), s(x.load) ? "Load: " + s(x.load) : ""].filter(Boolean).join(" | ");
          const o = { name: s(x.name).slice(0, 120), setsReps: s(x.setsReps) || "1 x —" };
          if (s(x.tempo)) o.tempo = s(x.tempo).slice(0, 40);
          if (cue) o.cue = cue.slice(0, 400);
          return o;
        });
      if (!ex.length) continue;
      phases.push({ name: s(ph.name).slice(0, 60) || "Main", tag: PHASE_TAGS.includes(ph.tag) ? ph.tag : "accessories", exercises: ex });
    }
    if (!phases.length) continue;
    const key = "Session" + String.fromCharCode(65 + i++);
    const day = { label: s(ses.label).slice(0, 80) || "Buổi " + key.slice(-1), phases };
    if (s(ses.focus)) day.focus = s(ses.focus).slice(0, 200);
    program[key] = day;
  }
  return { program, notes };
}

/** Bài ở pha strength / accessories không khớp thư viện — chỉ để báo coach (vẫn nhập được, không tô cơ / không có hình). */
function unmatched(program, idx, matchExercise) {
  const out = [];
  for (const [k, d] of Object.entries(program || {})) {
    for (const ph of d.phases || []) {
      if (ph.tag !== "strength" && ph.tag !== "accessories") continue;
      for (const x of ph.exercises || []) {
        const r = matchExercise(x.name, idx);
        if (!r.ex && !(r.ambiguous && r.muscles)) out.push(k + " · " + x.name);
      }
    }
  }
  return out;
}

module.exports = { LIMITS, IMPORT_SCHEMA, sheetsToText, importPrompt, toProgram, unmatched };
