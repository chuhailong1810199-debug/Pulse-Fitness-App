
## Current clients (verified against Firestore 2026-07-31)

### Self-login clients — each has their own Gmail
| Name | Client ID | Gmail | Level | Sessions/wk | Days | Goal |
|------|-----------|-------|-------|-------------|------|------|
| Chị Nguyệt | chị_nguyệt_1776562700235 | nguyet.cm83@gmail.com | Intermediate | 3 | 4 | Strength + Fatloss + Boxing |
| Cindy | cindy | dollykim1401@gmail.com | Intermediate | 3 | 3 | Strength & Fat Loss — Glutes/Back/Core |
| Joost | joost | joost123@gmail.com | Beginner | 3 | 3 | — |
| Lee | lee | kuanyu41@gmail.com | Intermediate | 3 | 3 | Strength & Hypertrophy |
| Long Chu | longchu | coach@fitwithlongchu.com | Advanced | 3 | 3 | Strength & Hypertrophy |
| Nguyên | nguyen | tbn010112@gmail.com | Beginner | 3 | 3 | Giảm mỡ + hiệu suất thể thao |
| Sang | sang | thinhcst@gmail.com | Beginner | 3 | 3 | Fat Loss + Posture + Height |
| anh Soobin | soobin | sonnguyen109992@gmail.com | Intermediate | 3 | 3 | Tăng cơ giảm mỡ |

### Coach-managed — no Gmail on purpose, cannot log in
| Name | Client ID | Level | Sessions/wk | Days | Goal |
|------|-----------|-------|-------------|------|------|
| An | an | Intermediate | 3 | 3 | Strength & Hypertrophy |
| Anh Đạo | dao | Beginner | 5 | 5 | Fat loss — giảm mỡ, cải thiện thể lực |
| Rome | rome | Beginner | 2 | 2 | Tăng chiều cao, mật độ xương |
| Thai Son | thaison | Advanced | 4 | 3 | Shoulder Rehab → Strength + Boxing |
| Trần Văn Tiến | tien | Beginner | 2 | 2 | Sức khỏe tổng quát, tuổi 48 |

Removed 2026-07-31: **Vy**, **Ngọc Anh**, **Chị Nhi**, **Ngân** (client docs + orphaned user accounts deleted).
Thai Son's email was cleared — `sonnguyen109992@gmail.com` belongs to Soobin. Thai Son needs his own
address before he can log in.

---

## ⚠️ One Gmail = one client — never break this

The whole auth model joins `users` → `clients` **by email**. The Firestore rule
`isClientOwner()` grants read+write to any client doc whose `email` matches the signed-in
account — so two clients sharing an email means each can read and write the other's data.
This actually happened (Soobin + Thai Son both held `sonnguyen109992@gmail.com`).

Enforcement now in place — do not remove any layer:

1. **`/clientEmails/{email}` index** (doc id = lowercased email, value `{ clientId }`).
   Rules `allow create` but `allow update: if false`, so claiming a taken address fails
   atomically at the DB layer — even for the coach. Changing a client's email = delete the
   old doc, create the new one.
2. **`claimClientEmail()` in index.html** — `addClient()` and `saveClientInfo()` must both call
   it *before* writing `clients.email`. Never write that field directly.
3. **Lookups read the index first.** If a legacy scan still finds >1 client on one email, the app
   now **stops and shows an error** rather than silently opening whichever matched last —
   that silent pick is what caused the original mix-up.
4. **users rules**: coach has full access (needed to delete orphans); a client may edit their own
   name/email but **cannot change their own `role` or `clientId`**.

Verified end-to-end on 2026-07-31: hijacking a taken email → `permission-denied`; claiming a
free one → allowed.

When deleting a client, remove **all** of: the `clients/{id}` doc, every subcollection
(`assessment`, `checkpoints`, `workoutHistory`, `nutrition`, `progressPhotos`, `videos`,
`sessionLoads`), the `clientEmails/{email}` entry, and any `users` doc pointing at it.
Deleting a Firestore doc does *not* delete its subcollections — that is how the orphaned
records were created in the first place.

---

## Program key format — ALWAYS use SessionA/B/C (never Mon/Wed/Fri)
- Program days MUST be stored as `SessionA`, `SessionB`, `SessionC`, `SessionD`, `SessionE`...
- Old format `Mon/Tue/Wed/Thu/Fri` → app hangs on loading screen (can't find any days)
- When pushing a new program, always use Session keys
- Migration query to fix old clients:
```javascript
const DAY_ORDER = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const oldKeys = Object.keys(prog).filter(k => DAY_ORDER.includes(k))
  .sort((a,b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));
const newProg = {};
oldKeys.forEach((day, i) => { newProg[`Session${String.fromCharCode(65+i)}`] = prog[day]; });
await updateDoc(ref, { program: newProg });
```

---

## Firebase Modular SDK gotchas (v9+)
- `snap.exists` is a **property** (boolean), NOT a method — never write `snap.exists()`
- `snap.exists()` → `TypeError: snap.exists is not a function` → login crashes
- Correct: `if (!snap.exists) { ... }`

---

## Performance: user profile cache
- `loadUserProfile` now caches `{role, clientId}` in localStorage under key `pulse_user_v2_{uid}`
- Returning users skip Firestore read → near-instant app load
- Background verify runs async via `_verifyUserProfileBg()`
- If login loops or role is wrong → clear cache: `localStorage.removeItem('pulse_user_v2_' + uid)`

---

## Performance: parallel Firestore reads in loadApp()
```javascript
// CORRECT — parallel
await Promise.all([hydrateExerciseLoadsForActiveDay(), loadStrengthHistory()]);
renderExercises();
renderStats(); // non-blocking

// WRONG — sequential (slow)
await hydrateExerciseLoadsForActiveDay();
await loadStrengthHistory();
await renderStats();
```
- `_historyCache` object caches workoutHistory so `renderStats` reuses it without extra query
- Clear cache on client switch: `_historyCache = null`

---

## Nutrition tab + Gemini

Own top-level tab (`#nutrition-page`, between Progress and Log). Daily macro bars, meal log,
7-day history. Data at `clients/{id}/nutrition/{YYYY-MM-DD}` → `{ date, meals[], totals }`.
Targets live on the client doc as `macroTargets` + `macroMeta` (reasoning, BMR/TDEE, basis).

Two callables in `functions/index.js`, both `asia-southeast1`, secret `GEMINI_API_KEY`:
- `analyzeMealPhoto` — photo (base64, client-side resized to 800px) → foods + macros
- `recommendMacros` — reads InBody baseline + checkpoints → calorie/macro targets

### Gemini gotchas
- **Model: `gemini-3.6-flash`** (const `GEMINI_MODEL`). `gemini-1.5-flash` and all 2.0 models are
  **shut down** — calling them throws an unhandled error that surfaces in the app as a bare
  `INTERNAL`, with nothing useful in the message.
- **SDK: `@google/genai`** with `client.interactions.create({ model, input, response_format })`,
  read the result from `interaction.output_text`. The old `@google/generative-ai` +
  `getGenerativeModel().generateContent()` is deprecated — do not go back to it.
- Use `response_format` with a **JSON schema** rather than asking for JSON in the prompt;
  it removes parse failures entirely.
- All Gemini calls go through `callGemini()`, which maps 401/404/429/503 to readable errors.
  If you ever see a bare `INTERNAL` again, something bypassed that helper.
- Text prompt goes **before** the image in the `input` array for single-image requests.

### LBM vs SMM — do not conflate
- **LBM** (lean body mass) = fat-free mass: muscle + bone + organs + water = `weight × (1 − pbf/100)`
- **SMM** (skeletal muscle mass) = skeletal muscle only, ~50–55% of LBM, entered from the InBody sheet

Protein targets are calculated **per kg LBM** (the standard). Cindy: 58kg @ 26% → LBM 42.9kg,
SMM 24kg — both correct, different numbers. Calling LBM "muscle mass" contradicts the InBody
printout and confuses the coach; the prompt now forbids it and the UI prints the basis row
(`Weight · Body fat · LBM · SMM`) so the two can be cross-checked at a glance.

### Under-18 safeguard
If age < 18, **never prescribe a deficit** — enforced both in the prompt and in code
(`if (isMinor)` raises calories back to TDEE if the model still returns a cut). Restricting
energy during puberty can affect final adult height and is a risk factor for disordered eating.
Sang is 14 and his stated goal includes "Height", so this path is live, not hypothetical.
A yellow medical note appears in the UI advising parental consent + paediatric review.

---

## Excel → migrate.html: known gotchas (learned the hard way)

### 1. Emoji encoding — only use ⚡ (U+26A1) in openpyxl build scripts
- ⚡ is a BMP character → encodes correctly openpyxl → SheetJS → parser detects phase ✓
- 💪 🔥 🏃 🧘 are surrogate-pair characters → openpyxl writes them but SheetJS `includes()` silently fails → phase not detected → **0 exercises parsed, no error shown**
- Always write: `"⚡ Strength"`, `"⚡ Warmup"`, `"⚡ Circuit"` etc. in build scripts

### 2. Row order inside each phase block — headers AFTER phase row
Parser logic: phase-emoji-row → `inEx=false` | `"Exercise"` header-row → `inEx=true` | exercises added
```
WRONG:  [global header row]  →  [phase row]  →  [exercises]   ← inEx reset → 0 exercises
RIGHT:  [phase row]          →  [header row] →  [exercises]   ← works correctly
```
Each phase needs its OWN header row directly beneath it.

### 3. Firebase API key — keep all HTML files in sync
Active key: `AIzaSyB1RsoFzFv_S0ae2Jkh-2RuZjA5lqGCY_o`  
Must match in: `index.html`, `migrate.html`, `landing.html`, `seed-exercises.html`  
Stale/different key in any file → `auth/api-key-expired` error on login.

Note: `landing.html` is the **homepage** — `vercel.json` routes `/` → `/landing.html`.
It has gone missing from the working tree before while still committed; if `git status`
shows it as deleted, restore it (`git restore landing.html`) rather than committing the
deletion, or the site root 404s.

### 4. build_joost.py reference script
Working build script for generating client Excel files:  
`/Users/longchu/Documents/GitHub/Fitness-app/` — see `build_joost.py` in outputs for template.

---

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health
