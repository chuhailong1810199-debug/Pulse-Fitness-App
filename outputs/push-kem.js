// ─────────────────────────────────────────────────────────────
// TẠO CLIENT MỚI + PUSH GIÁO ÁN — Kem
// Coach-managed (email: ''), 3 buổi/tuần
// Flow: Warm-up → Core Activation → Plyometrics → Hypertrophy → Intervals
//
// Dùng: longchucoaching.com (đăng nhập COACH) → F12 → Console → dán → Enter
// Lần 1: DRY_RUN = true  → chỉ kiểm tra, không ghi
// Lần 2: đổi false       → tạo client + ghi giáo án
// ─────────────────────────────────────────────────────────────
(function () {
  var DRY_RUN = true;

  var CLIENT_ID = 'kem';

  // Bậc A = tuần 1-2 (học tiếp đất). Bậc B ghi trong cue, lên từ tuần 3.
  var program = {

    SessionA: { label: "Session A — Squat + đẩy/kéo ngang", phases: [

      { name: "🔥 Warm-up", tag: "warmup", exercises: [
        { name: "Bike / Row (nhẹ)", setsReps: "1 × 3 min", tempo: "", exerciseKey: "bike_warmup",
          cue: "Rest: 0s | Thở mũi được là đúng cường độ." },
        { name: "World's Greatest Stretch", setsReps: "1 × 5/bên", tempo: "", exerciseKey: "worlds_greatest_stretch",
          cue: "Rest: 0s | Mở hông và ngực. Giữ 2 giây ở vị trí xoắn." },
        { name: "Leg Swing", setsReps: "1 × 10/bên", tempo: "", exerciseKey: "leg_swing",
          cue: "Rest: 0s | Trước-sau rồi ngang. Biên độ tăng dần, không giật." },
        { name: "Band Pull-apart", setsReps: "1 × 15", tempo: "", exerciseKey: "band_pull_apart",
          cue: "Rest: 30s | Tay thẳng, siết bả vai." }
      ]},

      { name: "🧘 Core Activation", tag: "warmup", exercises: [
        { name: "Dead Bug", setsReps: "2 × 8/bên", tempo: "", exerciseKey: "dead_bug",
          cue: "Rest: 30s | Ép lưng dưới sát sàn suốt bài. Lưng rời sàn là dừng." },
        { name: "Side Plank", setsReps: "2 × 30s/bên", tempo: "", exerciseKey: "side_plank",
          cue: "Rest: 30s | Hông đẩy cao, thân thẳng một đường từ vai tới gót." },
        { name: "Bird Dog", setsReps: "2 × 8/bên", tempo: "", exerciseKey: "bird_dog",
          cue: "Rest: 30s | Tay chân đối nhau. Hông KHÔNG được lắc." }
      ]},

      { name: "⚡ Plyometrics", tag: "strength", exercises: [
        { name: "Pogo Hop", setsReps: "3 × 10", tempo: "", exerciseKey: "pogo_hop",
          cue: "Rest: 45s | BẬC A (tuần 1-2). Bật bằng cổ chân, gối gần thẳng, chạm đất nhanh và êm. || BẬC B tuần 3+: 3 × 15. || Nghe tiếng bịch khi tiếp đất = lùi về bậc A." },
        { name: "Box Jump (bước xuống)", setsReps: "3 × 5", tempo: "", exerciseKey: "box_jump",
          cue: "Rest: 60s | BẬC A: nhảy lên, ĐI BỘ xuống — không nhảy xuống. Bục vừa tầm, tiếp đất gối hơi chùng. || BẬC B tuần 3+: giữ 3 × 5, tăng độ cao bục." },
        { name: "Lateral Bound", setsReps: "3 × 4/bên", tempo: "", exerciseKey: "lateral_bound",
          cue: "Rest: 60s | BẬC A: bật ngang, DỪNG 1 GIÂY khi tiếp đất mới bật tiếp. Gối không sập vào trong. || BẬC B tuần 3+: 3 × 6/bên liên tục, không dừng." }
      ]},

      { name: "💪 Hypertrophy", tag: "strength", exercises: [
        { name: "Goblet Squat", setsReps: "3 × 8-10", tempo: "3-1-1", exerciseKey: "goblet_squat",
          cue: "Rest: 75s → sang A2 | A1 SUPERSET với DB Bench. Ngực cao, ngồi xuống giữa hai bàn chân. Đủ 3×10 tất cả set → tăng tạ." },
        { name: "DB Bench Press", setsReps: "3 × 8-10", tempo: "2-0-1", exerciseKey: "db_bench_press",
          cue: "Rest: 75s → quay lại A1 | A2. Khuỷu tay ~45 độ so với thân, không banh ngang." },
        { name: "Romanian Deadlift", setsReps: "3 × 10", tempo: "3-1-1", exerciseKey: "rdl",
          cue: "Rest: 75s → sang B2 | B1 SUPERSET với Chest-Supported Row. Đẩy hông ra sau, lưng thẳng. Căng đùi sau mới đúng." },
        { name: "Chest-Supported Row", setsReps: "3 × 10", tempo: "2-1-1", exerciseKey: "chest_supported_row",
          cue: "Rest: 75s → quay lại B1 | B2. Ngực tì ghế, siết bả vai 1 giây ở cuối." },
        { name: "Walking Lunge", setsReps: "2 × 10/bên", tempo: "", exerciseKey: "walking_lunge",
          cue: "Rest: 60s → sang C2 | C1 SUPERSET với Face Pull. Bước dài, gối sau gần chạm sàn." },
        { name: "Face Pull", setsReps: "2 × 15", tempo: "2-1-1", exerciseKey: "face_pull",
          cue: "Rest: 60s → quay lại C1 | C2. Kéo về trán, khuỷu tay cao hơn cổ tay." }
      ]},

      { name: "🏃 Intervals — Rower", tag: "circuit", exercises: [
        { name: "Row Interval", setsReps: "8 vòng · 30s mạnh / 30s nhẹ", tempo: "", exerciseKey: "row_interval",
          cue: "Rest: 0s | 8 vòng liên tục, tổng 8 phút. GHI LẠI TỔNG MÉT — tuần sau phải hơn. Interval không đo thì chỉ là mệt cho vui." }
      ]}
    ]},

    SessionB: { label: "Session B — Hinge + đẩy/kéo dọc", phases: [

      { name: "🔥 Warm-up", tag: "warmup", exercises: [
        { name: "SkiErg (nhẹ)", setsReps: "1 × 3 min", tempo: "", exerciseKey: "ski_warmup",
          cue: "Rest: 0s | Nhịp chậm, tập trung vào động tác gập hông." },
        { name: "Hip Airplane", setsReps: "1 × 5/bên", tempo: "", exerciseKey: "hip_airplane",
          cue: "Rest: 0s | Đứng một chân, xoay hông mở ra rồi đóng vào. Chậm, có kiểm soát." },
        { name: "Scap Pull-up", setsReps: "2 × 8", tempo: "", exerciseKey: "scap_pull_up",
          cue: "Rest: 30s | Treo thẳng tay, chỉ kéo bả vai xuống — khuỷu tay KHÔNG gập." },
        { name: "Banded Glute Bridge", setsReps: "1 × 15", tempo: "2-2-1", exerciseKey: "banded_glute_bridge",
          cue: "Rest: 30s | Siết mông 2 giây ở đỉnh, gối đẩy ra ngoài chống dây." }
      ]},

      { name: "🧘 Core Activation", tag: "warmup", exercises: [
        { name: "Pallof Press", setsReps: "2 × 10/bên", tempo: "", exerciseKey: "pallof_press",
          cue: "Rest: 30s | Core chống xoay — người KHÔNG được quay theo dây." },
        { name: "Hollow Hold", setsReps: "2 × 20s", tempo: "", exerciseKey: "hollow_hold",
          cue: "Rest: 30s | Lưng dưới ép sát sàn. Giữ không nổi thì co gối lại." },
        { name: "Copenhagen Plank (chống gối)", setsReps: "2 × 20s/bên", tempo: "", exerciseKey: "copenhagen_plank",
          cue: "Rest: 30s | Chân trên gác ghế, chống bằng ĐẦU GỐI chân dưới. Bài giữ háng khoẻ, quan trọng với người nhảy nhiều." }
      ]},

      { name: "⚡ Plyometrics", tag: "strength", exercises: [
        { name: "Broad Jump", setsReps: "3 × 4", tempo: "", exerciseKey: "broad_jump",
          cue: "Rest: 60s | BẬC A: nhảy xa, DỪNG HẲN khi tiếp đất, đi bộ về. Tiếp đất hai chân, gối chùng, ngực cao. || BẬC B tuần 3+: 3 × 4 liên tục, không dừng giữa các lần." },
        { name: "Snap Down (Depth Drop)", setsReps: "3 × 5", tempo: "", exerciseKey: "snap_down",
          cue: "Rest: 60s | BẬC A: đứng bục thấp, bước xuống và TIẾP ĐẤT ĐỨNG YÊN ở tư thế squat nông. Học hấp thụ lực trước khi học bật lại. || BẬC B tuần 3+: Depth Jump 3 × 4 — tiếp đất rồi bật lên ngay." },
        { name: "Split Jump", setsReps: "3 × 6 tổng", tempo: "", exerciseKey: "split_jump",
          cue: "Rest: 60s | BẬC A: 6 lần đổi chân tổng cộng, tiếp đất êm. || BẬC B tuần 3+: 3 × 10 tổng." }
      ]},

      { name: "💪 Hypertrophy", tag: "strength", exercises: [
        { name: "Trap-bar / KB Deadlift", setsReps: "3 × 8", tempo: "2-0-1", exerciseKey: "trap_bar_deadlift",
          cue: "Rest: 90s → sang A2 | A1 SUPERSET với Shoulder Press. Ngực cao, đẩy sàn ra xa. Đặt tạ xuống có kiểm soát." },
        { name: "DB Shoulder Press", setsReps: "3 × 10", tempo: "2-0-1", exerciseKey: "db_shoulder_press",
          cue: "Rest: 90s → quay lại A1 | A2. Siết mông và core, không ưỡn lưng để đẩy." },
        { name: "Bulgarian Split Squat", setsReps: "3 × 8/bên", tempo: "3-1-1", exerciseKey: "bulgarian_split_squat",
          cue: "Rest: 75s → sang B2 | B1 SUPERSET với Lat Pulldown. Chân sau chỉ giữ thăng bằng, lực dồn chân trước." },
        { name: "Lat Pulldown", setsReps: "3 × 10", tempo: "2-1-1", exerciseKey: "lat_pulldown",
          cue: "Rest: 75s → quay lại B1 | B2. Kéo xuống ngực trên, khuỷu tay ép xuống cạnh sườn." },
        { name: "Seated Leg Curl", setsReps: "2 × 12", tempo: "2-1-1", exerciseKey: "seated_leg_curl",
          cue: "Rest: 60s → sang C2 | C1 SUPERSET với DB Curl. Hạ chậm 2 giây — pha hạ mới xây đùi sau." },
        { name: "DB Curl", setsReps: "2 × 12", tempo: "2-1-1", exerciseKey: "db_curl",
          cue: "Rest: 60s → quay lại C1 | C2. Khuỷu tay cố định sát sườn, không đu người." }
      ]},

      { name: "🏃 Intervals — SkiErg", tag: "circuit", exercises: [
        { name: "Ski Interval", setsReps: "6 vòng · 45s mạnh / 75s nhẹ", tempo: "", exerciseKey: "ski_interval",
          cue: "Rest: 0s | 6 vòng, tổng 12 phút. GHI LẠI TỔNG CALO. Vòng cuối phải ngang vòng đầu — tụt nhiều nghĩa là vào quá mạnh." }
      ]}
    ]},

    SessionC: { label: "Session C — Chân đơn + hỗn hợp", phases: [

      { name: "🔥 Warm-up", tag: "warmup", exercises: [
        { name: "Bike (nhẹ)", setsReps: "1 × 3 min", tempo: "", exerciseKey: "bike_warmup",
          cue: "Rest: 0s | Đạp chậm cho nóng người." },
        { name: "Ankle Rock", setsReps: "1 × 10/bên", tempo: "", exerciseKey: "ankle_rock",
          cue: "Rest: 0s | Gối đẩy qua mũi chân, gót KHÔNG rời sàn. Mở cổ chân trước khi nhảy." },
        { name: "Cable Rotation", setsReps: "1 × 10/bên", tempo: "", exerciseKey: "cable_rotation",
          cue: "Rest: 30s | Xoay từ hông chứ không từ vai. Chân trụ vững." },
        { name: "Band Pull-apart", setsReps: "1 × 15", tempo: "", exerciseKey: "band_pull_apart",
          cue: "Rest: 30s | Tay thẳng, siết bả vai." }
      ]},

      { name: "🧘 Core Activation", tag: "warmup", exercises: [
        { name: "Dead Bug (tay chân đối)", setsReps: "2 × 8/bên", tempo: "", exerciseKey: "dead_bug",
          cue: "Rest: 30s | Duỗi tay và chân ĐỐI NHAU cùng lúc. Lưng dưới ép sàn." },
        { name: "Side Plank Reach", setsReps: "2 × 8/bên", tempo: "", exerciseKey: "side_plank_reach",
          cue: "Rest: 30s | Từ side plank, luồn tay trên xuống dưới thân rồi mở ra. Hông giữ cao." },
        { name: "Bird Dog", setsReps: "2 × 8/bên", tempo: "", exerciseKey: "bird_dog",
          cue: "Rest: 30s | Chậm. Đặt cốc nước lên lưng dưới mà không đổ là đạt." }
      ]},

      { name: "⚡ Plyometrics", tag: "strength", exercises: [
        { name: "Lateral Line Hop", setsReps: "3 × 10/bên", tempo: "", exerciseKey: "lateral_line_hop",
          cue: "Rest: 45s | BẬC A: nhảy qua lại một vạch, hai chân, chạm đất nhanh và nhẹ. || BẬC B tuần 3+: 3 × 15/bên, hoặc một chân." },
        { name: "Step-up Jump", setsReps: "3 × 5/bên", tempo: "", exerciseKey: "step_up_jump",
          cue: "Rest: 60s | BẬC A: đạp chân trên bục bật lên, tiếp đất êm, reset mỗi lần. Bục thấp. || BẬC B tuần 3+: 3 × 6/bên." },
        { name: "A-Skip", setsReps: "3 × 15m", tempo: "", exerciseKey: "a_skip",
          cue: "Rest: 45s | BẬC A: nâng gối, cổ chân khoá, tiếp đất bằng nửa bàn chân trước. Đây là bài kỹ thuật chạy, làm chậm và sạch. || BẬC B tuần 3+: 3 × 20m." }
      ]},

      { name: "💪 Hypertrophy", tag: "strength", exercises: [
        { name: "Front / Goblet Squat", setsReps: "3 × 10", tempo: "3-0-1", exerciseKey: "front_squat",
          cue: "Rest: 75s → sang A2 | A1 SUPERSET với Incline Press. Khuỷu tay cao, thân dựng đứng." },
        { name: "Incline DB Press", setsReps: "3 × 10", tempo: "2-0-1", exerciseKey: "incline_db_press",
          cue: "Rest: 75s → quay lại A1 | A2. Ghế dốc 30 độ." },
        { name: "Hip Thrust", setsReps: "3 × 12", tempo: "2-2-1", exerciseKey: "hip_thrust",
          cue: "Rest: 75s → sang B2 | B1 SUPERSET với Seated Row. Dừng 2 giây ở đỉnh, cằm hơi cúi. Siết mông chứ không ưỡn lưng." },
        { name: "Seated Cable Row", setsReps: "3 × 12", tempo: "2-1-1", exerciseKey: "seated_cable_row",
          cue: "Rest: 75s → quay lại B1 | B2. Ngực mở, kéo về rốn, không ngả người lấy đà." },
        { name: "Step-up", setsReps: "2 × 10/bên", tempo: "2-1-1", exerciseKey: "step_up",
          cue: "Rest: 60s → sang C2 | C1 SUPERSET với Lateral Raise. Đạp bằng gót chân trên, không đẩy bằng chân dưới." },
        { name: "Lateral Raise", setsReps: "2 × 15", tempo: "2-1-1", exerciseKey: "lateral_raise",
          cue: "Rest: 60s → quay lại C1 | C2. Tạ nhẹ, nâng tới ngang vai, không nhún người." }
      ]},

      { name: "🏃 Intervals — Chạy", tag: "circuit", exercises: [
        { name: "Run Interval", setsReps: "8 vòng · 200m nhanh / 60s đi bộ", tempo: "", exerciseKey: "run_interval",
          cue: "Rest: 0s | 8 vòng. GHI LẠI THỜI GIAN 200m của vòng đầu và vòng cuối. Chênh quá 15% nghĩa là vòng đầu chạy quá nhanh." }
      ]}
    ]}
  };

  // ── Thực thi ────────────────────────────────────────────────
  var db = firebase.firestore();
  var ref = db.collection('clients').doc(CLIENT_ID);

  ref.get().then(function (snap) {
    // An toàn: không bao giờ ghi đè một client đã tồn tại
    if (snap.exists) {
      throw new Error('clientId "' + CLIENT_ID + '" ĐÃ TỒN TẠI: ' +
        (snap.data().name || '') + ' — dừng lại, không ghi đè.');
    }

    // Lấy coachUid từ một client có sẵn thay vì đoán
    return db.collection('clients').doc('joost').get().then(function (ref2) {
      var coachUid = ref2.exists ? ref2.data().coachUid : undefined;

      var payload = {
        name: 'Kem',
        email: '',                      // coach-managed — KHÔNG dùng placeholder
        level: 'Beginner',
        goal: 'Phát triển thể chất — sức mạnh, sức bật, nền thể lực',
        sessionsPerWeek: 3,
        program: program
      };
      if (coachUid !== undefined) payload.coachUid = coachUid;

      var nEx = Object.keys(program).reduce(function (n, d) {
        return n + program[d].phases.reduce(function (m, p) { return m + p.exercises.length; }, 0);
      }, 0);

      console.log('%c=== SẼ TẠO CLIENT MỚI ===', 'font-weight:bold');
      console.log('clientId:', CLIENT_ID, '| name:', payload.name,
                  '| email:', JSON.stringify(payload.email),
                  '| level:', payload.level, '| spw:', payload.sessionsPerWeek);
      console.log('coachUid:', coachUid === undefined ? '(không tìm thấy — bỏ qua field)' : coachUid);
      console.log('goal:', payload.goal);
      Object.keys(program).forEach(function (day) {
        console.log('  ' + day + ' — ' + program[day].label);
        program[day].phases.forEach(function (ph) {
          console.log('    [' + ph.tag + '] ' + ph.name + ' (' + ph.exercises.length + ' bài)');
        });
      });
      console.log('tổng:', nEx, 'bài');

      if (DRY_RUN) {
        console.log('%c\nDRY_RUN = true — KHÔNG ghi gì.\nĐổi thành false rồi chạy lại để tạo.',
                    'color:#e6a700;font-weight:bold');
        return;
      }

      // email rỗng nên KHÔNG tạo entry trong /clientEmails —
      // index đó chỉ dành cho địa chỉ thật.
      return ref.set(payload).then(function () {
        console.log('%c✓ ĐÃ TẠO clients/' + CLIENT_ID + ' với ' + nEx + ' bài.',
                    'color:#2e9e4f;font-weight:bold');
        console.log('Reload app rồi chọn Kem trong dropdown để kiểm tra.');
      });
    });
  }).catch(function (e) { console.error('LỖI:', e.message); });
})();
