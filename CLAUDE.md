
## Current clients (verified against Firestore 2026-10-04 — 19 clients, 11 tự đăng nhập)

### Self-login clients — each has their own Gmail
| Name | Client ID | Gmail | Level | Sessions/wk | Days | Goal |
|------|-----------|-------|-------|-------------|------|------|
| Chị Nguyệt | chị_nguyệt_1776562700235 | nguyet.cm83@gmail.com | Intermediate | 3 | 4 | Strength + Fatloss + Boxing |
| Cindy | cindy | dollykim1401@gmail.com | Intermediate | 3 | 3 | Strength & Fat Loss — Glutes/Back/Core |
| Giao | giao | hqunhgiao.18@gmail.com | Beginner | 2 | 2 | HYROX / Hybrid — nền aerobic + kỹ thuật trạm |
| Joost | joost | joost123@gmail.com | Beginner | 3 | 3 | Strength — tăng sức mạnh, full-body 3 buổi/tuần |
| Kem | kem | ndqminh1705@gmail.com | Beginner | 3 | 3 | Phát triển thể chất — sức mạnh, sức bật, nền thể lực |
| Lee | lee | kuanyu41@gmail.com | Intermediate | 3 | 2 | Strength & Hypertrophy — 2 block Anterior/Posterior, xoay A/B/A |
| Long Chu | longchu | coach@fitwithlongchu.com | Advanced | 3 | 3 | Strength & Hypertrophy |
| Nam | nam | namdoxuan0104@gmail.com | Intermediate | 3 | 3 | Tăng cơ giảm mỡ |
| Nguyên | nguyen | tbn010112@gmail.com | Beginner | 3 | 3 | Giảm mỡ + tăng hiệu suất thể thao |
| Sang | sang | thinhcst@gmail.com | Beginner | 3 | 3 | Fat Loss + Posture + Height |
| anh Soobin | soobin | sonnguyen109992@gmail.com | Intermediate | 3 | 3 | Tăng cơ giảm mỡ |

### Coach-managed — `email: ''` on purpose, cannot log in
| Name | Client ID | Level | Sessions/wk | Days | Goal |
|------|-----------|-------|-------------|------|------|
| An | an | Intermediate | 3 | 3 | Strength & Hypertrophy |
| Anh Đạo | dao | Beginner | 5 | 5 | Fat loss — giảm mỡ, cải thiện thể lực |
| Antony | antony | Beginner | 2 | 2 | Fat loss (15 tuổi — KHÔNG ép thâm hụt calo) |
| Chị Linh | linh | Beginner | 2 | 2 | Giảm mỡ + tăng size mông |
| Chị Tâm | tam | Beginner | 2 | 2 | Tăng cơ + strength — dân chạy 35km/tuần, ưu tiên chân |
| Rome | rome | Beginner | 2 | 2 | Tăng chiều cao, mật độ xương, hiệu suất thể thao |
| Thai Son | thaison | Advanced | 4 | 3 | Shoulder Rehab → Strength + Boxing |
| Trần Văn Tiến | tien | Beginner | 2 | 2 | Sức khỏe tổng quát, tăng cơ giảm mỡ tuổi 48 |

A coach-managed client carries `email: ''`, **never** a placeholder address. The
fitness-app skill still suggests `placeholder@gmail.com` when the address is unknown —
do not follow it. Two clients holding one address is the exact failure below, and a
shared placeholder reproduces it the moment a second client gets one.

Removed 2026-07-31: **Vy**, **Ngọc Anh**, **Chị Nhi**, **Ngân** (client docs + orphaned user accounts deleted).
Thai Son's email was cleared — `sonnguyen109992@gmail.com` belongs to Soobin. Thai Son needs his own
address before he can log in.

2026-10-04: **Kem** chuyển từ coach-managed sang tự đăng nhập (`ndqminh1705@gmail.com`). Đi đúng
hai bước: tạo `/clientEmails/ndqminh1705@gmail.com` → `{clientId:'kem'}` TRƯỚC, rồi mới ghi
`clients/kem.email`. Đã thử chiếm lại email đó cho khách khác và nhận `ALREADY_EXISTS` — chốt chặn
còn nguyên.

---

## ⚠️ One Gmail = one client — never break this

The whole auth model joins `users` → `clients` **by email**. The Firestore rule
`isClientOwner()` grants read+write to any client doc whose `email` matches the signed-in
account — so two clients sharing an email means each can read and write the other's data.
This actually happened (Soobin + Thai Son both held `sonnguyen109992@gmail.com`).

Enforcement now in place — do not remove any layer:

1. **`/clientEmails/{email}` index** (doc id = lowercased email, value `{ clientId }`).
   Rules `allow create` but `allow update: if false`, so claiming a taken address fails
   atomically at the DB layer — even for the coach. Changing a client's email = delete the
   old doc, create the new one.
2. **`claimClientEmail()` in index.html** — `addClient()` and `saveClientInfo()` must both call
   it *before* writing `clients.email`. Never write that field directly.
3. **Lookups read the index first.** If a legacy scan still finds >1 client on one email, the app
   now **stops and shows an error** rather than silently opening whichever matched last —
   that silent pick is what caused the original mix-up.
4. **users rules**: admin has full access (needed to delete orphans); a client may edit their own
   name/email but **cannot change their own `role` or `clientId`**.

Verified end-to-end on 2026-07-31: hijacking a taken email → `permission-denied`; claiming a
free one → allowed.

When deleting a client, remove **all** of: the `clients/{id}` doc, every subcollection
(`assessment`, `checkpoints`, `workoutHistory`, `nutrition`, `progressPhotos`, `videos`,
`sessionLoads`, `aiChat`, `messages`, `programBackups`), the `clientEmails/{email}` entry, and any `users` doc pointing at it.
Deleting a Firestore doc does *not* delete its subcollections — that is how the orphaned
records were created in the first place.

---

## Multi-coach — ai thấy khách nào (docs/plan-multi-coach.md)

- **Vai trò**: `coaches/{email viết thường}` `{ name, active, isAdmin, uid }`, CHỈ admin ghi
  (màn **Coach** trên thanh khách). `chuhailong1810199@gmail.com` là admin gốc, luôn là admin kể cả
  khi doc bị tắt — cùng địa chỉ ở `firestore.rules`, `storage.rules`, `functions/authz.js`, `index.html`.
  `users.role` **không còn** cấp quyền gì. Không có danh sách email coach cứng nào nữa.
- **Mỗi coach một cửa hàng riêng**: mỗi khách đúng một coach — `clients.coachUid`. Coach chỉ thấy và
  SỬA khách của mình. **Admin QUAN SÁT**: xem được mọi khách (trang **Admin**, nút "Quan sát", công tắc
  "Tất cả coach") nhưng **không sửa** giáo án/dữ liệu khách của coach khác — kể cả admin. Ngoại lệ duy
  nhất: admin chuyển khách giữa các coach (update chỉ đổi `coachUid`). Luật: `canManage` (sửa) vs
  `canView` (xem); functions: `assertCanManage` vs `assertCanView`.
- **Tự đăng ký ĐANG TẮT** (`SELF_SIGNUP = false` trong `claimMyClient`): chỉ Gmail coach đã gán mới vào
  được app; Gmail lạ thấy màn "Chưa có quyền truy cập".
- **Thư viện bài tập**: bài gốc (không `ownerUid`) chỉ admin sửa; bài riêng mang `ownerUid` — chỉ coach đó.
- **Truy vấn danh sách** `clients` / `bookings` PHẢI qua `clientsQuery()` / `bookingsQuery()`. Luật
  không lọc: coach truy vấn thiếu `where('coachUid','==',uid)` bị từ chối cả lần → màn hình trống.
  Ngoại lệ ghi `// clients-scan-ok:` (tests/clients-query.test.js quét).
- **Functions** bỏ qua rules → mọi `onCall` phải gọi `authz.*` (`requireCoach`, `requireAdmin`,
  `assertCanManage`, `assertCanAccess`, `requireMember`). Trợ lý AI: `runTool(name, args, role)` lọc theo coach.
- **Tiền (tạm gác)**: tài khoản ngân hàng + bảng giá vẫn là MỘT bộ của admin, nên tab Billing chỉ hiện
  cho khách có `coachUid == settings/platform.adminUid` (`billingOn()`). Mở cho coach khác = khách của họ
  chuyển tiền vào tài khoản admin. Muốn bật: mỗi coach cần bộ settings riêng trước.
- **Storage**: `videos/{clientId}/**`, `progressPhotos/{clientId}/**` — admin, coach của khách, chính khách.
  Mọi đường dẫn khác bị chặn.
- **Test luật**: `./run-tests.sh` chạy `tests/rules/*` trên Firebase Emulator (cần Java + firebase-tools).
  Đổi luật mà không thêm ca vào ma trận ở `tests/rules/firestore.rules.test.js` là thiếu.

---

## Program key format — ALWAYS use SessionA/B/C (never Mon/Wed/Fri)
- Program days MUST be stored as `SessionA`, `SessionB`, `SessionC`, `SessionD`, `SessionE`...
- Old format `Mon/Tue/Wed/Thu/Fri` → app hangs on loading screen (can't find any days)
- When pushing a new program, always use Session keys
- Migration query to fix old clients:
```javascript
const DAY_ORDER = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const oldKeys = Object.keys(prog).filter(k => DAY_ORDER.includes(k))
  .sort((a,b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));
const newProg = {};
oldKeys.forEach((day, i) => { newProg[`Session${String.fromCharCode(65+i)}`] = prog[day]; });
await updateDoc(ref, { program: newProg });
```

---

## Firebase Modular SDK gotchas (v9+)
- `snap.exists` is a **property** (boolean), NOT a method — never write `snap.exists()`
- `snap.exists()` → `TypeError: snap.exists is not a function` → login crashes
- Correct: `if (!snap.exists) { ... }`

---

## Màn chờ không được im lặng (2026-11-15)
Script ES5 đầu `<head>` (trước Firebase) ghi lỗi `error` / `unhandledrejection`; màn chờ còn sau 15 giây hoặc
`window._bootFail(err)` được gọi → hộp "App tải lâu bất thường" (bước `window._bootStage` + lỗi + nút Tải lại /
Xoá bộ nhớ tạm — chỉ `pulse_user_v2_*`, `pulse_prog_*`, KHÔNG đăng xuất). Nhánh coach của `_launchAfterProfile`
giờ `.catch → _bootFail` (trước đây lỗi coach = đứng mãi ở logo). Kẹt trên máy khách / coach → xin ảnh chụp hộp đó.
`tests/boot-watchdog.test.js`.

---

## Đăng nhập từ Zalo / app đã cài (2026-11-17)
Coach Vy không vào được: KHÔNG có tài khoản Firebase Auth nào mang Gmail của Vy → kẹt ở bước Google, trước phần quyền
coach (đăng nhập Google thành công thì dù sai Gmail Auth vẫn có tài khoản). Google chặn đăng nhập trong webview nhúng
("403 disallowed_useragent") — bản cũ chỉ nhận Facebook/Instagram, bỏ sót **Zalo**. Giờ `inAppBrowserName()` (Zalo,
Messenger, Facebook, Instagram, TikTok, LINE, KakaoTalk, WebView Android) → màn đăng nhập hiện hộp `#inapp-banner` (Android:
nút "Mở bằng Chrome" = intent://; iPhone: hướng dẫn ⋯ → Mở bằng Safari; nút chép link), không mời cài app trong webview.
**Nguyên nhân chính (tìm ra sau):** 4 nút "Sign In" ở `landing.html` trỏ tên miền cũ `fitness-app-azure-eight.vercel.app` →
Vercel chuyển về `fitwithlongchu.vercel.app/` = lại TRANG CHỦ, không bao giờ vào app (và tên miền lạ thì authDomain rơi về
firebaseapp.com). Giờ mọi nút vào app = `/index.html` tương đối; `tests/auth-domain.test.js` cấm link *.vercel.app ở trang chủ.
App đã cài trên iPhone (standalone) + tên miền trong `AUTH_HOSTS` → `signInWithRedirect` (popup không báo về app);
popup bị chặn → lùi về redirect. Kiểm nhanh ai chưa từng đăng nhập: `getAuth().getUserByEmail(email)` (Admin SDK).
`tests/inapp-login.test.js`.

## Coach mới — màn trống chỉ đường (2026-11-17)
Coach Vy vào được nhưng 0 khách → màn "Bam + Add" (không dấu); thêm khách xong tab Workout ghi "Rest day" → không biết đưa
giáo án vào đâu. Giờ: 0 khách → `coachStartHTML()` (+ Thêm khách / Nhờ Pulse tạo khách + giáo án); khách chưa có buổi
`SessionX` nào → `emptyProgramHTML()` (⚡ Pulse soạn = `launchPulse` / Tự soạn = `startBlankProgram` tạo Buổi A + bật sửa;
khách thấy "Coach chưa đưa giáo án lên"). KHÔNG dẫn coach sang `migrate.html` — trang cũ ghi `clients.email` thẳng (bỏ qua
`claimClientEmail`), id khách theo tên, đăng nhập qua firebaseapp.com. `tests/coach-start.test.js`.

## Nhập giáo án cũ từ Excel (2026-11-17)
Nút **⇪ Excel** (thanh Edit program, chỉ coach) + lựa chọn trên màn "chưa có giáo án". SheetJS 0.18.5 (cdnjs, tải lười) đọc
file TRÊN MÁY (≤ 5 MB, ≤ 12 sheet × 300 dòng) → gửi các ô chữ → callable `importProgramSheet` (Gemini `callGemini` +
`IMPORT_SCHEMA`, `functions/program-import.js`; `assertCanManage`; KHÔNG ghi) → khuôn SessionA… + `resolveProgram`
không nghiêm (khớp thì đổi tên thư viện + gắn cơ, bài lạ vẫn nhập nhưng tô vàng) → xem trước → `coachApply` apply_program
(kiểm giáo án, sao lưu `programBackups`, chuyển tạ theo tên). "Thêm buổi mới" = đánh số tiếp sau buổi cũ, merge.
Định dạng file tuỳ ý — model CHÉP, không sáng tác; tuần lặp lại chỉ lấy tuần đầu (ghi notes). Thay cho `migrate.html`
(công cụ cũ, không an toàn cho coach). Tốn 1 lượt Gemini mỗi file. `tests/program-import.test.js`.

## Performance: user profile cache
- `loadUserProfile` now caches `{role, clientId}` in localStorage under key `pulse_user_v2_{uid}`
- Returning users skip Firestore read → near-instant app load
- Background verify runs async via `_verifyUserProfileBg()`
- If login loops or role is wrong → clear cache: `localStorage.removeItem('pulse_user_v2_' + uid)`

---

## Performance: parallel Firestore reads in loadApp()
```javascript
// CORRECT — parallel
await Promise.all([hydrateExerciseLoadsForActiveDay(), loadStrengthHistory()]);
renderExercises();
renderStats(); // non-blocking

// WRONG — sequential (slow)
await hydrateExerciseLoadsForActiveDay();
await loadStrengthHistory();
await renderStats();
```
- `_historyCache` object caches workoutHistory so `renderStats` reuses it without extra query
- **Lịch sử sức mạnh chạy NỀN** (2026-11-15): `loadStrengthHistory` cần 2 lượt mạng nối tiếp → KHÔNG được chặn mở app
  (`loadApp`), đổi khách (`switchClient`) hay đổi buổi (`setDay`). Gọi `strengthInBackground()` TRƯỚC `renderExercises()`
  (nó xoá chỉ mục cũ ngay, tránh huy hiệu của khách/buổi cũ hiện trên bài trùng tên); xong thì tự vẽ lại bài + Stats.
  `loadStrengthHistory` dựng vào biến riêng, chỉ ghi biến chung khi khách + buổi chưa đổi (trả false nếu đã đổi).
  Tạ (`hydrate…`) + cân nặng (`loadClientBodyweight`) chạy SONG SONG và vẫn chặn — bài trọng lượng cơ thể cần cân nặng.
  Đo trên máy tính: đổi khách ~800 ms → ~340 ms.
- Clear cache on client switch: `_historyCache = null`

## Kg gợi ý tuần tới (2026-11-16)
Chip "Gợi ý 102,5kg × 5" trên bài pha **strength** (tab Workout, coach + khách). `kgSuggestCore()` (khối
`// ── KG GỢI Ý` trong index.html) — công thức lấy ý tưởng từ streprogen (GPL-3.0: chỉ dùng CÔNG THỨC, KHÔNG chép
code): %1RM = 97,5 − 3,5(r−1) + 0,05(r−1)² để đổi tạ giữa các mức rep; sóng 3 tuần +2,5% / tuần 4 ×0,9 (tuần nhẹ
nhận ra khi e1RM tụt ≥ 7%, xong tuần nhẹ quay về đỉnh cũ rồi tăng); nghỉ > 14 ngày ×0,95; tập lần 2 trong tuần giữ
mức; buổi hôm nay không tính. Nấc tròn: tạ đơn / KB 1 kg, còn lại 2,5 kg; làm tròn ra số cũ thì nhích 1 nấc.
Bỏ qua: bài BW, lớp nhóm, rep > 12, **khách < 18 tuổi** (`kgLoadAge`: baseline.age → profile.dob → "N tuổi" trong
ghi chú; chưa biết tuổi = KHÔNG gợi ý). Chạm chip = điền ô set TRỐNG (`kgUseSuggest`), không ghi đè số đã gõ; ô trống
hiện kg gợi ý làm placeholder. Lịch sử dùng `reps` của GIÁO ÁN lúc lưu (app không ghi rep thực tập).
`tests/kg-suggest.test.js`.

---

## Recovery đọc Work list (2026-11-16)
Lời khuyên Recovery (`recoveryBrief` + `generateBriefIfMissing`) bám HAI trục: hồi phục (Polar / Garmin: Recharge,
HRV, Body Battery, Stress, Training Readiness) và TẬP LUYỆN đọc từ đúng nguồn của tab Work list —
`activity/{ngày}.garmin|strava.workouts` 28 ngày (bỏ Strava trùng Garmin ±2'; hồ sơ chỉ Polar → `workouts` gốc) + buổi
tạ ghi trong app (`workoutHistory`, kèm `volumeByMuscle`). `functions/training-context.js` (`worklistWorkouts`,
`trainingSummary`, `trainingSig`) → `briefInputs()` → mục 8 của bản tin + luật 11–13 (why nêu số của CẢ hai trục,
loadRead đọc Work list, không lặp kiểu tải nặng trong 48h). Buổi NẶNG = TE Garmin aerobic ≥ 3,5 / anaerobic ≥ 2,5,
không có TE thì tải ≥ 1,5 × trung vị 28 ngày. Tải tuần so với TB các tuần TRƯỚC có dữ liệu (tối đa 3, cần ≥ 2 mới so).
Ô số = 7 ngày TRƯỢT (cho tải); thêm `calWeeks` = tuần LỊCH T2 → CN ("Tuần này / Tuần trước") vì coach đếm theo tuần —
thứ Hai thì 7 ngày trượt đã bỏ mất thứ Hai tuần trước. Lời khuyên lưu `brief.sig` (buổi mới nhất lúc phân tích): có
buổi mới → mở tab trả `stale` (dải vàng + "Cập nhật lời khuyên"), sau đồng bộ ('auto') thì tự sinh lại.
Tab Recovery: khối "Tập luyện · 7 ngày qua" (`_rcMountTraining`) dưới ba vòng — BẢN SAO của training-context trong
index.html (`tests/training-context.test.js` bắt hai bản ra cùng số). Khối viết sẵn 2 thứ tiếng (`_rcL`) và mang
`data-i18n-skip`: để bộ tự dịch thì ra chữ lai "ON tập tạ", "8 day".
Chưa làm: buổi CHỈ có trong Polar (vd boxing) khi doc đã có Garmin bị bỏ — tab Work list cũng không hiện chúng.

## Nutrition tab + Gemini

Own top-level tab (`#nutrition-page`, between Progress and Log). Daily macro bars, meal log,
7-day history. **Log bù** (2026-11-14): thanh chọn ngày dưới tiêu đề (‹ › ô ngày "Về hôm nay"), hoặc bấm
một ngày trong lịch sử 30 ngày → `_nlDate`; `_nutritionDateKey()` trả ngày đang chọn nên lưu / xoá bữa tự theo ngày
đó. Lùi tối đa `NUTRITION_BACKLOG_DAYS` = 30 (khớp `NUTRITION_RETENTION_DAYS` — xa hơn là bị prune xoá); ngày rơi khỏi
khung thì quay về hôm nay. Bữa log bù mang `late: true`. Mở tab / đổi khách → về hôm nay. Data at `clients/{id}/nutrition/{YYYY-MM-DD}` → `{ date, meals[], totals }`.
Targets live on the client doc as `macroTargets` + `macroMeta` (reasoning, BMR/TDEE, basis).

Two callables in `functions/index.js`, both `asia-southeast1`, secret `GEMINI_API_KEY`:
- `analyzeMealPhoto` — photo (base64, client-side resized to 800px) → foods + macros
- `recommendMacros` — reads InBody baseline + checkpoints → calorie/macro targets

### Gemini gotchas
- **Model: `gemini-3.6-flash`** (const `GEMINI_MODEL`). `gemini-1.5-flash` and all 2.0 models are
  **shut down** — calling them throws an unhandled error that surfaces in the app as a bare
  `INTERNAL`, with nothing useful in the message.
- **SDK: `@google/genai`** with `client.interactions.create({ model, input, response_format })`,
  read the result from `interaction.output_text`. The old `@google/generative-ai` +
  `getGenerativeModel().generateContent()` is deprecated — do not go back to it.
- Use `response_format` with a **JSON schema** rather than asking for JSON in the prompt;
  it removes parse failures entirely.
- All Gemini calls go through `callGemini()`, which maps 401/404/429/503 to readable errors.
  If you ever see a bare `INTERNAL` again, something bypassed that helper.
- Text prompt goes **before** the image in the `input` array for single-image requests.

### LBM vs SMM — do not conflate
- **LBM** (lean body mass) = fat-free mass: muscle + bone + organs + water = `weight × (1 − pbf/100)`
- **SMM** (skeletal muscle mass) = skeletal muscle only, ~50–55% of LBM, entered from the InBody sheet

Protein targets are calculated **per kg LBM** (the standard). Cindy: 58kg @ 26% → LBM 42.9kg,
SMM 24kg — both correct, different numbers. Calling LBM "muscle mass" contradicts the InBody
printout and confuses the coach; the prompt now forbids it and the UI prints the basis row
(`Weight · Body fat · LBM · SMM`) so the two can be cross-checked at a glance.

### Under-18 safeguard
If age < 18, **never prescribe a deficit** — enforced both in the prompt and in code
(`if (isMinor)` raises calories back to TDEE if the model still returns a cut). Restricting
energy during puberty can affect final adult height and is a risk factor for disordered eating.
Sang is 14 and his stated goal includes "Height", so this path is live, not hypothetical.
A yellow medical note appears in the UI advising parental consent + paediatric review.

---

## Excel → migrate.html: known gotchas (learned the hard way)

### 1. Emoji encoding — only use ⚡ (U+26A1) in openpyxl build scripts
- ⚡ is a BMP character → encodes correctly openpyxl → SheetJS → parser detects phase ✓
- 💪 🔥 🏃 🧘 are surrogate-pair characters → openpyxl writes them but SheetJS `includes()` silently fails → phase not detected → **0 exercises parsed, no error shown**
- Always write: `"⚡ Strength"`, `"⚡ Warmup"`, `"⚡ Circuit"` etc. in build scripts

### 2. Row order inside each phase block — headers AFTER phase row
Parser logic: phase-emoji-row → `inEx=false` | `"Exercise"` header-row → `inEx=true` | exercises added
```
WRONG:  [global header row]  →  [phase row]  →  [exercises]   ← inEx reset → 0 exercises
RIGHT:  [phase row]          →  [header row] →  [exercises]   ← works correctly
```
Each phase needs its OWN header row directly beneath it.

### 3. Firebase API key — keep all HTML files in sync
Active key: `AIzaSyB1RsoFzFv_S0ae2Jkh-2RuZjA5lqGCY_o`  
Must match in: `index.html`, `migrate.html`, `landing.html`, `seed-exercises.html`  
Stale/different key in any file → `auth/api-key-expired` error on login.

Note: `landing.html` is the **homepage** — `vercel.json` routes `/` → `/landing.html`.
It has gone missing from the working tree before while still committed; if `git status`
shows it as deleted, restore it (`git restore landing.html`) rather than committing the
deletion, or the site root 404s.

### 4. build_joost.py reference script
Working build script for generating client Excel files:  
`/Users/longchu/Documents/GitHub/Fitness-app/` — see `build_joost.py` in outputs for template.

---

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health

---

## Trợ lý soạn giáo án — luật cứng (2026-10-12)

- **Khung phương pháp** nằm ở hằng số `METHOD` trong `functions/assistant.js` (volume/tuần theo trình độ,
  rep theo mục tiêu, chia buổi, thứ tự bài, tăng tạ, deload). Là khung MẶC ĐỊNH — sửa thẳng ở đó khi
  studio có quy tắc riêng.
- **Bài phải có trong thư viện**: `propose_program` / `propose_new_client` chạy `resolveProgram()`
  (`functions/program-lib.js`) — tự đổi tên về đúng thư viện, gắn `muscles`, chuẩn hoá tag. Pha
  strength/accessories: bài lạ hoặc mơ hồ dụng cụ bị trả lỗi kèm gợi ý. Bài ĐANG CÓ trong giáo án cũ
  giữ nguyên tên (lịch sử tạ nối theo tên bài).
- **Tag pha chỉ có 4**: `warmup | strength | accessories | circuit`. App dùng `normPhaseTag()` — bản sao
  của `normalizePhaseTag()` ở server; `tests/program-lib.test.js` bắt hai bản phải ra cùng kết quả.
- **Đọc hồ sơ trước khi đề xuất**: trong một lượt trợ lý, `propose_program` bị từ chối nếu chưa gọi
  `get_client` + `get_exercise_loads` của khách đó.
- Giáo án cũ: `node scripts/backfill-program-library.js` (chạy thử) / `--write` — chuẩn hoá tag + gắn
  muscles, KHÔNG đổi tên, KHÔNG bật `bw`, sao lưu vào `profile/program-backup-<ngày>-library`.
- **Lớp nhóm** = một hồ sơ `clients` có `isGroup: true` + `groupFormat` (`hyrox|strength|circuit`),
  `groupSize`, `durationMin`, `equipment`; `email: ''`, tên bắt đầu "Lớp ·". Tạo qua trợ lý (form "Soạn giáo án
  lớp nhóm" → `propose_new_client` isGroup → `coachApply`). Luật soạn ở `GROUP_METHOD` (assistant.js). Lớp không
  báo "chưa tập/InBody/gói" (`clientAlert`), không bật billing; `propose_program` cho lớp chỉ đòi `get_client`.
- **Lớp nhóm — MỖI LỆNH ĐÚNG 1 BUỔI + block có đồng hồ** (2026-11-12): `groupOneSession()` chặn đề xuất lớp > 1 buổi
  (propose_program + propose_new_client). Form lớp: lớp đang mở (chế độ theo khách) → "Buổi mới (khoá trống kế tiếp)" hoặc
  "Làm lại SessionX"; không có lớp → tạo lớp với SessionA. Trường mới, TUỲ CHỌN (giáo án cũ vẽ như cũ): buổi `durationMin`,
  `level`, `coachNotes[]`; pha `durationMin`, `format` (straight|superset|emom|circuit|recovery|mobility), `rounds`, `notes`;
  bài `group` (B1/B2), `intensity` (RPE), `rest`, `minute` (EMOM), `regression`. Tag VẪN 4 loại — recovery/cool-down = tag
  warmup + format. `blockIssues()` (program-check, chỉ đề xuất mới — `requireBlocks`): mọi pha có phút, tổng khớp buổi ±3',
  interval trước tạ phải có block recovery chen giữa; tạ sau interval > RPE 7 chỉ nhắc. App: `sortPhases` GIỮ thứ tự pha khi
  buổi soạn theo block (không thì EMOM đầu buổi bị đẩy xuống cuối); tab Workout hiện tổng phút (đỏ khi lệch), ghi chú coach,
  nhãn block, B1/Phút 1, RPE · nghỉ · bài dễ hơn (`exRest` đọc từ cue khi thiếu `rest`).
- **Tab Lớp nhóm** (2026-11-12, thiết kế Claude Design "Pulse · Tab Lớp nhóm"): `renderGroups()` — danh sách lớp →
  trang lớp (ô Buổi A–G) → chi tiết buổi (thanh thời gian theo block, Dễ/Chuẩn/Khó đọc `regression` + "Dễ:/Khó:" trong
  cue) → **Dạy lớp** (`grpTeach`, toàn màn hình, đồng hồ theo `durationMin` từng block, lưới EMOM, giữ màn hình sáng).
  Chỉ ĐỌC; soạn / làm lại = `grpPulse(cid, key)` mở form lớp với khoá chọn sẵn. `coachApply` đóng `pushedAt` cho buổi lớp
  vừa duyệt (trước khi ghép) → nhãn "Mới" 24h + `grpAfterPush` hiện "Đã lưu Buổi X vào lớp". Màu block: `GRP_COLORS`.
- **Tab Work list + Garmin** (2026-11-13, thiết kế claude.ai/artifact/EAzFcgtXxCcwkf8Pdsb5ua): lịch sử buổi tập đồng hồ
  Garmin của CHÍNH coach (`COACH_HOME_CLIENT`). Đồng bộ chạy TRÊN MÁY coach bằng `scripts/garmin` (python-garminconnect —
  KHÔNG chính thức, có thể hỏng khi Garmin đổi đăng nhập): `login.py` (coach tự gõ mật khẩu; token ở ~/.garminconnect,
  gitignore) → `sync.py` → `write.js --write`. Ghi vào trường `garmin` RIÊNG của `activity/{ngày}` (workouts[]) và
  `recovery/{ngày}`, + `clients/{id}.garminSync` — KHÔNG đè số Polar cùng doc. Tab chỉ đọc doc có `garmin.at`; web không
  Khách khác muốn Garmin → Garmin Connect Developer Program.
  **Đồng bộ trên máy chủ** (2026-11-13): codebase Python `functions-py` (firebase.json codebase `garmin`, python313) —
  `garminSyncNow` (nút Đồng bộ, chỉ coachUid của hồ sơ) + `garminSyncDaily` 06:30. Lõi đọc/ghi `functions-py/garmin_core.py`
  dùng CHUNG với `scripts/garmin/sync.py`. Token ở `privateTokens/garmin_longchu` (luật `if false` — chỉ Admin SDK), tải lên
  bằng `node scripts/garmin/upload-token.js`; hàm ghi lại token đã làm mới mỗi lần chạy. Kéo buổi tập hỏng → KHÔNG ghi đè
  workouts cũ. Garmin có thể chặn IP cloud → nút báo lỗi + hiện lệnh trên Mac. Deploy cần `functions-py/venv` (gitignore).
  **Mọi khách** (2026-11-13, coach chốt — chấp nhận dùng thư viện không chính thức cho khách): tab Work list hiện cho
  khách (hồ sơ của chính mình) và coach (khách đang mở). Chưa kết nối → form email + mật khẩu Garmin → `garminConnect`
  (đăng nhập MỘT lần, lưu TOKEN ở `privateTokens/garmin_{id}`, KHÔNG lưu / log mật khẩu; mã 2 lớp: `privateTokens/
  garmin_mfa_{id}` 10 phút). `clients/{id}.garmin` {connected, name, err}. `garminDisconnect` xoá token. Quyền: coach
  phụ trách hoặc chính khách (email đã xác thực khớp). `garminSyncDaily` chạy mọi token, giãn 20 giây/tài khoản.
  Deploy functions-py cần venv Python **3.13** (runtime python313) — venv 3.14 làm deploy hỏng "Failed to find … SDK".
  **Recovery / Healthspan cho khách Garmin** (2026-11-14): Polar CHỈ là của coach; khách lấy từ Garmin. Khi đồng bộ hồ sơ
  KHÔNG có `polarProfile`, máy chủ (`garmin_core.polar_shape`) ghi THÊM khuôn Polar ở gốc doc: recovery `sleep` (+`hrMin`
  = RHR Garmin), `recharge` {rhr, hrv}, `source:'garmin'`; activity `steps`, `activeSec`, `workouts` (sport viết hoa, at ISO).
  Mọi chỗ đọc khuôn Polar (tab Recovery / Health, recoveryBrief, dashboard) chạy luôn. `garminProfile` (ngày sinh, giới,
  cân kg, cao) → Healthspan tính tuổi. Lần đồng bộ đầu kéo 28 đêm. Nút "Đồng bộ ngay" tab Recovery → `rcGarminSyncNow`
  (khách tự bấm được).
  **Đầy đủ** (2026-11-14): strain 0–21 cho khách Garmin = `functions-py/strain.py`, bản Python của `functions/strain.js` —
  `tests/strain-parity.test.js` bắt hai bản ra CÙNG SỐ (đổi công thức phải đổi cả hai). `garmin_core.day_load` (khuôn
  `load` của Polar): nhịp tim từng giây mỗi buổi (`get_activity_details`) + nhịp tim cả ngày ngoài buổi tập; HR max =
  clients.maxHr > cao nhất Garmin ghi được > Tanaka theo ngày sinh. Chỉ 14 ngày gần nhất mỗi lần (gọi Garmin nặng).
  Nhịp thở + SpO₂ lúc ngủ → `recharge.breathing` / `recharge.spo2`; Health Monitor có ô SpO₂ (ô không đêm nào có số
  thì ẩn). Recovery có mục "Garmin" (`_rcMountGarmin`): Body Battery, Stress TB, Training Readiness.
  **Bản đồ tuyến** (2026-11-14): buổi có GPS (`hasPolyline`) trong 60 ngày → `workouts[].route` {poly (Google encoded
  polyline, ~2–3 KB), spd[] m/s}. Garmin để `speed` / quãng = 0 trong polyline → `_route_speeds` tự tính từ toạ độ
  (haversine) + giờ, trượt 20 giây. App: Leaflet 1.9.4 (cdnjs, tải lười) + nền OpenStreetMap (ghi công), tuyến tô màu
  chậm→nhanh theo phân vị 10/90 của chính buổi đó; CDN hỏng → vẽ SVG. Toạ độ = dữ liệu vị trí (lộ nơi ở) — chỉ coach
  phụ trách + chính khách đọc (luật activity/).
  **Sync nhanh** (2026-11-14): `core.pmap` gọi Garmin song song (6 luồng, MỖI LUỒNG MỘT PHIÊN Garmin riêng nạp từ token
  đã làm mới — phiên thư viện không an toàn khi dùng chung); buổi đã lưu có khoá `route` → dùng lại zones / lap / bản đồ
  (`workout(..., cached)`); strain chỉ tính lại hôm nay + hôm qua + ngày chưa có. Nút Sync: 3 ngày sức khoẻ. Đo trên
  hồ sơ coach: ~28 s → ~7 s (lần đầu sau nâng cấp ~22 s vì bổ sung bản đồ cho buổi cũ).
  **Strava — lựa chọn thứ hai** (2026-11-14, API CHÍNH THỨC, OAuth): tab Work list chưa kết nối hiện 2 thẻ Garmin / Strava.
  `wlStravaConnect` → strava.com/oauth/authorize (scope `read,activity:read_all`, `state` ngẫu nhiên ở sessionStorage) →
  quay về `?code&state` → `_applyDeepLink` → `wlStravaCallback` → callable `stravaConnect` (đổi code lấy token, đồng bộ
  60 ngày). Token `privateTokens/strava_{id}`; mật khẩu ỨNG DỤNG `privateTokens/strava_app` + Client ID công khai
  `settings/strava` — coach tự nhập: `functions-py/venv/bin/python scripts/strava/set_app.py`. `functions-py/strava_core.py`:
  buổi → cùng khuôn workout (id `s<id>`, `source:'strava'`) ở `activity/{ngày}.strava`; streams (toạ độ, tốc độ, nhịp tim)
  cho tối đa 12 buổi MỚI mỗi lần (giới hạn ~100 lượt đọc / 15 phút cho CẢ ứng dụng), còn lại bản đồ một màu từ
  summary_polyline. Strain từ nhịp tim stream; RHR = clients.restingHr hoặc ước 60. Khách không Polar / Garmin → ghi khuôn
  Polar (workouts + recovery.load). App bỏ buổi Strava trùng buổi Garmin (±2 phút). `stravaSyncDaily` 06:40. Ứng dụng
  Strava mới chỉ cho 1 người kết nối — phải xin Strava nâng giới hạn; ghi rõ "app coaching" vì điều khoản Strava hạn chế
  hiển thị dữ liệu cho người khác (coach).
- **Lớp Hybrid / HYROX** (`groupFormat: hyrox`, 2026-10-19): label mỗi buổi bắt đầu bằng loại buổi
  (Compromised / Strength Endurance / Engine / Foundation / Race Sim / Partner); số buổi/tuần quyết định loại
  (form tự gán). Buổi Compromised / Engine / Race Sim: phút CHẠY ≥ phút TRẠM — `hybridIssues()` trong
  `functions/program-check.js` chặn. Bài thay chạy (không có chỗ chạy) ghi "(thay chạy)" trong tên.
- **Khung 1-1 kiểm bằng code** (`program-check.js`): trần volume theo trình độ (nâng 2026-10-31: Beginner 8–14,
  Intermediate 12–18, Advanced 16–22 set/nhóm cơ/tuần; soạn ở nửa trên khoảng), ≤ ~12 set/nhóm cơ/buổi, đủ 8 mẫu
  chuyển động, thời lượng buổi. Ngoại lệ có chủ ý → `volumeExceptions` / `coverageExceptions` kèm lý do. Sửa vài
  buổi: lỗi có sẵn ở giáo án cũ chỉ thành lời nhắc (`newErrors`).
- **Sửa giáo án đang có** (2026-10-20): `EDIT_METHOD` (assistant.js) — đổi ít nhất, giữ tên + tạ cũ, xếp bài cũ vào
  bỏ / giữ + lưu ý / giữ nguyên, pha "🩹 Rehab" (tag warmup) theo LOẠI chấn thương, mốc quay lại. Form "Sửa giáo án"
  trong tab khách. Server: `fillMuscles()` gắn nhóm cơ cho tên cũ không có trong thư viện (so từ động tác, bỏ dụng cụ);
  thẻ duyệt hiện Bỏ / Thêm / Giữ (`programDiff`).
- **Cấu trúc một buổi 1-1** (2026-10-20, `structureIssues`): khởi động ≥ 2 bài; buổi 45/60/75/90' cần ≥ 6/7/8/9 bài
  chính/phụ và ≥ 15/18/21/24 set (nâng 2026-10-31; mặc định 4 block × 2, bài chính 4 set, bài phụ 3) (thời lượng không rõ → coi 60'). Khối circuit ≥ 10' thì bài trong đó được tính và
  ngưỡng set × 0,6; buổi chỉ conditioning chỉ cần khởi động. Sửa buổi nào thì buổi đó phải đạt (`newErrors` changedDays).
- **Lý do chọn bài** (2026-10-15): mỗi buổi có `focus`, mỗi bài pha strength/accessories có `why` — lưu CÙNG
  giáo án. `checkRationale()` chặn đề xuất thiếu. App hiện `why` ở ô "i" và `focus` dưới tiêu đề buổi, cho MỌI người
  (coach + khách). Hỏi "vì sao tập bài X" → trợ lý trả lời từ `why` đã lưu; không có thì phải nói rõ là suy luận.
- **Youth development** (2026-10-22, khách < 18 tuổi): `YOUTH_METHOD` (assistant.js, rút gọn từ
  `docs/prompts/youth-development-program.md`, mẫu Antony). Mức plyo 0–3 (`plyoLevel`) → trần tiếp đất/buổi 0/30/60/80;
  `youthIssues()` chặn vượt trần, bài vượt mức (depth drop, pogo…), 1RM / tới thất bại; khởi động không tính. Tuổi:
  `isMinorClient()` (baseline.age → profile.dob → "15 tuổi" trong notes/goal). **Kem chưa có tuổi trong dữ liệu.**
- **Core** (2026-10-26): `CORE_METHOD` (assistant.js) — 9 cơ chế (ổn định: chống duỗi / xoay / nghiêng / gập; động:
  gập, duỗi, xoay, công suất xoay; nền: thở + gồng). Server bắt MỖI TUẦN đủ 3 mẫu `core_ext`, `core_rot`, `core_lat`
  (thay mẫu "core" cũ; bài trong khởi động cũng tính; crunch / russian twist không thay được). Ngoại lệ cũ `core` miễn cả 3.
- **Hỏi về khách nào thì đọc khách đó** (2026-10-22): `namedClientId()` (assistant.js) / bản sao `_aiNamedClient()`
  (index.html). Câu coach tự gõ gọi tên ĐÚNG MỘT khách khác khách đang mở → app `openClientDash()` + chuyển Pulse sang
  luồng của khách đó trước khi gửi; server `coachAssistant` cũng đọc khách được gọi tên (vẫn qua `assertCanView`).
  Tên một chữ phải viết hoa ("Sang", không phải "chuyển sang"); "An" đúng dấu; nhắc ≥ 2 khách thì không đổi.
- **Tin nhắn coach ↔ khách** (2026-11-07): tab **Chat**. Tin ở `clients/{id}/messages` `{from, uid, text, t}`; tóm tắt
  `clients/{id}.chat` `{lastAt, lastText, lastFrom, coachSeenAt, clientSeenAt}` ghi CÙNG batch (hộp thư + số chưa đọc
  khỏi đọc thêm). Luật: đọc `canAccess` — CHỈ coach phụ trách + chính khách, admin quan sát KHÔNG đọc; ký đúng vai + uid,
  `t == request.time`, ≤ 2000 ký tự, không sửa/xoá. Push: `notifyChatMessage` (khách → coachUid; coach → users có
  clientId VÀ email khớp hồ sơ — users.clientId tự khai được). Khách coach-managed (`email: ''`) không chat được.
  `subscribeProgram` bỏ qua snapshot khi giáo án không đổi — ghi `chat` lên doc khách không được vẽ lại bài đang gõ kg.
- **Tab Anatomy** (2026-11-15): mọi người (coach + khách), chỉ đọc. Hình = `lib/anatomy-map.js` (đường vẽ 89 vùng của
  body-muscles · Ivan Vulović · **Apache-2.0** — giữ ghi công trong file, `lib/anatomy-map.LICENSE.txt`, dòng chân tab),
  tải lười. Bản đồ PHẲNG 2 mặt: "xoay 360°" = lật thẻ (rotateY) — không phải mô hình 3D. Hoạt ảnh chạy bằng JS
  (`anAnimateTo`) và mặt quay đi ẩn bằng `visibility` mỗi khung: WebKit/iPhone bỏ qua backface-visibility → mặt trước
  lộ xuyên mặt sau. File hình TẠO BẰNG `node scripts/anatomy/build-map.js <clone body-muscles>` — nhãn gốc SAI giải phẫu
  (soát 2026-11-16: "shoulder-side" là cả khối vai, vai trước gần như không chạm được; "serratus"/"obliques" nằm trên múi
  bụng; "lats-upper" phủ bả vai + vai sau) → script gán lại theo VỊ TRÍ mảnh, mỗi mục mang sẵn nhóm (mục thứ 4).
  `AN_GROUPS` (29 nhóm, thêm chóp xoay & cơ tròn, cơ cánh tay; vi + en: vị trí, chức năng, mẹo tập), bài gợi ý
  = `anExercises()` từ thư viện (`cdMapMuscle`, P > S, từ khoá, tối đa 2 bài/kiểu động tác; ẩn bài riêng của coach khác);
  thư viện thiếu thì hiện `alt` "gợi ý chung". `tests/anatomy.test.js`.
  **Chế độ Thể thao** (2026-11-16): công tắc "Cơ bắp | Thể thao" đầu tab. `AN_SPORTS` (= SPORTS của functions/sports.js — xem mục Bổ trợ theo môn): `key` (cơ chủ lực + vai trò, tô đậm `an-k1`), `k2` (hỗ trợ, tô nhạt), demands / risk / plan,
  `blocks` (bài + liều; liều viết tiếng Việt, `anDose()` dịch). Không chọn cơ → thẻ môn (`anSportCard`, nhãn "Thư viện"
  khi bài có trong thư viện); chọn cơ → thẻ cơ + "Trong <môn>". Chỉ đọc, khung chung — chưa nối trợ lý soạn buổi.
- **Bổ trợ theo môn thể thao** (2026-11-16): NGUỒN DUY NHẤT `functions/sports.js` (SPORTS: boxing, running, basketball —
  cơ chủ lực, khối tập có `id` / tag pha / `need` bắt buộc / `plyo`, bài `[tên hiển thị, liều, tên ĐÚNG thư viện]`, `season`
  off/pre/in). index.html chép phần dữ liệu (khối `// ── SPORTS — TẠO TỪ`) bằng `node scripts/sports/sync.js` — `tests/sports.test.js`
  bắt lệch. Khách gắn môn = `clients.sport {id, phase}`, coach gắn ở Anatomy → Thể thao (thẻ môn: "Gắn … cho khách này", chọn
  giai đoạn, "Nhờ Pulse soạn bổ trợ"; chỉ coach phụ trách, khách 1-1). Trợ lý: `get_client` trả `sport`, tool `get_sport_guide`,
  `SPORT_METHOD`; `propose_program` đòi đọc `get_sport_guide` khi khách có môn; `sportIssues` (program-check) chặn tuần thiếu khối
  `need` — miễn bằng `coverageExceptions["sport:<id khối>"]`. Bài môn chưa có trong thư viện → `NEW_LIBRARY`, ghi bằng
  `node scripts/sports/add-library.js --write` (chỉ tạo doc mới, doc id = slug, mang `sports: [...]`). Thêm môn = thêm vào
  SPORTS + SPORT_ORDER + bài thiếu vào NEW_LIBRARY → sync → add-library.
- **Hình động minh hoạ bài tập** (2026-11-17): `lib/exercise-anim.js` (tải lười, `exaLoad` / `exaShow` trong index.html) — người
  dạng nét SVG, KHÔNG video. Tư thế = keyframe (hông, góc thân, chân / tay theo góc HOẶC bám điểm IK), nội suy mượt; tự nhấc người
  khi có điểm lọt dưới sàn; một vòng rAF chung, chỉ vẽ hình đang trong màn hình, dừng khi bị gỡ; giảm chuyển động → hình tĩnh.
  Hai tầng: `EX` (51 bài khung môn, vẽ riêng) + **toàn bộ thư viện chung** qua ~85 MẪU chuyển động có tham số (`T.squat`,
  `T.bench`, `T.curl`… dụng cụ đổi theo tên) và bảng `RULES` (regex tên → mẫu, khớp ĐẦU TIÊN thắng — thứ tự quan trọng, vd
  `rowing machine` phải trước `row`). Hiện ở thẻ môn Anatomy, danh sách "Bài tập gợi ý" của thẻ cơ (chạm bài → `anExDemo`) và hộp
  thông tin bài tab Workout (`#modal-anim`). `tests/fixtures/library-names.json` = ảnh chụp tên bài thư viện chung — THÊM BÀI VÀO
  THƯ VIỆN thì thêm tên vào đây; `tests/exercise-anim.test.js` bắt bài thiếu hình / thiếu câu kỹ thuật, khung NaN, người xuyên sàn.
  Bài riêng của coach (ownerUid) không khớp mẫu → không hiện hình (không lỗi). Giới hạn: máy tập vẽ giản lược; động tác hướng về
  người xem (fly, pull-apart, hydrant) dùng co ngắn tay / chân (`as` / `ls`); xoay thân không thể hiện được.
- **Chat theo khách**: tab tên khách trong khung trợ lý (hoặc nút "Hỏi AI về khách này" trên hồ sơ). Lưu ở
  `clients/{id}/aiChat` — chỉ hàm nền `coachAssistant` ghi (`thread: true`), coach của khách + admin đọc, KHÁCH
  KHÔNG đọc. Form "Hôm nay khách không khoẻ" → chỉnh buổi cho hôm nay theo `EXPLAIN_METHOD`, KHÔNG đổi giáo án gốc.
