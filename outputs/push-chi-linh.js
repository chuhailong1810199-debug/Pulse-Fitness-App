// ─────────────────────────────────────────────────────────────
// PUSH CHƯƠNG TRÌNH — Chị Linh
// Cách dùng: mở https://longchucoaching.com/index.html (đã đăng nhập coach)
//            F12 → Console → dán toàn bộ file này → Enter
// ─────────────────────────────────────────────────────────────
(function () {
  var db = firebase.firestore();

  db.collection('clients').doc('linh').get().then(function (d) {
    if (d.exists) throw new Error('clientId "linh" đã tồn tại: ' + (d.data().name || ''));

    var program = {
      SessionA: { label: "Session A — Glute + Lower", phases: [
        { name: "🔥 Warm-up", tag: "warmup", exercises: [
          { name: "Bike (nhẹ)", setsReps: "1 × 5 min", tempo: "", exerciseKey: "bike_warmup",
            cue: "Rest: 0s | Làm nóng, đạp chậm. Thở mũi được là đúng cường độ." },
          { name: "Glute Bridge", setsReps: "2 × 15", tempo: "2-2-1", exerciseKey: "glute_bridge",
            cue: "Rest: 30s | Siết mông 2 giây ở đỉnh. Không ưỡn lưng thay cho siết mông." },
          { name: "Banded Lateral Walk", setsReps: "2 × 12/side", tempo: "", exerciseKey: "banded_lateral_walk",
            cue: "Rest: 30s | Đánh thức mông nhỡ trước khi squat. Giữ gối không sập vào trong." }
        ]},
        { name: "💪 Main Strength", tag: "strength", exercises: [
          { name: "Hip Thrust", setsReps: "4 × 12", tempo: "2-2-1", exerciseKey: "hip_thrust",
            cue: "Rest: 90s | Bài số 1 cho size mông. Dừng 2 giây ở đỉnh, cằm hơi cúi. Tăng 2.5kg khi làm đủ 12 rep hai buổi liên tiếp." },
          { name: "Romanian Deadlift (Dumbbell)", setsReps: "3 × 12", tempo: "3-1-1", exerciseKey: "rdl_db",
            cue: "Rest: 90s | Đùi sau và mông. Đẩy hông ra sau, lưng thẳng. Căng ở đùi sau mới đúng — không phải lưng dưới." },
          { name: "Bulgarian Split Squat", setsReps: "3 × 10/side", tempo: "3-1-1", exerciseKey: "bulgarian_split_squat",
            cue: "Rest: 75s | Một chân nên mông làm việc nhiều hơn squat thường. Tuần 1-2 tay không, tuần 3-4 mới cầm tạ." }
        ]},
        { name: "⚡ Accessories", tag: "accessories", exercises: [
          { name: "Cable Kickback", setsReps: "3 × 15/side", tempo: "", exerciseKey: "cable_kickback",
            cue: "Rest: 45s | Mông lớn phần trên. Đá chậm, siết ở cuối tầm, không lấy đà bằng lưng." },
          { name: "Seated Hip Abduction", setsReps: "3 × 20", tempo: "", exerciseKey: "hip_abduction",
            cue: "Rest: 45s | Mông nhỡ — tạo độ tròn hai bên. Hơi ngả người ra trước sẽ ăn hơn." },
          { name: "Dead Bug", setsReps: "3 × 10/side", tempo: "", exerciseKey: "dead_bug",
            cue: "Rest: 45s | Core chống ưỡn lưng. Ép lưng dưới sát sàn suốt bài." }
        ]},
        { name: "🔥 Conditioning Finisher", tag: "circuit", exercises: [
          { name: "Incline Walk", setsReps: "1 × 8 min", tempo: "", exerciseKey: "incline_walk",
            cue: "Rest: 0s | Dốc 8-10%, đi nhanh, nhịp tim 65-70% max. Vẫn nói được câu ngắn. Đây là phần đốt mỡ chính." }
        ]}
      ]},

      SessionB: { label: "Session B — Upper + HYROX Circuit", phases: [
        { name: "🔥 Warm-up", tag: "warmup", exercises: [
          { name: "Rowing Machine (nhẹ)", setsReps: "1 × 5 min", tempo: "", exerciseKey: "row_warmup",
            cue: "Rest: 0s | Nhịp chậm làm nóng toàn thân." },
          { name: "Band Pull-Apart", setsReps: "2 × 15", tempo: "", exerciseKey: "band_pull_apart",
            cue: "Rest: 30s | Mở lưng trên, siết bả vai trước khi kéo." },
          { name: "Glute Bridge March", setsReps: "2 × 10/side", tempo: "", exerciseKey: "glute_bridge_march",
            cue: "Rest: 30s | Mông kết hợp core. Hông không đổ sang bên khi nhấc chân." }
        ]},
        { name: "💪 Main Strength", tag: "strength", exercises: [
          { name: "Sumo Deadlift (nhẹ)", setsReps: "3 × 12", tempo: "2-1-2", exerciseKey: "sumo_deadlift",
            cue: "Rest: 90s | Chân rộng, mũi chân hơi xoay ra — ăn mông và đùi trong. Giữ tạ nhẹ, ưu tiên kỹ thuật." },
          { name: "Lat Pulldown", setsReps: "3 × 12", tempo: "2-1-2", exerciseKey: "lat_pulldown",
            cue: "Rest: 75s | Lưng xô rộng ra làm eo trông nhỏ hơn. Kéo bằng lưng, không giật tay." },
          { name: "Dumbbell Shoulder Press", setsReps: "3 × 12", tempo: "2-0-2", exerciseKey: "db_shoulder_press",
            cue: "Rest: 75s | Vai tròn cũng giúp eo trông thon. Siết bụng, không ưỡn lưng khi đẩy." }
        ]},
        { name: "⚡ HYROX Circuit — 15 phút", tag: "circuit", exercises: [
          { name: "Wall Ball", setsReps: "4 × 12", tempo: "", exerciseKey: "wall_ball",
            cue: "Rest: 0s — chuyển ngay | Bóng 4-6kg. Squat sâu rồi dùng lực chân đẩy, tay chỉ dẫn hướng. Không có wall ball thì thay bằng Goblet Squat to Press." },
          { name: "Rowing Machine", setsReps: "4 × 200m", tempo: "", exerciseKey: "row_circuit",
            cue: "Rest: 0s — chuyển ngay | Đạp chân trước, thân sau, tay cuối. Không có máy chèo thì đạp bike 45 giây." },
          { name: "Walking Lunge (Dumbbell)", setsReps: "4 × 20m", tempo: "", exerciseKey: "walking_lunge_db",
            cue: "Rest: 0s — chuyển ngay | Trạm 7 HYROX. Mông làm việc nhiều nhất ở bài này. Gối sau chạm nhẹ sàn." },
          { name: "Farmer Carry (Dumbbell)", setsReps: "4 × 40m", tempo: "", exerciseKey: "farmer_carry",
            cue: "Rest: 90s hết vòng | Trạm 6. Vai kéo xuống, bụng siết — sửa luôn tư thế. Xong nghỉ 90s rồi vào vòng mới." }
        ]}
      ]}
    };

    return db.collection('clients').doc('linh').set({
      name: 'Chị Linh',
      email: null,                    // gán sau, phải đi qua /clientEmails
      level: 'Beginner',
      goal: 'Giảm mỡ + tăng size mông',
      sessionsPerWeek: 2,
      coachUid: 'longchu',
      notes: 'Khách freelance. Tạ nhẹ. Ưu tiên mông — tập cả 2 buổi. Giảm mỡ chủ yếu bằng conditioning + thâm hụt calo, không giảm theo vùng được. CHƯA xác nhận thiết bị phòng tập — phương án thay thế ghi trong cue.',
      program: program,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }).then(function () {
    return db.collection('clients').doc('linh').get();
  }).then(function (d) {
    var c = d.data(), p = c.program || {}, out = [];
    out.push('✅ ' + c.name + ' · ' + c.level + ' · ' + c.sessionsPerWeek + ' buổi/tuần');
    Object.keys(p).sort().forEach(function (k) {
      out.push(p[k].label);
      (p[k].phases || []).forEach(function (ph) {
        out.push('   ' + ph.name + ' — ' + ph.exercises.length + ' bài');
      });
    });
    console.log(out.join('\n'));
  }).catch(function (e) { console.error('LỖI:', e.message); });
})();
