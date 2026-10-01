/**
 * Firebase Cloud Functions — Fitness App
 *
 * notifyNewLead: triggers on new /leads/{leadId} document creation and sends
 *   an email notification to the coach.
 *
 * generateProgram: HTTPS Callable — takes client info, calls Claude API,
 *   returns a structured 4-week training program JSON.
 *
 * Setup secrets (run once):
 *   firebase functions:secrets:set SMTP_USER
 *   firebase functions:secrets:set SMTP_PASS
 *   firebase functions:secrets:set GROQ_API_KEY
 *
 * Deploy:
 *   cd functions && npm install
 *   firebase deploy --only functions
 */

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule }         = require("firebase-functions/v2/scheduler");
const { defineSecret }       = require("firebase-functions/params");
const { onRequest }          = require("firebase-functions/v2/https");
const { initializeApp }      = require("firebase-admin/app");
const { getFirestore }       = require("firebase-admin/firestore");
const nodemailer             = require("nodemailer");
const { Groq }               = require("groq-sdk");

initializeApp();

const SMTP_USER      = defineSecret("SMTP_USER");
const SMTP_PASS      = defineSecret("SMTP_PASS");
const GROQ_API_KEY   = defineSecret("GROQ_API_KEY");
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const POLAR_TOKEN    = defineSecret("POLAR_TOKEN");
const POLAR_WEBHOOK_SECRET = defineSecret("POLAR_WEBHOOK_SECRET");

const COACH_EMAIL = "chuhailong1810199@gmail.com";
const APP_NAME = "Striveo";

// ─────────────────────────────────────────────────────────────────────────────
// SHARED GOAL GUIDANCE — used by both generateProgram and pulseGenerateFree
// ─────────────────────────────────────────────────────────────────────────────
const GOAL_GUIDANCE = {
  fatLoss:
    `Fat Loss + Recomposition. PRINCIPLE: strength-focused to preserve muscle + smart cardio. NOT light weight + high reps.

EXERCISES: Compounds (Squat, RDL, Bench, OHP, Row, Pull-Up) + Accessories (Leg Curl, Lateral Raise, Face Pull, Tricep, Bicep, Cable Fly) + 1 unilateral/core per session + Conditioning Finisher MANDATORY.

INTENSITY — TWO TIERS per session (never uniform reps):
- 1st compound (top set): 4–6 reps, 80–85% 1RM, RPE 8–9, 2–3 min rest
- 2nd–3rd compound (back-off): 8–10 reps, 70–75% 1RM, RPE 7–8, 90s rest
- Accessories: 10–15 reps, RPE 7–8, 60–90s rest

PROGRESSIVE OVERLOAD in cue: "+2.5kg when 6 clean reps × 2 sessions (top set)". Back-off: reps first then load. Strength maintained = muscle preserved.

ANTI-REDUNDANCY RULES:
- PUSH: Bench + OHP + 1 chest isolation (Cable Fly). Max 2 presses. No Close Grip Bench as 3rd press.
- PULL: 1 vertical (Pull-Up OR Lat Pulldown, not both) + 1 row + 1 rear delt (Face Pull).
- LEGS: Squat heavy (4–6 reps) + hinge (8–10 reps) + unilateral (2–3 sets only).

CARDIO: Zone 2 LISS on dedicated cardio days (35–45 min, conversational pace, 60–70% max HR). Conditioning finisher 10–15 min MANDATORY after every strength session (heavier finisher on moderate days, lighter on max-effort days). NEAT: 8,000–10,000 steps/day.`,

  muscle:
    `Muscle Hypertrophy + Strength. Dual goal: build muscle AND increase strength.

EXERCISES: Compounds (Squat, RDL, Bench, OHP, Pull-Up, Row) 3–5 sets. Accessories (Leg Curl, Lateral Raise, Face Pull, Bicep Curl, Tricep, Chest Fly) 2–4 sets. 1 unilateral/core per session (Bulgarian Split Squat, Single-Leg RDL, Ab Wheel).

INTENSITY — both zones every session:
- Strength: 3–6 reps, 75–90% 1RM, RIR 1–2, 2–4 min rest
- Hypertrophy: 6–12 reps, 60–75% 1RM, RIR 2–3, 60–90s rest

OVERLOAD in cue: double progression (reps to top of range → +2.5kg). Compounds: +2.5–5kg/week linear.
TEMPO: compounds 3-1-2, accessories 2-0-2 (slow eccentric mandatory).
PERIODIZATION: Phase 1 (Wk 1–2) = volume, 8–12 reps, 65–70% 1RM, RIR 3. Phase 2 (Wk 3–4) = intensity, 3–6 reps, 75–85% 1RM, RIR 1–2.`,

  endurance:
    "Cardiovascular endurance & functional fitness. Include zone-2 cardio, " +
    "functional compound movements, 15-20 reps, minimal rest / supersets. " +
    "Build aerobic base while maintaining muscle.",

  general:
    "General fitness & health. Balanced mix of strength and conditioning. " +
    "3-4 sets, 10-12 reps, full-body compound focus with light accessories. " +
    "Prioritise movement quality and consistency.",

  hyrox:
    `HYROX / Hybrid Performance Program.

HYROX RACE FORMAT: 8 rounds of (1km run + 1 functional station):
  Station 1: SkiErg 1000m
  Station 2: Sled Push 50m (heavy)
  Station 3: Sled Pull 50m (heavy)
  Station 4: Burpee Broad Jump 80m
  Station 5: Rowing 1000m
  Station 6: Farmer Carry 200m
  Station 7: Sandbag Lunges 100m
  Station 8: Wall Balls 75-100 reps

PROGRAM STRUCTURE — every week must include ALL of these session types:

1. ZONE 2 RUN (1-2x/week)
   - Easy pace (60-70% max HR), 30-60 min
   - Purpose: build aerobic base, fat oxidation
   - Cue: "Should be able to hold a conversation the entire run."

2. STRENGTH SESSION (2x/week) — focus on HYROX-specific movements:
   - Sled Push/Pull (or substitute: Bulgarian Split Squat, Leg Press heavy)
   - Wall Ball (or substitute: Goblet Squat + DB Thruster)
   - Sandbag Lunge (or substitute: Walking Lunge, Barbell Lunge)
   - Farmer Carry (or substitute: Dumbbell Carry, Trap Bar Carry)
   - Rowing Machine or SkiErg intervals
   - Supporting lifts: Deadlift, Hip Thrust, Pull-Up, Row, Push-Up
   - Sets/reps: 4x8-12, 90-120s rest. Emphasise endurance under load.

3. TEMPO / THRESHOLD RUN (1x/week)
   - 20-30 min at 80-85% max HR (uncomfortable but sustainable)
   - Or: 6x800m intervals with 90s rest
   - Purpose: raise lactate threshold, improve race pace

4. BRICK SESSION (1x/week, Weeks 1-2) — introduce race transitions:
   - Alternate short runs (400-800m) with 2-3 HYROX stations back-to-back
   - Example: 800m run → Wall Balls 30 reps → 800m run → Farmer Carry 50m → 800m run
   - Keep rest minimal (30s max between movements)
   - Cue: "Practice transitioning under fatigue. Focus on form, not speed yet."

5. HYROX SIMULATION (progressive % each week) — scale station volume by percentage:
   RACE STATION DISTANCES AT 100%:
   - SkiErg: 1000m | Sled Push: 50m | Sled Pull: 50m | Burpee Broad Jump: 80m
   - Rowing: 1000m | Farmer Carry: 200m | Sandbag Lunges: 100m | Wall Balls: 100 reps

   SCALE BY PERCENTAGE (apply to all station distances/reps):
   - 50% sim: SkiErg 500m, Sled Push 25m, Sled Pull 25m, Burpee BJ 40m, Row 500m, Farmer 100m, Lunge 50m, Wall Ball 50 reps
   - 60% sim: SkiErg 600m, Sled Push 30m, Sled Pull 30m, Burpee BJ 48m, Row 600m, Farmer 120m, Lunge 60m, Wall Ball 60 reps
   - 70% sim: SkiErg 700m, Sled Push 35m, Sled Pull 35m, Burpee BJ 56m, Row 700m, Farmer 140m, Lunge 70m, Wall Ball 70 reps
   - 80% sim: SkiErg 800m, Sled Push 40m, Sled Pull 40m, Burpee BJ 64m, Row 800m, Farmer 160m, Lunge 80m, Wall Ball 80 reps
   - 100% sim: Full race distances — only in Week 4 or final prep week

   FORMAT: 8 rounds of (run + station). Run distance also scales:
   - 50-60% sim: 600m run per round
   - 70-80% sim: 800m run per round
   - 100% sim: 1000m run per round

   NO rest between stations — transition immediately.
   Cue: always include target % and instruction to track total time as race progress benchmark.

   SIMULATION RULES:
   - If SkiErg unavailable → Row same distance
   - If Sled unavailable → Heavy Sled substituted with Prowler / Weighted Sled push
   - Always note equipment substitutions in the cue field

   DISTANCE-BASED EXERCISES — use meters in setsReps field, NOT reps:
   - Farmer Carry → "3 x 40m" NOT "3 x 12"
   - Sandbag Lunge → "3 x 30m" NOT "3 x 20 reps"
   - Sled Push / Sled Pull → "3 x 20m" NOT "3 x 10 reps"
   - Burpee Broad Jump → "3 x 20m" NOT "3 x 10 reps"
   - Any loaded carry or locomotion exercise → always meters

6. RECOVERY / MOBILITY (1x/week if sessions allow):
   - Hip flexor stretch, thoracic rotation, ankle mobility
   - Light row or bike 20 min zone 1

PROGRESSION ACROSS 4 WEEKS:
- Week 1: Base — Brick Session 2-3 stations only, NO simulation. Focus on movement quality and pacing.
- Week 2: Build — Brick Session 4-5 stations. Introduce 50% HYROX Simulation (4 rounds only, scaled distances).
- Week 3: Peak — 70% HYROX Simulation (all 8 rounds, 70% distances). Full strength volume.
- Week 4: Race Prep — 80-100% Full Simulation (all 8 rounds). Reduce strength volume 40%. Prioritise recovery.

EXERCISE NAMING for HYROX sessions: use real station names where possible
(SkiErg, Sled Push, Wall Ball, Farmer Carry, Sandbag Lunge, Burpee Broad Jump, Rowing).
If stations not available, name the substitute clearly in the cue field.`,
};

const HYROX_KEYWORDS = /hyrox|hybrid.?perform|hybrid.?athlet|hybrid.?train|functional.?race|race.?prep|sled.?push|wall.?ball|ski.?erg|skierg|farmer.?carry|sandbag|burpee.?broad/i;

// ── Warm-up muscle matching — shared across all generate functions ────────────
const WARMUP_RULES = `WARM-UP RULES (mandatory — read before generating any warm-up phase):
1. QUANTITY: 2-3 exercises only (5-8 min total).
2. STRUCTURE: pulse raise (1 ex) → mobility (1 ex) → activation (1 ex, match session focus).
   If limitation present: swap activation for 1 targeted rehab drill (max 3 exercises total).
3. MUSCLE MATCHING — pick warm-up from the category matching that session's muscle focus:
   - Push (chest / shoulder / tricep)  → e.g. Band Pull-Apart, Shoulder CARs, Thoracic Rotation, Wall Slide
   - Pull (back / bicep / rear delt)   → e.g. Cat-Cow, Dead Hang, Band Face Pull, Scapula Wall Slide
   - Lower body (quad / hamstring / glute / hip) → e.g. Hip 90/90, Ankle Circles, Glute Bridge Activation, Cossack Squat
   - Full body / Mixed                 → e.g. Jump Rope or March in Place, Hip Circle, Dead Bug
   - Cardio / Endurance / Zone 2       → e.g. Light Jog, Leg Swings, Dynamic Lunge, Arm Circles
   - Boxing / Combat                   → e.g. Shadow Boxing (light), Shoulder CARs, Hip Circle
4. EXCLUSIONS — skip these for the matching limitation:
   lower_back_pain → no deadhinge, good morning, sit-up in warm-up
   shoulder_pain   → no overhead arm circles, upright-row warm-up, behind-neck movements
   ankle_pain      → no jumping jacks, skipping, deep ankle dorsiflexion
   neck_stiffness  → no shrugs, neck rolls under load
   knee_pain       → no jump squats, deep-impact landing, high box step`;

// ── Groq error → friendly user message ───────────────────────────────────────
// Groq retires models without notice: llama-3.3-70b-versatile vanished and every
// call started failing. One constant, the way GEMINI_MODEL already works, so the
// next retirement is one line and not four.
const GROQ_MODEL = "qwen/qwen3.8-27b";

/**
 * groq-sdk tự thử lại 429 hai lần với backoff. Với lỗi quota thì lần nào cũng
 * hỏng, nên nó chỉ kéo dài thời gian chờ (đo được: 21.4s cho một lỗi lẽ ra trả
 * về trong 0.3s) và ăn thêm hạn mức của chính phút đó. Tắt hẳn — nhánh xử lý lỗi
 * bên dưới đã nói rõ khi nào đáng thử lại.
 */

/**
 * Groq admits a request against prompt + max_tokens, not against what the model
 * actually returns, and this key's ceiling is 8000 tokens a minute. A flat
 * max_tokens of 6000 meant a five-day program asked for 2210 + 6000 = 8210 and
 * was refused before it ran, while a two-day one squeaked under — which is why
 * this looked intermittent rather than broken.
 *
 * A measured five-day program completes in 3458 tokens, so the budget is scaled
 * to the number of days with room to spare instead of reserving a flat ceiling
 * nothing ever used.
 */
function groqMaxTokens(days) {
  const n = Math.max(1, Number(days) || 3);
  return Math.min(5000, 1500 + n * 650);
}

/**
 * Groq 429 nào cũng từng rơi vào một câu duy nhất: "Pulse is busy right now".
 *
 * Hai lỗi sau đây trước đây KHÔNG bao giờ tới được nhánh của mình, vì cả hai đều
 * mang status 429 nên bị nhánh isRateLimit ở trên chặn mất:
 *   - "tokens per minute (TPM)" → là lỗi cấu trúc: prompt + max_tokens vượt trần,
 *     bấm lại bao nhiêu lần cũng hỏng y như vậy.
 *   - "requests per day (RPD)"  → hết quota ngày, phải đợi sang hôm sau.
 * Cả hai đều được báo là "đợi một lát rồi thử lại" — lời khuyên sai, và đó là lý
 * do lỗi này trông như tự khỏi rồi tái phát chứ không ai lần ra được.
 *
 * Nên: xét nhánh cụ thể TRƯỚC nhánh 429 chung, và luôn đính kèm nguyên văn lỗi
 * của Groq. Không còn trường hợp nào mà coach nhìn màn hình đoán mò được nữa.
 */
function groqErrorMessage(err) {
  const rawMsg = err.message || String(err) || "";
  const msg = rawMsg.toLowerCase();
  const status = err.status || err.statusCode || (err.error && err.error.status);
  const isRateLimit = status === 429 || msg.includes("rate_limit") || msg.includes("rate limit");
  const has = (...keys) => keys.some((k) => msg.includes(k));

  // Nguyên văn lỗi của Groq, cắt ngắn cho vừa màn hình. Đây là thứ duy nhất phân
  // biệt được TPM / TPD / RPD / key hỏng, và trước đây nó bị vứt đi hoàn toàn.
  const detail = rawMsg ? ` [Groq ${status || "?"}: ${rawMsg.replace(/\s+/g, " ").slice(0, 220)}]` : "";

  // ── Hết quota: đợi cũng không giải quyết trong hôm nay ────────────────────
  if (has("tokens per day", "tpd", "requests per day", "rpd"))
    return "Pulse đã hết hạn mức của Groq cho hôm nay. Đợi sang ngày mai, hoặc nâng cấp gói Groq." + detail;

  // ── Vượt trần mỗi phút: là lỗi kích thước, bấm lại không sửa được ──────────
  if (has("request too large", "tokens per minute", "tpm"))
    return "Yêu cầu vượt trần token mỗi phút của Groq — chương trình này quá lớn so với hạn mức, "
      + "bấm lại sẽ hỏng y hệt. Cần giảm max_tokens hoặc nâng gói Groq." + detail;

  // ── Key sai / hết hạn / chưa cấu hình ─────────────────────────────────────
  if (status === 401 || has("invalid api key", "invalid_api_key", "unauthorized"))
    return "GROQ_API_KEY không hợp lệ hoặc đã bị thu hồi. Chạy: firebase functions:secrets:set GROQ_API_KEY" + detail;
  if (status === 402 || has("insufficient", "quota exceeded", "billing"))
    return "Tài khoản Groq hết credit hoặc có vấn đề thanh toán." + detail;

  // ── Model bị khai tử: là lỗi deploy, không phải thứ đợi được ──────────────
  if (status === 404 || has("does not exist", "model_not_found", "decommissioned", "deprecated"))
    return `Model "${GROQ_MODEL}" không còn trên Groq — cần đổi model trong functions/index.js.` + detail;

  if (isRateLimit)
    return "Groq đang quá tải hoặc bị giới hạn tốc độ — đợi một lát rồi thử lại." + detail;
  if (has("timeout", "timed out") || status === 504)
    return "Groq phản hồi quá chậm — thử lại." + detail;
  if (has("overloaded") || status === 503)
    return "Máy chủ Groq đang quá tải — thử lại sau vài phút." + detail;

  return "Tạo chương trình thất bại." + detail;
}

function isHyroxGoal(goalStr, notesStr) {
  return HYROX_KEYWORDS.test(goalStr || "") || HYROX_KEYWORDS.test(notesStr || "");
}

function detectGoal(goalStr, notesStr) {
  if (isHyroxGoal(goalStr, notesStr)) return GOAL_GUIDANCE.hyrox;
  const g = (goalStr || "").toLowerCase();

  // Muscle / strength — checked FIRST to avoid "lean muscle gain" matching fatLoss
  if (/muscle|strength|gain|hypertrophy|tăng cơ|tăng cân|cơ bắp|khối cơ/i.test(g))
    return GOAL_GUIDANCE.muscle;

  // Fat loss — "lean" safe here because muscle is already handled above
  if (/fat|loss|lean|cut|recomp|giảm|béo|mỡ/i.test(g))
    return GOAL_GUIDANCE.fatLoss;

  // Endurance / conditioning
  if (/endurance|conditioning|cardio|run|stamina|sức bền|thể lực|chạy/i.test(g))
    return GOAL_GUIDANCE.endurance;

  return GOAL_GUIDANCE.general;
}

function detectSplit(sessions, goalStr, notesStr) {
  if (isHyroxGoal(goalStr, notesStr)) {
    const hyroxSplits = {
      3: "HYROX 3-day: Day 1 Strength (HYROX stations) | Day 2 Zone 2 Run | Day 3 Brick (Wk1-2) / HYROX Simulation (Wk3-4)",
      4: "HYROX 4-day: Day 1 Strength | Day 2 Zone 2 Run | Day 3 Tempo Run | Day 4 Brick (Wk1-2) / HYROX Simulation (Wk3-4)",
      5: "HYROX 5-day: Day 1 Strength A | Day 2 Zone 2 Run | Day 3 Tempo Run | Day 4 Strength B | Day 5 Brick (Wk1-2) / HYROX Simulation (Wk3-4)",
      6: "HYROX 6-day: Day 1 Strength A | Day 2 Zone 2 | Day 3 Tempo | Day 4 Strength B | Day 5 Brick (Wk1-2) / HYROX Simulation (Wk3-4) | Day 6 Recovery/Mobility",
      7: "HYROX 7-day: Day 1 Strength A | Day 2 Zone 2 | Day 3 Tempo | Day 4 Strength B | Day 5 Brick (Wk1-2) / HYROX Simulation (Wk3-4) | Day 6 Zone 2 Easy | Day 7 Recovery/Mobility",
    };
    return hyroxSplits[sessions] || hyroxSplits[4];
  }

  // Fat loss gets dedicated Zone 2 day(s) built into the split
  const isFatLoss = /fat|loss|lean|cut|recomp|giảm|béo|mỡ/i.test(goalStr || "");
  if (isFatLoss) {
    const fatLossSplits = {
      3: "Push / Pull / Legs — all 3 days are strength sessions. Zone 2 cardio (30–45 min, easy pace) must be recommended in cues for 2 rest days per week (e.g. Tue + Thu or Sat). Each strength session ends with a 10–15 min conditioning finisher.",
      4: "Push / Pull / Legs / Zone 2 Cardio — Day 4 is a DEDICATED Zone 2 cardio day (35–45 min easy run or bike, conversational pace, no strength). Days 1–3 are strength with conditioning finisher.",
      5: "Push / Pull / Legs / Zone 2 / Upper — Day 4 is dedicated Zone 2 (35–45 min). Days 1-3 and 5 are strength with conditioning finisher.",
      6: "Push / Pull / Legs / Zone 2 / Upper / Zone 2 — Days 4 and 6 are dedicated Zone 2 cardio (35–45 min each). Strength days include 10–15 min conditioning finisher.",
      7: "Push / Pull / Legs / Zone 2 / Upper / Zone 2 / Active Recovery — Days 4 and 6 are Zone 2. Day 7 is mobility + light walk only.",
    };
    return fatLossSplits[sessions] || fatLossSplits[3];
  }

  const splits = {
    3: "Full-Body A/B/C or Push/Pull/Legs",
    4: "Upper/Lower × 2 or Push/Pull/Legs/Full-Body",
    5: "Push/Pull/Legs/Upper/Lower",
    6: "Push/Pull/Legs × 2",
    7: "PPL × 2 + 1 active recovery day",
  };
  return splits[sessions] || splits[3];
}

/**
 * Sends an email notification to the coach whenever a new lead doc is created
 * in the /leads collection.
 */
exports.notifyNewLead = onDocumentCreated(
  {
    document: "leads/{leadId}",
    secrets: [SMTP_USER, SMTP_PASS],
    region: "asia-southeast1",
  },
  async (event) => {
    const snap = event.data;
    if (!snap) {
      console.warn("[notifyNewLead] no snapshot — skipping");
      return;
    }

    const lead = snap.data();
    const leadId = event.params.leadId;

    // Build a human-readable timestamp
    const ts = lead.createdAt
      ? lead.createdAt.toDate().toLocaleString("en-AU", {
          timeZone: "Asia/Ho_Chi_Minh",
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "just now";

    // Rows shown in the email body
    const rows = [
      ["Name", lead.name || "—"],
      ["Email", lead.email || "—"],
      ["Phone", lead.phone || "—"],
      ["Goal", lead.goal || "—"],
      ["Frequency", lead.frequency || "—"],
      ["Service", lead.service || "—"],
      ["Note", lead.note || "—"],
      ["Submitted", ts],
      ["Lead ID", leadId],
    ];

    const tableRows = rows
      .map(
        ([label, value]) => `
      <tr>
        <td style="padding:6px 12px;font-weight:600;color:#555;white-space:nowrap;
                   border-bottom:1px solid #f0f0f0;">${label}</td>
        <td style="padding:6px 12px;color:#222;border-bottom:1px solid #f0f0f0;">${value}</td>
      </tr>`
      )
      .join("");

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="font-family:Inter,Arial,sans-serif;background:#f6f7fb;margin:0;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:10px;
              overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">
    <div style="background:#1e90ff;padding:24px 32px;">
      <h1 style="margin:0;color:#fff;font-size:20px;">🎯 New Coaching Lead — ${APP_NAME}</h1>
      <p style="margin:6px 0 0;color:rgba(255,255,255,.8);font-size:14px;">
        A new contact form submission is waiting for your review.
      </p>
    </div>
    <div style="padding:24px 32px;">
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tbody>${tableRows}</tbody>
      </table>
      <p style="margin:20px 0 0;font-size:13px;color:#888;">
        Log in to the
        <a href="https://fitness-app-a22c8.web.app/app" style="color:#1e90ff;">
          Striveo dashboard
        </a>
        to update the lead status (New → Contacted → Booked / Declined).
      </p>
    </div>
  </div>
</body>
</html>`;

    const text = rows.map(([l, v]) => `${l}: ${v}`).join("\n");

    const transport = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: SMTP_USER.value(),
        pass: SMTP_PASS.value(),
      },
    });

    await transport.sendMail({
      from: `"${APP_NAME} Leads" <${SMTP_USER.value()}>`,
      to: COACH_EMAIL,
      subject: `New coaching lead: ${lead.name || "Unknown"} (${lead.service || "general"})`,
      text,
      html,
    });

    console.log(`[notifyNewLead] email sent for lead ${leadId} (${lead.email})`);
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// generateProgram — HTTPS Callable
// Called from the app when a coach creates a new client.
// Returns a 4-week training program as a Firestore-ready JSON object.
// ─────────────────────────────────────────────────────────────────────────────
exports.generateProgram = onCall(
  {
    secrets: [GROQ_API_KEY],
    region: "asia-southeast1",
    timeoutSeconds: 90,
    memory: "256MiB",
  },
  async (request) => {
    const { name, level, goal, sessionsPerWeek, notes, age, gender, weight, height } = request.data || {};

    // Say which field is missing. Without this the function ran on undefined and
    // failed somewhere further down, and the client got a bare "internal" that
    // named nothing.
    const missing = ["name", "level", "goal", "sessionsPerWeek"].filter((k) => !request.data || !request.data[k]);
    if (missing.length) {
      throw new HttpsError("invalid-argument", "Thiếu thông tin: " + missing.join(", ") + ".");
    }

    // ── Day mapping ──────────────────────────────────────────────────────────
    const dayMaps = {
      // 1 and 2 were missing, so every 2-session client silently fell through to
      // the 3-day map and got a day they never agreed to train.
      1: ["Wed"],
      2: ["Tue", "Fri"],
      3: ["Mon", "Wed", "Fri"],
      4: ["Mon", "Tue", "Thu", "Fri"],
      5: ["Mon", "Tue", "Wed", "Thu", "Fri"],
      6: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      7: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    };
    const days = dayMaps[sessionsPerWeek] || dayMaps[3];
    const restDays = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].filter(
      (d) => !days.includes(d)
    );

    // ── Goal & split guidance (checks goal + notes for HYROX keywords) ────────
    const goalGuidance = detectGoal(goal, notes);
    const splitGuidance = detectSplit(sessionsPerWeek, goal, notes);

    // ── Level guidance ───────────────────────────────────────────────────────
    const levelMap = {
      Beginner:
        "Beginner: 2-3 sets per exercise, fundamental movement patterns, " +
        "emphasis on technique. Longer warm-up, more mobility work.",
      Intermediate:
        "Intermediate: 3-4 sets, compound + accessory split, moderate complexity, " +
        "introduce periodisation.",
      Advanced:
        "Advanced: 4-5 sets, complex periodisation, higher volume, " +
        "advanced techniques (tempo, pause reps, drop sets where appropriate).",
    };
    const levelGuidance = levelMap[level] || levelMap["Intermediate"];

    // ── BMI context (weight + height) ────────────────────────────────────────
    let bmiContext = "";
    if (weight && height) {
      const bmi = weight / Math.pow(height / 100, 2);
      const bmiR = Math.round(bmi * 10) / 10;
      let bmiCat, bmiRule = "";
      if (bmi < 18.5) {
        bmiCat = "Underweight";
        bmiRule = "Client is underweight — avoid aggressive caloric deficit programming. Prioritise compound lifts and adequate recovery.";
      } else if (bmi < 25) {
        bmiCat = "Normal";
        bmiRule = "Healthy BMI — standard programming applies.";
      } else if (bmi < 30) {
        bmiCat = "Overweight";
        bmiRule = "Elevated BMI — include conditioning finisher each session, reduce high-impact plyometrics, emphasise NEAT in cues.";
      } else {
        bmiCat = "Obese";
        bmiRule = "High BMI — low-impact modifications for all jumps/plyos. Include 10-min conditioning finisher. Prioritise movement quality over load. Avoid exercises with high spinal compression when standing (prefer seated/supported).";
      }
      bmiContext = `\nBODY METRICS: Weight ${weight}kg | Height ${height}cm | BMI ${bmiR} (${bmiCat})${gender ? ` | Gender: ${gender}` : ""}\n${bmiRule}`;
    } else if (weight) {
      bmiContext = `\nBODY METRICS: Weight ${weight}kg${gender ? ` | Gender: ${gender}` : ""}`;
    } else if (gender) {
      bmiContext = `\nGENDER: ${gender}`;
    }

    // ── Age context ───────────────────────────────────────────────────────────
    let ageContext = "";
    if (age) {
      if (age < 25) {
        ageContext = `\nAGE (${age}): Young athlete — can handle high volume and frequency. Fast recovery. Can include intensity techniques (supersets, drop sets).`;
      } else if (age <= 40) {
        ageContext = `\nAGE (${age}): Standard adult — balanced volume and intensity. Standard warm-up protocol.`;
      } else if (age <= 55) {
        ageContext = `\nAGE (${age}): 40+ athlete — extend warm-up to 10-12 min, include extra mobility work. Reduce max-effort frequency. Add 30s extra rest between sets. Avoid high-impact plyometrics. Prioritise joint health cues.`;
      } else {
        ageContext = `\nAGE (${age}): 55+ athlete — CRITICAL: prioritise mobility, balance, injury prevention. Longer warm-up (12-15 min), lower intensity (RPE 6-7 max), avoid heavy axial loading. Include balance drills. Rest 2-3 min between sets. Prefer machines/cables over barbells where possible.`;
      }
    }

    // ── Build the day skeleton for the prompt ────────────────────────────────
    const daySkeletonLines = days
      .map((d, i) => `  "${d}": { "label": "Session ${String.fromCharCode(65+i)} — [focus]", "phases": [...] }`)
      .join(",\n");

    // ── Injury protocol ──────────────────────────────────────────────────────
    // Skip injury section if notes contain HYROX keywords (goal context, not injury)
    const injurySection = notes && notes.trim() && notes.trim().toLowerCase() !== "none" && !isHyroxGoal("", notes)
      ? `
INJURY & LIMITATION PROTOCOL — CRITICAL, DO NOT IGNORE
Client has the following injuries/limitations: "${notes}"

You MUST follow ALL of these rules:
1. AVOID any exercise that directly loads or stresses the injured area.
2. SUBSTITUTE with safe alternatives that train the same movement pattern without aggravating the injury.
   - Knee injury → replace Squat/Lunge with Leg Press, Leg Curl, Seated Leg Extension, Box Step-up (low box)
   - Lower back → replace Deadlift/Good Morning with Hip Thrust, Trap Bar Deadlift, Cable Pull-Through, Bird Dog
   - Shoulder → replace Overhead Press/Upright Row with Landmine Press, Cable Lateral Raise, Neutral-grip Press
   - Wrist → replace Barbell movements with Dumbbell or Cable alternatives, avoid push-up on wrists
   - Hip flexor → replace heavy squats and hip-flexion movements with glute-focused alternatives
3. INCLUDE 1-2 REHAB exercises in the warm-up phase targeting the injured area (mobility, activation, low load).
4. ADD a note in the "cue" field of every exercise near the injury: "⚠️ Modify or skip if pain >3/10."
5. REDUCE total session intensity by 10-15% — prioritise movement quality over load.
6. If the injury affects an entire movement category (e.g. all pressing for shoulder), restructure the session split to compensate with more pulling/lower body volume.`
      : `
INJURIES / LIMITATIONS: None reported. Train normally.`;

    // ── Fat Loss specific rules (injected only when goal = fatLoss) ──────────
    const fatLossSpecificRules = goalGuidance === GOAL_GUIDANCE.fatLoss ? `
FAT LOSS RULES (override defaults):
INTENSITY: Never uniform reps. 1st compound = top set (4–6 reps, 80–85% 1RM, RPE 8–9, 2–3 min rest). 2nd–3rd = back-off (8–10 reps, 70–75% 1RM, 90s). Accessories: 10–15 reps, 60–90s.
OVERLOAD in cue: "+2.5kg when 6 clean reps × 2 sessions". Back-off: reps first then load. Strength stable = muscle preserved.
ANTI-REDUNDANCY: PUSH = Bench + OHP + 1 chest isolation (Cable Fly). No 3rd press. PULL = 1 vertical (Pull-Up OR Lat Pulldown, not both) + 1 row + 1 rear delt. LEGS = heavy squat (4–6) + hinge (8–10) + unilateral 2–3 sets only.
FINISHER (MANDATORY every strength day, tag:"accessories", name:"🔥 Conditioning Finisher"): 10–15 min after lifting. Heavy day → light finisher RPE 6–7 (row 500m ×3). Moderate day → hard finisher RPE 8–9 (30s sprint/20s rest ×8). Cue: work/rest format + RPE + "10,000 steps/day".
ZONE 2 DAY (if split has dedicated cardio day): ONLY cardio, no strength. Label "Zone 2 Cardio". 35–45 min run/bike/row, conversational pace, RPE 5–6, 60–70% max HR. Cue: duration + HR target + "primary fat oxidation tool". For 3-session programs: note in 1 cue "Zone 2 on rest days (Tue/Thu), 35 min easy run — your #1 fat loss tool".` : '';

    // ── Muscle/Strength specific rules (injected only when goal = muscle) ────
    const muscleSpecificRules = goalGuidance === GOAL_GUIDANCE.muscle ? `
MUSCLE RULES (override defaults):
Main Lifts: 2–3 compounds. Wk 1–2: 8–10 reps, 65–70% 1RM, RIR 3, 90s rest, tempo 3-1-2. Wk 3–4: 4–6 reps, 75–85% 1RM, RIR 1–2, 2–4 min rest.
Accessories: 3–4 isolations, 2–4 sets, 8–15 reps, 60–90s, tempo 2-0-2. Include 1 unilateral (Bulgarian Split Squat, Single-Leg RDL).
Cue for every main lift: % 1RM + RIR target + "+2.5kg when top of rep range reached".
Order: heavy compounds first → moderate compounds → isolations last.` : '';

    // ── Prompt ───────────────────────────────────────────────────────────────
    const prompt = `You are an elite personal trainer and sports rehab specialist. Create a 4-week progressive training program.

CLIENT
- Name: ${name}
- Level: ${level}
- Goal: ${goal}
- Sessions/week: ${sessionsPerWeek} days (${days.join(", ")})
- Rest days: ${restDays.join(", ")}${bmiContext}${ageContext}
${injurySection}

GOAL APPROACH
${goalGuidance}

VOLUME & INTENSITY
${levelGuidance}

SPLIT STRUCTURE
${splitGuidance}

OUTPUT FORMAT
Return ONLY raw JSON — no markdown, no code fences, no explanation.
Root keys are the training days: ${days.join(", ")}.

{
${daySkeletonLines}
}

Each day must follow this EXACT structure:
{
  "label": "Session A — Push",
  "phases": [
    {
      "tag": "warmup",
      "name": "🔥 Warm-up",
      "exercises": [
        { "name": "Jump Rope", "setsReps": "1 x 5 min", "tempo": "", "cue": "Light pace to elevate heart rate." }
      ]
    },
    {
      "tag": "strength",
      "name": "💪 Main Lifts",
      "exercises": [
        { "name": "Barbell Back Squat", "setsReps": "4 x 8", "tempo": "3-1-2", "cue": "Week 1-2: 70% 1RM | Week 3-4: 75% 1RM. Brace core, knees track toes." }
      ]
    },
    {
      "tag": "accessories",
      "name": "⚡ Accessories",
      "exercises": [
        { "name": "Leg Press", "setsReps": "3 x 12", "tempo": "2-0-2", "cue": "Week 3-4: add 1 set. Full range of motion." }
      ]
    }
  ]
}

${fatLossSpecificRules}
${muscleSpecificRules}
RULES
${WARMUP_RULES}
- Main Lifts: 3-5 compound exercises
- Accessories: 3-5 isolation / support exercises
- Embed 4-week progression inside the "cue" field (load, sets, or intensity)
- Total session: 45-75 min
- Vary session focus logically across days (e.g. Push / Pull / Legs, or Upper / Lower)
- INJURY RULES OVERRIDE ALL OTHER RULES — never recommend contraindicated exercises
- EXERCISE NAMES must be clean standard names ONLY — e.g. "Barbell Back Squat", "Romanian Deadlift", "Dumbbell Row". NEVER append equipment qualifiers like "with a Weighted Vest", "with Resistance Band", "with Kettlebell" to the exercise name. Equipment context belongs in the "cue" field only.
- Do NOT add any text outside the JSON`;

    // ── Call Groq ────────────────────────────────────────────────────────────
    const groq = new Groq({ apiKey: GROQ_API_KEY.value(), maxRetries: 0 });

    // Groq failures were thrown raw here, so Firebase stripped them and the coach
    // got a bare "internal" naming nothing — which is how a retired model went
    // unnoticed. pulseGenerateFree already routed through groqErrorMessage.
    let completion;
    try {
      completion = await groq.chat.completions.create({
        model: GROQ_MODEL,
        max_tokens: groqMaxTokens(days.length),
        temperature: 0.4,
        messages: [{ role: "user", content: prompt }],
      });
    } catch (groqErr) {
      console.error("[generateProgram] Groq failed —", groqErr.status || "", groqErr.message);
      throw new HttpsError("internal", groqErrorMessage(groqErr));
    }

    let raw = completion.choices[0].message.content.trim();
    // Strip markdown fences if model wraps output
    raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();

    // Groq has no structured-output mode here, so the model can return prose or a
    // truncated object. Unwrapped, that SyntaxError also reached the app as a
    // bare "internal".
    let program;
    try {
      program = JSON.parse(raw);
    } catch (parseErr) {
      console.error("[program] JSON parse failed — first 200 chars:", raw.slice(0, 200));
      throw new HttpsError("internal", "Pulse returned a malformed program — please try again.");
    }
    console.log(`[generateProgram] Groq program generated for ${name} (${level}, ${goal})`);
    return { program };
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// pulseGenerate — Pulse AI, HTTPS Callable
// Reads client's full Firestore history + all existing programs for style context
// Returns { program, steps } where steps[] is the Pulse analysis log
// ─────────────────────────────────────────────────────────────────────────────
exports.pulseGenerate = onCall(
  {
    secrets: [GROQ_API_KEY],
    region: "asia-southeast1",
    timeoutSeconds: 120,
    memory: "512MiB",
  },
  async (request) => {
    const { clientId } = request.data;
    // A plain Error from a callable reaches the client as a bare "internal" with
    // the reason stripped — the same dead end the nutrition tab kept hitting.
    if (!clientId) throw new HttpsError("invalid-argument", "clientId is required");

    const db = getFirestore();
    const steps = [];

    // ── Step 1: Read target client profile ───────────────────────────────────
    steps.push({ icon: "📖", text: "Đọc hồ sơ khách hàng..." });
    const clientDoc = await db.collection("clients").doc(clientId).get();
    if (!clientDoc.exists) throw new HttpsError("not-found", "Client not found: " + clientId);
    const client = clientDoc.data();
    const { name, level, goal, sessionsPerWeek } = client;

    // ── Step 2: Read assessment ───────────────────────────────────────────────
    steps.push({ icon: "📋", text: "Phân tích baseline assessment..." });
    const assessDoc = await db
      .collection("clients").doc(clientId)
      .collection("assessment").doc("baseline").get();
    const assessment = assessDoc.exists ? assessDoc.data() : null;

    // ── Step 3: Read checkpoints ──────────────────────────────────────────────
    steps.push({ icon: "📊", text: "Xem checkpoint & tiến độ..." });
    const cpSnap = await db
      .collection("clients").doc(clientId)
      .collection("checkpoints")
      .orderBy("date", "desc").limit(4).get();
    const checkpoints = cpSnap.docs.map((d) => d.data());

    // ── Step 4: Read workout history ──────────────────────────────────────────
    steps.push({ icon: "🏋️", text: "Phân tích lịch sử tập luyện..." });
    const histSnap = await db
      .collection("clients").doc(clientId)
      .collection("workoutHistory")
      .orderBy("date", "desc").limit(20).get();
    const workoutHistory = histSnap.docs.map((d) => d.data());

    // ── Step 5: Read existing programs for coaching style ─────────────────────
    steps.push({ icon: "🎨", text: "Học phong cách coaching từ các chương trình hiện có..." });
    const allClientsSnap = await db.collection("clients").get();
    const styleExamples = [];
    for (const doc of allClientsSnap.docs) {
      if (doc.id === clientId) continue;
      const data = doc.data();
      if (!data.program) continue;
      // Extract one day as style example (avoid token overload)
      const days = Object.keys(data.program);
      if (days.length === 0) continue;
      const sampleDay = data.program[days[0]];
      styleExamples.push({
        clientLevel: data.level,
        clientGoal: data.goal,
        sampleSession: sampleDay,
      });
    }

    // ── Step 6: Build prompt ─────────────────────────────────────────────────
    steps.push({ icon: "⚡", text: "Pulse đang tạo chương trình..." });

    const dayMaps = {
      // 1 and 2 were missing, so every 2-session client silently fell through to
      // the 3-day map and got a day they never agreed to train.
      1: ["Wed"],
      2: ["Tue", "Fri"],
      3: ["Mon", "Wed", "Fri"],
      4: ["Mon", "Tue", "Thu", "Fri"],
      5: ["Mon", "Tue", "Wed", "Thu", "Fri"],
      6: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      7: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    };
    const days = dayMaps[sessionsPerWeek] || dayMaps[3];

    // ── Goal, level & split guidance ─────────────────────────────────────────
    const clientNotes = client.notes || "";
    const goalGuidance = detectGoal(goal, clientNotes);
    const splitGuidance = detectSplit(sessionsPerWeek, goal, clientNotes);
    const levelGuidanceMap = {
      Beginner:
        "Beginner: 2-3 sets per exercise, fundamental movement patterns, " +
        "emphasis on technique. Longer warm-up, more mobility work.",
      Intermediate:
        "Intermediate: 3-4 sets, compound + accessory split, moderate complexity, " +
        "introduce periodisation.",
      Advanced:
        "Advanced: 4-5 sets, complex periodisation, higher volume, " +
        "advanced techniques (tempo, pause reps, drop sets where appropriate).",
    };
    const levelGuidance = levelGuidanceMap[level] || levelGuidanceMap["Intermediate"];

    // ── Body composition deep analysis ───────────────────────────────────────
    let assessContext = "";
    if (assessment) {
      const w  = parseFloat(assessment.weight) || null;
      const h  = parseFloat(assessment.height) || null;
      const a  = parseInt(assessment.age)      || null;
      const g  = (assessment.gender || "").toLowerCase();
      const pbf  = parseFloat(assessment.pbf)  || null;  // % body fat
      const smm  = parseFloat(assessment.smm)  || null;  // skeletal muscle mass kg
      const waist = parseFloat(assessment.waist) || null;
      const hip   = parseFloat(assessment.hip)   || null;

      const lines = ["BODY ASSESSMENT (InBody):"];
      lines.push(`- Weight: ${w || "?"}kg | Height: ${h || "?"}cm | Age: ${a || "?"} | Gender: ${assessment.gender || "?"}`);

      // ── BMI ──────────────────────────────────────────────────────────────
      let bmiRule = "";
      if (w && h) {
        const bmi = w / Math.pow(h / 100, 2);
        const bmiR = Math.round(bmi * 10) / 10;
        let bmiCat;
        if      (bmi < 18.5) { bmiCat = "Underweight"; bmiRule = "BMI underweight — prioritise muscle gain, avoid excessive cardio, caloric surplus cues in notes."; }
        else if (bmi < 25)   { bmiCat = "Normal";      bmiRule = "BMI normal — follow stated goal, standard periodisation."; }
        else if (bmi < 30)   { bmiCat = "Overweight";  bmiRule = "BMI overweight — increase metabolic demand, shorter rest (45-60s), add conditioning finisher each session."; }
        else                 { bmiCat = "Obese";        bmiRule = "BMI obese — fat loss priority regardless of stated goal, low-impact exercises, full-body circuits, 15-20 reps, 30-45s rest."; }
        lines.push(`- BMI: ${bmiR} (${bmiCat}) → ${bmiRule}`);
      }

      // ── Body fat % (gender-specific thresholds) ───────────────────────────
      let pbfRule = "";
      if (pbf !== null) {
        const isFemale = g === "female" || g === "nữ";
        let pbfCat;
        if (isFemale) {
          if      (pbf < 18) { pbfCat = "Very lean / athletic";  pbfRule = "Very low body fat (female) — avoid aggressive fat loss, maintain muscle mass focus."; }
          else if (pbf < 28) { pbfCat = "Fit range";             pbfRule = "Healthy body fat (female) — follow stated goal, standard programming."; }
          else if (pbf < 35) { pbfCat = "Above average";         pbfRule = "Elevated body fat (female) — include fat loss conditioning in every session, prioritise compound movements."; }
          else               { pbfCat = "High body fat";          pbfRule = "High body fat (female) — fat loss override, low-impact circuits, progressive cardio, track waist reduction."; }
        } else {
          if      (pbf < 10) { pbfCat = "Very lean / athletic";  pbfRule = "Very low body fat (male) — muscle building focus, avoid cardio overload, caloric surplus cues."; }
          else if (pbf < 20) { pbfCat = "Fit range";             pbfRule = "Healthy body fat (male) — follow stated goal, standard periodisation."; }
          else if (pbf < 25) { pbfCat = "Above average";         pbfRule = "Elevated body fat (male) — add metabolic conditioning, increase daily movement cues in notes."; }
          else               { pbfCat = "High body fat";          pbfRule = "High body fat (male) — fat loss priority, compound movements, HIIT finishers, minimal isolation."; }
        }
        lines.push(`- Body Fat: ${pbf}% (${pbfCat}) → ${pbfRule}`);
      }

      // ── Skeletal Muscle Mass ──────────────────────────────────────────────
      let smmRule = "";
      if (smm !== null && w !== null) {
        const smmRatio = (smm / w) * 100;
        const smmRatioR = Math.round(smmRatio * 10) / 10;
        const isFemale = g === "female" || g === "nữ";
        const lowThreshold = isFemale ? 27 : 33;
        if (smmRatio < lowThreshold) {
          smmRule = `Low muscle mass ratio (${smmRatioR}% of body weight) — increase strength volume, prioritise compound hypertrophy movements, progressive overload is critical.`;
        } else {
          smmRule = `Good muscle mass ratio (${smmRatioR}% of body weight) — maintain muscle, adjust based on goal.`;
        }
        lines.push(`- SMM: ${smm}kg (${smmRatioR}% body weight) → ${smmRule}`);
      }

      // ── Waist-to-Hip ratio ────────────────────────────────────────────────
      if (waist && hip) {
        const whr = Math.round((waist / hip) * 100) / 100;
        const isFemale = g === "female" || g === "nữ";
        const highRisk = isFemale ? whr > 0.85 : whr > 0.9;
        if (highRisk) {
          lines.push(`- Waist/Hip ratio: ${whr} (HIGH cardiovascular risk) → prioritise visceral fat reduction: cardio conditioning, caloric awareness cues in notes.`);
        } else {
          lines.push(`- Waist/Hip ratio: ${whr} (Healthy range)`);
        }
      }

      // ── Age rules ─────────────────────────────────────────────────────────
      if (a) {
        if (a < 25) {
          lines.push(`- Age ${a}: Young — high volume/frequency, fast recovery, can use intensity techniques (drop sets, supersets).`);
        } else if (a <= 40) {
          lines.push(`- Age ${a}: Standard adult — balanced volume and intensity.`);
        } else if (a <= 55) {
          lines.push(`- Age ${a}: 40+ — extend warm-up 10-12 min, extra mobility work, 30s extra rest between sets, avoid high-impact plyometrics, prioritise joint health cues.`);
        } else {
          lines.push(`- Age ${a}: 55+ — CRITICAL: longer warm-up (12-15 min), RPE max 6-7, avoid heavy axial loading, include balance drills, prefer cables/machines over barbell where possible.`);
        }
      }

      assessContext = "\n" + lines.join("\n");
    }

    // ── Checkpoint trend with intelligent analysis ────────────────────────────
    let progressContext = "";
    if (checkpoints.length > 0) {
      const latest = checkpoints[0];
      const oldest = checkpoints[checkpoints.length - 1];
      const dW   = ((latest.weight || 0) - (oldest.weight || 0)).toFixed(1);
      const dPBF = ((latest.pbf   || 0) - (oldest.pbf   || 0)).toFixed(1);
      const dSMM = ((latest.smm   || 0) - (oldest.smm   || 0)).toFixed(1);

      let trend = "";
      const wGain  = parseFloat(dW)   > 0.5;
      const wLoss  = parseFloat(dW)   < -0.5;
      const fatUp  = parseFloat(dPBF) > 0.5;
      const fatDown= parseFloat(dPBF) < -0.5;
      const muUp   = parseFloat(dSMM) > 0.3;
      const muDown = parseFloat(dSMM) < -0.3;

      if (wGain  && fatUp)   trend = "⚠️ Weight up + body fat up — gaining fat, not muscle. INCREASE conditioning volume, REVIEW nutrition cues in program.";
      else if (wGain && fatDown && muUp) trend = "✅ Body recomp working — muscle up, fat down. Continue current approach, increase load progressively.";
      else if (wLoss && fatDown) trend = "✅ Cutting effectively — fat loss on track. Monitor muscle retention; if SMM dropping, add strength volume.";
      else if (wLoss && muDown)  trend = "⚠️ Losing muscle — likely under-eating or over-cardio. REDUCE cardio, ADD strength volume, increase protein cues.";
      else if (muUp  && !fatUp)  trend = "✅ Clean muscle gain. Progressive overload working. Continue and slightly increase intensity.";
      else                       trend = "Stable — limited change. May need a program refresh or increased stimulus.";

      progressContext = `
PROGRESS TREND (${checkpoints.length} checkpoints, ${workoutHistory.length} sessions logged):
- Weight: ${oldest.weight || "?"}kg → ${latest.weight || "?"}kg (${dW > 0 ? "+" : ""}${dW}kg)
- Body Fat: ${oldest.pbf || "?"}% → ${latest.pbf || "?"}% (${dPBF > 0 ? "+" : ""}${dPBF}%)
- Muscle Mass: ${oldest.smm || "?"}kg → ${latest.smm || "?"}kg (${dSMM > 0 ? "+" : ""}${dSMM}kg)
- ANALYSIS: ${trend}`;
    }

    // Volume trend
    let volumeContext = "";
    if (workoutHistory.length > 0) {
      const avgVol = workoutHistory.reduce((s, w) => s + (w.volume || 0), 0) / workoutHistory.length;
      const avgDone = workoutHistory.reduce((s, w) => s + (w.done || 0), 0) / workoutHistory.length;
      volumeContext = `
WORKOUT HISTORY:
- Avg session volume: ${Math.round(avgVol)}kg
- Avg exercises completed: ${Math.round(avgDone)}
- Adherence trend: ${workoutHistory.slice(0, 5).map((w) => Math.round((w.done / (w.total || 1)) * 100) + "%").join(", ")}`;
    }

    // Coach style examples
    let styleContext = "";
    if (styleExamples.length > 0) {
      styleContext = `
COACH'S TRAINING STYLE (learned from ${styleExamples.length} existing programs):
${styleExamples.slice(0, 2).map((ex, i) => `
Example ${i + 1} — ${ex.clientLevel} client, goal: ${ex.clientGoal}:
${JSON.stringify(ex.sampleSession, null, 2).substring(0, 800)}
`).join("")}
IMPORTANT: Mirror this coaching style — same phase structure, similar exercise selection philosophy, same cue/note format.`;
    }

    // ── HYROX × Body Assessment integration ──────────────────────────────────
    let hyroxBodyContext = "";
    if (isHyroxGoal(goal, clientNotes) && assessment) {
      const w   = parseFloat(assessment.weight) || null;
      const h   = parseFloat(assessment.height) || null;
      const a   = parseInt(assessment.age)      || null;
      const pbf = parseFloat(assessment.pbf)    || null;
      const smm = parseFloat(assessment.smm)    || null;
      const g   = (assessment.gender || "").toLowerCase();
      const rules = [];

      // BMI → adjust run volume & simulation start %
      if (w && h) {
        const bmi = w / Math.pow(h / 100, 2);
        if (bmi >= 30) {
          rules.push("BMI obese: START simulation at 40% (not 50%). Reduce run distance to 400m per round in Weeks 1-2. Prioritise strength base and station technique before adding running volume. Low-impact warm-up mandatory.");
        } else if (bmi >= 25) {
          rules.push("BMI overweight: Start simulation at 50%. Keep run pace conversational (zone 2) for first 2 weeks. Progress to 60% Week 2, 70% Week 3.");
        }
      }

      // Body fat % → running capacity & station endurance
      if (pbf !== null) {
        const isFemale = g === "female" || g === "nữ";
        const highFat = isFemale ? pbf > 30 : pbf > 22;
        const lowFat  = isFemale ? pbf < 18 : pbf < 10;
        if (highFat) {
          rules.push(`Body fat ${pbf}% (elevated): Running will be harder — keep all runs at zone 2 until Week 3. Simulation progression: 40% → 60% → 70% → 80%. Add extra rest (60s) between brick transitions in Week 1.`);
        } else if (lowFat) {
          rules.push(`Body fat ${pbf}% (very lean): High running capacity. Can progress simulation faster: 60% → 70% → 80% → 100%. Prioritise station strength — lean athletes often lack loaded carry endurance.`);
        }
      }

      // SMM → station strength capacity
      if (smm !== null && w !== null) {
        const smmRatio = (smm / w) * 100;
        const isFemale = g === "female" || g === "nữ";
        if (smmRatio < (isFemale ? 27 : 33)) {
          rules.push(`Low muscle mass (SMM ${smm}kg, ${Math.round(smmRatio)}% BW): Station work will be limiting factor. Add 1 extra strength session in Week 1-2 before introducing simulation. Prioritise: Sled Push, Farmer Carry, Wall Ball strength base.`);
        }
      }

      // Age → warm-up, recovery, simulation %
      if (a) {
        if (a >= 45) {
          rules.push(`Age ${a}: Extend pre-run warm-up to 15 min including hip flexor, ankle, and thoracic mobility. Reduce simulation intensity by 10% vs standard (e.g. Week 3 = 60% instead of 70%). Add 90s rest after each simulation round in Week 1-2.`);
        } else if (a >= 35) {
          rules.push(`Age ${a}: 10-min warm-up before all running sessions. Allow 48h between simulation and next hard session.`);
        }
      }

      // Progress trend × HYROX
      if (checkpoints.length > 0) {
        const latest = checkpoints[0];
        const oldest = checkpoints[checkpoints.length - 1];
        const dSMM = (latest.smm || 0) - (oldest.smm || 0);
        const dPBF = (latest.pbf || 0) - (oldest.pbf || 0);
        if (dSMM < -0.5) {
          rules.push("TREND — muscle loss detected: Reduce running volume by 20% this cycle. Add 1 extra strength station session. Protein intake cue in every session note.");
        }
        if (dPBF > 1.5) {
          rules.push("TREND — body fat increasing: Add conditioning finisher (200m row or 500m ski) after each strength session. Progress simulation % aggressively: don't reduce from standard.");
        }
      }

      if (rules.length > 0) {
        hyroxBodyContext = `\nHYROX × BODY ASSESSMENT — THESE RULES OVERRIDE STANDARD SIMULATION PROGRESSION:\n${rules.map((r, i) => `${i + 1}. ${r}`).join("\n")}`;
      }
    }

    const daySkeletonLines = days
      .map((d, i) => `  "${d}": { "label": "Session ${String.fromCharCode(65 + i)} — [focus]", "phases": [...] }`)
      .join(",\n");

    // ── Injury/notes section for pulseGenerate ────────────────────────────────
    const pulseInjurySection = clientNotes && clientNotes.trim() && clientNotes.trim().toLowerCase() !== "none" && !isHyroxGoal("", clientNotes)
      ? `\nINJURY & LIMITATIONS — CRITICAL: "${clientNotes}"\nAvoid contraindicated exercises. Substitute safe alternatives. Include 1-2 rehab/activation exercises in warm-up. Add "⚠️ Modify if pain >3/10" cue on relevant exercises.`
      : "";

    const prompt = `You are Pulse, an elite AI personal trainer. Create a personalized next training cycle for this client.

CLIENT PROFILE:
- Name: ${name}
- Level: ${level}
- Goal: ${goal}
- Sessions/week: ${sessionsPerWeek} (${days.join(", ")})
${assessContext}
${progressContext}
${volumeContext}
${pulseInjurySection}
${hyroxBodyContext}

GOAL APPROACH:
${goalGuidance}

LEVEL GUIDANCE:
${levelGuidance}

SPLIT STRUCTURE:
${splitGuidance}
${styleContext}

TASK: Generate a 4-week progressive training program that:
1. Continues naturally from where this client left off
2. Follows the GOAL APPROACH and SPLIT STRUCTURE above precisely
3. Progresses load/volume intelligently based on their history
4. Addresses any weak points shown in their progress data

OUTPUT FORMAT — Return ONLY raw JSON, no markdown:
{
${daySkeletonLines}
}

Each day structure:
{
  "label": "Session A — Push",
  "phases": [
    {
      "tag": "warmup",
      "name": "🔥 Warm-up",
      "exercises": [{ "name": "...", "setsReps": "1 x 5 min", "tempo": "", "cue": "..." }]
    },
    {
      "tag": "strength",
      "name": "💪 Main Lifts",
      "exercises": [{ "name": "...", "setsReps": "4 x 6", "tempo": "3-1-2", "cue": "Week 1-2: 75% 1RM. Week 3-4: 80% 1RM." }]
    },
    {
      "tag": "accessories",
      "name": "⚡ Accessories",
      "exercises": [{ "name": "...", "setsReps": "3 x 12", "tempo": "2-0-2", "cue": "..." }]
    }
  ]
}

RULES:
${WARMUP_RULES}
- Main Lifts: 3-5 compound exercises matching the split focus
- Accessories: 3-5 isolation / support exercises
- Embed 4-week progression in "cue" field (Week 1→4 load/intensity/sets)
- Vary session focus logically across days — do NOT hit the same muscle group two days in a row
- BODY COMPOSITION RULES OVERRIDE GOAL if they conflict (e.g. high BMI overrides "muscle gain" toward conditioning)
- PROGRESS TREND RULES override generic programming — if client is losing muscle, add strength; if gaining fat, add conditioning
- Exercise names must be clean standard names — never append equipment qualifiers
- Do NOT add any text outside the JSON`;

    // ── Call Groq ─────────────────────────────────────────────────────────────
    const groq = new Groq({ apiKey: GROQ_API_KEY.value(), maxRetries: 0 });
    // Groq failures were thrown raw here, so Firebase stripped them and the coach
    // got a bare "internal" naming nothing — which is how a retired model went
    // unnoticed. pulseGenerateFree already routed through groqErrorMessage.
    let completion;
    try {
      completion = await groq.chat.completions.create({
        model: GROQ_MODEL,
        max_tokens: groqMaxTokens(days.length),
        temperature: 0.35,
        messages: [{ role: "user", content: prompt }],
      });
    } catch (groqErr) {
      console.error("[pulseGenerate] Groq failed —", groqErr.status || "", groqErr.message);
      throw new HttpsError("internal", groqErrorMessage(groqErr));
    }

    let raw = completion.choices[0].message.content.trim();
    raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();

    // Groq has no structured-output mode here, so the model can return prose or a
    // truncated object. Unwrapped, that SyntaxError also reached the app as a
    // bare "internal".
    let program;
    try {
      program = JSON.parse(raw);
    } catch (parseErr) {
      console.error("[program] JSON parse failed — first 200 chars:", raw.slice(0, 200));
      throw new HttpsError("internal", "Pulse returned a malformed program — please try again.");
    }
    steps.push({ icon: "✅", text: "Hoàn thành!" });

    console.log(`[pulseGenerate] ⚡ Pulse generated program for ${name} (${level}, ${goal}), ${styleExamples.length} style refs`);
    return { program, steps, clientName: name };
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// pulseGenerateFree — Public Pulse AI, no auth required
// Generates a FREE 1-week program for landing page visitors
// Saves visitor info as a lead in Firestore automatically
// ─────────────────────────────────────────────────────────────────────────────
exports.pulseGenerateFree = onCall(
  {
    secrets: [GROQ_API_KEY],
    region: "asia-southeast1",
    timeoutSeconds: 120,
    memory: "512MiB",
    cors: true,
  },
  async (request) => {
    const { name, email, goal, level, sessionsPerWeek, sessionDuration, gender, weight, height, age, limitations } = request.data || {};

    // Validate required fields
    if (!name || !email || !goal || !level || !sessionsPerWeek) {
      throw new HttpsError("invalid-argument", "Thiếu thông tin: name, email, goal, level, sessionsPerWeek là bắt buộc.");
    }
    const sessionsParsed = parseInt(sessionsPerWeek);
    if (isNaN(sessionsParsed) || sessionsParsed < 3 || sessionsParsed > 7) {
      throw new HttpsError("invalid-argument", "Sessions per week must be between 3 and 7.");
    }
    const durationParsed = parseInt(sessionDuration) === 90 ? 90 : 60;
    if (sessionDuration !== undefined && sessionDuration !== null && ![60, 90].includes(durationParsed)) {
      console.warn("[pulseGenerateFree] Unexpected sessionDuration value:", sessionDuration, "→ defaulting to 60");
    }
    const durationRules = durationParsed === 90
      ? `SESSION DURATION: 90 minutes. RULES: Warm-up 10–12 min (3 exercises). Main block: 4–5 compounds. Accessories: 3–4 isolation exercises. Add a conditioning finisher (10–15 min) on all non-max-effort days. Total exercises per session: 8–10.`
      : `SESSION DURATION: 60 minutes. RULES: Warm-up 8–10 min (2 exercises). Main block: 3 compounds. Accessories: 2 isolation exercises. No finisher unless goal is fat loss. Total exercises per session: 6–7 MAX.`;

    const db = getFirestore();
    const steps = [];

    // ── Step 1: Save as lead ─────────────────────────────────────────────────
    steps.push({ icon: "📝", text: "Lưu thông tin..." });
    try {
      const leadRef = db.collection("leads").doc();
      await leadRef.set({
        name,
        email,
        goal,
        source: "free_program",
        status: "new",
        note: `Level: ${level} | Sessions/week: ${sessionsParsed} | Duration: ${durationParsed}min${gender ? ` | Gender: ${gender}` : ""}${age ? ` | Age: ${age}` : ""}${weight ? ` | Weight: ${weight}kg` : ""}${height ? ` | Height: ${height}cm` : ""}`,
        createdAt: new Date().toISOString(),
      });
    } catch (e) {
      console.warn("[pulseGenerateFree] Could not save lead:", e.message);
    }

    // ── Step 2: Build context ─────────────────────────────────────────────────
    steps.push({ icon: "🎯", text: "Phân tích mục tiêu của bạn..." });

    const sessions = sessionsParsed;
    const dayMaps = {
      // 1 and 2 were missing, so every 2-session client silently fell through to
      // the 3-day map and got a day they never agreed to train.
      1: ["Wed"],
      2: ["Tue", "Fri"],
      3: ["Mon", "Wed", "Fri"],
      4: ["Mon", "Tue", "Thu", "Fri"],
      5: ["Mon", "Tue", "Wed", "Thu", "Fri"],
      6: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      7: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    };
    const days = dayMaps[sessions] || dayMaps[3];

    // ── Step 3: Read coach style samples ────────────────────────────────────
    steps.push({ icon: "🎨", text: "Học phong cách coaching..." });
    let styleContext = "";
    try {
      const allClientsSnap = await db.collection("clients").get();
      const styleExamples = [];
      for (const doc of allClientsSnap.docs) {
        const data = doc.data();
        if (!data.program) continue;
        const dayKeys = Object.keys(data.program);
        if (dayKeys.length === 0) continue;
        const sampleDay = data.program[dayKeys[0]];
        styleExamples.push({ clientLevel: data.level, clientGoal: data.goal, sampleSession: sampleDay });
      }
      if (styleExamples.length > 0) {
        styleContext = `
COACH'S TRAINING STYLE (learned from ${styleExamples.length} real programs):
${styleExamples.slice(0, 2).map((ex, i) => `
Example ${i + 1} — ${ex.clientLevel} client, goal: ${ex.clientGoal}:
${JSON.stringify(ex.sampleSession, null, 2).substring(0, 600)}
`).join("")}
IMPORTANT: Mirror this coaching style — same phase structure, similar exercise selection, same cue/note format.`;
      }
    } catch (e) {
      console.warn("[pulseGenerateFree] Could not load style examples:", e.message);
    }

    // ── Step 3b: BMI & age analysis ──────────────────────────────────────────
    let bmiContext = "";
    if (weight && height) {
      const bmi = weight / Math.pow(height / 100, 2);
      const bmiRounded = Math.round(bmi * 10) / 10;
      let bmiCategory, bmiRule;
      if (bmi < 18.5) {
        bmiCategory = "Underweight";
        bmiRule =
          "Client is UNDERWEIGHT (BMI " + bmiRounded + "). " +
          "OVERRIDE: Prioritise muscle gain and caloric output even if goal mentions fat loss. " +
          "Avoid excessive cardio. Focus on compound strength movements and high-protein cues. " +
          "Keep rest periods 90-120s to maximise muscle stimulus.";
      } else if (bmi < 25) {
        bmiCategory = "Normal weight";
        bmiRule =
          "Client is at NORMAL weight (BMI " + bmiRounded + "). " +
          "Follow the stated goal without override. Standard periodisation applies.";
      } else if (bmi < 30) {
        bmiCategory = "Overweight";
        bmiRule =
          "Client is OVERWEIGHT (BMI " + bmiRounded + "). " +
          "TUNE: Increase metabolic demand — more compound movements, shorter rest (45-60s), " +
          "add conditioning finisher to every session. " +
          "Even if goal is muscle gain, include 1 cardio/conditioning phase per session.";
      } else {
        bmiCategory = "Obese";
        bmiRule =
          "Client is in OBESE range (BMI " + bmiRounded + "). " +
          "OVERRIDE: Fat loss is the primary objective regardless of stated goal. " +
          "Use low-impact exercises (no jumping, avoid heavy spinal loading). " +
          "Full-body circuits, moderate weights, 15-20 reps, 30-45s rest. " +
          "Build cardiovascular base first. Include a low-intensity cardio phase every session.";
      }
      bmiContext += `\nBODY METRICS:\n- Weight: ${weight}kg | Height: ${height}cm | BMI: ${bmiRounded} (${bmiCategory})\n- ${bmiRule}`;
    } else if (weight) {
      bmiContext += `\nBODY METRICS:\n- Weight: ${weight}kg`;
    }

    let ageContext = "";
    if (age) {
      if (age < 25) {
        ageContext =
          `\nAGE (${age}): Young athlete — can handle high volume and frequency. ` +
          "Fast recovery. Can include more intensity techniques (supersets, drop sets).";
      } else if (age <= 40) {
        ageContext =
          `\nAGE (${age}): Standard adult — balanced volume and intensity. ` +
          "Standard warm-up protocol.";
      } else if (age <= 55) {
        ageContext =
          `\nAGE (${age}): 40+ athlete — extend warm-up to 10-12 min, include extra mobility work. ` +
          "Reduce max-effort frequency. Add 30s extra rest between sets. " +
          "Avoid high-impact plyometrics. Prioritise joint health cues in exercise notes.";
      } else {
        ageContext =
          `\nAGE (${age}): 55+ athlete — CRITICAL: prioritise mobility, balance, and injury prevention. ` +
          "Longer warm-up (12-15 min), lower intensity (RPE 6-7 max), avoid heavy axial loading. " +
          "Include balance drills in warm-up. Rest 2-3 min between sets. " +
          "Prefer machines and cables over free-weight barbells where possible.";
      }
    }

    // ── Limitation warm-up note ───────────────────────────────────────────────
    let limitationWarmupNote = "";
    if (limitations && limitations.trim() && limitations.toLowerCase() !== "none") {
      const lList = limitations.split(",").map(s => s.trim().toLowerCase());
      const lMods = [];
      if (lList.includes("lower_back_pain")) lMods.push("Lower back pain: no deadhinge, good morning, sit-up in warm-up. Use Bird Dog, Hip Thrust activation instead.");
      if (lList.includes("shoulder_pain"))   lMods.push("Shoulder pain: no overhead arm circles, upright-row warm-up, behind-neck movements. Use Band Pull-Apart, Shoulder CARs instead.");
      if (lList.includes("ankle_pain"))      lMods.push("Ankle pain: no jumping jacks, skipping, deep ankle dorsiflexion. Use ankle circles, seated calf activation, single-leg balance instead.");
      if (lList.includes("neck_stiffness"))  lMods.push("Neck stiffness: no shrugs, neck rolls under load. Use thoracic rotation, chin tucks instead.");
      if (lList.includes("knee_pain"))       lMods.push("Knee pain: no jump squats, deep-impact landing. Use box step-up, terminal knee extension, leg press instead.");
      if (lMods.length > 0) {
        limitationWarmupNote = "\nLIMITATIONS — apply strictly to warm-up and exercise selection:\n" + lMods.map((m, i) => `${i + 1}. ${m}`).join("\n");
      }
    }

    // ── Step 3b: Goal, level & split guidance (checks goal for HYROX keywords) ─
    const goalGuidance = detectGoal(goal, "");
    const splitGuidance = detectSplit(sessions, goal, "");

    const levelGuidanceMap = {
      Beginner:
        "Beginner: 2-3 sets per exercise, fundamental movement patterns only " +
        "(squat, hinge, push, pull, carry). Emphasise technique over load. " +
        "Longer warm-up, more mobility/activation work. Keep rest 90s+.",
      Intermediate:
        "Intermediate: 3-4 sets, compound + accessory split, moderate complexity. " +
        "Introduce progressive overload across sessions.",
      Advanced:
        "Advanced: 4-5 sets, higher volume, advanced techniques where appropriate " +
        "(tempo, pause reps). Complex periodisation across the week.",
    };
    const levelGuidance = levelGuidanceMap[level] || levelGuidanceMap["Intermediate"];

    // ── Step 4: Load exercise library ───────────────────────────────────────
    steps.push({ icon: "📚", text: "Loading exercise library..." });
    let exerciseLibraryContext = "";
    try {
      const exSnap = await db.collection("exercises").get();
      if (!exSnap.empty) {
        // Group by primary muscle
        const byMuscle = {};
        exSnap.docs.forEach((doc) => {
          const d = doc.data();
          if (!d.name) return;
          let muscle = "General";
          if (d.muscles && typeof d.muscles === "object") {
            const keys = Object.keys(d.muscles);
            if (keys.length > 0) muscle = keys[0];
          }
          if (!byMuscle[muscle]) byMuscle[muscle] = [];
          byMuscle[muscle].push(d.name);
        });

        const lines = Object.entries(byMuscle)
          .map(([m, names]) => `  ${m}: ${names.join(", ")}`)
          .join("\n");

        const hyroxExemption = isHyroxGoal(goal, "")
          ? "\nHYROX EXEMPTION: The following HYROX station exercises are ALWAYS allowed regardless of the library above: SkiErg, Sled Push, Sled Pull, Burpee Broad Jump, Rowing (erg), Farmer Carry, Sandbag Lunge, Wall Ball."
          : "";

        exerciseLibraryContext = `
EXERCISE LIBRARY — you MUST only pick exercises from this list:
${lines}
${hyroxExemption}
CRITICAL: Use ONLY the exact exercise names listed above (plus HYROX stations if applicable). Do NOT invent other exercises not in this list. Do NOT append equipment modifiers (e.g. "with Weighted Vest") to any name.`;
      } else {
        // Library empty — don't restrict, but still enforce clean naming
        console.warn("[pulseGenerateFree] Exercise library is empty in Firestore.");
        exerciseLibraryContext = `
EXERCISE NAMING RULE: Use standard, clean exercise names only (e.g. "Romanian Deadlift", "Lat Pulldown"). Do NOT append equipment modifiers like "with Weighted Vest" to any exercise name.`;
      }
    } catch (e) {
      // On error — don't restrict, just enforce clean naming
      console.warn("[pulseGenerateFree] Could not load exercise library:", e.message);
      exerciseLibraryContext = `
EXERCISE NAMING RULE: Use standard, clean exercise names only. Do NOT append equipment modifiers to exercise names.`;
    }

    // ── HYROX 4-WEEK PATH — branches here when HYROX goal detected ───────────
    if (isHyroxGoal(goal, "")) {
      steps.push({ icon: "🏆", text: "Building your 4-week HYROX prep plan..." });

      const hyroxGoalInput  = request.data.hyroxGoal   || "";
      const runPace         = request.data.runPace      || "";
      const injuries        = request.data.injuries     || ""; // comma-separated
      const trainingAge     = request.data.trainingAge  || "";

      // ── Session type map per day ────────────────────────────────────────────
      const hyroxDayTypes = {
        3: { Mon: "Strength — HYROX Stations", Wed: "Zone 2 Run", Fri: "Brick Session / Simulation" },
        4: { Mon: "Strength — HYROX Stations", Tue: "Zone 2 Run", Thu: "Tempo Run / Intervals", Fri: "Brick Session / Simulation" },
        5: { Mon: "Strength A — HYROX Stations", Tue: "Zone 2 Run", Wed: "Tempo Run / Intervals", Thu: "Strength B — Supporting", Fri: "Brick Session / Simulation" },
        6: { Mon: "Strength A — HYROX Stations", Tue: "Zone 2 Run", Wed: "Tempo Run / Intervals", Thu: "Strength B — Supporting", Fri: "Brick Session / Simulation", Sat: "Recovery / Mobility" },
      };
      const sessionDays = hyroxDayTypes[sessions] || hyroxDayTypes[4];

      // ── Run pace interpretation ─────────────────────────────────────────────
      const runPaceNote = {
        ">7:00/km":   "Running is a major limiter. Prioritise Zone 2 volume and form drills. Keep brick run distances at 400m. No tempo until Week 3.",
        "6:00-7:00/km": "Moderate runner. Build aerobic base, introduce 800m brick runs from Week 3. Tempo starts conservatively.",
        "5:00-6:00/km": "Solid runner. Focus on compromised running (run after stations). Push simulation distances. Pacing strategy cues in every session.",
        "<5:00/km":   "Strong runner. Running won't limit you. Focus on station endurance (Farmer Carry, Sled, Wall Ball). Risk: going out too fast — every session includes pacing cues.",
      }[runPace] || "";

      // ── Injury modifications ────────────────────────────────────────────────
      let injuryNote = "";
      if (injuries && !injuries.toLowerCase().includes("none") && injuries.trim()) {
        const iList = injuries.split(",").map(s => s.trim().toLowerCase());
        const mods = [];
        if (iList.includes("knee"))        mods.push("Knee: reduce lunge depth under fatigue. Sub Leg Press / Box Step-up for Sandbag Lunge when needed. Ankle stability drills in warm-up.");
        if (iList.includes("lower-back"))  mods.push("Lower back: replace heavy deadlifts with Hip Thrust and Cable Pull-Through. Core bracing cue on every posterior chain exercise.");
        if (iList.includes("ankle"))       mods.push("Ankle: add ankle circles + single-leg balance to every warm-up. Reduce impact in Wk1-2 (treadmill/track over road). Burpee BJ → step instead of jump.");
        if (iList.includes("shoulder"))    mods.push("Shoulder: sub SkiErg with Rowing same distance. No heavy overhead pressing. Include band pull-apart + shoulder CARs in warm-up.");
        if (mods.length > 0) injuryNote = "\nMANDATORY INJURY MODIFICATIONS:\n" + mods.map((m, i) => `${i + 1}. ${m}`).join("\n");
      }

      // ── Training age context ────────────────────────────────────────────────
      const experienceNote = {
        "< 6 months":  "Novice: movement quality over intensity. No simulation until Week 4. Brick = 2 stations max. Technique cues on every compound exercise.",
        "6-12 months": "Developing: introduce brick in Week 2. Simulation from Week 3 at 40%. Technique still important but can push intensity.",
        "1-3 years":   "Trained athlete: standard HYROX periodisation. Can push intensity from Week 2. Focus on pacing and transitions.",
        "3+ years":    "Experienced: accelerate loading. Simulation from Week 2. Emphasis on race strategy, lactate threshold, and mental pacing.",
      }[trainingAge] || "";

      // ── Race goal context ───────────────────────────────────────────────────
      const raceGoalNote = {
        "First race - just finish":  "GOAL: Finish safely. Conservative pacing (RPE 6-7 on runs). Master transitions. Never all-out on stations.",
        "Sub-1:30":                  "GOAL: Sub 1:30 — requires ~5:30/km run pace. Simulation target: complete all 8 stations in under 35 min total.",
        "Sub-1:15":                  "GOAL: Sub 1:15 — requires ~4:40/km run pace + strong stations. Lactate threshold is critical. Push tempo sessions.",
        "Sub-1:00":                  "GOAL: Sub 1:00 — elite target. ~4:00-4:15/km pace. Full simulation by Week 4. Maximum training stimulus.",
        "Already raced - PR":        "GOAL: PR — identify limiter (run vs stations) and bias training toward it. Aggressive taper Week 6.",
      }[hyroxGoalInput] || `GOAL: ${hyroxGoalInput || "Complete the race"}`;

      const daySchedule = Object.entries(sessionDays)
        .map(([d, type]) => `- ${d}: ${type}`).join("\n");

      const hyroxPrompt = `You are an expert HYROX coach. Generate a complete 4-week HYROX prep program as 2 phases (Phase 1 = Week 1-2, Phase 2 = Week 3-4).

ATHLETE:
- Name: ${name} | Level: ${level} | Gender: ${gender || "N/A"} | Age: ${age || "N/A"}
- Sessions/week: ${sessions} (${Object.keys(sessionDays).join(", ")})
- Training experience: ${trainingAge || "Not specified"}
${bmiContext}${ageContext}

RUNNING FITNESS (1km pace: ${runPace || "not specified"}):
${runPaceNote}

RACE TARGET:
${raceGoalNote}
${injuryNote}
${experienceNote ? `\nEXPERIENCE NOTE: ${experienceNote}` : ""}

${durationRules}

WEEKLY SESSION SCHEDULE:
${daySchedule}

4-WEEK PERIODISATION RULES:
PHASE 1 (Week 1-2) — BASE:
- Zone 2 only (no tempo). Brick = 2-3 stations, NO simulation. Run per leg: 400-800m.
- Station volume: 40-50% of race. Focus: technique + pacing + movement quality.

PHASE 2 (Week 3-4) — BUILD & PEAK:
- Tempo run introduced. Brick = 5-6 stations. Simulation at 60-80% (6-8 rounds).
- Compromised running: run immediately after station. Station volume: 70-80%.
- Week 4: Taper slightly — cut volume 20%, keep intensity. Race strategy cues every session.

HYROX SIMULATION SCALE (100% = SkiErg 1000m, Sled Push 50m, Sled Pull 50m, Burpee BJ 80m, Row 1000m, Farmer 200m, Lunge 100m, Wall Ball 100 reps):
- 40%: Ski 400m, Sled Push 20m, Row 400m, Farmer 80m, Lunge 40m, Wall Ball 40 reps
- 50%: Ski 500m, Sled Push 25m, Row 500m, Farmer 100m, Lunge 50m, Wall Ball 50 reps
- 60%: Ski 600m, Sled Push 30m, Row 600m, Farmer 120m, Lunge 60m, Wall Ball 60 reps
- 70%: Ski 700m, Sled Push 35m, Row 700m, Farmer 140m, Lunge 70m, Wall Ball 70 reps
- 80%: Ski 800m, Sled Push 40m, Row 800m, Farmer 160m, Lunge 80m, Wall Ball 80 reps
Run per round: 50%→600m, 60-70%→800m, 80%→1000m

ALLOWED EXERCISES (strength sessions): SkiErg, Sled Push, Sled Pull, Burpee Broad Jump, Rowing, Farmer Carry, Sandbag Lunge, Wall Ball, Deadlift, Romanian Deadlift, Hip Thrust, Bulgarian Split Squat, Goblet Squat, Leg Press, Dumbbell Lunge, Box Step-up, Pull-up, Bent-over Row, Seated Row, Lat Pulldown, Push-up, Dumbbell Press, Band Pull-apart, Plank, Dead Bug, Hip Flexor Stretch, Ankle Circles.

DISTANCE RULE: Farmer Carry / Sandbag Lunge / Sled Push / Sled Pull → setsReps in METERS (e.g. "3 x 40m"), never reps.

OUTPUT: Return ONLY raw JSON — no markdown, no text outside JSON.

CRITICAL JSON FORMAT — follow this EXACT structure. Each day has a "phases" array. Each phase has a "tag", "name", and "exercises" array. Each exercise has "name", "setsReps", "tempo", and "cue":

{
  "_type": "hyrox4week",
  "phase1": {
    "label": "Phase 1 — Base (Week 1–2)",
    "Mon": {
      "label": "Strength — HYROX Stations",
      "phases": [
        { "tag": "warmup", "name": "🔥 Warm-up", "exercises": [
            { "name": "Hip Flexor Stretch", "setsReps": "2 x 45s each", "tempo": "", "cue": "Open hips, breathe deep." },
            { "name": "Ankle Circles", "setsReps": "2 x 20", "tempo": "", "cue": "Loosen ankles for runs." }
        ]},
        { "tag": "strength", "name": "💪 HYROX Strength", "exercises": [
            { "name": "SkiErg", "setsReps": "4 x 200m", "tempo": "", "cue": "Drive hips back. Moderate pace." },
            { "name": "Wall Ball", "setsReps": "4 x 15", "tempo": "", "cue": "Full squat depth. Rest 90s." },
            { "name": "Farmer Carry", "setsReps": "4 x 30m", "tempo": "", "cue": "Shoulders back, neutral spine." }
        ]}
      ]
    },
    "Wed": {
      "label": "Zone 2 Run",
      "phases": [
        { "tag": "warmup", "name": "🔥 Activation", "exercises": [
            { "name": "Leg Swing", "setsReps": "2 x 15 each", "tempo": "", "cue": "Front and lateral swings." },
            { "name": "Hip Circle", "setsReps": "2 x 10 each", "tempo": "", "cue": "Mobilise hip flexors." }
        ]},
        { "tag": "run", "name": "🏃 Zone 2 Run", "exercises": [
            { "name": "Zone 2 Run", "setsReps": "1 x 30 min", "tempo": "", "cue": "RPE 4-5. Nasal breathing." }
        ]}
      ]
    }
  },
  "phase2": {
    "label": "Phase 2 — Build & Peak (Week 3–4)",
    "Mon": {
      "label": "Strength — HYROX Stations",
      "phases": [
        { "tag": "warmup", "name": "🔥 Warm-up", "exercises": [
            { "name": "Hip Flexor Stretch", "setsReps": "2 x 45s", "tempo": "", "cue": "Faster pace, race mindset." },
            { "name": "Dead Bug", "setsReps": "2 x 10", "tempo": "slow", "cue": "Brace core for carries." }
        ]},
        { "tag": "strength", "name": "💪 HYROX Strength — Peak", "exercises": [
            { "name": "SkiErg", "setsReps": "5 x 300m", "tempo": "", "cue": "Push splits vs Phase 1." },
            { "name": "Wall Ball", "setsReps": "5 x 20", "tempo": "", "cue": "60s rest. Hold depth." },
            { "name": "Farmer Carry", "setsReps": "4 x 50m", "tempo": "", "cue": "Add weight if form solid." }
        ]}
      ]
    }
  }
}

IMPORTANT: Fill in ALL days from the schedule (${Object.keys(sessionDays).join(', ')}) inside EACH of phase1, phase2.
Each day must have 2 phases minimum. Warmup: exactly 2 exercises. Strength/Run/Brick: 3 exercises max.
Cues: max 6 words each. Use the periodisation rules to make phases genuinely different.`;

      const groq = new Groq({ apiKey: GROQ_API_KEY.value(), maxRetries: 0 });
      let hyroxCompletion;
      try {
        hyroxCompletion = await groq.chat.completions.create({
          model: GROQ_MODEL,
          max_tokens: groqMaxTokens(days.length),
          temperature: 0.3,
          messages: [{ role: "user", content: hyroxPrompt }],
        });
      } catch (groqErr) {
        console.error("[pulseGenerateFree] Groq API error (HYROX):", groqErr.status || "", groqErr.message);
        throw new HttpsError("internal", groqErrorMessage(groqErr));
      }

      if (!hyroxCompletion.choices || !hyroxCompletion.choices[0] || !hyroxCompletion.choices[0].message) {
        console.error("[pulseGenerateFree] HYROX: Groq returned empty choices. Response:", JSON.stringify(hyroxCompletion).substring(0, 300));
        throw new HttpsError("internal", "AI returned an empty response — please try again.");
      }
      let hyroxRaw = hyroxCompletion.choices[0].message.content.trim();
      // Robust JSON extraction: strip markdown fences, then find first { to last }
      hyroxRaw = hyroxRaw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
      const hyroxStart = hyroxRaw.indexOf("{");
      const hyroxEnd   = hyroxRaw.lastIndexOf("}");
      if (hyroxStart === -1 || hyroxEnd === -1) {
        console.error("[pulseGenerateFree] HYROX: No JSON object found. Raw (first 300):", hyroxRaw.substring(0, 300));
        throw new HttpsError("internal", "HYROX plan generation failed — AI returned unexpected format. Please try again.");
      }
      hyroxRaw = hyroxRaw.substring(hyroxStart, hyroxEnd + 1);

      let hyroxProgram;
      try {
        hyroxProgram = JSON.parse(hyroxRaw);
      } catch (parseErr) {
        console.error("[pulseGenerateFree] HYROX JSON parse error:", parseErr.message, "| Raw (first 500):", hyroxRaw.substring(0, 500));
        throw new HttpsError("internal", "HYROX plan: AI response format error. Please try again.");
      }

      steps.push({ icon: "✅", text: "Your 4-week HYROX plan is ready!" });
      console.log(`[pulseGenerateFree] 🏆 4-week HYROX plan generated for ${name} (${sessions} days/week, goal: ${hyroxGoalInput})`);
      return { program: hyroxProgram, steps, clientName: name };
    }
    // ── END HYROX 6-WEEK PATH ─────────────────────────────────────────────────

    // ── Step 5: Build 4-week 2-phase prompt ─────────────────────────────────
    steps.push({ icon: "⚡", text: "Pulse đang tạo chương trình 4 tuần..." });

    const physicalContext = (gender || weight || height || age)
      ? `\nPHYSICAL INFO:${gender ? `\n- Gender: ${gender}` : ""}${age ? `\n- Age: ${age}` : ""}${weight ? `\n- Weight: ${weight}kg` : ""}${height ? `\n- Height: ${height}cm` : ""}`
      : "";

    const durationContext = durationRules;

    // ── Phase guidelines per goal ────────────────────────────────────────────
    const phaseGuidanceMap = {
      [GOAL_GUIDANCE.fatLoss]:
        `PHASE 1 — Strength Foundation (Week 1–2): Establish heavy top sets + back-off structure. 1st compound: 4 sets × 5–6 reps at 78–80% 1RM, RPE 8, 2–3 min rest. 2nd–3rd compound: 3 sets × 8–10 reps, RPE 7, 90s rest. Accessories: 2 sets × 12–15 reps. Conditioning finisher MANDATORY: 10 min moderate intensity (RPE 7). Cues: embed top set progression rule ("add +2.5kg when 6 clean reps × 2 sessions"). Anti-redundancy: max 2 pressing movements per push session; max 1 vertical + 1 horizontal pull per pull session.
PHASE 2 — Fat Burn Peak (Week 3–4): Increase top set intensity + finisher density. 1st compound: 4–5 sets × 4–5 reps at 82–85% 1RM, RPE 8–9, 2–3 min rest. 2nd compound: 3 sets × 8 reps, +2.5kg vs Phase 1. Accessories: add 1 set vs Phase 1, shorten rest by 15s. Finisher MANDATORY every session: 12–15 min, RPE 8–9 on moderate-load days / RPE 6–7 on max-effort days. Include LISS 2x/week separate. Cue: "Strength stable or up = muscle preserved on cut."`,

      [GOAL_GUIDANCE.muscle]:
        `PHASE 1 — Hypertrophy Base (Week 1–2): HIGH VOLUME, moderate load. Compounds: 3–4 sets × 8–12 reps at 65–70% 1RM, 60–90s rest, RIR 3. Slow eccentric mandatory (3-1-2 tempo). Accessories: 3 sets × 10–15 reps, 60s rest, 2-0-2 tempo. Focus: build work capacity, establish mind-muscle connection, perfect technique.
PHASE 2 — Strength Peak (Week 3–4): HIGH INTENSITY, heavy load. Compounds: 4–5 sets × 3–6 reps at 75–85% 1RM, 2–4 min rest, RIR 1–2. Push near-maximal effort on all main lifts. Accessories: maintain 6–10 reps, 75% 1RM, 60–90s rest. Cue MUST include: current % 1RM + "+2.5kg next session when top of rep range is hit".`,

      [GOAL_GUIDANCE.endurance]:
        `PHASE 1 — Aerobic Base (Week 1–2): High rep (15-20), minimal rest (30-45s). Zone 2 effort throughout. Introduce supersets. Build work capacity.
PHASE 2 — Threshold Development (Week 3–4): Add intervals or tempo sets. 15 reps, 30s rest. Push sustainable pace on cardio elements. Circuit density increases. Add 1 AMRAP set per session by Week 4.`,

      [GOAL_GUIDANCE.general]:
        `PHASE 1 — Foundation (Week 1–2): Full-body compound focus. 3 sets, 10-12 reps, 60-90s rest. Technique emphasis. Build base movement quality.
PHASE 2 — Progressive Development (Week 3–4): Add 1 set per exercise. 4 sets, 10 reps, 60s rest. Increase load by 5% vs Phase 1. Introduce accessory supersets. Vary rep ranges (8/12/15) by Week 4.`,
    };
    const phaseGuidance = phaseGuidanceMap[goalGuidance] || phaseGuidanceMap[GOAL_GUIDANCE.general];

    // Cue length rule — muscle plans need % 1RM + RIR embedded; others stay short
    const cueRule = goalGuidance === GOAL_GUIDANCE.muscle
      ? `- Main lift cues: include phase % 1RM, RIR target, progression note (e.g. "70% 1RM, RIR 3, +2.5kg top range"). Max 15 words.
- Accessory cues: max 6 words each.`
      : `- Cues: MAXIMUM 6 words each`;

    const prompt = `You are Pulse, an elite AI personal trainer. Generate a 4-week progressive training program as 2 phases (Phase 1 = Week 1-2, Phase 2 = Week 3-4).

CLIENT:
- Name: ${name} | Level: ${level} | Goal: ${goal}
- Sessions/week: ${sessions} (${days.join(", ")})${physicalContext}
${bmiContext}${ageContext}
${limitationWarmupNote}
GOAL: ${goalGuidance}
LEVEL: ${levelGuidance}
SPLIT: ${splitGuidance}
${durationContext}
${exerciseLibraryContext}
PERIODISATION (CRITICAL — phases must be genuinely different):
${phaseGuidance}

CRITICAL JSON FORMAT — return ONLY raw JSON, no markdown, no text outside JSON.
Each phase (phase1/phase2) has its own days. Each day → "phases" array → each phase → "exercises" array → each exercise: { "name", "setsReps", "tempo", "cue" }

EXAMPLE (follow this exact structure for all ${sessions} days across both phases):
{
  "_type": "general4week",
  "phase1": {
    "label": "Phase 1 — Foundation (Week 1–2)",
    "${days[0]}": {
      "label": "Session A — ${days[0] === 'Mon' ? 'Push' : 'Full Body'}",
      "phases": [
        { "tag": "warmup", "name": "🔥 Warm-up", "exercises": [
            { "name": "Hip Circle", "setsReps": "2 x 10 each", "tempo": "", "cue": "Mobilise hips, 65% effort." },
            { "name": "Band Pull-apart", "setsReps": "2 x 15", "tempo": "", "cue": "Activate rear delts." }
        ]},
        { "tag": "strength", "name": "💪 Main Lifts", "exercises": [
            { "name": "Bench Press", "setsReps": "3 x 10", "tempo": "3-1-2", "cue": "65% 1RM, elbow tuck." },
            { "name": "Romanian Deadlift", "setsReps": "3 x 10", "tempo": "3-1-1", "cue": "Hinge deep, feel hamstrings." },
            { "name": "Lat Pulldown", "setsReps": "3 x 12", "tempo": "2-1-2", "cue": "Drive elbows to hips." }
        ]},
        { "tag": "accessories", "name": "⚡ Accessories", "exercises": [
            { "name": "Incline DB Press", "setsReps": "3 x 12", "tempo": "2-0-2", "cue": "Upper chest focus." },
            { "name": "Cable Fly", "setsReps": "3 x 15", "tempo": "", "cue": "Squeeze at centre." }
        ]}
      ]
    }${days.length > 1 ? `,
    "${days[1]}": {
      "label": "Session B — ${days[1] === 'Wed' ? 'Pull' : 'Lower'}",
      "phases": [
        { "tag": "warmup", "name": "🔥 Warm-up", "exercises": [
            { "name": "Hip Flexor Stretch", "setsReps": "2 x 30s each", "tempo": "", "cue": "Open hips, breathe deep." },
            { "name": "Dead Bug", "setsReps": "2 x 10", "tempo": "slow", "cue": "Brace core throughout." }
        ]},
        { "tag": "strength", "name": "💪 Main Lifts", "exercises": [
            { "name": "Bent-over Row", "setsReps": "3 x 10", "tempo": "2-1-2", "cue": "Chest up, elbows to hip." },
            { "name": "Deadlift", "setsReps": "3 x 8", "tempo": "3-1-1", "cue": "Brace before pulling." },
            { "name": "Seated Row", "setsReps": "3 x 12", "tempo": "2-1-2", "cue": "Squeeze scapula at finish." }
        ]},
        { "tag": "accessories", "name": "⚡ Accessories", "exercises": [
            { "name": "Face Pull", "setsReps": "3 x 15", "tempo": "", "cue": "Elbows high, external rotate." },
            { "name": "Plank", "setsReps": "3 x 30s", "tempo": "", "cue": "Hollow body, breathe steady." }
        ]}
      ]
    }` : ''}
  },
  "phase2": {
    "label": "Phase 2 — Overload (Week 3–4)",
    "${days[0]}": {
      "label": "Session A — ${days[0] === 'Mon' ? 'Push' : 'Full Body'}",
      "phases": [
        { "tag": "warmup", "name": "🔥 Warm-up", "exercises": [
            { "name": "Hip Circle", "setsReps": "2 x 10 each", "tempo": "", "cue": "Faster pace, raise HR." },
            { "name": "Band Pull-apart", "setsReps": "2 x 15", "tempo": "", "cue": "Activate before heavy push." }
        ]},
        { "tag": "strength", "name": "💪 Main Lifts", "exercises": [
            { "name": "Bench Press", "setsReps": "4 x 8", "tempo": "3-1-2", "cue": "+2.5kg vs Phase 1." },
            { "name": "Romanian Deadlift", "setsReps": "4 x 8", "tempo": "3-1-1", "cue": "+5% load, perfect hinge." },
            { "name": "Lat Pulldown", "setsReps": "4 x 10", "tempo": "2-1-2", "cue": "Heavier, slow eccentric." }
        ]},
        { "tag": "accessories", "name": "⚡ Accessories", "exercises": [
            { "name": "Incline DB Press", "setsReps": "3 x 10", "tempo": "2-0-2", "cue": "+5% vs Phase 1." },
            { "name": "Cable Fly", "setsReps": "3 x 12", "tempo": "", "cue": "Superset with above." }
        ]}
      ]
    }
  }
}

NOW generate the COMPLETE program for ALL ${sessions} days (${days.join(', ')}) inside EACH of phase1, phase2.
- Use the split: ${splitGuidance}
- Vary sessions by muscle group — never repeat same muscle group two days in a row
- Each phase must be distinctly different in volume/load/rest
${WARMUP_RULES}
- Main: exactly 3 compounds. Accessories: exactly 2 isolation. Total = 7 exercises per day MAX.
${cueRule}
- Exercise names: clean standard names only
- Do NOT add any text outside the JSON`;

    // ── Step 5: Call Groq ─────────────────────────────────────────────────────
    const groq = new Groq({ apiKey: GROQ_API_KEY.value(), maxRetries: 0 });
    let completion;
    try {
      completion = await groq.chat.completions.create({
        model: GROQ_MODEL,
        max_tokens: groqMaxTokens(days.length),
        temperature: 0.35,
        messages: [{ role: "user", content: prompt }],
      });
    } catch (groqErr) {
      console.error("[pulseGenerateFree] Groq API error (general):", groqErr.status || "", groqErr.message);
      throw new HttpsError("internal", groqErrorMessage(groqErr));
    }

    if (!completion.choices || !completion.choices[0] || !completion.choices[0].message) {
      console.error("[pulseGenerateFree] General: Groq returned empty choices. Response:", JSON.stringify(completion).substring(0, 300));
      throw new HttpsError("internal", "AI returned an empty response — please try again.");
    }
    let raw = completion.choices[0].message.content.trim();
    raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    // Robust extraction: find first { to last }
    const rawStart = raw.indexOf("{");
    const rawEnd   = raw.lastIndexOf("}");
    if (rawStart !== -1 && rawEnd !== -1) raw = raw.substring(rawStart, rawEnd + 1);

    let program;
    try {
      program = JSON.parse(raw);
    } catch (parseErr) {
      console.error("[pulseGenerateFree] General JSON parse error:", parseErr.message, "| Raw (first 400):", raw.substring(0, 400));
      throw new HttpsError("internal", "Plan format error — please try again.");
    }
    steps.push({ icon: "✅", text: "Chương trình 4 tuần của bạn đã sẵn sàng!" });

    console.log(`[pulseGenerateFree] ⚡ 4-week program generated for ${name} (${level}, ${goal}, ${sessions} days/week)`);
    return { program, steps, clientName: name };
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// GEMINI — shared config for nutrition features
// Uses the Interactions API via @google/genai. Older gemini-1.x/2.0 models and
// the legacy @google/generative-ai SDK are both shut down — do not go back.
// Setup: firebase functions:secrets:set GEMINI_API_KEY
// ─────────────────────────────────────────────────────────────────────────────
const GEMINI_MODEL = "gemini-3.6-flash";

/**
 * Run a Gemini Interactions call and convert SDK/API failures into readable
 * HttpsErrors. Without this, any thrown error surfaces in the app as "INTERNAL".
 */
async function callGemini(apiKey, input, schema, label, thinking) {
  // require() and the constructor must live INSIDE the try. When they sat outside,
  // a missing package or a bad key threw an unhandled error and the client only
  // ever saw the generic "internal" — no way to tell what actually broke.
  let client;
  try {
    if (!apiKey || typeof apiKey !== "string" || apiKey.length < 10) {
      throw new HttpsError("failed-precondition",
        "GEMINI_API_KEY chưa được cấu hình. Chạy: firebase functions:secrets:set GEMINI_API_KEY");
    }
    const { GoogleGenAI } = require("@google/genai");
    client = new GoogleGenAI({ apiKey });
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    console.error(`[callGemini] init failed — ${err.code || ""} ${err.message}`);
    if (String(err.code) === "MODULE_NOT_FOUND" || /cannot find module/i.test(err.message || "")) {
      throw new HttpsError("failed-precondition",
        "Thiếu package @google/genai trên server. Chạy: cd functions && npm install, rồi deploy lại.");
    }
    throw new HttpsError("internal", `Không khởi tạo được Gemini: ${err.message}`);
  }

  try {
    const req = {
      model: GEMINI_MODEL,
      input,
      response_format: { type: "text", mime_type: "application/json", schema },
    };
    // Gemini 3 does extended reasoning by default. Reading a meal photo does not
    // need it, and the thinking budget is what pushed this past the 60s function
    // timeout — clients saw a bare "internal" after a full minute of waiting.
    if (thinking) req.generation_config = { thinking_level: thinking };
    const interaction = await client.interactions.create(req);
    return interaction.output_text;
  } catch (err) {
    const status = err.status || err.code || (err.error && err.error.code);
    const msg = (err.message || "").toLowerCase();
    console.error(`[callGemini] ${label} failed — status=${status} msg=${err.message}`);

    // Classify on the status code first. Matching the message alone misfiles
    // errors, because Gemini's quota text embeds "model: gemini-3.6-flash" —
    // that made every rate limit surface as "model not available for this API
    // key", i.e. a passing 429 looked like a permanently broken key.
    const wait = (err.message || "").match(/retry in ([\d.]+)\s*s/i);
    // Gói free có HAI hạn mức khác hẳn nhau: vài lượt mỗi phút, và 20 lượt mỗi
    // NGÀY. Gemini gợi ý "retry in Ns" cho cả hai, nên nếu chỉ đọc con số đó thì
    // hạn mức ngày bị báo thành "đợi 23 giây" — người dùng bấm lại, hỏng tiếp, và
    // mỗi lần bấm lại tiêu thêm một lượt trong số 20. Phân biệt bằng chữ "per day".
    const daily = /per day|\bdaily\b|requests per day/i.test(err.message || "");
    const RATE = () => new HttpsError("resource-exhausted", daily
      ? "DAILY: Hết hạn mức Gemini trong ngày (gói free cho 20 lượt/ngày, tính chung "
        + "cho cả phân tích giấc ngủ lẫn ảnh món ăn). Hạn mức đặt lại theo ngày của "
        + "Google, khoảng 14:00 giờ Việt Nam. Bấm lại bây giờ chỉ tốn thêm lượt. "
        + "Muốn bỏ trần thì bật thanh toán trong Google AI Studio."
      : "Gemini quá tải tạm thời"
        + (wait ? `, thử lại sau khoảng ${Math.ceil(parseFloat(wait[1]))} giây.` : ", thử lại sau một phút."));
    const BUSY = () => new HttpsError("unavailable", "Gemini is overloaded — please try again in a few minutes.");
    const KEY  = () => new HttpsError("failed-precondition",
      "Invalid Gemini API key. Check the GEMINI_API_KEY secret — the key must come from aistudio.google.com and start with 'AIza'.");
    const MODEL = () => new HttpsError("failed-precondition",
      `Model "${GEMINI_MODEL}" is not available for this API key. The model may have been renamed, or the key lacks access.`);

    // Gemini itself hung. Without this the client only ever saw "internal".
    if (msg.includes("deadline") || msg.includes("timeout") || msg.includes("timed out") ||
        status === 504 || err.code === "ETIMEDOUT" || err.name === "AbortError") {
      throw new HttpsError("deadline-exceeded",
        "Gemini phản hồi quá chậm. Thử lại, hoặc nhập tay bằng nút Manual.");
    }
    if (status === 429) throw RATE();
    if (status === 503 || status === 500) throw BUSY();
    if (status === 401 || status === 403) throw KEY();
    if (status === 404) throw MODEL();

    // No usable status — fall back to the message, most specific first.
    if (msg.includes("quota") || msg.includes("rate limit") || msg.includes("resource_exhausted")) throw RATE();
    if (msg.includes("overloaded") || msg.includes("unavailable")) throw BUSY();
    if (msg.includes("api key") || msg.includes("unauthenticated") || msg.includes("permission denied")) throw KEY();
    if (msg.includes("not found") || msg.includes("does not exist") || msg.includes("not supported")) throw MODEL();
    throw new HttpsError("internal", `Gemini error (${label}): ${err.message}`);
  }
}

/** Parse a Gemini structured-output response, tolerating stray fences/prose. */
function parseGeminiJson(text, label) {
  const raw = (text || "").trim();
  if (!raw) {
    throw new HttpsError("internal", `Gemini returned an empty response for ${label}. Please try again.`);
  }
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch (e2) { /* fall through */ }
    }
    console.error(`[parseGeminiJson] ${label} parse failed. Raw (first 400):`, cleaned.substring(0, 400));
    throw new HttpsError("internal", `Could not read the ${label} result. Please try again.`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// analyzeMealPhoto — Gemini Vision, HTTPS Callable
// Takes a base64-encoded meal photo and returns macro estimates.
// ─────────────────────────────────────────────────────────────────────────────
exports.analyzeMealPhoto = onCall(
  {
    secrets: [GEMINI_API_KEY],
    region: "asia-southeast1",
    // 60s was not enough: the function was killed mid-call and the client got a
    // bare "internal" after exactly 60s. thinking_level "minimal" should bring
    // this well under 15s; the wider budget is just a safety net.
    timeoutSeconds: 120,
    memory: "512MiB",
  },
  async (request) => {
    const { imageBase64, mimeType, userHint } = request.data || {};

    if (!imageBase64) {
      throw new HttpsError("invalid-argument", "imageBase64 is required");
    }

    // The person who ate the meal knows what it was — their correction beats
    // anything the model can infer from a flat photo (hidden oil, broth, portion).
    const hint = (userHint || "").trim().slice(0, 600);
    const hintBlock = hint ? `

THE PERSON WHO ATE THIS MEAL HAS DESCRIBED IT — TREAT THIS AS GROUND TRUTH:
"${hint}"

How to use it:
- If they name a dish, use that dish even when the photo suggests otherwise. They were there; you were not.
- If they give quantities, weights or counts, use those numbers exactly instead of estimating from the image.
- If they mention cooking method or ingredients you cannot see (oil, butter, broth, sugar, sauce), add those calories — invisible fats and sugars are the single biggest source of error in photo estimates.
- If they mention something not visible in the photo, still include it.
- If their description conflicts with the image, follow the description.
- Set "confidence" to "high" when their description covers the whole meal.` : "";

    const prompt = `You are a nutrition expert. Analyze this meal photo and estimate its nutritional content.${hintBlock}

Rules:
- Identify every visible food and drink item; list each distinct dish as a separate entry in "foods"
- Estimate realistic Vietnamese and Asian meal portions where applicable
- All macro values in grams, calories in kcal
- "confidence": "low" (mixed/unclear dish), "medium" (reasonable estimate), "high" (clearly identifiable food)
- Be slightly conservative — underestimate rather than overestimate
- "total" must be the sum of all items in "foods"
- Write "note" in ENGLISH, one short sentence about estimation accuracy
- If the image contains no food at all, set "isFood" to false, return an empty "foods" array, zeros in "total", and explain in "note"`;

    const macroProps = {
      calories: { type: "number" },
      protein:  { type: "number" },
      carbs:    { type: "number" },
      fat:      { type: "number" },
    };

    const schema = {
      type: "object",
      properties: {
        isFood: { type: "boolean" },
        foods: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name:    { type: "string" },
              portion: { type: "string" },
              ...macroProps,
            },
            required: ["name", "portion", "calories", "protein", "carbs", "fat"],
          },
        },
        total: {
          type: "object",
          properties: macroProps,
          required: ["calories", "protein", "carbs", "fat"],
        },
        confidence: { type: "string", enum: ["low", "medium", "high"] },
        note: { type: "string" },
      },
      required: ["isFood", "foods", "total", "confidence", "note"],
    };

    // Text prompt goes BEFORE the image — recommended for single-image requests
    const outputText = await callGemini(
      GEMINI_API_KEY.value(),
      [
        { type: "text", text: prompt },
        { type: "image", data: imageBase64, mime_type: mimeType || "image/jpeg" },
      ],
      schema,
      "meal photo",
      "minimal"          // identifying food needs recognition, not deliberation
    );

    const parsed = parseGeminiJson(outputText, "meal photo");

    if (parsed.isFood === false) {
      throw new HttpsError("invalid-argument", parsed.note || "No food detected in this image.");
    }

    console.log(`[analyzeMealPhoto] ${parsed.foods ? parsed.foods.length : 0} foods, ${parsed.total ? parsed.total.calories : "?"}kcal`);
    return parsed;
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// recommendMacros — Gemini, HTTPS Callable
// Reads the client's InBody baseline + checkpoints + goal + training load,
// then returns recommended daily macro targets with reasoning.
// ─────────────────────────────────────────────────────────────────────────────
exports.recommendMacros = onCall(
  {
    secrets: [GEMINI_API_KEY],
    region: "asia-southeast1",
    timeoutSeconds: 90,
    memory: "256MiB",
  },
  async (request) => {
    const { clientId } = request.data || {};
    if (!clientId) throw new HttpsError("invalid-argument", "clientId is required");

    const db = getFirestore();

    // ── Read client profile ──────────────────────────────────────────────────
    const clientDoc = await db.collection("clients").doc(clientId).get();
    if (!clientDoc.exists) throw new HttpsError("not-found", "Client not found: " + clientId);
    const client = clientDoc.data();
    const { name, level, goal, sessionsPerWeek, notes } = client;

    // ── Read InBody baseline ─────────────────────────────────────────────────
    const baseDoc = await db.collection("clients").doc(clientId)
      .collection("assessment").doc("baseline").get();
    const baseline = baseDoc.exists ? baseDoc.data() : null;

    // ── Read checkpoints (most recent first) ─────────────────────────────────
    const cpSnap = await db.collection("clients").doc(clientId)
      .collection("checkpoints").orderBy("date", "desc").limit(4).get();
    const checkpoints = cpSnap.docs.map((d) => d.data());

    // Latest measurement = most recent checkpoint, else baseline
    const latest = checkpoints.length > 0 ? checkpoints[0] : baseline;
    if (!latest || !latest.weight) {
      throw new HttpsError(
        "failed-precondition",
        "No InBody data found for this client. Add a baseline assessment first."
      );
    }

    // ── Build measurement context ────────────────────────────────────────────
    const w   = parseFloat(latest.weight) || null;
    const h   = parseFloat(latest.height || (baseline && baseline.height)) || null;
    const a   = parseInt(latest.age || (baseline && baseline.age)) || null;
    const g   = latest.gender || (baseline && baseline.gender) || "";
    const pbf = parseFloat(latest.pbf) || null;
    const smm = parseFloat(latest.smm) || null;

    const lines = [];
    lines.push(`- Weight: ${w}kg | Height: ${h || "?"}cm | Age: ${a || "?"} | Gender: ${g || "?"}`);
    if (w && h) {
      const bmi = Math.round((w / Math.pow(h / 100, 2)) * 10) / 10;
      lines.push(`- BMI: ${bmi}`);
    }
    let lbm = null;
    if (pbf !== null) {
      // Lean body mass — the basis for protein targeting.
      // NOTE: LBM (fat-free mass: muscle + bone + organs + water) is NOT the same
      // as SMM (skeletal muscle only). SMM is typically ~50-55% of LBM.
      lbm = Math.round((w * (1 - pbf / 100)) * 10) / 10;
      lines.push(`- Body Fat: ${pbf}%`);
      lines.push(`- Lean Body Mass (LBM, fat-free mass = muscle + bone + organs + water): ${lbm}kg`);
    }
    if (smm !== null) {
      lines.push(`- Skeletal Muscle Mass (SMM, skeletal muscle ONLY — a subset of LBM, not the same number): ${smm}kg`);
    }
    if (latest.bmr) lines.push(`- InBody-measured BMR: ${latest.bmr} kcal`);
    if (latest.vfl) lines.push(`- Visceral Fat Level: ${latest.vfl} (healthy is under 10)`);
    if (latest.waist && latest.hip) {
      lines.push(`- Waist: ${latest.waist}cm | Hip: ${latest.hip}cm`);
    }

    // ── Trend across checkpoints ─────────────────────────────────────────────
    let trendContext = "";
    if (checkpoints.length >= 2) {
      const oldest = checkpoints[checkpoints.length - 1];
      const dW   = ((latest.weight || 0) - (oldest.weight || 0)).toFixed(1);
      const dPBF = ((latest.pbf   || 0) - (oldest.pbf   || 0)).toFixed(1);
      const dSMM = ((latest.smm   || 0) - (oldest.smm   || 0)).toFixed(1);
      trendContext = `
PROGRESS TREND (${checkpoints.length} checkpoints):
- Weight: ${oldest.weight}kg → ${latest.weight}kg (${dW > 0 ? "+" : ""}${dW}kg)
- Body Fat: ${oldest.pbf || "?"}% → ${latest.pbf || "?"}% (${dPBF > 0 ? "+" : ""}${dPBF}%)
- Muscle Mass: ${oldest.smm || "?"}kg → ${latest.smm || "?"}kg (${dSMM > 0 ? "+" : ""}${dSMM}kg)

IMPORTANT: Use this trend to adjust the calorie target. If the client is not progressing toward their goal, adjust calories accordingly (e.g. fat loss stalled → reduce deficit further; muscle gain stalled → increase surplus; losing muscle → raise protein and reduce deficit).`;
    } else {
      trendContext = "\nPROGRESS TREND: First measurement only — no trend data yet. Use standard calculations.";
    }

    // ── MINOR SAFEGUARD ──────────────────────────────────────────────────────
    // Under-18s are still growing. Never prescribe a caloric deficit.
    const isMinor = a !== null && a < 18;
    const minorRules = isMinor ? `
⚠️ CRITICAL — THIS CLIENT IS ${a} YEARS OLD (A MINOR). THESE RULES OVERRIDE EVERYTHING BELOW:
1. DO NOT prescribe a caloric deficit under any circumstances, even if the stated goal is fat loss. Adolescents are still growing; energy restriction during puberty can impair final adult height and bone density, and is a known risk factor for disordered eating.
2. Set calories at MAINTENANCE (full TDEE) or slightly above. Body composition improves through growth, training and food quality — not restriction.
3. Frame the goal as "grow into their weight": as they gain height and muscle, body fat percentage falls on its own without cutting calories.
4. Emphasise protein adequacy, calcium, iron, and total nutrient density rather than any limit.
5. In the reasoning field, state plainly that a deficit is not appropriate at this age and that these are maintenance targets supporting growth.
6. Set "isMinor": true and put a clear note in "medicalNote" advising that nutrition for an under-18 athlete should be supervised by a parent/guardian and reviewed with a paediatrician or registered dietitian, and that these numbers are general guidance only.
7. Do NOT use adult body-fat classifications — adolescent body composition is assessed against age-and-sex growth charts, not adult thresholds. Avoid labelling the client "overweight" or "high body fat".
` : "";

    const prompt = `You are a sports nutritionist. Calculate personalized daily macro targets for this client based on their InBody body composition scan.
${minorRules}

CLIENT:
- Name: ${name}
- Training level: ${level || "Intermediate"}
- Goal: ${goal || "General fitness"}
- Training sessions per week: ${sessionsPerWeek || 3}
${notes && notes.trim() && notes.trim().toLowerCase() !== "none" ? `- Notes / limitations: ${notes}` : ""}

INBODY MEASUREMENTS (most recent):
${lines.join("\n")}
${trendContext}

CALCULATION METHOD — follow this precisely:
1. BMR: use the InBody-measured BMR if provided above. Otherwise use the Katch-McArdle formula (BMR = 370 + 21.6 × Lean Body Mass in kg) if body fat % is known, else Mifflin-St Jeor.
2. TDEE: multiply BMR by an activity factor based on training frequency:
   - 3 sessions/week → 1.45  | 4 → 1.55  | 5 → 1.65  | 6 → 1.725  | 7 → 1.8
   Adjust slightly for the client's job/lifestyle if implied by notes.
3. CALORIE TARGET — adjust TDEE by goal:
   - Fat loss: 15–20% deficit (never below BMR, never more than 25% deficit)
   - Muscle gain: 10–15% surplus
   - Recomposition: maintenance to 5% deficit
   - Endurance/HYROX/performance: maintenance to slight surplus (fuel the work)
   - General fitness: maintenance
4. PROTEIN — base on LEAN BODY MASS, not total weight:
   - Fat loss: 2.2–2.6 g per kg LBM (higher end preserves muscle in a deficit)
   - Muscle gain: 2.0–2.2 g per kg LBM
   - Endurance: 1.8–2.0 g per kg LBM
   If body fat % is unknown, use 1.8–2.2 g per kg total body weight instead.
5. FAT: 0.8–1.0 g per kg total body weight, minimum 20% of total calories (hormonal health).
6. CARBS: fill the remaining calories. (Protein 4 kcal/g, Carbs 4 kcal/g, Fat 9 kcal/g)
   Higher training frequency → push carbs higher. Verify the macros add up to the calorie target within ±30 kcal.

TERMINOLOGY — CRITICAL, the coach cross-checks these against the InBody printout:
- LBM and SMM are DIFFERENT numbers. Never treat them as interchangeable and never call LBM a muscle mass figure.
- LBM (Lean Body Mass / fat-free mass) = everything that is not fat: muscle + bone + organs + water.
  Always write it as "lean body mass (LBM)" or "fat-free mass (LBM)".
  NEVER call LBM "muscle mass" or "muscle" — that contradicts the SMM value on the client's InBody sheet and confuses the coach.
- SMM (Skeletal Muscle Mass) = skeletal muscle only, roughly 50-55% of LBM.
  Always write it as "skeletal muscle mass (SMM)".
- Protein is calculated per kg of LBM (this is the standard). When you state the protein figure, say it is per kg LBM explicitly so it cannot be confused with SMM.

Rules:
- All macro values must be whole numbers (integers)
- "bmr" and "tdee" are the intermediate values you calculated, in kcal
- Write "reasoning", "proteinNote", "adjustmentNote" and "medicalNote" in ENGLISH
- "reasoning": 2-3 sentences explaining the calorie target, referencing their actual body composition numbers
- "proteinNote": one short sentence on the protein target
- "adjustmentNote": one short sentence on what to adjust if progress stalls after 2-3 weeks
- "confidence": "high" if body fat % and weight are both known, "medium" if only weight, "low" if data is sparse
- "isMinor": true only if the client is under 18; "medicalNote" empty string unless isMinor is true
- Be practical and realistic, not textbook-extreme`;

    const schema = {
      type: "object",
      properties: {
        calories:       { type: "number" },
        protein:        { type: "number" },
        carbs:          { type: "number" },
        fat:            { type: "number" },
        bmr:            { type: "number" },
        tdee:           { type: "number" },
        reasoning:      { type: "string" },
        proteinNote:    { type: "string" },
        adjustmentNote: { type: "string" },
        confidence:     { type: "string", enum: ["low", "medium", "high"] },
        isMinor:        { type: "boolean" },
        medicalNote:    { type: "string" },
      },
      required: [
        "calories", "protein", "carbs", "fat", "bmr", "tdee",
        "reasoning", "proteinNote", "adjustmentNote", "confidence",
        "isMinor", "medicalNote",
      ],
    };

    // Echo the inputs back so the coach can verify what the numbers were derived from
    const basis = { weight: w, pbf, smm, lbm, age: a, gender: g, sessionsPerWeek: sessionsPerWeek || 3 };

    const outputText = await callGemini(
      GEMINI_API_KEY.value(),
      [{ type: "text", text: prompt }],
      schema,
      "macro recommendation"
    );

    const parsed = parseGeminiJson(outputText, "macro recommendation");

    // Sanity check — reject nonsense output
    ["calories", "protein", "carbs", "fat"].forEach((k) => {
      parsed[k] = Math.round(parseFloat(parsed[k]) || 0);
    });
    if (parsed.calories < 800 || parsed.calories > 6000) {
      throw new HttpsError("internal", "Recommendation out of safe range. Please try again.");
    }

    // ── Hard server-side floor for minors ────────────────────────────────────
    // Enforced in code, not just the prompt, so it cannot be bypassed.
    if (isMinor) {
      parsed.isMinor = true;
      if (!parsed.medicalNote) {
        parsed.medicalNote =
          "Client is under 18 — these are maintenance calories to support growth, not a weight-loss plan. " +
          "Parent or guardian consent is required, and a paediatrician or registered dietitian should review these targets before use.";
      }
      // If the model still returned a deficit, raise calories back to TDEE.
      const tdee = Math.round(parseFloat(parsed.tdee) || 0);
      if (tdee > 0 && parsed.calories < tdee) {
        const deficit = tdee - parsed.calories;
        parsed.calories = tdee;
        // Put the restored calories into carbs (4 kcal/g)
        parsed.carbs = Math.round(parsed.carbs + deficit / 4);
        console.warn(`[recommendMacros] Minor safeguard: raised calories ${tdee - deficit} → ${tdee}`);
      }
    }

    parsed.basis = basis;

    console.log(`[recommendMacros] ${name}: ${parsed.calories}kcal P${parsed.protein} C${parsed.carbs} F${parsed.fat} (LBM ${lbm}kg, SMM ${smm}kg)`);
    return parsed;
  }
);


// ═══════════════════════════════════════════════════════════════════════════
// POLAR RECOVERY SYNC
//
// Kéo giấc ngủ + Nightly Recharge từ Polar AccessLink về
// clients/{id}/recovery/{YYYY-MM-DD}, mỗi ngày một bản tóm tắt.
//
// Chỉ lưu số tóm tắt. API còn trả hrv_samples và heart_rate_samples —
// hàng trăm điểm mỗi đêm — phình doc cho những con số màn hình không hề dùng.
//
// Token AccessLink sống 3650 ngày nên KHÔNG cần refresh flow. Nó nằm trong
// Functions secret, không nằm trong Firestore và càng không nằm trong
// index.html (repo này public).
//
// Đặt secret một lần:
//   firebase functions:secrets:set POLAR_TOKEN
// ═══════════════════════════════════════════════════════════════════════════

const POLAR_API = "https://www.polaraccesslink.com";
const { parseFitHeartRate } = require("./fit-hr");
const { workoutStrain, dailyStrain, resolveHrMax } = require("./strain");
const { buildContext } = require("./brief-context");

// Client duy nhất đang nối Polar. Mỗi người cần token riêng, nên đây là map
// chứ không phải một hằng số — thêm người sau này chỉ là thêm một dòng.
const POLAR_CLIENTS = [{ clientId: "longchu", secret: () => POLAR_TOKEN.value() }];

async function polarGet(path, token) {
  const r = await fetch(POLAR_API + path, {
    headers: { Authorization: "Bearer " + token, Accept: "application/json" },
  });
  const text = await r.text();
  if (!r.ok) {
    throw new Error(`Polar ${path} → HTTP ${r.status}: ${String(text).slice(0, 200)}`);
  }
  try { return text ? JSON.parse(text) : null; } catch { return null; }
}

/** Tải file nhị phân (file FIT của buổi tập). */
async function polarGetBinary(path, token) {
  const r = await fetch(POLAR_API + path, { headers: { Authorization: "Bearer " + token } });
  if (!r.ok) throw new Error(`Polar ${path} → HTTP ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

/** Polar bọc mảng dưới nhiều tên khác nhau tuỳ endpoint. */
function polarArray(o, ...keys) {
  if (Array.isArray(o)) return o;
  for (const k of keys) if (o && Array.isArray(o[k])) return o[k];
  return [];
}

/** Gộp recharge + sleep thành một doc mỗi ngày. */
function buildRecoveryDocs(nightly, sleep) {
  const days = {};
  const seed = (d) => (days[d] = days[d] || { date: d, source: "polar" });

  for (const x of polarArray(nightly, "recharges", "nights")) {
    if (!x || !x.date) continue;
    seed(x.date).recharge = {
      rhr:        x.heart_rate_avg ?? null,
      hrv:        x.heart_rate_variability_avg ?? null,
      breathing:  x.breathing_rate_avg ?? null,
      beatToBeat: x.beat_to_beat_avg ?? null,
      // Đánh giá của chính Polar. Thang chính thức: nightly recharge 1..6
      // (very poor → very good), ans_charge -10..+10 quanh mức thường ngày,
      // ans status 1..5 (much below → much above usual). Polar cần vài đêm
      // nền mới điền, nên hai đêm đầu thường trống — để null, KHÔNG đoán.
      status:     x.nightly_recharge_status ?? null,
      ansCharge:  x.ans_charge ?? null,
      ansStatus:  x.ans_charge_status ?? null,
    };
  }
  for (const x of polarArray(sleep, "nights", "sleeps")) {
    if (!x || !x.date) continue;
    const total = (x.light_sleep || 0) + (x.deep_sleep || 0) +
                  (x.rem_sleep || 0) + (x.unrecognized_sleep_stage || 0);
    seed(x.date).sleep = {
      total,
      light: x.light_sleep ?? null,
      deep:  x.deep_sleep ?? null,
      rem:   x.rem_sleep ?? null,
      score: x.sleep_score ?? null,
      charge: x.sleep_charge ?? null,
      rating: x.sleep_rating ?? null,
      continuity: x.continuity ?? null,
      goal: x.sleep_goal ?? null,
      interruptions: x.total_interruption_duration ?? null,
      // Ba điểm thành phần Polar cộng lại thành sleep_score. Dùng thẳng số
      // của Polar thay vì tự tính lại từ tổng giờ ngủ.
      // ĐÁY nhịp tim trong đêm, tính từ mẫu thật. Khác với recharge.rhr, vốn là
      // TRUNG BÌNH ~4h đầu giấc ngủ. Karvonen cần đáy, không cần trung bình.
      hrMin: (() => {
        const v = Object.values(x.heart_rate_samples || {}).map(Number).filter((n) => n > 0);
        return v.length ? Math.min(...v) : null;
      })(),
      dur:   x.group_duration_score ?? null,
      solid: x.group_solidity_score ?? null,
      regen: x.group_regeneration_score ?? null,
      cycles: x.sleep_cycles ?? null,
      shortInt: x.short_interruption_duration ?? null,
      longInt:  x.long_interruption_duration ?? null,
      start: x.sleep_start_time ?? null,
      end:   x.sleep_end_time ?? null,
    };
  }
  return Object.keys(days).sort().map((k) => days[k]);
}

/** Lõi dùng chung cho cả lịch lẫn nút đồng bộ tay. */
/**
 * Tải của một ngày. Giữ CẢ HAI con số, vì chúng trả lời hai câu khác nhau:
 *
 *   cardioLoad — Polar tự tính (Training Load Pro). Không có trần, chỉ so được
 *                ngày này với ngày khác của cùng người. Không phải số của app.
 *   strain     — thang 0-21 của app, công thức mở trong functions/strain.js.
 *                Đọc được ngay ("14 là cao") và so được giữa các buổi.
 *
 * Nhịp tim lấy từ file FIT của từng buổi: mỗi giây một mẫu. Endpoint tóm tắt
 * chỉ cho trung bình và cao nhất, mà với kiểu tập ngắt quãng thì trung bình
 * xoá sạch cấu trúc buổi tập.
 */
/**
 * Gom các bản ghi của Polar thành từng BUỔI. Polar ghi một buổi thành nhiều
 * bản (app ghi môn, vòng ghi nhịp tim); hai bản của cùng buổi thì trùng giờ
 * nhau. Hai buổi khác nhau thì không.
 */
function groupSessions(exercises) {
  const recs = (exercises || [])
    .filter((x) => x && x.start_time)
    .map((x) => {
      const from = Date.parse(x.start_time.length <= 19 ? x.start_time + "Z" : x.start_time);
      const sec = _isoDur(x.duration) || 0;
      return { x, from, to: from + sec * 1000, sec };
    })
    .filter((r) => isFinite(r.from))
    .sort((a, b) => a.from - b.from);

  const groups = [];
  for (const r of recs) {
    const g = groups.find((q) => r.from < q.to && q.from < r.to);
    if (g) { g.items.push(r); g.from = Math.min(g.from, r.from); g.to = Math.max(g.to, r.to); }
    else groups.push({ from: r.from, to: r.to, items: [r] });
  }
  return groups;
}

function dayLoad(exercises, fitById, ctx, contSamples) {
  // Polar ghi MỘT buổi thành nhiều bản: app điện thoại ghi môn, vòng ghi nhịp
  // tim. Bản trước đây coi "không có calo" là bản trùng — sai. Buổi tạ hôm
  // 01/10 chạy 14:31-15:21 không có nhịp tim và cũng KHÔNG trùng bản nào, vậy
  // mà bị bỏ, nên ngày tập 2 buổi chỉ đếm 1. Dấu hiệu đúng là TRÙNG GIỜ.
  const groups = groupSessions(exercises);

  let cardio = 0, sec = 0;
  const series = [], workouts = [];

  for (const g of groups) {
    // Trong một buổi, bản có nhịp tim là bản đo được; bản kia chỉ có tên môn.
    const withHr = g.items.find((r) => fitById[r.x.id]) ||
                   g.items.find((r) => r.x.heart_rate && r.x.heart_rate.average);
    const named  = g.items.find((r) => r.x.detailed_sport_info &&
                   !/^OTHER/.test(r.x.detailed_sport_info)) || g.items[0];

    const cl = g.items.reduce((n, r) => {
      const v = Number(((r.x.training_load_pro || {})["cardio-load"]));
      return n + (isFinite(v) && v > 0 ? v : 0);
    }, 0);
    cardio += cl;
    const gsec = Math.round((g.to - g.from) / 1000);
    sec += gsec;

    let w = null;
    const samples = withHr ? fitById[withHr.x.id] : null;
    if (samples && samples.length > 1) { series.push(samples); w = workoutStrain(samples, ctx); }

    workouts.push({
      at: named.x.start_time,
      // Tên môn lấy từ bản có nhãn thật; bản của vòng hay ghi "OTHER_INDOOR".
      sport: named.x.detailed_sport_info || named.x.sport || "OTHER",
      sec: gsec,
      cardioLoad: cl > 0 ? Math.round(cl * 10) / 10 : null,
      strain: w ? w.strain : null,
      hrAvg: w ? w.hrAvg : ((withHr && withHr.x.heart_rate || {}).average ?? null),
      hrMax: w ? w.hrMax : ((withHr && withHr.x.heart_rate || {}).maximum ?? null),
      zoneSec: w ? w.zoneSec : null,
      samples: samples ? samples.length : 0,
      // Buổi có thật nhưng không đo nhịp tim: vẫn đếm, và nói rõ vì sao không
      // có strain, thay vì biến mất khỏi danh sách như trước.
      noHr: !samples,
      records: g.items.length,
    });
  }

  // Nhịp tim CẢ NGÀY, bỏ phần nằm trong cửa sổ buổi tập vì ở đó đã có dữ liệu
  // từng giây của file FIT. Không bỏ thì đoạn tập bị đếm hai lần.
  const wins = [];
  for (const g of groups) {
    const r = g.items.find((it) => fitById[it.x.id]);
    if (r) {
      const ts = fitById[r.x.id].map((p) => p.at).filter((v) => v != null);
      if (ts.length) wins.push({ from: Math.min(...ts), to: Math.max(...ts) });
    }
  }
  const outside = (contSamples || []).filter((p) =>
    !wins.some((wn) => p.at >= wn.from && p.at <= wn.to));
  if (outside.length > 1) series.push(outside);

  // Ngày nghỉ vẫn có tải: đi lại, leo cầu thang, căng thẳng. Bản trước trả null
  // khi không có buổi tập nào nên vòng Strain trống hẳn — sai, WHOOP vẫn có số
  // cho ngày nghỉ vì nó đọc nhịp tim cả ngày chứ không chỉ buổi tập.
  if (!workouts.length && outside.length < 2) return null;

  const day = series.length ? dailyStrain(series, ctx) : null;
  const noHr = workouts.filter((w) => w.noHr).length;
  return {
    cardioLoad: Math.round(cardio * 10) / 10,
    strain: day ? day.strain : null,
    rawLoad: day ? day.load : null,
    zoneSec: day ? day.zoneSec : null,
    hrMax: ctx.hrMax, hrMaxSource: ctx.hrMaxSource, rhr: ctx.rhr,
    sessions: workouts.length, sessionsNoHr: noHr, sec, workouts,
    allDaySamples: outside.length,
    source: "polar-fit + app-strain-v1",
  };
}
function _isoDur(v) {
  const m = /^PT(?:([\d.]+)H)?(?:([\d.]+)M)?(?:([\d.]+)S)?$/.exec(String(v || ""));
  if (!m) return null;
  return Math.round((+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0));
}

/**
 * Hoạt động ban ngày: bước chân, calo, và các buổi tập.
 *
 * Polar trả NHIỀU bản ghi cho cùng một buổi — bản có tuyến đường và bản có
 * nhịp tim là hai entry riêng, và chỉ bản nào có nhịp tim mới có calories.
 * Nên chỉ tính buổi CÓ calo; làm vậy là tự loại trùng, không cần khử tay.
 */
async function buildActivityDocs(token) {
  const [acts, exes] = await Promise.all([
    polarGet("/v3/users/activities", token).catch((e) => {
      console.warn("[polar] activities lỗi:", e.message); return null;
    }),
    polarGet("/v3/exercises", token).catch((e) => {
      console.warn("[polar] exercises lỗi:", e.message); return null;
    }),
  ]);

  const days = {};
  const seed = (d) => (days[d] = days[d] || { date: d, source: "polar", workouts: [] });

  for (const a of polarArray(acts, "activities", "data")) {
    if (!a || !a.start_time) continue;
    const d = String(a.start_time).slice(0, 10);
    Object.assign(seed(d), {
      steps: a.steps ?? null,
      calories: a.calories ?? null,
      activeCalories: a.active_calories ?? null,
      activeSec: _isoDur(a.active_duration),
      distanceM: a.distance_from_steps ?? null,
      activityScore: a.daily_activity ?? null,
    });
  }

  // Gom theo NGÀY rồi gom theo buổi bằng cách xét trùng giờ — giống dayLoad.
  // Lọc theo "có calo" như trước là bỏ mất buổi tạ không đeo đo nhịp tim, nên
  // ngày tập 2 buổi chỉ hiện 1.
  const exByDay = {};
  for (const x of polarArray(exes, "exercises", "data")) {
    if (!x || !x.start_time) continue;
    (exByDay[String(x.start_time).slice(0, 10)] ||= []).push(x);
  }
  for (const d of Object.keys(exByDay)) {
    for (const g of groupSessions(exByDay[d])) {
      const hr = g.items.find((r) => r.x.heart_rate && r.x.heart_rate.average);
      const named = g.items.find((r) => r.x.detailed_sport_info &&
        !/^OTHER/.test(r.x.detailed_sport_info)) || g.items[0];
      seed(d).workouts.push({
        at: named.x.start_time,
        sport: named.x.detailed_sport_info || named.x.sport || "OTHER",
        sec: Math.round((g.to - g.from) / 1000),
        calories: g.items.reduce((n, r) => n + (Number(r.x.calories) || 0), 0) || null,
        hrAvg: hr ? hr.x.heart_rate.average : null,
        hrMax: hr ? hr.x.heart_rate.maximum : null,
        noHr: !hr,
      });
    }
  }

  for (const d of Object.keys(days)) {
    const w = days[d].workouts;
    days[d].workoutCalories = w.reduce((n, x) => n + (x.calories || 0), 0);
    days[d].workoutSec = w.reduce((n, x) => n + (x.sec || 0), 0);
    w.sort((a, b) => String(a.at).localeCompare(String(b.at)));
  }
  return Object.keys(days).sort().map((k) => days[k]);
}

async function syncPolarFor(clientId, token) {
  const [nightly, sleep] = await Promise.all([
    polarGet("/v3/users/nightly-recharge", token),
    polarGet("/v3/users/sleep", token),
  ]);
  const docs = buildRecoveryDocs(nightly, sleep);
  if (!docs.length) return { clientId, written: 0, dates: [] };

  // Tải tim mạch theo ngày: cardio load của Polar + strain 0-21 của app.
  try {
    const exes = polarArray(await polarGet("/v3/exercises", token), "exercises", "data");
    const exByDate = {};
    let seenMax = 0;
    for (const x of exes) {
      if (!x || !x.start_time) continue;
      (exByDate[String(x.start_time).slice(0, 10)] = exByDate[String(x.start_time).slice(0, 10)] || []).push(x);
      const m = Number((x.heart_rate || {}).maximum);
      if (isFinite(m) && m > seenMax) seenMax = m;
    }

    // Nhịp tim nghỉ: ĐÁY thật trong đêm, không phải trung bình 4h đầu. Polar
    // trả trung bình ở nightly recharge; đáy nằm trong mẫu của endpoint sleep.
    const rhrByDate = {};
    for (const d of docs) {
      rhrByDate[d.date] = (d.sleep || {}).hrMin ?? (d.recharge || {}).rhr ?? null;
    }

    // Id người dùng Polar nằm sẵn trong mỗi bản ghi buổi tập — khỏi phải cấu
    // hình thêm một giá trị nữa và khỏi lệch khi đổi tài khoản.
    const uid = String((exes.find((x) => x && x.polar_user) || {}).polar_user || "").split("/").pop();
    const prof = uid ? await polarGet(`/v3/users/${uid}`, token).catch(() => null) : null;

    // maxHr do coach nhập từ bài test thật, nếu có, thắng mọi ước lượng.
    const cDoc = await getFirestore().collection("clients").doc(clientId).get().catch(() => null);
    const manual = cDoc && cDoc.exists ? cDoc.data().maxHr : null;

    const hm = resolveHrMax({
      manual, observed: seenMax,
      birthdate: prof && prof.birthdate,
      today: docs[docs.length - 1].date,
    });

    // Tải mọi file FIT MỘT LẦN và song song. Trước đó mỗi ngày tự tải tuần tự
    // bên trong vòng lặp, nên một tuần tập nhiều buổi là chạm trần 60 giây của
    // hàm và cả lần đồng bộ hỏng theo.
    const need = Object.values(exByDate).flat()
      .filter((x) => x.id && ((x.heart_rate && x.heart_rate.average) ||
        Number((x.training_load_pro || {})["cardio-load"]) > 0));
    const fitById = {};
    await Promise.all(need.map(async (x) => {
      try {
        const s = parseFitHeartRate(await polarGetBinary(`/v3/exercises/${x.id}/fit`, token));
        if (s && s.length > 1) fitById[x.id] = s;
        else console.warn(`[polar] FIT ${x.id}: không có mẫu nhịp tim`);
      } catch (e) {
        console.warn(`[polar] FIT ${x.id} lỗi — ${e.message}`);
      }
    }));
    console.log(`[polar] ${clientId}: ${Object.keys(fitById).length}/${need.length} file FIT, `
      + `HR max ${hm.hrMax} (${hm.source})`);

    // Nhịp tim cả ngày — nguồn duy nhất cho tải của ngày KHÔNG tập.
    const contByDate = {};
    try {
      const from = docs[0].date, to = docs[docs.length - 1].date;
      const chr = await polarGet(`/v3/users/continuous-heart-rate?from=${from}&to=${to}`, token);
      for (const d of polarArray(chr, "heart_rates", "data")) {
        if (!d || !d.date) continue;
        const p = d.date.split("-").map(Number);
        const base = Date.UTC(p[0], p[1] - 1, p[2]) / 1000;
        contByDate[d.date] = (d.heart_rate_samples || [])
          .map((x) => {
            const m = /^(\d{2}):(\d{2}):(\d{2})/.exec(String(x.sample_time || ""));
            const hr = Number(x.heart_rate);
            return m && hr > 0
              ? { at: base + (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]), hr } : null;
          })
          .filter(Boolean);
      }
      console.log(`[polar] nhịp tim cả ngày: ${Object.keys(contByDate).length} ngày`);
    } catch (e) {
      console.warn(`[polar] bỏ qua nhịp tim cả ngày — ${e.message}`);
    }

    for (const doc of docs) {
      const rhr = rhrByDate[doc.date];
      if (!hm.hrMax || rhr == null) {
        console.warn(`[polar] ${doc.date}: thiếu hrMax(${hm.hrMax}) hoặc rhr(${rhr}) — bỏ strain`);
        continue;
      }
      const load = dayLoad(exByDate[doc.date] || [], fitById,
        { rhr, hrMax: hm.hrMax, hrMaxSource: hm.source, sex: (prof && prof.gender) === "FEMALE" ? "female" : "male" },
        contByDate[doc.date] || []);
      if (load) doc.load = load;
    }
  } catch (e) {
    // Hỏng phần tải thì vẫn ghi phần giấc ngủ — đừng để một endpoint hỏng
    // làm mất luôn dữ liệu đã lấy được.
    console.warn(`[polar] ${clientId}: bỏ qua tải ngày — ${e.message}`);
  }

  const db = getFirestore();
  const col = db.collection("clients").doc(clientId).collection("recovery");
  const batch = db.batch();
  const now = new Date().toISOString();
  for (const d of docs) batch.set(col.doc(d.date), { ...d, updatedAt: now }, { merge: true });
  await batch.commit();

  // ── Hoạt động ban ngày, ghi vào subcollection riêng ────────────────────
  let actWritten = 0;
  try {
    const aDocs = await buildActivityDocs(token);
    if (aDocs.length) {
      const aCol = db.collection("clients").doc(clientId).collection("activity");
      const aBatch = db.batch();
      for (const d of aDocs) aBatch.set(aCol.doc(d.date), { ...d, updatedAt: now }, { merge: true });
      await aBatch.commit();
      actWritten = aDocs.length;
    }
  } catch (e) {
    // Hoạt động hỏng thì vẫn giữ phần giấc ngủ đã ghi được ở trên.
    console.warn(`[polar] ${clientId}: bỏ qua hoạt động — ${e.message}`);
  }

  return { clientId, written: docs.length, dates: docs.map((d) => d.date), activity: actWritten };
}

async function syncAllPolar() {
  const out = [];
  for (const c of POLAR_CLIENTS) {
    try {
      const r = await syncPolarFor(c.clientId, c.secret());
      console.log(`[polar] ${r.clientId}: ghi ${r.written} đêm, ${r.activity || 0} ngày hoạt động`);
      out.push(r);
    } catch (e) {
      // Một khách lỗi không được làm chết cả lượt chạy của những người còn lại.
      console.error(`[polar] ${c.clientId} LỖI:`, e.message);
      out.push({ clientId: c.clientId, error: e.message });
    }
  }
  return out;
}

/**
 * Polar đẩy dữ liệu về ngay khi mây của họ nhận được, thay vì mình chờ tới 7h
 * sáng hoặc coach bấm tay. Mỗi ứng dụng chỉ đăng ký được MỘT webhook, và Polar
 * tự tắt nó sau 7 ngày giao thất bại liên tục — nên hàm này phải luôn trả 200
 * thật nhanh, việc nặng làm sau khi đã trả lời.
 *
 * Xác thực bằng HMAC SHA-256 trên đúng chuỗi byte của thân yêu cầu. Không có
 * bước này thì bất kỳ ai biết URL cũng ghi được dữ liệu vào hồ sơ khách.
 */
exports.polarWebhook = onRequest(
  { region: "asia-southeast1", secrets: [POLAR_TOKEN, POLAR_WEBHOOK_SECRET, GEMINI_API_KEY],
    timeoutSeconds: 300, memory: "512MiB", cors: false },
  async (req, res) => {
    if (req.method !== "POST") return res.status(405).send("POST only");

    const raw = req.rawBody ? req.rawBody.toString("utf8") : JSON.stringify(req.body || {});
    const sig = req.get("Polar-Webhook-Signature") || "";
    const key = POLAR_WEBHOOK_SECRET.value();

    // Lúc đăng ký, Polar gửi một PING và CHƯA có khoá ký — nhận để URL được duyệt.
    let body = {};
    try { body = JSON.parse(raw); } catch (_e) {}
    const isPing = body && body.event === "PING";

    if (!isPing) {
      if (!key) { console.error("[polarWebhook] thiếu POLAR_WEBHOOK_SECRET"); return res.status(200).send("ok"); }
      const want = require("crypto").createHmac("sha256", key).update(raw).digest("hex");
      // So sánh theo thời gian cố định: so bằng === rò rỉ thông tin qua thời gian.
      const a = Buffer.from(want), b = Buffer.from(sig);
      const ok = a.length === b.length && require("crypto").timingSafeEqual(a, b);
      if (!ok) { console.warn("[polarWebhook] chữ ký sai — bỏ qua"); return res.status(200).send("ok"); }
    }

    // Trả 200 TRƯỚC khi làm việc nặng. Polar tính thất bại theo thời gian phản
    // hồi, và một lần đồng bộ mất vài giây.
    res.status(200).send("ok");
    if (isPing) return;

    const ev = String(body.event || "");
    const uid = String(body.user_id || "");
    console.log(`[polarWebhook] ${ev} user=${uid}`);

    // Chỉ những sự kiện làm đổi bức tranh mới đáng chạy. SLEEP là sự kiện một
    // lần mỗi đêm nên đó là chỗ sinh bản tóm tắt; các sự kiện khác chỉ kéo dữ
    // liệu, không gọi model, để không đốt token nhiều lần trong ngày.
    if (!["SLEEP", "EXERCISE", "ACTIVITY_SUMMARY", "CONTINUOUS_HEART_RATE"].includes(ev)) return;

    try {
      const c = POLAR_CLIENTS[0];
      const out = await syncPolarFor(c.clientId, c.secret());
      console.log(`[polarWebhook] ${c.clientId}: ghi ${out.written} đêm, ${out.activity || 0} ngày`);
      if (ev === "SLEEP") await generateBriefIfMissing(c.clientId);
    } catch (e) {
      console.error("[polarWebhook] lỗi:", e.message);
    }
  },
);

exports.syncPolarRecovery = onSchedule(
  {
    schedule: "0 7 * * *",
    timeZone: "Asia/Ho_Chi_Minh",
    region: "asia-southeast1",
    secrets: [POLAR_TOKEN, GEMINI_API_KEY],
    retryCount: 2,
    timeoutSeconds: 300,
    memory: "512MiB",
  },
  async () => {
    await syncAllPolar();
    // Lưới an toàn: webhook có thể bị Polar tắt sau 7 ngày giao lỗi, hoặc điện
    // thoại chưa đẩy dữ liệu lên kịp lúc webhook bắn. Lượt 7h sáng sinh bản
    // tóm tắt nếu đêm mới nhất chưa có — đã có rồi thì không gọi model.
    for (const c of POLAR_CLIENTS) await generateBriefIfMissing(c.clientId);
  },
);

/** Nút "đồng bộ ngay" — chỉ coach gọi được. */
exports.syncPolarNow = onCall(
  // Tải file FIT của cả tuần: mặc định 60s là không đủ khi tập nhiều.
  { region: "asia-southeast1", secrets: [POLAR_TOKEN], timeoutSeconds: 300, memory: "512MiB" },
  async (request) => {
    const email = request.auth && request.auth.token && request.auth.token.email;
    if (email !== COACH_EMAIL) {
      throw new HttpsError("permission-denied", "Chỉ coach mới đồng bộ được.");
    }
    return { results: await syncAllPolar() };
  },
);


// ═══════════════════════════════════════════════════════════════════════════
// RECOVERY BRIEF — đọc giấc ngủ đêm qua, nói hôm nay nên tập gì
//
// Kết quả được CACHE vào chính doc recovery của ngày đó. Mở lại tab không gọi
// model lần nữa; chỉ sinh mới khi chưa có, hoặc khi bấm làm mới (force).
// ═══════════════════════════════════════════════════════════════════════════

const BRIEF_SCHEMA = {
  type: "object",
  properties: {
    // Đúng 5 mức trong bảng quyết định của coach.
    recommendation: { type: "string",
      enum: ["train_hard", "moderate", "easy", "recovery", "rest"] },
    headline:  { type: "string" },
    why:       { type: "string" },   // yếu tố nào quyết định, kèm số
    readiness: { type: "string" },   // đọc Recovery
    sleepRead: { type: "string" },   // đọc Sleep + nợ ngủ
    loadRead:  { type: "string" },   // đọc Strain + tải gần đây
    nextSession: {
      type: "object",
      properties: {
        sessionKey: { type: "string" },   // key giáo án có thật, hoặc ""
        type:       { type: "string" },
        intensity:  { type: "string" },
        duration:   { type: "string" },
      },
      required: ["sessionKey", "type", "intensity", "duration"],
    },
    recoveryActions: { type: "array", items: { type: "string" } },
    watch:  { type: "string" },   // điều gì sẽ làm đổi khuyến nghị
    caveat: { type: "string" },
  },
  required: ["recommendation", "headline", "why", "readiness", "sleepRead",
             "loadRead", "nextSession", "recoveryActions", "watch", "caveat"],
};

const _r = (v) => (typeof v === "number" ? Math.round(v) : "—");

const _hm = (sec) => (sec == null ? "—"
  : Math.floor(sec / 3600) + "h" + String(Math.round((sec % 3600) / 60)).padStart(2, "0"));

function buildBriefPrompt(ctx) {
  const C = buildContext(ctx);
  if (!C) return null;
  const P = (o) => JSON.stringify(o, null, 1);
  const hm = (v) => _hm(v);

  const nights = ctx.nights.map((n) => {
    const s = n.sleep || {}, r = n.recharge || {}, l = n.load || {};
    return `${n.date} | ngủ ${hm(s.total)}/${hm(s.goal)} | score ${s.score ?? "—"}`
      + ` (thời lượng ${_r(s.dur)} bền giấc ${_r(s.solid)} tái tạo ${_r(s.regen)})`
      + ` | thức ${hm(s.interruptions)} | HRV ${r.hrv ?? "—"} | nhịp tim ngủ TB ${r.rhr ?? "—"}`
      + ` | đáy đêm ${s.hrMin ?? "—"} | Recharge ${r.status ?? "—"}/6 | ANS ${r.ansCharge ?? "—"}`
      + ` | strain ${l.strain ?? 0}${l.sessions ? ` (${l.sessions} buổi)` : ""}`
      + ` | lên giường ${(s.start || "").slice(11, 16) || "—"}`;
  }).join("\n");

  const act = C.activity.length
    ? C.activity.map((a) => `${a.date} | ${a.steps ?? "—"} bước | ${a.calories ?? "—"} kcal ngày`
        + ` | ${a.activeCalories ?? "—"} kcal vận động | tập ${a.workoutCalories || 0} kcal / ${hm(a.workoutSec)}`).join("\n")
    : "(không có)";

  const hist = C.history.length
    ? C.history.map((w) => `${w.date} — ${w.day || "?"} — ${w.done ?? "?"}/${w.total ?? "?"} bài`
        + (w.volume ? ` — ${Math.round(w.volume)} kg` : "")).join("\n")
    : "(khách không tự ghi lại buổi tập trong app)";

  const days = Object.keys(ctx.program || {}).sort();
  const prog = days.length
    ? days.map((d) => {
        const ph = (ctx.program[d].phases || [])
          .map((x) => `${x.name} (${(x.exercises || []).length} bài)`).join(", ");
        return `${d} — ${ctx.program[d].label || ""} :: ${ph}`;
      }).join("\n")
    : "(chưa có giáo án)";

  const bl = (b, unit) => b.enough || b.mean != null
    ? `hôm nay ${b.today ?? "—"}${unit} · nền ${b.mean}${unit} ± ${b.sd ?? "?"} qua ${b.n} đêm`
      + (b.z != null ? ` · lệch ${b.z > 0 ? "+" : ""}${b.z} độ lệch chuẩn` : "")
      + (b.enough ? "" : "  [nền mỏng, đọc như gợi ý]")
    : `hôm nay ${b.today ?? "—"}${unit} · chưa đủ đêm để dựng nền (${b.n})`;

  return `Bạn là huấn luyện viên thể hình đọc dữ liệu vòng đeo tay Polar của một khách.
Nhiệm vụ: quyết định HÔM NAY khách nên tập thế nào, và nói rõ vì sao.

KHÁCH
tên ${ctx.client.name || "?"} | trình độ ${C.level || "?"} | ${C.sessionsPerWeek || "?"} buổi/tuần
MỤC TIÊU: ${C.goal || "(chưa đặt)"}
GHI CHÚ / BỐI CẢNH: ${C.notes || "(không có)"}

════ 1. RECOVERY — cơ thể sẵn sàng tới đâu
Nightly Recharge ${C.recovery.recharge ?? "—"}/6 (thang Polar: 1 rất kém … 4 ổn … 6 rất tốt)
ANS charge ${C.recovery.ansCharge ?? "—"} (thang -10…+10, quanh 0 là mức thường ngày của khách)
HRV ${C.recovery.hrv ?? "—"} ms | nhịp tim ngủ TB ${C.recovery.sleepingHr ?? "—"} | đáy thật trong đêm ${C.recovery.restingHrNight ?? "—"}

════ 2. SLEEP — khả năng phục hồi
ngủ ${hm(C.sleep.total)} / mục tiêu ${hm(C.sleep.goal)} | sleep score ${C.sleep.score ?? "—"}
ba thành phần: thời lượng ${_r(C.sleep.duration)} · bền giấc ${_r(C.sleep.solidity)} · tái tạo ${_r(C.sleep.regeneration)}
thức giấc ${hm(C.sleep.interruptions)} (trong đó dài ${hm(C.sleep.longInterruptions)}) | ${C.sleep.cycles ?? "—"} chu kỳ
lên giường ${(C.sleep.start || "").slice(11, 16) || "—"} · dậy ${(C.sleep.end || "").slice(11, 16) || "—"}

════ 3. SLEEP DEBT — nợ ngủ tích luỹ
7 ngày: ${C.sleepDebt.d7 ? hm(C.sleepDebt.d7.sec) + ` qua ${C.sleepDebt.d7.nights} đêm` : "—"}
14 ngày: ${C.sleepDebt.d14 ? hm(C.sleepDebt.d14.sec) + ` qua ${C.sleepDebt.d14.nights} đêm` : "—"}

════ 4. STRAIN — tải sinh lý đã chịu (thang 0-21, buổi tập TRƯỚC đêm này)
ngày ${C.strain.date || "—"}: strain ${C.strain.strain ?? "—"}${C.strain.note ? " — " + C.strain.note : ""}
${(C.strain.workouts || []).map((w) => `  · ${String(w.at).slice(11, 16)} ${w.sport} ${hm(w.sec)} strain ${w.strain ?? "—"} HR ${w.hrAvg ?? "—"}/${w.hrMax ?? "—"}`).join("\n") || "  (không có buổi nào)"}

════ 5. RECENT LOAD — đang tích tải quá nhanh hay quá ít
${C.recentLoad ? `3 ngày: tổng strain ${C.recentLoad.d3.sum} (${C.recentLoad.d3.days}/${C.recentLoad.d3.covered} ngày có tập)
7 ngày: tổng strain ${C.recentLoad.d7.sum} (${C.recentLoad.d7.days}/${C.recentLoad.d7.covered} ngày có tập)
14 ngày: tổng strain ${C.recentLoad.d14.sum} (${C.recentLoad.d14.days}/${C.recentLoad.d14.covered} ngày có tập)
tỷ lệ cấp tính/mạn tính (7ng so 28ng): ${C.recentLoad.acuteChronic ?? "chưa tính được — " + C.recentLoad.acuteChronicNote}` : "(chưa có dữ liệu)"}

════ 6. ACTIVITY — vận động ngoài buổi tập
${act}

════ 7. HR DATA — cường độ thật
nhịp tim tối đa dùng để tính: ${C.hr.hrMax ?? "—"} (${C.hr.hrMaxSource || "không rõ nguồn"})
phút mỗi vùng 7 ngày (z1→z5): ${C.hr.zoneMin7 ? C.hr.zoneMin7.join(" / ") : "—"}
phút mỗi vùng 14 ngày: ${C.hr.zoneMin14 ? C.hr.zoneMin14.join(" / ") : "—"}

════ 8. TRAINING HISTORY — khách tự ghi trong app
${hist}

════ 9. BASELINE CÁ NHÂN — so với trạng thái bình thường của CHÍNH khách này
HRV:            ${bl(C.baseline.hrv, " ms")}
nhịp tim ngủ:   ${bl(C.baseline.sleepingHr, " bpm")}
sleep score:    ${bl(C.baseline.sleepScore, "")}
tổng giờ ngủ:   ${C.baseline.sleepTotal.mean != null ? `hôm nay ${hm(C.baseline.sleepTotal.today)} · nền ${hm(C.baseline.sleepTotal.mean)} qua ${C.baseline.sleepTotal.n} đêm` : "chưa đủ đêm"}
tổng số đêm có dữ liệu: ${C.baseline.nights}

════ 10. BEHAVIOR — KHÔNG CÓ DỮ LIỆU
Cà phê, rượu, căng thẳng, giờ ăn, thói quen: app chưa thu thập.
TUYỆT ĐỐI không suy đoán khách đã uống gì, ăn gì hay căng thẳng ra sao.

════ 11. GIÁO ÁN HIỆN TẠI
${prog}

════ 12. TOÀN BỘ ĐÊM GẦN ĐÂY (mới nhất trước)
${nights}

════════════════════════════════════════════════════════════════
QUY TẮC — bắt buộc

1. KHÔNG có ngưỡng cứng. Cấm dùng luật kiểu "Recovery dưới X thì nghỉ".
   Quyết định phải đến từ TƯƠNG QUAN giữa các nhóm trên, so với ĐƯỜNG NỀN
   của chính khách này và lịch sử của chính khách này. Cùng một Recharge 3/6
   có thể là "tập vừa" hay "nghỉ" tuỳ tải gần đây, nợ ngủ và xu hướng nền.

2. Cân nhắc đủ 7 yếu tố rồi mới kết luận:
   Recovery × Sleep × Strain hiện tại × Recent Load × Training History × Goal × Context
   Trong "why" phải nêu yếu tố NÀO kéo quyết định về phía đó, kèm con số thật.

3. Chỉ dùng số có trong bản tin này. Cấm bịa thêm số. Nhóm nào ghi "không có
   dữ liệu" thì nói là không biết, đừng đoán.

4. sessionKey PHẢI là một key giáo án có thật ở mục 11, hoặc chuỗi rỗng ""
   nếu khuyến nghị nghỉ hoặc buổi không nằm trong giáo án.

5. Xu hướng quan trọng hơn một điểm dữ liệu. Ba đêm cùng đi xuống nói nhiều
   hơn một đêm xấu. Nói rõ khi bạn đang đọc xu hướng.

6. Dữ liệu cho biết ĐIỀU GÌ xảy ra, không cho biết VÌ SAO. Nếu chỉ số xấu đi,
   nêu vài khả năng và nói rõ dữ liệu không phân biệt được — đừng khẳng định
   một nguyên nhân duy nhất.

7. Nền dưới 7 đêm thì nói rõ trong "caveat" là chưa đủ chắc.

8. Khuyến nghị phải phục vụ MỤC TIÊU của khách. Cùng một dữ liệu, người giảm
   mỡ và người xây sức mạnh nhận lời khuyên khác nhau.

9. Không chẩn đoán y khoa. Bất thường kéo dài thì khuyên đi khám.

10. Toàn bộ trả lời bằng TIẾNG VIỆT, giọng trực tiếp, không hoa mỹ, không dùng
    dấu gạch ngang dài.

Ý NGHĨA 5 MỨC recommendation
"train_hard" = đẩy nặng được, cơ thể sẵn sàng nhận tải lớn
"moderate"   = tập bình thường theo giáo án, giữ cường độ vừa
"easy"       = tập nhẹ, kỹ thuật hoặc zone 2, đừng đẩy
"recovery"   = chỉ vận động phục hồi: đi bộ, mobility, cardio rất nhẹ
"rest"       = nghỉ hẳn

ĐỘ DÀI
headline: một câu, tối đa 90 ký tự
why: 2 tới 4 câu, phải nêu số
readiness / sleepRead / loadRead: mỗi mục 1 tới 2 câu
nextSession.intensity: nêu cả khoảng strain mục tiêu 0-21
recoveryActions: 2 tới 4 mục, mỗi mục một việc làm được ngay
watch: 1 câu — điều gì xảy ra thì nên đổi khuyến nghị
caveat: 1 tới 2 câu`;
}

/**
 * Sinh bản tóm tắt cho đêm mới nhất nếu ngày đó CHƯA có. Webhook gọi hàm này,
 * nên không được ném lỗi ra ngoài: webhook hỏng liên tiếp 7 ngày là Polar tự
 * tắt đăng ký, và mất webhook đắt hơn mất một bản tóm tắt.
 */
async function generateBriefIfMissing(clientId) {
  try {
    const db = getFirestore();
    const cRef = db.collection("clients").doc(clientId);
    const cDoc = await cRef.get();
    if (!cDoc.exists) return null;
    const client = cDoc.data();

    const recSnap = await cRef.collection("recovery").orderBy("date", "desc").limit(30).get();
    const nights = recSnap.docs.map((d) => d.data());
    if (!nights.length) return null;

    const latest = nights[0];
    if (latest.brief && latest.brief.text) {
      console.log(`[brief] ${clientId} ${latest.date}: đã có, không gọi model`);
      return latest.brief.text;
    }

    const wSnap = await cRef.collection("workoutHistory").orderBy("date", "desc").limit(10).get();
    const workouts = wSnap.docs.map((d) => {
      const v = d.data();
      const dt = v.date && v.date.toDate ? v.date.toDate().toISOString().slice(0, 10) : "?";
      return { date: dt, day: v.day, done: v.done, total: v.total, totalVolume: v.totalVolume };
    });
    const aSnap = await cRef.collection("activity").orderBy("date", "desc").limit(14).get();
    const activity = aSnap.docs.map((d) => d.data());

    const prompt = buildBriefPrompt({ client, nights, program: client.program || {}, workouts, activity });
    const raw = await callGemini(GEMINI_API_KEY.value(), [{ type: "text", text: prompt }],
      BRIEF_SCHEMA, "recoveryBrief", "low");

    let brief;
    try { brief = JSON.parse(raw); } catch (_e) {
      console.error("[brief] JSON hỏng:", String(raw).slice(0, 200));
      return null;
    }
    const keys = Object.keys(client.program || {});
    if (brief.nextSession && brief.nextSession.sessionKey
        && !keys.includes(brief.nextSession.sessionKey)) {
      brief.nextSession.sessionKey = "";
    }
    await cRef.collection("recovery").doc(latest.date)
      .set({ brief: { text: brief, at: new Date().toISOString(), model: GEMINI_MODEL } }, { merge: true });
    console.log(`[brief] ${clientId} ${latest.date}: đã sinh`);
    return brief;
  } catch (e) {
    console.error(`[brief] ${clientId} lỗi:`, e.message);
    return null;
  }
}

exports.recoveryBrief = onCall(
  { secrets: [GEMINI_API_KEY], region: "asia-southeast1", timeoutSeconds: 120, memory: "256MiB" },
  async (request) => {
    const { clientId, force, cachedOnly } = request.data || {};
    if (!clientId) throw new HttpsError("invalid-argument", "clientId is required");

    const email = request.auth && request.auth.token && request.auth.token.email;
    if (!email) throw new HttpsError("unauthenticated", "Cần đăng nhập.");

    const db = getFirestore();
    const cRef = db.collection("clients").doc(clientId);
    const cDoc = await cRef.get();
    if (!cDoc.exists) throw new HttpsError("not-found", "Không tìm thấy khách: " + clientId);
    const client = cDoc.data();

    // Coach xem được tất cả; khách chỉ xem của chính mình.
    if (email !== COACH_EMAIL && String(client.email || "") !== email) {
      throw new HttpsError("permission-denied", "Không có quyền xem dữ liệu này.");
    }

    const recSnap = await cRef.collection("recovery").orderBy("date", "desc").limit(30).get();
    const nights = recSnap.docs.map((d) => d.data());
    if (!nights.length) {
      throw new HttpsError("failed-precondition",
        "Chưa có dữ liệu hồi phục nào. Đeo Polar khi ngủ và đồng bộ Polar Flow trước.");
    }

    const latest = nights[0];
    if (!force && latest.brief && latest.brief.text) {
      return { cached: true, date: latest.date, brief: latest.brief.text, at: latest.brief.at };
    }
    // Chỉ lấy bản đã lưu, KHÔNG gọi model. Màn hình dùng đường này khi mở tab:
    // xem lại trong ngày phải miễn phí, chỉ lần sinh đầu tiên mới tốn token.
    if (cachedOnly) {
      return { cached: false, empty: true, date: latest.date, brief: null, at: null };
    }

    const wSnap = await cRef.collection("workoutHistory").orderBy("date", "desc").limit(10).get();
    const workouts = wSnap.docs.map((d) => {
      const v = d.data();
      const dt = v.date && v.date.toDate ? v.date.toDate().toISOString().slice(0, 10) : "?";
      return { date: dt, day: v.day, done: v.done, total: v.total, totalVolume: v.totalVolume };
    });

    const aSnap = await cRef.collection("activity").orderBy("date", "desc").limit(14).get();
    const activity = aSnap.docs.map((d) => d.data());

    const prompt = buildBriefPrompt({
      client, nights, program: client.program || {}, workouts, activity,
    });
    const raw = await callGemini(GEMINI_API_KEY.value(), [{ type: "text", text: prompt }],
      BRIEF_SCHEMA, "recoveryBrief", "low");

    let brief;
    try { brief = JSON.parse(raw); } catch (e) {
      console.error("[recoveryBrief] JSON parse failed:", String(raw).slice(0, 300));
      throw new HttpsError("internal", "Model trả về dữ liệu không đọc được. Thử lại.");
    }
    // Không để model bịa ra buổi tập không tồn tại.
    const keys = Object.keys(client.program || {});
    if (brief.nextSession && brief.nextSession.sessionKey
        && !keys.includes(brief.nextSession.sessionKey)) {
      console.warn(`[recoveryBrief] model bịa sessionKey "${brief.nextSession.sessionKey}" — xoá`);
      brief.nextSession.sessionKey = "";
    }

    const at = new Date().toISOString();
    await cRef.collection("recovery").doc(latest.date)
      .set({ brief: { text: brief, at, model: GEMINI_MODEL } }, { merge: true });

    return { cached: false, date: latest.date, brief, at };
  },
);
