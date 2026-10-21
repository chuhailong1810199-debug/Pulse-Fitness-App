/**
 * Youth development trong Pulse (2026-10-22): khung YOUTH_METHOD theo giáo án Antony đã duyệt, server chặn
 * tiếp đất vượt mức / bài vượt mức / 1RM với khách < 18 tuổi, form có kiểu buổi youth + mức plyo.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const A = require('../functions/assistant.js');
const C = require('../functions/program-check.js');
const ex = (n, s, cue) => ({ name: n, setsReps: s, ...(cue ? { cue } : {}) });

const ANTONY = {
  SessionA: { phases: [{ tag: 'warmup', name: 'w', exercises: [ex('Landing Drill — Drop Squat & Stick', '2 × 5')] },
    { tag: 'strength', name: '⚡ Plyometric', exercises: [ex('Box Jump', '3 × 4'), ex('Front Toss (Med Ball)', '3 × 6')] }] },
  SessionB: { phases: [{ tag: 'strength', name: '⚡ Plyometric', exercises: [ex('Slam (Med Ball)', '3 × 6'), ex('Med Ball Side Throw (Med Ball)', '3 × 5/side')] }] },
};

test('giao an Antony da duyet qua o muc 1: 12 lan tiep dat buoi A, 0 buoi B, drill khoi dong khong tinh', () => {
  const r = C.youthIssues(ANTONY, 1);
  assert.deepStrictEqual(r.errors, []);
  assert.deepStrictEqual(r.contacts, { SessionA: 12, SessionB: 0 });
});

test('chan: vuot tran tiep dat, bai vuot muc, 1RM / toi that bai; nhac khi 2 buoi deu bat nhay', () => {
  const many = { SessionA: { phases: [{ tag: 'strength', name: 'p', exercises: [ex('Box Jump', '5 × 8')] }] } };   // 40 > 30
  assert.ok(C.youthIssues(many, 1).errors.some((e) => e.k === 'ycap:SessionA'));
  assert.deepStrictEqual(C.youthIssues(many, 2).errors, [], 'muc 2 tran 60');
  const lv = { SessionA: { phases: [{ tag: 'strength', name: 'p', exercises: [ex('Depth Jump', '2 × 3'), ex('Pogo Hops', '2 × 10')] }] } };
  const ks = C.youthIssues(lv, 1).errors.map((e) => e.k);
  assert.ok(ks.includes('ylv:SessionA:Depth Jump') && ks.includes('ylv:SessionA:Pogo Hops'));
  assert.ok(C.youthIssues({ SessionA: { phases: [{ tag: 'warmup', name: 'w', exercises: [ex('Box Jump', '1 × 3')] }] } }, 0).errors.length === 0,
    'trong khoi dong khong tinh');
  assert.ok(C.youthIssues({ SessionA: { phases: [{ tag: 'strength', name: 's', exercises: [ex('Leg Press', '3 × 5', 'Test 1RM tuần 4')] }] } }, 1)
    .errors.some((e) => e.k.startsWith('y1rm')));
  const both = { SessionA: ANTONY.SessionA, SessionB: { phases: [{ tag: 'strength', name: 'p', exercises: [ex('Squat Jump', '3 × 4')] }] } };
  assert.ok(C.youthIssues(both, 1).warnings.length === 1);
  assert.strictEqual(C.contacts('3 × 5/side'), 30);
  assert.strictEqual(C.contacts('3 × 40s', 'Jump Squat'), 72, 'bat lien tuc ~0.6 lan/giay');
  assert.strictEqual(C.contacts('2 × 20s', 'Jump Rope'), 60, 'nhay day ~1.5 lan/giay');
  // "Wood Chop" khong phai bai bat (tung bi dem la "hop").
  assert.deepStrictEqual(C.youthIssues({ SessionA: { phases: [{ tag: 'accessories', name: 'c', exercises: [ex('Half Kneeling Wood Chop (Med Ball)', '3 × 10')] }] } }, 0).errors, []);
});

test('checkProgram chi ap khung youth khi khach < 18', () => {
  const big = { SessionA: { phases: [{ tag: 'strength', name: 'p', exercises: [ex('Depth Jump', '3 × 5')] }] } };
  assert.ok(C.checkProgram(big, { level: 'Advanced', minor: true, plyoLevel: 1 }).errors.some((e) => e.k.startsWith('ylv')));
  assert.ok(!C.checkProgram(big, { level: 'Advanced' }).errors.some((e) => /^y/.test(e.k)));
});

test('prompt Pulse co khung YOUTH DEVELOPMENT + mau Antony; tool nhan plyoLevel + age', () => {
  assert.match(A.SYSTEM, /YOUTH DEVELOPMENT/);
  assert.match(A.YOUTH_METHOD, /MỨC PLYOMETRIC/);
  assert.match(A.YOUTH_METHOD, /Landing Drill/);
  assert.match(A.YOUTH_METHOD, /Antony/);
  const pp = A.TOOLS.find((t) => t.name === 'propose_program').parameters.properties;
  const pn = A.TOOLS.find((t) => t.name === 'propose_new_client').parameters.properties;
  assert.ok(pp.plyoLevel && pn.plyoLevel && pn.age);
});

test('nhan dien khach < 18: tuoi baseline, ngay sinh, hoac "15 tuoi" trong ghi chu', async () => {
  const mk = (base, prof) => ({ collection: () => ({ doc: () => ({ collection: (n) => ({ doc: () => ({ get: async () =>
    (n === 'assessment' ? (base ? { exists: true, data: () => base } : { exists: false }) : (prof ? { exists: true, data: () => prof } : { exists: false })) }) }) }) }) });
  assert.strictEqual(await A.isMinorClient(mk({ age: 15 }), 'x', {}), true);
  assert.strictEqual(await A.isMinorClient(mk({ age: 27 }), 'x', {}), false);
  assert.strictEqual(await A.isMinorClient(mk(null, { dob: '2012-03-01' }), 'x', {}), true);
  assert.strictEqual(await A.isMinorClient(mk(null, null), 'x', { notes: '⚠️ 15 TUỔI — 1m60' }), true, 'chu hoa "TUOI" van nhan');
  assert.strictEqual(await A.isMinorClient(mk(null, null), 'x', { notes: 'Nam 48 tuổi' }), false);
  assert.strictEqual(await A.isMinorClient(mk(null, null), 'x', { goal: 'Fat loss (15 tuổi — KHÔNG ép thâm hụt calo)' }), true);
});

test('form khach moi: kieu buoi youth + muc plyo; duoi 18 tuoi tu bat khung youth', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const a = html.indexOf('function aiBuildProgramPrompt'), b = html.indexOf('function aiFormSend');
  const build = new Function('escHtml', html.slice(a, b) + '; return aiBuildProgramPrompt;')((x) => x);
  const r = build({ name: 'Bin', goal: 'phát triển thể chất', age: '13', spw: '2', dur: '60 phút' });
  assert.match(r.prompt, /YOUTH DEVELOPMENT/);
  assert.match(r.prompt, /Truyền age: 13/);
  const p1 = build({ name: 'Bin', goal: 'x', style: 'youth', plyo: '1' });
  assert.match(p1.prompt, /Mức plyo 1 \(truyền plyoLevel: 1\)/);
  const adult = build({ name: 'Tú', goal: 'x', age: '30' });
  assert.doesNotMatch(adult.prompt, /YOUTH DEVELOPMENT/);
  assert.match(html, /<option value="youth">/);
  assert.match(html, /rows\.push\(\['Plyo \(youth\)'/);
});
