/**
 * Tab nào chỉ coach được thấy thì phải chặn ở ĐƯỜNG VÀO, không chỉ giấu nút.
 *
 * Giấu tab là trang trí: showPage còn gọi được từ console, từ một nút cũ còn
 * sót, hay từ link sâu. Cho nên mỗi tab coach-only cần đủ ba thứ: ẩn sẵn
 * trong HTML, chỉ bật trong nhánh coach, và showPage từ chối khi không phải
 * coach.
 */
const fs = require("fs"), vm = require("vm"), path = require("path"), assert = require("assert");
const s = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

let fails = 0;
const ok = (n, f) => { try { f(); console.log("  OK   " + n); }
  catch (e) { fails++; console.log("  HONG " + n + "\n       " + e.message); } };

const navStart = s.indexOf('<div class="nav">');
const nav = s.slice(navStart, s.indexOf("</div>\n", navStart + 2000));
const tabs = [...nav.matchAll(/<div class="nav-tab[^"]*"([^>]*)>([^<]*)</g)]
  .map((m) => ({ attrs: m[1], label: m[2].trim() }));

console.log("Phan quyen tab\n");

ok("doc duoc thanh tab", () => {
  assert(tabs.length >= 10, "chi doc duoc " + tabs.length + " tab");
});

// Youth là pin test của coach. Khách không được thấy, không được vào.
ok("tab Youth an san trong HTML", () => {
  const t = tabs.find((x) => x.label === "Youth");
  assert(t, "khong con tab Youth");
  assert(/id="youth-nav-tab"/.test(t.attrs), "tab Youth chua co id de bat/tat");
  assert(/display:none/.test(t.attrs), "tab Youth van hien san cho moi nguoi");
});

ok("showPage tu choi 'youth' khi khong phai coach", () => {
  const i = s.indexOf("function showPage(page)");
  let j = s.indexOf("{", i), d = 0, k = j;
  for (; k < s.length; k++) { const c = s[k];
    if (c === "{") d++; else if (c === "}") { d--; if (!d) { k++; break; } } }
  const fn = s.slice(i, k);

  // Chạy NGUYÊN hàm, mọi hàm render/load chưa khai báo đều thành no-op.
  // Bản đầu cắt đuôi hàm bằng regex /if \(page === .../ — mà chốt chặn mới
  // đứng ngay đầu hàm cũng khớp mẫu đó, nên nó xén luôn toàn bộ phần thân và
  // phép kiểm báo "coach cũng không mở được". Lỗi ở bộ đo, không ở code.
  const run = (role) => {
    const seen = [];
    const noop = () => {};
    const base = { console, userRole: role, Promise, Object, Array, String,
      document: {
        querySelectorAll: () => [],
        getElementById: (id) => ({ classList: { toggle: (c, on) => {
          if (id === "youth-page" && on) seen.push(id); } } }),
      } };
    const ctx = new Proxy(base, {
      has: () => true,
      get: (t, k) => (k in t ? t[k] : noop),
      set: (t, k, v) => { t[k] = v; return true; },
    });
    vm.createContext(ctx);
    vm.runInContext(fn, ctx);
    vm.runInContext("showPage('youth')", ctx);
    return seen;
  };
  assert.strictEqual(run("client").length, 0, "khach van mo duoc trang youth");
  assert.strictEqual(run("coach").length, 1, "coach lai khong mo duoc trang youth");
});

ok("loadYouthData tu choi khi khong phai coach", () => {
  const i = s.indexOf("async function loadYouthData(");
  const body = s.slice(i, s.indexOf("\n}", i));
  assert(/userRole !== 'coach'\)\s*return;/.test(body),
    "loadYouthData thieu chot chan vai tro");
});

// Nhóm tab chỉ coach: phải ẩn sẵn và chỉ được bật ở đúng một chỗ.
for (const [label, id] of [["Youth", "youth-nav-tab"],
                           ["Schedule", "schedule-nav-tab"],
                           ["Dashboard", "dash-nav-tab"]]) {
  ok("tab " + label + " chi bat o dung mot cho", () => {
    const n = (s.match(new RegExp("getElementById\\('" + id + "'\\)", "g")) || []).length;
    assert.strictEqual(n, 1, id + " duoc dong vao " + n + " cho");
  });
}

// Những tab khách PHẢI còn thấy — đừng ẩn nhầm cả nhà.
ok("tab cua khach van hien binh thuong", () => {
  for (const label of ["Workout", "Progress", "Nutrition", "Billing", "Log"]) {
    const t = tabs.find((x) => x.label === label);
    assert(t, "mat tab " + label);
    assert(!/display:none/.test(t.attrs), "tab " + label + " bi an nham khoi khach");
  }
});

console.log(fails ? "\n" + fails + " PHEP KIEM HONG" : "\nTAT CA DAT");
process.exit(fails ? 1 : 0);
