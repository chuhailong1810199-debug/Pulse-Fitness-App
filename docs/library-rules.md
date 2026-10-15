# Thư viện bài tập — luật dữ liệu & cách tính volume theo nhóm cơ

Rà lại 2026-10-15. Áp cho `exercises/{id}.muscles` và cho hình cơ thể / danh sách nhóm cơ trên dashboard khách.

## 1. Đơn vị volume: SỐ SET, set gián tiếp tính một nửa
- Mỗi bài **đã tích** góp `số set × trọng số vai trò` cho từng nhóm cơ của nó.
- **P (cơ chính) = 1 · S (cơ phụ) = 0,5 · T (cơ ổn định) = 0.**
  - Cách đếm "fractional" (set gián tiếp = ½) dự báo phì đại và sức mạnh tốt nhất trong meta-regression
    67 nghiên cứu, 2.058 người — Pelland et al., *Sports Medicine* 2025 (doi 10.1007/s40279-025-02344-w).
  - Không có bằng chứng set "giữ yên" (ổn định) kích thích phì đại → T không cộng. Q bỏ.
- **Không tính** pha `warmup` và `circuit`: khởi động và conditioning không phải set làm việc
  (8 vòng rowing không phải 8 set đùi trước).
- Một nhóm cơ ứng **nhiều vùng** trên hình (ví dụ "Deltoids" chung) thì **chia đều** giá trị cho các vùng.
- Tên nhóm cơ được **chuẩn hoá khi cộng** (`canonMuscle`) — "GLUTES" và "Glutes" là một dòng.

Code: `MUSCLE_WEIGHTS`, `canonMuscle`, `muscleSetsForDay`, `sessionMuscleSets`, `cdBodyHTML` trong `index.html`.

## 2. Tên nhóm cơ chuẩn (khớp vùng trên hình)
Chest · Front Delts · Side Delts · Rear Delts · Biceps · Triceps · Forearms · Abs · Obliques · Quads ·
Adductors · Hamstrings · Glutes · Calves · Traps · Mid/Lower Traps · Rhomboids · Lats · Teres Major ·
Rotator Cuff · Erector Spinae

Không dùng tên chung "Deltoid/Shoulders" — ghi rõ đầu vai:
| Kiểu bài | Đầu vai |
|---|---|
| Đẩy ngực, push-up, dip, fly | Front Delts (thường S) |
| Đẩy qua đầu, landmine press, thruster | Front Delts + Side Delts (S) |
| Lateral raise, upright row, Y-raise | Side Delts |
| Rear delt fly, face pull, pull-apart | Rear Delts |
| Row, pulldown, pull-up | Rear Delts (S) |
Cơ sở: bench press kích hoạt vai sau rất thấp (~3,5% MVIC so với ~21% vai trước); vai sau làm việc nhiều ở
reverse fly/row — "Different Shoulder Exercises Affect the Activation of Deltoid Portions in Resistance-Trained
Individuals", IJERPH 2020;17(19):7339 (https://pubmed.ncbi.nlm.nih.gov/33049982/) và
"Analysis of anterior, middle and posterior deltoid activation during single and multijoint exercises"
(https://pubmed.ncbi.nlm.nih.gov/24947920/). Các nghiên cứu EMG này nhỏ (≈8–15 người) — dùng để xếp vai trò,
không phải số đo chính xác.

## 3. Vai trò
- **P** — cơ đẩy/kéo chính trong phần lớn biên độ. Mỗi bài ≥ 1 P; bài nhiều khớp tối đa 2–3 P.
- **S** — cơ hiệp đồng đáng kể (triceps trong bench, biceps trong row, mông trong squat…).
- **T** — giữ ổn định; hiện trên hồ sơ bài nhưng KHÔNG cộng volume.
- Biến thể cùng bài (khác dụng cụ) nên có cùng hồ sơ cơ, trừ khi dụng cụ đổi hẳn cơ làm việc.
  `scripts/normalize-library.js` báo các nhóm lệch — sửa tay theo bảng trên.

## 4. Công cụ
- `node scripts/normalize-library.js` (chạy thử) / `--write` — chuẩn hoá tên, đổi "DELTOID" theo kiểu bài,
  điền bài trống, sửa bài ghi sai; sao lưu vào `exerciseBackups/<thời điểm>`. Chỉ thư viện gốc (không `ownerUid`).
- Bài trong giáo án khách giữ bản sao `muscles` lúc soạn; tên cũ vẫn được chuẩn hoá khi cộng.
