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
3. **Otherwise:** flip a date-seeded coin. `sha1(date).first8 % 100 < 25` → `dayKind = meditate`. Else `dayKind = walk-with-line`.
4. Subsequent resting days (`mode == "resting"` AND `modeEnteredAt < today`) follow the coin like any other day. The duck stays put at the closure-site coords and either meditates or writes a walk-with-line offering from there.

The coin is date-seeded so re-runs on the same date are idempotent. Matches the existing `lastAdvancedAt` idempotency invariant in `scripts/advance.ts`.

### Line selection

1. Load `lines/pool.json` (pool) and `lines/used.json` (rolling log).
2. **Same-date guard:** if `used.json` already has an entry for today's date, reuse that `id` — do not re-pick. Guarantees same-date re-runs return the same line even if the line is already in the used log.
3. Otherwise: `unused = pool.id − used.id`. If empty, treat all of pool as unused (cycle reset; no file deletion needed — older entries stay in the log for history).
4. Pick uniformly from `unused`, seeded by `sha1(date)` so any re-run picks the same id deterministically.
5. Hold `{ id, text }` for downstream steps.

After the entry file is successfully written, append `{ id, date, kind: "heard"|"meditation" }` to `lines/used.json`. Append once per date; if a date is already logged, skip (matches cron idempotency).

### Daily pipeline idempotency

The cron may run more than once per date (manual re-runs, retry on SSH timeout per `bin/walk-day.sh`). Pipeline must be safe to re-enter. Guards:

- `./duck advance` already gates on `lastAdvancedAt`.
- Line selection gates on today's row in `used.json` (above).
- Entry write: if today's entry file already exists on disk (`entries/<date>-<slug>.md`), skip steps 2-5b. Steps 6+ still run so any in-flight feed/og changes get committed.
- `used.json` append is keyed on `date` — second-time write is a no-op.

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
- `./duck refresh-lines` — fetch + parse + write `lines/pool.json`. Diff against existing pool; report adds/removes.
- `./duck lines status` — print `pool: N, used: M, unused: N-M, last used: <date>`. Diagnostic only.

**Unchanged:** `status`, `advance`, `build-feed`, `silence` (kept callable for legacy/manual but no longer auto-triggered), `offer`, `letter`, `next`, `preview`.

The `silence` subcommand stays in the CLI as a manual escape hatch but is removed from the daily pipeline. Eventually could be deleted; not in this spec's scope.

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

0. **Entry-exists guard.** If `entries/<today>-<slug>.md` already exists, skip ahead to step 6. (Re-run safety.)
1. `./duck advance` (unchanged; itself idempotent on `lastAdvancedAt`).
2. **Pick day kind.** Apply closure-arrival override or date-seeded coin → `dayKind`.
2a. **Pull line.** Same-date guard first; else deterministic pick from `pool − used`.
3. `npm run weather` (unchanged).
3a. Look up `kmFromStart` (unchanged).
4. **Draft.** Split by `dayKind`:
   - `walk-with-line`: draft duck body per voice rules. Write with frontmatter including `heard`, `heardId`.
   - `meditate`: no drafting. Write `kind: meditation`, body = line text, glyph = random from palette, frontmatter `heardId`.
5. **Self-review.** Walk-with-line only. Up to 2 regenerations.
5a. **Voice-lint.** Walk-with-line only. On 3x fail → fall back to `meditate` with today's line.
5b. **Record.** Append `{ id, date, kind }` to `lines/used.json`. Idempotent by date.
6. `./duck build-feed` (unchanged).
6b. `bash bin/render-og.sh` (unchanged).
6c. Generate `now.json` (unchanged).
7. Commit + push + purge (unchanged).

## /walk page UI (pilgrim-landing repo)

### Duck marker on map

`js/walk.js` around line 632 sets the map's duck image to `DUCK_GIF`. Replace with logic keyed on the latest entry's kind:

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
- Leave `renderStateLine` "the duck is resting elsewhere" / "the duck is resting at X" logic intact. Resting-mode messaging still accurate; the meditate entry is the day's offering on /walk, not a state announcement.

### Asset to add to pilgrim-landing

- `pilgrim-landing/assets/duck/duck-still.png` — single frame from `duck.gif`. Same display size as gif. Lossless PNG with transparency preserved.

## Testing

In `rubberduck-walk`:

- `pickLine`: deterministic per date; cycles when pool exhausted; same date always returns same id.
- Day-kind coin: closure override forces walk-with-line; non-closure runs at ~25% meditate over a 1000-date sample; same date always returns same kind.
- Lint-fail fallback: simulate 3x lint reject → meditation file with same `heardId` exists, `used.json` logged once with `kind: "meditation"`.
- Ingest parser: real one-line.md sample drops blanks/headings/punctuation; preserves stable ids on refresh; reports adds/removes correctly.
- Voice-lint: rejects banned word in `offering`; accepts identical body in `meditation`; ignores `heard:` frontmatter.
- Build-feed: passes `heard`, `heardId` to `FeedEntry`; accepts `meditation` kind; old `silence`/`notice` kinds throw if encountered (defensive — though none exist).

In `pilgrim-landing`:

- Smoke test: load `/walk` against a local feed.json containing a meditation entry and an offering+heard entry; both render correctly; duck marker swaps source when latest is meditation.

## Migration

1. Add `lines/` directory with empty `pool.json: []` and `used.json: []`.
2. Run `./duck refresh-lines` once to populate the pool.
3. Update CLAUDE.md: replace step 2 with the new day-kind logic; add a "Heard lines" subsection explaining the pool, no-repeat rotation, ingest source; update voice-lint section to note the `meditation` exemption; remove the silence-fallback line.
4. Update `src/types.ts` to drop `notice` and `silence`, add `meditation`; update `EntryFrontmatter` and `FeedEntry` with `heard`/`heardId`.
5. Update `scripts/build-feed.ts` and `scripts/voice-lint.ts` per design.
6. Update `pilgrim-landing/js/walk.js` and `css/walk.css` per design. Add `duck-still.png` asset.
7. Wire `./duck refresh-lines` and `./duck lines status` into `duck.ts`.

No data migration. Old entries on disk stay readable.

## Open questions

None remaining at design time.

## Out of scope (future iterations)

- Adding new lines to the pool from a separate source (e.g., manual additions). v1 is read-only against one-line.md.
- Line filtering by mood, theme, or context. v1 is uniform random over unused.
- Multi-line meditations. v1 is one line per meditation day.
- Surfacing line attribution in UI. v1 stays anonymous.
- Eventually deleting the `./duck silence` CLI command. Kept callable for legacy.
