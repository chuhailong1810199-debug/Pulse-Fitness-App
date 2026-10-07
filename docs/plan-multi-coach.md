# Plan: Pulse thành app nội bộ cho nhiều coach

Ngày: 2026-10-07 · Nhánh: worktree-backend · Nguồn: /plan-eng-review + outside voice (Claude subagent)

## Trả lời ngắn

**Có, phải đổi cấu trúc khá nhiều, nhưng ở tầng phân quyền chứ không phải viết lại app.**
Dữ liệu khách (clients + subcollection) giữ nguyên dạng, chỉ cần mỗi khách có `coachUid`.
Thứ phải đổi là câu hỏi "ai được thấy khách nào". Hiện "coach" là một quyền toàn cục,
khai ở 3 chỗ không khớp nhau (`firestore.rules:16`, `index.html:253`, `functions/index.js:39`),
và rất nhiều chỗ trong app + functions mặc định "coach thấy tất cả".

Trong lúc rà, tìm ra **5 lỗ bảo mật đang có sẵn hôm nay** (mục A) — nên vá trước, kể cả nếu
chưa làm multi-coach.

## Quyết định đã chốt

| # | Câu hỏi | Chốt |
|---|---------|------|
| D1 | Phạm vi | Nhiều coach + khách vẫn tự đăng nhập bằng Gmail |
| D2 | Giai đoạn | Một đợt đầy đủ, deploy theo thứ tự an toàn |
| 1 | Nguồn vai trò | Doc **`coaches/{email}`** do admin ghi (đổi từ custom claims sau outside voice: thu quyền tức thì, mời coach trước khi họ đăng nhập, không khoá admin ngày deploy) |
| 2 | Sở hữu khách | Đúng **1 coach**: `clients.coachUid` |
| 3 | Storage | **Khoá ngay**, deploy riêng trước |
| 4b | Tự đăng ký | Giữ; hồ sơ tạo qua callable, `coachUid` = admin |
| 5 | Quyền ở functions | Module `functions/authz.js` cho MỌI callable + test ép dùng |
| 6 | Thu tiền | Studio thu chung; chỉ admin xác nhận đã trả |
| 7 | Danh sách khách | Helper `clientsQuery()` + test cấm truy vấn trần |
| 8 | Quét bảng users | Bỏ; nối tài khoản qua `/clientEmails` lúc khách đăng nhập |
| 9 | Test luật | Firebase Emulator + `@firebase/rules-unit-testing` |
| 10 | Admin mặc định thấy | Khách của mình; công tắc "Tất cả coach" |
| — | Lead từ landing | Về admin |

## Mô hình quyền

```
  coaches/{email}  ← CHỈ admin ghi   { name, isAdmin, active, uid (gắn lúc coach đăng nhập lần đầu) }
        │
        ├─▶ firestore.rules
        │     isCoachRole() = exists(coaches/email) && active
        │     isAdmin()     = isCoachRole() && isAdmin
        │     clients/{cid} (đọc, kể cả TRUY VẤN DANH SÁCH):
        │        isAdmin() || (isCoachRole() && resource.data.coachUid == auth.uid)
        │        || isClientOwner(cid)          ← đặt CUỐI, chỉ chạy khi get 1 doc
        │     clients/{cid}/** (subcollection): canManage(cid) = isAdmin()
        │        || (isCoachRole() && get(clients/cid).coachUid == auth.uid)
        │        || isClientOwner(cid)          ← 2 get/lượt, dưới giới hạn 10
        ├─▶ storage.rules  videos/{cid}/**, progressPhotos/{cid}/** → firestore.get cùng logic
        └─▶ functions/authz.js  (Admin SDK bỏ qua rules ⇒ PHẢI tự kiểm)
              requireAuth · requireCoach · requireAdmin
              assertCanManage(auth,cid)   — coach sở hữu hoặc admin
              assertCanAccess(auth,cid)   — như trên HOẶC chính khách đó

  App: userRole vẫn là 'coach' cho cả admin và coach (32 chỗ đang so 'coach' giữ nguyên),
       thêm cờ isAdmin. KHÔNG cache vai trò trong localStorage (pulse_user_v2 chỉ giữ clientId).
```

Lưu ý luật: Firestore rules không lọc dữ liệu. Truy vấn danh sách chỉ được duyệt khi luật
chứng minh được từ `where` — vì vậy `clients` phải dùng `resource.data.coachUid`, không dùng
`get()`, và coach phải luôn truy vấn kèm `where('coachUid','==',uid)`.

Bảng quyền đích:

| Tài nguyên | admin | coach (khách mình) | coach (khách khác) | khách (chính mình) | người lạ đăng nhập |
|---|---|---|---|---|---|
| clients/{id} + subcollections | RW | RW | ✗ | R + W giới hạn (như nay) | ✗ |
| clients.coachUid | W | ✗ | ✗ | ✗ | ✗ |
| clients.access.planId | W | W | ✗ | ✗ | ✗ |
| clients.access.paidUntil, coaching | W (qua callable) | ✗ | ✗ | ✗ | ✗ |
| /clientEmails create/delete | ✓ | khách mình | ✗ | email của chính mình | ✗ |
| invoices đánh dấu paid | callable `markInvoicePaid` | ✗ | ✗ | ✗ | ✗ |
| bookings | RW tất cả | RW coachUid==mình | ✗ | ✗ | ✗ |
| leads | RW | ✗ | ✗ | ✗ | create (landing) |
| coaches | RW | R chính mình + ghi `uid` lần đầu | ✗ | ✗ | ✗ |
| users | RW | R/W chính mình, KHÔNG field role | ✗ | như coach | create chính mình, KHÔNG role |
| exercises | RW | RW | — | R | R |
| settings (TK ngân hàng studio) | RW | R | — | R | R |
| pushSubs | ghi của mình, KHÔNG field role | như admin | — | như admin | như admin |
| Storage videos/{cid}, progressPhotos/{cid} | RW | RW | ✗ | RW | ✗ |

## Thứ tự deploy

```
 [0] Vá lỗ có sẵn (mục A) ── deploy riêng ngay
 [1] Backfill (dry-run trước):
       coaches/chuhailong1810199@gmail.com {isAdmin:true, active:true, uid}
       mọi clients thiếu coachUid → uid admin;  bookings thiếu coachUid → uid admin
       /clientEmails cho mọi khách cũ có email mà thiếu index
       settings/coaching seed sẵn (coach thường không ghi settings được)
 [2] Index ghép bookings (coachUid ASC, date ASC) — CHỜ build xong
 [3] Deploy functions (authz, createSelfClient, assignClient, markInvoicePaid,
     inviteCoach) — tương thích ngược
 [4] Deploy app (coach-aware: clientsQuery, isAdmin, ghi coachUid) TRƯỚC
 [5] Deploy firestore.rules + storage.rules mới
 [6] Admin mời coach thứ hai: tạo coaches/{email} → coach đăng nhập lần đầu
```
Bản app ở [4] chạy được với cả luật cũ lẫn mới (admin vẫn được truy vấn trần), nên không
cần deploy app và luật cùng lúc. `sw.js` không cache gì, `vercel.json` đặt `no-cache` cho html
— không có rủi ro bản cũ kẹt trên máy.
Rút lại: [5] → deploy lại rules commit trước. [1]–[4] tương thích ngược.

## Những gì đã có (tái dùng)

- `clients.coachUid` đã ghi ở `index.html:901` (addClient), `functions/index.js:3413` (coachApply).
- `/clientEmails` + `claimClientEmail()` — chốt một Gmail một khách.
- `isClientOwner()` — giữ cho vai trò khách.
- `loadUserProfile` re-check `/clientEmails` khi user chưa có clientId (`index.html:355`).
- `isCoach()` hiện đã dùng `get(users)` (`firestore.rules:17-18`) — mô hình doc-role quen thuộc.
- `exercises`, `settings` — dùng chung, không phải đổi cấu trúc.

## Việc cần làm

### A. Lỗ bảo mật có sẵn — vá trước, deploy riêng
1. **Storage mở cho mọi tài khoản** (`storage.rules`: `allow read, write: if request.auth != null`).
   Ảnh cơ thể + video mọi khách (có khách 14-15 tuổi) đọc/xoá được bởi bất kỳ Gmail nào.
   → luật theo đường dẫn `videos/{cid}/**`, `progressPhotos/{cid}/**`; còn lại từ chối.
   Đường dẫn đã xác minh: `index.html:2460` (getVideoRefPath), `:2507`, `:4600`, `:4662`, `:9739`.
   URL tải đã phát (có token) không bị thu hồi bởi luật — chấp nhận, hoặc đổi token nếu cần.
2. **Callable không kiểm đăng nhập**: `generateProgram` (:446), `pulseGenerate` (:695),
   `analyzeMealPhoto` (:1848), `recommendMacros` (:1955). `recommendMacros` trả InBody của
   bất kỳ clientId cho người chưa đăng nhập. → `requireAuth` + `assertCanAccess` khi có clientId.
3. **`pulseGenerateFree` công khai lấy giáo án khách thật làm mẫu** (`functions/index.js:1196`
   `db.collection("clients").get()`) → dùng mẫu soạn sẵn, không đọc clients. Thêm App Check
   ở cả `landing.html` và `index.html` (gọi từ `:7013`).
4. **pushSubs tin trường role khách tự ghi** (`index.html:8516` `role: userRole`, rules chỉ kiểm uid)
   → khách tự đăng ký role 'coach' nhận được push lịch (có tên khách) và brief sáng.
   → bỏ field role khỏi pushSubs; server gửi theo `uid`, tra vai trò ở `coaches`.
5. **users tự tạo được role 'admin'** (`firestore.rules:79` chỉ chặn 'coach').
   → users không được ghi `role`; app không đọc `users.role` để cấp quyền.
6. **[ĐÃ SỬA — claimMyClient] Tự đăng ký đang hỏng**: `index.html:331` `setDoc(clients/…)` từ máy khách, nhưng rules chỉ
   cho coach tạo clients → người lạ kẹt ở đăng nhập. (Sửa ở mục D bằng callable.)

### B. Vai trò
7. Collection `coaches/{emailLower}`; callable `inviteCoach(email, name)` / `setCoachActive`
   — chỉ admin. Thu quyền = `active:false`, có hiệu lực ngay ở lượt luật kế tiếp.
8. Xoá 3 danh sách email cứng. Giữ `COACH_EMAIL` chỉ làm địa chỉ nhận mail lead / VAPID.
   `coach@fitwithlongchu.com` là KHÁCH `longchu` (dữ liệu Polar) — bỏ khỏi `COACH_EMAILS`.
9. `loadUserProfile`: đọc `coaches/{email}` **TRƯỚC** khi khớp khách (hiện `index.html:319`
   cho khách thắng → coach mới đăng nhập lần đầu bị tạo thành khách). Coach lần đầu: ghi `uid`
   vào doc của mình. `createSelfClient` từ chối email có trong `coaches`.
10. `userRole = 'coach'` cho admin và coach; thêm `isAdmin`. Cache chỉ giữ `clientId`
    (`index.html:399` đang cache `users.role` — bỏ).

### C. Firestore rules
11. `isCoachRole()`, `isAdmin()`, `canManage(cid)` như sơ đồ trên.
12. `clients` read dùng `resource.data.coachUid`; create: admin, hoặc coach với
    `coachUid == auth.uid`; update `coachUid`, `access.paidUntil`, `coaching`: chỉ admin;
    `access.planId`: coach sở hữu được.
13. `/clientEmails`: create nếu `canManage(request.resource.data.clientId)` hoặc email của
    chính mình; delete nếu `canManage(resource.data.clientId)`. Khi đổi `clients.email`:
    `getAfter(/clientEmails/newEmail).data.clientId == clientId`.
14. `invoices`: ghi paid chỉ qua callable `markInvoicePaid` (một transaction: invoice +
    `access.paidUntil`) — thay hai lần ghi rời ở `index.html:9322-9330`.
15. `bookings`: create bắt buộc `coachUid == auth.uid` (admin được gán khác); update giữ
    nguyên `coachUid`.
16. `users`, `leads`, `coaches`, `pushSubs` như bảng quyền.

### D. App (index.html)
17. `clientsQuery({all})` — coach/admin mặc định `where('coachUid','==',uid)`; admin bật
    "Tất cả coach" thì truy vấn trần. Thay: `:563`, `:604`, `:684`, `:4369`, và cú pháp compat
    `:4752`, `:4975`, `:5221`, `:5264` (`db.collection('clients')` / `firebase.firestore()`).
    `:302`, `:367` là quét email legacy lúc đăng nhập dưới vai trò khách, đã bắt lỗi — giữ, ghi chú.
18. Bỏ quét `users` ở `:861` (saveClientInfo), `:916` (addClient).
19. Tự đăng ký (`:326-338`) → callable `createSelfClient`: chiếm `/clientEmails` trước,
    tạo hồ sơ `coachUid` = admin, gỡ index nếu ghi hồ sơ hỏng.
20. Bookings: ghi `coachUid` (`:7666`); truy vấn lịch thêm `where('coachUid','==',uid)`
    (`:7348`, `:7829-7831`) trừ khi admin bật "Tất cả coach". Tổng thu tháng (`:7828-7850`)
    tính theo coach đang xem.
21. Billing: `billSetPlan` (`:9361`) / `billIssue` (`:9276`) chỉ ghi `access.planId`;
    nút "đã trả" gọi `markInvoicePaid`, chỉ hiện với admin. `settings/coaching` seed ở backfill
    (`:9225` coach thường không ghi được).
22. Màn **Coach** (chỉ admin): danh sách coach, số khách mỗi người, mời / tắt coach,
    chuyển khách (`assignClient(clientId, coachUid)`). Thanh khách hiện tên coach khi
    bật "Tất cả coach".

### E. Functions
23. `functions/authz.js` (mục sơ đồ). Mọi `onCall` gọi một trong các hàm của nó, trừ danh
    sách công khai có chủ đích: `pulseGenerateFree`.
24. `assistant.js`: truyền `auth` vào `runTool`; `list_clients` lọc `coachUid`; mọi tool có
    `clientId` gọi `assertCanManage`; `propose_new_client` gán `coachUid` người gọi. Chỉ dẫn
    hệ thống: thay "trợ lý của Long Chu" bằng tên coach đang gọi.
25. `coachApply`: `assertCanManage` cho apply_program; create_client ghi `coachUid` người gọi.
26. `pulseGenerate` (`:743`) và `generateProgram`: lấy mẫu giáo án chỉ từ khách cùng `coachUid`.
27. Push: `pushToAll({role})` → gửi theo `uid`. `scheduleReminders` / `morningSchedule`
    chạy cho từng coach với booking `coachUid` của họ. Brief sáng dùng recovery của khách
    `longchu` chỉ gửi cho admin.
28. `recoveryBrief` (`:2999`), `syncPolarNow` (`:2724`), `pushTest`, `coachApply`,
    `coachAssistant`: bỏ so `COACH_EMAIL`, dùng authz.

### F. Dữ liệu
29. `scripts/backfill-multi-coach.js` — dry-run in danh sách thay đổi; rồi ghi (mục [1]).
30. `firestore.indexes.json`: thêm (bookings: coachUid ASC, date ASC).

### G. Test (cùng đợt)
31. `tests/rules/firestore.rules.test.js` — ma trận {admin, coachA, coachB, coach đã tắt,
    khách A, người lạ, chưa đăng nhập} × {clients đọc 1 doc, query trần, query where,
    từng subcollection, clientEmails create/delete, invoices, bookings, leads, coaches,
    users (kể cả tự ghi role), pushSubs (kể cả field role)} × {đọc, ghi}.
32. `tests/rules/storage.rules.test.js` — cùng ma trận cho videos/, progressPhotos/, đường lạ.
33. `tests/authz.test.js` — authz với Firestore emulator; test quét `functions/*.js`: mọi
    `onCall` gọi authz trừ danh sách công khai.
34. `tests/coach-assistant.test.js` — coach B hỏi khách coach A → từ chối; list_clients lọc.
35. `tests/clients-query.test.js` — cấm `collection(db,'clients')` và `.collection('clients')`
    không theo sau `.doc(` ngoài `clientsQuery()` (trừ `:302`, `:367` có ghi chú).
36. `tests/role-gating.test.js` — cập nhật cho isAdmin; khẳng định không còn email cứng.
37. `run-tests.sh` chạy emulator qua `firebase emulators:exec`. **Máy chưa có Java** — cần
    `brew install openjdk` trước.

## Sơ đồ phủ test

```
CODE PATHS                                         USER FLOWS
[+] firestore.rules                                [+] Admin mời coach B
  ├── clients query where/trần     [GAP→31]          ├── [GAP→E2E] B đăng nhập lần đầu → là coach, KHÔNG thành khách
  ├── subcollection canManage      [GAP→31]          └── [GAP]     B thấy 0 khách, tạo khách → coachUid = B
  ├── clientEmails chéo coach      [GAP→31]        [+] Coach B thử xem khách của A
  ├── access.planId vs paidUntil   [GAP→31]          ├── [GAP] qua app (id trên URL / bộ chọn)  → bị chặn
  ├── users tự ghi role            [GAP→31]          └── [GAP] qua trợ lý AI "giáo án của Cindy" → từ chối
  └── coach active:false           [GAP→31]        [+] Admin tắt coach B
[+] storage.rules                  [GAP→32]          └── [GAP] lượt đọc kế tiếp bị chặn ngay
[+] functions/authz.js             [GAP→33]        [+] Khách tự đăng ký
  └── mọi onCall đều gọi           [GAP→33]          ├── [GAP→E2E] Gmail lạ → createSelfClient → vào app
[+] assistant runTool(auth)        [GAP→34]          └── [GAP] Gmail đã có chủ / email là coach → báo lỗi rõ
[+] createSelfClient / assignClient /              [+] Admin chuyển khách A→B
    markInvoicePaid / inviteCoach  [GAP→33]          └── [GAP] A mất quyền ngay, B thấy ngay, khách vẫn đăng nhập
[+] index.html clientsQuery        [GAP→35]        [+] Khách thường (11 người tự đăng nhập)
                                                     └── [GAP] [→E2E] nutrition + recommendMacros vẫn chạy
LLM: [→EVAL] chỉ dẫn hệ thống đổi tên coach — chạy lại coach-assistant.test.js
COVERAGE hiện tại: 0/22 đường mới — kế hoạch phủ 22/22
```

## Rủi ro khi chạy thật

| Đường mới | Cách hỏng | Test | Xử lý lỗi | Người dùng thấy |
|---|---|---|---|---|
| luật clients mới | query thiếu where → bị từ chối cả lần | 31, 35 | app luôn qua clientsQuery | lỗi rõ (permission-denied được log) |
| backfill sót khách | thiếu coachUid → coach không thấy | dry-run | admin vẫn thấy khi bật "Tất cả" | admin thấy, coach không |
| index bookings chưa build | `failed-precondition` | — | chờ build trước [4] | lịch trống — **phải chờ index** |
| coach mới đăng nhập trước khi được mời | bị tạo thành khách, chiếm Gmail | 31, 33 | createSelfClient từ chối email trong coaches; admin xoá hồ sơ + index nếu đã lỡ | báo "liên hệ admin" |
| createSelfClient lỗi giữa chừng | đã chiếm index, chưa có hồ sơ | 33 | gỡ index (như coachApply) | báo lỗi, thử lại được |
| markInvoicePaid | một trong hai ghi hỏng | 33 | transaction | không có trạng thái nửa vời |
| Storage firestore.get | hồ sơ khách bị xoá còn file | 32 | từ chối | ảnh cũ không tải — chấp nhận |

Không còn lỗ "lỗi im lặng" nào không có test lẫn xử lý.

## Không làm trong đợt này

- Một khách nhiều coach (`coachUids[]`) — chọn 1 coach.
- Tài khoản nhận tiền riêng từng coach — studio thu chung.
- Hàng chờ duyệt tự đăng ký — gán thẳng admin.
- Chia lead tự động cho coach — lead về admin.
- Thư viện bài tập riêng từng coach.
- Báo cáo doanh thu / hoa hồng theo coach — làm ngoài app.
- Thu hồi URL tải Storage đã phát trước khi khoá.

## Song song hoá

| Bước | Module | Phụ thuộc |
|---|---|---|
| A vá lỗ có sẵn | storage.rules, functions/, firestore.rules (users, pushSubs) | — |
| F backfill + index | scripts/, firestore.indexes.json | — |
| C rules | firestore.rules, tests/rules | A |
| E functions | functions/ | A |
| D app | index.html | C, E |

Lane 1: A → C (cùng firestore.rules, tuần tự). Lane 2: F. Lane 3: E sau A.
Lane 1 và 3 cùng đụng functions/ ở bước A → làm A trước rồi mới tách lane.
D chạm index.html một mình, làm cuối.

## Implementation Tasks

- [x] **T1 (P0, human: ~4h / CC: ~30m)** — storage.rules — khoá theo đường dẫn khách + test 32
- [x] **T2 (P0, human: ~3h / CC: ~20m)** — functions — requireAuth/assertCanAccess cho 4 callable không kiểm (A2)
- [x] **T3 (P0, human: ~2h / CC: ~15m)** — firestore.rules — users chỉ tự tạo role 'client'; pushSubs chỉ coach ghi role 'coach' (A4, A5). Bỏ hẳn field role ở pushSubs để lại cho T8.
- [x] **T4 (P1, human: ~2h / CC: ~15m)** — pulseGenerateFree — chỉ lấy khung giáo án, đọc tối đa 12 hồ sơ (A3). App Check CHƯA làm — cần đăng ký reCAPTCHA trong Firebase Console.
- [ ] **T5 (P1, human: ~1d / CC: ~1h)** — functions/authz.js + coaches collection + inviteCoach/setCoachActive + test 33
- [ ] **T6 (P1, human: ~1.5d / CC: ~1.5h)** — firestore.rules multi-coach (C11-16) + test 31
- [ ] **T7 (P1, human: ~1d / CC: ~1h)** — assistant.js + coachApply + generators theo coach (E24-26) + test 34
- [ ] **T8 (P1, human: ~1d / CC: ~1h)** — push + lịch theo coach (E27) + index bookings
- [ ] **T9 (P1, human: ~2d / CC: ~2h)** — index.html: clientsQuery, isAdmin, loadUserProfile coach-trước, createSelfClient, billing, màn Coach (D17-22) + test 35, 36
- [ ] **T10 (P1, human: ~3h / CC: ~20m)** — scripts/backfill-multi-coach.js (dry-run + ghi)
- [x] **T11 (P2, human: ~1h / CC: ~10m)** — run-tests.sh chạy emulator; cài Java

Tổng: human ~3-4 tuần · CC ~1-2 ngày.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 1 | issues_found | Codex CLI không trả output; chạy Claude subagent thay: 15 phát hiện, 12 áp + 1 bất đồng giải quyết (đổi claims → coaches doc) |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | issues_open | 12 vấn đề, 1 critical gap (luật danh sách clients) đã sửa trong plan |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

- **CROSS-MODEL:** bất đồng ở vai trò (claims vs doc) → user chọn doc. Outside voice bắt 3 lỗi P0 review bỏ sót (luật query danh sách, clientEmails chéo coach, coach mới thành khách) và 1 rủi ro review khẳng định sai (service worker cache).
- **UNRESOLVED:** 0
- **VERDICT:** Eng review xong, plan sẵn sàng triển khai sau khi cài Java cho emulator. Chưa có code nào được viết.
