/**
 * Bổ trợ S&C theo MÔN THỂ THAO (2026-11-16) — MỘT nguồn cho cả app (tab Anatomy → Thể thao) lẫn trợ lý Pulse soạn giáo án.
 *
 * index.html có BẢN SAO phần dữ liệu (khối `// ── SPORTS — TẠO TỪ functions/sports.js`), dựng bằng
 *   node scripts/sports/sync.js
 * tests/sports.test.js bắt hai bản giống hệt. Sửa môn / bài / liều = sửa Ở ĐÂY rồi chạy sync.
 *
 * Mỗi môn: key (cơ chủ lực → vai trò, id nhóm cơ của tab Anatomy), k2 (cơ hỗ trợ), demands / risk / plan,
 * season (ngoài mùa / trước giải / trong mùa), blocks. Mỗi block: id, tag pha (warmup|strength|accessories|circuit),
 * need (tuần phải có ≥ 1 bài của khối — server chặn), plyo (bài nhảy: khách < 18 theo trần tiếp đất youth),
 * ex: [tên hiển thị, liều (tiếng Việt), tên ĐÚNG Y thư viện]. Khối circuit được dùng bài ngoài thư viện (không có mục 3).
 * Bài mới cần cho môn mà thư viện chưa có → NEW_LIBRARY (coach duyệt, ghi bằng scripts/sports/add-library.js).
 *
 * Nội dung là KHUNG CHUNG cho người tập phong trào / bán chuyên — coach chỉnh theo khách.
 */

const SPORTS = {
  boxing: {
    vi: 'Boxing',
    en: 'Boxing',
    sum: {
      vi: 'Cú đấm mạnh đi từ chân lên: đạp đất → xoay hông → xoắn thân → đẩy vai → nắm tay. Bổ trợ nhắm vào lực đó, sức bền theo hiệp, và đôi vai – cổ chịu được va chạm.',
      en: 'A hard punch starts at the floor: drive the legs → turn the hips → twist the trunk → push through the shoulder → fist. S&C trains that chain, round-by-round endurance, and shoulders and a neck that tolerate impact.',
    },
    demands: {
      vi: [
        'Công suất (sinh lực nhanh) theo chuỗi chân – hông – thân – tay',
        'Lặp lại nỗ lực cường độ cao: hiệp 2–3 phút, nghỉ 1 phút — cần cả nền aerobic lẫn sức chịu yếm khí',
        'Vai bền để giữ guard suốt hiệp',
        'Bước chân nhanh, bắp chân – cổ chân khoẻ',
        'Cổ khoẻ để chịu đòn vào đầu',
      ],
      en: [
        'Power (force produced fast) through the leg – hip – trunk – arm chain',
        'Repeated high-intensity efforts: 2–3 min rounds, 1 min rest — needs both an aerobic base and anaerobic capacity',
        'Shoulder endurance to keep the guard up all round',
        'Quick footwork, strong calves and ankles',
        'A strong neck to tolerate head impacts',
      ],
    },
    key: {
      'glute-max': {
        vi: 'Đạp đất và xoay hông — nguồn lực đầu tiên của cú đấm.',
        en: 'Drives off the floor and turns the hips — where the punch starts.',
      },
      obliques: {
        vi: 'Truyền lực xoay từ hông lên vai; cũng là cơ "phanh" sau cú đấm.',
        en: 'Carries rotation from hips to shoulders, and brakes it after the punch.',
      },
      serratus: {
        vi: 'Đẩy xương bả vai ra trước ở cuối cú đấm — "cơ của võ sĩ".',
        en: 'Drives the shoulder blade forward at the end of the punch — the "boxer\'s muscle".',
      },
      'delt-f': {
        vi: 'Đưa tay lên và ra trước; giữ guard cả hiệp nên cần bền.',
        en: 'Lifts the arm forward; holds the guard all round, so it needs endurance.',
      },
      triceps: {
        vi: 'Duỗi khuỷu ở cú thẳng (jab, cross) — nhanh, không cần to.',
        en: 'Straightens the elbow on jab and cross — speed matters more than size.',
      },
      gastroc: {
        vi: 'Nhón gót, nảy bước chân, đẩy từ mũi chân khi ra đòn.',
        en: 'Keeps you on the balls of the feet, bounces the footwork, pushes off into punches.',
      },
      neck: {
        vi: 'Giữ đầu vững khi trúng đòn; cổ khoẻ hơn = đầu ít bị giật hơn.',
        en: 'Braces the head on impact; a stronger neck means less head whip.',
      },
    },
    k2: ['quads', 'hams', 'glute-med', 'adductors', 'abs', 'lats', 'rotator', 'delt-r', 'traps', 'chest-lower', 'forearm-flex', 'soleus'],
    risk: {
      vi: [
        'Vai: chóp xoay, chèn ép — vai trước làm việc nhiều, vai sau ít',
        'Cổ tay, đốt bàn tay (gãy ngón 5 khi đấm sai)',
        'Cổ',
        'Lưng dưới do xoay lặp lại',
        'Lật cổ chân khi di chuyển',
      ],
      en: [
        'Shoulder: rotator cuff, impingement — front works a lot, back very little',
        'Wrist and knuckles (5th metacarpal fracture on a bad punch)',
        'Neck',
        'Lower back from repeated rotation',
        'Ankle sprains from footwork',
      ],
    },
    blocks: [
      {
        id: 'strength',
        vi: 'Sức mạnh nền',
        en: 'Base strength',
        tag: 'strength',
        need: true,
        why: {
          vi: 'Lực tối đa là trần của công suất. Tạ nặng, ít rep, nghỉ đủ — không tập tới thất bại.',
          en: 'Max strength is the ceiling for power. Heavy, low reps, full rest — never to failure.',
        },
        ex: [
          ['Trap Bar Deadlift', '3–5×3–5', 'Deadlift (Trap Bar)'],
          ['Front Squat', '3–5×3–5', 'Front Squat (Barbell)'],
          ['Bulgarian Split Squat', '3×6/bên', 'Bulgarian Split Squat'],
          ['Landmine Press', '3×6/bên', 'Standing Landmine Shoulder Press (Barbell)'],
          ['Pull-Up', '3×5–8', 'Pull-up'],
        ],
      },
      {
        id: 'power',
        vi: 'Công suất xoay & cú đấm',
        en: 'Rotational & punching power',
        tag: 'strength',
        need: true,
        plyo: true,
        why: {
          vi: 'Tập NHANH và hết sức, ít rep, nghỉ 60–90 giây. Đặt đầu buổi khi còn tươi.',
          en: 'Move FAST with full intent, few reps, 60–90 s rest. Do it first while fresh.',
        },
        ex: [
          ['Med Ball Rotational Scoop Toss', '3×5/bên', 'Med Ball Side Throw (Med Ball)'],
          ['Med Ball Shot Put', '3×5/bên', 'Shot Put Throw (Med Ball)'],
          ['Landmine Rotation', '3×5/bên', 'Landmine Twist'],
          ['Box Jump', '3×3–5', 'Box Jump'],
          ['Plyometric Push-Up', '3×5', 'Plyometric Push Up (Bodyweight)'],
        ],
      },
      {
        id: 'core',
        vi: 'Core chống xoay',
        en: 'Anti-rotation core',
        tag: 'accessories',
        why: {
          vi: 'Thân cứng thì lực từ hông không bị "rò" trước khi tới tay, và lưng dưới được bảo vệ.',
          en: 'A stiff trunk stops force leaking between hips and fist, and protects the lower back.',
        },
        ex: [
          ['Pallof Press', '3×10/bên', 'Pallof Press (Cable)'],
          ['Cable Woodchop', '3×8/bên', 'Wood Chop (Cable Machine)'],
          ['Dead Bug', '3×8/bên', 'Dead Bug (Bodyweight)'],
          ['Side Plank', '3×30 giây/bên', 'Side Plank (Bodyweight)'],
        ],
      },
      {
        id: 'prehab',
        vi: 'Vai, cổ, cổ tay — phòng chấn thương',
        en: 'Shoulder, neck, wrist — injury prevention',
        tag: 'accessories',
        need: true,
        why: {
          vi: 'Cân lại vai trước – vai sau, giữ xương bả vai khoẻ, cổ và cẳng tay chịu va chạm. Làm đều mỗi buổi, nhẹ.',
          en: 'Balances front vs back shoulder, keeps the shoulder blade strong, and toughens neck and forearms. Light, every session.',
        },
        ex: [
          ['Face Pull', '3×15', 'Face Pull'],
          ['Cable External Rotation', '2–3×12–15', 'External Rotation (Cable)'],
          ['Push-Up Plus', '2×12', 'Push Up Plus (Bodyweight)'],
          ['Neck Isometrics (4 hướng)', '3×15–20 giây', 'Neck Isometric Hold (Bodyweight)'],
          ['Farmer Carry', '3×30 m', 'Farmer\'s Carry (Dumbbell)'],
        ],
      },
      {
        id: 'cond',
        vi: 'Thể lực theo hiệp',
        en: 'Round-based conditioning',
        tag: 'circuit',
        why: {
          vi: 'Khớp với nhịp trận: làm đúng thời lượng hiệp, nghỉ đúng 1 phút. Thêm sprint ngắn cho bùng nổ và chạy nhẹ cho nền aerobic.',
          en: 'Match the fight: work the length of a round, rest exactly 1 min. Add short sprints for bursts and easy runs for the aerobic base.',
        },
        ex: [
          ['Interval bao cát / Assault Bike', '3 phút làm / 1 phút nghỉ × số hiệp thi đấu'],
          ['Sprint ngắn', '8–10 × 10–15 giây, nghỉ 45 giây', 'Sprint (Bodyweight)'],
          ['Nhảy dây', '3 × 3 phút', 'Jump Rope'],
          ['Chạy nhẹ (nói chuyện được)', '30–40 phút, 1–2 lần/tuần'],
        ],
      },
    ],
    plan: {
      vi: [
        'Ngoài mùa thi đấu: 2–3 buổi S&C/tuần. Gần trận: 1–2 buổi, giữ tạ nặng nhưng bớt set.',
        'Trong buổi: công suất → sức mạnh → core / phòng chấn thương. Thể lực để cuối hoặc buổi riêng.',
        'Không tập chân nặng ngay trước buổi sparring.',
        '7–10 ngày trước trận: giảm khối lượng, giữ cường độ.',
      ],
      en: [
        'Off-season: 2–3 S&C sessions a week. Near a fight: 1–2, keep the heavy loads but cut sets.',
        'Within a session: power → strength → core / prehab. Conditioning last or on its own day.',
        'No heavy leg day right before sparring.',
        '7–10 days out: cut volume, keep intensity.',
      ],
    },
    season: {
      off: {
        vi: '2–3 buổi/tuần: xây sức mạnh nền + công suất. Thể lực chủ yếu do tập võ lo.',
        en: '2–3 sessions a week: build base strength and power. Boxing practice covers most conditioning.',
      },
      pre: {
        vi: '6–8 tuần trước trận: 2 buổi/tuần, chuyển dần sang công suất + thể lực theo hiệp; tạ nặng giữ, bớt set.',
        en: '6–8 weeks out: 2 sessions a week, shift toward power and round-based conditioning; keep heavy loads, fewer sets.',
      },
      in: {
        vi: '1–2 buổi ngắn để GIỮ. 7–10 ngày trước trận giảm khối lượng, giữ cường độ.',
        en: '1–2 short sessions to MAINTAIN. 7–10 days out cut volume, keep intensity.',
      },
    },
  },
  running: {
    vi: 'Chạy bộ',
    en: 'Running',
    sum: {
      vi: 'Mỗi bước chạy đè lên một chân lực khoảng 2–3 lần cân nặng; riêng cơ dép (soleus) có thể tới 6–8 lần khi chạy nhanh. Tập tạ nặng + plyo giúp chạy "kinh tế" hơn (tốn ít năng lượng hơn ở cùng tốc độ) và giảm chấn thương do quá tải — không làm chậm đi.',
      en: 'Every stride loads one leg with about 2–3× body weight; the soleus alone can reach 6–8× at faster paces. Heavy lifting + plyometrics make running more economical (less energy at the same pace) and cut overuse injuries — without slowing you down.',
    },
    demands: {
      vi: [
        'Nền aerobic — phần lớn do chính việc chạy lo',
        'Bắp chân và gân Achilles chịu lực lặp lại rất lớn',
        'Ổn định trên MỘT chân: hông giữ khung chậu, gối không đổ vào trong',
        'Độ "nảy" (độ cứng gân): tiếp đất ngắn, trả lực tốt',
        'Thân giữ thẳng khi mỏi về cuối',
      ],
      en: [
        'Aerobic base — mostly built by running itself',
        'Calves and Achilles take huge repeated loads',
        'Single-leg stability: hips hold the pelvis level, knee does not cave in',
        'Springiness (tendon stiffness): short ground contact, good energy return',
        'A trunk that holds posture when tired',
      ],
    },
    key: {
      soleus: {
        vi: 'Cơ chịu lực lớn nhất khi chạy — đẩy người tiến lên ở mỗi bước. Tập bằng calf raise GỐI GẬP.',
        en: 'The highest-loaded muscle in running — propels you forward each step. Train with BENT-knee calf raises.',
      },
      gastroc: {
        vi: 'Cùng cơ dép tạo lực đẩy; quan trọng hơn khi chạy nhanh và lên dốc.',
        en: 'Works with the soleus on push-off; matters more for speed and hills.',
      },
      'glute-max': {
        vi: 'Duỗi hông đẩy người về trước; chạy nhanh và lên dốc dùng rất nhiều.',
        en: 'Extends the hip to drive you forward; heavily used in sprints and hills.',
      },
      'glute-med': {
        vi: 'Giữ khung chậu thẳng khi đứng một chân — yếu thì hông xệ, gối đổ vào trong.',
        en: 'Keeps the pelvis level on one leg — weak means a dropping hip and caving knee.',
      },
      quads: {
        vi: 'Đỡ lực lúc tiếp đất, giữ gối; chạy xuống dốc làm việc nặng nhất.',
        en: 'Absorbs landing and controls the knee; downhills work it hardest.',
      },
      hams: {
        vi: 'Phanh cẳng chân cuối pha vung; hay căng / rách khi tăng tốc.',
        en: 'Brakes the lower leg at the end of the swing; the classic strain when speeding up.',
      },
      'hip-flex': {
        vi: 'Kéo đùi ra trước mỗi bước; quan trọng cho sải và tần số bước.',
        en: 'Pulls the thigh through each stride; matters for stride and cadence.',
      },
    },
    k2: ['tibialis', 'adductors', 'abs', 'obliques', 'erectors', 'ql', 'lats', 'delt-r'],
    risk: {
      vi: [
        'Đau quanh xương bánh chè (runner\'s knee)',
        'Gân Achilles, cân gan chân',
        'Đau mặt trong cẳng chân (shin splints), gãy xương do mỏi',
        'Dải chậu chày (đau mặt ngoài gối)',
        'Căng cơ đùi sau khi chạy nhanh',
      ],
      en: [
        'Pain around the kneecap (runner\'s knee)',
        'Achilles tendon, plantar fascia',
        'Shin splints, bone stress injuries',
        'IT band (outer knee pain)',
        'Hamstring strains at speed',
      ],
    },
    blocks: [
      {
        id: 'strength',
        vi: 'Sức mạnh nặng',
        en: 'Heavy strength',
        tag: 'strength',
        need: true,
        why: {
          vi: 'Tạ nặng (~80–85% 1RM), ít rep, không tới thất bại — tăng lực mà gần như không thêm cân. Đây là phần cải thiện "kinh tế chạy" rõ nhất.',
          en: 'Heavy (~80–85% 1RM), low reps, not to failure — more force with almost no added body weight. The clearest boost to running economy.',
        },
        ex: [
          ['Back Squat', '3–4×4–6', 'High Bar Squat (Barbell)'],
          ['Trap Bar Deadlift', '3×4–6', 'Deadlift (Trap Bar)'],
          ['Bulgarian Split Squat', '3×6/bên', 'Bulgarian Split Squat'],
          ['Romanian Deadlift', '3×6–8', 'Romanian Deadlift'],
          ['Hip Thrust', '3×6–8', 'Hip Thrust (Barbell)'],
        ],
      },
      {
        id: 'calves',
        vi: 'Bắp chân & gân Achilles',
        en: 'Calves & Achilles',
        tag: 'accessories',
        need: true,
        why: {
          vi: 'Đa số người chạy tập bắp chân quá nhẹ. Tập nặng, cả gối thẳng (bắp chân) và gối gập (cơ dép).',
          en: 'Most runners train calves far too light. Go heavy, both straight-knee (gastrocnemius) and bent-knee (soleus).',
        },
        ex: [
          ['Seated Calf Raise', '3×10–15 nặng', 'Seated Calf Raise (Machine)'],
          ['Standing Calf Raise', '3×10–15', 'Standing Calf Raise (Machine)'],
          ['Single-Leg Eccentric Heel Drop', '3×12/bên', 'Eccentric Heel Drop (Bodyweight)'],
          ['Tibialis Raise', '2×15', 'Tibialis Raise (Bodyweight)'],
        ],
      },
      {
        id: 'plyo',
        vi: 'Plyometric — độ nảy',
        en: 'Plyometrics — springiness',
        tag: 'strength',
        plyo: true,
        why: {
          vi: 'Tiếp đất ngắn, nảy lên ngay. Ít tiếp đất mỗi buổi, làm sau khởi động khi chân còn tươi; người mới bắt đầu bằng pogo nhẹ.',
          en: 'Short contacts, bounce straight back up. Few contacts per session, right after the warm-up while fresh; beginners start with light pogos.',
        },
        ex: [
          ['Pogo Jumps', '3×15–20', 'Pogo Jump (Bodyweight)'],
          ['Bounding', '3×20 m', 'Bounding (Bodyweight)'],
          ['Single-Leg Hop', '3×6/bên', 'Single Leg Hop (Bodyweight)'],
          ['Box Jump', '3×4', 'Box Jump'],
        ],
      },
      {
        id: 'hips',
        vi: 'Hông & ổn định một chân',
        en: 'Hips & single-leg control',
        tag: 'accessories',
        need: true,
        why: {
          vi: 'Giữ khung chậu thẳng và gối thẳng hàng mũi chân — nhắm thẳng vào đau gối và dải chậu chày.',
          en: 'Keeps the pelvis level and knee over toes — aimed squarely at knee and IT band pain.',
        },
        ex: [
          ['Single-Leg Romanian Deadlift', '3×8/bên', 'Single Leg Deadlift (Kettlebell)'],
          ['Step-Down', '3×8/bên', 'Step Down (Bodyweight)'],
          ['Banded Lateral Walk', '2×15 bước/bên', 'Lateral Band Walk (Band)'],
          ['Copenhagen Plank', '2×20 giây/bên', 'Copenhagen Plank (Bodyweight)'],
        ],
      },
      {
        id: 'core',
        vi: 'Core',
        en: 'Core',
        tag: 'accessories',
        why: {
          vi: 'Giữ thân thẳng về cuối cự ly, khi mỏi hay gập người và sải ngắn lại.',
          en: 'Holds posture late in the run, when fatigue folds you over and shortens the stride.',
        },
        ex: [
          ['Dead Bug', '3×8/bên', 'Dead Bug (Bodyweight)'],
          ['Side Plank', '3×30 giây/bên', 'Side Plank (Bodyweight)'],
          ['Pallof Press', '3×10/bên', 'Pallof Press (Cable)'],
          ['Back Extension', '3×10', 'Back Extension'],
        ],
      },
    ],
    plan: {
      vi: [
        'Giai đoạn nền: 2 buổi/tuần. Gần giải: 1 buổi/tuần để giữ, ngưng 10–14 ngày trước race.',
        'Tập tạ CÙNG ngày với buổi chạy nặng (cách ≥ 6 giờ) để ngày nhẹ được nhẹ thật.',
        'Không tập chân nặng hôm trước long run hoặc buổi interval.',
        '5–10K cần nhiều plyo / tốc độ hơn; half / marathon nặng về bắp chân và độ bền cơ; trail thêm step-down, xuống dốc, cổ chân.',
      ],
      en: [
        'Base phase: 2 sessions a week. Near a race: 1 a week to maintain, stop 10–14 days out.',
        'Lift on the SAME day as hard runs (≥ 6 h apart) so easy days stay easy.',
        'No heavy legs the day before a long run or interval session.',
        '5–10K wants more plyo / speed; half / marathon leans on calves and muscular endurance; trail adds step-downs, downhill and ankle work.',
      ],
    },
    season: {
      off: {
        vi: '2 buổi/tuần, tạ nặng + bắp chân + plyo nhẹ.',
        en: '2 sessions a week, heavy lifting + calves + light plyo.',
      },
      pre: {
        vi: 'Tăng cự ly / tốc độ: 1–2 buổi/tuần, giữ tạ nặng ít set, plyo ngắn.',
        en: 'Building mileage / speed: 1–2 sessions a week, keep heavy loads with few sets, short plyo.',
      },
      in: {
        vi: '1 buổi/tuần để giữ; ngưng 10–14 ngày trước race chính.',
        en: '1 session a week to maintain; stop 10–14 days before the A race.',
      },
    },
  },
  basketball: {
    vi: 'Bóng rổ',
    en: 'Basketball',
    sum: {
      vi: 'Bóng rổ là chuỗi nỗ lực ngắn lặp lại: bật nhảy, tiếp đất, tăng tốc, phanh gấp, đổi hướng — hàng trăm lần mỗi trận. Bổ trợ nhắm vào sức bật, khả năng TIẾP ĐẤT và PHANH an toàn (nơi phần lớn chấn thương gối – cổ chân xảy ra), và thể lực chạy – nghỉ ngắt quãng.',
      en: 'Basketball is short efforts on repeat: jump, land, accelerate, brake, change direction — hundreds of times a game. S&C targets jump power, safe LANDING and BRAKING (where most knee and ankle injuries happen), and stop-start conditioning.',
    },
    demands: {
      vi: [
        'Sức bật: nhảy hai chân (rebound, block) và một chân (lên rổ)',
        'Giảm tốc & đổi hướng: phanh từ chạy nhanh, trượt ngang phòng thủ',
        'Tiếp đất vững: gối thẳng hàng mũi chân, không đổ vào trong',
        'Thể lực ngắt quãng: bứt tốc vài giây, nghỉ ngắn, lặp lại cả trận',
        'Thân vững khi va chạm, giữ thăng bằng để ném',
      ],
      en: [
        'Jump power: two-foot (rebounds, blocks) and one-foot (layups)',
        'Deceleration & change of direction: braking from a sprint, defensive slides',
        'Solid landings: knee tracks over the toes, no caving in',
        'Intermittent conditioning: seconds-long bursts, short rests, all game',
        'A stable trunk through contact, balance to shoot',
      ],
    },
    key: {
      quads: {
        vi: 'Phanh khi tiếp đất và đổi hướng, bật nhảy — chịu tải nhiều nhất ở gối.',
        en: 'Brakes landings and cuts, drives the jump — takes the most load at the knee.',
      },
      'glute-max': {
        vi: 'Duỗi hông khi bật nhảy và tăng tốc; giữ gối không đổ vào trong khi tiếp đất.',
        en: 'Extends the hip to jump and accelerate; keeps the knee from caving on landing.',
      },
      'glute-med': {
        vi: 'Giữ khung chậu và gối thẳng hàng khi đứng một chân, đổi hướng — liên quan trực tiếp tới rách dây chằng chéo trước (ACL).',
        en: 'Holds pelvis and knee aligned on one leg and when cutting — directly linked to ACL tears.',
      },
      hams: {
        vi: 'Kéo cẳng chân ra sau, "đỡ" dây chằng chéo trước khi tiếp đất; hay căng khi bứt tốc.',
        en: 'Pulls the shin back and protects the ACL on landing; commonly strained in sprints.',
      },
      gastroc: { vi: 'Bật nhảy từ mũi chân, bước chân nhanh.', en: 'Jumps off the forefoot, quick feet.' },
      soleus: {
        vi: 'Hấp thụ lực tiếp đất, giữ cổ chân vững — cổ chân yếu dễ lật.',
        en: 'Absorbs landing forces and steadies the ankle — weak ankles roll.',
      },
      adductors: {
        vi: 'Trượt ngang và đổi hướng; hay căng háng khi đẩy sang bên.',
        en: 'Lateral slides and cuts; groin strains on hard side pushes.',
      },
    },
    k2: ['tibialis', 'hip-flex', 'abs', 'obliques', 'erectors', 'lats', 'delt-f', 'rotator', 'triceps', 'forearm-flex', 'chest-upper'],
    risk: {
      vi: [
        'Lật cổ chân — chấn thương hay gặp nhất',
        'Đau gân bánh chè (jumper\'s knee) do nhảy lặp lại',
        'Rách dây chằng chéo trước (ACL) khi tiếp đất / đổi hướng sai — nữ có nguy cơ cao hơn',
        'Kẹt / bong gân ngón tay',
        'Căng háng, căng đùi sau; đau lưng dưới',
      ],
      en: [
        'Ankle sprains — the most common injury',
        'Patellar tendon pain (jumper\'s knee) from repeated jumping',
        'ACL tears on poor landings / cuts — higher risk in women',
        'Jammed / sprained fingers',
        'Groin and hamstring strains; low back pain',
      ],
    },
    blocks: [
      {
        id: 'strength',
        vi: 'Sức mạnh nền',
        en: 'Base strength',
        tag: 'strength',
        need: true,
        why: {
          vi: 'Chân khoẻ thì nhảy cao hơn và tiếp đất, phanh an toàn hơn. Tạ nặng, ít rep, không tới thất bại.',
          en: 'Stronger legs jump higher and land and brake more safely. Heavy, low reps, not to failure.',
        },
        ex: [
          ['Trap Bar Deadlift', '3–4×3–5', 'Deadlift (Trap Bar)'],
          ['Front Squat', '3–4×3–5', 'Front Squat (Barbell)'],
          ['Bulgarian Split Squat', '3×6/bên', 'Bulgarian Split Squat'],
          ['Nordic Hamstring Curl', '3×4–6', 'Nordic Curl (Bodyweight)'],
          ['Pull-Up', '3×5–8', 'Pull-up'],
        ],
      },
      {
        id: 'landing',
        vi: 'Bật nhảy & tiếp đất',
        en: 'Jumping & landing',
        tag: 'strength',
        need: true,
        plyo: true,
        why: {
          vi: 'HỌC TIẾP ĐẤT trước khi nhảy cao: đáp êm, gối thẳng hàng mũi chân, giữ 2 giây. Ít lần, chất lượng; đầu buổi khi còn tươi. Mùa giải đã nhảy nhiều khi tập đội — giảm phần này.',
          en: 'LEARN TO LAND before jumping high: soft, knee over toes, hold 2 s. Few reps, high quality, first while fresh. In season, practice already has lots of jumps — cut this back.',
        },
        ex: [
          ['Drop Landing', '3×5', 'Drop Landing (Bodyweight)'],
          ['Countermovement Jump', '3×5', 'Countermovement Jump (Bodyweight)'],
          ['Box Jump', '3×4', 'Box Jump'],
          ['Single-Leg Hop and Stick', '3×4/bên', 'Single Leg Hop and Stick (Bodyweight)'],
          ['Lateral Bound', '3×5/bên', 'Lateral Bound (Bodyweight)'],
        ],
      },
      {
        id: 'decel',
        vi: 'Giảm tốc & đổi hướng',
        en: 'Deceleration & change of direction',
        tag: 'accessories',
        need: true,
        why: {
          vi: 'Phần lớn chấn thương gối xảy ra lúc PHANH và xoay người, không phải lúc chạy. Tập dừng gấp có kiểm soát: hạ thấp người, bước ngắn dần.',
          en: 'Most knee injuries happen when BRAKING and turning, not while running. Practise controlled hard stops: get low, shorten the steps.',
        },
        ex: [
          ['Sprint rồi dừng gấp', '6×10–15 m', 'Sprint to Stop (Bodyweight)'],
          ['5-10-5 Pro Agility', '4–6×', 'Pro Agility Shuttle (Bodyweight)'],
          ['Lateral Lunge', '3×6/bên', 'Side Lunge (Dumbbell)'],
          ['Copenhagen Plank', '2×20 giây/bên', 'Copenhagen Plank (Bodyweight)'],
        ],
      },
      {
        id: 'prehab',
        vi: 'Cổ chân & gối — phòng chấn thương',
        en: 'Ankle & knee — injury prevention',
        tag: 'accessories',
        need: true,
        why: {
          vi: 'Thăng bằng một chân + bắp chân khoẻ giảm rõ số lần lật cổ chân; giữ gân bánh chè chịu tải tốt. Nhẹ, làm đều mỗi buổi.',
          en: 'Single-leg balance plus strong calves clearly cut ankle sprains; loaded tendon work keeps the patellar tendon resilient. Light, every session.',
        },
        ex: [
          ['Đứng một chân trên đệm', '3×30 giây/bên', 'Single Leg Balance (Balance Pad)'],
          ['Seated Calf Raise', '3×12–15', 'Seated Calf Raise (Machine)'],
          ['Spanish Squat', '3×30–45 giây', 'Spanish Squat (Band)'],
          ['Single-Leg Romanian Deadlift', '3×8/bên', 'Single Leg Deadlift (Kettlebell)'],
          ['Tibialis Raise', '2×15', 'Tibialis Raise (Bodyweight)'],
        ],
      },
      {
        id: 'core',
        vi: 'Core & thân trên',
        en: 'Core & upper body',
        tag: 'accessories',
        why: {
          vi: 'Thân vững khi va chạm dưới rổ; vai khoẻ cân bằng cho ném và chuyền.',
          en: 'A stable trunk for contact under the rim; balanced shoulders for shooting and passing.',
        },
        ex: [
          ['Pallof Press', '3×10/bên', 'Pallof Press (Cable)'],
          ['Dead Bug', '3×8/bên', 'Dead Bug (Bodyweight)'],
          ['Side Plank', '3×30 giây/bên', 'Side Plank (Bodyweight)'],
          ['Push-Up', '3×8–12', 'Normal Push up (Bodyweight)'],
          ['Face Pull', '3×15', 'Face Pull'],
        ],
      },
      {
        id: 'cond',
        vi: 'Thể lực theo trận',
        en: 'Game conditioning',
        tag: 'circuit',
        why: {
          vi: 'Trận đấu là bứt tốc ngắn – nghỉ ngắn. Tập đúng nhịp đó thay cho chạy dài đều.',
          en: 'Games are short bursts, short rests. Train that rhythm instead of long steady runs.',
        },
        ex: [
          ['Chạy con thoi hết sân', '8–10 × 15 giây, nghỉ 30–45 giây'],
          ['Sprint ngắn', '8–10 × 10–15 giây, nghỉ 45 giây', 'Sprint (Bodyweight)'],
          ['Trượt ngang phòng thủ', '6 × 15 giây, nghỉ 30 giây'],
        ],
      },
    ],
    plan: {
      vi: [
        'Ngoài mùa giải: 3 buổi S&C/tuần, xây sức mạnh và sức bật. Trong mùa: 1–2 buổi ngắn, giữ tạ nặng nhưng bớt set, gần như bỏ plyo thêm.',
        'Trong buổi: tiếp đất / bật nhảy → sức mạnh → phòng chấn thương. Thể lực cuối buổi hoặc ngày riêng.',
        'Không tập chân nặng trong 48 giờ trước trận.',
      ],
      en: [
        'Off-season: 3 S&C sessions a week to build strength and jump. In season: 1–2 short sessions, keep loads heavy but cut sets, little extra plyo.',
        'Within a session: landing / jumps → strength → prehab. Conditioning last or on its own day.',
        'No heavy legs within 48 h of a game.',
      ],
    },
    season: {
      off: {
        vi: '3 buổi/tuần, xây sức mạnh + sức bật + kỹ thuật tiếp đất.',
        en: '3 sessions a week to build strength, jump and landing skill.',
      },
      pre: {
        vi: '2–3 buổi/tuần, thêm giảm tốc / đổi hướng và thể lực theo trận.',
        en: '2–3 sessions a week, add deceleration / change of direction and game conditioning.',
      },
      in: {
        vi: '1–2 buổi ngắn, giữ tạ nặng ít set, gần như bỏ plyo thêm (tập đội đã nhảy nhiều). Không chân nặng trong 48 giờ trước trận.',
        en: '1–2 short sessions, heavy loads with few sets, little extra plyo (team practice has plenty). No heavy legs within 48 h of a game.',
      },
    },
  },
};

const SPORT_ORDER = ["boxing", "running", "basketball"];
const SPORT_PHASES = {
  off: { vi: "Ngoài mùa", en: "Off-season" },
  pre: { vi: "Trước giải", en: "Pre-season" },
  in: { vi: "Trong mùa", en: "In season" },
};
/** Tên nhóm cơ (id của tab Anatomy) cho trợ lý — tab Anatomy có bộ đầy đủ ở AN_GROUPS. */
const GROUP_VI = {
  "glute-max": "mông lớn", "glute-med": "mông nhỡ", obliques: "cơ chéo bụng", serratus: "cơ răng trước", "delt-f": "vai trước",
  triceps: "tay sau", gastroc: "bắp chân (cơ bụng chân)", soleus: "cơ dép", neck: "cổ", quads: "đùi trước", hams: "đùi sau",
  adductors: "cơ khép đùi", "hip-flex": "cơ gập hông", abs: "cơ bụng thẳng", lats: "lưng xô", rotator: "chóp xoay & cơ tròn",
  "delt-r": "vai sau", traps: "cầu vai", "chest-lower": "ngực", "chest-upper": "ngực trên", "forearm-flex": "cẳng tay",
  tibialis: "cơ chày trước", erectors: "cơ dựng sống", ql: "cơ vuông thắt lưng",
};

/**
 * Bài bổ trợ chưa có trong thư viện — coach duyệt 2026-11-16, ghi bằng `node scripts/sports/add-library.js --write`.
 * Nhóm cơ chỉ dùng tên CHUẨN của thư viện (khớp hình cơ thể / volume). Cổ, cơ chày trước, cơ răng trước chưa có vùng
 * trên hình dashboard → gắn nhóm gần nhất có trên hình (ghi rõ ở `note`).
 */
const NEW_LIBRARY = [
  { name: "Shot Put Throw (Med Ball)", tool: "Med Ball", types: ["Power"], difficulty: "Intermediate", muscles: { Obliques: "P", Chest: "S", Triceps: "S", Glutes: "S" } },
  { name: "Plyometric Push Up (Bodyweight)", tool: "Bodyweight", types: ["Power"], difficulty: "Advanced", muscles: { Chest: "P", Triceps: "S", "Front Delts": "S" } },
  { name: "External Rotation (Cable)", tool: "Cable Machine", types: ["Stability"], difficulty: "Easy", muscles: { "Rotator Cuff": "P", "Rear Delts": "S" } },
  { name: "Push Up Plus (Bodyweight)", tool: "Bodyweight", types: ["Stability"], difficulty: "Easy", muscles: { Chest: "P", "Front Delts": "S" }, note: "cơ răng trước — chưa có vùng trên hình" },
  { name: "Neck Isometric Hold (Bodyweight)", tool: "Bodyweight", types: ["Stability"], difficulty: "Easy", muscles: { Traps: "P" }, note: "cơ cổ — chưa có vùng trên hình, gắn cầu vai" },
  { name: "Eccentric Heel Drop (Bodyweight)", tool: "Bodyweight", types: ["Strength", "Stability"], difficulty: "Easy", muscles: { Calves: "P" } },
  { name: "Tibialis Raise (Bodyweight)", tool: "Bodyweight", types: ["Stability"], difficulty: "Easy", muscles: { Calves: "S" }, note: "cơ chày trước — chưa có vùng trên hình" },
  { name: "Pogo Jump (Bodyweight)", tool: "Bodyweight", types: ["Power"], difficulty: "Easy", muscles: { Calves: "P" } },
  { name: "Bounding (Bodyweight)", tool: "Bodyweight", types: ["Power"], difficulty: "Intermediate", muscles: { Glutes: "P", Quads: "S", Hamstrings: "S", Calves: "S" } },
  { name: "Single Leg Hop (Bodyweight)", tool: "Bodyweight", types: ["Power"], difficulty: "Intermediate", muscles: { Calves: "P", Quads: "S", Glutes: "S" } },
  { name: "Step Down (Bodyweight)", tool: "Box", types: ["Stability"], difficulty: "Easy", muscles: { Quads: "P", Glutes: "S" } },
  { name: "Lateral Band Walk (Band)", tool: "Resistance Band", types: ["Stability"], difficulty: "Easy", muscles: { Glutes: "P" } },
  { name: "Copenhagen Plank (Bodyweight)", tool: "Bodyweight", types: ["Stability"], difficulty: "Intermediate", muscles: { Adductors: "P", Obliques: "S" } },
  { name: "Drop Landing (Bodyweight)", tool: "Box", types: ["Stability", "Power"], difficulty: "Easy", muscles: { Quads: "P", Glutes: "S" } },
  { name: "Countermovement Jump (Bodyweight)", tool: "Bodyweight", types: ["Power"], difficulty: "Easy", muscles: { Quads: "P", Glutes: "P", Calves: "S" } },
  { name: "Single Leg Hop and Stick (Bodyweight)", tool: "Bodyweight", types: ["Power", "Stability"], difficulty: "Intermediate", muscles: { Quads: "P", Glutes: "S", Calves: "S" } },
  { name: "Lateral Bound (Bodyweight)", tool: "Bodyweight", types: ["Power"], difficulty: "Intermediate", muscles: { Glutes: "P", Adductors: "S", Quads: "S" } },
  { name: "Sprint to Stop (Bodyweight)", tool: "Bodyweight", types: ["Power"], difficulty: "Intermediate", muscles: { Quads: "P", Glutes: "S", Hamstrings: "S" } },
  { name: "Pro Agility Shuttle (Bodyweight)", tool: "Bodyweight", types: ["Cardio", "Power"], difficulty: "Intermediate", muscles: { Quads: "P", Adductors: "S", Glutes: "S" } },
  { name: "Single Leg Balance (Balance Pad)", tool: "Balance Pad", types: ["Stability"], difficulty: "Easy", muscles: { Calves: "S", Glutes: "S" } },
];

const fold = (s) => String(s || "").toLowerCase().normalize("NFC").trim();

/** Khách → { id, phase } hoặc null. Trường `sport` trên doc khách: { id: 'boxing', phase: 'off'|'pre'|'in' }. */
function clientSport(cd) {
  const s = cd && cd.sport;
  if (!s || !SPORTS[s.id]) return null;
  return { id: s.id, phase: SPORT_PHASES[s.phase] ? s.phase : "off" };
}

/** Khung cho trợ lý: tiếng Việt, tên bài ĐÚNG Y thư viện, khối nào bắt buộc. */
function sportGuide(id, phase) {
  const S = SPORTS[id];
  if (!S) return { error: `Không có môn '${id}'. Có: ${SPORT_ORDER.join(", ")}.` };
  const ph = SPORT_PHASES[phase] ? phase : "off";
  return {
    sport: id, name: S.vi, phase: ph, phaseName: SPORT_PHASES[ph].vi,
    summary: S.sum.vi,
    demands: S.demands.vi,
    injuryRisks: S.risk.vi,
    keyMuscles: Object.entries(S.key).map(([g, r]) => ({ group: GROUP_VI[g] || g, role: r.vi })),
    supportMuscles: S.k2.map((g) => GROUP_VI[g] || g),
    blocks: S.blocks.map((b) => ({
      id: b.id, name: b.vi, phaseTag: b.tag, required: b.need === true, plyometric: b.plyo === true, why: b.why.vi,
      exercises: b.ex.map(([n, d, lib]) => (lib ? { name: lib, dose: d } : { name: n, dose: d, outsideLibrary: true })),
    })),
    seasonNow: S.season[ph].vi,
    seasons: Object.fromEntries(Object.keys(SPORT_PHASES).map((k) => [SPORT_PHASES[k].vi, S.season[k].vi])),
    scheduling: S.plan.vi,
  };
}

/**
 * Giáo án (cả tuần, tên bài đã về đúng thư viện) thiếu khối bắt buộc của môn → lỗi. Ngoại lệ có chủ ý:
 * coverageExceptions['sport:<id khối>'] = lý do (chấn thương, coach muốn bỏ) — hiện trên thẻ duyệt.
 */
function sportIssues(program, sport, exceptions) {
  const S = sport && SPORTS[sport.id];
  if (!S) return { errors: [], waived: [], hits: {} };
  const names = new Set();
  for (const d of Object.values(program || {})) {
    for (const ph of (d && d.phases) || []) for (const x of (ph && ph.exercises) || []) names.add(fold(x && x.name));
  }
  const ex = exceptions && typeof exceptions === "object" ? exceptions : {};
  const errors = [], waived = [], hits = {};
  for (const b of S.blocks) {
    const opts = b.ex.map(([n, , lib]) => lib || n);
    hits[b.id] = opts.filter((n) => names.has(fold(n)));
    if (!b.need || hits[b.id].length) continue;
    const why = String(ex["sport:" + b.id] || "").trim();
    if (why) { waived.push(`${S.vi} · ${b.vi}: ${why}`); continue; }
    errors.push({ k: "sport:" + b.id, m: `${S.vi}: cả tuần chưa có bài nào của khối "${b.vi}" [sport:${b.id}]. Thêm ít nhất một bài: `
      + opts.slice(0, 5).join(", ") + `. Coach chủ ý bỏ thì ghi coverageExceptions["sport:${b.id}"] = lý do.` });
  }
  return { errors, waived, hits };
}

module.exports = { SPORTS, SPORT_ORDER, SPORT_PHASES, GROUP_VI, NEW_LIBRARY, clientSport, sportGuide, sportIssues };
