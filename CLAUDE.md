
## Current clients (as of 2026-06-02)
| Name | Client ID | Gmail | Level | Sessions/week |
|------|-----------|-------|-------|---------------|
| Thai Son | thaison | sonnguyen109992@gmail.com | Advanced | 7 |
| Sang | sang | (no email) | Beginner | 3 |
| Cindy | cindy | dollykim1401@gmail.com | Intermediate | 3 |
| Lee | lee | kuanyu@gmail.com | Intermediate | 3 |
| Joost | joost | joost123@gmail.com | — | — |
| Long Chu | longchu | coach@fitwithlongchu.com | — | — |
| Chị Nguyệt | chị_nguyệt_1776562700235 | nguyet.cm83@gmail.com | — | 3 |
| Chị Nhi | chị_nhi_1776781030318 | lp.khanh.nhi@gmail.com | — | — |
| Ngọc Anh | ngọc_anh_phạm_1780385374016 | ngocanhispunk@gmail.com | Intermediate | 5 |
| anh Soobin | soobin | sonnguyen109992@gmail.com | — | — |
| Vy | vy_1777337601716 | lin135@gmail.com | — | — |
| An | an | placeholder@gmail.com | — | — |

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
