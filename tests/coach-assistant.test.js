/**
 * Trợ lý coach: vòng lặp gọi tool, và mấy rào chắn không được phép trôi.
 *
 * Dùng một "Gemini" giả để điều khiển được kịch bản: lượt này đòi gọi tool gì,
 * lượt sau trả lời ra sao. Không gọi mạng, không tốn token.
 */
const path = require("path"), assert = require("assert");
const A = require(path.join(__dirname, "..", "functions", "assistant.js"));
const fs = require("fs");

let fails = 0; const cases = [];
const ok = (n, f) => cases.push([n, f]);

/** Gemini giả: nhận sẵn kịch bản từng lượt. */
function fakeClient(script) {
  let turn = 0;
  const seen = [];
  return {
    seen,
    interactions: {
      create: async (req) => {
        seen.push(req);
        const s = script[Math.min(turn++, script.length - 1)];
        return {
          steps: (s.calls || []).map((c, i) => ({
            type: "function_call", id: "c" + turn + "_" + i, name: c.name, arguments: c.args || {},
          })),
          output_text: s.text || "",
          usage: { input_tokens: 100, output_tokens: 20 },
        };
      },
    },
  };
}
const run = (script, opts) => A.runAssistant({
  client: fakeClient(script), model: "m",
  messages: [{ role: "user", text: "hỏi thử" }], ...opts,
});

console.log("Tro ly coach\n");

ok("khong goi tool thi tra loi thang", async () => {
  const r = await run([{ text: "chào" }]);
  assert.strictEqual(r.text, "chào");
  assert.strictEqual(r.toolLog.length, 0);
  assert.strictEqual(r.steps, 1);
});

ok("goi tool xong nhet ket qua lai roi tra loi", async () => {
  const c = fakeClient([
    { calls: [{ name: "list_clients" }] },
    { text: "có 19 khách" },
  ]);
  // runTool that se cham Firestore -> thay bang ban gia
  const realRunTool = A.runTool;
  const r = await A.runAssistant({
    client: c, model: "m", messages: [{ role: "user", text: "bao nhiêu khách" }],
  }).catch((e) => ({ err: e }));
  // Khong co Firestore nen tool se nem loi, nhung vong lap PHAI di tiep
  assert(!r.err, "vòng lặp chết khi tool lỗi: " + (r.err && r.err.message));
  assert.strictEqual(r.text, "có 19 khách");
  assert.strictEqual(r.toolLog.length, 1);
  assert.strictEqual(r.toolLog[0].name, "list_clients");
  assert.strictEqual(r.toolLog[0].empty, true, "tool lỗi phải bị đánh dấu empty");
  // luot 2 phai thay ca function_call lan function_result trong input
  const input2 = c.seen[1].input;
  assert(input2.some((s) => s.type === "function_call"), "thiếu bước function_call trong input lượt 2");
  const res = input2.find((s) => s.type === "function_result");
  assert(res, "thiếu function_result");
  assert(res.call_id, "function_result phải có call_id khớp lệnh gọi");
  assert.strictEqual(typeof res.result, "string", "result phải là chuỗi");
  void realRunTool;
});

ok("doi tool mai thi dung o tran, khong lap vo han", async () => {
  const r = await run([{ calls: [{ name: "list_clients" }] }]);   // lượt nào cũng đòi gọi
  assert.strictEqual(r.steps, A.MAX_STEPS, "chạy " + r.steps + " vòng, trần là " + A.MAX_STEPS);
  assert(r.hitLimit, "phải đánh dấu chạm trần");
  assert(/hỏi hẹp lại/i.test(r.text), "phải nói ra là cần hỏi hẹp hơn, text=" + r.text);
});

ok("khach dang mo duoc nhet vao dau hoi thoai", async () => {
  const c = fakeClient([{ text: "ok" }]);
  await A.runAssistant({ client: c, model: "m", clientId: "kem",
    messages: [{ role: "user", text: "giáo án sao" }] });
  const first = JSON.stringify(c.seen[0].input);
  assert(/kem/.test(first), "không truyền clientId vào ngữ cảnh");
});

ok("tool duoc khai bao dung hinh dang SDK", () => {
  assert(A.TOOLS.length >= 6, "chỉ có " + A.TOOLS.length + " tool");
  for (const t of A.TOOLS) {
    assert.strictEqual(t.type, "function", t.name + ": type phải là 'function'");
    assert(t.name && t.description, t.name + ": thiếu tên hoặc mô tả");
    assert(t.parameters && t.parameters.type === "object", t.name + ": parameters phải là object schema");
  }
  const names = A.TOOLS.map((t) => t.name);
  assert.strictEqual(new Set(names).size, names.length, "có tool trùng tên");
});

ok("ban 1 KHONG duoc co tool nao ghi du lieu", () => {
  const bad = A.TOOLS.filter((t) => /^(set|save|apply|update|delete|push|write|create)_/.test(t.name));
  assert.strictEqual(bad.length, 0, "có tool ghi lọt vào bản chỉ đọc: " + bad.map((t) => t.name));
  // Bỏ lời gọi Gemini ra trước: interactions.create() không phải ghi Firestore,
  // để nguyên thì phép kiểm báo động giả và sẽ bị ai đó gỡ đi cho đỡ phiền.
  const srcFile = fs.readFileSync(path.join(__dirname, "..", "functions", "assistant.js"), "utf8")
    .replace(/interactions\.create\(/g, "");
  for (const m of [".set(", ".update(", ".delete(", ".add(", ".create(", "batch(", "runTransaction"]) {
    assert(!srcFile.includes(m), "assistant.js có lệnh ghi Firestore: " + m);
  }
});

ok("rao chan nam trong chi dan he thong", () => {
  const s = A.SYSTEM;
  assert(/SessionA/.test(s), "thiếu luật khoá giáo án SessionA/B/C");
  assert(/Mon\/Wed\/Fri/.test(s), "thiếu cảnh báo định dạng cũ làm treo app");
  assert(/thâm hụt calo/i.test(s), "thiếu luật trẻ vị thành niên");
  assert(/18 tuổi/.test(s), "thiếu ngưỡng tuổi");
  assert(/không phải bác sĩ/i.test(s), "thiếu giới hạn y tế");
  assert(/bịa|đoán/i.test(s), "thiếu luật không bịa");
});

ok("progSummary dem dung so bai", () => {
  const prog = {
    SessionA: { label: "A", phases: [{ exercises: [1, 2, 3] }, { exercises: [4] }] },
    SessionB: { label: "B", phases: [] },
  };
  const s = A.progSummary(prog);
  assert.deepStrictEqual(s.map((x) => x.exercises), [4, 0]);
  assert.deepStrictEqual(s.map((x) => x.day), ["SessionA", "SessionB"]);
  assert.deepStrictEqual(A.progSummary(null), []);
});

// ── _aiFmt: dung bang va chan the la ─────────────────────────────────
const idx = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const grabFn = (n) => { const i = idx.indexOf("function " + n + "(");
  assert(i >= 0, "khong tim thay " + n);
  let j = idx.indexOf("{", i), d = 0, k = j;
  for (; k < idx.length; k++) { const c = idx[k];
    if (c === "{") d++; else if (c === "}") { d--; if (!d) { k++; break; } } }
  return idx.slice(i, k); };
const escHtml = (x) => String(x == null ? "" : x)
  .replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const aiFmt = new Function("escHtml", grabFn("_aiFmt") + "; return _aiFmt;")(escHtml);

ok("bang markdown dung thanh <table> that", () => {
  const out = aiFmt("| Buổi | Bài |\n|---|---|\n| SessionA | Squat |\n| SessionB | Hinge |");
  assert(/<table class="ai-tb">/.test(out), "khong dung bang");
  assert(!out.includes("---"), "con sot hang phan cach |---|");
  assert.strictEqual((out.match(/<tr>/g) || []).length, 3, "sai so hang");
  assert.strictEqual((out.match(/<th>/g) || []).length, 2, "sai so cot tieu de");
});

ok("van ban thuong van xuong dong, in dam van chay", () => {
  const out = aiFmt("dòng một\ndòng hai **đậm**");
  assert(/dòng một<br>dòng hai/.test(out), "mat xuong dong: " + out);
  assert(out.includes("<b>đậm</b>"));
});

ok("the la bi chan, ke ca trong o bang", () => {
  for (const bad of [
    '<img src=x onerror=alert(1)>',
    '<script>alert(1)</script>',
    '| cột | <script>alert(1)</script> |\n|---|---|\n| a | <img src=x onerror=alert(1)> |',
  ]) {
    const out = aiFmt(bad);
    assert(!/<script/i.test(out), "lot the script: " + out.slice(0, 80));
    assert(!/<img/i.test(out), "lot the img: " + out.slice(0, 80));
    assert(!/onerror/i.test(out) || !/<[a-z]+[^>]*onerror/i.test(out),
      "lot thuoc tinh onerror: " + out.slice(0, 80));
  }
});

ok("khong co bang thi khong sinh the table rong", () => {
  assert(!/<table/.test(aiFmt("chỉ là chữ thường")));
  assert(!/<table/.test(aiFmt("")));
});

(async () => {
  for (const [n, f] of cases) {
    try { await f(); console.log("  OK   " + n); }
    catch (e) { fails++; console.log("  HONG " + n + "\n       " + e.message); }
  }
  console.log(fails ? "\n" + fails + " PHEP KIEM HONG" : "\nTAT CA DAT");
  process.exit(fails ? 1 : 0);
})();
process.on("unhandledRejection", (e) => {
  console.log("  HONG (loi lot ra ngoai) " + (e && e.message)); process.exit(1); });
