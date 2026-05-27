# Handoff — Chubbs → DX!Golf audit notes

**Filed:** 2026-05-18 (after a 4-5 day intensive Chubbs session)
**Chubbs current build at handoff:** APP v6.2 / SW v6.7
**DX!Golf current build at handoff:** SW v2.26 (this commit)
**Audit result:** 1 real bug found and addressed (Krungthep SI). Most Chubbs patterns NOT applicable — see "Why" sections below.

This document captures what was checked in DX!Golf, what was ported, and — more importantly — what was deliberately **not** ported and why. The bug classes Chubbs hit during pre-event hardening for May 23 are mostly Chubbs-specific architectural artifacts. DX!Golf is structurally safer for those exact failure modes.

---

## What got ported

### ✅ Course data integrity test (`qa/course_data_qa.py`)

Python regex-extracts every course's holes from `index.html` and asserts:
- 18 holes exactly
- par sum 60-76 (covers par-72 standard, par-73 BRG Nicklaus, par-63 Unico Grande)
- SI 1-18 each appears exactly once
- par values in {3, 4, 5}

On first run it caught the same Krungthep Kreetha bug that lives in Chubbs:
**H3 and H7 both list SI 5, SI 8 missing entirely.** Likely a copy-paste from one app to the other at some point.

Workflow when this bug is fixed (e.g., after a Bangkok trip with the real scorecard):
1. Fix the SI in `index.html` (one of H3/H7 should become SI 8)
2. Remove the `krungthepKreetha` entry from `COURSES_WITH_KNOWN_DATA_ISSUES` in `qa/course_data_qa.py`
3. Run `python qa/course_data_qa.py` → should pass with 12/12
4. **Also fix the same bug in Chubbs** (`ChubbsMobileApp_v5/index.html`, same hole indexes, and remove from `qa/course_data_qa.py` whitelist there)

Run:
```bash
python qa/course_data_qa.py --verbose
```

---

## What was deliberately NOT ported (and why)

### ❌ `window.SYNC` undefined-reference bug fix

**What it was in Chubbs:** Top-level `const SYNC = {...}` in a classic script doesn't attach to `window`, so `if (!window.SYNC || !SYNC.db)` is always truthy. 4 sites in Chubbs had this — `publishCurrentVersion`, version pill `subscribe`, `subscribeForceReload`, `broadcastReload` — all silently broken until v6.1.

**Why DX!Golf doesn't need it:** Grepped `window.SYNC` — zero matches. DX!Golf never used the pattern. Already correct.

### ❌ Mobile `.set()` clobbering admin-pushed bundle fields

**What it was in Chubbs:** `initSync` wrote the event bundle back to Firebase using `.set()` with an explicit 7-key list, which silently stripped admin-only fields (`playoffs`, `_publishedAt`, `_publishedBy`) from `/events/{id}/bundle`. Took most of a day to trace. Fixed in Chubbs SW v6.3 by switching to `.update()`.

**Why DX!Golf doesn't have this risk:** DX!Golf is **single-writer**. Only the scorer device (`SYNC.isScorer`) writes via `pushState()` → `SYNC.ref.set(serializeState())`. The payload IS the entire game state — there are no admin-owned fields being merged. `.set()` is correct here. No multi-writer clobber risk because viewers don't write.

If DX!Golf ever adds an admin/host-pushed bundle layer (e.g., for tournament configs), revisit this.

### ❌ Glove-friendly stepper redesign

**What it was in Chubbs:** Match-play card stepper was `36px 1fr 36px` columns crammed into the left 30% of a player card. Tiny tap targets, dead space.

**Why DX!Golf doesn't need it:** `.stp-btn` is already 44×44px (iOS HIG compliant). Layout is one-row-per-player, not cards-side-by-side, so there's no cramped-left problem. Different shape, different constraints. Already fine.

### ❌ Header compaction (`.hero.event-loaded`)

**What it was in Chubbs:** Big `Chubbs!` title + logo block ate ~340px above the scoring fold. Class-based collapse during play saved ~80px.

**Why DX!Golf doesn't need it:** DX!Golf uses a **bottom-fixed `.nav-bar`** instead of a top-of-screen tab strip. The score view goes top-to-bottom with players directly visible. No persistent top-chrome problem to solve.

### ❌ Recent games / event switcher

**What it was in Chubbs:** Added a "Switch event" card on the Me/Setup → Event sub-pill, listing the last 5 cached events for one-tap reload. Solves the installed-PWA-stuck-on-test-event problem.

**Why DX!Golf already has it:** `renderLauncher()` at `index.html:10113` calls `renderLauncherRecents()` at `index.html:10276` which reads `dx_recent_games_v1` (the same localStorage key Chubbs's cache borrows the pattern from). DX!Golf was the source of this pattern, not the recipient.

### ❌ Canonicalisation + Levenshtein name matching

Chubbs-specific. DX!Golf's player names come from the roster the user types in, not season-4.json + admin roster aliases. No canonicalisation gap.

### ❌ Match-play banner (gold/blue tints, .mp-me highlight, hard-guard / soft-warning on push)

All Chubbs-specific to its playoff bracket cascade (R16 → Cup QF / Plate QF / Shield / Spoon). DX!Golf has match-play in some of its 9 game modes but no 16-seed bracket, no admin-push gating problem.

### ❌ APP_VERSION vs CACHE_VERSION drift doctrine

Already documented in DX!Golf's `CLAUDE.md`. The convention matches.

---

## What COULD still benefit DX!Golf (backlog ideas)

### 🔵 Playwright multi-device E2E smoke test

Chubbs's `qa/e2e/multi-player-smoke.spec.js` spawns 4 concurrent browser contexts as different players and validates the live-sync round-trip. Caught the bundle-clobber bug that single-device manual testing missed.

DX!Golf would adapt this to the game-code join flow:
1. Scorer device creates game → gets code
2. 3 viewer contexts join with `?g=CODE`
3. Scorer enters scores → assert all viewers see them within Xms
4. Switch hole, change tee, etc.

~1-2 hours to scaffold. Reusable for every game mode regression test going forward. Worth doing post-May-23 (Chubbs's tournament event).

### 🔵 Firebase rules emulator test scaffold

`qa/firebase_rules/` in Chubbs has `@firebase/rules-unit-testing` set up to verify `/events/*` + `/chubbs/*` + `/admin` allow/deny correctly. Specifically catches the regression class where someone removes a path block and downstream features silently break (the v5.59 honeypot-removal incident).

DX!Golf has its own rules (`/games/*`, etc.). Same regression risk. Same emulator scaffold pattern would work.

### 🔵 Activity dashboard

Filed as Chubbs task #21, spec at Chubbs's `NewFeatures/activity-dashboard-spec.md`. Master-mode view of live + historical app usage: who's actively scoring, who's just viewing, who hasn't loaded, stale-version flags.

DX!Golf could host its own version on its admin/launcher view. Same data already collected (game subscriptions, scorer writes, _loadHits if added). ~5-6 hrs.

---

## Architectural notes — why DX!Golf is structurally safer

The four most painful bug classes that bit Chubbs in the past week (window.SYNC, bundle clobber, lock-in to old events, playoff push race) all derive from the same architectural decisions:

| Chubbs property | DX!Golf equivalent | Result |
|---|---|---|
| Admin-pushed event bundle layered over mobile state | Single-writer game-code model | No multi-writer clobber risk |
| Separate admin tool with its own deploy | Single deploy, all UI in one app | No version drift between admin + mobile |
| `?loadEvent=` URL param tied to fixed event ID | `?g=CODE` ephemeral game code | Bookmark-stale-event problem doesn't apply the same way |
| `const SYNC` at top level with `window.SYNC` checks | (Different pattern, no window. references) | Bug doesn't exist |
| Top-of-screen tab + header chrome | Bottom-fixed nav bar | Less real-estate competition |

DX!Golf's architecture is simpler in ways that matter. Most of the v6.x hardening in Chubbs was bandaging consequences of architectural choices DX!Golf already avoided.

---

## Cross-app data ownership note

The Krungthep Kreetha course data exists in **both** apps and **both** have the same SI bug. Treat course data as shared:
- When updating yardages, par, or SI in one app, update the other
- The QA test now catches mismatches in either repo independently
- When the real scorecard becomes available, fix both atomically

Other Bangkok-area courses (Muang Kaew, Muang Ake, Unico Grande, Bangpoo) are likely also duplicated. If you fix one, audit the other.

---

## Pointers to Chubbs implementations (for inspiration only)

Repo: `https://github.com/mph1969/chubbs-golf-app` (also at `D:\Projects\Business Ventures\03 - Mobile Apps Business\Golf Games App\ChubbsGolfApp\` if local)

| Topic | File / line |
|---|---|
| Playwright E2E pattern | `qa/e2e/tests/multi-player-smoke.spec.js` |
| Firebase rules emulator scaffold | `qa/firebase_rules/` (full directory) |
| Course integrity test (original) | `qa/course_data_qa.py` |
| Canonicalisation with Levenshtein | `qa/canonicalisation_qa.py` |
| Activity dashboard spec | `NewFeatures/activity-dashboard-spec.md` |
| Session log of the v5.108 → v6.7 series | `qa/SESSION_NOTES.md` |
| Drift doctrine + reset anchor | `CLAUDE.md` "Deployment Workflow" section |

---

## Bottom line for the next DX!Golf session

1. **Read this file first** if you're picking up Claude Code work on DX!Golf after May 2026.
2. **Don't cargo-cult the Chubbs v6.x changes** — most are architectural workarounds for problems DX!Golf doesn't have.
3. **The Krungthep SI bug is shared** — fix in both apps when the data becomes available.
4. **Playwright E2E + Firebase rules emulator** are the two patterns worth adopting eventually, post-event.
