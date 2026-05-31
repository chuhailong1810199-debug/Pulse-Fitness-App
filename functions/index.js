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
const { defineSecret }       = require("firebase-functions/params");
const { initializeApp }      = require("firebase-admin/app");
const { getFirestore }       = require("firebase-admin/firestore");
const nodemailer             = require("nodemailer");
const { Groq }               = require("groq-sdk");

initializeApp();

const SMTP_USER     = defineSecret("SMTP_USER");
const SMTP_PASS     = defineSecret("SMTP_PASS");
const GROQ_API_KEY   = defineSecret("GROQ_API_KEY");

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
function groqErrorMessage(err) {
  const msg = (err.message || "").toLowerCase();
  const status = err.status || err.statusCode || (err.error && err.error.status);
  const isRateLimit = status === 429 || msg.includes("rate_limit") || msg.includes("rate limit");
  const isDailyLimit = msg.includes("tokens per day") || msg.includes("tpd") || msg.includes("day (tpd)");
  const isTimeout   = msg.includes("timeout") || msg.includes("timed out") || status === 504;
  const isOverload  = msg.includes("overloaded") || msg.includes("503") || status === 503;

  if (isRateLimit && isDailyLimit)
    return "Pulse has reached its limit for today — please try again tomorrow or come back in a few hours.";
  if (isRateLimit)
    return "Pulse is busy right now — please wait a moment and try again.";
  if (isTimeout)
    return "Pulse took too long to respond — please try again.";
  if (isOverload)
    return "Pulse servers are overloaded — please try again in a few minutes.";
  return "Something went wrong — please try again.";
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
    const { name, level, goal, sessionsPerWeek, notes, age, gender, weight, height } = request.data;

    // ── Day mapping ──────────────────────────────────────────────────────────
    const dayMaps = {
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
    const groq = new Groq({ apiKey: GROQ_API_KEY.value() });

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 6000,
      temperature: 0.4,
      messages: [{ role: "user", content: prompt }],
    });

    let raw = completion.choices[0].message.content.trim();
    // Strip markdown fences if model wraps output
    raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();

    const program = JSON.parse(raw);
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
    if (!clientId) throw new Error("clientId is required");

    const db = getFirestore();
    const steps = [];

    // ── Step 1: Read target client profile ───────────────────────────────────
    steps.push({ icon: "📖", text: "Đọc hồ sơ khách hàng..." });
    const clientDoc = await db.collection("clients").doc(clientId).get();
    if (!clientDoc.exists) throw new Error("Client not found: " + clientId);
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
    const groq = new Groq({ apiKey: GROQ_API_KEY.value() });
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 6000,
      temperature: 0.35,
      messages: [{ role: "user", content: prompt }],
    });

    let raw = completion.choices[0].message.content.trim();
    raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();

    const program = JSON.parse(raw);
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

      const groq = new Groq({ apiKey: GROQ_API_KEY.value() });
      let hyroxCompletion;
      try {
        hyroxCompletion = await groq.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          max_tokens: 6000,
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
    const groq = new Groq({ apiKey: GROQ_API_KEY.value() });
    let completion;
    try {
      completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        max_tokens: 6000,
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
