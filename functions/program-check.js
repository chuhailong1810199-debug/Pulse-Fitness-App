/**
 * Kiểm giáo án Pulse đề xuất theo khung phương pháp (METHOD trong assistant.js) — bằng CODE,
 * không chỉ nhắc trong prompt (2026-10-19, coach yêu cầu):
 *  1. Volume: số set làm việc mỗi nhóm cơ mỗi tuần theo trình độ; mỗi buổi một nhóm cơ không quá ~10 set.
 *  2. Đủ mẫu chuyển động trong tuần (squat, hinge, đẩy/kéo ngang/dọc, core, một chân/carry).
 *  4. Thời lượng ước tính của mỗi buổi khớp thời lượng coach đặt.
 * Thuần, không I/O — test được. Đếm set GIỐNG app (muscleSetsForDay trong index.html):
 * bỏ pha warmup + circuit, cơ chính 1 set, cơ phụ 0,5, cơ ổn định 0.
 */
const { normalizePhaseTag } = require("./program-lib.js");

const MUSCLE_WEIGHTS = { P: 1, S: 0.5, T: 0, Q: 0 };
/** Khoảng set làm việc / nhóm cơ / tuần (METHOD mục 1). */
const VOLUME = { Beginner: [6, 10], Intermediate: [10, 16], Advanced: [14, 20] };
/** Một nhóm cơ trong MỘT buổi. */
const PER_SESSION_MAX = 10;
/** Dư thêm để nửa set (cơ phụ) không làm giáo án đúng khung bị chặn oan. */
const SLACK = 1;
/** Nhóm cơ chính: thiếu volume thì nhắc (không chặn). */
const MAJOR = ["Quads", "Hamstrings", "Glutes", "Chest", "Lats"];

/** Số set từ "3 × 8-10", "4 vòng × 15", "3 x 10/bên". Không ghi số set → 1 (giống app). */
function parseSets(setsReps) {
  const raw = String(setsReps || "").toLowerCase().replace(/[×]/g, "x").trim();
  const m = raw.match(/^(\d+)\s*(?:(?:rounds?|vòng|hiệp|sets?)\s*[x·:]|x)/);
  return m ? Math.max(1, parseInt(m[1], 10)) : 1;
}

/**
 * Tên nhóm cơ về MỘT bộ chuẩn (khớp canonMuscle của app): giáo án cũ còn "GLUTES",
 * "HAMSTRING", "Latissimus Dorsi", "DELTOID" — không gộp thì một cơ tách làm hai dòng,
 * mỗi dòng chỉ nửa số set, và kiểm volume sai cả hai chiều.
 */
const CANON = [
  [/^(glutes?|gluteus( maximus| medius| minimus)?|glute (max|med))$/, "Glutes"],
  [/^hamstrings?$/, "Hamstrings"], [/^(quads?|quadriceps)$/, "Quads"],
  [/^(lats?|latissimus( dorsi)?)$/, "Lats"], [/^(chest|pecs?|pectorals?|pectoralis( major)?)$/, "Chest"],
  [/^(front delts?|anterior delt(oid)?s?)$/, "Front Delts"], [/^(side delts?|lateral delt(oid)?s?|medial delt(oid)?s?)$/, "Side Delts"],
  [/^(rear delts?|posterior delt(oid)?s?|rear deltoids?)$/, "Rear Delts"], [/^(delts?|deltoids?|shoulders?)$/, "Deltoids"],
  [/^(abs|abdominals?|rectus abdominis)$/, "Abs"], [/^(obliques?)$/, "Obliques"],
  [/^(traps?|trapezius|upper traps?)$/, "Traps"], [/^(mid\/lower traps|lower traps?|mid(dle)? traps?)$/, "Mid/Lower Traps"],
  [/^(adductors?)$/, "Adductors"], [/^(triceps?)$/, "Triceps"], [/^(biceps?)$/, "Biceps"], [/^(calf|calves)$/, "Calves"],
  [/^(forearms?)$/, "Forearms"], [/^(rhomboids?)$/, "Rhomboids"], [/^(erector spinae|erectors?|lower back)$/, "Erector Spinae"],
  [/^(rotator cuff)$/, "Rotator Cuff"], [/^(teres major)$/, "Teres Major"],
];
function canonMuscle(name) {
  const k = String(name || "").trim().toLowerCase().replace(/\s+/g, " ");
  for (const [re, out] of CANON) if (re.test(k)) return out;
  return String(name || "").trim();
}

const working = (ph) => { const t = normalizePhaseTag(ph); return t === "strength" || t === "accessories"; };
const round1 = (x) => Math.round(x * 10) / 10;

/** { totals: {Glutes: 9,…}, perSession: {SessionA: {Glutes: 4,…}} } */
function muscleSets(program) {
  const totals = {}, perSession = {};
  for (const [day, d] of Object.entries(program || {})) {
    const s = (perSession[day] = {});
    for (const ph of (d && d.phases) || []) {
      if (!working(ph)) continue;
      for (const x of (ph && ph.exercises) || []) {
        const n = parseSets(x && x.setsReps);
        for (const [m0, role] of Object.entries((x && x.muscles) || {})) {
          const m = canonMuscle(m0);
          const w = MUSCLE_WEIGHTS[role] || 0;
          if (!w) continue;
          s[m] = round1((s[m] || 0) + w * n);
          totals[m] = round1((totals[m] || 0) + w * n);
        }
      }
    }
  }
  return { totals, perSession };
}

/**
 * Mục 1. errors = vượt trần (chặn); warnings = nhóm cơ chính dưới sàn (chỉ nhắc).
 * exceptions { Glutes: "coach muốn ưu tiên mông" }: nhóm cơ coach CHỦ Ý dồn volume ("coach nói
 * khác thì theo coach") — được vượt trần tuần, nhưng phải ghi lý do và hiện trên thẻ duyệt.
 * Trần MỖI BUỔI vẫn giữ: >10 set một nhóm cơ trong một buổi là set rác, ưu tiên cỡ nào cũng vậy.
 */
function volumeIssues(program, level, exceptions) {
  const range = VOLUME[level] || VOLUME.Beginner;
  const { totals, perSession } = muscleSets(program);
  const ex = {};
  for (const [k, v] of Object.entries(exceptions && typeof exceptions === "object" ? exceptions : {})) {
    if (String(v || "").trim()) ex[canonMuscle(k)] = String(v).trim();
  }
  const errors = [], warnings = [], waived = [];
  for (const [m, v] of Object.entries(totals)) {
    if (v <= range[1] + SLACK) continue;
    if (ex[m]) waived.push(`${m} ${v} set/tuần (khung ${range[0]}–${range[1]}): ${ex[m]}`);
    else errors.push({ k: "vol:" + m, m: `Volume ${m}: ${v} set/tuần, vượt khung ${level || "Beginner"} ${range[0]}–${range[1]}. `
      + `Bớt set/bài có ${m}, hoặc nếu coach CHỦ Ý ưu tiên nhóm này thì ghi volumeExceptions.${m} = lý do.` });
  }
  for (const [day, s] of Object.entries(perSession)) {
    for (const [m, v] of Object.entries(s)) {
      if (v > PER_SESSION_MAX + SLACK) errors.push({ k: `sess:${day}:${m}`, m: `${day}: ${m} ${v} set trong một buổi, tối đa ~${PER_SESSION_MAX}. Dời bớt sang buổi khác.` });
    }
  }
  for (const m of MAJOR) {
    const v = totals[m] || 0;
    if (v < range[0]) warnings.push(`${m} chỉ ${v} set/tuần (khung ${range[0]}–${range[1]}).`);
  }
  return { errors, warnings, totals, waived };
}

// ── Mục 2: mẫu chuyển động ───────────────────────────────────────────────
/** Máy cardio tên có "row" không phải bài kéo. */
const ERG = /\berg\b|ski ?erg|rower|rowing machine|\brow (easy|interval|pace|sprint)|assault|air ?bike|treadmill|\brun\b|jog/i;
const PATTERNS = [
  ["squat", "gập gối (squat/lunge)", /squat|lunge|leg press|step[\s-]?up|pistol|hack|leg extension|wall sit|sissy|cossack/i],
  ["hinge", "gập hông (hinge)", /deadlift|\brdl\b|romanian|good ?morning|hip thrust|glute bridge|swing|hinge|pull[\s-]?through|back extension|hyperextension|\bclean\b|snatch|kickstand/i],
  ["hpush", "đẩy ngang", /bench|push[\s-]?up|press[\s-]?up|chest press|floor press|\bdips?\b|\bfly\b|flye|pec deck|svend/i],
  ["vpush", "đẩy dọc", /overhead|shoulder press|military|push press|arnold|landmine press|pike|handstand|\bohp\b|thruster|\bjerk\b|z[\s-]?press|y[\s-]?press/i],
  ["hpull", "kéo ngang", /\brows?\b|rowing|face ?pull|inverted|reverse fly|rear delt fly|pull[\s-]?apart|seal row/i],
  ["vpull", "kéo dọc", /pull[\s-]?up|chin[\s-]?up|pull[\s-]?down|lat pull|pulldown/i],
  ["core", "core chống xoay / chống duỗi", /plank|dead ?bug|pallof|bird ?dog|crunch|sit[\s-]?up|rollout|ab wheel|hollow|wood ?chop|russian twist|leg raise|knee raise|toes[\s-]?to[\s-]?bar|v[\s-]?up|mountain climber|anti[\s-]?rotation|suitcase|copenhagen|landmine rotation|stir the pot/i],
  ["single", "một chân hoặc carry", /lunge|split squat|step[\s-]?up|single[\s-]?leg|one[\s-]?leg|\bsl\b|pistol|bulgarian|carry|farmer|suitcase|skater|cossack|kickstand/i],
];
const PATTERN_KEYS = PATTERNS.map((p) => p[0]);

/** Mẫu chuyển động có mặt trong tuần (bỏ khởi động; máy cardio không tính là bài kéo). */
function patternsCovered(program) {
  const have = new Set();
  for (const d of Object.values(program || {})) {
    for (const ph of (d && d.phases) || []) {
      if (normalizePhaseTag(ph) === "warmup") continue;
      for (const x of (ph && ph.exercises) || []) {
        const n = String((x && x.name) || "");
        if (ERG.test(n)) continue;
        for (const [k, , re] of PATTERNS) if (re.test(n)) have.add(k);
      }
    }
  }
  return have;
}

/**
 * Mục 2. Thiếu mẫu → lỗi, TRỪ khi đề xuất ghi lý do bỏ trong `exceptions` ({ vpush: "vai đang hồi phục" }).
 * Chấn thương là lý do hợp lệ để bỏ một mẫu — nhưng phải nói ra, coach thấy trên thẻ duyệt.
 */
function coverageIssues(program, exceptions) {
  const have = patternsCovered(program);
  const ex = exceptions && typeof exceptions === "object" ? exceptions : {};
  const errors = [], waived = [];
  for (const [k, label] of PATTERNS) {
    if (have.has(k)) continue;
    const why = String(ex[k] || "").trim();
    if (why) waived.push(`${label}: ${why}`);
    else errors.push({ k: "cov:" + k, m: `Cả tuần thiếu mẫu ${label} [${k}]. Thêm một bài, hoặc nếu chấn thương không cho phép thì ghi coverageExceptions.${k} = lý do.` });
  }
  return { errors, waived, covered: [...have] };
}

// ── Mục 4: thời lượng buổi ───────────────────────────────────────────────
/** Phút ước tính cho một bài circuit: "3 × 40s" → 3×(40s + 20s nghỉ); "1 × 12 phút" → 12; "4 vòng × 15" → 4×1. */
function circuitMinutes(setsReps) {
  const raw = String(setsReps || "").toLowerCase().replace(/[×]/g, "x");
  const n = parseSets(raw);
  const t = raw.match(/x\s*(\d+(?:[.,]\d+)?)\s*(s|sec|giây|min|mins|phút)\b/);
  if (t) {
    const v = parseFloat(t[1].replace(",", "."));
    const min = /^(s|sec|giây)$/.test(t[2]) ? v / 60 : v;
    return n * (min + (min < 2 ? 1 / 3 : 0));
  }
  const d = raw.match(/(\d+(?:[.,]\d+)?)\s*(km|m)\b/);
  if (d) return n * (parseFloat(d[1].replace(",", ".")) / (d[2] === "m" ? 1000 : 1)) * 5.5 + n * 0.33;
  return n * 1;
}

const TIMED = /\d\s*(km|m|s|sec|giây|min|mins|phút|')(?![a-zà-ỹ])/i;

/** Phút ước tính một buổi: khởi động 5–10 phút; set làm việc ~2,5 phút (gồm nghỉ), superset ~1,75. */
function estimateMinutes(day) {
  let total = 0;
  for (const ph of (day && day.phases) || []) {
    const before = total;
    phaseMinutes(ph);
    // Khối chạy theo ĐỒNG HỒ ghi phút trong tên pha ("Khối chính — 5 vòng … (30')", "Finisher — EMOM 7'"):
    // đồng hồ mới là thật — cộng từng dòng bài bỏ sót chuyển trạm. Lấy số phút lớn nhất trong tên (≤ 60).
    const clock = Math.max(0, ...[...String((ph && ph.name) || "").matchAll(/(\d+)\s*(?:'|phút|min)/gi)].map((m) => +m[1]).filter((n) => n <= 60));
    if (clock > total - before) total = before + clock;
  }
  return Math.round(total);

  function phaseMinutes(ph) {
    const tag = normalizePhaseTag(ph);
    const exs = (ph && ph.exercises) || [];
    if (tag === "warmup") { total += Math.min(10, Math.max(5, exs.length * 2)); return; }
    if (tag === "circuit") { for (const x of exs) total += circuitMinutes(x && x.setsReps); return; }
    const paired = exs.length >= 2 && /superset|block|cặp|pair|\bss\b|giant|tri[\s-]?set/i.test(String(ph.name || ""));
    for (const x of exs) {
      // Bài ghi theo GIỜ / QUÃNG ("4 × 5 phút", "3 × 250m") tính theo giờ dù nằm ở pha nào — đếm theo set thì
      // "4 × 5 phút" chạy chỉ ra 10 phút (2026-10-19: buổi lớp 41 phút được ước tính như đủ).
      if (TIMED.test(String((x && x.setsReps) || ""))) total += circuitMinutes(x && x.setsReps) || exerciseMinutes(x && x.setsReps);
      else total += parseSets(x && x.setsReps) * (paired ? 1.75 : 2.5);
    }
  }
}

/** Mục 4. Dài quá 30% (+5 phút) → lỗi; ngắn hơn 60% → nhắc. Không có thời lượng đích thì bỏ qua. */
function durationIssues(program, minutes) {
  const target = Number(minutes);
  const est = {};
  for (const [k, d] of Object.entries(program || {})) est[k] = estimateMinutes(d);
  if (!(target > 0)) return { errors: [], warnings: [], est };
  const errors = [], warnings = [];
  for (const [k, m] of Object.entries(est)) {
    if (m > target * 1.3 + 5) errors.push({ k: "dur:" + k, m: `${k}: ước tính ~${m} phút, dài hơn buổi ${target} phút. Bớt set/bài hoặc gộp superset.` });
    else if (m < target * 0.6) warnings.push(`${k}: ước tính ~${m} phút, ngắn so với buổi ${target} phút.`);
  }
  return { errors, warnings, est };
}

// ── Cấu trúc MỘT buổi 1-1 (2026-10-20) ──────────────────────────────────
/**
 * Buổi coach soạn có 3–4 bài khởi động, 6–10 bài chính/phụ, 18–30 set, 50–75 phút. Pulse hay trả buổi 4–6 bài, thiếu
 * khởi động, ~30 phút — kiểm volume theo TUẦN không bắt được. Ngưỡng theo thời lượng buổi (không biết thì coi 60').
 */
const STRUCT = [[45, 5, 12], [60, 6, 15], [75, 7, 18], [90, 8, 20]];
function structureIssues(program, minutes, explicit) {
  const target = Number(minutes) > 0 ? Number(minutes) : 60;
  const [, minEx, minSets] = STRUCT.find(([m]) => target <= m) || STRUCT[STRUCT.length - 1];
  const errors = [], warnings = [];
  for (const [k, d] of Object.entries(program || {})) {
    const phases = (d && d.phases) || [];
    let warm = 0, ex = 0, sets = 0, work = 0, circuit = 0, circEx = 0, circMin = 0;
    for (const ph of phases) {
      const t = normalizePhaseTag(ph), n = ((ph && ph.exercises) || []).length;
      if (t === "warmup") { warm += n; continue; }
      if (t === "circuit") {
        circuit++; circEx += n;
        circMin += estimateMinutes({ phases: [ph] });
        continue;
      }
      work++;
      for (const x of (ph && ph.exercises) || []) { ex++; sets += parseSets(x && x.setsReps); }
    }
    if (warm < 2) errors.push({ k: "warm:" + k, m: `${k}: thiếu khởi động (${warm} bài) — cần pha warmup ≥ 2 bài, 5–10 phút (cardio nhẹ + mobility + kích hoạt).` });
    // Buổi chỉ có conditioning (WOD, boxing, interval) không đếm bài chính — chỉ cần khởi động + đủ giờ.
    const conditioning = work === 0 && circuit > 0;
    if (!conditioning) {
      // Bài nặng + khối WOD/circuit dài (buổi "Lower nặng + WOD" của coach): bài trong circuit cũng là bài của
      // buổi, và khối dài đó thay một phần set làm việc.
      const longCircuit = circMin >= 10;
      const exN = ex + (longCircuit ? circEx : 0), setMin = longCircuit ? Math.ceil(minSets * 0.6) : minSets;
      if (exN < minEx || sets < setMin) {
        errors.push({ k: "struct:" + k, m: `${k}: buổi mỏng — ${exN} bài, ${sets} set làm việc; buổi ${target}' cần ≥ ${minEx} bài và ≥ ${setMin} set `
          + "(VD 3–4 block, mỗi block 2 bài × 3–4 set). Thêm bài, đừng chỉ tăng set." });
      }
    }
    const est = estimateMinutes(d);
    if (est < target * 0.75) {
      const m = `${k}: ước tính ~${est} phút cho buổi ${target}' — ngắn. Thêm block hoặc finisher/core cho đủ giờ.`;
      if (explicit) errors.push({ k: "short:" + k, m }); else warnings.push(m);
    }
  }
  return { errors, warnings };
}

// ── Youth development (< 18 tuổi, 2026-10-22) ───────────────────────────
/**
 * Mức plyometric → trần số lần tiếp đất / buổi (docs/prompts/youth-development-program.md). Mức 0 = chỉ ném bóng
 * tạ + học tiếp đất (khởi động không tính). Bài vượt mức (depth drop, pogo liên tục…) bị chặn theo mức.
 */
const PLYO_CAP = [0, 30, 60, 80];
/** Bài BẬT NHẢY có tiếp đất — [regex, mức tối thiểu được dùng]. Ném bóng tạ không có tiếp đất → không tính. */
const JUMPS = [
  [/depth (jump|drop)|drop jump|single[\s-]?leg (hop|bound|jump)|one[\s-]?leg (hop|jump)|bounding|\bbound/i, 3],
  // "\bhops?\b" nguyên chữ — "Wood Chop" từng bị đếm là bài bật.
  [/pogo|lateral hop|skater|broad jump|jumping lunge|tuck jump|jump rope|skipping rope|\bhops?\b/i, 2],
  [/box jump|squat jump|jump squat|vertical jump|countermovement jump|cmj/i, 1],
];
/**
 * Số lần tiếp đất của một bài: "3 × 4" → 12; "3 × 5/side" → 30. Theo thời gian: bật liên tục ~0,6 lần/giây
 * (một cú bật + tiếp đất ~1,5–2 giây), nhảy dây ~1,5 lần/giây (biên độ thấp, nhịp nhanh).
 */
function contacts(setsReps, name) {
  const raw = String(setsReps || "").toLowerCase().replace(/[×]/g, "x");
  const n = parseSets(raw);
  const t = raw.match(/x\s*(\d+(?:[.,]\d+)?)\s*(s|sec|giây|min|phút)\b/);
  if (t) {
    const v = parseFloat(t[1].replace(",", "."));
    const secs = /^(s|sec|giây)$/.test(t[2]) ? v : v * 60;
    return Math.round(n * secs * (/rope|dây/i.test(String(name || "")) ? 1.5 : 0.6));
  }
  const m = raw.match(/x\s*(\d+)/);
  const reps = m ? +m[1] : 1;
  return n * reps * (/\/\s*(side|bên|chân|leg)|each/.test(raw) ? 2 : 1);
}
/**
 * Khách < 18 tuổi: tiếp đất / buổi ≤ trần của mức plyo, không bài vượt mức, không 1RM / tới thất bại trong cue,
 * tập 2 buổi/tuần thì bật nhảy chỉ một buổi (buổi còn lại ném bóng — khớp hồi phục).
 */
function youthIssues(program, level) {
  const lv = Math.max(0, Math.min(3, Number.isInteger(Number(level)) ? Number(level) : 1));
  const cap = PLYO_CAP[lv];
  const errors = [], warnings = [], perSession = {};
  const days = Object.keys(program || {});
  let jumpDays = 0;
  for (const k of days) {
    let total = 0;
    for (const ph of ((program[k] && program[k].phases) || [])) {
      const warm = normalizePhaseTag(ph) === "warmup";
      for (const x of (ph && ph.exercises) || []) {
        const n = String((x && x.name) || ""), cue = String((x && x.cue) || "") + " " + String((x && x.setsReps) || "");
        if (/\b1\s*rm\b|test (tạ|1rm)|tới thất bại|to failure|amrap tạ/i.test(cue)) {
          errors.push({ k: `y1rm:${k}:${n}`, m: `${k} — "${n}": không test 1RM / tập tới thất bại với khách dưới 18 tuổi (RPE 6–7, chừa 2–3 rep).` });
        }
        if (warm) continue;                       // drill tiếp đất trong khởi động không tính
        const j = JUMPS.find(([re]) => re.test(n));
        if (!j) continue;
        if (j[1] > lv) errors.push({ k: `ylv:${k}:${n}`, m: `${k} — "${n}" là bài plyo mức ${j[1]}, khách đang ở mức ${lv}. Đổi sang bài mức ≤ ${lv} (mức 1: box jump lên hộp thấp rồi bước xuống, squat jump giữ tiếp đất; mức 0: chỉ ném bóng tạ).` });
        total += contacts(x && x.setsReps, n);
      }
    }
    perSession[k] = total;
    if (total > 0) jumpDays++;
    if (total > cap) errors.push({ k: "ycap:" + k, m: `${k}: ~${total} lần tiếp đất, vượt trần mức plyo ${lv} (${cap}/buổi). Bớt set/rep bật nhảy hoặc thay bằng ném bóng tạ.` });
  }
  if (days.length === 2 && jumpDays === 2) warnings.push("Tập 2 buổi/tuần: nên chỉ một buổi có bật nhảy, buổi còn lại plyo bằng ném bóng tạ để gối và cổ chân hồi phục.");
  return { errors, warnings, contacts: perSession, level: lv };
}

/** Đẩy : kéo (set) — chỉ nhắc khi đẩy nhiều hơn kéo quá 1,5 lần. */
function pushPullWarning(program) {
  let push = 0, pull = 0;
  for (const d of Object.values(program || {})) {
    for (const ph of (d && d.phases) || []) {
      if (!working(ph)) continue;
      for (const x of (ph && ph.exercises) || []) {
        const n = String((x && x.name) || ""), s = parseSets(x && x.setsReps);
        if (ERG.test(n)) continue;
        if (PATTERNS[2][2].test(n) || PATTERNS[3][2].test(n)) push += s;
        else if (PATTERNS[4][2].test(n) || PATTERNS[5][2].test(n)) pull += s;
      }
    }
  }
  return push > 0 && push > Math.max(pull, 1) * 1.5 ? [`Đẩy ${push} set : kéo ${pull} set — khung đòi ≈ 1 : 1.`] : [];
}

// ── Lớp Hybrid / HYROX: chạy nhiều hơn trạm ───────────────────────────────
/** Phần chạy: chạy thật, hoặc bài thay chạy coach ghi "(thay chạy)" / "(run sub)". */
const RUN = /\b(run|running|jog)\b|chạy|treadmill|máy chạy|thay chạy|run sub/i;
/** Loại buổi phải chạy nhiều hơn trạm (Strength Endurance / Foundation / Partner thì không bắt). */
const RUN_FIRST = /^\s*(compromised|engine|race ?sim)/i;
const SESSION_TYPES = ["Compromised", "Strength Endurance", "Engine", "Foundation", "Race Sim", "Partner"];

/**
 * Phút LÀM (không tính nghỉ) của một bài: "4 × 3 phút" → 12; "4 × 400m" → ~8,8 (5,5 phút/km);
 * "3 × 40s" → 2; không ghi giờ/quãng → 1 phút mỗi set. So chạy với trạm phải so giờ làm — cộng
 * nghỉ vào trạm (như ước tính thời lượng buổi) làm buổi đúng mẫu thành hoà.
 */
function exerciseMinutes(setsReps) {
  const raw = String(setsReps || "").toLowerCase().replace(/[×]/g, "x");
  const n = parseSets(raw);
  const d = raw.match(/(\d+(?:[.,]\d+)?)\s*(km|m)\b/);
  if (d) {
    const km = parseFloat(d[1].replace(",", ".")) / (d[2] === "m" ? 1000 : 1);
    return n * km * 5.5;
  }
  const t = raw.match(/x\s*(\d+(?:[.,]\d+)?)\s*(s|sec|giây|min|mins|phút)\b/);
  if (t) {
    const v = parseFloat(t[1].replace(",", "."));
    return n * (/^(s|sec|giây)$/.test(t[2]) ? v / 60 : v);
  }
  return n;
}

/** Một lượng chạy ghi bằng chữ: "800m", "1 km", "3 phút", "3'" → phút. */
function amountMinutes(v, unit) {
  const n = parseFloat(String(v).replace(",", "."));
  if (/^km$/.test(unit)) return n * 5.5;
  if (/^m$/.test(unit)) return (n / 1000) * 5.5;
  if (/^(s|sec|giây)$/.test(unit)) return n / 60;
  return n;   // phút / min / '
}
const AMT = "(\\d+(?:[.,]\\d+)?)\\s*(km|m|phút|min|mins|'|s|sec|giây)(?![a-zà-ỹ])";
/** "chạy 800m", "800m chạy", "run 3 phút", "3' run" trong một đoạn chữ → phút (một lần). */
function runInText(t) {
  const s = String(t || "").toLowerCase();
  const a = s.match(new RegExp("(?:chạy|run|jog)\\s*" + AMT)) || s.match(new RegExp(AMT + "\\s*(?:chạy|run|jog)"));
  return a ? amountMinutes(a[1], a[2]) : 0;
}
const ROUNDS = /(\d+)\s*(?:vòng|rounds?|lượt|x)\b/i;

/**
 * { run, station, how } phút của một buổi — bỏ khởi động. Model không phải lúc nào cũng ghi chạy thành
 * MỘT DÒNG BÀI: hay viết trong tên pha ("5 vòng: chạy 3 phút → trạm") hoặc trong set×rep của bài trạm
 * ("4 vòng × (800m chạy + 15 wall ball)"). Không đọc mấy chỗ đó thì buổi đúng mẫu vẫn ra "chạy 0 phút"
 * và model sửa mãi không qua (2026-10-19: 10 lần đề xuất bị từ chối liền).
 */
function runStationMinutes(day) {
  // So chạy với trạm TRONG KHỐI chạy xen trạm (pha có chạy): mỗi vòng chạy 3–4' > trạm 2–3'. Pha kỹ thuật
  // và finisher là trạm thuần theo đúng mẫu — tính cả buổi thì mẫu chuẩn cũng ra trạm nhiều hơn chạy.
  // Không có pha nào có chạy → so với trạm cả buổi (lỗi "không thấy bài chạy").
  let run = 0, station = 0, stationAll = 0;
  const how = [];
  for (const ph of (day && day.phases) || []) {
    if (normalizePhaseTag(ph) === "warmup") continue;
    const r0 = run, s0 = station;
    phase(ph);
    if (run === r0) { stationAll += station - s0; station = s0; } else stationAll += station - s0;
  }
  return { run: Math.round(run), station: Math.round(run > 0 ? station : stationAll), how };

  function phase(ph) {
    const exs = (ph && ph.exercises) || [];
    const rowRun = exs.some((x) => RUN.test(String((x && x.name) || "")));
    // Chạy ghi ở tên pha, không có dòng bài chạy: số vòng × lượng chạy mỗi vòng.
    if (!rowRun) {
      const pr = runInText(ph && ph.name);
      if (pr) {
        const r = String((ph && ph.name) || "").match(ROUNDS);
        const m = pr * (r ? +r[1] : 1);
        run += m; how.push(`tên pha "${String(ph.name).slice(0, 40)}": ~${Math.round(m)}'`);
      }
    }
    for (const x of exs) {
      const name = String((x && x.name) || "");
      if (RUN.test(name)) { const m = exerciseMinutes(x && x.setsReps); run += m; how.push(`${name} ~${Math.round(m)}'`); continue; }
      // Chạy lồng trong set×rep của bài trạm: tách phần chạy ra, phần còn lại tính là trạm.
      const inner = runInText(x && x.setsReps);
      if (inner) {
        const m = parseSets(x && x.setsReps) * inner;
        run += m; how.push(`trong "${name}": ~${Math.round(m)}'`);
        station += parseSets(x && x.setsReps);
        continue;
      }
      station += exerciseMinutes(x && x.setsReps);
    }
  }
}

/**
 * Buổi Compromised / Engine / Race Sim của lớp hybrid: tổng phút chạy ≥ tổng phút ở trạm (chạy ~60% thời gian
 * thi). Label không bắt đầu bằng loại buổi → nhắc ghi loại để app và coach biết buổi đó là gì.
 */
/** 8 trạm thi (và bài thay tương đương) → một khoá, để đếm số trạm KHÁC nhau. */
const STATIONS = [
  ["ski", /ski ?erg|band pull[\s-]?down|kéo dây/i], ["sledpush", /sled push|prowler|plate push|đẩy đĩa|banded march|đẩy sled/i],
  ["sledpull", /sled pull|rope pull|kéo sled|kéo dây có tải|heavy seated row/i], ["bbj", /burpee/i],
  ["row", /^(?!.*thay chạy).*\b(row(er|ing)?( erg)?|concept ?2)\b(?!.*\b(dumbbell|cable|barbell|db|bent|seated|single|renegade)\b)/i],
  ["farmer", /farmer|carry/i], ["lunge", /lunge/i], ["wallball", /wall ?ball|wall throw|med(icine)? ?ball/i],
];
function stationKeys(day) {
  const keys = new Set();
  for (const ph of (day && day.phases) || []) {
    if (normalizePhaseTag(ph) === "warmup") continue;
    for (const x of (ph && ph.exercises) || []) {
      const n = String((x && x.name) || "");
      if (RUN.test(n)) continue;   // chạy và bài thay chạy không phải trạm
      for (const [k, re] of STATIONS) if (re.test(n)) keys.add(k);
    }
  }
  return keys;
}

function hybridIssues(program, minutes) {
  const errors = [], warnings = [], split = {};
  for (const [k, d] of Object.entries(program || {})) {
    const label = String((d && d.label) || "");
    const rs = runStationMinutes(d);
    split[k] = rs;
    if (!SESSION_TYPES.some((t) => label.toLowerCase().startsWith(t.toLowerCase()))) {
      warnings.push(`${k}: label nên bắt đầu bằng loại buổi (${SESSION_TYPES.join(" / ")}).`);
    }
    const isCompromised = /^\s*(compromised|race ?sim)/i.test(label);
    if (isCompromised) {
      // Khối chính phải là VÒNG chạy xen trạm: một pha có dòng Run + ≥ 2 trạm. Chạy một pha, trạm một pha
      // khác thì không còn là "chạy khi đã mỏi".
      const mixed = ((d && d.phases) || []).some((ph) => {
        const ns = ((ph && ph.exercises) || []).map((x) => String((x && x.name) || ""));
        const hasRun = ns.some((n) => RUN.test(n)) || runInText(ph && ph.name) > 0;
        return hasRun && ns.filter((n) => !RUN.test(n)).length >= 2;
      });
      if (!mixed) errors.push({ k: "mix:" + k, m: `${k}: thiếu khối chính chạy xen trạm — một pha (tag circuit) gồm dòng Run `
        + "và ≥ 2 trạm khác nhau, VD \"Khối chính — 5 vòng: chạy 3' → trạm 2'\": Run 5 × 3 phút, SkiErg 3 × 1 phút, Wall Ball 2 × 20." });
      const st = stationKeys(d);
      if (st.size < 3) errors.push({ k: "st:" + k, m: `${k}: mới có ${st.size} trạm thi khác nhau (${[...st].join(", ") || "—"}), cần ≥ 3 trong 8 trạm `
        + "(SkiErg, Sled Push, Sled Pull, Burpee Broad Jump, Row, Farmers Carry, Sandbag Lunges, Wall Balls — hoặc bài thay)." });
    }
    // Lớp chạy theo giờ cố định: buổi ngắn hơn 75% thời lượng là học viên đứng chơi cuối giờ.
    const est = estimateMinutes(d), target = Number(minutes);
    if (target > 0 && est < target * 0.75) {
      errors.push({ k: "short:" + k, m: `${k}: ước tính ~${est} phút cho lớp ${target} phút — thiếu. Theo mẫu: khởi động 10' → kỹ thuật 8' → khối chính 30' → finisher 7' → giãn 5'.` });
    }
    if (RUN_FIRST.test(label) && rs.run < rs.station) {
      errors.push({ k: "run:" + k, m: `${k} (${label.split("—")[0].trim()}): chạy ~${rs.run} phút < trạm ~${rs.station} phút`
        + (rs.how.length ? ` (đếm được chạy: ${rs.how.join("; ")})` : " — server KHÔNG thấy bài chạy nào") + ". "
        + "Ghi chạy thành DÒNG BÀI RIÊNG: name \"Run\" (không chỗ chạy: \"Row (thay chạy)\"), setsReps theo thời gian "
        + "VD \"5 × 3 phút\", đặt cùng pha với trạm; tổng phút chạy phải lớn hơn tổng phút trạm." });
    }
  }
  return { errors, warnings, split };
}

/**
 * Lỗi nào MỚI so với giáo án cũ. Sửa một buổi mà các buổi KHÔNG đụng tới đã vượt khung từ
 * trước thì không bắt model sửa buổi coach không nhờ — lỗi cũ thành lời nhắc.
 * @returns {{errors:{k,m}[], inherited:string[]}}
 */
function newErrors(next, before, changedDays) {
  const had = new Set((before || []).map((e) => e.k));
  // Lỗi gắn với MỘT buổi ("struct:SessionA") mà buổi đó vừa được sửa → luôn là lỗi mới: sửa buổi nào thì buổi đó
  // phải đạt chuẩn, không được núp sau "giáo án cũ cũng vậy".
  const changed = new Set(changedDays || []);
  const own = (e) => { const day = (String(e.k).match(/(Session[A-G])/) || [])[1]; return day && changed.has(day); };
  const isNew = (e) => own(e) || !had.has(e.k);
  return { errors: next.filter(isNew), inherited: next.filter((e) => !isNew(e)).map((e) => e.m) };
}

/**
 * Chạy mọi kiểm cho một giáo án CẢ TUẦN.
 * @param {object} program  giáo án đã qua resolveProgram (bài đã gắn muscles)
 * @param {object} o  { level, minutes, exceptions, isGroup }
 * @returns {{errors:{k:string,m:string}[], warnings:string[], volume:object, est:object, waived:string[]}}
 */
function checkProgram(program, o = {}) {
  // Lớp nhóm: trình độ trộn, dụng cụ có hạn, học viên đi 1 buổi — khung volume 1-1 không áp.
  if (o.isGroup) {
    const d = durationIssues(program, o.minutes);
    const h = o.groupFormat === "hyrox" ? hybridIssues(program, o.minutes) : { errors: [], warnings: [], split: {} };
    return { errors: [...d.errors, ...h.errors], warnings: [...d.warnings, ...h.warnings], volume: {}, est: d.est,
      waived: [], runSplit: h.split };
  }
  const v = volumeIssues(program, o.level, o.volumeExceptions);
  const c = coverageIssues(program, o.coverageExceptions);
  const d = durationIssues(program, o.minutes);
  const st = structureIssues(program, o.minutes, Number(o.minutes) > 0);
  const y = o.minor ? youthIssues(program, o.plyoLevel) : null;
  return {
    errors: [...v.errors, ...c.errors, ...d.errors, ...st.errors, ...(y ? y.errors : [])],
    warnings: [...v.warnings, ...d.warnings, ...st.warnings, ...pushPullWarning(program), ...(y ? y.warnings : [])],
    youth: y ? { level: y.level, contacts: y.contacts } : null,
    volume: v.totals, est: d.est, waived: [...v.waived, ...c.waived],
  };
}

/** "45 phút" / "60" / "1h" → 45 / 60 / 60; không đọc được → null. */
function parseMinutes(v) {
  const s = String(v == null ? "" : v).toLowerCase();
  const h = s.match(/(\d+(?:[.,]\d+)?)\s*(h|giờ|tiếng)/);
  if (h) return Math.round(parseFloat(h[1].replace(",", ".")) * 60);
  const m = s.match(/\d+/);
  return m ? +m[0] : null;
}

module.exports = { canonMuscle, parseSets, muscleSets, volumeIssues, patternsCovered, coverageIssues, estimateMinutes,
  durationIssues, pushPullWarning, checkProgram, newErrors, structureIssues, youthIssues, contacts, PLYO_CAP, hybridIssues, stationKeys, runStationMinutes, exerciseMinutes, SESSION_TYPES, parseMinutes, VOLUME, PATTERN_KEYS, PER_SESSION_MAX };
