/**
 * Hồi quy cho nút "Đồng bộ ngay".
 *
 * Bấm lúc 06:30 sáng giờ VN, ngay sau khi ngủ dậy: Polar thường chưa công bố
 * Nightly Recharge của đêm đó. Nút phải nói thẳng ra, thay vì báo "Đã cập nhật
 * 9 đêm" rồi để màn hình không đổi gì.
 *
 * Chạy đúng hàm polarSyncNow trong index.html, không chép lại logic.
 */
const fs = require("fs"), vm = require("vm"), assert = require("assert");

const src = fs.readFileSync(require("path").join(__dirname, "..", "index.html"), "utf8");
const i = src.indexOf("async function polarSyncNow()");
let j = src.indexOf("{", i), d = 0, k = j;
for (; k < src.length; k++) { const c = src[k];
  if (c === "{") d++; else if (c === "}") { d--; if (!d) { k++; break; } } }
const fnSrc = src.slice(i, k);

// 06:30 sáng 03/10 giờ VN = 23:30 ngày 02/10 giờ UTC. Đây là chỗ bẫy: lấy
// ngày bằng toISOString() ở thời điểm này sẽ ra 2026-10-02, không phải 03.
const REAL = new Date("2026-10-02T23:30:40Z").getTime();

async function run(dates) {
  let text = null;
  const btn = { textContent: "", disabled: false };
  class FakeDate extends Date {
    constructor(...a) { super(...(a.length ? a : [REAL])); }
    static now() { return REAL; }
  }
  const ctx = {
    Date: FakeDate, Array, String, Math, JSON, console,
    setTimeout: () => {},
    userRole: "coach",
    activeClient: { id: "longchu" },
    _activity: [],
    document: {
      querySelector: (s) => (s === ".rc-sync" ? btn : null),
      getElementById: () => ({ classList: { contains: () => false } }),
    },
    firebase: { app: () => ({ functions: () => ({
      httpsCallable: () => async () => ({ data: { results: [
        { clientId: "longchu", written: dates.length, dates, activity: 10 } ] } }),
    }) }) },
    loadRecovery: async () => {}, checkActiveTab: async () => {},
    loadActive: async () => {}, recoveryBrief: () => {},
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fnSrc + "\n; polarSyncNow", ctx);
  await vm.runInContext("polarSyncNow()", ctx);
  return btn.textContent;
}

(async () => {
  const upTo2 = ["2026-09-30", "2026-10-01", "2026-10-02"];
  const upTo3 = upTo2.concat("2026-10-03");

  const a = await run(upTo2);
  console.log("Polar chua co dem nay ->", JSON.stringify(a));
  assert(/chưa có đêm nay/.test(a),
    "phai noi ro Polar chua co dem nay, khong duoc bao thanh cong");

  const b = await run(upTo3);
  console.log("Polar da co dem nay   ->", JSON.stringify(b));
  assert(/Đã cập nhật/.test(b),
    "co dem nay thi phai bao thanh cong (bay gio-mui-gio: toISOString se hong o day)");
  assert(!/chưa có đêm nay/.test(b));

  console.log("\nCA HAI CA DEU DAT");
})();
