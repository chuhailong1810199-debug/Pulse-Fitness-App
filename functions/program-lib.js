/**
 * Giáo án ↔ thư viện bài tập. Thuần, không I/O — test được, dùng chung cho
 * trợ lý (functions/assistant.js) và script backfill.
 *
 * Vì sao có file này (đếm 2026-10-11 trên giáo án thật):
 *  - Chỉ 20/655 bài có `muscles` → hình cơ thể trên dashboard gần như trống.
 *  - Chỉ 214/484 bài (ngoài khởi động) khớp tên thư viện: model tự đặt tên
 *    ("Lat pull down", "RDL") dù prompt bảo "chỉ dùng bài trong thư viện".
 *  - Tag pha tuỳ hứng ("main", "Warm-up", "isolation"…) → app sắp pha sai.
 *
 * Thư viện đặt tên kiểu "Lateral Raise (Dumbbell)": tên gốc + dụng cụ trong
 * ngoặc. 64 tên gốc có nhiều bản (Skull Crusher: Barbell / Dumbbell / Ez Bar)
 * — gọi trống "Skull Crusher" là MƠ HỒ, phải hỏi lại chứ không đoán.
 */

const PHASE_TAGS = ["warmup", "strength", "accessories", "circuit"];

/**
 * Tag pha về đúng 4 giá trị app hiểu. Tag hợp lệ sẵn thì giữ; không thì đoán
 * theo tên + tag cũ. Không đoán được → accessories (pha phụ trợ là chỗ an toàn
 * nhất: không bị coi là khởi động mà bỏ khỏi volume, không bị coi là bài chính).
 */
function normalizePhaseTag(phase) {
  const tag = String((phase && phase.tag) || "").toLowerCase().trim();
  if (PHASE_TAGS.includes(tag)) return tag;
  const t = (String((phase && phase.name) || "") + " " + tag).toLowerCase();
  if (/warm[\s-]*up|khởi\s*động|activation|kích\s*hoạt|\bprep\b|rehab/.test(t)) return "warmup";
  if (/circuit|conditioning|finisher|\bwod\b|amrap|emom|interval|cardio|hyrox|metcon|liss|steady|engine/.test(t)) return "circuit";
  if (/strength|\bmain\b|heavy|power|plyo|hypertroph|sức\s*mạnh|bài\s*chính|block\s*1\b/.test(t)) return "strength";
  return "accessories";
}

// ── Khớp tên bài ─────────────────────────────────────────────────────────
const ABBR = [
  [/\brdl\b/g, "romanian deadlift"], [/\bsldl\b/g, "stiff leg deadlift"],
  [/\bohp\b/g, "overhead press"], [/\bdb\b/g, "dumbbell"], [/\bbb\b/g, "barbell"],
  [/\bkb\b/g, "kettlebell"], [/\bbw\b/g, "bodyweight"], [/\bbody\s*weight\b/g, "bodyweight"],
  [/\bez\s*-?\s*bar\b/g, "ez bar"],
];
/** Chữ thường, mở viết tắt, bỏ mọi ký tự không phải chữ/số (kể cả cách): "Lat pull-down" → "latpulldown". */
function squash(s) {
  let x = String(s || "").toLowerCase().normalize("NFC");
  for (const [re, to] of ABBR) x = x.replace(re, to);
  return x.replace(/[^a-z0-9à-ỹđ]+/g, "");
}
function splitName(name) {
  const m = String(name || "").match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  return m ? { base: m[1], paren: m[2] } : { base: String(name || ""), paren: "" };
}
const words = (s) => String(s || "").toLowerCase().replace(/\(.*?\)/g, " ")
  .split(/[^a-z0-9à-ỹđ]+/).filter((w) => w.length > 1);

/**
 * Chỉ mục thư viện:
 *  full  — tên đầy đủ, và cả hai thứ tự "dụng cụ + tên" / "tên + dụng cụ"
 *          ("Dumbbell Lateral Raise", "Lateral Raise Dumbbell")
 *  base  — tên gốc bỏ ngoặc → danh sách bài (nhiều bài = mơ hồ)
 */
function buildLibIndex(lib) {
  const full = new Map(), base = new Map();
  const add = (m, k, v) => { if (!k) return; if (!m.has(k)) m.set(k, []); if (!m.get(k).includes(v)) m.get(k).push(v); };
  for (const ex of lib || []) {
    if (!ex || !ex.name) continue;
    const { base: b, paren } = splitName(ex.name);
    add(full, squash(ex.name), ex);
    if (paren) { add(full, squash(paren + " " + b), ex); add(full, squash(b + " " + paren), ex); }
    // Dụng cụ nằm ở trường tool chứ không trong tên ("Lat Pulldown", tool Cable)
    // → model ghi "Lat Pulldown (Cable)" / "Cable Lat Pulldown" vẫn khớp.
    const tool = String(ex.tool || "").replace(/\s*machine$/i, "");
    if (!paren && tool) { add(full, squash(b + " " + tool), ex); add(full, squash(tool + " " + b), ex); }
    add(base, squash(b), ex);
  }
  return { full, base, lib: (lib || []).filter((e) => e && e.name) };
}

/** Gợi ý gần nhất theo số từ chung — cho model chọn lại khi tên không khớp. */
function suggest(name, idx, n = 3) {
  const w = new Set(words(name));
  if (!w.size) return [];
  return idx.lib.map((ex) => {
    const e = words(ex.name); const hit = e.filter((x) => w.has(x)).length;
    return [hit / (w.size + e.length - hit), ex.name];
  }).filter((x) => x[0] > 0).sort((a, b) => b[0] - a[0]).slice(0, n).map((x) => x[1]);
}

const muscleKey = (ex) => JSON.stringify(Object.entries((ex && ex.muscles) || {})
  .map(([m, r]) => [String(m).toLowerCase(), r]).sort());
const toolKey = (ex) => String((ex && ex.tool) || "").toLowerCase().replace(/\s*machine$/, "");

/**
 * Nhiều ứng viên:
 *  - Tên đúng y từng chữ (sau squash) với đúng một bài → lấy bài đó.
 *  - Mọi ứng viên cùng dụng cụ VÀ cùng nhóm cơ → là bài trùng trong thư viện
 *    ("Lateral Raise (Dumbbell)" / "Dumbbell Lateral Raise") → lấy bài đầu.
 *  - Còn lại là mơ hồ thật (Skull Crusher: Barbell / Dumbbell / Ez Bar). Trả kèm
 *    `sameMuscles` để backfill vẫn gắn được nhóm cơ mà không phải đoán dụng cụ.
 */
function pick(cands, k, name) {
  const exact = cands.filter((e) => squash(e.name) === k);
  if (exact.length === 1) return { ex: exact[0] };
  // "Face Pull (Cable)" / "Facepull (Cable)": cùng một bài viết hai kiểu.
  if (exact.length > 1) {
    const lc = String(name || "").trim().toLowerCase();
    return { ex: exact.find((e) => e.name.toLowerCase() === lc) || exact[0] };
  }
  const mk = muscleKey(cands[0]), tk = toolKey(cands[0]);
  const sameMuscles = cands.every((e) => muscleKey(e) === mk) && mk !== "[]";
  if (sameMuscles && cands.every((e) => toolKey(e) === tk)) return { ex: cands[0] };
  return { ambiguous: cands.map((e) => e.name), muscles: sameMuscles ? cands[0].muscles : null };
}

/**
 * @returns {{ex}} khớp đúng một bài | {{ambiguous:string[], muscles}} | {{none:true, suggestions:string[]}}
 */
function matchExercise(name, idx) {
  const k = squash(name);
  if (!k) return { none: true, suggestions: [] };
  const f = idx.full.get(k);
  if (f && f.length) return f.length === 1 ? { ex: f[0] } : pick(f, k, name);
  const b = idx.base.get(k);
  if (b && b.length) return b.length === 1 ? { ex: b[0] } : pick(b, k, name);
  return { none: true, suggestions: suggest(name, idx) };
}

/**
 * Chuẩn hoá một giáo án theo thư viện.
 *  - Tag pha → 4 giá trị chuẩn.
 *  - Bài khớp → tên đúng thư viện + `muscles` (+ `bw` nếu bài bodyweight).
 *  - Pha strength / accessories: bài KHÔNG khớp hoặc MƠ HỒ là lỗi.
 *  - Pha warmup / circuit: khớp được thì gắn, không khớp thì để nguyên —
 *    drill khởi động, chạy, SkiErg, Wall Ball… không có trong thư viện.
 *
 * @param {object} prog
 * @param {object} idx          buildLibIndex(...)
 * @param {object} [o]
 * @param {Set<string>} [o.keepNames]  tên bài đang có trong giáo án cũ của khách:
 *        GIỮ NGUYÊN tên (chỉ gắn muscles) — lịch sử tạ và biểu đồ tiến bộ nối
 *        theo tên bài, đổi tên là đứt mạch lịch sử.
 * @param {boolean} [o.strict=true]    false = không báo lỗi bài lạ (dùng cho backfill).
 * @param {boolean} [o.rename=true]    false = không đổi tên bài nào (backfill).
 * @param {boolean} [o.setBw=true]     false = không tự bật `bw` (backfill: bật bw đổi
 *        nghĩa số kg coach đã gõ cho bài đó — từ "tạ" thành "tạ thêm vào thân").
 * @returns {{program, errors:string[], renamed:Array<[string,string]>, matched:number, total:number}}
 */
function resolveProgram(prog, idx, o = {}) {
  const strict = o.strict !== false, rename = o.rename !== false, setBw = o.setBw !== false;
  const keep = o.keepNames || new Set();
  const errors = [], renamed = [], reused = [];
  // Tên thư viện → TÊN CŨ trong giáo án khách. Model hay viết tên thư viện đầy đủ
  // ("Goblet Squat (Dumbbell)") cho đúng bài khách đang tập dưới tên cũ ("Goblet Squat")
  // → tạ điền sẵn và lịch sử nối theo tên bị đứt (Anh Đạo 2026-10-16: SessionA mất hết tạ).
  // Coach soạn tay thì luôn giữ tên cũ; server làm y vậy.
  const alias = new Map();
  if (rename && keep.size) {
    for (const old of keep) {
      const r = matchExercise(old, idx);
      const libs = r.ex ? [r.ex.name] : (r.ambiguous || []);
      for (const n of libs) if (!alias.has(n)) alias.set(n, old);
    }
  }
  let matched = 0, total = 0;
  const out = {};
  for (const [dk, day] of Object.entries(prog || {})) {
    if (!day || typeof day !== "object" || !Array.isArray(day.phases)) { out[dk] = day; continue; }
    out[dk] = {
      ...day,
      phases: day.phases.map((ph) => {
        if (!ph || typeof ph !== "object") return ph;
        const tag = normalizePhaseTag(ph);
        const loose = tag === "warmup" || tag === "circuit";
        return {
          ...ph, tag,
          exercises: (Array.isArray(ph.exercises) ? ph.exercises : []).map((x) => {
            if (!x || typeof x !== "object") return x;
            total++;
            const r = matchExercise(x.name, idx);
            if (r.ex) {
              matched++;
              const y = { ...x };
              if (r.ex.muscles && typeof r.ex.muscles === "object" && Object.keys(r.ex.muscles).length) y.muscles = r.ex.muscles;
              // Bài CŨ (keepNames) không bao giờ tự bật bw: số kg đã ghi của bài đó sẽ
              // đổi nghĩa thành "tạ thêm vào thân". Sang 2026-10-13: Pull Up (Band) 35
              // hiện thành −37 (35 − 72 kg cân nặng).
              const isOld = keep.has(String(x.name || "").trim());
              if (setBw && !isOld && /body\s*weight|^bw$/i.test(String(r.ex.tool || "")) && y.bw === undefined) y.bw = true;
              if (rename && !keep.has(String(x.name || "").trim())) {
                const old = alias.get(r.ex.name);
                if (old) {
                  reused.push([x.name, old]); y.name = old; delete y.bw;   // tên cũ: không đổi nghĩa số kg
                } else if (r.ex.name !== x.name) {
                  renamed.push([x.name, r.ex.name]); y.name = r.ex.name;
                }
              }
              return y;
            }
            // Tên cũ mơ hồ về dụng cụ ("Goblet Squat"): giữ tên, nhưng các bản cùng nhóm cơ thì
            // vẫn gắn muscles — không thì bài không được đếm volume / tô hình cơ thể.
            if (keep.has(String(x.name || "").trim()) && r.ambiguous && r.muscles && !(x.muscles && Object.keys(x.muscles).length)) {
              matched++; return { ...x, muscles: r.muscles };
            }
            // Mơ hồ về dụng cụ nhưng cùng nhóm cơ: không đổi tên (không đoán dụng
            // cụ), vẫn gắn được muscles khi không ở chế độ nghiêm (backfill).
            if (!strict && r.ambiguous && r.muscles) { matched++; return { ...x, muscles: r.muscles }; }
            if (strict && !loose && !keep.has(String(x.name || "").trim())) {
              const where = `${dk} — "${x.name || "?"}"`;
              if (r.ambiguous) {
                errors.push(`${where}: có nhiều bản trong thư viện, ghi rõ một: ${r.ambiguous.slice(0, 4).join(" | ")}.`);
              } else {
                errors.push(`${where}: không có trong thư viện.`
                  + (r.suggestions.length ? ` Gần nhất: ${r.suggestions.join(" | ")}.` : " Gọi search_exercises để tìm bài thay."));
              }
            }
            return x;
          }),
        };
      }),
    };
  }
  return { program: out, errors, renamed, reused, matched, total };
}

module.exports = { PHASE_TAGS, normalizePhaseTag, squash, buildLibIndex, matchExercise, resolveProgram, suggest };
