// ─────────────────────────────────────────────────────────────
// PUSH CHƯƠNG TRÌNH MỚI — Joost
// 3 block × 2 bài (anterior ⇄ posterior superset) + circuit finisher
// Goal: Strength
//
// Cách dùng: mở https://longchucoaching.com/index.html (đăng nhập COACH)
//            F12 → Console → dán toàn bộ file này → Enter
//
// Lần 1: DRY_RUN = true  → chỉ ĐỌC và IN ra, không ghi gì
// Lần 2: đổi thành false → backup program cũ rồi ghi program mới
// ─────────────────────────────────────────────────────────────
(function () {
  var DRY_RUN = true;

  var CLIENT_ID  = 'joost';
  var BACKUP_ID  = 'program-backup-2026-09-16';
  var NEW_GOAL   = 'Strength — tăng sức mạnh, full-body 3 buổi/tuần';

  // ── Chương trình mới ────────────────────────────────────────
  var program = {

    SessionA: { label: "Session A — Squat nặng", phases: [

      { name: "🔥 Warm-up", tag: "warmup", exercises: [
        { name: "Bike (nhẹ)", setsReps: "1 × 3 min", tempo: "", exerciseKey: "bike_warmup",
          cue: "Rest: 0s | Đạp chậm cho nóng người. Thở mũi được là đúng cường độ." },
        { name: "Cable Rotation", setsReps: "2 × 10/bên", tempo: "", exerciseKey: "cable_rotation",
          cue: "Rest: 30s | Xoay từ hông chứ không phải từ vai. Chân trụ vững." },
        { name: "Dead Bug", setsReps: "2 × 8/bên", tempo: "", exerciseKey: "dead_bug",
          cue: "Rest: 30s | Ép lưng dưới sát sàn suốt bài. Đây là bài khoá core trước khi squat nặng." },
        { name: "Goblet Squat (nhẹ)", setsReps: "2 × 8", tempo: "3-1-1", exerciseKey: "goblet_squat_warmup",
          cue: "Rest: 45s | Mở hông, tập ngồi sâu. Tạ nhẹ thôi — đây là warm-up, không phải set tập." }
      ]},

      { name: "💪 Block 1 — Heavy", tag: "strength", exercises: [
        { name: "Back Squat", setsReps: "4 × 5", tempo: "2-0-1", exerciseKey: "back_squat",
          cue: "Rest: 90s → sang A2 | A1 SUPERSET với Chest-Supported Row. Xuống 2 giây, đẩy lên nhanh. Đủ 4×5 đúng kỹ thuật → buổi sau +2.5kg." },
        { name: "Chest-Supported Row", setsReps: "4 × 8", tempo: "2-1-1", exerciseKey: "chest_supported_row",
          cue: "Rest: 90s → quay lại A1 | A2. Ngực tì ghế nên lưng dưới KHÔNG chịu tải — đó là lý do nó ghép được với squat nặng. Siết bả vai 1 giây ở cuối." }
      ]},

      { name: "💪 Block 2", tag: "strength", exercises: [
        { name: "Incline Dumbbell Press", setsReps: "3 × 8", tempo: "2-0-1", exerciseKey: "incline_db_press",
          cue: "Rest: 75s → sang B2 | B1 SUPERSET với RDL. Ghế dốc 30°. Khuỷu tay khoảng 45° so với thân, đừng banh ngang." },
        { name: "Romanian Deadlift", setsReps: "3 × 8", tempo: "3-1-1", exerciseKey: "rdl",
          cue: "Rest: 75s → quay lại B1 | B2. Đẩy hông ra sau, lưng thẳng, tạ sát đùi. Căng ở đùi sau mới đúng — căng lưng dưới là sai." }
      ]},

      { name: "⚡ Block 3 — Accessory", tag: "accessories", exercises: [
        { name: "Leg Extension", setsReps: "3 × 12", tempo: "2-1-1", exerciseKey: "leg_extension",
          cue: "Rest: 60s → sang C2 | C1 SUPERSET với Banded Pull-up. Siết 1 giây ở đỉnh, hạ chậm." },
        { name: "Banded Pull-up", setsReps: "3 × 8", tempo: "", exerciseKey: "banded_pull_up",
          cue: "Rest: 60s → quay lại C1 | C2. Dùng dây nhẹ nhất mà vẫn làm đủ 8 rep. Kéo ngực về phía xà, không phải cằm." }
      ]},

      { name: "🔥 Circuit Finisher", tag: "circuit", exercises: [
        { name: "Battle Rope", setsReps: "3 vòng × 30s", tempo: "", exerciseKey: "battle_rope",
          cue: "Rest: 0s | Toàn bộ circuit: 3 vòng, 4 bài liên tiếp, nghỉ 60s GIỮA VÒNG. Hôm nay circuit toàn thân trên + core vì chân đã ăn đủ ở block 1-2." },
        { name: "Push-up", setsReps: "3 vòng × 12", tempo: "", exerciseKey: "push_up",
          cue: "Rest: 0s | Thân người thẳng một đường. Không làm nổi 12 thì chống tay lên ghế." },
        { name: "Hollow Hold", setsReps: "3 vòng × 30s", tempo: "", exerciseKey: "hollow_hold",
          cue: "Rest: 0s | Lưng dưới ép sát sàn. Lưng nhấc lên là gãy form — co gối lại cho dễ." },
        { name: "Farmer Carry", setsReps: "3 vòng × 30m", tempo: "", exerciseKey: "farmer_carry",
          cue: "Rest: 60s rồi vào vòng tiếp | Vai kéo xuống, thân không nghiêng. Nặng đến mức 30m là vừa hết sức." }
      ]}
    ]},

    SessionB: { label: "Session B — Hinge nặng", phases: [

      { name: "🔥 Warm-up", tag: "warmup", exercises: [
        { name: "Row Erg (nhẹ)", setsReps: "1 × 3 min", tempo: "", exerciseKey: "row_erg_warmup",
          cue: "Rest: 0s | Nhịp chậm, tập trung vào thứ tự chân → thân → tay." },
        { name: "Ball Rotation", setsReps: "2 × 10/bên", tempo: "", exerciseKey: "ball_rotation",
          cue: "Rest: 30s | Xoay từ hông. Giữ core căng suốt bài." },
        { name: "Banded Glute Bridge", setsReps: "2 × 15", tempo: "2-2-1", exerciseKey: "banded_glute_bridge",
          cue: "Rest: 30s | Đánh thức mông trước khi deadlift. Siết 2 giây ở đỉnh, gối đẩy ra ngoài chống dây." },
        { name: "Scap Pull-up", setsReps: "2 × 8", tempo: "", exerciseKey: "scap_pull_up",
          cue: "Rest: 30s | Treo thẳng tay, chỉ kéo bả vai xuống — khuỷu tay KHÔNG gập. Khởi động lưng trên." }
      ]},

      { name: "💪 Block 1 — Heavy", tag: "strength", exercises: [
        { name: "Trap-bar Deadlift", setsReps: "4 × 5", tempo: "2-0-1", exerciseKey: "trap_bar_deadlift",
          cue: "Rest: 90s → sang A2 | A1 SUPERSET với Overhead Press. Ngực cao, đẩy sàn ra xa. Đặt tạ xuống có kiểm soát, không thả rơi. Đủ 4×5 → +2.5kg." },
        { name: "Standing Overhead Press", setsReps: "4 × 6", tempo: "2-0-1", exerciseKey: "overhead_press",
          cue: "Rest: 90s → quay lại A1 | A2. Siết mông và core để không ưỡn lưng. Đủ 4×6 → +1.25kg." }
      ]},

      { name: "💪 Block 2", tag: "strength", exercises: [
        { name: "Bulgarian Split Squat", setsReps: "3 × 8/bên", tempo: "3-1-1", exerciseKey: "bulgarian_split_squat",
          cue: "Rest: 75s → sang B2 | B1 SUPERSET với Lat Pulldown. Chân sau chỉ để giữ thăng bằng. Thân hơi ngả trước sẽ ăn mông nhiều hơn." },
        { name: "Lat Pulldown", setsReps: "3 × 10", tempo: "2-1-1", exerciseKey: "lat_pulldown",
          cue: "Rest: 75s → quay lại B1 | B2. Kéo xuống ngực trên, khuỷu tay ép xuống cạnh sườn. Không ngả người lấy đà." }
      ]},

      { name: "⚡ Block 3 — Accessory", tag: "accessories", exercises: [
        { name: "Hanging Knee Raise", setsReps: "3 × 12", tempo: "", exerciseKey: "hanging_knee_raise",
          cue: "Rest: 60s → sang C2 | C1 SUPERSET với Leg Curl. Cuốn hông lên chứ không chỉ nhấc gối. Không đu người." },
        { name: "Seated Leg Curl", setsReps: "3 × 12", tempo: "2-1-1", exerciseKey: "seated_leg_curl",
          cue: "Rest: 60s → quay lại C1 | C2. Hạ chậm 2 giây — phần hạ mới là phần xây đùi sau." }
      ]},

      { name: "🔥 Circuit Finisher", tag: "circuit", exercises: [
        { name: "Assault Bike", setsReps: "3 vòng × 40s", tempo: "", exerciseKey: "assault_bike",
          cue: "Rest: 0s | 3 vòng, 4 bài liên tiếp, nghỉ 60s GIỮA VÒNG. Circuit hôm nay KHÔNG có bài chuỗi sau nào — trap-bar deadlift đã vắt kiệt phần đó rồi." },
        { name: "Push-up", setsReps: "3 vòng × 12", tempo: "", exerciseKey: "push_up",
          cue: "Rest: 0s | Thân thẳng một đường, xuống ngực gần chạm sàn." },
        { name: "Dead Bug", setsReps: "3 vòng × 10/bên", tempo: "", exerciseKey: "dead_bug",
          cue: "Rest: 0s | Chậm và sạch. Lưng dưới rời sàn là dừng." },
        { name: "Plank Shoulder Tap", setsReps: "3 vòng × 20", tempo: "", exerciseKey: "plank_shoulder_tap",
          cue: "Rest: 60s rồi vào vòng tiếp | Hông KHÔNG được lắc. Dang rộng chân ra cho dễ giữ." }
      ]}
    ]},

    SessionC: { label: "Session C — Bench nặng", phases: [

      { name: "🔥 Warm-up", tag: "warmup", exercises: [
        { name: "Bike (nhẹ)", setsReps: "1 × 3 min", tempo: "", exerciseKey: "bike_warmup",
          cue: "Rest: 0s | Đạp chậm cho nóng người." },
        { name: "Cable Rotation", setsReps: "2 × 10/bên", tempo: "", exerciseKey: "cable_rotation",
          cue: "Rest: 30s | Xoay từ hông, chân trụ vững." },
        { name: "Band Pull-apart", setsReps: "2 × 15", tempo: "", exerciseKey: "band_pull_apart",
          cue: "Rest: 30s | Khởi động lưng trên + vai sau trước khi bench. Tay thẳng, siết bả vai." },
        { name: "Goblet Squat (nhẹ)", setsReps: "2 × 8", tempo: "3-1-1", exerciseKey: "goblet_squat_warmup",
          cue: "Rest: 45s | Mở hông chuẩn bị cho front squat ở block 2." }
      ]},

      { name: "💪 Block 1 — Heavy", tag: "strength", exercises: [
        { name: "Flat Barbell Bench Press", setsReps: "4 × 5", tempo: "2-0-1", exerciseKey: "bench_press",
          cue: "Rest: 90s → sang A2 | A1 SUPERSET với Bent-over Row. Siết bả vai vào ghế, chân đạp sàn. Đủ 4×5 → +1.25kg." },
        { name: "Barbell Bent-over Row", setsReps: "4 × 6", tempo: "2-1-1", exerciseKey: "barbell_row",
          cue: "Rest: 90s → quay lại A1 | A2. Thân gập ~45°, lưng thẳng. Kéo về rốn, không phải về ngực." }
      ]},

      { name: "💪 Block 2", tag: "strength", exercises: [
        { name: "Front Squat", setsReps: "3 × 8", tempo: "3-0-1", exerciseKey: "front_squat",
          cue: "Rest: 75s → sang B2 | B1 SUPERSET với Hip Thrust. Khuỷu tay cao, thân dựng đứng. Nhẹ hơn back squat khoảng 30%." },
        { name: "Hip Thrust", setsReps: "3 × 10", tempo: "2-2-1", exerciseKey: "hip_thrust",
          cue: "Rest: 75s → quay lại B1 | B2. Dừng 2 giây ở đỉnh, cằm hơi cúi. Siết mông chứ không ưỡn lưng." }
      ]},

      { name: "⚡ Block 3 — Accessory", tag: "accessories", exercises: [
        { name: "Pallof Press", setsReps: "3 × 12/bên", tempo: "", exerciseKey: "pallof_press",
          cue: "Rest: 60s → sang C2 | C1 SUPERSET với Face Pull. Core chống xoay — người KHÔNG được quay theo dây." },
        { name: "Face Pull", setsReps: "3 × 15", tempo: "2-1-1", exerciseKey: "face_pull",
          cue: "Rest: 60s → quay lại C1 | C2. Kéo về trán, khuỷu tay cao hơn cổ tay. Bài giữ vai khoẻ cho người đẩy nhiều." }
      ]},

      { name: "🔥 Circuit Finisher", tag: "circuit", exercises: [
        { name: "Rotational Ball Throw", setsReps: "3 vòng × 8/bên", tempo: "", exerciseKey: "rotational_ball_throw",
          cue: "Rest: 0s | 3 vòng, 4 bài liên tiếp, nghỉ 60s GIỮA VÒNG. Ném mạnh, xoay từ hông." },
        { name: "Walking Lunge", setsReps: "3 vòng × 10/bên", tempo: "", exerciseKey: "walking_lunge",
          cue: "Rest: 0s | Bước dài, gối sau gần chạm sàn. Tay không hoặc cầm dumbbell nhẹ." },
        { name: "Kettlebell Swing", setsReps: "3 vòng × 15", tempo: "", exerciseKey: "kb_swing",
          cue: "Rest: 0s | Bật hông chứ không phải squat rồi nhấc tay. Tạ dừng ngang ngực là đủ." },
        { name: "Row Erg", setsReps: "3 vòng × 40s", tempo: "", exerciseKey: "row_erg",
          cue: "Rest: 60s rồi vào vòng tiếp | Kéo mạnh, thả về chậm." }
      ]}
    ]}
  };

  // ── Thực thi ────────────────────────────────────────────────
  var db = firebase.firestore();
  var ref = db.collection('clients').doc(CLIENT_ID);

  ref.get().then(function (snap) {
    if (!snap.exists) throw new Error('Không tìm thấy client "' + CLIENT_ID + '"');

    var old = snap.data();

    console.log('%c=== PROGRAM HIỆN TẠI TRÊN FIRESTORE ===', 'font-weight:bold');
    console.log('name:', old.name, '| goal:', JSON.stringify(old.goal),
                '| level:', old.level, '| sessionsPerWeek:', old.sessionsPerWeek);
    var oldProg = old.program || {};
    Object.keys(oldProg).forEach(function (day) {
      console.log('  ' + day + ' — ' + (oldProg[day].label || ''));
      (oldProg[day].phases || []).forEach(function (ph) {
        console.log('    [' + ph.tag + '] ' + ph.name);
        (ph.exercises || []).forEach(function (e) {
          console.log('       - ' + e.name + '  |  ' + e.setsReps);
        });
      });
    });

    console.log('%c=== PROGRAM MỚI SẼ GHI ĐÈ ===', 'font-weight:bold');
    Object.keys(program).forEach(function (day) {
      console.log('  ' + day + ' — ' + program[day].label);
      program[day].phases.forEach(function (ph) {
        console.log('    [' + ph.tag + '] ' + ph.name +
                    '  (' + ph.exercises.length + ' bài)');
      });
    });
    console.log('goal mới:', NEW_GOAL);

    if (DRY_RUN) {
      console.log('%c\nDRY_RUN = true — KHÔNG ghi gì cả.\nĐổi DRY_RUN thành false rồi chạy lại để thực sự push.',
                  'color:#e6a700;font-weight:bold');
      return;
    }

    // Backup trước, ghi sau. Backup fail thì dừng luôn.
    return ref.collection('profile').doc(BACKUP_ID).set({
      savedAt: new Date().toISOString(),
      note: 'Backup trước khi đổi sang cấu trúc 3 block + circuit',
      goal: old.goal || '',
      program: oldProg
    }).then(function () {
      console.log('%c✓ Đã backup program cũ → clients/' + CLIENT_ID +
                  '/profile/' + BACKUP_ID, 'color:#2e9e4f');
      return ref.update({ program: program, goal: NEW_GOAL });
    }).then(function () {
      console.log('%c✓ ĐÃ PUSH XONG. Reload app và mở Joost để kiểm tra.',
                  'color:#2e9e4f;font-weight:bold');
    });
  }).catch(function (e) {
    console.error('LỖI:', e.message);
  });
})();
