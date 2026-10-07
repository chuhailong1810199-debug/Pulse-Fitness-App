/**
 * Mẫu "phong cách coach" cho pulseGenerateFree — callable CÔNG KHAI, ai gọi
 * cũng được, kể cả người chưa đăng nhập.
 *
 * Bản cũ nhét nguyên buổi tập đầu của khách thật vào prompt, kèm mục tiêu của
 * họ: cue/ghi chú hay chứa chấn thương, bệnh lý, có khi cả tên ("Cindy giữ
 * lưng thẳng"). Model có thể nhắc lại nguyên văn cho người lạ.
 *
 * Chỉ giữ KHUNG: tên phase, tên bài, sets×reps, tempo. Không mục tiêu, không
 * cue, không ghi chú, không tên, không id.
 */
const KEEP_EX = ["name", "setsReps", "tempo"];

function styleSampleFromProgram(program) {
  if (!program || typeof program !== "object") return null;
  const firstKey = Object.keys(program).sort()[0];
  const day = firstKey && program[firstKey];
  if (!day || !Array.isArray(day.phases)) return null;
  const phases = day.phases.slice(0, 6).map((ph) => ({
    name: String((ph && ph.name) || "").slice(0, 40),
    exercises: (Array.isArray(ph && ph.exercises) ? ph.exercises : []).slice(0, 8).map((ex) => {
      const o = {};
      for (const k of KEEP_EX) if (ex && ex[k] != null) o[k] = String(ex[k]).slice(0, 60);
      return o;
    }).filter((o) => o.name),
  })).filter((ph) => ph.exercises.length);
  return phases.length ? { phases } : null;
}

module.exports = { styleSampleFromProgram };
