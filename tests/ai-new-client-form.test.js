/**
 * Form "Soạn giáo án cho khách mới" trong khung trợ lý: prompt app tự dựng
 * phải giữ đúng các luật của trợ lý — khoá SessionA/B/C, không bịa Gmail,
 * gửi duyệt qua propose_new_client.
 */
const fs = require("fs"), path = require("path"), assert = require("assert");
const s = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

let fails = 0;
const ok = (n, f) => { try { f(); console.log("  OK   " + n); }
  catch (e) { fails++; console.log("  HONG " + n + "\n       " + e.message); } };

const i = s.indexOf("function aiBuildProgramPrompt(");
const j = s.indexOf("\nfunction aiFormSend(", i);
const build = new Function(s.slice(i, j) + "\nreturn aiBuildProgramPrompt;")();

console.log("Form khach moi trong tro ly\n");

ok("thieu ten hoac muc tieu thi bao loi, khong gui", () => {
  assert(build({ goal: "giảm mỡ" }).error);
  assert(build({ name: "An" }).error);
});

ok("gmail sai dinh dang thi bao loi", () => {
  assert(build({ name: "An", goal: "x", email: "abc" }).error);
});

ok("khoa buoi dung SessionA.. theo so buoi", () => {
  const r = build({ name: "An", goal: "giảm mỡ", spw: "4" });
  assert(/SessionA, SessionB, SessionC, SessionD\./.test(r.prompt), r.prompt);
  assert(!/Mon|Wed|Fri/.test(r.prompt));
});

ok("khong co gmail thi dan khong bia", () => {
  const r = build({ name: "An", goal: "giảm mỡ" });
  assert(/KHÔNG bịa/.test(r.prompt));
  assert(/propose_new_client/.test(r.prompt));
});

ok("co gmail thi dua vao, viet thuong", () => {
  const r = build({ name: "An", goal: "x", email: "  Ab@Gmail.com " });
  assert(/ab@gmail\.com/.test(r.prompt) && !/Ab@Gmail/.test(r.prompt));
});

ok("benh ly trong = CHUA GHI, khong phai khoe manh", () => {
  assert(/CHƯA GHI/.test(build({ name: "An", goal: "x" }).prompt));
});

ok("duoi 18 tuoi thi them luu y", () => {
  assert(/DƯỚI 18/.test(build({ name: "An", goal: "x", age: "15" }).prompt));
  assert(!/DƯỚI 18/.test(build({ name: "An", goal: "x", age: "30" }).prompt));
});

ok("bong bong hien ban rut gon, khong phai ca prompt", () => {
  const r = build({ name: "An", goal: "giảm mỡ", spw: "2", level: "Beginner" });
  assert(r.show.length < 120 && /An/.test(r.show));
  assert(/escHtml\(m\.show \|\| m\.text\)/.test(s));
});

ok("tra ve email de bu khi model quen truyen", () => {
  assert.strictEqual(build({ name: "An", goal: "x", email: "A@b.com" }).email, "a@b.com");
});

ok("the tao khach co o nhap Gmail, khong chi la chu", () => {
  const c = s.slice(s.indexOf("function _aiCard("), s.indexOf("async function aiApprove("));
  assert(/class="ai-cf-em"/.test(c), "the tao khach thieu o nhap Gmail — khach se khong dang nhap duoc");
  assert(/oninput="aiCardEmail\(/.test(c));
});

ok("Gmail tu form duoc dien vao de xuat neu model bo sot", () => {
  assert(/kind === 'create_client' && !p\.action\.email && _aiFormEmail/.test(s));
});

ok("duyet thi kiem dinh dang Gmail truoc khi goi coachApply", () => {
  const a = s.slice(s.indexOf("async function aiApprove("), s.indexOf("function aiReject("));
  assert(a.indexOf("Gmail không hợp lệ") >= 0 && a.indexOf("Gmail không hợp lệ") < a.indexOf("coachApply"));
});

console.log(fails ? "\n" + fails + " HONG" : "\nTAT CA DAT");
process.exit(fails ? 1 : 0);
