// ─────────────────────────────────────────────────────────────
// PUSH GIÁO ÁN MỚI — Lee
// 2 block xoay vòng A/B/A. Isolation chuyển xuống cuối (bỏ pre-exhaust).
// Giữ NGUYÊN danh sách bài Lee đang tập — không thêm bài nào.
//
// Dùng: longchucoaching.com (đăng nhập COACH) → F12 → Console → dán → Enter
// Lần 1: DRY_RUN = true  → chỉ đọc + in, không ghi
// Lần 2: đổi false       → backup rồi ghi
// ─────────────────────────────────────────────────────────────
(function () {
  var DRY_RUN = true;

  var CLIENT_ID = 'lee';
  var BACKUP_ID = 'program-backup-2026-09-25';

  var program = {

    SessionA: { label: "Session A — Anterior", phases: [

      { name: "🔥 Warm-up", tag: "warmup", exercises: [
        { name: "Bike (nhẹ)", setsReps: "1 × 3 min", tempo: "", exerciseKey: "bike_warmup",
          cue: "Rest: 0s | Đạp chậm cho nóng người. Thở mũi được là đúng cường độ." },
        { name: "Cable Rotation", setsReps: "2 × 10/bên", tempo: "", exerciseKey: "cable_rotation",
          cue: "Rest: 30s | Xoay từ hông chứ không từ vai. Chân trụ vững." },
        { name: "Band Pull-apart", setsReps: "2 × 15", tempo: "", exerciseKey: "band_pull_apart",
          cue: "Rest: 30s | Khởi động lưng trên và vai sau trước khi bench." },
        { name: "Goblet Squat (nhẹ)", setsReps: "2 × 8", tempo: "3-1-1", exerciseKey: "goblet_squat_warmup",
          cue: "Rest: 30s | Mở hông trước khi leg press. Tạ nhẹ." }
      ]},

      { name: "💪 Block 1 — Heavy", tag: "strength", exercises: [
        { name: "Barbell Bench Press (hoặc Dumbbell)", setsReps: "4 × 6", tempo: "2-0-1", exerciseKey: "bench_press",
          cue: "Rest: 90s → sang A2 | A1 SUPERSET với Leg Press. ĐÁNH KHI CÒN KHOẺ — đây là lý do chest fly đã chuyển xuống Block 3. Đủ 4×6 sạch → +1.25kg." },
        { name: "Leg Press", setsReps: "4 × 8", tempo: "2-1-1", exerciseKey: "leg_press",
          cue: "Rest: 90s → quay lại A1 | A2. Ghép trên–dưới nên không tranh sức với bench. Đủ 4×8 → +5kg." }
      ]},

      { name: "💪 Block 2", tag: "strength", exercises: [
        { name: "Shoulder Press", setsReps: "3 × 8", tempo: "2-0-1", exerciseKey: "shoulder_press",
          cue: "Rest: 75s → sang B2 | B1 SUPERSET với Cable Row. Siết mông và core, không ưỡn lưng để đẩy." },
        { name: "Cable Row", setsReps: "3 × 10", tempo: "2-1-1", exerciseKey: "cable_row",
          cue: "Rest: 75s → quay lại B1 | B2. Bài kéo cân bằng cho buổi anterior. Kéo về rốn, không ngả người lấy đà." }
      ]},

      { name: "⚡ Block 3 — Isolation", tag: "accessories", exercises: [
        { name: "Chest Fly", setsReps: "3 × 12", tempo: "3-1-1", exerciseKey: "chest_fly",
          cue: "Rest: 60s → sang C2 | C1 SUPERSET với Leg Extension. Ở CUỐI buổi là cố ý: làm trước bench thì ngực mỏi, bench tụt tạ, mà ngực lại ăn ít hơn." },
        { name: "Leg Extension", setsReps: "3 × 12", tempo: "2-1-1", exerciseKey: "leg_extension",
          cue: "Rest: 60s → quay lại C1 | C2. Siết 1 giây ở đỉnh, hạ chậm." }
      ]},

      { name: "⚡ Block 4", tag: "accessories", exercises: [
        { name: "Bicep Curl", setsReps: "3 × 12", tempo: "2-1-1", exerciseKey: "bicep_curl",
          cue: "Rest: 45s → sang D2 | D1 SUPERSET với Lateral Raise. Khuỷu tay cố định sát sườn, không đu người." },
        { name: "Lateral Raise", setsReps: "3 × 15", tempo: "2-1-1", exerciseKey: "lateral_raise",
          cue: "Rest: 45s → quay lại D1 | D2. Tạ nhẹ, nâng tới ngang vai, không nhún người lấy đà." }
      ]}
    ]},

    SessionB: { label: "Session B — Posterior", phases: [

      { name: "🔥 Warm-up", tag: "warmup", exercises: [
        { name: "Row Erg (nhẹ)", setsReps: "1 × 3 min", tempo: "", exerciseKey: "row_erg_warmup",
          cue: "Rest: 0s | Nhịp chậm: chân → thân → tay." },
        { name: "Scap Pull-up", setsReps: "2 × 8", tempo: "", exerciseKey: "scap_pull_up",
          cue: "Rest: 30s | Treo thẳng tay, chỉ kéo bả vai xuống — khuỷu tay KHÔNG gập." },
        { name: "Banded Glute Bridge", setsReps: "2 × 15", tempo: "2-2-1", exerciseKey: "banded_glute_bridge",
          cue: "Rest: 30s | Đánh thức mông trước RDL. Siết 2 giây ở đỉnh." },
        { name: "Cat-Cow", setsReps: "2 × 10", tempo: "", exerciseKey: "cat_cow",
          cue: "Rest: 0s | Mở cột sống từng đốt, chậm. Chuẩn bị cho hinge." }
      ]},

      { name: "💪 Block 1 — Heavy", tag: "strength", exercises: [
        { name: "Romanian Deadlift", setsReps: "4 × 6", tempo: "3-1-1", exerciseKey: "rdl",
          cue: "Rest: 90s → sang A2 | A1 SUPERSET với Banded Pull-up. ĐÁNH KHI CÒN KHOẺ — back extension và leg curl đã chuyển xuống Block 3. Căng đùi sau mới đúng, căng lưng dưới là sai. Đủ 4×6 → +2.5kg." },
        { name: "Banded Pull-up", setsReps: "4 × 8", tempo: "2-1-1", exerciseKey: "banded_pull_up",
          cue: "Rest: 90s → quay lại A1 | A2. Dùng dây nhẹ nhất mà vẫn đủ 8 rep. Kéo ngực về phía xà. Đủ 4×8 → bớt dây." }
      ]},

      { name: "💪 Block 2", tag: "strength", exercises: [
        { name: "Incline Dumbbell Press", setsReps: "3 × 10", tempo: "2-0-1", exerciseKey: "incline_db_press",
          cue: "Rest: 75s → sang B2 | B1 SUPERSET với Leg Curl. Ghế dốc 30 độ. Bài đẩy cân bằng cho buổi posterior." },
        { name: "Leg Curl", setsReps: "3 × 12", tempo: "2-1-1", exerciseKey: "leg_curl",
          cue: "Rest: 75s → quay lại B1 | B2. Hạ chậm 2 giây — pha hạ mới xây đùi sau." }
      ]},

      { name: "⚡ Block 3 — Isolation", tag: "accessories", exercises: [
        { name: "Back Extension", setsReps: "3 × 12", tempo: "2-1-1", exerciseKey: "back_extension",
          cue: "Rest: 60s → sang C2 | C1 SUPERSET với Face Pull. Ở CUỐI buổi là cố ý — làm trước RDL thì lưng dưới mỏi, RDL mất tạ." },
        { name: "Face Pull", setsReps: "3 × 15", tempo: "2-1-1", exerciseKey: "face_pull",
          cue: "Rest: 60s → quay lại C1 | C2. Kéo về trán, khuỷu tay cao hơn cổ tay. Bài giữ vai khoẻ cho người đẩy nhiều." }
      ]},

      { name: "⚡ Block 4", tag: "accessories", exercises: [
        { name: "Tricep Extension", setsReps: "3 × 12", tempo: "2-1-1", exerciseKey: "tricep_extension",
          cue: "Rest: 45s | Khuỷu tay cố định, chỉ cẳng tay di chuyển. Duỗi hết ở cuối tầm." }
      ]}
    ]}
  };

  // ── Thực thi ────────────────────────────────────────────────
  var db = firebase.firestore();
  var ref = db.collection('clients').doc(CLIENT_ID);

  ref.get().then(function (snap) {
    if (!snap.exists) throw new Error('Không tìm thấy client "' + CLIENT_ID + '"');
    var old = snap.data(), oldProg = old.program || {};

    console.log('%c=== ĐANG CÓ TRÊN FIRESTORE ===', 'font-weight:bold');
    console.log('goal:', JSON.stringify(old.goal), '| spw:', old.sessionsPerWeek, '| level:', old.level);
    Object.keys(oldProg).forEach(function (day) {
      console.log('  ' + day + ' — ' + (oldProg[day].label || '(không có label)'));
      (oldProg[day].phases || []).forEach(function (ph) {
        console.log('    [' + ph.tag + '] ' + ph.name);
        (ph.exercises || []).forEach(function (e) {
          console.log('       - ' + e.name + '  |  ' + e.setsReps);
        });
      });
    });

    console.log('%c=== SẼ GHI ĐÈ ===', 'font-weight:bold');
    Object.keys(program).forEach(function (day) {
      console.log('  ' + day + ' — ' + program[day].label);
      program[day].phases.forEach(function (ph) {
        console.log('    [' + ph.tag + '] ' + ph.name + ' (' + ph.exercises.length + ' bài)');
      });
    });
    console.log('LƯU Ý: program cũ có ' + Object.keys(oldProg).length +
                ' buổi, bản mới có ' + Object.keys(program).length +
                ' buổi — buổi thừa sẽ biến mất khỏi app.');

    if (DRY_RUN) {
      console.log('%c\nDRY_RUN = true — KHÔNG ghi gì.\nĐổi thành false rồi chạy lại để push.',
                  'color:#e6a700;font-weight:bold');
      return;
    }

    return ref.collection('profile').doc(BACKUP_ID).set({
      savedAt: new Date().toISOString(),
      note: 'Backup trước khi đổi sang 2 block Anterior/Posterior, isolation xuống cuối',
      goal: old.goal || '',
      program: oldProg
    }).then(function () {
      console.log('%c✓ Backup xong → clients/' + CLIENT_ID + '/profile/' + BACKUP_ID, 'color:#2e9e4f');
      return ref.update({ program: program });
    }).then(function () {
      console.log('%c✓ PUSH XONG. Reload app để xem.', 'color:#2e9e4f;font-weight:bold');
    });
  }).catch(function (e) { console.error('LỖI:', e.message); });
})();
