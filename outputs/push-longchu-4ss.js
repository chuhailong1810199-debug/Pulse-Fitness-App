// ─────────────────────────────────────────────────────────────
// PUSH GIÁO ÁN MỚI — Long Chu (client `longchu`)
// 4 buổi/tuần: 2 tạ nặng + 1 metcon cứng + 1 Zone 2
// Thay giáo án CrossFit đẩy ngày 15/9
//
// Dùng: longchucoaching.com (đăng nhập COACH) → F12 → Console → dán → Enter
// Lần 1: DRY_RUN = true  → chỉ đọc, in ra, không ghi
// Lần 2: đổi false       → backup rồi ghi
// ─────────────────────────────────────────────────────────────
(function () {
  var DRY_RUN = true;

  var CLIENT_ID = 'longchu';
  var BACKUP_ID = 'program-backup-2026-09-18';
  var NEW_GOAL  = 'Fat loss — giữ cơ nạc, duy trì sức mạnh (2 buổi tạ nặng + metcon + Zone 2)';

  var program = {

    SessionA: { label: "Session A — Tạ nặng (chân) · 55 phút", phases: [
      { name: "🔥 Warm-up", tag: "warmup", exercises: [
        { name: "Bike (nhẹ)", setsReps: "1 × 3 min", tempo: "", exerciseKey: "bike_warmup",
          cue: "Rest: 0s | Đạp chậm. Thở mũi được là đúng cường độ." },
        { name: "Cable Rotation", setsReps: "2 × 10/bên", tempo: "", exerciseKey: "cable_rotation",
          cue: "Rest: 30s | Xoay từ hông, chân trụ vững." },
        { name: "Banded Glute Bridge", setsReps: "2 × 15", tempo: "2-2-1", exerciseKey: "banded_glute_bridge",
          cue: "Rest: 30s | Đánh thức mông trước khi squat. Gối đẩy ra ngoài chống dây." },
        { name: "Goblet Squat (nhẹ)", setsReps: "2 × 8", tempo: "3-1-1", exerciseKey: "goblet_squat_warmup",
          cue: "Rest: 30s | Mở hông, tập ngồi sâu." },
        { name: "Ramp-up Back Squat", setsReps: "1 × 4 bước", tempo: "", exerciseKey: "rampup_squat",
          cue: "Rest: 60s | bar×8 → 50%×5 → 70%×3 → 85%×1. Lên tạ làm việc ngay sau đó." }
      ]},
      { name: "💪 Block A", tag: "strength", exercises: [
        { name: "Back Squat", setsReps: "4 × 5", tempo: "2-0-1", exerciseKey: "back_squat",
          cue: "Rest: 90s → sang A2 | A1 SUPERSET với Pull-up. Đủ 4×5 kỹ thuật sạch → buổi sau +2.5kg. Set đầu nặng bất thường = chưa hồi, giảm tải hôm nay." },
        { name: "Pull-up (có tạ / dây)", setsReps: "4 × 6", tempo: "2-1-1", exerciseKey: "weighted_pull_up",
          cue: "Rest: 90s → quay lại A1 | A2. Kéo ngực về xà. Đủ 4×6 → thêm tạ hoặc bớt dây." }
      ]},
      { name: "💪 Block B", tag: "strength", exercises: [
        { name: "Romanian Deadlift", setsReps: "3 × 6", tempo: "3-1-1", exerciseKey: "rdl",
          cue: "Rest: 75s → sang B2 | B1 SUPERSET với DB Bench. Đẩy hông ra sau, tạ sát đùi. Căng đùi sau mới đúng." },
        { name: "DB Bench Press", setsReps: "3 × 8", tempo: "2-0-1", exerciseKey: "db_bench_press",
          cue: "Rest: 75s → quay lại B1 | B2. Bả vai siết vào ghế, khuỷu tay ~45 độ." }
      ]},
      { name: "🔥 Finisher", tag: "circuit", exercises: [
        { name: "SkiErg", setsReps: "AMRAP 8' · 12 cal", tempo: "", exerciseKey: "skierg",
          cue: "Rest: 0s | AMRAP 8 phút, 3 bài liên tiếp, không nghỉ. GHI LẠI số vòng + rep — lần sau phải phá. Finisher thiên thân trên vì chân đã đủ ở Block A-B." },
        { name: "DB Push Press 2×16kg", setsReps: "AMRAP 8' · 8 rep", tempo: "", exerciseKey: "db_push_press",
          cue: "Rest: 0s | Nhún chân lấy đà, khoá tay trên đầu." },
        { name: "Hollow Rock", setsReps: "AMRAP 8' · 12 rep", tempo: "", exerciseKey: "hollow_rock",
          cue: "Rest: 0s | Lưng dưới ép sát sàn. Lưng nhấc lên là co gối lại." }
      ]}
    ]},

    SessionB: { label: "Session B — Metcon cứng · 30 phút", phases: [
      { name: "🔥 Warm-up", tag: "warmup", exercises: [
        { name: "Row Erg (nhẹ)", setsReps: "1 × 3 min", tempo: "", exerciseKey: "row_erg_warmup",
          cue: "Rest: 0s | Nhịp chậm: chân → thân → tay." },
        { name: "Band Pull-apart", setsReps: "2 × 15", tempo: "", exerciseKey: "band_pull_apart",
          cue: "Rest: 30s | Khởi động lưng trên và vai sau." },
        { name: "Air Squat", setsReps: "2 × 10", tempo: "", exerciseKey: "air_squat",
          cue: "Rest: 30s | Mở hông, ngồi sâu." },
        { name: "Burpee (nhẹ)", setsReps: "2 × 5", tempo: "", exerciseKey: "burpee_warmup",
          cue: "Rest: 45s | Nâng nhịp tim dần, đừng đánh hết sức ở warm-up." }
      ]},
      { name: "🔥 Metcon — 4 vòng for time", tag: "circuit", exercises: [
        { name: "SkiErg 300m", setsReps: "4 vòng · 300m", tempo: "", exerciseKey: "skierg_300",
          cue: "Rest: 0s | BẤM GIỜ — mốc 13-16 phút. Đây là buổi DUY NHẤT trong tuần được đánh hết sức. || XOAY VÒNG 3 TUẦN: (A) bài này. (B) AMRAP 12': 6 power clean 40-50kg + 9 burpee + 12 wall ball. (C) 5 vòng for time: 250m row + 10 devil press 2x16kg + 15 sit-up. Đừng lặp cùng một bài 3-4 lần/tuần — đó là cách gân hỏng." },
        { name: "Farmer Carry 2×24kg", setsReps: "4 vòng · 40m", tempo: "", exerciseKey: "farmer_carry",
          cue: "Rest: 0s | Vai kéo xuống, thân không nghiêng." },
        { name: "Box Step-up", setsReps: "4 vòng · 15 rep", tempo: "", exerciseKey: "box_step_up",
          cue: "Rest: 0s | Đạp bằng gót chân trên, không đẩy bằng chân dưới." }
      ]}
    ]},

    SessionC: { label: "Session C — Tạ nặng (hinge + đẩy) · 55 phút", phases: [
      { name: "🔥 Warm-up", tag: "warmup", exercises: [
        { name: "Row Erg (nhẹ)", setsReps: "1 × 3 min", tempo: "", exerciseKey: "row_erg_warmup",
          cue: "Rest: 0s | Nhịp chậm cho nóng người." },
        { name: "Band Pull-apart", setsReps: "2 × 15", tempo: "", exerciseKey: "band_pull_apart",
          cue: "Rest: 30s | Tay thẳng, siết bả vai." },
        { name: "Scap Pull-up", setsReps: "2 × 8", tempo: "", exerciseKey: "scap_pull_up",
          cue: "Rest: 30s | Treo thẳng tay, chỉ kéo bả vai xuống, khuỷu KHÔNG gập." },
        { name: "Ramp-up Trap-bar Deadlift", setsReps: "1 × 3 bước", tempo: "", exerciseKey: "rampup_deadlift",
          cue: "Rest: 60s | 50%×5 → 70%×3 → 85%×1." }
      ]},
      { name: "💪 Block A", tag: "strength", exercises: [
        { name: "Trap-bar Deadlift", setsReps: "4 × 4", tempo: "2-0-1", exerciseKey: "trap_bar_deadlift",
          cue: "Rest: 90s → sang A2 | A1 SUPERSET với Overhead Press. Ngực cao, đẩy sàn ra xa. Đặt tạ có kiểm soát. Đủ 4×4 → +2.5kg." },
        { name: "Standing Overhead Press", setsReps: "4 × 6", tempo: "2-0-1", exerciseKey: "overhead_press",
          cue: "Rest: 90s → quay lại A1 | A2. Siết mông và core, không ưỡn lưng. Đủ 4×6 → +1.25kg." }
      ]},
      { name: "💪 Block B", tag: "strength", exercises: [
        { name: "Bulgarian Split Squat", setsReps: "3 × 8/bên", tempo: "3-1-1", exerciseKey: "bulgarian_split_squat",
          cue: "Rest: 75s → sang B2 | B1 SUPERSET với Barbell Row. Chân sau chỉ giữ thăng bằng." },
        { name: "Barbell Bent-over Row", setsReps: "3 × 8", tempo: "2-1-1", exerciseKey: "barbell_row",
          cue: "Rest: 75s → quay lại B1 | B2. Thân gập ~45 độ, kéo về rốn." }
      ]},
      { name: "🔥 Finisher", tag: "circuit", exercises: [
        { name: "Row Erg", setsReps: "AMRAP 8' · 10 cal", tempo: "", exerciseKey: "row_erg",
          cue: "Rest: 0s | AMRAP 8 phút, 3 bài liên tiếp. GHI LẠI số vòng + rep." },
        { name: "Wall Ball", setsReps: "AMRAP 8' · 10 rep", tempo: "", exerciseKey: "wall_ball",
          cue: "Rest: 0s | Ngồi sâu, bung hông, bóng chạm đúng mốc." },
        { name: "V-up", setsReps: "AMRAP 8' · 10 rep", tempo: "", exerciseKey: "v_up",
          cue: "Rest: 0s | Chậm và sạch, không lấy đà." }
      ]}
    ]},

    SessionD: { label: "Session D — Zone 2 · 35 phút", phases: [
      { name: "🔥 Zone 2", tag: "circuit", exercises: [
        { name: "Zone 2 (Ski / Bike / Row / đi bộ dốc)", setsReps: "30 phút · thở mũi", tempo: "", exerciseKey: "zone2",
          cue: "Rest: 0s | THỞ MŨI ĐƯỢC, NÓI CÂU DÀI ĐƯỢC. Nhịp tim 60-70% max. Thấy nặng là đang đi quá nhanh — chậm lại. || Đây là buổi dễ bỏ nhất và cần nhất: đốt mỡ mà KHÔNG tạo nợ hồi phục, còn giúp dọn mệt từ 3 buổi kia. Bỏ nó rồi nhét thêm metcon là quay lại đúng vòng lặp làm mày mệt." }
      ]},
      { name: "⚡ Core", tag: "circuit", exercises: [
        { name: "Plank", setsReps: "3 × 45s", tempo: "", exerciseKey: "plank",
          cue: "Rest: 45s | Thân thẳng một đường, siết mông." },
        { name: "Dead Bug", setsReps: "3 × 10/bên", tempo: "", exerciseKey: "dead_bug",
          cue: "Rest: 45s | Ép lưng dưới sát sàn suốt bài." }
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
    console.log('goal:', JSON.stringify(old.goal), '| spw:', old.sessionsPerWeek);
    Object.keys(oldProg).forEach(function (day) {
      console.log('  ' + day + ' — ' + (oldProg[day].label || ''));
      (oldProg[day].phases || []).forEach(function (ph) {
        console.log('    [' + ph.tag + '] ' + ph.name + ' (' + (ph.exercises || []).length + ' bài)');
      });
    });

    console.log('%c=== SẼ GHI ĐÈ ===', 'font-weight:bold');
    Object.keys(program).forEach(function (day) {
      console.log('  ' + day + ' — ' + program[day].label);
      program[day].phases.forEach(function (ph) {
        console.log('    [' + ph.tag + '] ' + ph.name + ' (' + ph.exercises.length + ' bài)');
      });
    });
    console.log('goal mới:', NEW_GOAL);

    if (DRY_RUN) {
      console.log('%c\nDRY_RUN = true — KHÔNG ghi gì.\nĐổi thành false rồi chạy lại để push.',
                  'color:#e6a700;font-weight:bold');
      return;
    }

    return ref.collection('profile').doc(BACKUP_ID).set({
      savedAt: new Date().toISOString(),
      note: 'Backup trước khi đổi sang 4 buổi phân cực (2 tạ + metcon + Zone 2)',
      goal: old.goal || '',
      program: oldProg
    }).then(function () {
      console.log('%c✓ Backup xong → clients/' + CLIENT_ID + '/profile/' + BACKUP_ID, 'color:#2e9e4f');
      return ref.update({ program: program, goal: NEW_GOAL, sessionsPerWeek: 4 });
    }).then(function () {
      console.log('%c✓ PUSH XONG. Reload app để xem.', 'color:#2e9e4f;font-weight:bold');
    });
  }).catch(function (e) { console.error('LỖI:', e.message); });
})();
