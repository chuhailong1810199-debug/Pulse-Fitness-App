/**
 * STRAIN 0–21 — tải tim mạch, lấy cảm hứng từ cách WHOOP trình bày nhưng KHÔNG
 * dùng công thức của họ (công thức đó không công bố).
 *
 * Đường đi: nhịp tim từng mẫu -> cường độ Karvonen -> trọng số mũ Banister ->
 * cộng dồn thành tải thô -> ép về thang 0–21 bằng hàm bão hoà.
 *
 * ── Vì sao chọn từng bước ────────────────────────────────────────────────
 *
 * 1. Cường độ theo % DỰ TRỮ nhịp tim (Karvonen), không theo % nhịp tim tối đa.
 *    Dự trữ tính từ nhịp tim nghỉ của chính người đó, nên hai người cùng đạt
 *    150 bpm mà nhịp nghỉ 45 và 70 sẽ ra cường độ khác nhau — đúng thực tế.
 *
 * 2. Trọng số mũ của Banister: w(i) = i · e^(b·i), b = 1.92 nam / 1.67 nữ.
 *    Đây là công thức TRIMP đã công bố từ 1991, dùng rộng rãi trong khoa học
 *    thể thao. Bản trước của file này chia 5 vùng rồi tính trọng số 1..5 tuyến
 *    tính — vùng quá thô nên 165 bpm và 175 bpm rơi cùng vùng và ra ĐIỂM Y HỆT.
 *    Hàm mũ liên tục không có bậc thang, nên mỗi nhịp tim tăng thêm đều được
 *    tính, và phần cường độ cao đóng góp phi tuyến nhiều hơn hẳn.
 *
 * 3. Tải thô cộng dồn tuyến tính theo thời gian, rồi MỚI ép về 0–21 một lần.
 *    Hệ quả quan trọng: tải ngày KHÔNG phải tổng strain của từng buổi. Hàm ép
 *    là hàm lõm, cộng các giá trị đã ép lại sẽ thổi phồng con số.
 *
 * 4. Hàm bão hoà: strain = 21 · (1 − e^(−T/K)), K = 83.
 *    K neo vào NGÀY THẬT của khách này, đo được chứ không chọn bừa:
 *      T ≈   7  (ngày nghỉ, chỉ đi lại)   -> 1.7
 *      T ≈  45  (ngày tập vừa, 1 buổi)    -> 8.8
 *      T ≈ 162  (ngày tập nặng, 2 buổi)   -> 18.0
 *      T → ∞                               -> tiệm cận 21, không bao giờ chạm
 *    K là lựa chọn hiệu chỉnh, không phải hằng số tự nhiên. Nó quyết định
 *    "bao nhiêu là nặng", nên đổi K là đổi ý nghĩa cả thang điểm.
 *
 * ── Giới hạn phải biết ───────────────────────────────────────────────────
 * Điểm này chỉ đo tải TIM MẠCH. Một buổi tạ nặng, nghỉ dài, nhịp tim thấp sẽ
 * ra strain thấp dù cơ chịu tải rất lớn. Đó là đúng theo định nghĩa, không
 * phải lỗi — nhưng đừng đọc nó như "buổi tập nặng tới đâu".
 */

// Banister TRIMP, hệ số theo giới.
const B_MALE = 1.92;
const B_FEMALE = 1.67;

// Hiệu chỉnh thang 0–21. Xem các mốc neo ở phần chú thích đầu file.
const STRAIN_MAX = 21;
const K = 83;

/**
 * Số mũ của cường độ, đặt TRƯỚC hàm mũ Banister.
 *
 * Banister nguyên bản (P = 1) được dựng cho một buổi tập, không phải cho 24
 * giờ. Khi tích phân cả ngày, phần thời gian gần mức nghỉ chiếm ưu thế tuyệt
 * đối: đo trên dữ liệu thật của khách này, ngày NGHỈ ra tải thô 220 còn ngày
 * tập nặng chỉ 292 — tín hiệu tập chìm trong chi phí sống, hai ngày khác hẳn
 * nhau mà điểm gần như bằng nhau.
 *
 * P = 3 ép phần cường độ thấp đóng góp không đáng kể mà vẫn giữ nguyên thứ tự
 * và tính phi tuyến ở phần cao. Trên cùng bộ dữ liệu: nghỉ 7, tập vừa 45, tập
 * nặng 162 — tỷ lệ tín hiệu trên nền hơn 20 lần.
 *
 * Đây là thay đổi CÓ Ý so với Banister công bố, không phải nhầm lẫn.
 */
const P = 3;

// Mẫu cách nhau quá xa là đã tháo thiết bị, không phải vận động liên tục.
// Chặn lại để một khoảng trống dài không biến thành tải khổng lồ.
const MAX_GAP_SEC = 600;

// Ngưỡng vùng theo % dự trữ nhịp tim, chỉ dùng để BÁO CÁO thời gian mỗi vùng.
// Điểm số không đi qua vùng — nó tính liên tục trên từng mẫu.
const ZONE_FLOOR = [0.5, 0.6, 0.7, 0.8, 0.9];

// Cách đọc 0–21.
const STRAIN_BANDS = [
  { max: 7,  key: "thap",    label: "Thấp" },
  { max: 10, key: "vua",     label: "Vừa" },
  { max: 14, key: "kha_cao", label: "Khá cao" },
  { max: 18, key: "cao",     label: "Cao" },
  { max: 21, key: "rat_cao", label: "Rất cao" },
];

function strainBand(v) {
  if (typeof v !== "number" || !isFinite(v)) return null;
  return STRAIN_BANDS.find((b) => v <= b.max) || STRAIN_BANDS[STRAIN_BANDS.length - 1];
}

/** Cường độ Karvonen, kẹp về [0,1]. */
function intensity(hr, rhr, hrMax) {
  const span = hrMax - rhr;
  if (!(span > 0)) return null;
  return Math.max(0, Math.min(1, (hr - rhr) / span));
}

/**
 * Nhịp tim tối đa. AccessLink KHÔNG trả trường này, nên phải suy ra — và phải
 * NÓI RA đã suy bằng cách nào. Bản trước đặt sàn cứng 185, cao hơn mọi giá trị
 * khách từng đạt, nên cái sàn bịa đó luôn thắng số thật và mọi cường độ bị
 * tính thấp đi. Giờ ưu tiên số đo thật, và ghi lại nguồn.
 *
 * @param {object} o
 * @param {number} [o.manual]    số coach nhập từ bài test max thật — tin nhất
 * @param {number} [o.observed]  nhịp cao nhất từng quan sát được
 * @param {string} [o.birthdate] "YYYY-MM-DD", để ước theo tuổi
 * @param {string} [o.today]     "YYYY-MM-DD"
 */
function resolveHrMax(o) {
  const man = Number(o && o.manual);
  if (isFinite(man) && man > 100) return { hrMax: Math.round(man), source: "đo thật" };

  // Tanaka 2001: 208 − 0.7 × tuổi. Sai số vẫn ±10 bpm nhưng ít lệch hệ thống
  // hơn công thức 220 − tuổi, vốn ước thấp ở người trẻ và cao ở người lớn tuổi.
  let age = null, tanaka = null;
  if (o && o.birthdate && o.today) {
    const b = String(o.birthdate).split("-").map(Number);
    const t = String(o.today).split("-").map(Number);
    if (b.length === 3 && t.length === 3 && !b.some(isNaN) && !t.some(isNaN)) {
      age = (Date.UTC(t[0], t[1] - 1, t[2]) - Date.UTC(b[0], b[1] - 1, b[2])) / (365.25 * 864e5);
      if (age > 5 && age < 100) tanaka = 208 - 0.7 * age;
    }
  }

  const obs = Number(o && o.observed);
  // Số quan sát chỉ đáng tin khi khách thực sự đã đẩy lên gần ngưỡng. Thấp hơn
  // ước theo tuổi nhiều nghĩa là chưa từng tập đủ nặng, không phải max thấp.
  if (isFinite(obs) && obs > 100 && (tanaka == null || obs >= tanaka - 5)) {
    return { hrMax: Math.round(obs), source: "cao nhất đã ghi được" };
  }
  if (tanaka != null) {
    return { hrMax: Math.round(tanaka), source: "ước theo tuổi (Tanaka)", age: Math.round(age * 10) / 10 };
  }
  if (isFinite(obs) && obs > 100) return { hrMax: Math.round(obs), source: "cao nhất đã ghi được" };
  return { hrMax: null, source: "không đủ dữ liệu" };
}

/**
 * Tải thô từ một chuỗi nhịp tim. KHÔNG ép về 0–21 ở đây — gọi toStrain() sau,
 * để tải cả ngày cộng được trước khi ép (xem chú thích số 3 đầu file).
 *
 * @param {{at:number, hr:number}[]} samples `at` là giây epoch; thiếu thì dùng
 *        `fallbackStepSec` cho mọi mẫu.
 * @param {object} ctx { rhr, hrMax, sex, fallbackStepSec }
 */
function rawLoad(samples, ctx) {
  const rhr = Number(ctx && ctx.rhr), hrMax = Number(ctx && ctx.hrMax);
  if (!Array.isArray(samples) || samples.length < 2) return null;
  if (!isFinite(rhr) || !isFinite(hrMax) || hrMax - rhr <= 0) return null;

  const b = (ctx && ctx.sex) === "female" ? B_FEMALE : B_MALE;
  const pts = samples
    .filter((s) => s && isFinite(Number(s.hr)) && Number(s.hr) > 0)
    .map((s) => ({ at: isFinite(Number(s.at)) ? Number(s.at) : null, hr: Number(s.hr) }))
    .sort((x, y) => (x.at == null || y.at == null) ? 0 : x.at - y.at);
  if (pts.length < 2) return null;

  const fallback = Number(ctx && ctx.fallbackStepSec) || 1;
  const zoneSec = [0, 0, 0, 0, 0];
  let load = 0, sec = 0, sum = 0, peak = 0;

  for (let i = 0; i < pts.length; i++) {
    const cur = pts[i], next = pts[i + 1];
    let dt = fallback;
    if (cur.at != null && next && next.at != null) dt = next.at - cur.at;
    else if (cur.at != null && !next) dt = fallback;
    if (!(dt > 0)) dt = fallback;
    dt = Math.min(dt, MAX_GAP_SEC);

    const iN = intensity(cur.hr, rhr, hrMax);
    if (iN == null) continue;

    // Trọng số: cường độ cao đóng góp nhiều hơn hẳn phần thấp.
    load += (dt / 60) * Math.pow(iN, P) * Math.exp(b * iN);

    sec += dt; sum += cur.hr * dt;
    if (cur.hr > peak) peak = cur.hr;
    for (let z = ZONE_FLOOR.length - 1; z >= 0; z--) {
      if (iN >= ZONE_FLOOR[z]) { zoneSec[z] += dt; break; }
    }
  }

  if (!(sec > 0)) return null;
  return {
    load: Math.round(load * 100) / 100,
    sec: Math.round(sec),
    hrAvg: Math.round(sum / sec),
    hrMax: peak || null,
    zoneSec: zoneSec.map(Math.round),
    samples: pts.length,
  };
}

/** Tải thô -> 0–21. Hàm bão hoà: càng lên cao càng khó tăng thêm. */
function toStrain(load) {
  const T = Number(load);
  if (!isFinite(T) || T < 0) return null;
  return Math.round(STRAIN_MAX * (1 - Math.exp(-T / K)) * 10) / 10;
}

/** Strain của MỘT buổi tập. */
function workoutStrain(samples, ctx) {
  const r = rawLoad(samples, ctx);
  if (!r) return null;
  const strain = toStrain(r.load);
  return { ...r, strain, band: strainBand(strain) };
}

/**
 * Strain của CẢ NGÀY. Nhận nhiều chuỗi (nhịp tim nền cả ngày + từng buổi tập),
 * cộng tải thô rồi mới ép một lần. Cộng strain của từng buổi lại là sai.
 *
 * @param {Array<{at:number,hr:number}[]>} series
 */
function dailyStrain(series, ctx) {
  const parts = (Array.isArray(series) ? series : [])
    .map((s) => rawLoad(s, ctx)).filter(Boolean);
  if (!parts.length) return null;

  const total = parts.reduce((a, p) => a + p.load, 0);
  const zoneSec = [0, 0, 0, 0, 0];
  let sec = 0, peak = 0, wsum = 0;
  for (const p of parts) {
    p.zoneSec.forEach((v, i) => { zoneSec[i] += v; });
    sec += p.sec; wsum += p.hrAvg * p.sec;
    if (p.hrMax > peak) peak = p.hrMax;
  }
  const strain = toStrain(total);
  return {
    load: Math.round(total * 100) / 100,
    strain, band: strainBand(strain),
    sec, hrAvg: sec ? Math.round(wsum / sec) : null, hrMax: peak || null,
    zoneSec, parts: parts.length,
  };
}

/**
 * Strain khi CHỈ có thời gian theo vùng, không có chuỗi nhịp tim. Dùng điểm
 * giữa mỗi vùng làm cường độ đại diện. Kém chính xác hơn hẳn chuỗi mẫu — trong
 * một vùng, cường độ thật có thể nằm bất cứ đâu — nên chỉ dùng khi không còn
 * nguồn nào khác.
 *
 * @param {number[]} zoneMinutes 5 phần tử, số phút ở z1..z5
 */
function strainFromZones(zoneMinutes, ctx) {
  if (!Array.isArray(zoneMinutes) || zoneMinutes.length !== 5) return null;
  const b = (ctx && ctx.sex) === "female" ? B_FEMALE : B_MALE;
  let load = 0, min = 0;
  for (let z = 0; z < 5; z++) {
    const m = Number(zoneMinutes[z]);
    if (!isFinite(m) || m <= 0) continue;
    const lo = ZONE_FLOOR[z], hi = z === 4 ? 1 : ZONE_FLOOR[z + 1];
    const mid = (lo + hi) / 2;
    load += m * Math.pow(mid, P) * Math.exp(b * mid);
    min += m;
  }
  if (!(min > 0)) return null;
  const strain = toStrain(load);
  return { load: Math.round(load * 100) / 100, strain, band: strainBand(strain),
           sec: Math.round(min * 60), approx: true };
}

module.exports = {
  intensity, resolveHrMax, rawLoad, toStrain,
  workoutStrain, dailyStrain, strainFromZones,
  strainBand, STRAIN_BANDS,
  _const: { B_MALE, B_FEMALE, P, K, STRAIN_MAX, MAX_GAP_SEC, ZONE_FLOOR },
};
