/*
 * Pulse · hình động minh hoạ bài tập (2026-11-17) — người dạng nét, vẽ bằng SVG, không video.
 *
 * Toạ độ THẾ GIỚI: mặt đất y = 0, trục y hướng LÊN, người nhìn về +x. Đơn vị ≈ cm/1,8 (người cao ~104).
 * Một tư thế (keyframe):
 *   hx, hy   — vị trí hông
 *   t        — góc thân: 0 = thẳng đứng, 90 = ngả tới nằm ngang (mặt úp), −90 = nằm ngửa (đầu về −x)
 *   nk       — cúi / ngửa đầu (độ)
 *   Chân: F = [[x,y] mắt cá gần, [x,y] mắt cá xa] (IK — bàn chân bám điểm) HOẶC h / k = [gần, xa] (gập hông theo thân, gập gối)
 *         p = [gần, xa]: khi có F — góc bàn chân so với mặt đất (0 phẳng, + nhón gót, − mũi chân lên);
 *                        khi FK — gập bàn chân so với cẳng chân.
 *   Tay:  W = [[x,y] cổ tay gần, xa] (IK) HOẶC s / e = [gần, xa] (gập vai theo thân, gập khuỷu)
 *   o     — độ mờ (0–1), d — thời lượng tương đối của đoạn chuyển TỚI tư thế này, face — 1 / −1 (quay mặt)
 *   ball / bf — vị trí bóng bay tự do + mức tách khỏi tay (0 = trong tay, 1 = ở `ball`); rp — góc dây nhảy
 * Mỗi bài: v ('side' | 'front'), ms (chu kỳ), props (vật dụng), kf (tư thế), cue {vi, en}, kb / eb (hướng gập gối / khuỷu IK).
 * Chế độ một chi (IK hay FK) phải giống nhau ở MỌI tư thế của một bài.
 */
(function () {
  const L = { trunk: 30, neck: 3, head: 6.5, ua: 15, fa: 14, th: 23, sh: 22, ft: 8 };
  const R = Math.PI / 180;
  const dirA = (a) => [Math.sin(a * R), -Math.cos(a * R)];          // 0 = xuống, 90 = tới (+x), 180 = lên
  const add = (p, a, len) => { const d = dirA(a); return [p[0] + d[0] * len, p[1] + d[1] * len]; };
  const angOf = (v) => Math.atan2(v[0], -v[1]) / R;

  /** IK hai đốt: gốc → đích, sign +1 = khớp giữa nằm bên TRÁI vector gốc→đích (gối ra trước khi đứng). */
  function ik(root, tgt, l1, l2, sign) {
    const vx = tgt[0] - root[0], vy = tgt[1] - root[1];
    let d = Math.hypot(vx, vy);
    const ux = vx / (d || 1), uy = vy / (d || 1);
    d = Math.min(Math.max(d, Math.abs(l1 - l2) + 0.01), l1 + l2 - 0.01);
    const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    const px = -uy * sign, py = ux * sign;                          // trái của (ux, uy)
    const mid = [root[0] + ux * a + px * h, root[1] + uy * a + py * h];
    return [mid, [root[0] + ux * d, root[1] + uy * d]];
  }

  /** Tư thế → khớp (toạ độ thế giới). */
  function skel(P, ex) {
    const front = ex.v === 'front';
    const hip = [P.hx, P.hy];
    const sho = add(hip, 180 - P.t, L.trunk);
    const head = add(sho, 180 - P.t + (P.nk || 0), L.neck + L.head);
    const wH = front ? 5 : 0, wS = front ? 8 : 0;
    const out = { hip, sho, head, legs: [], arms: [] };
    for (let i = 0; i < 2; i++) {
      const sg = front && i === 1 ? -1 : 1;                         // nhìn trước: chân / tay xa = bên trái, góc lật gương
      const hp = [hip[0] + (front ? (i ? -wH : wH) : 0), hip[1]];
      const sp = [sho[0] + (front ? (i ? -wS : wS) : 0), sho[1]];
      let kn, an, ft;
      const fl = front ? L.ft * 0.55 : L.ft;
      if (P.F) {
        [kn, an] = ik(hp, P.F[i], L.th, L.sh, (ex.kb || 1) * sg);
        ft = add(an, sg * (90 - (P.p ? P.p[i] : 0)), fl);
      } else {
        const thA = -P.t + sg * P.h[i], shA = thA - sg * P.k[i];
        kn = add(hp, thA, L.th);
        an = add(kn, shA, L.sh);
        ft = add(an, shA + sg * (90 - (P.p ? P.p[i] : 0)), fl);
      }
      const heel = [an[0] - (ft[0] - an[0]) * 0.28, an[1] - (ft[1] - an[1]) * 0.28];
      out.legs.push({ hp, kn, an, ft, heel });
      let el, wr;
      if (P.W) {
        [el, wr] = ik(sp, P.W[i], L.ua, L.fa, (ex.eb || -1) * sg);
      } else {
        const uaA = -P.t + sg * P.s[i];
        el = add(sp, uaA, L.ua);
        wr = add(el, uaA + sg * P.e[i], L.fa);
      }
      out.arms.push({ sp, el, wr });
    }
    // Không chui xuống sàn: điểm thấp nhất (gót, mũi chân, gối, tay) dưới mặt đất → nhấc cả người lên.
    let lo = 0;
    out.legs.forEach((g) => [g.kn, g.an, g.ft, g.heel].forEach((q) => { lo = Math.min(lo, q[1]); }));
    out.arms.forEach((a) => [a.el, a.wr].forEach((q) => { lo = Math.min(lo, q[1]); }));
    lo = Math.min(lo, out.head[1] - L.head, out.hip[1], out.sho[1]);
    if (lo < 0) {
      const up = (q) => { q[1] -= lo; };
      [out.hip, out.sho, out.head].forEach(up);
      out.legs.forEach((g) => [g.hp, g.kn, g.an, g.ft, g.heel].forEach(up));
      out.arms.forEach((a) => [a.sp, a.el, a.wr].forEach(up));
    }
    return out;
  }

  const ease = (u) => u * u * (3 - 2 * u);
  function lerpV(a, b, u) {
    if (Array.isArray(a) && Array.isArray(b)) return a.map((x, i) => lerpV(x, b[i], u));
    if (typeof a === 'number' && typeof b === 'number') return a + (b - a) * u;
    return u < 0.5 ? a : b;
  }
  /** Điền tư thế: mỗi keyframe kế thừa trường còn thiếu từ keyframe trước (vòng tròn từ cuối về đầu). */
  function fill(ex) {
    if (ex._kf) return ex._kf;
    const base = { hx: 0, hy: 46, t: 0, nk: 0, s: [6, -6], e: [12, 12], h: [0, 0], k: [0, 0], p: [0, 0], o: 1, d: 1, face: 1, bf: 0, rp: 0 };
    let prev = ex.kf[0] && ex.kf[0]._s ? Object.assign({}, base, STAND) : base;
    const kf = ex.kf.map((k) => { const { _s, ...rest } = k; return (prev = Object.assign({}, prev, rest)); });
    ex._kf = kf;
    ex._T = kf.reduce((a, k) => a + k.d, 0);
    return kf;
  }
  /** Tư thế tại thời điểm u (0–1 của chu kỳ). Đoạn i → i+1 mất kf[i+1].d; đoạn cuối quay về kf[0] mất kf[0].d. */
  function poseAt(ex, u) {
    const kf = fill(ex), n = kf.length;
    let t = (u % 1) * ex._T;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, dur = kf[j].d;
      if (t <= dur || i === n - 1) {
        const w = ease(Math.min(1, t / (dur || 1))), a = kf[i], b = kf[j];
        const P = {};
        Object.keys(b).forEach((key) => { P[key] = key === 'face' ? (w < 0.5 ? a.face : b.face) : lerpV(a[key], b[key], w); });
        return P;
      }
      t -= dur;
    }
    return kf[0];
  }

  const COL = { body: 'rgba(255,255,255,.95)', far: 'rgba(255,255,255,.42)', prop: '#8FDBFF', propSoft: 'rgba(143,219,255,.45)', ground: 'rgba(255,255,255,.22)' };
  const f1 = (v) => Math.round(v * 10) / 10;
  const pt = (p) => f1(p[0]) + ',' + f1(-p[1]);
  const line = (a, b, c, w) => '<line x1="' + f1(a[0]) + '" y1="' + f1(-a[1]) + '" x2="' + f1(b[0]) + '" y2="' + f1(-b[1]) + '" stroke="' + c + '" stroke-width="' + w + '" stroke-linecap="round"/>';
  const poly = (ps, c, w) => '<polyline points="' + ps.map(pt).join(' ') + '" fill="none" stroke="' + c + '" stroke-width="' + w + '" stroke-linecap="round" stroke-linejoin="round"/>';
  const circ = (p, r, fill, stroke) => '<circle cx="' + f1(p[0]) + '" cy="' + f1(-p[1]) + '" r="' + r + '" fill="' + (fill || 'none') + '"' + (stroke ? ' stroke="' + stroke + '" stroke-width="2"' : '') + '/>';
  const rect = (x, y, w, h, c, op) => '<rect x="' + f1(x) + '" y="' + f1(-(y + h)) + '" width="' + f1(w) + '" height="' + f1(h) + '" rx="1.5" fill="' + c + '"' + (op != null ? ' fill-opacity="' + op + '"' : '') + '/>';

  function mirrorPt(p, face, cx) { return face === -1 ? [2 * cx - p[0], p[1]] : p; }

  /** Vẽ một khung. */
  function frame(ex, u) {
    const P = poseAt(ex, u), S = skel(P, ex);
    const cx = P.hx;
    const M = (p) => mirrorPt(p, P.face < 0 ? -1 : 1, cx);
    const jt = (o) => { const r = {}; Object.keys(o).forEach((k) => { r[k] = M(o[k]); }); return r; };
    const legs = S.legs.map(jt), arms = S.arms.map(jt), hip = M(S.hip), sho = M(S.sho), head = M(S.head);
    const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const ctx = { P, legs, arms, hip, sho, head, M, mid };
    const back = [], fore = [];
    (ex.props || []).forEach((pr) => { const s = prop(pr, ctx); if (s) (pr.front ? fore : back).push(s); });
    const far = ex.v === 'front' ? COL.body : COL.far, W = 4.6;
    const leg = (g, c) => poly([g.hp, g.kn, g.an, g.ft], c, W) + line(g.an, g.heel, c, W);
    const arm = (a, c) => poly([a.sp, a.el, a.wr], c, W - 0.6);
    const body = leg(legs[1], far) + arm(arms[1], far) + line(hip, sho, COL.body, W + 1.4) + circ(head, L.head, COL.body)
      + leg(legs[0], COL.body) + arm(arms[0], COL.body);
    return '<g opacity="' + f1(Math.max(0, Math.min(1, P.o))) + '">' + back.join('') + body + fore.join('') + '</g>';
  }

  /** Vật dụng. Toạ độ tĩnh là toạ độ thế giới; `at` gắn vào khớp. */
  function prop(pr, c) {
    const { P, arms, legs, sho, hip, mid } = c;
    const wr0 = arms[0].wr, wr1 = arms[1].wr, hands = mid(wr0, wr1);
    switch (pr.type) {
      case 'box': return rect(pr.x, pr.y || 0, pr.w, pr.h, COL.propSoft);
      case 'wall': return line([pr.x, 0], [pr.x, pr.h || 110], COL.propSoft, 3);
      case 'cone': return '<path d="M' + f1(pr.x - 3) + ',0 L' + f1(pr.x) + ',-8 L' + f1(pr.x + 3) + ',0 Z" fill="' + COL.prop + '"/>';
      case 'bar': return line([pr.x1, pr.y], [pr.x2, pr.y], COL.prop, 3);
      case 'plate': { const at = pr.at === 'sho' ? [sho[0] + (pr.dx || 0), sho[1] + (pr.dy || 0)] : pr.at === 'hip' ? [hip[0] + (pr.dx || 0), hip[1] + (pr.dy || 0)] : pr.at === 'wr0' ? wr0 : hands;
        return circ(at, pr.r || 9, 'rgba(143,219,255,.18)', COL.prop); }
      case 'db': return [wr0, wr1].map((w) => rect(w[0] - 6, w[1] - 3.5, 12, 7, COL.prop)).join('');
      case 'kb': { const w = pr.hand === 1 ? wr1 : wr0; return circ([w[0], w[1] - 5], 4.5, COL.prop); }
      case 'ball': { const bp = P.ball || hands, at = [hands[0] + (bp[0] - hands[0]) * P.bf, hands[1] + (bp[1] - hands[1]) * P.bf]; return circ(at, 5, COL.prop); }
      case 'cable': { const w = pr.hand === 1 ? wr1 : pr.hand === 'mid' ? hands : wr0;
        return line([pr.x, pr.y], w, COL.propSoft, 1.6) + rect(pr.x - 2, 0, 4, Math.max(pr.y + 6, 20), COL.propSoft); }
      case 'landmine': { const w = pr.hand === 'mid' ? hands : wr0, a = [pr.x, 1], v = [w[0] - a[0], w[1] - a[1]], n = Math.hypot(v[0], v[1]) || 1;
        return line(a, [w[0] + v[0] / n * 6, w[1] + v[1] / n * 6], COL.prop, 3) + circ([a[0] + v[0] / n * 8, a[1] + v[1] / n * 8], 5, 'rgba(143,219,255,.18)', COL.prop); }
      case 'band': { const a = pr.from === 'knee' ? legs[0].kn : legs[0].an, b = pr.to ? pr.to : legs[1].an; return line(a, b, COL.prop, 2); }
      case 'pad': { const a = legs[0].an; return rect(a[0] - 9, 0, 22, pr.h || 5, COL.propSoft); }
      case 'kneepad': { const k = legs[0].kn; return rect(k[0] - 6, k[1] + 1.5, 12, 4, COL.prop); }
      case 'shoulderpad': return rect(sho[0] - 5, sho[1] + 1, 10, 4, COL.prop);
      case 'anchor': { const a = legs[0].an; return rect(a[0] - 4, a[1] - 1, 8, 6, COL.prop); }
      case 'bag': return rect(pr.x, 30, 14, 52, 'rgba(143,219,255,.30)') + line([pr.x + 7, 82], [pr.x + 7, 110], COL.propSoft, 1.5);
      case 'rope': { const ctr = [hands[0] + (pr.dx || 0), 52], q = [ctr[0] + 30 * Math.sin(P.rp * R), ctr[1] - 55 * Math.cos(P.rp * R)];
        const c1 = [(wr0[0] + q[0]) / 2 + (q[0] - ctr[0]) * 0.4, (wr0[1] + q[1]) / 2 + (q[1] - ctr[1]) * 0.4];
        const c2 = [(wr1[0] + q[0]) / 2 + (q[0] - ctr[0]) * 0.4, (wr1[1] + q[1]) / 2 + (q[1] - ctr[1]) * 0.4];
        return '<path d="M' + pt(wr0) + ' Q' + pt(c1) + ' ' + pt(q) + ' Q' + pt(c2) + ' ' + pt(wr1) + '" fill="none" stroke="' + COL.prop + '" stroke-width="1.5"/>'; }
      default: return '';
    }
  }

  /** Khung nhìn cố định cho cả chu kỳ (không nhảy hình). */
  function bounds(ex) {
    if (ex._vb) return ex._vb;
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    const grow = (p, r) => { x0 = Math.min(x0, p[0] - r); x1 = Math.max(x1, p[0] + r); y0 = Math.min(y0, p[1] - r); y1 = Math.max(y1, p[1] + r); };
    for (let i = 0; i < 48; i++) {
      const P = poseAt(ex, i / 48), S = skel(P, ex), cx = P.hx, M = (p) => mirrorPt(p, P.face < 0 ? -1 : 1, cx);
      [S.hip, S.sho].forEach((p) => grow(M(p), 3)); grow(M(S.head), L.head + 2);
      S.legs.forEach((g) => [g.kn, g.an, g.ft, g.heel].forEach((p) => grow(M(p), 3)));
      S.arms.forEach((a) => [a.el, a.wr].forEach((p) => grow(M(p), 6)));
      if (P.ball && P.bf > 0) grow(P.ball, 6);
    }
    (ex.props || []).forEach((pr) => {
      if (pr.type === 'box') { grow([pr.x, (pr.y || 0) + pr.h], 1); grow([pr.x + pr.w, 0], 1); }
      if (pr.type === 'cable' || pr.type === 'landmine') grow([pr.x, pr.y || 0], 4);
      if (pr.type === 'bar') { grow([pr.x1, pr.y], 3); grow([pr.x2, pr.y], 3); }
      if (pr.type === 'cone' || pr.type === 'wall') grow([pr.x, 0], 4);
      if (pr.type === 'bag') { grow([pr.x, 110], 1); grow([pr.x + 14, 30], 1); }
      if (pr.type === 'band' && pr.to) grow(pr.to, 3);
    });
    y0 = Math.min(y0, -4);
    const padX = 10, padY = 8;
    let w = x1 - x0 + 2 * padX, h = y1 - y0 + 2 * padY;
    const want = 1.6;                                               // khung ngang 16:10
    if (w / h < want) { const nw = h * want; x0 -= (nw - w) / 2; w = nw; } else { const nh = w / want; y1 += (nh - h); h = nh; }
    ex._vb = [x0 - padX, -(y1 + padY), w, h];
    return ex._vb;
  }

  function svgFor(ex, u) {
    const vb = bounds(ex);
    const gx0 = vb[0], gx1 = vb[0] + vb[2];
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + vb.map(f1).join(' ') + '" class="exa-svg" role="img" aria-hidden="true">'
      + '<line x1="' + f1(gx0) + '" y1="0" x2="' + f1(gx1) + '" y2="0" stroke="' + COL.ground + '" stroke-width="1.2"/>'
      + '<g class="exa-fr">' + frame(ex, u) + '</g></svg>';
  }

  // ── Chạy hình: một vòng rAF chung, chỉ vẽ hình đang trong màn hình, dừng khi bị gỡ khỏi trang ──
  const live = new Set();
  let raf = 0;
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function tick(now) {
    raf = 0;
    live.forEach((it) => {
      if (!it.el.isConnected) { live.delete(it); if (it.io) it.io.disconnect(); return; }
      if (!it.vis) return;
      const u = ((now - it.t0) / it.ex.ms) % 1;
      it.g.innerHTML = frame(it.ex, u);
    });
    if (live.size) raf = requestAnimationFrame(tick);
  }
  /** Gắn hình động của bài `name` vào phần tử `el`. Trả false nếu bài chưa có hình. */
  function mount(el, name) {
    const ex = find(name);
    if (!ex || !el) return false;
    el.innerHTML = svgFor(ex, reduce ? 0.35 : 0);
    if (reduce) return true;
    const it = { el, ex, g: el.querySelector('.exa-fr'), t0: performance.now(), vis: true };
    if (typeof IntersectionObserver === 'function') {
      it.io = new IntersectionObserver((es) => { it.vis = es.some((e) => e.isIntersecting); if (it.vis && !raf) raf = requestAnimationFrame(tick); });
      it.io.observe(el);
    }
    live.add(it);
    if (!raf) raf = requestAnimationFrame(tick);
    return true;
  }
  const key = (n) => String(n || '').trim().toLowerCase();
  function find(name) { const k = key(name); return EX[k] || EX[ALIAS[k]] || null; }

  // ── Dữ liệu ─────────────────────────────────────────────────────────────
  const STAND = { hx: 0, hy: 46, t: 2, s: [6, -6], e: [14, 14], F: [[2, 2], [-2, 2]], p: [0, 0] };
  const S = (o) => Object.assign({ _s: true }, o);                   // tư thế đầu tiên tạo bằng S() = bắt đầu từ dáng đứng
  // Chu kỳ chạy (FK): A = chân gần đưa tới, B = chân xa đưa tới.
  function runCycle(amp, lean, opt) {
    const a = amp, o = opt || {};
    const A = { t: lean, h: [55 * a + lean, -22 * a + lean], k: [80 * a, 25 * a], p: [10, 30], s: [-45 * a + lean, 55 * a + lean], e: [90, 90], hy: 47 + (o.air || 2) };
    const M1 = { t: lean, h: [15 + lean, 5 + lean], k: [15, 100 * a], p: [0, 20], s: [5 + lean, 0 + lean], e: [90, 90], hy: 44.5 };
    const B = { t: lean, h: [-22 * a + lean, 55 * a + lean], k: [25 * a, 80 * a], p: [30, 10], s: [55 * a + lean, -45 * a + lean], e: [90, 90], hy: 47 + (o.air || 2) };
    const M2 = { t: lean, h: [5 + lean, 15 + lean], k: [100 * a, 15], p: [20, 0], s: [0 + lean, 5 + lean], e: [90, 90], hy: 44.5 };
    return [A, M1, B, M2];
  }
  const RUN_FK = { h: [0, 0], k: [0, 0] };

  const EX = {
    'deadlift (trap bar)': { v: 'side', ms: 3600, props: [{ type: 'plate', at: 'wr0', r: 9 }],
      kf: [S({ hx: -14, hy: 29, t: 50, s: [50, 50], e: [0, 0], F: [[4, 2], [0, 2]] }), S({ hx: 0, hy: 46, t: 2, s: [2, 2], e: [0, 0], d: 1.1 }), S({ d: 0.35 }), S({ hx: -14, hy: 29, t: 50, s: [50, 50], d: 1.2 }), S({ hx: -14, hy: 29, t: 50, s: [50, 50], d: 0.3 })],
      cue: { vi: 'Đẩy sàn bằng cả bàn chân, lưng thẳng, hông và vai lên cùng lúc.', en: 'Push the floor away, flat back, hips and shoulders rise together.' } },
    'front squat (barbell)': { v: 'side', ms: 3600, props: [{ type: 'plate', at: 'sho', dx: 4, dy: 1, r: 9 }],
      kf: [S({ hx: 0, hy: 46, t: 4, s: [99, 99], e: [150, 150], F: [[4, 2], [0, 2]] }), S({ hx: -9, hy: 21, t: 20, s: [115, 115], d: 1.3 }), S({ hx: -9, hy: 21, t: 20, s: [115, 115], d: 0.25 }), S({ hx: 0, hy: 46, t: 4, s: [99, 99], d: 1.1 }), S({ hx: 0, hy: 46, t: 4, s: [99, 99], d: 0.35 })],
      cue: { vi: 'Khuỷu tay cao, ngực mở, gối đi theo hướng mũi chân.', en: 'Elbows high, chest up, knees track over the toes.' } },
    'bulgarian split squat': { v: 'side', ms: 3400, kb: 1, props: [{ type: 'box', x: -44, w: 18, h: 20 }],
      kf: [S({ hx: -6, hy: 44, t: 6, F: [[12, 2], [-34, 23]], p: [0, 175], s: [4, 4], e: [10, 10] }), S({ hx: -9, hy: 24, t: 14, d: 1.3 }), S({ hx: -9, hy: 24, t: 14, d: 0.25 }), S({ hx: -6, hy: 44, t: 6, d: 1.1 }), S({ hx: -6, hy: 44, t: 6, d: 0.3 })],
      cue: { vi: 'Hạ thẳng xuống, gối sau gần chạm sàn, đẩy lên bằng gót chân trước.', en: 'Drop straight down, back knee near the floor, drive up through the front heel.' } },
    'standing landmine shoulder press (barbell)': { v: 'side', ms: 2800, props: [{ type: 'landmine', x: 76 }],
      kf: [S({ hx: -2, hy: 45, t: 8, F: [[8, 2], [-14, 2]], W: [[10, 70], [-4, 30]] }), S({ W: [[26, 96], [-4, 30]], d: 0.9 }), S({ W: [[26, 96], [-4, 30]], d: 0.3 }), S({ W: [[10, 70], [-4, 30]], d: 1 })],
      cue: { vi: 'Thân cứng, đẩy tạ lên và ra trước, đưa vai tới cuối động tác.', en: 'Brace, press up and forward, let the shoulder blade reach at the end.' } },
    'pull-up': { v: 'side', ms: 3200, eb: -1, props: [{ type: 'bar', x1: -14, x2: 24, y: 116 }],
      kf: [{ hx: 2, hy: 54, t: -2, W: [[6, 113], [4, 113]], h: [8, 0], k: [35, 25], p: [40, 40] }, { hx: 1, hy: 76, t: 6, nk: -10, d: 1 }, { d: 0.3 }, { hx: 2, hy: 54, t: -2, nk: 0, d: 1.2 }],
      cue: { vi: 'Bắt đầu từ treo thẳng tay, kéo khuỷu xuống sườn tới cằm qua xà.', en: 'Start from a dead hang, pull elbows to the ribs until the chin clears the bar.' } },
    'med ball side throw (med ball)': { v: 'front', ms: 2600, props: [{ type: 'wall', x: 112, h: 120 }, { type: 'ball' }],
      kf: [{ hx: 0, hy: 42, t: -10, F: [[13, 2], [-13, 2]], W: [[-12, 38], [-16, 40]], bf: 0, ball: [104, 88] }, { hx: 4, hy: 44, t: 10, W: [[30, 80], [24, 82]], d: 0.45 }, { bf: 1, d: 0.35 }, { hx: 0, hy: 44, t: 0, W: [[8, 50], [-8, 50]], bf: 1, d: 0.6 }, { bf: 0, W: [[2, 60], [-2, 60]], d: 0.3 }, { hx: 0, hy: 42, t: -10, W: [[-12, 38], [-16, 40]], d: 0.7 }],
      cue: { vi: 'Xoay từ hông và chân sau, ném bóng ngang vào tường thật nhanh.', en: 'Rotate from the back hip and leg, throw the ball sideways into the wall fast.' } },
    'shot put throw (med ball)': { v: 'side', ms: 2600, props: [{ type: 'ball' }],
      kf: [{ hx: -4, hy: 42, t: -6, F: [[10, 2], [-16, 2]], p: [0, 0], W: [[10, 78], [6, 72]], bf: 0, ball: [104, 106] }, { hx: 4, hy: 45, t: 16, W: [[34, 90], [22, 74]], p: [0, 35], d: 0.4 }, { bf: 1, d: 0.35 }, { hx: 0, hy: 44, t: 4, W: [[8, 40], [2, 42]], p: [0, 0], bf: 1, d: 0.6 }, { bf: 0, W: [[10, 78], [6, 72]], d: 0.2 }, { hx: -4, hy: 42, t: -6, d: 0.6 }],
      cue: { vi: 'Bóng sát vai, xoay hông rồi đẩy bóng như đẩy tạ, chân sau đạp sàn.', en: 'Ball at the shoulder, turn the hips and put it like a shot, back foot drives.' } },
    'landmine twist': { v: 'front', ms: 3000, props: [{ type: 'landmine', x: 0, hand: 'mid' }],
      kf: [{ hx: 0, hy: 44, t: -6, F: [[11, 2], [-11, 2]], W: [[-20, 60], [-26, 62]] }, { t: 0, W: [[3, 82], [-3, 82]], d: 0.8 }, { t: 6, W: [[26, 62], [20, 60]], d: 0.8 }, { t: 0, W: [[3, 82], [-3, 82]], d: 0.8 }, { t: -6, W: [[-20, 60], [-26, 62]], d: 0.8 }],
      cue: { vi: 'Tay gần thẳng, xoay bằng thân và hông, vẽ cầu vồng từ hông này sang hông kia.', en: 'Arms nearly straight, turn through trunk and hips, draw a rainbow hip to hip.' } },
    'box jump': { v: 'side', ms: 3400, props: [{ type: 'box', x: 36, w: 30, h: 28 }],
      kf: [S({ o: 0, d: 0.15 }), S({ o: 1, d: 0.15 }), S({ hx: -6, hy: 33, t: 38, s: [-20, -20], F: [[2, 2], [-2, 2]], d: 0.55 }), S({ hx: 4, hy: 50, t: 10, s: [165, 165], F: [[3, 4], [-1, 4]], p: [45, 45], d: 0.22 }),
        S({ hx: 30, hy: 72, t: 18, s: [100, 100], F: [[34, 48], [30, 48]], p: [20, 20], d: 0.3 }), S({ hx: 46, hy: 58, t: 32, s: [70, 70], F: [[52, 30], [48, 30]], p: [0, 0], d: 0.3 }),
        S({ hx: 48, hy: 74, t: 3, s: [6, -6], d: 0.6 }), S({ hx: 48, hy: 74, t: 3, s: [6, -6], d: 0.4 }), S({ hx: 48, hy: 74, t: 3, s: [6, -6], o: 0, d: 0.25 })],
      cue: { vi: 'Vung tay, bật hết sức, tiếp đất NHẸ trên hộp ở tư thế squat. Bước xuống, không nhảy xuống.', en: 'Swing the arms, jump hard, land SOFT on the box in a squat. Step down, do not jump down.' } },
    'plyometric push up (bodyweight)': { v: 'side', ms: 2400, eb: -1,
      kf: [{ hx: -28, hy: 20, t: 68, F: [[-70, 8.5], [-71, 8.5]], p: [72, 72], W: [[0, 2], [2, 2]] }, { hx: -25, hy: 7.5, t: 84, d: 0.8 }, { hx: -29, hy: 27, t: 60, W: [[3, 14], [5, 14]], d: 0.35 }, { hx: -28, hy: 20, t: 68, W: [[0, 2], [2, 2]], d: 0.35 }, { d: 0.4 }],
      cue: { vi: 'Hạ người có kiểm soát, đẩy bùng nổ cho tay rời sàn, tiếp đất mềm khuỷu.', en: 'Lower under control, push explosively so the hands leave the floor, land with soft elbows.' } },
    'pallof press (cable)': { v: 'side', ms: 3000, props: [{ type: 'cable', x: -46, y: 70, hand: 'mid' }],
      kf: [S({ hx: 0, hy: 44, t: 2, F: [[6, 2], [-6, 2]], W: [[10, 70], [8, 70]] }), S({ W: [[32, 70], [30, 70]], d: 0.8 }), S({ W: [[32, 70], [30, 70]], d: 0.7 }), S({ W: [[10, 70], [8, 70]], d: 0.8 })],
      cue: { vi: 'Đứng nghiêng với máy cáp, đẩy tay thẳng ra trước và GIỮ, không để thân bị kéo xoay.', en: 'Stand side-on to the cable, press straight out and HOLD — do not let it twist you.' } },
    'wood chop (cable machine)': { v: 'front', ms: 2800, props: [{ type: 'cable', x: -64, y: 112, hand: 'mid' }],
      kf: [{ hx: 0, hy: 44, t: -8, F: [[12, 2], [-12, 2]], W: [[-18, 92], [-24, 94]] }, { hx: 2, hy: 40, t: 10, W: [[26, 42], [20, 40]], d: 0.6 }, { d: 0.3 }, { hx: 0, hy: 44, t: -8, W: [[-18, 92], [-24, 94]], d: 1 }],
      cue: { vi: 'Kéo chéo từ trên cao xuống hông bên kia, xoay hông và chân sau theo.', en: 'Chop diagonally high to the opposite hip, turning the hips and back foot with it.' } },
    'dead bug (bodyweight)': { v: 'side', ms: 3200,
      kf: [{ hx: 0, hy: 5, t: -90, nk: 0, s: [90, 90], e: [0, 0], h: [90, 90], k: [90, 90], p: [0, 0] }, { s: [175, 90], h: [90, 15], k: [90, 5], d: 0.9 }, { d: 0.3 }, { s: [90, 90], h: [90, 90], k: [90, 90], d: 0.8 }, { s: [90, 175], h: [15, 90], k: [5, 90], d: 0.9 }, { d: 0.3 }, { s: [90, 90], h: [90, 90], k: [90, 90], d: 0.8 }],
      cue: { vi: 'Lưng dưới ép sàn suốt bài, duỗi tay – chân đối bên chậm, thở ra khi duỗi.', en: 'Low back pressed to the floor, extend opposite arm and leg slowly, exhale as you reach.' } },
    'side plank (bodyweight)': { v: 'side', ms: 3400,
      kf: [{ hx: -1.5, hy: 5, t: -67, s: [-67, 30], e: [90, 0], F: [[44, 3], [44, 6]], p: [10, 10] }, { hx: 0, hy: 11.5, t: -79, s: [-79, 101], d: 0.9 }, { d: 1.2 }, { hx: -1.5, hy: 5, t: -67, s: [-67, 30], d: 0.9 }],
      cue: { vi: 'Khuỷu dưới vai, đẩy hông lên thành một đường thẳng từ đầu tới gót.', en: 'Elbow under the shoulder, lift the hips into one straight line head to heels.' } },
    'face pull': { v: 'side', ms: 2800, eb: 1, props: [{ type: 'cable', x: 66, y: 88, hand: 'mid' }],
      kf: [S({ hx: 0, hy: 45, t: -5, F: [[8, 2], [-8, 2]], W: [[30, 84], [28, 84]] }), S({ W: [[8, 84], [6, 84]], d: 0.8 }), S({ d: 0.4 }), S({ W: [[30, 84], [28, 84]], d: 0.9 })],
      cue: { vi: 'Kéo dây về ngang mặt, khuỷu cao, xoay tay ra sau như khoe bắp tay.', en: 'Pull the rope to the face, elbows high, rotate the hands back like a double-biceps pose.' } },
    'external rotation (cable)': { v: 'front', ms: 2600, props: [{ type: 'cable', x: -62, y: 58 }],
      kf: [{ hx: 0, hy: 45, t: 0, F: [[9, 2], [-9, 2]], s: [6, 8], e: [-80, 10] }, { e: [70, 10], d: 0.9 }, { d: 0.3 }, { e: [-80, 10], d: 1 }],
      cue: { vi: 'Khuỷu áp sát sườn (kẹp khăn), chỉ cẳng tay xoay ra ngoài, chậm.', en: 'Elbow pinned to the side (towel), only the forearm rotates out, slowly.' } },
    'push up plus (bodyweight)': { v: 'side', ms: 2600, eb: -1,
      kf: [{ hx: -28, hy: 20, t: 68, F: [[-70, 8.5], [-71, 8.5]], p: [72, 72], W: [[0, 2], [2, 2]] }, { hx: -27, hy: 22.5, t: 66, d: 0.7 }, { d: 0.4 }, { hx: -28, hy: 20, t: 68, d: 0.7 }],
      cue: { vi: 'Tay thẳng, đẩy sàn ra xa để lưng trên gồ lên (xương bả vai ôm sườn), rồi thả về.', en: 'Arms straight, push the floor away so the upper back rounds (blades wrap the ribs), then return.' } },
    'neck isometric hold (bodyweight)': { v: 'side', ms: 4400, eb: -1,
      kf: [S({ W: [[12, 88], [-2, 30]] }), S({ d: 1.2 }), S({ W: [[-6, 88], [-2, 30]], d: 0.6 }), S({ d: 1.2 }), S({ W: [[12, 88], [-2, 30]], d: 0.6 })],
      cue: { vi: 'Tay đẩy nhẹ vào trán / sau đầu, cổ giữ yên không cho đầu nhúc nhích. 4 hướng.', en: 'Press gently on the forehead / back of the head, the neck holds still. Four directions.' } },
    "farmer's carry (dumbbell)": { v: 'side', ms: 1300, props: [{ type: 'db' }],
      kf: [{ hx: 0, hy: 46, t: 0, h: [22, -14], k: [8, 10], p: [10, 25], s: [2, -2], e: [0, 0] }, { hy: 44.5, h: [4, 4], k: [5, 45], p: [0, 10] }, { hy: 46, h: [-14, 22], k: [10, 8], p: [25, 10] }, { hy: 44.5, h: [4, 4], k: [45, 5], p: [10, 0] }],
      cue: { vi: 'Tạ nặng hai tay, đứng thẳng, vai không xệ, bước ngắn đều.', en: 'Heavy weights in both hands, tall posture, shoulders level, short even steps.' } },
    'interval bao cát / assault bike': { v: 'side', ms: 1500, eb: -1, props: [{ type: 'bag', x: 36 }],
      kf: [S({ hx: -4, hy: 44, t: 6, F: [[8, 2], [-16, 5]], p: [20, 30], W: [[10, 84], [8, 80]] }), S({ W: [[34, 84], [8, 80]], d: 0.35 }), S({ W: [[10, 84], [8, 80]], d: 0.35 }), S({ t: 12, W: [[10, 84], [34, 82]], p: [20, 45], d: 0.35 }), S({ t: 6, W: [[10, 84], [8, 80]], p: [20, 30], d: 0.45 })],
      cue: { vi: 'Đánh theo hiệp đúng thời gian thi đấu, nghỉ đúng 1 phút giữa hiệp.', en: 'Work rounds as long as fight rounds, rest exactly one minute between.' } },
    'sprint (bodyweight)': { v: 'side', ms: 620, kf: runCycle(1, 14, { air: 4 }),
      cue: { vi: 'Hết tốc lực, ngả người tới, đánh tay mạnh, nghỉ đủ giữa các lần.', en: 'All-out, lean forward, drive the arms, full rest between reps.' } },
    'jump rope': { v: 'side', ms: 520, props: [{ type: 'rope', dx: -2 }],
      kf: [S({ hy: 47, W: [[10, 50], [6, 50]], F: [[3, 3], [-1, 3]], p: [40, 40], rp: 0 }), S({ hy: 50, F: [[3, 7], [-1, 7]], p: [55, 55], rp: 180 }), S({ hy: 47, F: [[3, 3], [-1, 3]], p: [40, 40], rp: 360, d: 1 })],
      cue: { vi: 'Nảy nhẹ trên mũi chân, cổ tay quay dây, khuỷu sát người.', en: 'Light bounces on the balls of the feet, turn the rope with the wrists, elbows in.' } },
    'chạy nhẹ (nói chuyện được)': { v: 'side', ms: 820, kf: runCycle(0.55, 6, { air: 1 }),
      cue: { vi: 'Đủ nhẹ để vẫn nói chuyện được — nền aerobic, không phải tập nặng.', en: 'Easy enough to hold a conversation — aerobic base, not a hard session.' } },
    'high bar squat (barbell)': { v: 'side', ms: 3600, props: [{ type: 'plate', at: 'sho', dx: -2, dy: 2, r: 9 }],
      kf: [S({ hx: 0, hy: 46, t: 6, s: [-28, -28], e: [150, 150], F: [[4, 2], [0, 2]] }), S({ hx: -13, hy: 21, t: 34, s: [-4, -4], d: 1.3 }), S({ hx: -13, hy: 21, t: 34, s: [-4, -4], d: 0.25 }), S({ hx: 0, hy: 46, t: 6, s: [-28, -28], d: 1.1 }), S({ d: 0.35 })],
      cue: { vi: 'Thân gồng, ngồi xuống giữa hai gót, đẩy sàn đứng lên, gối không đổ vào trong.', en: 'Brace, sit down between the heels, push the floor away, knees do not cave in.' } },
    'romanian deadlift': { v: 'side', ms: 3600, props: [{ type: 'plate', at: 'wr0', r: 9 }],
      kf: [S({ hx: 0, hy: 46, t: 3, s: [3, 3], e: [0, 0], F: [[5, 2], [1, 2]] }), S({ hx: -13, hy: 43, t: 68, s: [68, 68], d: 1.4 }), S({ d: 0.25 }), S({ hx: 0, hy: 46, t: 3, s: [3, 3], d: 1.1 }), S({ d: 0.3 })],
      cue: { vi: 'Đẩy hông ra sau, gối hơi chùng, tạ trượt sát đùi, căng đùi sau rồi kéo hông về.', en: 'Push the hips back, soft knees, bar close to the legs, feel the hamstrings then drive the hips through.' } },
    'hip thrust (barbell)': { v: 'side', ms: 3000, kb: 1, props: [{ type: 'box', x: -44, w: 16, h: 18 }, { type: 'plate', at: 'hip', dy: 6, r: 9, front: true }],
      kf: [{ hx: -8, hy: 8, t: -57, nk: 30, F: [[14, 2], [10, 2]], p: [0, 0], W: [[-4, 15], [-6, 15]] }, { hx: -4, hy: 24, t: -94, nk: 20, W: [[-1, 31], [-3, 31]], d: 0.9 }, { d: 0.45 }, { hx: -8, hy: 8, t: -57, nk: 30, W: [[-4, 15], [-6, 15]], d: 1 }],
      cue: { vi: 'Vai tựa ghế, cằm thu, siết mông đẩy hông lên tới thân song song sàn.', en: 'Upper back on the bench, chin tucked, squeeze the glutes until the trunk is level.' } },
    'seated calf raise (machine)': { v: 'side', ms: 2600, props: [{ type: 'box', x: -32, w: 20, h: 28 }, { type: 'box', x: 4, w: 16, h: 8 }, { type: 'kneepad', front: true }],
      kf: [{ hx: -18, hy: 33, t: 4, F: [[6, 10], [3, 10]], p: [-18, -18], s: [40, 40], e: [60, 60] }, { hy: 37, F: [[6, 15], [3, 15]], p: [38, 38], d: 0.8 }, { d: 0.4 }, { hy: 33, F: [[6, 10], [3, 10]], p: [-18, -18], d: 1.2 }],
      cue: { vi: 'Gối gập 90° để tập cơ dép — xuống hết tầm (gót thấp), lên hết mũi chân, tạ nặng.', en: 'Knees at 90° to target the soleus — full stretch down, all the way up, go heavy.' } },
    'standing calf raise (machine)': { v: 'side', ms: 2600, props: [{ type: 'box', x: 0, w: 16, h: 8 }, { type: 'shoulderpad', front: true }],
      kf: [S({ hx: -6, hy: 53, t: 0, F: [[-4, 10], [-6, 10]], p: [-18, -18], s: [-30, -30], e: [140, 140] }), S({ hy: 59, F: [[-4, 16], [-6, 16]], p: [38, 38], d: 0.8 }), S({ d: 0.4 }), S({ hy: 53, F: [[-4, 10], [-6, 10]], p: [-18, -18], d: 1.2 })],
      cue: { vi: 'Gối thẳng (bắp chân), mũi chân trên mép bục, xuống sâu rồi nhón hết cỡ.', en: 'Straight knees (gastrocnemius), balls of the feet on the edge, deep stretch then full raise.' } },
    'eccentric heel drop (bodyweight)': { v: 'side', ms: 3600, props: [{ type: 'box', x: 0, w: 16, h: 8 }],
      kf: [S({ hx: -6, hy: 59, t: 0, F: [[-4, 16], [-10, 26]], p: [38, 0], s: [30, 30], e: [30, 30] }), S({ hy: 51, F: [[-4, 10], [-10, 26]], p: [-20, 0], d: 2.2 }), S({ hy: 51, d: 0.3 }), S({ hy: 59, F: [[-4, 16], [-10, 26]], p: [38, 0], d: 0.6 })],
      cue: { vi: 'Lên bằng hai chân, hạ CHẬM 3–4 giây bằng một chân xuống dưới mép bục.', en: 'Rise on both feet, lower SLOWLY over 3–4 s on one leg below the step edge.' } },
    'tibialis raise (bodyweight)': { v: 'side', ms: 2200, props: [{ type: 'wall', x: -20, h: 110 }],
      kf: [S({ hx: -14, hy: 44, t: -6, F: [[10, 2], [8, 2]], p: [0, 0], s: [0, 0] }), S({ p: [-38, -38], F: [[10, 4], [8, 4]], d: 0.7 }), S({ d: 0.3 }), S({ p: [0, 0], F: [[10, 2], [8, 2]], d: 0.8 })],
      cue: { vi: 'Lưng tựa tường, gót ra trước, kéo mũi chân lên hết cỡ rồi hạ chậm.', en: 'Back on the wall, heels out front, pull the toes up hard then lower slowly.' } },
    'pogo jump (bodyweight)': { v: 'side', ms: 460,
      kf: [S({ hy: 47, F: [[3, 3], [-1, 3]], p: [40, 40], s: [10, 10], e: [60, 60] }), S({ hy: 53, F: [[3, 9], [-1, 9]], p: [55, 55], d: 1 })],
      cue: { vi: 'Gối gần như thẳng, nảy bằng cổ chân, chạm đất thật ngắn như lò xo.', en: 'Knees nearly straight, bounce from the ankles, ground contact short like a spring.' } },
    'bounding (bodyweight)': { v: 'side', ms: 1500,
      kf: [{ hx: 0, hy: 46, t: 12, h: [70, -20], k: [70, 10], p: [10, 30], s: [-50, 60], e: [90, 90], o: 0, d: 0.1 }, { o: 1, d: 0.1 }, { hx: 26, hy: 54, t: 12, h: [-20, 70], k: [10, 70], p: [30, 10], s: [60, -50], d: 1 }, { hx: 52, hy: 46, t: 12, h: [70, -20], k: [70, 10], p: [10, 30], s: [-50, 60], d: 1 }, { hx: 78, hy: 54, h: [-20, 70], k: [10, 70], p: [30, 10], s: [60, -50], d: 1 }, { hx: 92, hy: 48, o: 0, d: 0.35 }],
      cue: { vi: 'Sải dài, bay cao, gối trước kéo lên, đạp mạnh chân sau — mỗi bước là một cú bật.', en: 'Long strides, big air, drive the front knee, push hard off the back leg — every step is a jump.' } },
    'single leg hop (bodyweight)': { v: 'side', ms: 1700,
      kf: [{ hx: 0, hy: 44, t: 18, F: [[2, 2], [-6, 20]], p: [0, 0], s: [-30, -30], e: [40, 40], o: 0, d: 0.1 }, { o: 1, d: 0.12 }, { hx: 14, hy: 54, t: 10, F: [[16, 10], [8, 24]], p: [40, 0], s: [70, 70], d: 0.35 }, { hx: 28, hy: 40, t: 22, F: [[30, 2], [22, 20]], p: [0, 0], s: [20, 20], d: 0.35 }, { hx: 44, hy: 54, t: 10, F: [[46, 10], [38, 24]], p: [40, 0], s: [70, 70], d: 0.35 }, { hx: 58, hy: 40, t: 22, F: [[60, 2], [52, 20]], p: [0, 0], s: [20, 20], d: 0.35 }, { o: 0, d: 0.3 }],
      cue: { vi: 'Nhảy liên tục trên một chân, tiếp đất êm, gối thẳng hàng mũi chân.', en: 'Continuous hops on one leg, land softly, knee in line with the toes.' } },
    'single leg deadlift (kettlebell)': { v: 'side', ms: 3600, props: [{ type: 'kb', hand: 1 }],
      kf: [{ hx: 0, hy: 45, t: 3, F: [[2, 2], [-4, 8]], p: [0, 30], s: [8, 3], e: [10, 0] }, { hx: -6, hy: 43, t: 80, F: [[2, 2], [-50, 40]], p: [0, 80], s: [60, 80], d: 1.4 }, { d: 0.3 }, { hx: 0, hy: 45, t: 3, F: [[2, 2], [-4, 8]], p: [0, 30], s: [8, 3], d: 1.2 }],
      cue: { vi: 'Hông hai bên ngang nhau, chân sau duỗi thẳng thành đường với thân, gối trụ hơi chùng.', en: 'Hips square, back leg in one line with the trunk, standing knee soft.' } },
    'step down (bodyweight)': { v: 'side', ms: 3200, props: [{ type: 'box', x: -22, w: 30, h: 16 }],
      kf: [{ hx: 0, hy: 62, t: 3, F: [[0, 18], [6, 22]], p: [0, 10], s: [20, 20], e: [20, 20] }, { hx: -7, hy: 43, t: 22, F: [[0, 18], [12, 3]], p: [0, -15], s: [50, 50], d: 1.6 }, { d: 0.2 }, { hx: 0, hy: 62, t: 3, F: [[0, 18], [6, 22]], p: [0, 10], s: [20, 20], d: 1 }],
      cue: { vi: 'Hạ CHẬM chân kia xuống chạm gót, gối trụ không đổ vào trong, hông không xệ.', en: 'Lower the other heel SLOWLY to tap, standing knee stays out, hips stay level.' } },
    'lateral band walk (band)': { v: 'front', ms: 2600, props: [{ type: 'band' }],
      kf: [{ hx: -10, hy: 40, t: 4, F: [[-2, 2], [-18, 2]], p: [0, 0], s: [30, 30], e: [70, 70] }, { hx: -4, hy: 41, F: [[10, 4], [-18, 2]], d: 0.5 }, { hx: 2, hy: 40, F: [[10, 2], [-6, 2]], d: 0.5 }, { hx: 8, hy: 41, F: [[22, 4], [-6, 2]], d: 0.5 }, { hx: 14, hy: 40, F: [[22, 2], [6, 2]], d: 0.5 },
        { hx: 8, hy: 41, F: [[22, 2], [-6, 4]], d: 0.5 }, { hx: 2, hy: 40, F: [[10, 2], [-6, 2]], d: 0.5 }, { hx: -4, hy: 41, F: [[10, 2], [-18, 4]], d: 0.5 }, { hx: -10, hy: 40, F: [[-2, 2], [-18, 2]], d: 0.5 }],
      cue: { vi: 'Nửa squat, dây căng suốt, bước ngang ngắn, mũi chân hướng trước.', en: 'Half squat, band tight the whole time, short side steps, toes forward.' } },
    'copenhagen plank (bodyweight)': { v: 'side', ms: 3400, props: [{ type: 'box', x: 34, w: 22, h: 21 }],
      kf: [{ hx: 1, hy: 20, t: -95.5, s: [-95.5, 40], e: [90, 0], h: [-29.5, 0], k: [0, 0], p: [10, 10] }, { h: [-8, 0], d: 1 }, { d: 1 }, { h: [-29.5, 0], d: 1 }],
      cue: { vi: 'Chân trên gác ghế (đùi trong chịu lực), nâng hông thẳng, chân dưới đưa lên chạm ghế.', en: 'Top leg on the bench (inner thigh takes the load), lift the hips, bring the bottom leg up.' } },
    'back extension': { v: 'side', ms: 3000, props: [{ type: 'box', x: -36, w: 8, h: 14 }, { type: 'box', x: 2, w: 8, h: 38 }],
      kf: [{ hx: 0, hy: 42, t: 47, nk: 0, F: [[-30, 14], [-32, 14]], p: [60, 60], s: [150, 150], e: [150, 150] }, { t: 150, nk: 20, d: 1.2 }, { d: 0.25 }, { t: 47, nk: 0, d: 1 }, { d: 0.35 }],
      cue: { vi: 'Gập ở hông, lên tới thân thẳng hàng chân — không ưỡn quá, siết mông ở trên.', en: 'Hinge at the hips, rise to a straight line with the legs — no over-arching, squeeze the glutes.' } },
    'nordic curl (bodyweight)': { v: 'side', ms: 3800, kb: 1, props: [{ type: 'anchor' }],
      kf: [{ hx: 0, hy: 27, t: 0, F: [[-22, 4], [-23, 4]], p: [180, 180], s: [40, 40], e: [120, 120] }, { hx: 21.6, hy: 12, t: 70, s: [115, 115], e: [0, 0], d: 1.9 }, { hx: 22.5, hy: 8.8, t: 78, s: [130, 130], e: [40, 40], d: 0.35 }, { hx: 21.6, hy: 12, t: 70, s: [115, 115], e: [0, 0], d: 0.4 }, { hx: 0, hy: 27, t: 0, s: [40, 40], e: [120, 120], d: 1 }],
      cue: { vi: 'Quỳ, cổ chân được giữ chặt, đổ người tới CHẬM bằng đùi sau, chống tay rồi đẩy về.', en: 'Kneel with ankles held, lower forward SLOWLY with the hamstrings, catch with the hands, push back.' } },
    'drop landing (bodyweight)': { v: 'side', ms: 3000, props: [{ type: 'box', x: -36, w: 30, h: 26 }],
      kf: [{ hx: -20, hy: 72, t: 2, F: [[-17, 28], [-21, 28]], p: [0, 0], s: [6, -6], e: [14, 14], o: 0, d: 0.1 }, { o: 1, d: 0.15 }, { hx: -4, hy: 66, t: 4, F: [[2, 36], [-10, 30]], p: [20, 0], d: 0.35 }, { hx: 6, hy: 50, F: [[12, 8], [8, 8]], p: [25, 25], s: [40, 40], d: 0.25 }, { hx: 0, hy: 28, t: 34, F: [[12, 2], [8, 2]], p: [0, 0], s: [60, 60], d: 0.25 }, { d: 0.9 }, { hx: 6, hy: 46, t: 3, s: [6, -6], d: 0.6 }, { o: 0, d: 0.3 }],
      cue: { vi: 'Bước khỏi hộp, tiếp đất hai chân êm như mèo, gối thẳng hàng mũi chân, GIỮ 2 giây.', en: 'Step off, land on both feet soft as a cat, knees over the toes, HOLD 2 s.' } },
    'countermovement jump (bodyweight)': { v: 'side', ms: 2400,
      kf: [S({}), S({ hx: -6, hy: 32, t: 38, s: [-25, -25], d: 0.6 }), S({ hx: 0, hy: 52, t: 4, s: [170, 170], F: [[2, 8], [-2, 8]], p: [40, 40], d: 0.25 }), S({ hx: 0, hy: 66, t: 2, s: [160, 160], F: [[2, 22], [-2, 22]], p: [30, 30], d: 0.25 }), S({ hx: 0, hy: 50, t: 4, s: [90, 90], F: [[2, 6], [-2, 6]], p: [25, 25], d: 0.25 }), S({ hx: -5, hy: 32, t: 32, s: [50, 50], F: [[2, 2], [-2, 2]], p: [0, 0], d: 0.25 }), S({ d: 0.6 })],
      cue: { vi: 'Hạ nhanh rồi bật ngay, vung tay lên, tiếp đất mềm gối.', en: 'Dip fast and jump straight away, swing the arms up, land with soft knees.' } },
    'single leg hop and stick (bodyweight)': { v: 'side', ms: 2600,
      kf: [{ hx: 0, hy: 44, t: 16, F: [[2, 2], [-8, 22]], p: [0, 0], s: [-25, -25], e: [40, 40], o: 0, d: 0.1 }, { o: 1, d: 0.12 }, { hx: 0, hy: 38, t: 30, s: [-35, -35], d: 0.35 }, { hx: 16, hy: 56, t: 10, F: [[18, 12], [8, 26]], p: [40, 0], s: [80, 80], d: 0.3 }, { hx: 28, hy: 36, t: 30, F: [[32, 2], [20, 22]], p: [0, 0], s: [45, 45], d: 0.3 }, { d: 1 }, { o: 0, d: 0.3 }],
      cue: { vi: 'Nhảy tới trên một chân, tiếp đất và ĐỨNG YÊN 2 giây — gối không lắc vào trong.', en: 'Hop forward on one leg, land and FREEZE for 2 s — the knee must not wobble in.' } },
    'lateral bound (bodyweight)': { v: 'front', ms: 2600,
      kf: [{ hx: -28, hy: 36, t: 14, F: [[-24, 2], [-40, 14]], p: [0, 0], s: [40, 10], e: [60, 60] }, { d: 0.6 }, { hx: 0, hy: 60, t: 0, F: [[8, 22], [-8, 22]], s: [60, 60], d: 0.35 }, { hx: 28, hy: 36, t: -14, F: [[40, 14], [24, 2]], s: [10, 40], d: 0.35 }, { d: 0.6 }, { hx: 0, hy: 60, t: 0, F: [[8, 22], [-8, 22]], s: [60, 60], d: 0.35 }, { hx: -28, hy: 36, t: 14, F: [[-24, 2], [-40, 14]], s: [40, 10], d: 0.35 }],
      cue: { vi: 'Đạp mạnh sang ngang, tiếp đất bằng chân ngoài và giữ thăng bằng 1–2 giây.', en: 'Push hard sideways, land on the outside leg and balance for 1–2 s.' } },
    'sprint to stop (bodyweight)': { v: 'side', ms: 2400,
      kf: [Object.assign({ hx: 0, o: 0, d: 0.1 }, runCycle(1, 14)[0]), Object.assign({ hx: 4, o: 1, d: 0.1 }, runCycle(1, 14)[0]), Object.assign({ hx: 20, d: 0.25 }, runCycle(1, 14)[1]), Object.assign({ hx: 36, d: 0.25 }, runCycle(1, 14)[2]), Object.assign({ hx: 52, d: 0.25 }, runCycle(1, 14)[3]),
        { hx: 66, hy: 36, t: 6, h: [55, -15], k: [45, 60], p: [-10, 30], s: [40, -30], e: [80, 80], d: 0.3 }, { hx: 68, hy: 32, t: 14, h: [50, -10], k: [55, 75], p: [-5, 40], s: [50, 20], d: 0.25 }, { d: 0.6 }, { o: 0, d: 0.3 }],
      cue: { vi: 'Chạy nhanh rồi dừng trong 2–3 bước: hạ thấp người, bước ngắn dần, chân ra trước phanh.', en: 'Sprint then stop within 2–3 steps: get low, shorten the steps, feet out front to brake.' } },
    'pro agility shuttle (bodyweight)': { v: 'side', ms: 3600, props: [{ type: 'cone', x: -46 }, { type: 'cone', x: 0 }, { type: 'cone', x: 46 }],
      kf: [Object.assign({ hx: 0, face: 1 }, runCycle(1, 14)[0]), Object.assign({ hx: 18, d: 0.3 }, runCycle(1, 14)[2]), { hx: 38, hy: 30, t: 50, h: [80, 10], k: [70, 60], p: [0, 30], s: [60, 20], e: [10, 60], face: 1, d: 0.35 }, Object.assign({ hx: 30, face: -1, d: 0.25 }, runCycle(1, 14)[0]),
        Object.assign({ hx: 0, face: -1, d: 0.35 }, runCycle(1, 14)[2]), Object.assign({ hx: -26, face: -1, d: 0.35 }, runCycle(1, 14)[0]), { hx: -38, hy: 30, t: 50, h: [80, 10], k: [70, 60], p: [0, 30], s: [60, 20], e: [10, 60], face: -1, d: 0.35 }, Object.assign({ hx: -30, face: 1, d: 0.25 }, runCycle(1, 14)[2]), Object.assign({ hx: -12, face: 1, d: 0.3 }, runCycle(1, 14)[0])],
      cue: { vi: '5 m sang một bên chạm vạch, 10 m quay ngược chạm vạch, 5 m về giữa. Hạ thấp khi đổi hướng.', en: '5 m one way and touch, 10 m back and touch, 5 m through the middle. Get low on each turn.' } },
    'side lunge (dumbbell)': { v: 'front', ms: 3800, props: [{ type: 'db' }],
      kf: [{ hx: 0, hy: 46, t: 0, F: [[9, 2], [-9, 2]], p: [0, 0], W: [[3, 34], [-3, 34]] }, { hx: 16, hy: 26, t: 16, F: [[34, 2], [-9, 2]], W: [[16, 16], [10, 16]], d: 1.1 }, { d: 0.3 }, { hx: 0, hy: 46, t: 0, F: [[9, 2], [-9, 2]], W: [[3, 34], [-3, 34]], d: 0.9 }, { hx: -16, hy: 26, t: -16, F: [[9, 2], [-34, 2]], W: [[-10, 16], [-16, 16]], d: 1.1 }, { d: 0.3 }, { hx: 0, hy: 46, t: 0, F: [[9, 2], [-9, 2]], W: [[3, 34], [-3, 34]], d: 0.9 }],
      cue: { vi: 'Bước rộng sang ngang, ngồi hông ra sau, chân kia thẳng, gối theo mũi chân.', en: 'Step wide to the side, sit the hips back, other leg straight, knee follows the toes.' } },
    'single leg balance (balance pad)': { v: 'side', ms: 3000, props: [{ type: 'pad', h: 6 }],
      kf: [{ hx: 0, hy: 50, t: 2, F: [[2, 8], [10, 30]], p: [0, 20], s: [70, 60], e: [10, 10] }, { hx: 1.5, t: 5, s: [60, 75], d: 1 }, { hx: -1, t: -1, s: [75, 55], d: 1 }, { hx: 0, t: 2, s: [70, 60], d: 1 }],
      cue: { vi: 'Đứng một chân trên đệm mềm, gối hơi chùng, giữ thăng bằng — khó hơn thì nhắm mắt.', en: 'One leg on a soft pad, knee soft, stay balanced — close the eyes to progress.' } },
    'spanish squat (band)': { v: 'side', ms: 3400, props: [{ type: 'band', from: 'knee', to: [-56, 26] }, { type: 'box', x: -60, w: 4, h: 60 }],
      kf: [S({ hx: -2, hy: 44, t: 4, F: [[8, 2], [4, 2]], s: [80, 80], e: [10, 10] }), S({ hx: -14, hy: 24, t: 14, d: 1.2 }), S({ d: 1.2 }), S({ hx: -2, hy: 44, t: 4, d: 1 })],
      cue: { vi: 'Dây ôm sau gối kéo ra sau, cẳng chân thẳng đứng, ngồi xuống và giữ — đùi trước nóng là đúng.', en: 'Band behind the knees pulling back, shins vertical, sit down and hold — burning quads is the point.' } },
    'normal push up (bodyweight)': { v: 'side', ms: 2600, eb: -1,
      kf: [{ hx: -28, hy: 20, t: 68, F: [[-70, 8.5], [-71, 8.5]], p: [72, 72], W: [[0, 2], [2, 2]] }, { hx: -25, hy: 7.5, t: 84, d: 1.1 }, { d: 0.2 }, { hx: -28, hy: 20, t: 68, d: 0.9 }, { d: 0.3 }],
      cue: { vi: 'Thân thẳng như tấm ván, khuỷu chếch ~45°, ngực gần chạm sàn.', en: 'Body straight as a plank, elbows at ~45°, chest close to the floor.' } },
    'chạy con thoi hết sân': { v: 'side', ms: 3000, props: [{ type: 'cone', x: -50 }, { type: 'cone', x: 50 }],
      kf: [Object.assign({ hx: -36, face: 1 }, runCycle(1, 14)[0]), Object.assign({ hx: -12, d: 0.3 }, runCycle(1, 14)[2]), Object.assign({ hx: 14, d: 0.3 }, runCycle(1, 14)[0]), { hx: 40, hy: 30, t: 50, h: [80, 10], k: [70, 60], p: [0, 30], s: [60, 20], e: [10, 60], face: 1, d: 0.35 },
        Object.assign({ hx: 34, face: -1, d: 0.25 }, runCycle(1, 14)[2]), Object.assign({ hx: 10, face: -1, d: 0.3 }, runCycle(1, 14)[0]), Object.assign({ hx: -16, face: -1, d: 0.3 }, runCycle(1, 14)[2]), { hx: -40, hy: 30, t: 50, h: [80, 10], k: [70, 60], p: [0, 30], s: [60, 20], e: [10, 60], face: -1, d: 0.35 }, Object.assign({ hx: -36, face: 1, d: 0.25 }, runCycle(1, 14)[2])],
      cue: { vi: 'Chạy hết sân, chạm vạch, quay đầu thật nhanh — nghỉ ngắn rồi lặp lại.', en: 'Sprint the length of the court, touch the line, turn fast — short rest, repeat.' } },
    'trượt ngang phòng thủ': { v: 'front', ms: 2400,
      kf: [{ hx: -16, hy: 36, t: 10, F: [[-2, 2], [-30, 2]], p: [20, 20], s: [70, 70], e: [30, 30] }, { hx: -6, hy: 37, F: [[12, 4], [-30, 2]], d: 0.4 }, { hx: 2, hy: 36, F: [[12, 2], [-16, 2]], d: 0.4 }, { hx: 12, hy: 37, F: [[26, 4], [-16, 2]], d: 0.4 }, { hx: 16, hy: 36, F: [[30, 2], [2, 2]], d: 0.4 },
        { hx: 6, hy: 37, F: [[30, 2], [-12, 4]], d: 0.4 }, { hx: -2, hy: 36, F: [[16, 2], [-12, 2]], d: 0.4 }, { hx: -12, hy: 37, F: [[16, 2], [-26, 4]], d: 0.4 }, { hx: -16, hy: 36, F: [[-2, 2], [-30, 2]], d: 0.4 }],
      cue: { vi: 'Hạ thấp, hai chân không chạm nhau, tay mở rộng, đẩy bằng chân sau để trượt.', en: 'Stay low, feet never touch, arms wide, push off the trailing leg to slide.' } },
  };
  // Tên hiển thị (tab Anatomy) / tên gần đúng → tên thư viện.
  const ALIAS = {
    'trap bar deadlift': 'deadlift (trap bar)', 'front squat': 'front squat (barbell)', 'landmine press': 'standing landmine shoulder press (barbell)',
    'pull up': 'pull-up', 'med ball rotational scoop toss': 'med ball side throw (med ball)', 'med ball shot put': 'shot put throw (med ball)',
    'landmine rotation': 'landmine twist', 'plyometric push-up': 'plyometric push up (bodyweight)', 'pallof press': 'pallof press (cable)',
    'pallof press (band)': 'pallof press (cable)', 'cable woodchop': 'wood chop (cable machine)', 'dead bug': 'dead bug (bodyweight)',
    'side plank': 'side plank (bodyweight)', 'cable external rotation': 'external rotation (cable)', 'push-up plus': 'push up plus (bodyweight)',
    'neck isometrics (4 hướng)': 'neck isometric hold (bodyweight)', 'farmer carry': "farmer's carry (dumbbell)", 'sprint ngắn': 'sprint (bodyweight)',
    'nhảy dây': 'jump rope', 'back squat': 'high bar squat (barbell)', 'hip thrust': 'hip thrust (barbell)', 'seated calf raise': 'seated calf raise (machine)',
    'standing calf raise': 'standing calf raise (machine)', 'single-leg eccentric heel drop': 'eccentric heel drop (bodyweight)', 'tibialis raise': 'tibialis raise (bodyweight)',
    'pogo jumps': 'pogo jump (bodyweight)', 'bounding': 'bounding (bodyweight)', 'single-leg hop': 'single leg hop (bodyweight)',
    'single-leg romanian deadlift': 'single leg deadlift (kettlebell)', 'step-down': 'step down (bodyweight)', 'banded lateral walk': 'lateral band walk (band)',
    'copenhagen plank': 'copenhagen plank (bodyweight)', 'nordic hamstring curl': 'nordic curl (bodyweight)', 'drop landing': 'drop landing (bodyweight)',
    'countermovement jump': 'countermovement jump (bodyweight)', 'single-leg hop and stick': 'single leg hop and stick (bodyweight)', 'lateral bound': 'lateral bound (bodyweight)',
    'sprint rồi dừng gấp': 'sprint to stop (bodyweight)', '5-10-5 pro agility': 'pro agility shuttle (bodyweight)', 'lateral lunge': 'side lunge (dumbbell)',
    'đứng một chân trên đệm': 'single leg balance (balance pad)', 'spanish squat': 'spanish squat (band)', 'push-up': 'normal push up (bodyweight)',
    'deadlift (trap bar)': 'deadlift (trap bar)', 'nordic curl (band assisted)': 'nordic curl (bodyweight)', 'side plank (weighted)': 'side plank (bodyweight)',
    'dead bug (weighted)': 'dead bug (bodyweight)', 'sprint': 'sprint (bodyweight)',
  };

  window.EXERCISE_ANIM = { mount, find, svgFor, poseAt, skel, frame, has: (n) => !!find(n), names: () => Object.keys(EX), cue: (n, lang) => { const e = find(n); return e && e.cue ? (e.cue[lang] || e.cue.vi) : ''; }, _EX: EX, _ALIAS: ALIAS };
})();
