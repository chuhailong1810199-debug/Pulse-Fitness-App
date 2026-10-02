#!/usr/bin/env node
/**
 * Kéo dữ liệu hồi phục từ Polar AccessLink → JSON gọn để ghi vào Firestore
 * tại clients/{memberId}/recovery/{YYYY-MM-DD}.
 *
 * Chỉ giữ số tóm tắt theo ngày. KHÔNG giữ hrv_samples / heart_rate_samples
 * (mỗi đêm hàng trăm điểm, phình doc mà app không dùng tới).
 *
 * KHÔNG chứa token. Truyền qua biến môi trường:
 *   POLAR_TOKEN=xxx node outputs/polar-pull.js [outfile.json]
 */
const TOKEN = process.env.POLAR_TOKEN;
const OUT   = process.argv[2] || 'polar-recovery.json';
if (!TOKEN) { console.error('Thiếu POLAR_TOKEN'); process.exit(1); }

const API = 'https://www.polaraccesslink.com';
const get = async p => {
  const r = await fetch(API + p, { headers: { Authorization: 'Bearer ' + TOKEN, Accept: 'application/json' } });
  const t = await r.text();
  if (!r.ok) throw new Error(`${p} → HTTP ${r.status}: ${t.slice(0, 200)}`);
  try { return t ? JSON.parse(t) : null; } catch { return null; }
};
const arr = (o, ...keys) => {
  if (Array.isArray(o)) return o;
  for (const k of keys) if (o && Array.isArray(o[k])) return o[k];
  return [];
};

(async () => {
  const nr = await get('/v3/users/nightly-recharge');
  const sl = await get('/v3/users/sleep');
  const N = arr(nr, 'recharges', 'nights');
  const S = arr(sl, 'nights', 'sleeps');

  const days = {};
  const seed = d => (days[d] = days[d] || { date: d, source: 'polar' });

  for (const x of N) {
    const d = seed(x.date);
    d.recharge = {
      rhr:       x.heart_rate_avg ?? null,
      hrv:       x.heart_rate_variability_avg ?? null,
      breathing: x.breathing_rate_avg ?? null,
      beatToBeat: x.beat_to_beat_avg ?? null,
    };
  }
  for (const x of S) {
    const d = seed(x.date);
    const total = (x.light_sleep || 0) + (x.deep_sleep || 0) + (x.rem_sleep || 0) + (x.unrecognized_sleep_stage || 0);
    d.sleep = {
      total, light: x.light_sleep ?? null, deep: x.deep_sleep ?? null, rem: x.rem_sleep ?? null,
      score: x.sleep_score ?? null,
      charge: x.sleep_charge ?? null,
      rating: x.sleep_rating ?? null,
      continuity: x.continuity ?? null,
      goal: x.sleep_goal ?? null,
      interruptions: x.total_interruption_duration ?? null,
      start: x.sleep_start_time ?? null,
      end:   x.sleep_end_time ?? null,
    };
  }

  const out = Object.keys(days).sort().map(k => ({ ...days[k], updatedAt: new Date().toISOString() }));
  require('fs').writeFileSync(OUT, JSON.stringify(out, null, 2));

  const hm = s => Math.floor(s / 3600) + 'h' + String(Math.round(s % 3600 / 60)).padStart(2, '0');
  console.log(`${out.length} ngày → ${OUT}\n`);
  for (const d of out) {
    console.log(`  ${d.date}  ngủ ${d.sleep ? hm(d.sleep.total) : '—'}` +
      `  score ${d.sleep?.score ?? '—'}` +
      `  HRV ${d.recharge?.hrv ?? '—'}` +
      `  RHR ${d.recharge?.rhr ?? '—'}`);
  }
})().catch(e => { console.error('LỖI:', e.message); process.exit(1); });
