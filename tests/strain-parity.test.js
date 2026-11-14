/**
 * Strain của khách Garmin (functions-py/strain.py) PHẢI ra cùng số với của coach Polar (functions/strain.js):
 * hai người cùng một thang 0–21. Chạy hai bản trên cùng dữ liệu nhịp tim giả lập và so TỪNG con số.
 */
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { spawnSync } = require('child_process');
const S = require('../functions/strain.js');

// Dữ liệu tất định (không Math.random) — lần chạy nào cũng y hệt.
let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
function series(n, base, amp, step, t0) {
  const out = [];
  let t = t0;
  for (let i = 0; i < n; i++) {
    out.push({ at: t, hr: Math.round(base + amp * Math.sin(i / 37) + (rnd() - 0.5) * 18) });
    t += step + (rnd() < 0.02 ? 900 : 0);          // thỉnh thoảng tháo thiết bị → khoảng trống > 600s
  }
  return out;
}
const cases = [
  { samples: series(1450, 150, 22, 2, 1794389183), ctx: { rhr: 55, hrMax: 186, sex: 'male' } },
  { samples: series(600, 128, 30, 3, 1794300000), ctx: { rhr: 62, hrMax: 178, sex: 'female' } },
  { samples: series(160, 88, 14, 120, 1794330000), ctx: { rhr: 65, hrMax: 182, sex: 'male' } },
  { samples: series(40, 70, 5, 1, 1794000000), ctx: { rhr: 72, hrMax: 180, sex: 'male' } },
];
const hm = [
  { manual: 191 }, { observed: 183, birthdate: '1990-05-10', today: '2026-11-14' },
  { observed: 150, birthdate: '1990-05-10', today: '2026-11-14' }, { birthdate: '2011-02-28', today: '2026-11-14' }, {},
];

test('strain.py == strain.js (raw load, strain, vung, ngay, HR max)', () => {
  const py = `
import sys, json; sys.path.insert(0, "functions-py")
import strain as S
d = json.load(sys.stdin)
out = {"w": [S.workout_strain(c["samples"], c["ctx"]) for c in d["cases"]],
       "day": S.daily_strain([c["samples"] for c in d["cases"][:3]], d["cases"][0]["ctx"]),
       "hm": [S.resolve_hr_max(**{ {"manual":"manual","observed":"observed","birthdate":"birthdate","today":"today"}[k]: v for k, v in h.items()}) for h in d["hm"]],
       "ts": [S.to_strain(x) for x in [0, 7, 45, 83, 162, 1000]]}
print(json.dumps(out, ensure_ascii=False))`;
  const r = spawnSync('python3', ['-c', py], { cwd: path.join(__dirname, '..'), input: JSON.stringify({ cases, hm }), encoding: 'utf8' });
  assert.strictEqual(r.status, 0, r.stderr);
  const p = JSON.parse(r.stdout);
  const js = {
    w: cases.map((c) => S.workoutStrain(c.samples, c.ctx)),
    day: S.dailyStrain(cases.slice(0, 3).map((c) => c.samples), cases[0].ctx),
    hm: hm.map((h) => S.resolveHrMax(h)),
    ts: [0, 7, 45, 83, 162, 1000].map(S.toStrain),
  };
  assert.deepStrictEqual(p, JSON.parse(JSON.stringify(js)));
  assert(js.w[0].strain > 5 && js.w[0].zoneSec.some((v) => v > 0), 'du lieu thu phai co tai that');
});
