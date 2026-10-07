/** Xác nhận đã trả: hoá đơn + hạn dùng ghi trong MỘT batch, và không bấm đúp được. */
const fs = require("fs"), path = require("path"), assert = require("assert");
const s = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
let fails = 0;
const ok = (n, f) => { try { f(); console.log("  OK   " + n); }
  catch (e) { fails++; console.log("  HONG " + n + "\n       " + e.message); } };
const i = s.indexOf("async function billConfirm(");
const fn = s.slice(i, s.indexOf("\n}\n", i));
console.log("Xac nhan thanh toan\n");
ok("ghi bang batch, mot lan commit", () => {
  assert(/writeBatch\(db\)/.test(fn) && /batch\.commit\(\)/.test(fn));
  assert(/batch\.set\([^;]*invoices/.test(fn), "hoá đơn phải nằm trong batch");
  assert(/batch\.update\(doc\(db, 'clients'/.test(fn), "hạn dùng phải nằm trong batch");
});
ok("khong con ghi roi setDoc/updateDoc", () =>
  assert(!/await setDoc\(|await updateDoc\(/.test(fn), "còn lần ghi rời ngoài batch"));
ok("chan bam dup", () => {
  assert(/if \(_billConfirming\) return;/.test(fn));
  assert(/finally \{ _billConfirming = null; \}/.test(s.slice(i, i + 4000)), "phải nhả khoá trong finally");
});
console.log(fails ? "\n" + fails + " HONG" : "\nTAT CA DAT");
process.exit(fails ? 1 : 0);
