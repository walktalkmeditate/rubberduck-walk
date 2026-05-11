# Daily entries + heard lines + meditation kind

**Date:** 2026-05-11
**Author:** chiefrubberduck (with Claude)
**Status:** design — implementation not yet started
**Scope:** two repos — `rubberduck-walk` (data) and `pilgrim-landing` (UI)

## Problem

The duck's daily walk produces gaps on the /walk page. Currently:
- Resting days produce no entry at all.
- Mid-transit `completing` days are silent.
- Roughly half of walking days are silent (50% coin).
- Voice-lint failures produce empty `kind: silence` entries.

Result: the /walk page shows holes. Readers visit on a quiet day and see staleness, not stillness.

Separately, chiefrubberduck maintains a 250+ entry one-line journal at
`github.com/momentmaker/um/blob/master/self/one-line.md` — terse aphorisms accumulated over years. That body of writing is currently disconnected from the duck.

## Goal

1. Every day, /walk gets fresh content. No gaps.
2. Bring the chief's old one-line journal into the duck's pilgrimage as overheard material — never spoken by the duck, only carried.
3. Simplify the entry-kind machinery while doing so.

## Non-goals

- Surfacing the heard line on the OG card. (Already auto-handled on meditation days, since the line *is* the body.)
- Surfacing the heard line in `now.json`. The chief's /now page stays voice-independent.
- Rewriting voice rules. Duck voice on `offering` and `threshold` stays as-is.
- Surfacing line attribution in UI. The line stands alone, no author named.

## Design

### Two daily outcomes

Every day produces exactly one of:

- **walk-with-line** — `kind: offering` (or `threshold` at closure). Duck writes its terse body under existing voice rules. Frontmatter carries the day's line as `heard: <text>` and `heardId: <id>`. UI renders body plus a small italic line beneath.
- **meditate** — `kind: meditation`. Body is the line verbatim. Frontmatter has `heardId: <id>` but no `heard:` (no duplication with body). Voice-lint is skipped — the body is an attributed quote. UI renders normally, with no italic.

### Trigger rule

Inside the daily walk-day pipeline, after `./duck advance`:

1. Read `state.json`.
2. **Closure-arrival override:** if `state.mode == "resting"` AND `state.modeEnteredAt == today`, the duck just arrived at the closure site on this run. Set `dayKind = walk-with-line`, entry `kind = threshold`. No coin. Fires exactly once per route.
   - **Why this condition:** `scripts/advance.ts` flips `mode: completing → resting` in the same step that walks the duck onto the final transit stage. So at entry-write time, `mode == "completing"` AND stage == last transit is unreachable. The current CLAUDE.md uses the latter and is latent-broken — it has not fired only because shikoku-88 has not yet completed. The corrected condition uses the resting-just-entered fingerprint.
3. **Resting-not-arrival override:** if `state.mode == "resting"` AND `state.modeEnteredAt < today` (any resting day past the arrival day), set `dayKind = meditate`. Always. No coin. Voice rules assume motion (kmFromStart, stage progression, "stones along the path") — the duck doesn't speak from a still perch. Carrying a line is enough.
4. **Otherwise** (`mode` is `walking` or `beginning`): flip a date-seeded coin. `parseInt(sha1(date).slice(0,8), 16) % 100 < 30` → `dayKind = meditate`. Else `dayKind = walk-with-line`.

**Coin rate: 30%** — pinned. Roughly 2 meditations per week. High enough to feel like rhythm, low enough that walk-with-line remains the dominant voice. Tunable in code via a single constant `MEDITATE_PCT = 30`.

The coin is date-seeded so re-runs on the same date are idempotent. Matches the existing `lastAdvancedAt` idempotency invariant in `scripts/advance.ts`.

**Timezone:** `today` is the UTC date, `new Date().toISOString().slice(0, 10)` — matches existing `writeEntry()` in `duck.ts` line 35 (`YYYY-MM-DD`). All date comparisons (`modeEnteredAt`, `used.json`'s `date`, frontmatter `date`) are UTC. Cron may fire at any wall-clock time; UTC keeps boundaries deterministic across DST and tz changes on the runner.

### Line selection

1. Load `lines/pool.json` (pool) and `lines/used.json` (rolling log, lifetime).
2. **Same-date guard:** if `used.json` already has an entry for today's date, reuse that `id` — do not re-pick. Guarantees same-date re-runs return the same line.
3. **Empty-pool guard:** if pool is empty (first run before `./duck refresh-lines` ever ran), force `dayKind = walk-with-line` and emit the entry **without** `heard`/`heardId` frontmatter. Log a warning. Self-healing once the pool is populated.
4. Otherwise: build `unused` set.
   - **Fresh cycle:** `unused = pool.id − used.id`. If non-empty, pick from this.
   - **Exhausted (lifetime):** if `unused` is empty (the duck has carried every line at least once), use the **recency-window** rule: `unused = pool.id − used.last(50).id`. The 50 most-recently-used ids are blocked; everything older is eligible again.
   - Constant: `RECENCY_WINDOW = 50`. Tunable in code. Sized so back-to-back repeats are impossible and any given line stays out of rotation for ~50+ days after surfacing.
5. Pick uniformly from `unused`, seeded by `sha1(date).slice(0, 8)` so any re-run picks the same id deterministically.
6. Hold `{ id, text }` for downstream steps.

After the entry file is successfully written, append `{ id, date, kind: "heard"|"meditation" }` to `lines/used.json`. Append once per date; if a date is already logged, skip.

### Daily pipeline idempotency

The cron may run more than once per date (manual re-runs, retry on SSH timeout per `bin/walk-day.sh`). Pipeline must be safe to re-enter. Guards:

- **Step 1 always runs.** `./duck advance` is itself idempotent on `lastAdvancedAt` and must run on every invocation — state progression cannot stall on a same-date re-run.
- **Entry-exists guard.** After advance, check `entries/<today>-*.md` via glob (slug is unknown until step 4). If a file matches:
  - Read its frontmatter `heardId`.
  - **Reconcile:** if `heardId` exists and is not already logged for today in `used.json`, append the log entry now. This recovers from a crash between entry-write (step 4-5a) and used.json-append (step 5b).
  - Skip steps 2–5b. Continue to step 6 so the feed and og-image refresh even on re-runs.
- **Line-selection guard.** Same-date guard (above) ensures a re-pick yields the same id when reached.
- **Used.json idempotency.** Keyed on `date` — second-time write is a no-op.

**Slug rules:**
- `kind: offering` / `threshold` → existing rule: `state.stageName` lowercased, non-alphanumeric → `-`.
- `kind: meditation` → fixed slug `meditation` (no stage in the body). Filename: `entries/<today>-meditation.md`. Avoids slug-from-quote oddities.

### Fallback on lint failure

The existing self-review allows up to 2 regenerations. If three drafts of a `walk-with-line` body fail the programmatic voice-lint, the day flips to `meditate`:

- Delete the failed draft.
- Re-emit as `kind: meditation` with body = today's line.
- Log under `kind: "meditation"` in `lines/used.json` (the line carried, even if the duck couldn't speak).

This replaces the old `kind: silence` fallback. The duck never produces empty content.

### Data shapes

**`lines/pool.json`:**
```json
[
  { "id": "8f2a7b91", "text": "the path forward seems to go back" },
  { "id": "1d4c0e22", "text": "attention is worship" }
]
```

**`lines/used.json`:**
```json
[
  { "id": "8f2a7b91", "date": "2026-05-12", "kind": "heard" },
  { "id": "1d4c0e22", "date": "2026-05-13", "kind": "meditation" }
]
```

**Entry frontmatter (walk-with-line):**
```yaml
---
date: 2026-05-12
route: shikoku-88
stage: 15
stageName: Kokubun-ji
coords: [134.49, 34.07]
kind: offering
glyph: 🪨
weather: cloudy, 17°C
kmFromStart: 75.2
heard: the path forward seems to go back
heardId: 8f2a7b91
---

A stone moved overnight. No one watched it move.
```

**Entry frontmatter (meditate):**
```yaml
---
date: 2026-05-13
route: shikoku-88
stage: 15
stageName: Kokubun-ji
coords: [134.49, 34.07]
kind: meditation
glyph: 🪷
weather: light rain, 16°C
kmFromStart: 75.2
heardId: 1d4c0e22
---

attention is worship
```

### Type changes (`src/types.ts`)

- `EntryKind`: drop `"notice"`, drop `"silence"`, add `"meditation"`.
  Result: `"offering" | "threshold" | "letter" | "meditation"`.
- `EntryFrontmatter`: add `heard?: string` and `heardId?: string`.
- `FeedEntry`: same additions.
- No removals from `FeedEntry` (backward-compatible for consumer).

Pre-flight check confirmed: no `kind: silence` and no `kind: notice` entries currently exist on disk. Type narrowing safe.

### Line ingest parser

`./duck refresh-lines` fetches the raw one-line.md content and parses:

- **Source URL:** `https://raw.githubusercontent.com/momentmaker/um/refs/heads/master/self/one-line.md` (public, no auth). Hardcoded as a constant `LINES_SOURCE_URL` for clarity; future sources can be added behind a CLI flag if needed (out of scope for v1).
- **HTTP:** GET only. 30s timeout. No retries — the daily pipeline does not depend on `refresh-lines` (only manual invocation), so failure is loud and stops the run.
- **Failure modes:**
  - Network error or non-200 → log error, exit non-zero, **do not overwrite** `lines/pool.json`. Last-known-good pool stays intact.
  - Empty body or `<32` bytes → treat as fetch failure (refuse to wipe pool). Same behavior.
  - Parse yields zero lines → log error, exit non-zero, do not overwrite.
- **Parser rules:**
  - Skip blank lines.
  - Skip markdown headings (`^#`).
  - Skip lines that are punctuation-only or whitespace-only.
  - Trim leading/trailing whitespace.
  - Drop leading list markers (`- `, `* `, `> `) if present.
  - `id = sha1(canonical_text).slice(0, 8)` — stable across refreshes.
  - Preserve existing ids in `lines/pool.json` by matching text. Report: `n added`, `n removed`, `n unchanged`. Idempotent.

No content rewriting. No abstraction-stripping. The lines are the chief's voice, not the duck's — the duck carries them as-is.

### Commands

**New:**
- `./duck refresh-lines` — fetch + parse + write `lines/pool.json`. Diff against existing pool; report adds/removes. Exits non-zero on fetch/parse failure (does not corrupt pool).
- `./duck lines status` — print `pool: N, used (lifetime): M, used (recency-50): K, last used: <date>`. Diagnostic only.

**Removed from CLI entirely:**
- `./duck silence` — gone. The daily pipeline never emits silence anymore (lint-fail falls back to meditate); no human-facing reason to keep a manual silence path. Removing avoids the spec contradiction where `silence` could in theory still land on disk but build-feed would reject the kind.

**Unchanged:** `status`, `advance`, `build-feed`, `offer`, `letter`, `next`, `preview`.

### Voice-lint changes

`scripts/voice-lint.ts` + `src/voice-lint.ts`:

- Skip lint for `kind: meditation` — body is attributed quote.
- Skip lint for `kind: letter` — already exempt.
- Keep lint for `offering` and `threshold`.
- Do **not** lint the `heard:` frontmatter field — it is a quote, not duck speech.

### Feed builder changes

`scripts/build-feed.ts` + `src/feed.ts`:

- Pass through `heard` and `heardId` from frontmatter to `FeedEntry`.
- Accept `kind: meditation` as a valid entry kind.
- No new filtering. No special rendering hints — UI layer decides presentation.

### Daily pipeline (replaces CLAUDE.md steps 2 + 5a)

1. `./duck advance` — always runs. Idempotent on `lastAdvancedAt`. State must progress on first call of the day even if downstream is re-entered later.
1a. **Entry-exists guard.** Glob `entries/<today>-*.md`. If a match exists:
   - Reconcile: if its `heardId` is missing from `used.json` for today's date, append now.
   - Skip steps 2–5b. Jump to step 6.
2. **Pick day kind.** Apply closure-arrival override → resting-not-arrival override → coin → `dayKind`.
2a. **Pull line.** Empty-pool guard → same-date guard → deterministic pick from `unused` (fresh cycle or recency-window).
3. `npm run weather` (unchanged).
3a. Look up `kmFromStart` (unchanged — `meditate` days at closure perch still emit it from `state.coords`'s stage if available).
4. **Draft.** Split by `dayKind`:
   - `walk-with-line`: draft duck body per voice rules. Write with frontmatter including `heard`, `heardId`. Slug: `state.stageName`.
   - `meditate`: no drafting. Write `kind: meditation`, body = line text, glyph = date-seeded pick from palette (`palette[parseInt(sha1(date + "glyph").slice(0,8), 16) % palette.length]`), frontmatter `heardId`. Slug: `meditation`.
5. **Self-review.** Walk-with-line only. Up to 2 regenerations.
5a. **Voice-lint.** Walk-with-line only. On 3x fail → fall back to `meditate` with today's line. Existing draft file is deleted; new meditation file written.
5b. **Record.** Append `{ id, date, kind }` to `lines/used.json`. Idempotent by date. **This must succeed before step 6** — step-1a reconciliation depends on this being the canonical record.
6. `./duck build-feed` (unchanged).
6b. `bash bin/render-og.sh` (unchanged).
6c. Generate `now.json` (unchanged).
7. Commit + push + purge (unchanged).

## /walk page UI (pilgrim-landing repo)

### Duck marker on map

`js/walk.js` around line 632 sets the map's duck image to `DUCK_GIF`. Replace with logic keyed on the latest entry's kind.

**"Latest entry" ordering** (must be deterministic — multiple entries can share a date if cron is re-run after a failure recovery):
1. Sort feed entries by frontmatter `date` desc (already done in feed builder).
2. Tiebreak by `kind` priority: `threshold` > `letter` > `meditation` > `offering`. Threshold and letter outrank a same-day meditation if both somehow exist.
3. Final tiebreak: insertion order in `feed.json`.

The duck marker source then maps from the resolved latest entry:
- `kind == "meditation"` → `assets/duck/duck-still.png` (new asset).
- Anything else → `assets/duck/duck.gif` (existing).

`duck-still.png` is a static frame extracted from the existing gif. Same display dimensions (36×36 rendered). Live in `pilgrim-landing/assets/duck/`.

The walk repo's own `assets/chiefrubberduck-transparent.gif` and `assets/chiefrubberduck.png` are unrelated to /walk page rendering — left alone.

### Entry tile rendering

Existing CSS class pattern: `walk-entry walk-entry--${kind}` (already in `js/walk.js`).

**For `walk-entry--offering` and `walk-entry--threshold` with `entry.heard`:**
- After the existing body element, render a new element:
  ```html
  <div class="walk-entry-heard">— the path forward seems to go back</div>
  ```
- CSS: `font-style: italic; font-size: 0.85em; opacity: 0.7; margin-top: 0.5em;`. Tunable.
- Render only when `entry.heard` is present. Missing-field-safe for older entries.

**For `walk-entry--meditation`:**
- Body renders normally — no italic, no em-dash, no special prefix. The line speaks for itself.
- New CSS rules:
  ```css
  .walk-entry--meditation .walk-entry-body { /* normal weight/size */ }
  ```
- **Polish:** dim the entry's surrounding visual slightly. Apply a subtle CSS treatment to the meditation tile — reduced opacity on background watermark contribution, softer glyph color, or both. Specific approach: `.walk-entry--meditation { opacity: 0.92; }` and `.walk-entry--meditation .walk-entry-glyph { opacity: 0.7; }`. Cue that the duck paused without shouting it.

### Map dot sizing

`DOT_RADIUS` map in `js/walk.js`:
- Add `meditation: 8` (same as `offering`). No visual change on the route map for meditation days — the duck was still in place.

### Cleanup

- Remove `walk-entry--silence` rules from `css/walk.css` (lines ~565–571) and the `entry.kind !== "silence"` branch from `js/walk.js` (line ~419). No silence entries on disk, no future silence entries.
- Leave `renderStateLine` "the duck is resting at X" logic intact. Resting-mode state-line tells geographic truth about the duck's position (still at closure site). It will say "resting" on days the day's entry is a meditation; that's intentional — the duck *is* resting (state-wise), and meditating (entry-wise). The two things are different and both true. No dissonance to resolve.

### Asset to add to pilgrim-landing

- `pilgrim-landing/assets/duck/duck-still.png` — single frame from `duck.gif`. Same display size as gif. Lossless PNG with transparency preserved.

## Testing

In `rubberduck-walk`:

- **`pickLine` deterministic:** same date + same pool + same used.json → same id, every call.
- **Same-date guard:** if today already in `used.json`, `pickLine` returns the logged id even when the line is now in "used."
- **Fresh-cycle exhaustion:** seed pool of 5, mark all 5 used. `pickLine` for a new date returns an id from `pool − used.last(50)` (== empty set for small pool; spec: if recency window covers entire pool, allow the oldest item — make this explicit in code: `unused = pool - used.last(min(RECENCY_WINDOW, pool.size - 1))`).
- **Recency-window:** with pool of 100 and used log containing all 100 once, blocks the 50 most recent ids; eligible pool is the 50 oldest.
- **Empty-pool guard:** pool of 0 → `pickLine` returns null; pipeline forces walk-with-line and writes entry without `heard`/`heardId`.
- **Day-kind coin (UTC):** with 1000 dates and `MEDITATE_PCT=30`, meditate count satisfies `260 ≤ count ≤ 340`. Same date always returns same kind.
- **Closure-arrival override:** state `{mode:resting, modeEnteredAt: today}` → `dayKind=walk-with-line`, kind=threshold, regardless of coin.
- **Resting-not-arrival override:** state `{mode:resting, modeEnteredAt: yesterday}` → `dayKind=meditate`, regardless of coin.
- **Walking/beginning + coin:** coin alone decides; closure overrides do not fire.
- **Lint-fail fallback:** simulate 3× lint reject on a walk-with-line draft → original file deleted, meditation file with same `heardId` written, `used.json` logged once with `kind: meditation`.
- **Reconcile-on-rerun:** create today's entry file but skip `used.json` append; rerun the pipeline → entry-exists guard appends the missing row; no duplicate file write.
- **Ingest parser:** snapshot of real one-line.md drops blanks / headings / punctuation; preserves stable ids on refresh; reports adds/removes correctly.
- **Refresh-lines failure:** non-200 HTTP, empty body, and parse-zero-lines all leave `lines/pool.json` unchanged and exit non-zero.
- **Voice-lint exemptions:** rejects banned word in `offering`; accepts identical body in `meditation`; does not inspect `heard:` frontmatter.
- **Build-feed:** passes `heard`, `heardId` to `FeedEntry`; accepts `meditation` kind. No defensive throw for `silence`/`notice` — those kinds are dropped from the type union, and the schema validator will reject them naturally if any appear (none exist).

In `pilgrim-landing`:

- **Smoke render:** load `/walk` against a local feed.json containing one `kind: meditation` and one `kind: offering` with `heard:`. Both tiles render; duck marker swaps to PNG when latest is meditation, GIF otherwise.
- **Latest-entry tiebreak:** feed.json with same-date `threshold` + `meditation` resolves to threshold for marker source.
- **Missing `heard:` safe:** older entries without `heard` render without the italic line (no `undefined` text leaks).

## Migration

Order matters — step 2 must complete before the next cron fires, or the empty-pool guard kicks in and the day publishes a `walk-with-line` without `heard:`.

1. Add `lines/` directory with empty `pool.json: []` and `used.json: []`.
2. Run `./duck refresh-lines` once to populate the pool. Verify pool size ≥ 200.
3. Update CLAUDE.md: replace step 2 with the new day-kind logic (closure-arrival, resting-not-arrival, coin); add a "Heard lines" subsection explaining the pool, lifetime + recency rotation, ingest source, UTC date boundary; update voice-lint section to note the `meditation` exemption; remove the silence-fallback line; document `entries/<today>-meditation.md` slug rule.
4. Update `src/types.ts` to drop `notice` and `silence`, add `meditation`; update `EntryFrontmatter` and `FeedEntry` with `heard`/`heardId`.
5. Update `scripts/build-feed.ts` and `scripts/voice-lint.ts` per design.
6. Update `pilgrim-landing/js/walk.js` and `css/walk.css` per design. Add `duck-still.png` asset.
7. Wire `./duck refresh-lines` and `./duck lines status` into `duck.ts`. Remove `./duck silence` from the CLI dispatch (case branch + usage line).

No data migration. Old entries on disk stay readable.

## Open questions

None remaining at design time.

## Accepted risks

- **Body / heard-line echo:** voice-lint does not compare the duck's offering body against the day's `heard:` line. Collision is possible in theory (duck writes about stones, line is "stones speak slowly"). In practice the duck's body is generated without seeing the line, so coincidence is rare; if it happens, the tile shows two related thoughts side by side and reads fine. No similarity check in v1.
- **State-line vs entry kind dissonance:** on resting days the page header says "the duck is resting at X" while the day's tile shows a meditation. Intentional. State describes position, entry describes voice — both true.
- **Recency window edges:** if `pool.size ≤ RECENCY_WINDOW` (50), the recency rule degrades to "block all but the oldest single item." Spec calls this out explicitly via `min(RECENCY_WINDOW, pool.size - 1)`. Real pool is ~250, so this never fires in practice.

## Out of scope (future iterations)

- Adding new lines to the pool from a separate source (e.g., manual additions, second curated journal). v1 is read-only against one-line.md.
- Line filtering by mood, theme, or context. v1 is uniform random.
- Multi-line meditations. v1 is one line per meditation day.
- Surfacing line attribution in UI. v1 stays anonymous.
- Tunable `MEDITATE_PCT` via CLI or env. v1 is a code constant.
