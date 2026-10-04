/**
 * Nhắc giờ tập: đổi múi giờ và chọn buổi tới hạn.
 *
 * Hai thứ dễ sai và sai thì im lặng:
 *  - Lịch ghi theo GIỜ VN, máy chủ chạy UTC. Lệch 7 tiếng là nhắc sai cả buổi
 *    mà log vẫn báo "đã chạy".
 *  - Buổi đầu giờ sáng: 30 phút trước nó còn nằm ở NGÀY HÔM TRƯỚC.
 */
const fs = require("fs"), vm = require("vm"), path = require("path"), assert = require("assert");
const src = fs.readFileSync(path.join(__dirname, "..", "functions", "index.js"), "utf8");

const brace = (i) => { let j = src.indexOf("{", i), d = 0, k = j;
  for (; k < src.length; k++) { const c = src[k];
    if (c === "{") d++; else if (c === "}") { d--; if (!d) { k++; break; } } } return k; };
const take = (n) => { const i = src.indexOf("\nfunction " + n + "(");
  assert(i >= 0, "khong tim thay " + n); return src.slice(i, brace(i)); };
// Cat toi dau ';' o NGOAI moi ngoac. Lay indexOf(";") thang se cat giua than
// ham mui ten (hhmmToMin co 'return ...;' ben trong) -> code cut, vm no loi.
const takeConst = (n) => {
  const i = src.indexOf("\nconst " + n + " =");
  assert(i >= 0, "khong tim thay " + n);
  let d = 0, k = src.indexOf("=", i);
  for (; k < src.length; k++) {
    const c = src[k];
    if ("{[(".includes(c)) d++;
    else if ("}])".includes(c)) d--;
    else if (c === ";" && d === 0) { k++; break; }
  }
  return src.slice(i, k);
};

const ctx = { console, Date, Number, String, Math, Array };
ctx.globalThis = ctx; vm.createContext(ctx);
vm.runInContext([takeConst("ICT_MS"), takeConst("hhmmToMin"),
  take("ictNow"), take("ictPlusDays"), take("dueReminders")].join("\n"), ctx);
const call = (expr) => vm.runInContext(expr, ctx);

let fails = 0;
const ok = (n, f) => { try { f(); console.log("  OK   " + n); }
  catch (e) { fails++; console.log("  HONG " + n + "\n       " + e.message); } };

console.log("Nhac gio tap khach\n");

ok("doi sang gio VN dung, ke ca luc UTC con la hom truoc", () => {
  // 23:30 UTC ngay 04/10  ==  06:30 VN ngay 05/10
  const r = call('ictNow(new Date("2026-10-04T23:30:00Z"))');
  assert.strictEqual(r.date, "2026-10-05", "ngay VN sai: " + r.date);
  assert.strictEqual(r.minutes, 6 * 60 + 30, "phut sai: " + r.minutes);
});

ok("giua trua UTC van dung ngay", () => {
  const r = call('ictNow(new Date("2026-10-05T12:00:00Z"))');   // 19:00 VN
  assert.strictEqual(r.date, "2026-10-05");
  assert.strictEqual(r.minutes, 19 * 60);
});

ok("cong ngay khong lech mui gio", () => {
  assert.strictEqual(call('ictPlusDays("2026-10-05",1)'), "2026-10-06");
  assert.strictEqual(call('ictPlusDays("2026-12-31",1)'), "2027-01-01");
  assert.strictEqual(call('ictPlusDays("2026-02-28",1)'), "2026-03-01"); // 2026 khong nhuan
});

const LIST = JSON.stringify([
  { id: "a", startTime: "09:00", title: "Anh Ân" },
  { id: "b", startTime: "10:00", title: "Nam" },
  { id: "c", startTime: "17:00", title: "Sang" },
  { id: "d", startTime: "18:00", title: "Lee", remindedAt: "2026-10-05T10:30:00Z" },
]);

ok("8h30 -> chi nhac buoi 9h", () => {
  const r = call(`dueReminders(${LIST}, ${8 * 60 + 30}, 0)`);
  assert.strictEqual(r.length, 1, "ra " + r.length + " buoi");
  assert.strictEqual(r[0].booking.id, "a");
  assert.strictEqual(r[0].lead, 30);
});

ok("chay tre 3 phut van bat duoc buoi", () => {
  const r = call(`dueReminders(${LIST}, ${8 * 60 + 33}, 0)`);   // con 27 phut
  assert.strictEqual(r.length, 1, "lo mat buoi khi chay tre");
  assert.strictEqual(r[0].lead, 27);
});

ok("con 40 phut thi CHUA nhac, con 20 phut thi THOI", () => {
  assert.strictEqual(call(`dueReminders(${LIST}, ${8 * 60 + 20}, 0)`).length, 0, "nhac qua som");
  assert.strictEqual(call(`dueReminders(${LIST}, ${8 * 60 + 40}, 0)`).length, 0, "van nhac khi da sat gio");
});

ok("buoi da nhac roi thi khong nhac lai", () => {
  const r = call(`dueReminders(${LIST}, ${17 * 60 + 30}, 0)`);  // 17h30, buoi 18h cua Lee
  assert.strictEqual(r.length, 0, "nhac lai buoi da co remindedAt");
});

ok("buoi 0h15 sang mai duoc nhac tu 23h45 toi nay", () => {
  const mai = JSON.stringify([{ id: "x", startTime: "00:15", title: "Sớm" }]);
  // 23:45 hom nay, xet sang ngay mai -> dayOffset 1
  const r = call(`dueReminders(${mai}, ${23 * 60 + 45}, 1)`);
  assert.strictEqual(r.length, 1, "bo sot buoi dau gio sang hom sau");
  assert.strictEqual(r[0].lead, 30);
});

ok("buoi hom nay KHONG bi nhac lai khi quet sang ngay mai", () => {
  const r = call(`dueReminders(${LIST}, ${8 * 60 + 30}, 1)`);
  assert.strictEqual(r.length, 0, "cung mot buoi bi nhac hai lan");
});

ok("gio rac thi bo qua, khong lam do ca luot", () => {
  const rac = JSON.stringify([{ id: "z", startTime: "sang" }, { id: "y" },
    { id: "w", startTime: "09:00", title: "That" }]);
  const r = call(`dueReminders(${rac}, ${8 * 60 + 30}, 0)`);
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].booking.id, "w");
});

console.log(fails ? "\n" + fails + " PHEP KIEM HONG" : "\nTAT CA DAT");
process.exit(fails ? 1 : 0);
