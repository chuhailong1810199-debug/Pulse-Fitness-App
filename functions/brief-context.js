/**
 * Gom dữ liệu thô thành đúng các nhóm mà bảng quyết định của coach yêu cầu:
 * Recovery · Sleep · Sleep Debt · Strain · Recent Load · Activity · HR Data ·
 * Training History · Baseline · Goal · Behavior · Context.
 *
 * Nguyên tắc: nhóm nào KHÔNG có nguồn dữ liệu thì trả null và nói rõ là thiếu.
 * Tuyệt đối không suy ra để lấp chỗ trống — một con số bịa nằm giữa mười một
 * con số thật thì không ai phân biệt được nữa.
 */

const DAY = 864e5;

const num = (v) => (typeof v === "number" && isFinite(v) ? v : null);
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const sd = (a) => {
  if (a.length < 2) return null;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) * (v - m), 0) / (a.length - 1));
};

/** Số ngày giữa hai chuỗi YYYY-MM-DD. Qua Date.UTC để UTC+7 không lệch ngày. */
function daysBetween(a, b) {
  const p = String(a).split("-").map(Number), q = String(b).split("-").map(Number);
  if (p.length !== 3 || q.length !== 3) return null;
  return Math.round((Date.UTC(p[0], p[1] - 1, p[2]) - Date.UTC(q[0], q[1] - 1, q[2])) / DAY);
}

/**
 * Đường nền cá nhân + độ lệch của đêm mới nhất, tính bằng số độ lệch chuẩn.
 * Đây là thứ trả lời "so với trạng thái bình thường của CHÍNH khách này",
 * thay vì so với một ngưỡng chung cho mọi người.
 */
function baseline(nights, pick) {
  const hist = nights.slice(1).map(pick).map(num).filter((v) => v != null);
  const today = num(pick(nights[0]));
  if (hist.length < 4 || today == null) {
    return { today, n: hist.length, mean: null, sd: null, z: null, enough: false };
  }
  const m = mean(hist), s = sd(hist);
  return {
    today, n: hist.length,
    mean: Math.round(m * 10) / 10,
    sd: s != null ? Math.round(s * 10) / 10 : null,
    z: s > 0 ? Math.round(((today - m) / s) * 10) / 10 : null,
    enough: hist.length >= 7,
  };
}

/** Nợ ngủ tích luỹ: cộng phần thiếu so với mục tiêu, không trừ đêm ngủ dư. */
function sleepDebt(nights, days) {
  const use = nights.slice(0, days).filter((n) => (n.sleep || {}).total != null);
  if (!use.length) return null;
  let debt = 0;
  for (const n of use) {
    const goal = num(n.sleep.goal), tot = num(n.sleep.total);
    if (goal == null || tot == null) continue;
    debt += Math.max(0, goal - tot);
  }
  return { sec: Math.round(debt), nights: use.length };
}

/**
 * Tải gần đây. Trả tổng và trung bình strain theo 3/7/14 ngày, cộng tỷ lệ
 * cấp tính trên mạn tính (7 ngày / 28 ngày) — thước đo tiêu chuẩn để phát hiện
 * tăng tải quá nhanh. Chỉ tính khi đủ ngày, thiếu thì trả null.
 */
function recentLoad(nights) {
  const byDate = {};
  for (const n of nights) {
    const s = num((n.load || {}).strain);
    if (s != null) byDate[n.date] = s;
  }
  const newest = nights[0] && nights[0].date;
  if (!newest) return null;

  const windowSum = (d) => {
    let sum = 0, n = 0, covered = 0;
    for (const date of Object.keys(byDate)) {
      const gap = daysBetween(newest, date);
      if (gap != null && gap >= 0 && gap < d) { sum += byDate[date]; n++; }
    }
    // Số ngày thực sự có dữ liệu trong cửa sổ, kể cả ngày nghỉ (strain 0).
    for (const nt of nights) {
      const gap = daysBetween(newest, nt.date);
      if (gap != null && gap >= 0 && gap < d) covered++;
    }
    return { sum: Math.round(sum * 10) / 10, days: n, covered };
  };

  const d3 = windowSum(3), d7 = windowSum(7), d14 = windowSum(14), d28 = windowSum(28);
  const acute = d7.covered ? d7.sum / d7.covered : null;
  const chronic = d28.covered >= 21 ? d28.sum / d28.covered : null;
  return {
    d3, d7, d14,
    acuteChronic: (acute != null && chronic > 0) ? Math.round((acute / chronic) * 100) / 100 : null,
    acuteChronicNote: chronic == null ? "cần ≥21 ngày dữ liệu mới tính được" : null,
  };
}

/** Phút ở mỗi vùng nhịp tim, cộng dồn theo cửa sổ ngày. */
function zoneMinutes(nights, days) {
  const newest = nights[0] && nights[0].date;
  const z = [0, 0, 0, 0, 0];
  let any = false;
  for (const n of nights) {
    const gap = daysBetween(newest, n.date);
    if (gap == null || gap < 0 || gap >= days) continue;
    const zs = (n.load || {}).zoneSec;
    if (!Array.isArray(zs)) continue;
    any = true;
    zs.forEach((v, i) => { z[i] += v || 0; });
  }
  return any ? z.map((s) => Math.round(s / 60)) : null;
}

/**
 * @param {object} o { client, nights (mới nhất trước), workouts, activity }
 */
function buildContext(o) {
  const nights = (o.nights || []).filter((n) => n && n.date);
  if (!nights.length) return null;
  const last = nights[0];

  return {
    date: last.date,

    // ── Recovery ──────────────────────────────────────────────────────────
    recovery: {
      recharge: num((last.recharge || {}).status),
      ansCharge: num((last.recharge || {}).ansCharge),
      ansStatus: num((last.recharge || {}).ansStatus),
      hrv: num((last.recharge || {}).hrv),
      sleepingHr: num((last.recharge || {}).rhr),
      restingHrNight: num((last.sleep || {}).hrMin),
    },

    // ── Sleep ─────────────────────────────────────────────────────────────
    sleep: {
      total: num((last.sleep || {}).total),
      goal: num((last.sleep || {}).goal),
      score: num((last.sleep || {}).score),
      duration: num((last.sleep || {}).dur),
      solidity: num((last.sleep || {}).solid),
      regeneration: num((last.sleep || {}).regen),
      interruptions: num((last.sleep || {}).interruptions),
      longInterruptions: num((last.sleep || {}).longInt),
      cycles: num((last.sleep || {}).cycles),
      start: (last.sleep || {}).start || null,
      end: (last.sleep || {}).end || null,
    },

    // ── Sleep Debt ────────────────────────────────────────────────────────
    sleepDebt: { d7: sleepDebt(nights, 7), d14: sleepDebt(nights, 14) },

    // ── Strain (hôm qua = buổi tập diễn ra TRƯỚC đêm này) ─────────────────
    strain: (() => {
      const prev = nights[1];
      const l = prev && prev.load;
      if (!l) return { date: prev ? prev.date : null, strain: null, note: "không tập hoặc không có nhịp tim" };
      return {
        date: prev.date, strain: num(l.strain), cardioLoad: num(l.cardioLoad),
        sessions: l.sessions, sec: l.sec,
        workouts: (l.workouts || []).map((w) => ({
          at: w.at, sport: w.sport, sec: w.sec, strain: w.strain, hrAvg: w.hrAvg, hrMax: w.hrMax,
        })),
      };
    })(),

    // ── Recent Load ───────────────────────────────────────────────────────
    recentLoad: recentLoad(nights),

    // ── Activity ──────────────────────────────────────────────────────────
    activity: (o.activity || []).slice(0, 7).map((a) => ({
      date: a.date, steps: num(a.steps), calories: num(a.calories),
      activeCalories: num(a.activeCalories), activeSec: num(a.activeSec),
      workoutCalories: num(a.workoutCalories), workoutSec: num(a.workoutSec),
    })),

    // ── HR Data ───────────────────────────────────────────────────────────
    hr: {
      hrMax: num((nights.find((n) => n.load) || {}).load?.hrMax),
      hrMaxSource: (nights.find((n) => n.load) || {}).load?.hrMaxSource || null,
      zoneMin7: zoneMinutes(nights, 7),
      zoneMin14: zoneMinutes(nights, 14),
    },

    // ── Training History ──────────────────────────────────────────────────
    history: (o.workouts || []).map((w) => ({
      date: w.date, day: w.day, done: w.done, total: w.total, volume: w.totalVolume,
    })),

    // ── Baseline cá nhân ──────────────────────────────────────────────────
    baseline: {
      hrv: baseline(nights, (n) => (n.recharge || {}).hrv),
      sleepingHr: baseline(nights, (n) => (n.recharge || {}).rhr),
      sleepScore: baseline(nights, (n) => (n.sleep || {}).score),
      sleepTotal: baseline(nights, (n) => (n.sleep || {}).total),
      nights: nights.length,
    },

    // ── Goal / Context ────────────────────────────────────────────────────
    goal: (o.client || {}).goal || null,
    level: (o.client || {}).level || null,
    sessionsPerWeek: (o.client || {}).sessionsPerWeek || null,
    notes: (o.client || {}).notes || null,

    // ── Behavior: KHÔNG có nguồn ──────────────────────────────────────────
    // Cà phê, rượu, căng thẳng, thói quen — Polar không đo, app chưa có chỗ
    // nhập. Để null và nói rõ trong prompt, để model không tự bịa nguyên nhân.
    behavior: null,
  };
}

module.exports = { buildContext, baseline, sleepDebt, recentLoad, zoneMinutes, daysBetween };
