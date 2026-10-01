# Brief cho Claude Design — vẽ lại logo Pulse theo bảng màu mới

## Bối cảnh

App vừa đổi từ tông **tím–đen** sang **đen ấm + xanh da trời**. Logo hiện tại
là chữ "Pulse" viết tay, phát sáng tím neon, đặt trên nền tím đậm. Giờ nó chọi
với toàn bộ giao diện.

## Bảng màu mới, bắt buộc bám theo

| vai trò | mã |
|---|---|
| Nền trang | `#161111` — đen **ấm**, R nhỉnh hơn G và B |
| Mặt thẻ | `#211E1D` |
| **Điểm nhấn chính** | `#8FDBFF` — xanh da trời sáng |
| Điểm nhấn đậm | `#1C90FF` |
| Chữ trên nền sáng | `#161111` |

Không dùng tím. Không dùng đen ngả lam (`#0A0A14` kiểu cũ) — đặt cạnh `#161111`
là thấy lệch tông ngay.

---

## Vấn đề của logo hiện tại, không chỉ là màu

**1. Chữ ký quá rối ở cỡ nhỏ.**
Logo đang được dùng ở **5 chỗ**, nhỏ nhất là **38×38px**, và favicon là
**32×32px**. Nét chữ viết tay có đuôi mảnh và gạch chân swoosh — ở 32px thành
một vệt mờ không đọc được.

**2. Hiệu ứng phát sáng neon không còn hợp.**
Ảnh tham chiếu của giao diện mới phẳng, không glow. Logo phát sáng sẽ là thứ
duy nhất trong app còn hiệu ứng đó.

**3. Icon PWA đang nền đặc.**
`icon-192.png` và `icon-512.png` khai `"purpose": "any maskable"` — Android sẽ
cắt theo hình mặt nạ tròn/vuông bo. Nội dung phải nằm trong **vùng an toàn 80%
chính giữa**, nếu không sẽ bị cắt cụt.

---

## Cần giao lại

### 1. Logo chính — SVG, nền trong suốt

Dùng trên nền `#161111` và `#211E1D`. Kích thước thật khi hiển thị: **38px đến
160px**. Ưu tiên đọc được ở đầu nhỏ của khoảng đó.

Đề nghị tách làm hai phần để dùng linh hoạt:
- **Biểu tượng** (dấu hiệu riêng, vuông) — dùng cho icon và chỗ 38px
- **Chữ "Pulse"** — dùng cạnh biểu tượng ở chỗ rộng

### 2. Bộ icon ứng dụng — PNG, nền đặc `#161111`

| file | kích thước | ghi chú |
|---|---|---|
| `icon-512.png` | 512×512 | maskable, nội dung trong vùng an toàn 80% |
| `icon-192.png` | 192×192 | maskable |
| `apple-touch-icon.png` | 180×180 | iOS tự bo góc, đừng tự bo sẵn |
| `favicon-32.png` | 32×32 | chỉ còn biểu tượng, bỏ chữ |

### 3. Một dòng nói rõ ý tưởng

Tại sao hình đó đại diện cho Pulse. Một hai câu, không cần diễn giải dài.

---

## Ràng buộc kỹ thuật

**Logo có hiệu ứng đập như nhịp tim.** Trong app có hai animation gắn vào nó:

```css
.pulse-logo-anim { animation: heartbeat 2.4s ease-in-out infinite;
                   transform-origin: center; }
.splash-logo    { animation: sp-heartbeat ... }   /* phóng to thu nhỏ */
```

Nên hình phải **cân đối quanh tâm** — lệch tâm thì khi đập sẽ thấy rung lệch.

**Tên "Pulse" cũng xuất hiện dạng chữ thuần** ở vài chỗ, font Figtree 800, màu
`#8FDBFF`. Nếu chữ trong logo dùng font khác hẳn thì hai thứ sẽ đánh nhau — nói
rõ font đề xuất, hoặc bám theo Figtree.

---

## Về ý nghĩa

Pulse là app huấn luyện cá nhân của một PT ở Việt Nam. App đo nhịp tim, giấc
ngủ, hồi phục, tải tập từ vòng Polar — **nhịp tim là trung tâm của sản phẩm**,
không chỉ là cái tên hay.

Khách phần lớn mở app vào **sáng sớm hoặc tối muộn**. Giọng của thương hiệu là
chính xác và điềm tĩnh, không hô hào kiểu phòng gym.

---

## Không cần

- Mockup đặt logo lên áo, biển hiệu, danh thiếp
- Nhiều phương án màu — bảng màu đã chốt
- Chữ ký viết tay kiểu cũ nếu nó không đọc được ở 32px
