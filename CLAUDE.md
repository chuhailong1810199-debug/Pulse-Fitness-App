
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
