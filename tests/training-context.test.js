// Recovery đọc Work list (2026-11-16): trục tập luyện cho lời khuyên + khối "Tập luyện · 7 ngày" trên tab Recovery.
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const srv = require(path.join(root, 'functions', 'training-context.js'));
const idx = fs.readFileSync(path.join(root, 'functions', 'index.js'), 'utf8');

// 1. Bản sao trong app phải ra CÙNG kết quả với máy chủ.
const blk = html.slice(html.indexOf('// ── TẬP LUYỆN CHO RECOVERY'), html.indexOf('// ── HẾT BẢN SAO ──'));
assert.ok(blk.length > 1000, 'app copy found');
const ctx = {}; vm.createContext(ctx);
vm.runInContext(blk + ';this.W = worklistWorkouts; this.S = trainingSummary; this.G = trainingSig;', ctx);

const act = [
  { date: '2026-11-16', garmin: { workouts: [{ id: 'g1', at: '2026-11-16 06:10:00', sport: 'RUNNING', name: 'Interval', sec: 2700, distM: 8000, speed: 3.2, hrAvg: 162, hrMax: 182, load: 210, teAer: 3.9, teAna: 2.8 }] },
    strava: { workouts: [{ id: 's1', at: '2026-11-16T06:11:00', sport: 'Run', sec: 2690, distM: 8010, speed: 3.2 }] } },   // trùng ±2' → bỏ
  { date: '2026-11-15', garmin: { workouts: [{ id: 'g2', at: '2026-11-15 18:00:00', sport: 'STRENGTH_TRAINING', name: 'Legs', sec: 3600, hrAvg: 118, load: 60, teAer: 2.1, teAna: 0.8 }] } },
  { date: '2026-11-13', garmin: { workouts: [{ id: 'g3', at: '2026-11-13 06:00:00', sport: 'RUNNING', name: 'Easy', sec: 2400, distM: 6000, speed: 2.6, load: 80, teAer: 2.4, teAna: 0 }] } },
  { date: '2026-11-06', garmin: { workouts: [{ id: 'g4', at: '2026-11-06 06:00:00', sport: 'RUNNING', sec: 3000, distM: 8000, speed: 2.7, load: 100, teAer: 2.8, teAna: 0.2 }] } },
  { date: '2026-10-30', strava: { workouts: [{ id: 's2', at: '2026-10-30T06:00:00', sport: 'Run', sec: 3000, distM: 9000, speed: 3.0, load: 90 }] } },
  { date: '2026-10-25', garmin: { workouts: [{ id: 'g5', at: '2026-10-25 06:00:00', sport: 'RUNNING', sec: 3000, distM: 8000, speed: 2.7, load: 100, teAer: 2.8 }] } },
  { date: '2026-11-14', steps: 9000, workouts: [{ at: '2026-11-14T07:00:00', sport: 'RUNNING', sec: 600 }] },   // gốc Polar: bỏ khi có Garmin/Strava
];
const sessions = [{ date: '2026-11-15', at: '2026-11-15T11:30:00Z', day: 'SessionA', done: 6, total: 6, volume: 5200, muscles: { Quads: 8, Glutes: 6, Hamstrings: 4 } },
  { date: '2026-11-11', at: '2026-11-11T11:30:00Z', day: 'SessionB', done: 5, total: 6, muscles: { Chest: 6 } }];
const ws = srv.worklistWorkouts(act), today = '2026-11-16';
const a = srv.trainingSummary(ws, sessions, today), b = ctx.S(ctx.W(act), sessions, today);
assert.strictEqual(JSON.stringify(b), JSON.stringify(a), 'app ≠ server');
assert.strictEqual(ctx.G(ctx.W(act), sessions), srv.trainingSig(ws, sessions));

// 2. Gộp Work list: Strava trùng Garmin ±2' bị bỏ; buổi Polar gốc không lẫn vào khi đã có Garmin / Strava.
assert.strictEqual(ws.length, 6);
assert.ok(!ws.some((w) => w.src === 'polar') && ws.filter((w) => w.date === '2026-11-16').length === 1);
assert.strictEqual(srv.worklistWorkouts([{ date: '2026-11-14', workouts: [{ at: '2026-11-14T07:00:00', sport: 'RUNNING', sec: 600 }] }])[0].src, 'polar', 'Polar-only fallback');

// 3. Tóm tắt 7 ngày: 3 buổi Work list + buổi tạ app ngày 11 (ngày 15 trùng buổi Garmin strength → một buổi).
assert.strictEqual(a.d7.sessions, 4);
assert.strictEqual(a.d7.runKm, 14);
assert.strictEqual(a.d7.strengthDays, 2);
assert.strictEqual(a.d7.hard, 1, 'interval TE 3.9/2.8 = nặng');
assert.strictEqual(a.daysSince.hard, 0); assert.strictEqual(a.daysSince.strength, 1); assert.strictEqual(a.daysSince.run, 0);
assert.strictEqual(a.avg3.runKm, Math.round((8 + 9 + 8) / 3 * 10) / 10);
assert.ok(a.ratio > 1 && a.ratioBasis === 'load', 'ratio ' + a.ratio);
assert.strictEqual(a.recent.length, 2);
assert.ok(a.recentApp[0].top[0].startsWith('Quads'), 'nhóm cơ buổi tạ 48h');
// Chưa đủ 2 tuần trước có tập → không tính tỉ lệ (không đoán).
assert.strictEqual(srv.trainingSummary(ws.filter((w) => w.date >= '2026-11-10'), [], today).ratio, null);
// Mới có dữ liệu ~2 tuần trước → trung bình chia 2 tuần, không chia 3.
{ const two = ws.filter((w) => w.date >= '2026-10-30'); const t2 = srv.trainingSummary(two, [], today);
  assert.strictEqual(t2.prevWeeks, 2); assert.strictEqual(t2.avg3.runKm, 8.5, '(8 + 9) km / 2 tuần');
  const one = srv.trainingSummary(ws.filter((w) => w.date >= '2026-11-06'), [], today);
  assert.strictEqual(one.prevWeeks, 1); assert.strictEqual(one.ratio, null, '1 tuần trước: chưa so'); }
// Chữ ký đổi khi có buổi mới, không đổi khi chỉ cửa sổ trượt.
assert.notStrictEqual(srv.trainingSig(ws, sessions), srv.trainingSig(ws.slice(1), sessions));
assert.strictEqual(srv.trainingSig(ws, sessions), srv.trainingSig(ws.slice(0, 3), sessions));

// 3b. Tuần lịch T2 → CN (coach 2026-11-16, thứ Hai): 7 ngày trượt bỏ mất buổi tạ thứ Hai tuần trước, tuần lịch thì không.
{ const real = srv.worklistWorkouts([
    { date: '2026-11-09', garmin: { workouts: [{ at: '2026-11-09 14:47:35', sport: 'strength_training', sec: 3000 }] } },
    { date: '2026-11-10', garmin: { workouts: [{ at: '2026-11-10 14:42:27', sport: 'treadmill_running', sec: 3540, distM: 9000 }] } },
    { date: '2026-11-11', garmin: { workouts: [{ at: '2026-11-11 16:26:23', sport: 'running', sec: 2880, distM: 8000 }] } },
    { date: '2026-11-13', garmin: { workouts: [{ at: '2026-11-13 17:16:46', sport: 'running', sec: 4140, distM: 10000 }] } },
    { date: '2026-11-14', garmin: { workouts: [{ at: '2026-11-14 16:02:47', sport: 'strength_training', sec: 3420 }] } }]);
  const t = srv.trainingSummary(real, [], '2026-11-16');
  assert.strictEqual(t.d7.strengthDays, 1, '7 ngày trượt 10–16/11');
  assert.strictEqual(t.calWeeks.last.from, '2026-11-09'); assert.strictEqual(t.calWeeks.last.to, '2026-11-15');
  assert.strictEqual(t.calWeeks.last.strengthDays, 2); assert.strictEqual(t.calWeeks.last.byCat.run, 3);
  assert.strictEqual(t.calWeeks.this.from, '2026-11-16'); assert.strictEqual(t.calWeeks.this.sessions, 0);
  const b2 = ctx.S(ctx.W([{ date: '2026-11-09', garmin: { workouts: [{ at: '2026-11-09 14:47:35', sport: 'strength_training', sec: 3000 }] } }]), [], '2026-11-16');
  assert.strictEqual(b2.calWeeks.last.strengthDays, 1, 'app copy có tuần lịch'); }
// Khối Recovery viết sẵn 2 thứ tiếng, không để bộ tự dịch ghép mảnh ("ON tập tạ", "8 day").
assert.ok(/box\.setAttribute\('data-i18n-skip', ''\)/.test(html) && /_rcL\('Ngày tập tạ', 'Strength days'\)/.test(html));
assert.ok(/tuần lịch \(T2 → CN\)/.test(idx), 'tuần lịch vào bản tin');

// 4. Máy chủ: bản tin có mục tập luyện Work list + luật hai trục; lời khuyên lưu chữ ký và báo stale.
assert.ok(/8\. TẬP LUYỆN — Work list/.test(idx) && /briefTrainingText\(ctx\.training\)/.test(idx));
assert.ok(/11\. Lời khuyên phải bám HAI trục/.test(idx) && /13\. nextSession không lặp lại/.test(idx));
assert.ok((idx.match(/await briefInputs\(cRef\)/g) || []).length === 2, 'recoveryBrief + generateBriefIfMissing');
assert.ok((idx.match(/sig: inp\.sig/g) || []).length === 2 && /stale \|\| cachedOnly/.test(idx));
assert.ok(/Training Readiness \$\{\(gm\.readiness/.test(idx), 'Garmin recovery vào bản tin');

// 5. App: khối Tập luyện trên tab Recovery + nút cập nhật khi lời khuyên cũ.
assert.ok(/_rcMountTraining\(wrap\);/.test(html) && /showPage\(\\'worklist\\'\)/.test(html));
assert.ok(/_rcBriefStale = !!res\.data\.stale/.test(html) && /Cập nhật lời khuyên/.test(html));
console.log('training-context ok');
