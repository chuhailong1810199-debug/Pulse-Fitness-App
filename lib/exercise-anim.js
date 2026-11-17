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

  const lsA = (v) => (Array.isArray(v) ? v[0] : v), lsB = (v) => (Array.isArray(v) ? v[1] : v);
  const sgn = (v, i, d) => (Array.isArray(v) ? v[i] : v) || d;
  /** Tư thế → khớp (toạ độ thế giới). */
  function skel(P, ex) {
    const front = ex.v === 'front';
    const hip = [P.hx, P.hy];
    const tl = P.tl == null ? 1 : P.tl, as = P.as || [1, 1], ls = P.ls || [1, 1];
    const sho = add(hip, 180 - P.t, L.trunk * tl);
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
        [kn, an] = ik(hp, P.F[i], L.th * lsA(ls[i]), L.sh * lsB(ls[i]), sgn(ex.kb, i, 1) * sg);
        ft = add(an, sg * (90 - (P.p ? P.p[i] : 0)), fl);
      } else {
        const thA = -P.t + sg * P.h[i], shA = thA - sg * P.k[i];
        kn = add(hp, thA, L.th * lsA(ls[i]));
        an = add(kn, shA, L.sh * lsB(ls[i]));
        ft = add(an, shA + sg * (90 - (P.p ? P.p[i] : 0)), fl);
      }
      const heel = [an[0] - (ft[0] - an[0]) * 0.28, an[1] - (ft[1] - an[1]) * 0.28];
      out.legs.push({ hp, kn, an, ft, heel });
      let el, wr;
      if (P.W) {
        [el, wr] = ik(sp, P.W[i], L.ua * as[i], L.fa * as[i], sgn(ex.eb, i, -1) * sg);
      } else {
        const uaA = -P.t + sg * P.s[i];
        el = add(sp, uaA, L.ua * as[i]);
        wr = add(el, uaA + sg * P.e[i], L.fa * as[i]);
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
    const base = { hx: 0, hy: 46, t: 0, nk: 0, s: [6, -6], e: [12, 12], h: [0, 0], k: [0, 0], p: [0, 0], o: 1, d: 1, face: 1, bf: 0, rp: 0, tl: 1, as: [1, 1] };
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
    const ctx = { P, legs, arms, hip, sho, head, M, mid, front: ex.v === 'front' };
    const back = [], fore = [];
    (ex.props || []).forEach((pr) => { const s = prop(pr, ctx); if (s) (pr.front ? fore : back).push(s); });
    const far = ex.v === 'front' ? COL.body : COL.far, W = 4.6;
    const leg = (g, c) => poly([g.hp, g.kn, g.an, g.ft], c, W) + line(g.an, g.heel, c, W);
    const arm = (a, c) => poly([a.sp, a.el, a.wr], c, W - 0.6);
    const body = leg(legs[1], far) + arm(arms[1], far) + line(hip, sho, COL.body, W + 1.4) + circ(head, L.head, COL.body)
      + leg(legs[0], COL.body) + arm(arms[0], COL.body);
    return '<g opacity="' + f1(Math.max(0, Math.min(1, P.o))) + '">' + back.join('') + body + fore.join('') + '</g>';
  }

  /** Dụng cụ cầm tay: bb (thanh đòn — nhìn ngang là bánh tạ, nhìn trước là thanh + 2 bánh), db (tạ đơn mỗi tay), db1 (chỉ tay gần),
   *  kb (kettlebell giữa hai tay), kb1, plate (bánh tạ nhỏ), ball (bóng), sb (bao cát ôm trước ngực). at: hands | sho | hip | back. */
  function holdSVG(pr, c) {
    const { arms, sho, hip, mid, front } = c;
    const w0 = arms[0].wr, w1 = arms[1].wr, h = mid(w0, w1);
    const at = pr.at === 'sho' ? [sho[0] + (pr.dx || 0), sho[1] + (pr.dy || 0)] : pr.at === 'hip' ? [hip[0] + (pr.dx || 0), hip[1] + (pr.dy || 0)]
      : pr.at === 'wr0' ? w0 : [h[0] + (pr.dx || 0), h[1] + (pr.dy || 0)];
    switch (pr.kind) {
      case 'bb': if (front) { const y = at[1], x0 = Math.min(w0[0], w1[0]) - 16, x1 = Math.max(w0[0], w1[0]) + 16;
          return line([x0, y], [x1, y], COL.prop, 2.4) + rect(x0 - 2, y - 9, 4, 18, COL.prop) + rect(x1 - 2, y - 9, 4, 18, COL.prop); }
        return circ(at, pr.r || 9, 'rgba(143,219,255,.18)', COL.prop);
      case 'db': return [w0, w1].map((w) => rect(w[0] - 6, w[1] - 3.5, 12, 7, COL.prop)).join('');
      case 'db1': return rect(w0[0] - 6, w0[1] - 3.5, 12, 7, COL.prop);
      case 'kb': return circ([at[0], at[1] - 5], 4.5, COL.prop);
      case 'kb1': return circ([w0[0], w0[1] - 5], 4.5, COL.prop);
      case 'plate': return circ(at, pr.r || 6, 'rgba(143,219,255,.25)', COL.prop);
      case 'ball': return circ(at, 5.5, COL.prop);
      case 'sb': return rect(at[0] - 7, at[1] - 6, 14, 12, COL.prop, 0.85);
      default: return '';
    }
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
        return line([pr.x, pr.y], w, COL.propSoft, 1.6) + (pr.y > 90 ? rect(pr.x - 3, pr.y, 6, 4, COL.propSoft) : rect(pr.x - 2, 0, 4, Math.max(pr.y + 6, 20), COL.propSoft)); }
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
      case 'hold': return holdSVG(pr, c);
      case 'bandHands': return line(wr0, wr1, COL.prop, 2);
      case 'seg': return line(pr.a, pr.b, pr.c === 'prop' ? COL.prop : COL.propSoft, pr.w || 4);
      case 'bars': return line([pr.x1, pr.y], [pr.x2, pr.y], COL.prop, 3) + line([pr.x1 + 2, pr.y], [pr.x1 + 2, 0], COL.propSoft, 2) + line([pr.x2 - 2, pr.y], [pr.x2 - 2, 0], COL.propSoft, 2);
      case 'swiss': { const a = legs[0].an; return circ([a[0] + 2, 9], 9, 'rgba(143,219,255,.25)', COL.prop); }
      case 'wheel': return circ([hands[0], 5], 5, 'rgba(143,219,255,.25)', COL.prop);
      case 'plat': { const a = mid(legs[0].an, legs[1].an), d = dirA(pr.ang), q = [a[0] + d[0] * 3, a[1] + d[1] * 3];
        const pd = [Math.cos(pr.ang * R), Math.sin(pr.ang * R)];
        return line([q[0] - pd[0] * 14, q[1] - pd[1] * 14], [q[0] + pd[0] * 14, q[1] + pd[1] * 14], COL.prop, 4); }
      case 'cable2': return [0, 1].map((k) => line([k ? -pr.x : pr.x, pr.y], arms[k].wr, COL.propSoft, 1.6) + rect((k ? -pr.x : pr.x) - 2, 0, 4, Math.max(pr.y + 6, 20), COL.propSoft)).join('');
      case 'to': { const from = pr.from === 'an0' ? legs[0].an : pr.from === 'an1' ? legs[1].an : pr.from === 'kn0' ? legs[0].kn : pr.from === 'hip' ? hip : pr.from === 'wr1' ? wr1 : pr.from === 'mid' ? hands : wr0;
        return line(from, [pr.x, pr.y], pr.band ? COL.prop : COL.propSoft, pr.band ? 2 : 1.6); }
      case 'waves': { const a = hands, b = [pr.x, 4], n = 6; let d = 'M' + pt(a);
        for (let k = 1; k <= n; k++) { const u = k / n, x = a[0] + (b[0] - a[0]) * u, y = a[1] + (b[1] - a[1]) * u + Math.sin(u * 9 + P.rp * R) * 5 * (1 - u * 0.6); d += ' L' + pt([x, y]); }
        return '<path d="' + d + '" fill="none" stroke="' + COL.prop + '" stroke-width="2"/>'; }
      case 'tread': return rect(pr.x1, 0, pr.x2 - pr.x1, 4, COL.propSoft) + line([pr.x2 - 4, 4], [pr.x2 + 6, 60], COL.propSoft, 2.5) + line([pr.x2 + 6, 60], [pr.x2 - 2, 64], COL.propSoft, 2.5);
      case 'rower': return line([pr.x1, 5], [pr.x2, 5], COL.propSoft, 3) + circ([pr.x2 + 6, 14], 10, 'rgba(143,219,255,.18)', COL.prop) + line(hands, [pr.x2 + 6, 14], COL.propSoft, 1.4) + rect(hip[0] - 7, 6, 14, 3, COL.prop);
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
      if (pr.type === 'seg') { grow(pr.a, 3); grow(pr.b, 3); }
      if (pr.type === 'bars') { grow([pr.x1, pr.y], 3); grow([pr.x2, pr.y], 3); }
      if (pr.type === 'to') grow([pr.x, pr.y], 3);
      if (pr.type === 'cable2') { grow([pr.x, pr.y], 4); grow([-pr.x, pr.y], 4); }
      if (pr.type === 'waves') grow([pr.x, 4], 3);
      if (pr.type === 'tread') { grow([pr.x1, 0], 2); grow([pr.x2 + 8, 66], 2); }
      if (pr.type === 'rower') { grow([pr.x1, 5], 2); grow([pr.x2 + 16, 26], 2); }
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
  function find(name) { const k = key(name); return EX[k] || EX[ALIAS[k]] || libFind(k); }

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


  // ══ THƯ VIỆN: MẪU CHUYỂN ĐỘNG (2026-11-17) ═══════════════════════════════
  // Mỗi mẫu là hàm (tham số) → bài { v, ms, props, kf, cue }. RULES (cuối mục) gán từng tên bài thư viện vào một mẫu.
  const H = (kind, at, o) => Object.assign({ type: 'hold', kind, at: at || 'hands' }, o || {});
  const C = (vi, en) => ({ vi, en });
  const SIDE_ST = { hx: 0, hy: 46, t: 2, F: [[3, 2], [-1, 2]], p: [0, 0] };
  const FR_ST = { hx: 0, hy: 46, t: 0, F: [[9, 2], [-9, 2]], p: [0, 0] };
  const seat = (x, w, h) => ({ type: 'box', x, w, h });
  const loop = (a, b, d1, hold1, d2, hold2) => [a, Object.assign({}, b, { d: d1 }), { d: hold1 || 0.25 }, Object.assign({}, a, { d: d2 || d1 }), { d: hold2 || 0.25 }];
  /** Tay cầm theo dụng cụ khi đứng thả tay (side). */
  const handHold = (eq) => eq === 'bb' ? [H('bb', 'wr0')] : eq === 'db' ? [H('db')] : eq === 'kb' ? [H('kb')] : eq === 'plate' ? [H('plate')] : [];

  const T = {};
  // ── CHÂN ──
  T.squat = (o) => {
    const eq = o.hold || 'none';
    if (o.wide) {   // sumo / bodyweight wide — nhìn trước
      const top = Object.assign({}, FR_ST, { F: [[17, 2], [-17, 2]], W: [[4, 62], [-4, 62]] }), bot = { hy: 25, W: [[4, 50], [-4, 50]] };
      if (eq === 'db' || eq === 'kb') { top.W = [[3, 30], [-3, 30]]; bot.W = [[3, 12], [-3, 12]]; }
      if (eq === 'bb') { top.W = [[22, 74], [-22, 74]]; bot.W = [[22, 53], [-22, 53]]; }
      return { v: 'front', ms: 3400, eb: -1, props: eq === 'none' ? [] : [H(eq === 'db' || eq === 'kb' ? 'kb' : eq === 'bb' ? 'bb' : 'plate', eq === 'bb' ? 'sho' : 'hands', { dy: eq === 'bb' ? 0 : -2 })],
        kf: loop(top, bot, 1.3, 0.25, 1.1, 0.35), cue: C('Chân rộng, mũi chân hơi mở, gối đẩy ra theo mũi chân, ngồi thẳng xuống giữa hai chân.', 'Wide stance, toes slightly out, push the knees out over the toes, sit straight down between the legs.') };
    }
    const lean = eq === 'bbBack' ? 32 : eq === 'none' ? 26 : 18, deep = o.box ? 30 : 21;
    let top = Object.assign({}, SIDE_ST, { t: 4 }), bot = { hx: -11, hy: deep, t: lean };
    const props = o.box ? [seat(-28, 18, 26)] : [];
    if (eq === 'bbBack') { Object.assign(top, { s: [-28, -28], e: [150, 150] }); Object.assign(bot, { s: [-4, -4] }); props.push(H('bb', 'sho', { dx: -2, dy: 2 })); }
    else if (eq === 'bbFront' || eq === 'zercher') { Object.assign(top, { s: [99, 99], e: [150, 150] }); Object.assign(bot, { s: [115, 115] }); props.push(H('bb', 'sho', { dx: 4, dy: eq === 'zercher' ? -10 : 1 })); }
    else if (eq === 'goblet') { Object.assign(top, { s: [40, 40], e: [140, 140] }); Object.assign(bot, { s: [55, 55] }); props.push(H(o.kb ? 'kb' : 'plate', 'hands', { dy: 3 })); }
    else if (eq === 'db') { Object.assign(top, { s: [2, 2], e: [0, 0] }); Object.assign(bot, { s: [20, 20] }); props.push(H('db')); }
    else { Object.assign(top, { s: [30, 30], e: [10, 10] }); Object.assign(bot, { s: [110, 110], e: [0, 0] }); }
    if (o.assist) { props.push({ type: 'seg', a: [26, 0], b: [26, 60], w: 3 }); Object.assign(top, { W: [[24, 56], [22, 56]] }); delete top.s; delete top.e; Object.assign(bot, { W: [[24, 40], [22, 40]] }); delete bot.s; }
    if (o.slant) top.F = [[3, 6], [-1, 6]], top.p = [-15, -15], props.push({ type: 'seg', a: [-8, 2], b: [14, 8], w: 4 });
    return { v: 'side', ms: 3400, props, kf: loop(top, bot, 1.3, 0.25, 1.1, 0.35),
      cue: eq === 'bbBack' ? C('Thanh đòn trên lưng trên, gồng bụng, ngồi xuống sâu, gối theo mũi chân, đẩy sàn đứng lên.', 'Bar on the upper back, brace, sit deep, knees over the toes, push the floor away.')
        : eq === 'bbFront' ? C('Thanh đòn trước vai, khuỷu cao, thân thẳng đứng hơn back squat.', 'Bar on the front of the shoulders, elbows high, more upright than a back squat.')
        : eq === 'zercher' ? C('Ôm thanh đòn trong khuỷu tay, thân thẳng, ngồi xuống giữa hai gót.', 'Bar in the crook of the elbows, tall chest, sit down between the heels.')
        : eq === 'goblet' ? C('Ôm tạ sát ngực, khuỷu đi vào trong gối ở đáy, lưng thẳng.', 'Hold the weight at the chest, elbows inside the knees at the bottom, flat back.')
        : C('Hông ra sau và xuống, gối theo mũi chân, gót bám sàn suốt động tác.', 'Hips back and down, knees over the toes, heels stay down the whole time.') };
  };
  T.wallSit = () => ({ v: 'side', ms: 3000, props: [{ type: 'wall', x: -17, h: 100 }],
    kf: [{ hx: -10, hy: 25, t: 0, F: [[13, 2], [9, 2]], p: [0, 0], s: [8, 8], e: [70, 70] }, { hy: 25.6, d: 1 }, { hy: 25, d: 1 }],
    cue: C('Lưng áp tường, đùi song song sàn, gối 90°, giữ đều hơi thở.', 'Back flat on the wall, thighs level, knees at 90°, keep breathing.') });
  T.thruster = (o) => ({ v: 'side', ms: 2800, props: [H(o && o.bb ? 'bb' : 'db', o && o.bb ? 'wr0' : 'hands')],
    kf: [Object.assign({}, SIDE_ST, { t: 4, W: [[8, 78], [6, 78]] }), { hx: -9, hy: 22, t: 20, W: [[14, 56], [12, 56]], d: 1 }, { hx: 0, hy: 46, t: 3, W: [[8, 78], [6, 78]], d: 0.45 }, { W: [[3, 106], [1, 106]], d: 0.4 }, { d: 0.2 }, { W: [[8, 78], [6, 78]], d: 0.6 }],
    cue: C('Squat với tạ ở vai, đứng lên thật nhanh và dùng lực đó đẩy tạ qua đầu.', 'Squat with the weights at the shoulders, stand up fast and use that drive to press overhead.') });
  T.ballSquatThrow = () => ({ v: 'side', ms: 2800, props: [{ type: 'wall', x: 40, h: 130 }, { type: 'ball' }],
    kf: [Object.assign({}, SIDE_ST, { t: 4, W: [[12, 72], [10, 72]], bf: 0, ball: [36, 120] }), { hx: -10, hy: 22, t: 22, W: [[16, 52], [14, 52]], d: 1 }, { hx: 0, hy: 48, t: 2, W: [[16, 104], [14, 104]], F: [[3, 4], [-1, 4]], p: [30, 30], d: 0.35 }, { bf: 1, d: 0.3 }, { bf: 0, F: [[3, 2], [-1, 2]], p: [0, 0], W: [[12, 72], [10, 72]], d: 0.6 }],
    cue: C('Squat ôm bóng trước ngực, đứng lên bật và ném bóng lên điểm cao trên tường, bắt bóng rồi vào lần sau.', 'Squat with the ball at the chest, drive up and throw it to a high target, catch and go again.') });
  T.legPress = () => ({ v: 'side', ms: 3200, kb: -1, props: [{ type: 'seg', a: [4, 14], b: [-30, 34], w: 6 }, { type: 'plat', ang: 140 }],
    kf: [{ hx: 0, hy: 20, t: -60, F: [[17, 36], [15, 37]], p: [-55, -55], s: [70, 70], e: [30, 30] }, { F: [[33, 48], [31, 49]], d: 1.1 }, { d: 0.25 }, { F: [[17, 36], [15, 37]], d: 1.2 }, { d: 0.2 }],
    cue: C('Lưng dưới dán ghế, hạ tới gối ~90° mà mông không cuộn khỏi ghế, đẩy bằng cả bàn chân, không khoá gối.', 'Low back stays on the pad, lower to ~90° knees without the hips curling up, push through the whole foot, do not lock the knees.') });
  T.legExtension = () => ({ v: 'side', ms: 2600, props: [seat(-20, 26, 28), { type: 'seg', a: [-18, 30], b: [-24, 66], w: 5 }, { type: 'anchor' }],
    kf: [{ hx: -4, hy: 32, t: -8, h: [82, 82], k: [88, 88], p: [0, 0], s: [20, 20], e: [20, 20] }, { k: [4, 4], d: 0.9 }, { d: 0.35 }, { k: [88, 88], d: 1.2 }],
    cue: C('Duỗi gối hết cỡ, siết đùi trước 1 giây ở trên, hạ chậm.', 'Straighten the knees fully, squeeze the quads for a second, lower slowly.') });
  T.legCurlLying = () => ({ v: 'side', ms: 2600, props: [seat(-30, 66, 20), { type: 'anchor' }],
    kf: [{ hx: 0, hy: 24, t: 90, h: [0, 0], k: [0, 0], p: [0, 0], s: [112, 112], e: [0, 0] }, { k: [115, 115], d: 0.9 }, { d: 0.3 }, { k: [0, 0], d: 1.3 }],
    cue: C('Hông ép xuống ghế, co gót về mông, hạ chậm có kiểm soát.', 'Hips pressed into the pad, curl the heels to the glutes, lower under control.') });
  T.legCurlBall = () => ({ v: 'side', ms: 2800, kb: -1, props: [{ type: 'swiss' }],
    kf: [{ hx: 0, hy: 17, t: -112, F: [[38, 18], [36, 18]], p: [-30, -30], s: [30, 30], e: [0, 0] }, { hx: 0, hy: 24, t: -125, F: [[22, 18], [20, 18]], p: [10, 10], d: 1 }, { d: 0.3 }, { hx: 0, hy: 17, t: -112, F: [[38, 18], [36, 18]], p: [-30, -30], d: 1.2 }],
    cue: C('Nâng hông, gót trên bóng, co gối kéo bóng về, hông vẫn giữ cao.', 'Hips up, heels on the ball, curl it in while the hips stay high.') });
  T.legCurlBand = (o) => ({ v: 'side', ms: 2600, props: [{ type: 'to', from: 'an0', x: -62, y: 4, band: true }],
    kf: [{ hx: 0, hy: 5, t: 90, nk: -10, h: [0, 0], k: [0, 0], p: [0, 0], s: [150, 150], e: [130, 130] }, { k: [110, o && o.single ? 0 : 110], d: 1 }, { d: 0.3 }, { k: [0, 0], d: 1.2 }],
    cue: C('Nằm sấp, dây ở cổ chân, co gót về mông chống lại lực dây, hông không nhổm lên.', 'Lie face down, band at the ankle, curl the heel to the glutes against the band, hips stay down.') });
  T.lunge = (o) => {
    const eq = o.hold || 'bw', props = [];
    const arm = eq === 'bb' ? { s: [-28, -28], e: [150, 150] } : eq === 'db' ? { s: [2, 2], e: [0, 0] } : eq === 'oh' ? { s: [180, 180], e: [0, 0] } : { s: [25, 25], e: [80, 80] };
    if (eq === 'bb') props.push(H('bb', 'sho', { dx: -2, dy: 2 })); if (eq === 'db') props.push(H('db')); if (eq === 'oh') props.push(H('db'));
    if (o.box) props.push(seat(16, 22, o.box));
    const st = Object.assign({}, SIDE_ST, arm);
    if (o.type === 'reverse') return { v: 'side', ms: 3400, props, kf: [st, { hx: -6, hy: 25, t: 6, F: [[3, 2], [-26, 4]], p: [0, 55], d: 1.2 }, { d: 0.25 }, { hx: 0, hy: 46, t: 2, F: [[3, 2], [-1, 2]], p: [0, 0], d: 1.1 }, { d: 0.3 }],
      cue: C('Bước lùi ra sau, gối sau gần chạm sàn, thân thẳng, đẩy bằng gót chân trước về đứng.', 'Step back, rear knee near the floor, tall trunk, drive through the front heel to stand.') };
    if (o.type === 'walk') return { v: 'side', ms: 3600, props, kf: [Object.assign({}, st, { o: 0, d: 0.1 }), { o: 1, d: 0.1 }, { hx: 10, hy: 25, t: 4, F: [[26, 2 + (o.box || 0)], [-1, 4]], p: [0, 55], d: 1 }, { hx: 24, hy: 46, t: 2, F: [[26, 2], [22, 2]], p: [0, 0], d: 0.7 }, { hx: 36, hy: 25, t: 4, F: [[50, 2], [24, 4]], p: [0, 55], d: 1 }, { hx: 48, hy: 46, F: [[50, 2], [46, 2]], p: [0, 0], d: 0.7 }, { o: 0, d: 0.3 }],
      cue: C('Bước dài về trước, hạ thẳng xuống, đứng lên và bước tiếp chân kia — thân luôn thẳng.', 'Long step forward, drop straight down, stand and step through with the other leg — trunk stays tall.') };
    if (o.type === 'split') return { v: 'side', ms: 3200, props, kf: loop(Object.assign({}, st, { hx: -4, hy: 43, F: [[14, 2 + (o.box || 0)], [-22, 4]], p: [0, 50] }), { hx: -5, hy: 25 + (o.box ? 2 : 0), t: 6 }, 1.2, 0.25, 1, 0.3),
      cue: C('Đứng chân trước chân sau cố định, hạ thẳng xuống tới gối sau gần sàn, đẩy lên bằng chân trước.', 'Feet split and fixed, drop straight down until the back knee nearly touches, push up with the front leg.') };
    if (o.type === 'curtsy') return { v: 'front', ms: 3400, props: eq === 'db' ? [H('db')] : [], kf: [Object.assign({}, FR_ST, { s: [8, 8], e: [5, 5] }), { hx: 4, hy: 28, F: [[9, 2], [16, 6]], ls: [1, 0.85], d: 1.2 }, { d: 0.25 }, { hx: 0, hy: 46, F: [[9, 2], [-9, 2]], ls: [1, 1], d: 1.1 }, { d: 0.3 }],
      cue: C('Chân sau bước chéo ra sau chân trước như cúi chào, hông giữ thẳng, gối trước không đổ vào.', 'Cross the back leg behind like a curtsy, hips square, front knee does not cave.') };
    if (o.type === 'jump') return { v: 'side', ms: 1800, kf: [Object.assign({}, SIDE_ST, { hx: -4, hy: 26, t: 6, F: [[14, 2], [-24, 4]], p: [0, 55], s: [-30, 60], e: [80, 80] }), { hx: -4, hy: 56, t: 2, F: [[2, 14], [-6, 14]], p: [30, 30], s: [20, 20], d: 0.4 }, { hx: -4, hy: 26, t: 6, F: [[-22, 4], [14, 2]], p: [55, 0], s: [60, -30], d: 0.4 }, { hx: -4, hy: 56, t: 2, F: [[-6, 14], [2, 14]], p: [30, 30], s: [20, 20], d: 0.4 }, { d: 0 }],
      cue: C('Từ tư thế lunge bật lên, đổi chân trên không, tiếp đất mềm vào lunge chân kia.', 'Jump up from a lunge, switch legs in the air, land softly in the other lunge.') };
    return { v: 'side', ms: 3400, props, kf: [st, { hx: 8, hy: 25, t: 4, F: [[26, 2 + (o.box || 0)], [-1, 4]], p: [0, 55], d: 1.2 }, { d: 0.25 }, { hx: 0, hy: 46, t: 2, F: [[3, 2], [-1, 2]], p: [0, 0], d: 1.1 }, { d: 0.3 }],
      cue: eq === 'oh' ? C('Tạ giữ thẳng trên đầu, bụng gồng, bước tới và hạ — tay không đổ ra trước.', 'Weights locked overhead, brace, step and lower — arms do not drift forward.')
        : C('Bước tới, hạ thẳng xuống tới gối sau gần sàn, gối trước theo mũi chân, đẩy về.', 'Step forward, drop until the back knee nearly touches, front knee over the toes, push back.') };
  };
  T.cossack = (o) => { const bb = o.hold === 'bb', W = (hx, hy) => bb ? [[hx + 22, hy + 28], [hx - 22, hy + 28]] : [[hx + 4, hy + 16], [hx - 4, hy + 16]];
    return { v: 'front', ms: 4000, props: bb ? [H('bb', 'sho')] : o.hold === 'db' ? [H('kb', 'hands')] : [], eb: -1,
      kf: [Object.assign({}, FR_ST, { F: [[28, 2], [-28, 2]], hy: 40, W: W(0, 40) }), { hx: 18, hy: 18, t: 10, p: [0, -30], W: W(18, 18), d: 1.2 }, { d: 0.3 }, { hx: 0, hy: 40, t: 0, p: [0, 0], W: W(0, 40), d: 1 }, { hx: -18, hy: 18, t: -10, p: [-30, 0], W: W(-18, 18), d: 1.2 }, { d: 0.3 }, { hx: 0, hy: 40, t: 0, p: [0, 0], W: W(0, 40), d: 1 }],
      cue: C('Chân rất rộng, ngồi sâu sang một bên, chân kia duỗi thẳng mũi chân hướng lên.', 'Very wide stance, sit deep to one side, the other leg straight with the toes up.') }; };
  T.sideLungeBB = () => { const e = JSON.parse(JSON.stringify(EX['side lunge (dumbbell)'])); e.props = [H('bb', 'sho')]; e.eb = -1;
    e.kf.forEach((k) => { if (k.W) k.W = k.W.map((w) => [(k.hx || 0) + (w[0] > (k.hx || 0) ? 22 : -22), (k.hy || 46) + 28]); }); return e; };
  T.stepUp = (o) => {
    const eq = o.hold === 'db' ? [H('db')] : [];
    if (o.side) return { v: 'front', ms: 3400, props: [seat(10, 30, 22)].concat(eq), kf: [Object.assign({}, FR_ST, { hx: -6, F: [[20, 24], [-14, 2]], s: [8, 8], e: [8, 8] }), { hx: 18, hy: 70, F: [[20, 24], [10, 30]], d: 1.1 }, { d: 0.3 }, { hx: -6, hy: 46, F: [[20, 24], [-14, 2]], d: o.ecc ? 2 : 1.1 }],
      cue: C('Đứng nghiêng cạnh bục, đặt chân gần lên, đẩy bằng chân đó lên — chân dưới không nhún.', 'Stand side-on, foot on the box, drive up with that leg — the bottom foot does not push.') };
    return { v: 'side', ms: 3600, props: [seat(12, 30, 22)].concat(eq), kf: [Object.assign({}, SIDE_ST, { hx: -2, F: [[22, 24], [-2, 2]], s: [6, 6], e: [6, 6] }), { hx: 18, hy: 70, t: 6, F: [[22, 24], [26, 40]], p: [0, 30], d: 1.1 }, { d: 0.3 }, { hx: -2, hy: 46, t: 2, F: [[22, 24], [-2, 2]], p: [0, 0], d: o.ecc ? 2.2 : 1.1 }, { d: 0.2 }],
      cue: o.ecc ? C('Lên bằng chân trên bục, hạ xuống CHẬM 3–4 giây, gối không đổ vào trong.', 'Step up with the top leg, lower SLOWLY over 3–4 s, knee stays out.')
        : C('Cả bàn chân trên bục, đẩy bằng chân đó đứng thẳng, kéo gối kia lên, xuống có kiểm soát.', 'Whole foot on the box, drive up to tall, lift the other knee, step down under control.') };
  };
  T.deadlift = (o) => {
    const eq = o.hold || 'bb', hd = eq === 'bb' ? H('bb', 'wr0') : eq === 'db' ? H('db') : eq === 'kb' ? H('kb') : H('bb', 'wr0');
    if (o.sumo) return { v: 'front', ms: 3400, props: [eq === 'bb' ? H('bb', 'hands') : eq === 'db' ? H('db') : H('kb')], kf: loop(Object.assign({}, FR_ST, { F: [[19, 2], [-19, 2]], W: [[5, 36], [-5, 36]] }), { hy: 27, W: [[5, eq === 'bb' ? 11 : 14], [-5, eq === 'bb' ? 11 : 14]] }, 1.3, 0.25, 1.1, 0.35),
      cue: C('Chân rộng, mũi chân mở, tay trong gối, đẩy gối ra và đứng lên bằng hông.', 'Wide stance, toes out, hands inside the knees, push the knees out and stand with the hips.') };
    const props = [hd]; let bot = { hx: -14, hy: 29, t: 50, s: [50, 50] };
    if (o.rack) { props.push(seat(10, 14, 20)); bot = { hx: -9, hy: 38, t: 38, s: [38, 38] }; }
    return { v: 'side', ms: 3600, props, kf: [Object.assign({}, SIDE_ST, bot, { e: [0, 0], F: [[4, 2], [0, 2]] }), { hx: 0, hy: 46, t: 2, s: [2, 2], d: 1.1 }, { d: 0.35 }, Object.assign({}, bot, { d: 1.2 }), { d: 0.3 }],
      cue: o.rack ? C('Tạ đặt trên giá ngang gối, siết lưng, kéo hông tới đứng thẳng — tập phần trên của deadlift.', 'Bar on pins at knee height, set the back, drive the hips through to stand — the top half of a deadlift.')
        : C('Tạ sát ống chân, lưng thẳng, đẩy sàn đứng lên, hông và vai lên cùng lúc, tạ trượt sát chân.', 'Bar over the mid-foot, flat back, push the floor away, hips and shoulders rise together, bar stays close.') };
  };
  T.rdl = (o) => {
    const e = JSON.parse(JSON.stringify(EX['romanian deadlift'])), eq = o.hold || 'bb';
    e.props = [eq === 'db' ? H('db') : eq === 'kb' ? H('kb') : H('bb', 'wr0')];
    if (o.stiff) { e.kf[1].t = 80; e.kf[1].s = [80, 80]; e.kf[1].hx = -14; e.cue = C('Gối gần thẳng, gập hông sâu tới khi đùi sau căng hết, lưng vẫn thẳng.', 'Knees almost straight, hinge deep until the hamstrings are fully stretched, back stays flat.'); }
    return e;
  };
  T.goodMorning = (o) => ({ v: 'side', ms: 3600, props: [H('bb', 'sho', { dx: o && o.zercher ? 6 : -2, dy: o && o.zercher ? -10 : 2 })],
    kf: loop(Object.assign({}, SIDE_ST, { t: 3, s: o && o.zercher ? [80, 80] : [-28, -28], e: o && o.zercher ? [120, 120] : [150, 150], F: [[5, 2], [1, 2]] }), { hx: -13, hy: 43, t: 72 }, 1.4, 0.25, 1.1, 0.3),
    cue: C('Tạ trên lưng, gối hơi chùng, đẩy hông ra sau tới thân gần song song sàn, lưng luôn thẳng.', 'Bar on the back, soft knees, push the hips back until the trunk is nearly level, back stays flat.') });
  T.singleLegDL = (o) => { const e = JSON.parse(JSON.stringify(EX['single leg deadlift (kettlebell)']));
    if (o.hold === 'bb') { e.props = [H('bb', 'wr0')]; e.kf.forEach((k) => { if (k.s) k.s = [k.s[1], k.s[1]]; if (k.e) k.e = [0, 0]; }); }
    if (o.kick) { e.kf[1].F = [[2, 2], [-14, 4]]; e.kf[1].t = 55; e.kf[1].s = [30, 55]; e.props = [H('db1')]; e.kf.forEach((k) => { if (k.s) k.s = [k.s[1], k.s[0]]; });
      e.cue = C('Chân sau chỉ chạm mũi chân giữ thăng bằng, gần như toàn bộ lực trên chân trước, gập hông.', 'Back foot just touches with the toes for balance, nearly all the load on the front leg, hinge.'); }
    return e; };
  T.swing = () => ({ v: 'side', ms: 1500, props: [H('kb', 'hands', { dy: 0 })],
    kf: [Object.assign({}, SIDE_ST, { hx: -12, hy: 40, t: 58, F: [[5, 2], [1, 2]], s: [40, 40], e: [0, 0] }), { hx: 0, hy: 46, t: -2, s: [88, 88], d: 1 }, { hx: -12, hy: 40, t: 58, s: [40, 40], d: 1 }],
    cue: C('Gập hông như ném tạ ra sau giữa hai chân, bật hông tới trước để tạ bay lên ngang ngực — tay chỉ dẫn, không nâng.', 'Hike it back between the legs, snap the hips through so it floats to chest height — the arms guide, they do not lift.') });
  T.pullThrough = () => ({ v: 'side', ms: 2800, props: [{ type: 'cable', x: -52, y: 8, hand: 'mid' }],
    kf: loop(Object.assign({}, SIDE_ST, { hx: 0, t: 3, F: [[8, 2], [4, 2]], s: [8, 8], e: [0, 0] }), { hx: -12, hy: 40, t: 65, s: [30, 30] }, 1.2, 0.2, 0.9, 0.35),
    cue: C('Quay lưng về máy cáp, dây giữa hai chân, gập hông ra sau rồi siết mông kéo hông về trước.', 'Back to the cable, rope between the legs, hinge back then squeeze the glutes to drive the hips through.') });
  T.bridge = (o) => ({ v: 'side', ms: 2800, props: o && o.hold ? [H(o.hold === 'db' ? 'db1' : 'plate', 'hip', { dy: 6 })] : [],
    kf: [{ hx: 3, hy: 5, t: -92, F: [[17, 2], [13, 2]], p: [0, 0], s: [0, 0], e: [0, 0] }, { hx: 0, hy: 20, t: -120, d: 0.9 }, { d: 0.45 }, { hx: 3, hy: 5, t: -92, d: 1 }],
    cue: C('Nằm ngửa, gót gần mông, siết mông nâng hông thành đường thẳng vai – gối, giữ 1 giây.', 'On your back, heels close, squeeze the glutes to lift the hips into a line shoulder to knee, hold a second.') });
  T.hipThrust = (o) => { const e = JSON.parse(JSON.stringify(EX['hip thrust (barbell)']));
    e.props = [e.props[0]].concat(o.hold === 'db' ? [H('db1', 'hip', { dy: 6 })] : o.hold === 'plate' ? [H('plate', 'hip', { dy: 6 })] : []);
    if (!o.hold) e.kf.forEach((k) => { if (k.W) delete k.W; }), e.kf[0].s = [0, 0], e.kf[0].e = [0, 0];
    return e; };
  T.kneelSquat = () => ({ v: 'side', ms: 3000, kb: 1, props: [H('bb', 'sho', { dx: -2, dy: 2 })],
    kf: [{ hx: 0, hy: 25, t: 2, F: [[-22, 3], [-23, 3]], p: [180, 180], s: [-28, -28], e: [150, 150] }, { hx: -13, hy: 13, t: 34, d: 1 }, { d: 0.25 }, { hx: 0, hy: 25, t: 2, d: 0.9 }, { d: 0.3 }],
    cue: C('Quỳ, tạ trên lưng, ngồi hông về gót rồi siết mông đẩy hông tới thẳng người.', 'Kneel with the bar on the back, sit the hips to the heels, then squeeze the glutes to drive tall.') });
  T.calfStand = (o) => { const e = JSON.parse(JSON.stringify(EX['standing calf raise (machine)']));
    e.props = [e.props[0]].concat(o.hold === 'db' ? [H(o.single ? 'db1' : 'db')] : o.hold === 'kb' ? [H(o.single ? 'kb1' : 'kb')] : o.hold === 'bb' ? [H('bb', 'sho', { dx: -2, dy: 2 })] : [e.props[1]]);
    if (o.hold === 'db' || o.hold === 'kb') e.kf.forEach((k) => { if (k.s) k.s = [2, 2]; if (k.e) k.e = [0, 0]; });
    if (o.single) e.kf.forEach((k) => { if (k.F) k.F = [k.F[0], [-12, k.F[0][1] + 16]]; if (k.p) k.p = [k.p[0], 0]; });
    return e; };
  T.calfSeat = (o) => { const e = JSON.parse(JSON.stringify(EX['seated calf raise (machine)']));
    if (o.hold) e.props = [e.props[0], e.props[1], H(o.hold === 'kb' ? 'kb1' : 'db1', 'hands')], e.kf[0].W = [[4, 36], [2, 36]];
    if (o.single) e.kf.forEach((k) => { if (k.F) k.F = [k.F[0], [-2, 4]]; if (k.p) k.p = [k.p[0], 0]; });
    if (o.hold) e.kf.forEach((k) => { if (k.hy) k.W = [[4, k.hy + 4], [2, k.hy + 4]]; });
    return e; };
  T.quadKick = (o) => ({ v: 'side', ms: 2400, kb: 1, props: o && o.cable ? [{ type: 'to', from: 'an0', x: -60, y: 6 }] : [{ type: 'to', from: 'an0', x: 30, y: 4, band: true }],
    kf: [{ hx: 0, hy: 25, t: 80, F: [[-22, 3], [-23, 3]], p: [180, 180], W: [[30, 2], [32, 2]] }, { F: [[-44, 30], [-23, 3]], p: [90, 180], d: 0.8 }, { d: 0.3 }, { F: [[-22, 3], [-23, 3]], p: [180, 180], d: 1 }],
    cue: C('Bò bốn chân, lưng phẳng, đạp gót lên và ra sau bằng mông — lưng dưới không võng.', 'On all fours, flat back, push the heel up and back with the glute — the low back does not sag.') });
  T.standKick = () => ({ v: 'side', ms: 2400, props: [{ type: 'to', from: 'an0', x: 34, y: 4 }, { type: 'seg', a: [34, 0], b: [34, 80], w: 4 }],
    kf: [Object.assign({}, SIDE_ST, { t: 16, W: [[32, 60], [32, 62]], F: [[3, 2], [-1, 2]] }), { F: [[-26, 18], [-1, 2]], p: [40, 0], d: 0.8 }, { d: 0.3 }, { F: [[3, 2], [-1, 2]], p: [0, 0], d: 1 }],
    cue: C('Bám máy, thân hơi nghiêng tới, đạp chân ra sau bằng mông, không ưỡn lưng.', 'Hold the machine, lean slightly forward, kick the leg back with the glute, do not arch.') });
  T.abduct = (o) => ({ v: 'front', ms: 2400, props: o && o.band ? [{ type: 'band' }] : [{ type: 'to', from: 'an0', x: -60, y: 4 }],
    kf: [Object.assign({}, FR_ST, { F: [[7, 2], [-7, 2]], s: [30, 8], e: [40, 10] }), { F: [[30, 12], [-7, 2]], p: [20, 0], d: 0.8 }, { d: 0.3 }, { F: [[7, 2], [-7, 2]], p: [0, 0], d: 1 }],
    cue: C('Đứng thẳng, đưa chân sang ngang bằng mông nhỡ, thân không nghiêng theo.', 'Stand tall, take the leg out to the side with the glute medius, trunk does not tip.') });
  T.clam = () => ({ v: 'side', ms: 2400, props: [{ type: 'band' }],
    kf: [{ hx: 0, hy: 14, t: -90, nk: 0, s: [-90, 0], e: [100, 20], h: [-15, -15], k: [130, 130], p: [0, 0], ls: [0.75, 0.75] }, { h: [25, -15], k: [130, 130], d: 0.8 }, { d: 0.3 }, { h: [-15, -15], d: 1 }],
    cue: C('Nằm nghiêng, gối co, hai bàn chân chạm nhau, mở gối trên như vỏ sò — hông không lật ra sau.', 'Side-lying, knees bent, feet together, open the top knee like a clam — the hips do not roll back.') });
  T.hydrant = () => ({ v: 'side', ms: 2400, kb: 1, props: [{ type: 'band' }],
    kf: [{ hx: 0, hy: 25, t: 80, F: [[-22, 3], [-23, 3]], p: [180, 180], W: [[30, 2], [32, 2]], ls: [[1, 1], [1, 1]] }, { F: [[-18, 18], [-23, 3]], ls: [[0.55, 1], [1, 1]], d: 0.8 }, { d: 0.3 }, { F: [[-22, 3], [-23, 3]], ls: [[1, 1], [1, 1]], d: 1 }],
    cue: C('Bò bốn chân, giữ gối gập, đưa đùi sang ngang tới ngang hông (về phía người xem) — thân không nghiêng.', 'On all fours, knee bent, lift the thigh out to the side to hip height (toward you) — the trunk does not lean.') });
  T.ghr = () => ({ v: 'side', ms: 3400, kb: 1, props: [seat(-14, 24, 30), { type: 'box', x: -32, w: 6, h: 40 }],
    kf: [{ hx: 0, hy: 34 + 23, t: 0, F: [[-22, 36], [-23, 36]], p: [180, 180], s: [40, 40], e: [120, 120] }, { hx: 23, hy: 34, t: 90, d: 1.6 }, { d: 0.3 }, { hx: 0, hy: 57, t: 0, d: 1.2 }],
    cue: C('Gối trên đệm, cổ chân khoá, hạ thân tới ngang rồi kéo lên bằng đùi sau và mông.', 'Knees on the pad, ankles locked, lower to horizontal then pull up with hamstrings and glutes.') });
  T.revHyper = () => ({ v: 'side', ms: 2600, props: [seat(-4, 44, 38)],
    kf: [{ hx: 0, hy: 42, t: 90, h: [90, 90], k: [0, 0], p: [0, 0], s: [110, 110], e: [0, 0] }, { h: [0, 0], d: 0.8 }, { d: 0.3 }, { h: [90, 90], d: 1.1 }],
    cue: C('Nằm sấp, hông ở mép ghế, nâng hai chân thẳng lên tới ngang bằng mông, hạ có kiểm soát.', 'Face down, hips at the edge, lift both straight legs to level with the glutes, lower under control.') });
  T.backExt = (o) => { const e = JSON.parse(JSON.stringify(EX['back extension'])); if (o && o.plate) e.props.push(H('plate', 'sho', { dx: 2 }));
    if (o && o.hold) { e.kf = [Object.assign({}, e.kf[0]), { t: 50, d: 1 }, { t: 47, d: 1 }]; e.cue = C('Giữ thân thẳng hàng chân ở trên cùng, siết mông và lưng — không ưỡn quá.', 'Hold the trunk in line with the legs at the top, glutes and back tight — no over-arching.'); }
    return e; };
  T.superman = () => ({ v: 'side', ms: 2600,
    kf: [{ hx: 0, hy: 4, t: 90, nk: 0, s: [180, 180], e: [0, 0], h: [0, 0], k: [0, 0], p: [70, 70] }, { t: 72, s: [172, 172], h: [-22, -22], d: 0.8 }, { d: 0.6 }, { t: 90, s: [180, 180], h: [0, 0], d: 0.9 }],
    cue: C('Nằm sấp, nâng tay, ngực và chân khỏi sàn cùng lúc, nhìn xuống sàn, giữ 2 giây.', 'Face down, lift arms, chest and legs together, eyes on the floor, hold 2 s.') });
  T.tke = () => ({ v: 'side', ms: 2200, props: [{ type: 'to', from: 'kn0', x: 44, y: 24, band: true }, { type: 'seg', a: [46, 0], b: [46, 50], w: 4 }],
    kf: [Object.assign({}, SIDE_ST, { hx: -5, hy: 42, t: 8, F: [[4, 2], [-8, 4]], p: [0, 40], s: [10, 10], e: [30, 30] }), { hx: 0, hy: 46, t: 2, d: 0.7 }, { d: 0.4 }, { hx: -5, hy: 42, t: 8, d: 0.9 }],
    cue: C('Dây ở sau gối kéo tới trước, duỗi thẳng gối hết cỡ, siết đùi trước.', 'Band behind the knee pulling forward, lock the knee out fully, squeeze the quad.') });
  // ── ĐẨY ──
  const BENCH = (ang) => ang === 'incline' ? [seat(-8, 16, 22), { type: 'seg', a: [-6, 24], b: [-30, 50], w: 6 }] : ang === 'decline' ? [{ type: 'seg', a: [8, 32], b: [-40, 16], w: 6 }, { type: 'box', x: -16, w: 6, h: 22 }] : [seat(-44, 52, 18)];
  const LIE = { flat: { hx: 0, hy: 22, t: -90, F: [[18, 2], [14, 2]], p: [0, 0] }, incline: { hx: 0, hy: 27, t: -55, F: [[20, 2], [16, 2]], p: [0, 0] }, decline: { hx: 2, hy: 30, t: -110, F: [[18, 20], [14, 20]], p: [0, 0], kb: 1 } };
  T.bench = (o) => {
    const a = o.angle || 'flat', base = LIE[a], props = BENCH(a), eq = o.hold || 'bb';
    const sh = add([base.hx, base.hy], 180 - base.t, L.trunk), up = a === 'incline' ? [sh[0] + 3, sh[1] + 28] : [sh[0] + 2, sh[1] + 28];
    const dn = [sh[0] + 5, sh[1] + 9];
    props.push(eq === 'db' ? H('db') : H('bb', 'wr0'));
    return { v: 'side', ms: 3000, props, kf: loop(Object.assign({}, base, { W: [up, [up[0] - 1, up[1]]] }), { W: [dn, [dn[0] - 1, dn[1]]] }, 1.2, 0.2, 0.9, 0.3),
      cue: o.close ? C('Tay hẹp bằng vai, khuỷu sát người, hạ thanh xuống ngực dưới, đẩy bằng tay sau.', 'Shoulder-width grip, elbows tucked, lower to the low chest, press with the triceps.')
        : C('Xương bả vai khép và ép ghế, chân bám sàn, hạ tạ chạm ngực có kiểm soát rồi đẩy lên.', 'Shoulder blades pinched into the bench, feet planted, lower to the chest under control and press.') };
  };
  T.flyLying = (o) => {
    const a = o.angle || 'flat', base = LIE[a], props = BENCH(a).concat([H('db')]);
    const sh = add([base.hx, base.hy], 180 - base.t, L.trunk);
    return { v: 'side', ms: 3000, props, kf: loop(Object.assign({}, base, { W: [[sh[0] + 2, sh[1] + 27], [sh[0] + 1, sh[1] + 27]], as: [1, 1] }), { W: [[sh[0] + 4, sh[1] - 4], [sh[0] + 3, sh[1] - 4]], as: [0.55, 0.55] }, 1.2, 0.2, 1, 0.3),
      cue: C('Khuỷu hơi cong cố định, mở tay rộng xuống tới ngang ngực như ôm thùng phi, rồi khép lại.', 'Fixed soft elbows, open wide down to chest level as if hugging a barrel, then bring them together.') };
  };
  T.cableFly = (o) => {
    const hi = o.pulley === 'high', lo = o.pulley === 'low', ay = hi ? 112 : lo ? 8 : 78;
    const open = hi ? [[38, 94], [-38, 94]] : lo ? [[34, 44], [-34, 44]] : [[38, 72], [-38, 72]];
    const shut = hi ? [[4, 50], [-4, 50]] : lo ? [[4, 76], [-4, 76]] : [[4, 64], [-4, 64]];
    const press = o.press;
    return { v: 'front', ms: 2800, props: [{ type: 'cable2', x: 62, y: ay }], kf: loop(Object.assign({}, FR_ST, { F: [[10, 2], [-10, 2]], W: open, as: [1, 1] }), { W: shut, as: press ? [0.5, 0.5] : [0.8, 0.8] }, 1, 0.3, 1, 0.2),
      cue: press ? C('Đứng giữa hai cáp, đẩy tay ra trước và gom vào giữa ngực, thân không đổ tới.', 'Stand between the cables, press out and together in front of the chest, trunk stays put.')
        : C('Khuỷu hơi cong, kéo hai tay theo vòng cung gặp nhau ' + (hi ? 'trước hông' : lo ? 'ngang mặt' : 'trước ngực') + ', siết ngực.', 'Soft elbows, arc the hands together ' + (hi ? 'in front of the hips' : lo ? 'at face height' : 'in front of the chest') + ', squeeze the chest.') };
  };
  T.pecDec = () => ({ v: 'front', ms: 2800, props: [seat(-14, 28, 26), { type: 'seg', a: [0, 30], b: [0, 70], w: 7 }],
    kf: loop({ hx: 0, hy: 30, t: 0, F: [[14, 2], [-14, 2]], p: [0, 0], W: [[36, 58], [-36, 58]], as: [1, 1] }, { W: [[5, 52], [-5, 52]], as: [0.6, 0.6] }, 1, 0.3, 1.1, 0.2),
    cue: C('Ngồi thẳng, lưng tựa ghế, khép hai tay trước ngực, mở ra chậm tới khi ngực căng.', 'Sit tall against the pad, bring the arms together in front, open slowly to a chest stretch.') });
  T.suspFly = () => ({ v: 'front', ms: 2800, props: [{ type: 'to', from: 'wr0', x: 14, y: 118 }, { type: 'to', from: 'wr1', x: -14, y: 118 }],
    kf: loop(Object.assign({}, FR_ST, { W: [[5, 76], [-5, 76]], as: [0.6, 0.6] }), { hy: 40, W: [[38, 72], [-38, 72]], as: [1, 1] }, 1.2, 0.2, 1, 0.3),
    cue: C('Người nghiêng tới, thân cứng như tấm ván, mở tay rộng rồi kéo dây gom về trước ngực.', 'Lean in with a stiff plank body, open the arms wide, then pull the straps together.') });
  const PU_TOP = { hx: -28, hy: 20, t: 68, F: [[-70, 8.5], [-71, 8.5]], p: [72, 72], W: [[0, 2], [2, 2]] };
  T.pushUp = (o) => {
    const e = JSON.parse(JSON.stringify(EX['normal push up (bodyweight)']));
    if (o.plate) e.props = [H('plate', 'hip', { dx: 18, dy: 6 })];
    if (o.knee) { e.kb = 1; e.kf[0] = Object.assign({}, e.kf[0], { hx: -23, hy: 15.8, t: 56, F: [[-58, 16], [-59, 16]], p: [90, 90] }); e.kf[1] = Object.assign({}, e.kf[1], { hx: -19, hy: 6.5, t: 81 });
      e.kf[3] = Object.assign({}, e.kf[3], { hx: -23, hy: 15.8, t: 56 }); e.cue = C('Gối chạm sàn, thân thẳng từ gối tới đầu, hạ ngực gần sàn rồi đẩy lên.', 'Knees down, straight line knees to head, lower the chest near the floor and push up.'); }
    if (o.box) { const h = o.box; e.props = [seat(-4, 14, h)]; e.kf = [{ hx: -32, hy: 26 + h * 0.5, t: 60 - h * 0.4, F: [[-64, 8.5], [-65, 8.5]], p: [72, 72], W: [[4, h + 2], [6, h + 2]] }, { hx: -28, hy: 16 + h * 0.5, t: 68 - h * 0.4, d: 1.1 }, { d: 0.2 }, { hx: -32, hy: 26 + h * 0.5, t: 60 - h * 0.4, d: 0.9 }, { d: 0.3 }];
      e.cue = C('Tay trên bục / bàn, người thẳng, hạ ngực về mép rồi đẩy — càng cao càng dễ.', 'Hands on a box or counter, body straight, chest to the edge and push — higher is easier.'); }
    if (o.close) e.cue = C('Hai tay sát nhau dưới ngực, khuỷu ép sát người — dồn vào tay sau.', 'Hands close under the chest, elbows tight to the body — loads the triceps.');
    if (o.band) { e.props = [{ type: 'to', from: 'hip', x: 0, y: 2, band: true }]; e.cue = C('Dây kháng lực đỡ dưới hông giúp đẩy dễ hơn, thân vẫn thẳng.', 'A band under the hips helps you up, the body stays straight.'); }
    return e;
  };
  T.pike = (o) => ({ v: 'side', ms: 2800, props: o && o.hand ? [{ type: 'wall', x: 6, h: 110 }] : [],
    kf: o && o.hand ? loop({ hx: 2, hy: 58, t: 178, nk: 0, F: [[0, 104], [-2, 104]], p: [90, 90], W: [[-2, 2], [0, 2]] }, { hy: 46, t: 176 }, 1.2, 0.2, 1, 0.3)
      : loop({ hx: -30, hy: 44, t: 120, F: [[-60, 8.5], [-61, 8.5]], p: [60, 60], W: [[0, 2], [2, 2]] }, { hx: -26, hy: 36, t: 135 }, 1.1, 0.2, 0.9, 0.3),
    cue: o && o.hand ? C('Trồng chuối dựa tường, hạ đầu gần sàn có kiểm soát rồi đẩy thẳng tay.', 'Handstand against the wall, lower the head near the floor under control, press to straight arms.')
      : C('Hông cao như chữ V ngược, hạ đỉnh đầu về sàn giữa hai tay rồi đẩy lên — tập vai.', 'Hips high in an inverted V, lower the crown of the head between the hands and push — a shoulder press.') });
  T.dip = (o) => ({ v: 'side', ms: 2800, props: [{ type: 'bars', x1: -12, x2: 16, y: 62 }].concat(o && o.plate ? [H('plate', 'hip', { dy: -6 })] : []).concat(o && o.band ? [{ type: 'to', from: 'kn0', x: 2, y: 62, band: true }] : []),
    kf: loop({ hx: -2, hy: 40, t: 8, W: [[4, 62], [2, 62]], h: [20, 20], k: [80, 80], p: [30, 30] }, { hx: -6, hy: 26, t: 22 }, 1.1, 0.2, 0.9, 0.3),
    cue: C('Thân hơi đổ tới, hạ tới khuỷu ~90° rồi đẩy thẳng tay, vai không nhún lên tai.', 'Lean slightly forward, lower to ~90° elbows and press to straight arms, shoulders away from the ears.') });
  T.ohp = (o) => {
    const eq = o.hold || 'bb', props = [];
    let base = Object.assign({}, SIDE_ST, { F: [[4, 2], [0, 2]] }), dn = [[7, 80], [5, 80]], up = [[2, 106], [0, 106]];
    if (o.seated) { base = { hx: 0, hy: 30, t: -4, F: [[20, 2], [16, 2]], p: [0, 0] }; props.push(seat(-12, 22, 26), { type: 'seg', a: [-12, 30], b: [-14, 64], w: 5 }); dn = [[6, 64], [4, 64]]; up = [[0, 90], [-2, 90]]; }
    if (o.behind) { dn = dn.map((w) => [w[0] - 9, w[1]]); }
    if (o.arnold) dn = [[10, 70], [8, 70]];
    if (o.one) { up = [up[0], [dn[1][0] - 6, dn[1][1] - 30]]; dn = [dn[0], [dn[1][0] - 6, dn[1][1] - 30]]; }
    props.push(eq === 'db' ? (o.one ? H('db1') : H('db')) : eq === 'machine' ? { type: 'seg', a: [-16, 60], b: [-16, 110], w: 5 } : eq === 'cable' ? { type: 'cable2', x: 40, y: 10 } : H('bb', 'wr0'));
    if (eq === 'smith') props.push({ type: 'seg', a: [10, 0], b: [10, 120], w: 2 });
    if (o.push) return { v: 'side', ms: 2400, props, kf: [Object.assign({}, base, { W: dn }), { hy: 40, t: 4, W: dn.map((w) => [w[0], w[1] - 6]), d: 0.4 }, { hy: 47, F: [[4, 3], [0, 3]], p: [20, 20], W: up, d: 0.35 }, { F: [[4, 2], [0, 2]], p: [0, 0], d: 0.2 }, { hy: 46, W: dn, d: 0.8 }],
      cue: C('Nhún gối ngắn rồi bật chân, dùng lực đó đẩy tạ qua đầu, khoá tay ở trên.', 'Short knee dip then drive the legs and use it to press overhead, lock out at the top.') };
    return { v: 'side', ms: 2800, props, kf: loop(Object.assign({}, base, { W: dn }), { W: up }, 1, 0.25, 1.1, 0.25),
      cue: o.behind ? C('Hạ thanh ra sau gáy vừa tầm vai cho phép, đẩy thẳng lên — chỉ khi vai linh hoạt tốt.', 'Lower behind the neck only as far as the shoulders allow, press straight up — only with good shoulder mobility.')
        : o.arnold ? C('Bắt đầu lòng bàn tay hướng vào mặt, vừa đẩy vừa xoay ra ngoài tới khoá tay trên đầu.', 'Start palms facing you, rotate them out as you press to lockout overhead.')
        : C('Gồng bụng và mông, đẩy tạ thẳng lên qua đầu, đầu hơi lùi cho tạ đi qua, khoá tay ở trên.', 'Brace abs and glutes, press straight up, move the head back to clear the path, lock out overhead.') };
  };
  T.landSeated = () => { const e = JSON.parse(JSON.stringify(EX['standing landmine shoulder press (barbell)']));
    e.props = [e.props[0], seat(-14, 22, 26)]; e.kf = e.kf.map((k) => { const n = Object.assign({}, k); if (n.F) { n.F = [[20, 2], [16, 2]]; n.hx = 0; n.hy = 30; n.t = 4; } if (n.W) n.W = n.W.map((w) => [w[0], w[1] - 16]); return n; }); return e; };
  T.latRaise = (o) => {
    const eq = o.hold || 'db', props = [], top = o.y ? 140 : o.lu ? 172 : 88;
    if (eq === 'db') props.push(o.one ? H('db1') : H('db')); if (eq === 'cable') props.push({ type: 'to', from: 'wr0', x: -40, y: 6 });
    let base = Object.assign({}, FR_ST, { s: [12, 12], e: [12, 12] });
    if (o.seated) { base = { hx: 0, hy: 30, t: 0, F: [[14, 2], [-14, 2]], p: [0, 0], s: [12, 12], e: [12, 12] }; props.push(seat(-14, 28, 26)); }
    const up = { s: [top, o.one || eq === 'cable' ? 12 : top] };
    return { v: 'front', ms: 2800, props, kf: loop(base, up, 1, 0.3, 1.2, 0.2),
      cue: o.y ? C('Nâng tay chéo lên thành chữ Y, ngón cái hướng lên, vai không nhún.', 'Raise the arms up and out into a Y, thumbs up, no shrugging.')
        : o.lu ? C('Nâng tay sang ngang rồi tiếp tục lên qua đầu, tạ nhẹ, kiểm soát cả đường.', 'Raise out to the side and keep going overhead, light weight, control the whole arc.')
        : C('Khuỷu hơi cong, nâng sang ngang tới ngang vai, dẫn bằng khuỷu, không vung người.', 'Soft elbows, raise out to shoulder height leading with the elbows, no swinging.') };
  };
  T.frontRaise = (o) => ({ v: 'side', ms: 2800, props: o && o.hold === 'cable' ? [{ type: 'cable', x: -20, y: 6, hand: 'mid' }] : [H(o && o.hold === 'plate' ? 'plate' : 'db')],
    kf: loop(Object.assign({}, SIDE_ST, { s: [2, 2], e: [8, 8] }), { s: [95, 95] }, 1, 0.3, 1.2, 0.2),
    cue: C('Nâng tay thẳng ra trước tới ngang vai, không ngả người lấy đà, hạ chậm.', 'Raise straight out front to shoulder height, no leaning back for momentum, lower slowly.') });
  T.proneRaise = (o) => ({ v: 'side', ms: 2800, props: [{ type: 'seg', a: [2, 36], b: [26, 58], w: 6 }, { type: 'box', x: -2, w: 6, h: 36 }, H('db')],
    kf: loop({ hx: 0, hy: 40, t: 50, F: [[-20, 2], [-24, 2]], p: [30, 30], s: [50, 50], e: [6, 6] }, { s: [o && o.y ? 170 : 175, o && o.y ? 170 : 175] }, 1, 0.3, 1.2, 0.2),
    cue: o && o.y ? C('Nằm sấp trên ghế dốc, nâng tay thành chữ Y theo thân, ngón cái hướng lên — tập cơ thang dưới.', 'Chest down on an incline bench, raise the arms into a Y in line with the body, thumbs up — lower traps.')
      : C('Nằm sấp trên ghế dốc, nâng tay thẳng ra trước theo hướng thân, chậm.', 'Chest down on an incline bench, raise the arms straight out in line with the body, slowly.') });
  T.iRaise = () => ({ v: 'side', ms: 2600,
    kf: [{ hx: 0, hy: 4, t: 90, nk: 0, s: [180, 180], e: [0, 0], h: [0, 0], k: [0, 0], p: [70, 70] }, { s: [196, 196], t: 86, d: 0.8 }, { d: 0.5 }, { s: [180, 180], t: 90, d: 0.9 }],
    cue: C('Nằm sấp, tay duỗi qua đầu thành chữ I, nâng tay khỏi sàn bằng lưng trên, cổ thẳng.', 'Face down, arms overhead in an I, lift them off the floor with the upper back, neck neutral.') });
  T.uprightRow = (o) => ({ v: 'side', ms: 2600, eb: 1, props: o && o.hold === 'cable' ? [{ type: 'cable', x: 6, y: 4, hand: 'mid' }] : [o && o.hold === 'db' ? H('db') : H('bb', 'wr0')],
    kf: loop(Object.assign({}, SIDE_ST, { W: [[6, 40], [4, 40]] }), { W: [[8, 74], [6, 74]] }, 1, 0.25, 1.1, 0.25),
    cue: C('Kéo tạ thẳng lên sát người tới dưới ngực, khuỷu dẫn và cao hơn cổ tay.', 'Pull straight up close to the body to the lower chest, elbows lead and stay above the wrists.') });
  T.shrug = (o) => ({ v: 'side', ms: 2200, props: [o && o.hold === 'db' ? H('db') : H('bb', 'wr0')],
    kf: loop(Object.assign({}, SIDE_ST, { s: [2, 2], e: [0, 0], tl: 1 }), { tl: 1.14 }, 0.7, 0.5, 0.9, 0.2),
    cue: C('Tay thả thẳng, nhún vai thẳng lên tai, giữ 1 giây — không xoay vai.', 'Arms straight, shrug straight up to the ears, hold a second — do not roll the shoulders.') });
  T.pushdown = (o) => ({ v: 'side', ms: 2400, props: [{ type: 'cable', x: 14, y: 112, hand: o && o.one ? 0 : 'mid' }],
    kf: loop(Object.assign({}, SIDE_ST, { t: 8, s: [6, o && o.one ? -10 : 6], e: [125, o && o.one ? 20 : 125] }), { e: [5, o && o.one ? 20 : 5] }, 0.9, 0.3, 1.1, 0.2),
    cue: C('Khuỷu khoá sát sườn, chỉ cẳng tay di chuyển, duỗi thẳng tay xuống và siết tay sau.', 'Elbows pinned to the sides, only the forearms move, straighten fully and squeeze the triceps.') });
  T.ohExt = (o) => ({ v: 'side', ms: 2600, props: o && o.cable ? [{ type: 'cable', x: -24, y: 8, hand: 'mid' }] : [H(o && o.hold === 'bb' ? 'bb' : 'db', o && o.hold === 'bb' ? 'wr0' : 'hands', o && o.hold === 'bb' ? {} : { dy: 0 })],
    kf: loop(Object.assign({}, SIDE_ST, { t: o && o.cable ? 20 : 2, s: [172, o && o.one ? -6 : 172], e: [150, o && o.one ? 10 : 150] }), { e: [6, o && o.one ? 10 : 6] }, 0.9, 0.3, 1.1, 0.2),
    cue: C('Khuỷu chỉ thẳng lên trần và đứng yên, hạ tạ ra sau đầu rồi duỗi thẳng tay.', 'Elbows point at the ceiling and stay still, lower behind the head then extend fully.') });
  T.skull = (o) => ({ v: 'side', ms: 2600, props: BENCH('flat').concat([o && o.hold === 'db' ? H('db') : H('bb', 'wr0')]),
    kf: loop(Object.assign({}, LIE.flat, { s: [70, 70], e: [0, 0] }), { e: [125, 125] }, 1.1, 0.2, 0.9, 0.3),
    cue: C('Cánh tay trên giữ yên hơi nghiêng về đầu, gập khuỷu hạ tạ về trán / sau đầu rồi duỗi.', 'Upper arms still and tilted toward the head, bend the elbows to bring the weight to the forehead, then extend.') });
  T.kickback = (o) => ({ v: 'side', ms: 2400, props: o && o.cable ? [{ type: 'cable', x: 30, y: 30, hand: 0 }] : [H('db1')],
    kf: loop(Object.assign({}, SIDE_ST, { hx: -8, hy: 42, t: 62, F: [[6, 2], [-6, 2]], s: [-28, 70], e: [90, 20] }), { e: [-2, 20] }, 0.8, 0.4, 1.1, 0.2),
    cue: C('Gập người tới, cánh tay trên áp sát thân song song sàn, duỗi thẳng tay ra sau, siết 1 giây.', 'Hinge forward, upper arm tight to the body and level, extend the arm straight back, squeeze a second.') });
  // ── KÉO ──
  T.pullUp = (o) => { const e = JSON.parse(JSON.stringify(EX['pull-up']));
    if (o.plate) e.props.push(H('plate', 'hip', { dy: -8 }));
    if (o.band) e.props.push({ type: 'to', from: 'kn0', x: 6, y: 116, band: true });
    if (o.chin) e.cue = C('Lòng bàn tay hướng về mặt, tay rộng bằng vai, kéo ngực lên xà — tay trước làm nhiều hơn.', 'Palms facing you, shoulder-width grip, pull the chest to the bar — more biceps.');
    return e; };
  const PD_BASE = { hx: 0, hy: 30, t: -12, F: [[22, 2], [18, 2]], p: [0, 0] };
  T.pulldown = (o) => { const one = o && o.one, hip = o && o.hip;
    return { v: 'side', ms: 2800, eb: 1, props: [seat(-12, 22, 26), { type: 'seg', a: [8, 39], b: [24, 39], w: 5 }, { type: 'cable', x: 6, y: 112, hand: one ? 0 : 'mid' }],
      kf: loop(Object.assign({}, PD_BASE, { W: [[4, 86], one ? [-6, 40] : [2, 86]] }), { W: [[hip ? 4 : 8, hip ? 46 : 64], one ? [-6, 40] : [hip ? 2 : 6, hip ? 46 : 64]] }, 1, 0.3, 1.2, 0.2),
      cue: hip ? C('Kéo tay cầm vòng xuống về phía hông, cảm nhận lưng xô dưới co lại, ngực mở.', 'Pull the handle down and back toward the hip, feel the lower lats work, chest open.')
        : C('Ngực ưỡn nhẹ, kéo thanh về ngực trên bằng cách đưa khuỷu xuống và ra sau, không giật người.', 'Chest up, pull to the upper chest by driving the elbows down and back, no yanking.') }; };
  T.straightArm = () => ({ v: 'side', ms: 2600, props: [{ type: 'cable', x: 46, y: 112, hand: 'mid' }],
    kf: loop(Object.assign({}, SIDE_ST, { hx: -4, hy: 44, t: 26, F: [[6, 2], [2, 2]], s: [176, 176], e: [6, 6] }), { s: [26, 26] }, 1, 0.3, 1.2, 0.2),
    cue: C('Tay gần thẳng, kéo thanh vòng cung từ trên đầu xuống đùi bằng lưng xô, thân giữ yên.', 'Arms nearly straight, sweep the bar from overhead down to the thighs with the lats, trunk still.') });
  const BR = { hx: -10, hy: 42, t: 60, F: [[6, 2], [2, 2]], p: [0, 0] };
  T.bentRow = (o) => { const eq = o.hold || 'bb', t = o.pendlay ? 82 : 60, hip = o.pendlay ? [-12, 40] : [-10, 42];
    const sh = add(hip, 180 - t, L.trunk), hang = [sh[0], sh[1] - 28.5], top = [sh[0] - 9, sh[1] - 13];
    return { v: 'side', ms: 2600, props: [eq === 'db' ? (o.one ? H('db1') : H('db')) : H('bb', 'wr0')],
      kf: loop(Object.assign({}, BR, { hx: hip[0], hy: hip[1], t, W: [hang, o.one ? [sh[0] + 4, sh[1] - 20] : [hang[0] - 1, hang[1]]] }), { W: [top, o.one ? [sh[0] + 4, sh[1] - 20] : [top[0] - 1, top[1]]] }, 0.9, 0.3, 1.1, 0.2),
      cue: o.pendlay ? C('Thân gần song song sàn, mỗi lần kéo tạ từ sàn lên bụng thật dứt khoát, đặt tạ xuống lại.', 'Trunk nearly level, pull the bar from the floor to the belly explosively each rep, reset on the floor.')
        : C('Gập hông, lưng thẳng, kéo tạ về rốn bằng khuỷu, siết xương bả vai, hạ chậm.', 'Hinge, flat back, row to the belly button leading with the elbows, squeeze the shoulder blades, lower slowly.') }; };
  T.oneArmRow = () => ({ v: 'side', ms: 2600, props: [seat(16, 30, 22), H('db1')],
    kf: loop({ hx: -8, hy: 44, t: 80, F: [[4, 2], [-20, 2]], p: [0, 0], W: [[20, 18], [30, 24]] }, { W: [[8, 38], [30, 24]] }, 0.9, 0.3, 1.1, 0.2),
    cue: C('Một tay chống ghế, lưng phẳng, kéo tạ về hông theo đường vòng, không xoay thân.', 'One hand on the bench, flat back, row the weight to the hip in an arc, no trunk rotation.') });
  T.cableRow = (o) => ({ v: 'side', ms: 2600, eb: o && o.machine ? 1 : 1, props: o && o.machine ? [seat(-14, 24, 26), { type: 'seg', a: [26, 44], b: [26, 70], w: 6 }, { type: 'cable', x: 44, y: 60, hand: 'mid' }] : [seat(-12, 20, 8), seat(36, 8, 16), { type: 'cable', x: 46, y: 18, hand: 'mid' }],
    kf: o && o.machine ? loop({ hx: 0, hy: 30, t: 4, F: [[20, 2], [16, 2]], p: [0, 0], W: [[34, 56], [32, 56]] }, { t: -4, W: [[10, 54], [8, 54]] }, 0.9, 0.3, 1.1, 0.2)
      : loop({ hx: 0, hy: 12, t: 14, F: [[36, 18], [34, 18]], p: [-40, -40], W: [[40, 34], [38, 34]] }, { t: -6, W: [[10, 36], [8, 36]] }, 0.9, 0.3, 1.1, 0.2),
    cue: C('Ngồi thẳng, kéo tay cầm về bụng, khuỷu sát người, ưỡn ngực và siết xương bả vai, trả về chậm.', 'Sit tall, pull the handle to the belly with elbows close, chest up and blades squeezed, return slowly.') });
  T.chestRow = (o) => ({ v: 'side', ms: 2600, props: [{ type: 'seg', a: [3, 36], b: [26, 56], w: 6 }, { type: 'box', x: -2, w: 6, h: 36 }, H('db')],
    kf: loop({ hx: 0, hy: 40, t: 50, F: [[-20, 2], [-24, 2]], p: [30, 30], W: [[24, 28], [22, 28]] }, { W: [[o && o.wide ? 16 : 12, 46], [o && o.wide ? 14 : 10, 46]] }, 0.9, 0.3, 1.1, 0.2),
    cue: C('Ngực tựa ghế dốc, kéo tạ về sườn, siết xương bả vai — không nhấc ngực khỏi ghế.', 'Chest on the incline bench, row to the ribs, squeeze the blades — the chest stays on the pad.') });
  T.sealRow = () => ({ v: 'side', ms: 2600, props: [seat(-30, 66, 38), H('db')],
    kf: loop({ hx: 0, hy: 42, t: 90, h: [0, 0], k: [0, 0], p: [0, 0], W: [[30, 14], [28, 14]] }, { W: [[20, 36], [18, 36]] }, 0.9, 0.3, 1.1, 0.2),
    cue: C('Nằm sấp trên ghế cao, tay thả thẳng, kéo tạ lên sát ghế — không có đà từ chân hay lưng.', 'Face down on a high bench, arms hanging, row up to the bench — no help from legs or back.') });
  T.tbar = () => ({ v: 'side', ms: 2600, props: [{ type: 'landmine', x: -70, hand: 'mid' }],
    kf: loop(Object.assign({}, BR, { W: [[16, 28], [14, 28]] }), { W: [[8, 44], [6, 44]] }, 0.9, 0.3, 1.1, 0.2),
    cue: C('Đứng trên thanh, gập hông lưng thẳng, kéo tay cầm về ngực dưới, siết lưng giữa.', 'Straddle the bar, hinge with a flat back, pull the handle to the lower chest, squeeze the mid back.') });
  T.invRow = () => ({ v: 'side', ms: 2600, props: [{ type: 'bar', x1: -2, x2: 20, y: 42 }],
    kf: loop({ hx: -17, hy: 9, t: 84, F: [[-62, 4], [-63, 4]], p: [-60, -60], W: [[10, 40], [8, 40]] }, { hx: -20, hy: 21, t: 67 }, 0.9, 0.3, 1.1, 0.2),
    cue: C('Treo dưới xà, người thẳng từ gót tới đầu, kéo ngực lên chạm xà, hạ chậm.', 'Hang under the bar, body straight heels to head, pull the chest to the bar, lower slowly.') });
  T.renegade = () => ({ v: 'side', ms: 2600, props: [H('db')],
    kf: [Object.assign({}, PU_TOP, { F: [[-70, 8.5], [-64, 8.5]] }), { W: [[-6, 18], [2, 2]], d: 0.8 }, { W: [[0, 2], [2, 2]], d: 0.7 }, { W: [[0, 2], [-4, 18]], d: 0.8 }, { W: [[0, 2], [2, 2]], d: 0.7 }],
    cue: C('Plank trên hai tạ đơn, chân rộng, kéo từng bên về hông mà hông không xoay.', 'Plank on two dumbbells, feet wide, row each side to the hip without the hips twisting.') });
  T.highRow = (o) => ({ v: 'side', ms: 2600, eb: 1, props: o && o.cable ? [{ type: 'cable', x: 52, y: 84, hand: 'mid' }] : [o && o.hold === 'db' ? H('db') : H('bb', 'wr0')],
    kf: loop(Object.assign({}, SIDE_ST, { t: o && o.cable ? -4 : 20, hx: o && o.cable ? 0 : -4, W: o && o.cable ? [[32, 80], [30, 80]] : [[14, 44], [12, 44]] }), { W: o && o.cable ? [[8, 82], [6, 82]] : [[10, 76], [8, 76]] }, 0.9, 0.3, 1.1, 0.2),
    cue: C('Kéo về ngang ngực trên / mặt với khuỷu cao và mở, tập lưng trên và vai sau.', 'Pull to the upper chest / face with the elbows high and wide — upper back and rear delts.') });
  T.rearFly = (o) => ({ v: 'front', ms: 2600, props: o && o.cable ? [{ type: 'cable2', x: 56, y: 78 }] : o && o.band ? [{ type: 'bandHands' }] : [H('db')],
    kf: o && (o.cable || o.band) ? loop(Object.assign({}, FR_ST, { W: [[5, 76], [-5, 76]], as: [0.5, 0.5] }), { W: [[36, 78], [-36, 78]], as: [1, 1] }, 0.9, 0.3, 1.1, 0.2)
      : loop(Object.assign({}, FR_ST, { hy: 40, tl: 0.55, s: [6, 6], e: [12, 12] }), { s: [82, 82] }, 0.9, 0.3, 1.1, 0.2),
    cue: o && o.band ? C('Tay thẳng trước ngực, kéo dây dãn ra hai bên tới chạm ngực, siết xương bả vai.', 'Arms straight in front, pull the band apart to the chest, squeeze the shoulder blades.')
      : C('Gập người (hoặc tựa ghế), mở tay sang ngang bằng vai sau, khuỷu hơi cong, không nhún vai.', 'Hinged (or chest supported), open the arms out with the rear delts, soft elbows, no shrugging.') });
  T.pullover = () => ({ v: 'side', ms: 3000, props: BENCH('flat').concat([H('plate', 'hands', { r: 5 })]),
    kf: loop(Object.assign({}, LIE.flat, { s: [90, 90], e: [12, 12] }), { s: [175, 175] }, 1.2, 0.25, 1, 0.3),
    cue: C('Hai tay ôm một tạ trên ngực, khuỷu hơi cong, hạ ra sau đầu tới khi lưng xô căng rồi kéo về.', 'Hold one weight above the chest, soft elbows, lower behind the head to a lat stretch, pull back.') });
  T.curl = (o) => {
    const eq = o.hold || 'db', alt = o.alt, props = [];
    props.push(eq === 'bb' ? H('bb', 'wr0') : eq === 'cable' ? { type: 'cable', x: 16, y: 4, hand: 'mid' } : H('db'));
    let base = Object.assign({}, SIDE_ST, { s: [2, 2], e: [8, 8] }), up = { e: alt ? [140, 8] : [140, 140] };
    if (o.seated) { base = { hx: 0, hy: 30, t: 0, F: [[20, 2], [16, 2]], p: [0, 0], s: [0, 0], e: [8, 8] }; props.push(seat(-12, 22, 26)); }
    if (o.incline) { base = { hx: 0, hy: 27, t: -50, F: [[22, 2], [18, 2]], p: [0, 0], s: [-58, -58], e: [8, 8] }; props.push(seat(-8, 16, 22), { type: 'seg', a: [-6, 24], b: [-30, 50], w: 6 }); up = { e: [140, 140] }; }
    if (o.preacher) { base = { hx: -6, hy: 32, t: 8, F: [[16, 2], [12, 2]], p: [0, 0], s: [52, 52], e: [6, 6] }; props.push(seat(-18, 22, 28), { type: 'seg', a: [8, 52], b: [26, 36], w: 6 }); up = { e: [120, 120] }; }
    if (o.spider) { base = { hx: 0, hy: 40, t: 50, F: [[-20, 2], [-24, 2]], p: [30, 30], s: [50, 50], e: [4, 4] }; props.push({ type: 'seg', a: [3, 36], b: [26, 56], w: 6 }, { type: 'box', x: -2, w: 6, h: 36 }); up = { e: [135, 135] }; }
    const kf = alt ? [base, Object.assign({}, up, { d: 0.8 }), { e: [8, 8], d: 0.8 }, { e: [8, 140], d: 0.8 }, { e: [8, 8], d: 0.8 }] : loop(base, up, 0.9, 0.3, 1.2, 0.2);
    return { v: 'side', ms: alt ? 3600 : 2600, props, kf,
      cue: o.reverse ? C('Lòng bàn tay úp, cuộn tạ lên bằng cẳng tay và tay trước, khuỷu đứng yên.', 'Palms down, curl up with the forearms and biceps, elbows stay still.')
        : o.hammer ? C('Lòng bàn tay hướng vào nhau như cầm búa, cuộn lên, khuỷu sát sườn.', 'Palms facing each other like holding a hammer, curl up, elbows at the sides.')
        : o.zottman ? C('Cuộn lên lòng tay ngửa, xoay úp ở trên, hạ chậm với lòng tay úp.', 'Curl up palms up, rotate palms down at the top, lower slowly palms down.')
        : o.preacher ? C('Cánh tay trên áp đệm, cuộn lên hết tầm, hạ chậm tới gần thẳng tay.', 'Upper arms on the pad, curl through full range, lower slowly to nearly straight.')
        : o.spider ? C('Nằm sấp trên ghế dốc, tay thả thẳng đứng, cuộn lên — không đung đưa.', 'Chest on an incline bench, arms hanging straight down, curl up — no swinging.')
        : o.incline ? C('Ngả lưng ghế dốc, tay thả sau thân để tay trước căng dài, cuộn lên không đưa khuỷu tới.', 'Lie back on an incline, arms hanging behind the body for a long stretch, curl without the elbows drifting forward.')
        : C('Khuỷu sát sườn đứng yên, cuộn tạ lên, siết tay trước, hạ chậm — không vung người.', 'Elbows pinned at the sides, curl up and squeeze, lower slowly — no body swing.') };
  };
  T.extRotBW = () => { const e = JSON.parse(JSON.stringify(EX['external rotation (cable)'])); e.props = []; return e; };
  // ── CORE ──
  const PLANK = { hx: -25, hy: 14, t: 83, F: [[-70, 8.5], [-71, 8.5]], p: [72, 72], s: [83, 83], e: [90, 90] };
  T.plank = (o) => ({ v: 'side', ms: 3000, props: o && o.plate ? [H('plate', 'hip', { dx: 14, dy: 7 })] : [],
    kf: [Object.assign({}, PLANK), { hy: 14.6, d: 1 }, { hy: 14, d: 1 }],
    cue: C('Khuỷu dưới vai, siết mông và bụng, người thẳng một đường từ đầu tới gót, thở đều.', 'Elbows under the shoulders, squeeze glutes and abs, one straight line head to heels, keep breathing.') });
  T.plankPike = () => ({ v: 'side', ms: 2600, kf: loop(Object.assign({}, PU_TOP), { hx: -30, hy: 44, t: 120 }, 1, 0.3, 1, 0.3),
    cue: C('Từ plank thẳng tay, gập hông đẩy mông lên cao thành chữ V ngược, chân thẳng, rồi về plank.', 'From a straight-arm plank, pike the hips up into an inverted V, legs straight, back to plank.') });
  T.plankPull = (o) => ({ v: 'side', ms: 2600, props: [o && o.cable ? { type: 'cable', x: 40, y: 6, hand: 0 } : { type: 'to', from: 'wr0', x: 40, y: 4, band: true }],
    kf: loop(Object.assign({}, PU_TOP, { F: [[-70, 8.5], [-64, 8.5]] }), { W: [[-8, 22], [2, 2]] }, 0.9, 0.3, 1, 0.3),
    cue: C('Plank thẳng tay, một tay kéo dây về hông mà hông không xoay, không võng.', 'Straight-arm plank, row the band to the hip with one hand — hips do not twist or sag.') });
  T.bear = () => ({ v: 'side', ms: 1600, kb: 1,
    kf: [{ hx: 0, hy: 26, t: 80, F: [[-20, 8], [-12, 4]], p: [70, 70], W: [[30, 2], [24, 4]] }, { F: [[-12, 4], [-20, 8]], W: [[24, 4], [30, 2]], d: 1 }, { F: [[-20, 8], [-12, 4]], W: [[30, 2], [24, 4]], d: 1 }],
    cue: C('Bò bốn chân, gối nhấc khỏi sàn vài cm, lưng phẳng, bước tay – chân đối bên nhỏ và chậm.', 'On all fours, knees hovering an inch off the floor, flat back, small slow steps with opposite hand and foot.') });
  T.climber = () => ({ v: 'side', ms: 900,
    kf: [Object.assign({}, PU_TOP, { F: [[-34, 14], [-70, 8.5]], p: [60, 72] }), { F: [[-70, 8.5], [-34, 14]], p: [72, 60], d: 1 }, { F: [[-34, 14], [-70, 8.5]], p: [60, 72], d: 1 }],
    cue: C('Plank thẳng tay, kéo gối về ngực luân phiên thật nhanh, hông không nhổm lên.', 'Straight-arm plank, drive the knees to the chest alternately and fast, hips stay low.') });
  const SUP = { hx: 0, hy: 4, t: -90, nk: 0, F: [[18, 2], [14, 2]], p: [0, 0] };
  T.crunch = (o) => ({ v: 'side', ms: 2400, props: o && o.plate ? [H('plate', 'hands')] : [],
    kf: loop(Object.assign({}, SUP, o && o.plate ? { s: [150, 150], e: [150, 150] } : { s: [200, 200], e: [140, 140] }), { t: -58, nk: 15 }, 0.8, 0.4, 1, 0.2),
    cue: C('Lưng dưới ép sàn, cuộn vai và lưng trên lên bằng bụng, không kéo cổ, hạ chậm.', 'Low back on the floor, curl the shoulders up with the abs, do not pull on the neck, lower slowly.') });
  T.cableCrunch = () => ({ v: 'side', ms: 2600, kb: 1, props: [{ type: 'cable', x: 6, y: 120, hand: 'mid' }],
    kf: loop({ hx: 0, hy: 25, t: 15, F: [[-22, 3], [-23, 3]], p: [180, 180], W: [[6, 74], [4, 74]], eb: -1 }, { hx: 2, hy: 22, t: 75, W: [[22, 46], [20, 46]] }, 0.9, 0.3, 1.1, 0.2),
    cue: C('Quỳ, dây ở sau đầu, cuộn thân xuống bằng bụng (không gập hông), khuỷu về gối.', 'Kneel, rope by the head, curl the trunk down with the abs (not the hips), elbows to the knees.') });
  T.vsit = (o) => ({ v: 'side', ms: 2600, props: o && o.plate ? [H('plate', 'hands')] : [],
    kf: o && o.hold ? [{ hx: 0, hy: 5, t: -40, nk: 0, s: [80, 80], e: [10, 10], h: [95, 95], k: [10, 10], p: [10, 10] }, { t: -42, h: [93, 93], d: 1 }, { t: -40, h: [95, 95], d: 1 }]
      : loop({ hx: 0, hy: 5, t: -92, nk: 0, s: [180, 180], e: [0, 0], h: [0, 0], k: [0, 0], p: [10, 10] }, { t: -35, s: [85, 85], h: [100, 100] }, 0.8, 0.3, 1, 0.3),
    cue: o && o.hold ? C('Ngồi thăng bằng trên mông, thân và chân thành chữ V, lưng thẳng, giữ.', 'Balance on the sit bones, trunk and legs in a V, straight back, hold.')
      : C('Từ nằm thẳng, gập cùng lúc thân và chân thành chữ V, tay chạm mũi chân, hạ có kiểm soát.', 'From flat, fold trunk and legs together into a V, reach for the toes, lower under control.') });
  T.hollow = (o) => ({ v: 'side', ms: 3000, props: o && o.plate ? [H('plate', 'hands')] : [],
    kf: [{ hx: 0, hy: 5, t: -100, nk: 10, s: [175, 175], e: [0, 0], h: [12, 12], k: [0, 0], p: [10, 10] }, { h: [14, 14], t: -101, d: 1 }, { h: [12, 12], t: -100, d: 1 }],
    cue: C('Nằm ngửa, lưng dưới ép sàn, nhấc vai và chân khỏi sàn thành hình chuối, giữ.', 'On your back, low back pressed down, lift shoulders and legs into a banana shape, hold.') });
  T.bicycle = () => ({ v: 'side', ms: 1600,
    kf: [{ hx: 0, hy: 5, t: -65, nk: 10, s: [200, 200], e: [140, 140], h: [100, 40], k: [100, 5], p: [10, 10] }, { h: [40, 100], k: [5, 100], d: 1 }, { h: [100, 40], k: [100, 5], d: 1 }],
    cue: C('Vai nhấc khỏi sàn, đạp xe chậm, xoay khuỷu về gối đối bên, chân kia duỗi thấp.', 'Shoulders off the floor, pedal slowly, rotate elbow to the opposite knee, other leg long and low.') });
  T.legRaise = (o) => (o && o.hang) ? ({ v: 'side', ms: 2800, props: [{ type: 'bar', x1: -14, x2: 24, y: 116 }],
      kf: loop({ hx: 2, hy: 54, t: -2, W: [[6, 113], [4, 113]], h: [2, 2], k: [5, 5], p: [30, 30] }, { h: [92, 92], k: [10, 10], t: -12 }, 1, 0.3, 1.2, 0.2),
      cue: C('Treo xà, không đung đưa, nâng chân lên ngang hông bằng bụng, hạ chậm.', 'Hang without swinging, raise the legs to hip height with the abs, lower slowly.') })
    : ({ v: 'side', ms: 2600, kf: loop({ hx: 0, hy: 4, t: -90, nk: 0, s: [-10, -10], e: [0, 0], h: [8, 8], k: [0, 0], p: [10, 10] }, { h: [90, 90] }, 1, 0.2, 1.2, 0.2),
      cue: C('Nằm ngửa, tay dưới hông, lưng dưới ép sàn, nâng hai chân thẳng lên vuông góc rồi hạ chậm.', 'On your back, hands under the hips, low back down, raise straight legs to vertical, lower slowly.') });
  T.toeTap = () => ({ v: 'side', ms: 2400,
    kf: [{ hx: 0, hy: 4, t: -90, nk: 0, s: [-10, -10], e: [0, 0], h: [90, 90], k: [90, 90], p: [0, 0] }, { h: [30, 90], k: [100, 90], d: 1 }, { h: [90, 90], k: [90, 90], d: 0.8 }, { h: [90, 30], k: [90, 100], d: 1 }, { h: [90, 90], k: [90, 90], d: 0.8 }],
    cue: C('Chân bàn (hông – gối 90°), hạ từng chân chạm mũi xuống sàn, lưng dưới không rời sàn.', 'Tabletop legs, lower one foot at a time to tap the floor, low back stays down.') });
  T.mcgill = () => ({ v: 'side', ms: 2600,
    kf: [{ hx: 0, hy: 4, t: -90, nk: 0, s: [-20, -20], e: [0, 0], h: [0, 0], k: [0, 0], p: [0, 0], F: [[44, 2], [14, 2]] }, { t: -80, d: 0.8 }, { d: 0.8 }, { t: -90, d: 0.8 }],
    cue: C('Một gối co, tay dưới lưng dưới, nhấc nhẹ đầu và vai lên vài cm, cổ thẳng, giữ 8–10 giây.', 'One knee bent, hands under the low back, lift head and shoulders just an inch, neck neutral, hold 8–10 s.') });
  T.russian = () => ({ v: 'front', ms: 2200, props: [H('plate', 'hands')],
    kf: [{ hx: 0, hy: 8, t: 0, tl: 0.8, s: [30, 30], e: [70, 70], h: [150, 150], k: [150, 150], p: [0, 0], ls: [0.5, 0.5], W: [[-10, 22], [-16, 24]] }, { W: [[16, 24], [10, 22]], d: 1 }, { W: [[-10, 22], [-16, 24]], d: 1 }],
    cue: C('Ngồi ngả lưng 45°, chân co (hoặc nhấc khỏi sàn), xoay thân đưa tạ chạm sàn hai bên.', 'Sit leaning back 45°, knees bent (feet up to progress), rotate the trunk to touch each side.') });
  T.sideBend = (o) => ({ v: 'front', ms: 2600, props: [H(o && o.plate ? 'plate' : 'db1', o && o.plate ? 'wr0' : 'hands')],
    kf: loop(Object.assign({}, FR_ST, { t: -4, s: [4, 4], e: [0, 0] }), { t: 16 }, 1, 0.3, 1.1, 0.2),
    cue: C('Tạ một tay, nghiêng sang bên có tạ rồi kéo thân về thẳng bằng bụng chéo bên kia.', 'Weight in one hand, bend toward it, then pull upright with the obliques on the other side.') });
  T.abRoll = () => ({ v: 'side', ms: 3000, kb: 1, props: [{ type: 'wheel' }],
    kf: loop({ hx: 0, hy: 25, t: 30, nk: 0, F: [[-22, 3], [-23, 3]], p: [180, 180], W: [[16, 6], [14, 6]] }, { hx: 16, hy: 12, t: 84, W: [[56, 6], [54, 6]] }, 1.2, 0.2, 1, 0.3),
    cue: C('Quỳ, lăn bánh ra xa tới khi thân gần sàn mà lưng dưới không võng, kéo về bằng bụng.', 'Kneel, roll out until the body is low without the low back sagging, pull back with the abs.') });
  T.birdDog = (o) => ({ v: 'side', ms: 3000, kb: 1, props: o && o.plate ? [H('plate', 'hip', { dx: 6, dy: 4 })] : [],
    kf: [{ hx: 0, hy: 25, t: 80, F: [[-22, 3], [-23, 3]], p: [180, 180], W: [[30, 2], [32, 2]] }, { F: [[-22, 3], [-42, 27]], p: [180, 90], W: [[58, 32], [32, 2]], d: 1 }, { d: 0.6 }, { F: [[-22, 3], [-23, 3]], p: [180, 180], W: [[30, 2], [32, 2]], d: 1 }],
    cue: C('Bò bốn chân, duỗi tay và chân đối bên thành đường thẳng, hông không xoay, giữ 2 giây.', 'On all fours, reach the opposite arm and leg into one line, hips do not rotate, hold 2 s.') });
  T.chop = (o) => { const kneel = o && o.kneel, rev = o && o.rev;
    const hiW = [[-18, kneel ? 74 : 92], [-24, kneel ? 76 : 94]], loW = [[26, kneel ? 22 : 42], [20, kneel ? 20 : 40]];
    const base = kneel ? { hx: 0, hy: 25, t: 0, F: [[12, 2], [-10, 3]], p: [0, 0], ls: [[1, 1], [1, 0.25]] } : { hx: 0, hy: 44, t: 0, F: [[12, 2], [-12, 2]], p: [0, 0] };
    return { v: 'front', ms: 2600, props: o && o.cable ? [{ type: 'cable', x: rev ? 64 : -64, y: rev ? 6 : 112, hand: 'mid' }] : [H('ball')],
      kf: [Object.assign({}, base, { W: rev ? loW : hiW, t: rev ? 8 : -8 }), { W: rev ? hiW : loW, t: rev ? -8 : 8, d: 0.6 }, { d: 0.3 }, { W: rev ? loW : hiW, t: rev ? 8 : -8, d: 1 }],
      cue: rev ? C('Kéo chéo từ thấp bên này lên cao bên kia, xoay từ hông, tay gần thẳng.', 'Lift diagonally from low on one side to high on the other, rotate from the hips, arms nearly straight.')
        : C('Chặt chéo từ cao bên này xuống thấp bên kia, xoay hông theo, thân không gập.', 'Chop diagonally from high to the opposite low side, hips turn with it, trunk stays long.') }; };
  T.slam = (o) => o && o.side ? ({ v: 'front', ms: 2400, props: [{ type: 'ball' }],
      kf: [Object.assign({}, FR_ST, { F: [[13, 2], [-13, 2]], W: [[-14, 100], [-20, 100]], bf: 0, ball: [36, 5], t: -6 }), { hy: 36, t: 14, W: [[28, 30], [22, 32]], d: 0.4 }, { bf: 1, d: 0.25 }, { bf: 1, hy: 44, t: 0, W: [[8, 60], [-8, 60]], d: 0.5 }, { bf: 0, W: [[-14, 100], [-20, 100]], t: -6, d: 0.7 }],
      cue: C('Bóng qua đầu một bên, xoay thân ném mạnh xuống sàn chéo bên kia, hạ thấp người theo.', 'Ball overhead to one side, rotate and slam it down across the body, sink with it.') })
    : ({ v: 'side', ms: 2400, props: [{ type: 'ball' }],
      kf: [Object.assign({}, SIDE_ST, { W: [[2, 108], [0, 108]], F: [[3, 3], [-1, 3]], p: [20, 20], bf: 0, ball: [24, 5] }), { hx: -8, hy: 34, t: 40, W: [[24, 22], [22, 22]], F: [[3, 2], [-1, 2]], p: [0, 0], d: 0.4 }, { bf: 1, d: 0.25 }, { d: 0.3 }, { bf: 0, hx: 0, hy: 46, t: 2, W: [[2, 108], [0, 108]], d: 0.8 }],
      cue: C('Nhón lên vươn bóng qua đầu, đập bóng xuống sàn hết sức bằng bụng và lưng xô, gập hông theo.', 'Reach tall with the ball overhead, slam it into the floor with abs and lats, hinge with it.') });
  T.toss = () => ({ v: 'side', ms: 2400, props: [{ type: 'ball' }],
    kf: [Object.assign({}, SIDE_ST, { hx: -8, hy: 36, t: 40, W: [[20, 22], [18, 22]], bf: 0, ball: [110, 70] }), { hx: 2, hy: 48, t: -6, W: [[30, 86], [28, 86]], F: [[3, 4], [-1, 4]], p: [35, 35], d: 0.35 }, { bf: 1, d: 0.3 }, { F: [[3, 2], [-1, 2]], p: [0, 0], d: 0.2 }, { bf: 0, hx: -8, hy: 36, t: 40, W: [[20, 22], [18, 22]], d: 0.8 }],
    cue: C('Gập hông, bóng giữa hai chân, bật hông và chân ném bóng ra trước – lên cao.', 'Hinge with the ball between the legs, snap the hips and legs to throw it forward and up.') });
  T.rope = (o) => ({ v: 'side', ms: o && o.slam ? 1400 : 900, props: [{ type: 'waves', x: 84 }],
    kf: o && o.slam ? [Object.assign({}, SIDE_ST, { hx: -6, hy: 38, t: 20, F: [[8, 2], [-6, 2]], W: [[14, 80], [12, 80]], rp: 0 }), { W: [[22, 28], [20, 28]], hy: 34, rp: 180, d: 0.5 }, { W: [[14, 80], [12, 80]], hy: 38, rp: 360, d: 0.5 }]
      : [Object.assign({}, SIDE_ST, { hx: -6, hy: 36, t: 20, F: [[8, 2], [-6, 2]], W: [[24, 50], [24, 36]], rp: 0 }), { W: [[24, 36], [24, 50]], rp: 180, d: 1 }, { W: [[24, 50], [24, 36]], rp: 360, d: 1 }],
    cue: o && o.slam ? C('Hạ thấp, nâng hai đầu dây lên cao rồi đập mạnh xuống cùng lúc.', 'Stay low, lift both ropes high and slam them down together.')
      : C('Đứng thấp, bụng gồng, đánh dây luân phiên tay nhanh và đều.', 'Athletic stance, brace, whip the ropes alternately, fast and even.') });
  // ── CARDIO / TOÀN THÂN ──
  T.burpee = () => ({ v: 'side', ms: 3000, eb: -1,
    kf: [Object.assign({}, SIDE_ST, { W: [[6, 40], [4, 40]] }), { hx: -6, hy: 26, t: 60, W: [[18, 2], [20, 2]], d: 0.4 }, { hx: -28, hy: 20, t: 68, F: [[-70, 8.5], [-71, 8.5]], p: [72, 72], W: [[0, 2], [2, 2]], d: 0.35 }, { hx: -25, hy: 7.5, t: 84, d: 0.35 },
      { hx: -28, hy: 20, t: 68, d: 0.3 }, { hx: -6, hy: 26, t: 60, F: [[3, 2], [-1, 2]], p: [0, 0], W: [[18, 2], [20, 2]], d: 0.35 }, { hx: 0, hy: 62, t: 2, F: [[3, 16], [-1, 16]], p: [40, 40], W: [[6, 112], [4, 112]], d: 0.35 }, { hy: 46, F: [[3, 2], [-1, 2]], p: [0, 0], W: [[6, 40], [4, 40]], d: 0.35 }],
    cue: C('Ngồi xuống chống tay, bật chân ra plank, chống đẩy, nhảy chân về, bật nhảy vỗ tay trên đầu.', 'Squat and plant the hands, jump back to plank, push-up, jump the feet in, jump up and clap overhead.') });
  T.jack = () => ({ v: 'front', ms: 900,
    kf: [Object.assign({}, FR_ST, { F: [[6, 3], [-6, 3]], p: [30, 30], s: [8, 8], e: [10, 10] }), { hy: 49, F: [[22, 4], [-22, 4]], s: [170, 170], d: 1 }, { hy: 46, F: [[6, 3], [-6, 3]], s: [8, 8], d: 1 }],
    cue: C('Bật chân rộng – vỗ tay trên đầu, bật về – tay xuống, nhẹ nhàng trên mũi chân.', 'Jump the feet wide and clap overhead, jump back with arms down, light on the toes.') });
  T.rower = () => ({ v: 'side', ms: 2200, props: [{ type: 'rower', x1: -40, x2: 44 }],
    kf: [{ hx: 10, hy: 10, t: 25, F: [[34, 14], [32, 14]], p: [-30, -30], W: [[40, 30], [38, 30]] }, { hx: -16, hy: 10, t: -20, F: [[34, 14], [32, 14]], W: [[0, 32], [-2, 32]], d: 0.7 }, { hx: 10, hy: 10, t: 25, W: [[40, 30], [38, 30]], d: 1.3 }],
    cue: C('Đạp chân trước → ngả thân → kéo tay về sườn; về thì ngược lại: tay → thân → co gối.', 'Legs drive first → lean back → pull to the ribs; return in reverse: arms → body → knees.') });
  T.tread = () => { const e = JSON.parse(JSON.stringify(EX['chạy nhẹ (nói chuyện được)'])); e.props = [{ type: 'tread', x1: -40, x2: 40 }]; e.kf.forEach((k) => { k.hy = (k.hy || 46) + 4; }); return e; };
  T.carry = (o) => { const e = JSON.parse(JSON.stringify(EX["farmer's carry (dumbbell)"]));
    if (o.sb) { e.props = [H('sb', 'hands', { dy: 4 })]; e.kf.forEach((k) => { k.s = [40, 40]; k.e = [100, 100]; }); e.cue = C('Ôm bao cát sát ngực, đứng thẳng, bước ngắn đều — không ngả người ra sau.', 'Hug the sandbag tight to the chest, stand tall, short steady steps — do not lean back.'); }
    if (o.suitcase) { e.props = [H('kb1')]; e.cue = C('Tạ MỘT bên tay, người vẫn đứng thẳng không nghiêng — bụng chéo bên kia giữ.', 'Weight in ONE hand, stay perfectly upright — the opposite obliques hold you.'); }
    return e; };
  T.cleanJerk = () => ({ v: 'side', ms: 3000, props: [H('db1')],
    kf: [Object.assign({}, SIDE_ST, { hx: -10, hy: 38, t: 40, W: [[14, 22], [-4, 30]] }), { hx: 0, hy: 48, t: 0, W: [[8, 76], [-4, 36]], F: [[3, 3], [-1, 3]], p: [25, 25], d: 0.35 }, { hy: 42, F: [[3, 2], [-1, 2]], p: [0, 0], d: 0.3 }, { hy: 40, W: [[4, 100], [-4, 36]], d: 0.25 }, { hy: 46, d: 0.4 }, { d: 0.3 }, { hx: -10, hy: 38, t: 40, W: [[14, 22], [-4, 30]], d: 0.9 }],
    cue: C('Bật hông kéo tạ lên vai (clean), nhún gối rồi đẩy bật tạ qua đầu (jerk), khoá tay.', 'Snap the hips to bring the weight to the shoulder (clean), dip and drive it overhead (jerk), lock out.') });

  // ── GÁN TÊN BÀI → MẪU. Khớp theo thứ tự, mẫu đầu tiên trúng thắng. Tên đã có hình riêng (EX) không qua đây. ──
  const eqOf = (n) => /smith|barbell|\(ez|ez bar|t-bar|pendlay|good morning|rack pull|push press|zercher|bar row/.test(n) ? 'bb'
    : /kettlebell/.test(n) ? 'kb' : /dumbbell|\bdb\b/.test(n) ? 'db' : /cable/.test(n) ? 'cable' : /\(band|band\)|banded/.test(n) ? 'band' : /plate|weighted/.test(n) ? 'plate' : /machine/.test(n) ? 'machine' : 'bw';
  const RULES = [
    [/^thruster/, (n) => T.thruster({ bb: eqOf(n) === 'bb' })],
    [/med ball squat \+ wall throw/, () => T.ballSquatThrow()],
    [/wall sit/, () => T.wallSit()],
    [/kneeling squat/, () => T.kneelSquat()],
    [/cossack/, (n) => T.cossack({ hold: eqOf(n) })],
    [/sumo squat/, (n) => T.squat({ wide: true, hold: eqOf(n) === 'bw' ? 'none' : eqOf(n) })],
    [/goblet squat/, (n) => T.squat({ hold: 'goblet', kb: /kettlebell/.test(n) })],
    [/zercher squat/, () => T.squat({ hold: 'zercher' })],
    [/front squat/, () => T.squat({ hold: 'bbFront' })],
    [/hack squat|low bar squat|high bar squat|back squat/, () => T.squat({ hold: 'bbBack' })],
    [/squat \(assisted\)/, () => T.squat({ hold: 'none', assist: true })],
    [/squat \(high box\)/, () => T.squat({ hold: 'none', box: true })],
    [/^squat|bodyweight squat/, () => T.squat({ hold: 'none' })],
    [/leg press/, () => T.legPress()],
    [/leg extension/, () => T.legExtension()],
    [/lying leg curl/, () => T.legCurlLying()],
    [/leg curl \(swiss/, () => T.legCurlBall()],
    [/leg curl/, (n) => T.legCurlBand({ single: /single/.test(n) })],
    [/curtsy/, (n) => T.lunge({ type: 'curtsy', hold: eqOf(n) })],
    [/jumping lunge/, () => T.lunge({ type: 'jump' })],
    [/overhead lunge/, () => T.lunge({ type: 'fwd', hold: 'oh' })],
    [/walking lunge/, (n) => T.lunge({ type: 'walk', hold: eqOf(n) })],
    [/reverse lunge/, (n) => T.lunge({ type: 'reverse', hold: eqOf(n) })],
    [/deficit lunge/, (n) => T.lunge({ type: 'fwd', hold: eqOf(n), box: 5 })],
    [/front foot elevated split squat/, () => T.lunge({ type: 'split', box: 8 })],
    [/standing lunge/, (n) => T.lunge({ type: 'split', hold: eqOf(n) })],
    [/^lunge/, (n) => T.lunge({ type: 'fwd', hold: eqOf(n) })],
    [/side lunge \(barbell\)/, () => T.sideLungeBB()],
    [/side step up/, (n) => T.stepUp({ side: true, hold: eqOf(n) })],
    [/eccentric focus step up/, (n) => T.stepUp({ ecc: true, hold: eqOf(n) })],
    [/step up/, (n) => T.stepUp({ hold: eqOf(n) })],
    [/sumo deadlift/, (n) => T.deadlift({ sumo: true, hold: eqOf(n) === 'bb' ? 'bb' : eqOf(n) })],
    [/rack pull|block pull/, () => T.deadlift({ rack: true })],
    [/stiff-leg/, (n) => T.rdl({ hold: eqOf(n), stiff: true })],
    [/romanian deadlift/, (n) => T.rdl({ hold: eqOf(n) })],
    [/single leg kickstand/, () => T.singleLegDL({ kick: true })],
    [/single leg deadlift \(barbell\)/, () => T.singleLegDL({ hold: 'bb' })],
    [/deadlift/, (n) => T.deadlift({ hold: eqOf(n) === 'bw' ? 'bb' : eqOf(n) })],
    [/good morning/, (n) => T.goodMorning({ zercher: /zercher/.test(n) })],
    [/^swing/, () => T.swing()],
    [/pull through/, () => T.pullThrough()],
    [/glutes? bridge/, (n) => T.bridge({ hold: eqOf(n) === 'db' ? 'db' : null })],
    [/hip thrust/, (n) => T.hipThrust({ hold: /dumbbell/.test(n) ? 'db' : null })],
    [/seated calf raise/, (n) => T.calfSeat({ single: /single/.test(n), hold: eqOf(n) === 'db' ? 'db' : eqOf(n) === 'kb' ? 'kb' : null })],
    [/standing calf raise/, (n) => T.calfStand({ single: /single/.test(n), hold: eqOf(n) === 'machine' ? null : eqOf(n) })],
    [/kick ?back \(band\)|glute kick back/, () => T.quadKick()],
    [/glute kickback/, () => T.standKick()],
    [/side ?kick|glute abductor/, (n) => T.abduct({ band: /band/.test(n) })],
    [/clamshell/, () => T.clam()],
    [/fire hydrant/, () => T.hydrant()],
    [/glute ham raise/, () => T.ghr()],
    [/reverse hyper/, () => T.revHyper()],
    [/back extension hold/, (n) => T.backExt({ hold: true, plate: /weighted/.test(n) })],
    [/back extension/, () => T.backExt()],
    [/superman/, () => T.superman()],
    [/terminal knee/, () => T.tke()],
    // ĐẨY
    [/close grip bench/, () => T.bench({ close: true })],
    [/incline chest press/, (n) => T.bench({ angle: 'incline', hold: eqOf(n) })],
    [/decline chest press/, (n) => T.bench({ angle: 'decline', hold: eqOf(n) })],
    [/flat chest press|bench press/, (n) => T.bench({ hold: eqOf(n) })],
    [/incline chest fly/, () => T.flyLying({ angle: 'incline' })],
    [/decline chest fly/, () => T.flyLying({ angle: 'decline' })],
    [/flat chest fly/, () => T.flyLying({})],
    [/pulley chest fly/, (n) => T.cableFly({ pulley: /high/.test(n) ? 'high' : /low/.test(n) ? 'low' : 'mid' })],
    [/pulley chest press/, (n) => T.cableFly({ press: true, pulley: /high/.test(n) ? 'high' : /low/.test(n) ? 'low' : 'mid' })],
    [/pec dec/, () => T.pecDec()],
    [/suspension chest fly/, () => T.suspFly()],
    [/handstand push/, () => T.pike({ hand: true })],
    [/pike push/, () => T.pike({})],
    [/kneeling push/, () => T.pushUp({ knee: true })],
    [/counter push/, () => T.pushUp({ box: 40 })],
    [/box push/, () => T.pushUp({ box: 22 })],
    [/band assisted push/, () => T.pushUp({ band: true })],
    [/(band|plate|chain) push up \(plate\)|push up \(weighted\)/, () => T.pushUp({ plate: true })],
    [/close grip push|narrow push|diamond push/, () => T.pushUp({ close: true })],
    [/dip/, (n) => T.dip({ plate: /weighted|plate/.test(n), band: /assisted/.test(n) })],
    [/seated landmine/, () => T.landSeated()],
    [/arnold/, () => T.ohp({ hold: 'db', arnold: true })],
    [/push press/, () => T.ohp({ push: true })],
    [/machine shoulder press/, () => T.ohp({ seated: true, hold: 'machine' })],
    [/behind the neck/, (n) => T.ohp({ behind: true, seated: /seated/.test(n) })],
    [/one arm shoulder press/, (n) => T.ohp({ hold: 'db', one: true, seated: /seated/.test(n) })],
    [/shoulder press|overhead press/, (n) => T.ohp({ hold: /smith/.test(n) ? 'smith' : eqOf(n), seated: /seated/.test(n) })],
    [/lu raise/, () => T.latRaise({ lu: true })],
    [/y lateral|y-raise/, () => T.latRaise({ y: true, hold: 'cable' })],
    [/prone y/, () => T.proneRaise({ y: true })],
    [/prone front/, () => T.proneRaise({})],
    [/^i raise/, () => T.iRaise()],
    [/lateral (shoulder )?raise/, (n) => T.latRaise({ hold: eqOf(n), seated: /seated/.test(n), one: /one arm|lying/.test(n) })],
    [/front (shoulder )?raise/, (n) => T.frontRaise({ hold: eqOf(n) === 'cable' ? 'cable' : eqOf(n) === 'plate' ? 'plate' : 'db' })],
    [/upright row/, (n) => T.uprightRow({ hold: eqOf(n) })],
    [/shrug/, (n) => T.shrug({ hold: eqOf(n) })],
    [/rope triceps|triceps extension \(cable\)|crossbody triceps/, (n) => T.pushdown({ one: /one arm|crossbody/.test(n) })],
    [/overhead tric/, (n) => T.ohExt({ hold: eqOf(n) === 'db' ? 'db' : 'bb', one: /one arm/.test(n) })],
    [/skull crusher/, (n) => T.skull({ hold: eqOf(n) })],
    [/kick ?back/, (n) => T.kickback({ cable: /cable/.test(n) })],
    // KÉO
    [/chin[- ]?up/, (n) => T.pullUp({ chin: true, plate: /weighted/.test(n), band: /band/.test(n) })],
    [/pull[- ]?up/, (n) => T.pullUp({ plate: /weighted/.test(n), band: /band/.test(n) })],
    [/illiac/, (n) => T.pulldown({ hip: true, one: /unilateral/.test(n) })],
    [/straight[- ]arm|pull straight arm/, () => T.straightArm()],
    [/pull across/, () => T.straightArm()],
    [/pulldown/, (n) => T.pulldown({ one: /one arm/.test(n) })],
    [/pendlay/, () => T.bentRow({ pendlay: true })],
    [/single-arm row|one arm row/, () => T.oneArmRow()],
    [/bent[- ]over row|bent over row/, (n) => T.bentRow({ hold: eqOf(n) })],
    [/chest supported (wide )?row/, (n) => T.chestRow({ wide: /wide/.test(n) })],
    [/seal row/, () => T.sealRow()],
    [/t-bar/, () => T.tbar()],
    [/inverted row/, () => T.invRow()],
    [/renegade/, () => T.renegade()],
    [/machine seated row/, () => T.cableRow({ machine: true })],
    [/high row/, (n) => T.highRow({ cable: eqOf(n) === 'cable', hold: eqOf(n) })],
    [/rowing machine/, () => T.rower()],
    [/row/, () => T.cableRow({})],
    [/band pull-apart/, () => T.rearFly({ band: true })],
    [/rear delt fly|reverse fly/, (n) => T.rearFly({ cable: /cable/.test(n) })],
    [/pullover/, () => T.pullover()],
    [/face ?pull|pull to neck/, () => Object.assign({}, EX['face pull'])],
    [/external rotation/, () => T.extRotBW()],
    [/preacher/, (n) => T.curl({ preacher: true, hold: eqOf(n) })],
    [/spider curl/, (n) => T.curl({ spider: true, hold: eqOf(n) })],
    [/incline biceps/, (n) => T.curl({ incline: true, hold: eqOf(n) })],
    [/seated biceps/, (n) => T.curl({ seated: true, hold: eqOf(n) })],
    [/alternating hammer/, () => T.curl({ alt: true, hammer: true })],
    [/alternating biceps/, () => T.curl({ alt: true })],
    [/hammer curl/, (n) => T.curl({ hammer: true, hold: eqOf(n) })],
    [/reverse grip (biceps )?curl/, (n) => T.curl({ reverse: true, hold: eqOf(n) })],
    [/zottman/, () => T.curl({ zottman: true })],
    [/curl/, (n) => T.curl({ hold: eqOf(n) })],
    // CORE
    [/plank pikes/, () => T.plankPike()],
    [/banded plank pull/, (n) => T.plankPull({ cable: /cable/.test(n) })],
    [/^plank/, (n) => T.plank({ plate: /weighted/.test(n) })],
    [/bear crawl/, () => T.bear()],
    [/mountain climber/, () => T.climber()],
    [/cable crunch/, () => T.cableCrunch()],
    [/crunch/, (n) => T.crunch({ plate: /weighted/.test(n) })],
    [/v sit|jackknife/, () => T.vsit({})],
    [/v hold/, (n) => T.vsit({ hold: true, plate: /weighted/.test(n) })],
    [/hollow/, (n) => T.hollow({ plate: /weighted/.test(n) })],
    [/bicycle/, () => T.bicycle()],
    [/hanging leg raise/, () => T.legRaise({ hang: true })],
    [/leg raise/, () => T.legRaise({})],
    [/toe taps/, () => T.toeTap()],
    [/mcgill/, () => T.mcgill()],
    [/russian twist/, () => T.russian()],
    [/side bend/, (n) => T.sideBend({ plate: /plate/.test(n) })],
    [/ab roll/, () => T.abRoll()],
    [/bird dog/, (n) => T.birdDog({ plate: /weighted/.test(n) })],
    [/half kneeling reverse wood chop/, () => T.chop({ kneel: true, rev: true })],
    [/half kneeling wood chop/, () => T.chop({ kneel: true })],
    [/reverse wood chop \(cable/, () => T.chop({ rev: true, cable: true })],
    [/reverse wood chop/, () => T.chop({ rev: true })],
    [/wood chop/, () => T.chop({})],
    [/side slam/, () => T.slam({ side: true })],
    [/slam \(battle rope\)/, () => T.rope({ slam: true })],
    [/battle rope/, () => T.rope({})],
    [/slam/, () => T.slam({})],
    [/front toss/, () => T.toss()],
    [/burpee/, () => T.burpee()],
    [/jumping jack/, () => T.jack()],
    [/rowing machine/, () => T.rower()],
    [/treadmill/, () => T.tread()],
    [/sand bag carry/, () => T.carry({ sb: true })],
    [/suitcase carry/, () => T.carry({ suitcase: true })],
    [/clean and jerk/, () => T.cleanJerk()],
  ];
  const LIBC = {};
  function libFind(name) {
    const k = key(name);
    if (k in LIBC) return LIBC[k];
    let ex = null;
    for (const [re, mk] of RULES) if (re.test(k)) { ex = mk(k); break; }
    if (ex) { delete ex._kf; delete ex._vb; delete ex._T; }
    return (LIBC[k] = ex);
  }

  /** Nhóm để duyệt: bài khung môn → 'sport'; bài thư viện theo vị trí mẫu trong RULES. */
  const SECT_AT = [['close grip bench', 'push'], ['chin[- ]?up', 'pull'], ['plank pikes', 'core']].map(([src, id]) => [RULES.findIndex((r) => r[0].source === src), id]);
  function section(name) {
    const k = key(name);
    if (EX[k] || EX[ALIAS[k]]) return 'sport';
    const i = RULES.findIndex((r) => r[0].test(k));
    if (i < 0) return null;
    let sec = 'legs'; SECT_AT.forEach(([at, id]) => { if (i >= at) sec = id; });
    return sec;
  }
  window.EXERCISE_ANIM = { section, mount, find, svgFor, poseAt, skel, frame, has: (n) => !!find(n), names: () => Object.keys(EX), cue: (n, lang) => { const e = find(n); return e && e.cue ? (e.cue[lang] || e.cue.vi) : ''; }, _EX: EX, _ALIAS: ALIAS };
})();
