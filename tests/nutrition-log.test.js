/**
 * Giao diện ghi bữa ăn — giữ mấy bất biến dễ mất khi sửa sau này.
 *
 * Bản thiết kế mới bỏ màn chọn ba thẻ, nên luồng chụp ảnh và vùng mục tiêu
 * được viết lại. Mấy điều dưới đây không hiện ra trên màn hình nên rất dễ bị
 * gỡ nhầm; mỗi điều đều gắn với một lỗi thật:
 *
 *  - hai chốt _nlCancelled: khách bấm Huỷ rồi, câu trả lời về muộn vẫn bật
 *    màn kết quả lên đè lên thứ họ đang làm
 *  - nlSetRecent([]) đồng bộ đầu loadNutritionData: renderNutritionMonth chạy
 *    không chờ, giữa lúc đổi khách danh sách "ăn lại" vẫn là của khách trước
 *  - nlSetRecent trước lần return sớm trong renderNutritionMonth: khách chưa
 *    ghi bữa nào thì thừa hưởng món của khách vừa xem
 *  - capture="environment": thiếu nó thì nút chụp mở thư viện, không mở camera
 *  - gating coach: nlRecHTML/nlNoTargetHTML kèm nút sửa mục tiêu
 *
 * Kiểm tĩnh, không cần trình duyệt.
 */
const fs = require("fs"), path = require("path"), assert = require("assert");
const s = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

const bad = [];
const must = (cond, msg) => { if (!cond) bad.push(msg); };

// ── chốt huỷ ──────────────────────────────────────────────────────────────
must(/async function handleMealPhoto[\s\S]{0,400}?window\._nlCancelled = false;/.test(s),
  "handleMealPhoto thiếu `window._nlCancelled = false` ở đầu -> lần huỷ trước còn dính sang lần chụp sau");
must(/if \(window\._nlCancelled\) return;[\s\S]{0,120}?renderAiResults/.test(s),
  "thiếu chốt `if (window._nlCancelled) return` trước renderAiResults -> ket qua ve muon bat man ket qua len");

// ── chống rò "ăn lại" giữa các khách ──────────────────────────────────────
const load = s.slice(s.indexOf("async function loadNutritionData()"));
must(/^[\s\S]{0,600}?nlSetRecent\(\[\]\)/.test(load),
  "loadNutritionData thiếu nlSetRecent([]) đồng bộ -> đổi khách xong mở sheet thấy món khách cũ");

const month = s.slice(s.indexOf("async function renderNutritionMonth()"));
const iSet = month.indexOf("nlSetRecent(nlBuildRecent(days))");
const iRet = month.indexOf("if (days.length === 0)");
must(iSet !== -1, "renderNutritionMonth không nạp nlSetRecent(nlBuildRecent(days))");
must(iSet !== -1 && iRet !== -1 && iSet < iRet,
  "nlSetRecent phải đứng TRƯỚC lần return sớm -> khách chưa ghi bữa nào sẽ giữ món của khách trước");

// ── hai input ảnh tách riêng, đúng vai ────────────────────────────────────
must(/id="nlog-photo-input"[^>]*capture="environment"/.test(s),
  'input chụp mất capture="environment" -> bấm "Chụp món ăn" lại mở thư viện');
must(/id="nlog-library-input"(?![^>]*capture)/.test(s),
  "input thư viện không được có capture -> mất đường chọn ảnh có sẵn");

// ── vùng mục tiêu: nút của coach không được lọt sang khách ────────────────
const card = s.slice(s.indexOf("function renderNutritionCard()"),
                     s.indexOf("function nlEsc("));
must(/isCoach \? nlRecHTML\(m\) : nlRecClientHTML\(m\)/.test(card),
  "nlRecHTML (kèm nút Tính lại/Chỉnh tay) phải chỉ dành cho coach");
must(/nlNoTargetHTML\(isCoach \? 'coach' : 'client'/.test(card),
  "nlNoTargetHTML phải nhận đúng vai -> khách sẽ thấy nút đặt mục tiêu");
must(/if \(m && m\.isMinor && m\.medicalNote\) html \+= nlMedicalHTML\(m\);/.test(card),
  "mất cảnh báo dưới 18 tuổi (Sang 14, Antony 15) -> đây là chốt an toàn, không phải trang trí");
must(card.indexOf("nlMedicalHTML") < card.indexOf("nlMacroRowHTML"),
  "cảnh báo dưới 18 phải dựng TRƯỚC thẻ macro, không nằm dưới các con số");

// ── LBM không được gọi là cơ ──────────────────────────────────────────────
must(s.includes("'Khối nạc (LBM)'") && s.includes("'Cơ xương (SMM)'"),
  "dòng InBody phải ghi rõ Khối nạc (LBM) và Cơ xương (SMM)");
must(!/(Khối|Lượng) cơ \(LBM\)|LBM[^<'\n]{0,20}cơ bắp/i.test(s),
  "LBM là khối nạc (cơ + xương + tạng + nước), gọi nó là cơ là trái với bản in InBody");

// ── sheet: màn chọn ba thẻ phải biến mất, bốn bước phải còn ───────────────
must(!/nlog-option-row|class="nlog-option"/.test(s),
  "ba thẻ chọn Camera/Library/Manual vẫn còn -> đúng thứ bản thiết kế này bỏ đi");
for (const step of ["0", "analyzing", "results", "manual"])
  must(s.includes('id="nlog-step-' + step + '"'),
    "mất bước #nlog-step-" + step + " -> showNlogStep() sẽ không bật được nó");

// ── khối CSS mới phải nằm TRONG một <style>, không tự đóng sớm ────────────
must((s.match(/<style/g) || []).length === (s.match(/<\/style>/g) || []).length,
  "số thẻ <style> và </style> lệch nhau");
must(!s.includes('<style id="nl-css">'),
  'còn sót thẻ <style id="nl-css"> lồng bên trong -> đóng sớm khối style của app, CSS phía sau thành rác');

console.log("Kiem giao dien ghi bua an");
if (bad.length) { console.log("\n" + bad.map((b) => "  HONG " + b).join("\n")); process.exit(1); }
console.log("\nTAT CA DAT — chot huy, chong ro giua khach, gating coach, canh bao duoi 18 deu con");
