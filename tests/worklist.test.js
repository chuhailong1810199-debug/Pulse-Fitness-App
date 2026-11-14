/**
 * Tab Work list (2026-11-13) — lịch sử buổi tập Garmin của coach. Hàm THẬT cắt từ index.html.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const s = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const cut = (a, b) => { const i = s.indexOf(a); assert(i >= 0, 'missing ' + a); return s.slice(i, s.indexOf(b, i)); };

function load(items, sync) {
  return new Function('var userRole="coach", activeClient=null, userClientId=null, COACH_HOME_CLIENT="longchu", clientsData=[{id:"longchu", garminSync:' + JSON.stringify(sync || null) + '}];'
    + 'function T(x){return x} function escHtml(x){return String(x==null?"":x).replace(/[&<>"\']/g,function(m){return "&#"+m.charCodeAt(0)+";"})}'
    + cut('// ── TAB WORK LIST', '// ── TAB LỚP NHÓM') + '; _wl.items = ' + JSON.stringify(items || null)
    + '; return { wlCat, wlPace, wlDur, wlLoadTone, wlRow, wlDetailHTML, wlGroups, wlKpis, wlChart, wlSyncBadge, wlConnectHTML, _wl };')();
}
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const today = new Date();
const W = (daysAgo, o) => ({ id: 'a' + daysAgo, at: ymd(new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysAgo)) + ' 06:05:00', sec: 2900, ...o });

test('mon Garmin -> nhom mau; pace tu m/s; thoi luong', () => {
  const g = load();
  assert.strictEqual(g.wlCat('treadmill_running'), 'run');
  assert.strictEqual(g.wlCat('strength_training'), 'strength');
  assert.strictEqual(g.wlCat('hiit'), 'hiit');
  assert.strictEqual(g.wlCat('indoor_cycling'), 'bike');
  assert.strictEqual(g.wlCat('yoga'), 'other');
  assert.strictEqual(g.wlPace(800 / 261), '5:26', '800 m trong 4:21 = 5:26/km');
  assert.strictEqual(g.wlPace(0), '');
  assert.strictEqual(g.wlDur(2900), '48:20');
  assert.strictEqual(g.wlDur(3900), '1:05');
  assert.strictEqual(g.wlLoadTone(168).fg, '#FFB3B3');
  assert.strictEqual(g.wlLoadTone(62).fg, '#9FD9B4');
});

test('dong + chi tiet: so lieu Garmin, ten buoi duoc thoat HTML, khong co so thi khong ve muc do', () => {
  const run = W(0, { name: '<img src=x onerror=alert(1)>', sport: 'running', distM: 9200, speed: 9200 / 2900, hrAvg: 156, hrMax: 182, calories: 612, load: 168,
    teAer: 3.8, teAna: 2.6, zones: [250, 690, 860, 820, 280], laps: [{ distM: 800, sec: 261, hrAvg: 171, speed: 800 / 261 }, { distM: 800, sec: 258, hrAvg: 175, speed: 800 / 258 }] });
  const g = load([run]);
  const row = g.wlRow(run);
  assert(!/<img/.test(row), 'ten buoi phai thoat HTML');
  assert.match(row, /9\.2 km · 5:15\/km/);
  const det = g.wlDetailHTML(run);
  assert.match(det, /Training effect/);
  assert.match(det, /Z5/);
  assert.match(det, /5:26/);
  const bare = W(1, { name: 'Strength', sport: 'strength_training' });
  const d2 = g.wlDetailHTML(bare);
  assert.doesNotMatch(d2, /Training effect|Z1|Lap/, 'khong co du lieu thi khong ve khung rong');
});

test('gom theo tuan, KPI tuan nay, bieu do 12 tuan, badge dong bo cu thi doi mau', () => {
  const items = [W(0, { sport: 'running', distM: 5000, load: 100 }), W(1, { sport: 'strength_training', load: 60 }), W(9, { sport: 'running', distM: 8000, load: 120 })];
  const g = load(items, { at: new Date(Date.now() - 3 * 864e5).toISOString() });
  assert.match(g.wlGroups(items), /Tuần này/);
  assert.match(g.wlKpis(items), /Buổi tuần này/);
  assert.match(g.wlChart(items), /Tải tập 12 tuần/);
  assert.match(g.wlSyncBadge(), /wl-sync stale/);
  assert.match(load([], null).wlSyncBadge(), /Chưa đồng bộ Garmin/);
});

test('noi vao app: tab cho coach + khach, chi doc doc co phan Garmin, script tren Mac ghi truong rieng', () => {
  assert.doesNotMatch(s, /if \(page === 'worklist' && userRole !== 'coach'\) return;/, 'khach cung dung tab');
  assert.match(s, /id="worklist-nav-tab" data-page="worklist"/);
  assert.match(cut('async function loadWorklist', '\nfunction wlFiltered'), /where\('garmin\.at', '>', ''\)/);
  const w = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'garmin', 'write.js'), 'utf8');
  assert.match(w, /garmin: \{ \.\.\.s\.act, workouts: s\.workouts, at \}/, 'write.js ghi workouts vao truong garmin rieng');
  assert.doesNotMatch(w, /\{ merge: true \}\);\s*\/\/.*polar/i);
  const gi = fs.readFileSync(path.join(__dirname, '..', '.gitignore'), 'utf8');
  assert.match(gi, /\*garmin_tokens\*\.json/, 'token Garmin khong bao gio vao git');
});

test('dong bo tren may chu: nut goi garminSyncNow, ham chi cho chu dong ho, keo hong thi khong xoa buoi cu', () => {
  assert.match(cut('async function wlSync', '\nfunction wlConnectHTML'), /httpsCallable\('garminSyncNow'/);
  const main = fs.readFileSync(path.join(__dirname, '..', 'functions-py', 'main.py'), 'utf8');
  assert.match(main, /d\.get\("coachUid"\) == req\.auth\.uid/, 'coach phu trach duoc');
  assert.match(main, /str\(d\.get\("email"\) or ""\)\.strip\(\)\.lower\(\) == em/, 'chinh khach (email khop) duoc');
  assert.match(main, /raise _err\(E\.PERMISSION_DENIED/, 'nguoi khac bi chan');
  assert.match(main, /schedule="30 6 \* \* \*", timezone="Asia\/Ho_Chi_Minh"/);
  assert.match(main, /workouts = None if acts is None/);
  const core = fs.readFileSync(path.join(__dirname, '..', 'functions-py', 'garmin_core.py'), 'utf8');
  assert.match(core, /if workouts is not None:\n\s+g_\["workouts"\] = s\["w"\]/, 'keo hong (None) thi giu workouts cu');
  const fb = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'firebase.json'), 'utf8'));
  assert(fb.functions.some((f) => f.codebase === 'garmin' && f.source === 'functions-py'));
  const rules = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
  assert.match(rules, /match \/privateTokens\/\{docId\} \{\s*\n\s*allow read, write: if false;/);
});

test('ket noi Garmin: mat khau khong luu, khong log; ma 2 lop co han; form chi hien khi chua ket noi', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'functions-py', 'main.py'), 'utf8');
  const conn = main.slice(main.indexOf('def garminConnect'), main.indexOf('def garminDisconnect'));
  assert.doesNotMatch(conn, /set\(\{[^}]*password/, 'khong ghi mat khau vao Firestore');
  assert.doesNotMatch(conn, /print\([^)]*(password|str\(e\))/, 'khong in mat khau / loi tho');
  assert.match(conn, /"exp": time\.time\(\) \+ 600/);
  assert.match(main, /time\.sleep\(20\)/, 'dong bo sang gian tung tai khoan');
  const g = load([], null);
  assert.match(g.wlConnectHTML ? g.wlConnectHTML() : '', /type="password"/);
});

test('coach khac (khong co ho so longchu) khong bi tro vao ho so cua admin', () => {
  const src = cut('// ── TAB WORK LIST', '// ── TAB LỚP NHÓM');
  const mk = (clients) => new Function('var userRole="coach", activeClient=null, userClientId=null, COACH_HOME_CLIENT="longchu", clientsData=' + JSON.stringify(clients) + ';'
    + 'function T(x){return x} function escHtml(x){return String(x)}' + src + '; return wlClientId;')();
  assert.strictEqual(mk([{ id: 'khach_cua_b' }])(), null);
  assert.strictEqual(mk([{ id: 'longchu' }])(), 'longchu');
});

test('khach chi dung Garmin: may chu ghi them khuon Polar cho Recovery / Health; ho so Polar khong bi de', () => {
  const { spawnSync } = require('child_process');
  const py = `
import sys, json; sys.path.insert(0, "functions-py")
import garmin_core as c
r, a = c.polar_shape("2026-11-12", {"sleep": {"total": 25200, "deep": 5000}, "hrv": {"lastNight": 62}, "rhr": 55},
                     {"steps": 9000, "intensityMin": 40}, [{"at": "2026-11-12 06:05:00", "sport": "running", "sec": 2900, "hrAvg": 156}])
e = c.polar_shape("d", {"rhr": None, "hrv": None}, None, None)
print(json.dumps({"r": r, "a": a, "e": e}))`;
  const out = spawnSync('python3', ['-c', py], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
  assert.strictEqual(out.status, 0, out.stderr);
  const j = JSON.parse(out.stdout);
  assert.strictEqual(j.r.source, 'garmin');
  assert.strictEqual(j.r.sleep.total, 25200);
  assert.strictEqual(j.r.sleep.hrMin, 55, 'Healthspan doc RHR o sleep.hrMin');
  assert.strictEqual(j.r.recharge.hrv, 62);
  assert.strictEqual(j.a.steps, 9000);
  assert.strictEqual(j.a.activeSec, 2400);
  assert.strictEqual(j.a.workouts[0].at, '2026-11-12T06:05:00');
  assert.strictEqual(j.a.workouts[0].sport, 'RUNNING');
  assert.deepStrictEqual(j.e, [{}, {}], 'khong co so thi khong ghi khoa nao (khong ghi null de)');
  const main = fs.readFileSync(path.join(__dirname, '..', 'functions-py', 'main.py'), 'utf8');
  assert.match(main, /mirror = not cd\.get\("polarProfile"\)/, 'ho so Polar (coach) KHONG mirror');
  assert.match(s, /activeClient\.polarProfile \|\| activeClient\.garminProfile/);
  assert.match(s, /garmin \? rcGarminSyncNow\(\) : polarSyncNow\(\)/);
});

test('hien day du cho khach Garmin: strain, nhip tho, SpO2, Body Battery / Stress / Readiness', () => {
  const core = fs.readFileSync(path.join(__dirname, '..', 'functions-py', 'garmin_core.py'), 'utf8');
  assert.match(core, /import strain as ST/, 'strain cung cong thuc voi Polar (strain-parity.test.js)');
  assert.match(core, /"breathing": rec\.get\("resp"\), "spo2": rec\.get\("spo2"\)/);
  assert.match(core, /if load:\n\s+r\["load"\] = load/);
  const main = fs.readFileSync(path.join(__dirname, '..', 'functions-py', 'main.py'), 'utf8');
  assert.match(main, /except Exception as e:  # noqa: BLE001 — strain hỏng một ngày/);
  assert.match(s, /key: 'spo2', name: 'SpO₂'/);
  assert.match(s, /nights\.some\(\(n\) => num\(HS_MON\[i\]\.pick\(n\)\) != null\)/, 'o khong dem nao co so thi an');
  assert.match(s, /_rcMountRings\(wrap\);\n\s+_rcMountGarmin\(wrap\);/);
});

test('ban do tuyen: polyline may chu ma hoa == app giai ma; toc do tinh tu toa do khi Garmin de 0; buoi khong GPS khong co ban do', () => {
  const { spawnSync } = require('child_process');
  const py = `
import sys, json; sys.path.insert(0, "functions-py")
import garmin_core as c
pts = [(10.79512, 106.76701), (10.79533, 106.76745), (10.79601, 106.76812), (10.78952, 106.78067)]
raw = [{"lat": la, "lon": lo, "time": 1794389183000 + i * 5000, "speed": 0.0} for i, (la, lo) in enumerate(pts)]
print(json.dumps({"ref": c.encode_polyline([(38.5, -120.2), (40.7, -120.95), (43.252, -126.453)]),
                  "poly": c.encode_polyline(pts), "spd": c._route_speeds(raw)}))`;
  const r = spawnSync('python3', ['-c', py], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
  assert.strictEqual(r.status, 0, r.stderr);
  const j = JSON.parse(r.stdout);
  assert.strictEqual(j.ref, '_p~iF~ps|U_ulLnnqC_mqNvxq`@', 'dung chuan Google');
  const dec = new Function(cut('function wlDecodePolyline', '\n/** Màu theo tốc độ') + '; return wlDecodePolyline;')();
  assert.deepStrictEqual(dec(j.poly), [[10.79512, 106.76701], [10.79533, 106.76745], [10.79601, 106.76812], [10.78952, 106.78067]]);
  assert.strictEqual(j.spd[0], null);
  assert(j.spd[1] > 9 && j.spd[1] < 11, 'toc do tu toa do (~53 m / 5 s): ' + j.spd[1]);
  const core = fs.readFileSync(path.join(__dirname, '..', 'functions-py', 'garmin_core.py'), 'utf8');
  assert.match(core, /"route": route_of\(api, a\["activityId"\]\) if recent and a\.get\("hasPolyline"\)/);
  assert.match(s, /js\.onerror = \(\) => \{ _leafletLoading = null; resolve\(false\); \}/, 'CDN hong -> ve SVG');
});
