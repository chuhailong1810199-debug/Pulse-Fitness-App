// Đọc / ghi path SVG đơn giản (M L H V C Z, tương đối + tuyệt đối) — đủ cho dữ liệu body-muscles.
// Mỗi mảnh (subpath) → danh sách điểm tuyệt đối; đường cong C giữ nguyên dạng tuyệt đối để vẽ lại không méo.
function tokenize(d) { return d.match(/[MmLlHhVvCcZz]|-?\d*\.?\d+(?:e-?\d+)?/g); }
function parse(d) {
  const t = tokenize(d), subs = []; let i = 0, cmd = null, x = 0, y = 0, sx = 0, sy = 0, cur = null;
  const num = () => parseFloat(t[i++]);
  while (i < t.length) {
    if (/[A-Za-z]/.test(t[i])) cmd = t[i++];
    switch (cmd) {
      case 'M': case 'm': {
        const a = num(), b = num(); x = cmd === 'm' ? x + a : a; y = cmd === 'm' ? y + b : b; sx = x; sy = y;
        cur = { segs: [['M', x, y]] }; subs.push(cur); cmd = cmd === 'm' ? 'l' : 'L'; break; }
      case 'L': case 'l': { const a = num(), b = num(); x = cmd === 'l' ? x + a : a; y = cmd === 'l' ? y + b : b; cur.segs.push(['L', x, y]); break; }
      case 'H': case 'h': { const a = num(); x = cmd === 'h' ? x + a : a; cur.segs.push(['L', x, y]); break; }
      case 'V': case 'v': { const a = num(); y = cmd === 'v' ? y + a : a; cur.segs.push(['L', x, y]); break; }
      case 'C': case 'c': {
        const v = [num(), num(), num(), num(), num(), num()];
        const ab = cmd === 'c' ? v.map((q, k) => q + (k % 2 ? y : x)) : v;
        cur.segs.push(['C', ...ab]); x = ab[4]; y = ab[5]; break; }
      case 'Z': case 'z': x = sx; y = sy; cmd = null; break;
      default: throw new Error('lệnh path chưa hỗ trợ: ' + cmd);
    }
  }
  return subs;
}
const r3 = (n) => Math.round(n * 1000) / 1000;
function toD(subs) { return subs.map((s) => s.segs.map((g) => g[0] + ' ' + g.slice(1).map(r3).join(' ')).join(' ') + ' Z').join(' '); }
function pts(sub) { return sub.segs.map((g) => [g[g.length - 2], g[g.length - 1]]); }
function centroid(sub) { const p = pts(sub); return [p.reduce((a, q) => a + q[0], 0) / p.length, p.reduce((a, q) => a + q[1], 0) / p.length]; }
/** Cắt đa giác (chỉ đoạn thẳng) theo nửa mặt phẳng keep(x,y) — Sutherland–Hodgman với đường thẳng x = c. */
function clipX(sub, c, keepGreater) {
  const p = pts(sub), out = [], inside = (q) => (keepGreater ? q[0] >= c : q[0] <= c);
  for (let k = 0; k < p.length; k++) {
    const a = p[k], b = p[(k + 1) % p.length];
    if (inside(a)) out.push(a);
    if (inside(a) !== inside(b)) { const t = (c - a[0]) / (b[0] - a[0]); out.push([c, a[1] + t * (b[1] - a[1])]); }
  }
  return out.length >= 3 ? { segs: out.map((q, k) => [k ? 'L' : 'M', q[0], q[1]]) } : null;
}
module.exports = { parse, toD, pts, centroid, clipX };
