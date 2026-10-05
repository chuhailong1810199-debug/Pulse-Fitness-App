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

ok("khong tool nao ghi thang — chi duoc de xuat", () => {
  // Tool ghi thang bi cam. Muon doi du lieu thi phai la propose_* -> coach duyet.
  const bad = A.TOOLS.filter((t) => /^(set|save|apply|update|delete|push|write|create)_/.test(t.name));
  assert.strictEqual(bad.length, 0, "có tool ghi thẳng, phải đổi thành propose_: " + bad.map((t) => t.name));
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

// ── Toc do ───────────────────────────────────────────────────────────
ok("nhieu tool trong mot luot chay SONG SONG, khong cong don thoi gian", () => {
  // Kiem tren ma nguon: runTool duoc goi ben trong runAssistant nen khong
  // thay the tu ngoai duoc, ma do thoi gian that thi phep kiem se chap chon.
  const src = fs.readFileSync(path.join(__dirname, "..", "functions", "assistant.js"), "utf8");
  const i = src.indexOf("const calls = ");
  assert(i >= 0, "khong tim thay vong lap tool");
  const loop = src.slice(i, i + 2200);
  assert(/Promise\.all\(calls\.map\(/.test(loop),
    "cac tool van chay tuan tu — phai dung Promise.all(calls.map(...))");
  assert(!/for \(const c of calls\)[\s\S]{0,200}await runTool/.test(loop),
    "van con vong for-await goi runTool tuan tu");
});

ok("ket qua tool nhet lai dung THU TU model da hoi", async () => {
  const c = fakeClient([
    { calls: [{ name: "get_program" }, { name: "list_clients" }] },
    { text: "xong" },
  ]);
  await A.runAssistant({ client: c, model: "m", messages: [{ role: "user", text: "x" }] });
  const res = c.seen[1].input.filter((x) => x.type === "function_result");
  assert.strictEqual(res.length, 2);
  assert.strictEqual(res[0].name, "get_program", "sai thu tu — chay song song khong duoc lam loan thu tu");
  assert.strictEqual(res[1].name, "list_clients");
});

ok("muc suy luan duoc dat, khong de mac dinh (Gemini 3 nghi rat dai)", async () => {
  const c = fakeClient([{ calls: [{ name: "list_clients" }] }, { text: "xong" }]);
  await A.runAssistant({ client: c, model: "m", messages: [{ role: "user", text: "x" }] });
  for (const req of c.seen) {
    assert(req.generation_config && req.generation_config.thinking_level,
      "khong dat thinking_level — se dung mac dinh suy luan dai");
  }
  assert.strictEqual(c.seen[0].generation_config.thinking_level, A.THINK_DISPATCH,
    "luot dau phai la muc dispatch");
  assert.strictEqual(c.seen[1].generation_config.thinking_level, A.THINK_COMPOSE,
    "luot sau phai la muc compose");
  for (const lv of [A.THINK_DISPATCH, A.THINK_COMPOSE]) {
    assert(["minimal", "low", "medium", "high"].includes(lv), "muc suy luan la: " + lv);
  }
});

ok("thu vien bai tap co cache, khong doc 360 bai moi lan", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "functions", "assistant.js"), "utf8");
  assert(/function exerciseLibrary/.test(src), "thieu ham cache thu vien");
  assert(/_exCache/.test(src), "thieu bien cache");
  // search_exercises khong duoc goi thang collection("exercises").get()
  const i = src.indexOf('name === "search_exercises"');
  const blk = src.slice(i, i + 700);
  assert(!/collection\("exercises"\)/.test(blk),
    "search_exercises van doc thang ca kho, khong qua cache");
  assert(/exerciseLibrary\(/.test(blk), "search_exercises chua dung cache");
});

// ── Duong di cua de xuat tu server ra may khach ──────────────────────
// Bug that: callable chi chuyen tiep text/toolLog/steps/hitLimit nen `pending`
// bi roi, server dung de xuat dung ma the duyet khong bao gio hien ra.
ok("shapeReply chuyen tiep pending — the duyet phai toi duoc may khach", () => {
  const r = A.shapeReply({
    text: "ok", toolLog: [{ name: "propose_new_client" }],
    pending: [{ action: { kind: "create_client", clientId: "vy_1" }, preview: { name: "Vy" } }],
    steps: 2,
  });
  assert.strictEqual(r.pending.length, 1, "pending bi roi tren duong ve may khach");
  assert.strictEqual(r.pending[0].action.kind, "create_client");
  assert.strictEqual(r.pending[0].preview.name, "Vy");
});

ok("shapeReply khong vo khi thieu truong", () => {
  for (const bad of [null, undefined, {}, { text: "x" }]) {
    const r = A.shapeReply(bad);
    assert(Array.isArray(r.pending), "pending phai luon la mang");
    assert(Array.isArray(r.toolLog), "toolLog phai luon la mang");
    assert.strictEqual(typeof r.text, "string");
    assert.strictEqual(typeof r.hitLimit, "boolean");
  }
});

ok("callable PHAI di qua shapeReply, khong liet ke tay tung truong", () => {
  const idxSrc = fs.readFileSync(path.join(__dirname, "..", "functions", "index.js"), "utf8");
  const i = idxSrc.indexOf("exports.coachAssistant");
  assert(i >= 0, "khong tim thay coachAssistant");
  const body = idxSrc.slice(i, i + 4000);
  assert(/return shapeReply\(/.test(body), "coachAssistant khong dung shapeReply");
  assert(!/return \{ text: r\.text/.test(body), "van con liet ke tay tung truong — de roi truong moi");
});

// ── Bo kiem truoc khi ghi ────────────────────────────────────────────
// Day la chot chan DUY NHAT giua model va du lieu that cua 19 khach.
const goodProg = {
  SessionA: { label: "A", phases: [{ name: "Strength", tag: "strength",
    exercises: [{ name: "Goblet Squat", setsReps: "3 × 8-10", tempo: "3-1-1" }] }] },
};

ok("giao an dung dinh dang thi qua", () => {
  const v = A.validateProgram(goodProg);
  assert(v.ok, v.errors.join(" | "));
  assert.strictEqual(v.stats.days, 1);
  assert.strictEqual(v.stats.exercises, 1);
});

ok("khoa Mon/Wed/Fri BI CHAN (dinh dang nay lam treo app)", () => {
  const v = A.validateProgram({ Mon: goodProg.SessionA, Wed: goodProg.SessionA });
  assert(!v.ok, "dinh dang cu lot qua duoc");
  assert(/SessionA/.test(v.errors.join(" ")), "loi phai noi ro phai dung SessionA");
  assert(/treo/.test(v.errors.join(" ")), "loi phai noi ro hau qua");
});

ok("giao an thieu truong thi bi chan, va noi ro thieu gi", () => {
  const cases2 = [
    [{}, /rỗng/],
    [{ SessionA: {} }, /thiếu phases/],
    [{ SessionA: { phases: [] } }, /thiếu phases/],
    [{ SessionA: { phases: [{ name: "P", exercises: [] }] } }, /không có bài/],
    [{ SessionA: { phases: [{ name: "P", exercises: [{ name: "Squat" }] }] } }, /thiếu set/],
    [{ SessionA: { phases: [{ name: "P", exercises: [{ setsReps: "3 × 8" }] }] } }, /thiếu tên bài/],
    [null, /object/],
  ];
  for (const [prog, re] of cases2) {
    const v = A.validateProgram(prog);
    assert(!v.ok, "lot qua: " + JSON.stringify(prog));
    assert(re.test(v.errors.join(" ")), "loi khong ro rang cho " + JSON.stringify(prog)
      + " -> " + v.errors.join(" | "));
  }
});

ok("khach moi KHONG duoc mang email, ke ca dia chi giu cho", () => {
  for (const em of ["placeholder@gmail.com", "a@b.com", "  x@y.com  "]) {
    const v = A.validateNewClient({ name: "Minh", email: em });
    assert(!v.ok, "email '" + em + "' lot qua");
    assert(/một Gmail một khách/.test(v.errors.join(" ")), "loi phai giai thich vi sao");
  }
  assert(A.validateNewClient({ name: "Minh" }).ok, "khong email thi phai qua");
  assert(A.validateNewClient({ name: "Minh", email: "" }).ok, "email rong phai qua");
});

ok("khach moi: kiem trinh do va so buoi", () => {
  assert(!A.validateNewClient({ name: "A", level: "Pro" }).ok, "trinh do la lot qua");
  assert(A.validateNewClient({ name: "A", level: "Advanced" }).ok);
  for (const n of [0, 8, 2.5, -1]) {
    assert(!A.validateNewClient({ name: "A", sessionsPerWeek: n }).ok, "so buoi " + n + " lot qua");
  }
  assert(A.validateNewClient({ name: "A", sessionsPerWeek: 3 }).ok);
  assert(!A.validateNewClient({ name: "" }).ok, "thieu ten lot qua");
});

ok("khach moi kem giao an hong thi bi chan theo", () => {
  const v = A.validateNewClient({ name: "A", program: { Mon: { phases: [] } } });
  assert(!v.ok, "giao an hong trong khach moi lot qua");
});

ok("makeClientId bo dau tieng Viet, khong sinh id la", () => {
  assert.strictEqual(A.makeClientId("Nguyễn Đức Minh", 123), "nguyen_duc_minh_123");
  assert.strictEqual(A.makeClientId("Chị Tâm", 1), "chi_tam_1");
  assert.strictEqual(A.makeClientId("", 7), "client_7");
  assert(/^[a-z0-9_]+$/.test(A.makeClientId("A!!! @#$ B", 9)), "id co ky tu la");
});

ok("tool de xuat KHONG tu ghi — chi dung action cho coach duyet", () => {
  const names = A.TOOLS.map((t) => t.name);
  assert(names.includes("propose_program"), "thieu propose_program");
  assert(names.includes("propose_new_client"), "thieu propose_new_client");
  // van khong duoc co lenh ghi Firestore nao trong assistant.js
  const srcFile = fs.readFileSync(path.join(__dirname, "..", "functions", "assistant.js"), "utf8")
    .replace(/interactions\.create\(/g, "");
  for (const m of [".set(", ".update(", ".delete(", ".add(", ".create(", "batch(", "runTransaction"]) {
    assert(!srcFile.includes(m), "assistant.js co lenh ghi Firestore: " + m);
  }
});

ok("prompt cam noi 'da luu' khi moi chi la de xuat", () => {
  assert(/không nói "đã lưu"|TUYỆT ĐỐI không nói/.test(A.SYSTEM),
    "thieu luat cam bao da luu");
  assert(/duyệt/.test(A.SYSTEM), "thieu khai niem cho duyet");
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
