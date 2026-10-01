# Brief cho Claude Design — đổi Pulse sang tông đen làm chủ đạo

## Việc cần làm

Đổi bảng màu của app Pulse từ **tím–đen** sang **đen ấm làm chủ đạo, điểm xanh
da trời**, theo ảnh tham chiếu đính kèm.

**Giao lại một BẢNG ÁNH XẠ MÀU, không phải file đã viết lại.**
`index.html` nặng 760KB và chứa toàn bộ logic ứng dụng. Viết lại là mất app.
Thứ cần là: `màu cũ → màu mới`, rồi tôi tự quét thay trong mã nguồn.

---

## Màu đích, đo trực tiếp từ ảnh tham chiếu

| vai trò | mã | ghi chú |
|---|---|---|
| Nền sâu nhất | `#161111` | chiếm 12,7% diện tích ảnh — **đen ẤM**, R hơi cao hơn G và B |
| Mặt thẻ | `#211E1D` | thẻ nổi trên nền |
| Mặt thẻ sáng hơn | `#3F3F3D` | hộp lồng trong thẻ |
| Mặt nhạt nhất | `#4C4A48` | ô nhập, chip |
| Đường rãnh | `#595755` | nền thanh tiến độ, đường kẻ |
| **Điểm nhấn chính** | `#8FDBFF` | thanh tiến độ, trạng thái hoạt động |
| Điểm nhấn đậm | `#1C90FF` | nút chính, nhãn nổi bật |

**Điều quan trọng nhất:** đen hiện tại của app là `#0A0A14` — **ngả xanh lam**.
Đen trong ảnh là `#161111` — **ngả đỏ, ấm**. Đây là khác biệt dễ bỏ sót nhất và
cũng là thứ quyết định app trông giống ảnh hay không.

Màu tím `#787EE7` trong ảnh là **nền trình bày của ảnh mockup**, không phải màu
giao diện. Đừng đưa vào bảng.

---

## Màu đang dùng, đã đếm trong mã nguồn

**2.026 giá trị màu**, ở ba dạng: `809 hex`, `1.043 rgba()`, `174 oklch()`.

### Tím cần thay
| mã | số lần | vai trò |
|---|---|---|
| `#7665FF` | 168 | tím chính — nút, trạng thái bật, nhấn mạnh |
| `#9B8DFF` | 48 | viền, biểu tượng |
| `#B9AAFF` | 28 | nhạt — số liệu, vòng tròn |
| `#BCA8FF` | 26 | nhạt |
| `#E7E2FA` | 19 | rất nhạt — chữ trên nền tím |

### Nền xanh đậm cần thay
| mã | số lần |
|---|---|
| `#0A0A14` | 68 |
| `#1C1338` | 24 |
| `#15102B` | 19 |
| `#2A2A4E` | 15 |
| `#2A1F5E` | 9 |

### KHÔNG được đổi
| mã | vai trò |
|---|---|
| `#7ED9A0` | xanh lá — trạng thái tốt, đạt mục tiêu |
| `#EE5A4F` | đỏ — nguy hiểm, xoá, cảnh báo |
| `#F4F1FB` `#FFFFFF` | chữ |
| `oklch` sắc độ 25 và 27 | đỏ xoá/cảnh báo, đã nhầm một lần rồi |

---

## Ràng buộc, rút ra từ lần đổi màu trước của chính dự án này

**1. Quét theo SẮC ĐỘ, không theo danh sách tên màu.**
Lần trước tôi quét hex rồi tuyên bố xong — sót **191 giá trị `rgba()`** cùng
màu đó, và coach mở app lên vẫn thấy mảng màu cũ. Bảng ánh xạ phải phủ cả ba
dạng: `#RRGGBB`, `rgba(r,g,b,a)`, `oklch(l c h)`.

**2. `oklch` phải lọc theo khoảng sắc độ, không đổi hết.**
Lần trước tôi xoay cả sắc độ 25 và 27 sang tím — đó là đỏ xoá. Chỉ đụng khoảng
sắc độ của tím/lam, chừa đỏ và lục.

**3. Độ tương phản chữ phải đạt WCAG AA (4.5:1).**
Nền tối hơn thì chữ xám nhạt hiện tại có thể rớt chuẩn. Nêu rõ cặp nào cần
chỉnh và chỉnh thành gì.

**4. Giữ nguyên ngữ nghĩa.**
Một màu đang là "đang hoạt động" thì sau khi đổi vẫn phải đọc ra "đang hoạt
động". Đừng gộp hai vai trò khác nhau vào cùng một màu mới.

---

## Cấu trúc hiện có

`:root` chỉ khai báo 8 biến và **phần lớn mã không dùng chúng** — màu nằm rải
rác dạng chữ cố định:

```css
:root{
  --bg-1:#0d0d0d;  --bg-2:#111111;
  --txt:#ffffff;   --txt-muted:rgba(255,255,255,0.55);
  --surface:rgba(255,255,255,0.06);
  --line:rgba(255,255,255,0.12);
  --blue:#ffffff;  --cyan:rgba(255,255,255,0.75);
}
```

Nếu đề xuất gom về biến, nói rõ **biến mới nào thay cho mã cố định nào** — vẫn
dưới dạng ánh xạ, để tôi quét thay được.

---

## Giao lại đúng ba thứ

1. **Bảng ánh xạ** `màu cũ → màu mới`, phủ hex + rgba + oklch, kèm vai trò từng
   màu
2. **Khối `:root` mới** nếu đề xuất gom về biến
3. **Danh sách cặp chữ/nền cần chỉnh** để đạt AA, kèm tỷ lệ tương phản trước và
   sau

Không cần file HTML. Không cần mô tả cảm hứng thiết kế.

---

## Bối cảnh sản phẩm

Pulse là app huấn luyện cá nhân của một PT ở Việt Nam, 19 khách. Coach dùng
trên máy tính để soạn giáo án; khách dùng trên điện thoại để xem bài tập, ghi
tạ, chụp ảnh bữa ăn, xem hồi phục từ vòng Polar.

Phần lớn thời gian mở app là **sáng sớm hoặc tối muộn**, nên nền tối sâu là
đúng nhu cầu, không phải chạy theo mốt.
