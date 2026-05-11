# Daily Line + Meditation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every day the duck publishes something to `/walk`. Each day is either *walk-with-line* (duck writes its terse offering plus a `heard:` line from a curated pool) or *meditate* (entry body is the line verbatim). Source pool comes from `github.com/momentmaker/um/blob/master/self/one-line.md`.

**Architecture:** Pure helper functions in `src/lines.ts` (parse, pickDayKind, pickLine, recordUsage) drive the existing `walk-day` slash-command pipeline. New `scripts/refresh-lines.ts` populates `lines/pool.json` from the upstream URL. `duck.ts` gains two subcommands (`refresh-lines`, `lines status`), loses `silence`, and learns to write `kind: meditation` entries. `pilgrim-landing` /walk page swaps the duck marker between gif (walking) and still png (meditating) and renders heard lines beneath walk-with-line bodies.

**Tech Stack:** TypeScript + tsx (already in repo), `node:test` for unit tests, `js-yaml` for frontmatter, `node:crypto` for sha1, native `fetch` for HTTP. UI side: vanilla JS + CSS, no new deps.

**Specs:** `docs/superpowers/specs/2026-05-11-daily-line-and-meditation-design.md`

---

## File Structure

**`rubberduck-walk` (this repo):**

- Create: `src/lines.ts` — pure helpers: `parsePool`, `pickDayKind`, `pickLine`, `recordUsage`, `MEDITATE_PCT`, `RECENCY_WINDOW`, `LINES_SOURCE_URL`.
- Create: `scripts/refresh-lines.ts` — fetch + parse + write `lines/pool.json` (CLI wrapper around `parsePool`).
- Create: `lines/pool.json` — initial empty array.
- Create: `lines/used.json` — initial empty array.
- Create: `test/lines.test.ts` — unit tests for `src/lines.ts`.
- Modify: `src/types.ts` — drop `notice`+`silence` from `EntryKind`, add `meditation`; add `heard?: string` + `heardId?: string` to `EntryFrontmatter` and `FeedEntry`.
- Modify: `src/voice-lint.ts` — update `UNCONSTRAINED_KINDS` (drop `silence`, add `meditation`).
- Modify: `src/feed.ts` — pass `heard` + `heardId` through from `Entry` to `FeedEntry`.
- Modify: `duck.ts` — add `writeMeditation()` helper, `cmdRefreshLines()`, `cmdLinesStatus()`; remove `cmdSilence`; extend dispatch.
- Modify: `package.json` — add `"refresh-lines": "tsx scripts/refresh-lines.ts"` script.
- Modify: `.claude/commands/walk-day.md` — rewrite daily flow per new design.
- Modify: `CLAUDE.md` — rewrite step 2 + add Heard-lines section.
- Modify: `test/voice-lint.test.ts` — replace `silence` exemption test with `meditation`.

**`pilgrim-landing` (sibling repo at `/Users/rubberduck/GitHub/momentmaker/pilgrim-landing`):**

- Create: `assets/duck/duck-still.png` — single frame extracted from `duck.gif`.
- Modify: `js/walk.js` — add latest-entry resolution + duck-marker swap + heard line render + meditation tile branch; remove silence branch + `DOT_RADIUS` updates.
- Modify: `css/walk.css` — add `.walk-entry-heard` + `.walk-entry--meditation`; remove `.walk-entry--silence`.

---

## Task 1: Type changes — drop legacy kinds, add meditation + heard fields

**Files:**
- Modify: `src/types.ts:3`
- Modify: `src/types.ts:41-53` (`EntryFrontmatter`)
- Modify: `src/types.ts:78-95` (`FeedEntry`)

- [ ] **Step 1: Run existing tests baseline** — confirm green before changes.

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 2: Update `EntryKind`**

Edit `src/types.ts` line 3:

```ts
export type EntryKind = "offering" | "threshold" | "letter" | "meditation";
```

(Dropping `"notice"` and `"silence"`.)

- [ ] **Step 3: Add `heard` + `heardId` to `EntryFrontmatter`**

In `src/types.ts`, in the `EntryFrontmatter` interface, after `kmFromStart?: number;`:

```ts
  /** Verbatim text of the curated line carried this day (walk-with-line only). */
  heard?: string;
  /** Stable id of the line in `lines/pool.json`. Present on both walk-with-line and meditation. */
  heardId?: string;
```

- [ ] **Step 4: Add same fields to `FeedEntry`**

In `src/types.ts`, in the `FeedEntry` interface, after `kmSinceLastEntry?: number;`:

```ts
  /** Verbatim text of the curated line carried this day. */
  heard?: string;
  /** Stable id of the line in `lines/pool.json`. */
  heardId?: string;
```

- [ ] **Step 5: Run tests + typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: pass. Any compile error here means a downstream file still references `silence` or `notice` as `EntryKind` — those are fixed in later tasks. If tests fail, narrow to identify and report.

- [ ] **Step 6: Commit**

```bash
git add src/types.ts
git commit -m "feat(types): drop notice/silence kinds, add meditation + heard fields"
```

---

## Task 2: Voice-lint — swap silence exemption for meditation

**Files:**
- Modify: `src/voice-lint.ts:51`
- Modify: `test/voice-lint.test.ts`

- [ ] **Step 1: Find the existing silence test**

Run: `grep -n "silence\|UNCONSTRAINED" test/voice-lint.test.ts src/voice-lint.ts`
Expected: at least one match in each file referencing `silence`.

- [ ] **Step 2: Write failing test for meditation exemption**

In `test/voice-lint.test.ts`, append (or replace the existing silence test if one exists):

```ts
test("meditation kind is exempt from voice rules", () => {
  // #given a meditation body with banned abstractions and digits — anything goes
  const entry = makeEntry({
    kind: "meditation" as EntryKind,
    body: "attention is worship and the journey is mindfulness 123",
    glyph: "🪷",
  });
  // #when linted
  const issues = lintEntry(entry);
  // #then no issues — body is an attributed quote, not duck speech
  assert.deepEqual(issues, []);
});

test("silence kind no longer exists in type — sanity test stays green", () => {
  // #given a normal offering
  const entry = makeEntry({ body: "A stone by the door." });
  // #when linted
  const issues = lintEntry(entry);
  // #then clean
  assert.deepEqual(issues, []);
});
```

- [ ] **Step 3: Run failing test**

Run: `npm test -- --grep "meditation kind is exempt"`
Expected: FAIL — `meditation` is currently linted like `offering`, so the body trips abstraction + digit checks.

- [ ] **Step 4: Update `UNCONSTRAINED_KINDS`**

In `src/voice-lint.ts` line 51:

```ts
const UNCONSTRAINED_KINDS = new Set(["letter", "meditation"]);
```

(Was `["letter", "silence"]`.)

- [ ] **Step 5: Run all voice-lint tests**

Run: `npm test -- test/voice-lint.test.ts`
Expected: all pass, including the new meditation test.

- [ ] **Step 6: Commit**

```bash
git add src/voice-lint.ts test/voice-lint.test.ts
git commit -m "feat(voice-lint): exempt meditation kind, retire silence exemption"
```

---

## Task 3: Line ingest parser (pure)

**Files:**
- Create: `src/lines.ts`
- Create: `test/lines.test.ts`

- [ ] **Step 1: Write failing test for parser shape**

Create `test/lines.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePool } from "../src/lines.ts";

test("parsePool skips blanks, headings, list markers; trims whitespace", () => {
  // #given mixed-content markdown
  const raw = [
    "# heading should be skipped",
    "",
    "  the path forward seems to go back  ",
    "- attention is worship",
    "> simplicity with consistency is the key to brilliance",
    "",
    "...",
    "you are unique and yet one with existence",
  ].join("\n");

  // #when parsed
  const pool = parsePool(raw);

  // #then 4 lines, leading list markers stripped, trimmed
  assert.equal(pool.length, 4);
  assert.equal(pool[0].text, "the path forward seems to go back");
  assert.equal(pool[1].text, "attention is worship");
  assert.equal(pool[2].text, "simplicity with consistency is the key to brilliance");
  assert.equal(pool[3].text, "you are unique and yet one with existence");
});

test("parsePool produces 8-char sha1 ids stable across calls", () => {
  // #given the same input twice
  const raw = "the path forward seems to go back\nattention is worship";

  // #when parsed twice
  const a = parsePool(raw);
  const b = parsePool(raw);

  // #then ids match, are 8 hex chars
  assert.equal(a[0].id, b[0].id);
  assert.match(a[0].id, /^[0-9a-f]{8}$/);
});

test("parsePool rejects empty / whitespace input by returning []", () => {
  // #given empty input
  // #when parsed
  // #then empty pool
  assert.deepEqual(parsePool(""), []);
  assert.deepEqual(parsePool("\n\n   \n"), []);
});

test("parsePool drops punctuation-only lines", () => {
  // #given punctuation-only line mixed with real content
  const raw = "...\n!!!\nreal line here";

  // #when parsed
  const pool = parsePool(raw);

  // #then only real line survives
  assert.equal(pool.length, 1);
  assert.equal(pool[0].text, "real line here");
});
```

- [ ] **Step 2: Run failing test**

Run: `npm test -- test/lines.test.ts`
Expected: FAIL — `src/lines.ts` does not exist yet.

- [ ] **Step 3: Implement parser in `src/lines.ts`**

Create `src/lines.ts`:

```ts
import { createHash } from "node:crypto";

export const MEDITATE_PCT = 30;
export const RECENCY_WINDOW = 50;
export const LINES_SOURCE_URL =
  "https://raw.githubusercontent.com/momentmaker/um/refs/heads/master/self/one-line.md";

export interface PoolLine {
  id: string;
  text: string;
}

export interface UsedRow {
  id: string;
  date: string;
  kind: "heard" | "meditation";
}

const LIST_MARKER_RE = /^[-*>]\s+/;
const PUNCTUATION_ONLY_RE = /^[\s!?.,;:'"`~@#$%^&*()\-+=\[\]{}\\|/<>]+$/;

function sha1Hex(input: string): string {
  return createHash("sha1").update(input).digest("hex");
}

export function parsePool(raw: string): PoolLine[] {
  const lines = raw.split(/\r?\n/);
  const out: PoolLine[] = [];
  for (const line of lines) {
    let text = line.trim();
    if (text.length === 0) continue;
    if (text.startsWith("#")) continue;
    text = text.replace(LIST_MARKER_RE, "");
    if (text.length === 0) continue;
    if (PUNCTUATION_ONLY_RE.test(text)) continue;
    const id = sha1Hex(text).slice(0, 8);
    out.push({ id, text });
  }
  return out;
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- test/lines.test.ts`
Expected: 4 passes.

- [ ] **Step 5: Commit**

```bash
git add src/lines.ts test/lines.test.ts
git commit -m "feat(lines): pure parser for one-line.md pool with stable sha1 ids"
```

---

## Task 4: Day-kind coin (pure function)

**Files:**
- Modify: `src/lines.ts` — add `pickDayKind`.
- Modify: `test/lines.test.ts` — add coin tests.

- [ ] **Step 1: Write failing tests**

Append to `test/lines.test.ts`:

```ts
import { pickDayKind } from "../src/lines.ts";
import type { State } from "../src/types.ts";

function state(overrides: Partial<State> = {}): State {
  return {
    route: "shikoku-88",
    stage: 14,
    stageName: "Joraku-ji",
    coords: [134.476, 34.05],
    mode: "walking",
    modeEnteredAt: "2026-04-22",
    lastAdvancedAt: "2026-05-11",
    ...overrides,
  };
}

test("pickDayKind: closure-arrival forces walk-with-line + threshold", () => {
  // #given resting + entered today
  const s = state({ mode: "resting", modeEnteredAt: "2026-05-11" });
  // #when
  const out = pickDayKind(s, "2026-05-11");
  // #then
  assert.equal(out.dayKind, "walk-with-line");
  assert.equal(out.entryKind, "threshold");
});

test("pickDayKind: resting non-arrival day forces meditate", () => {
  // #given resting but entered yesterday
  const s = state({ mode: "resting", modeEnteredAt: "2026-05-10" });
  // #when
  const out = pickDayKind(s, "2026-05-11");
  // #then
  assert.equal(out.dayKind, "meditate");
  assert.equal(out.entryKind, "meditation");
});

test("pickDayKind: walking + coin is deterministic per date", () => {
  // #given walking
  const s = state({ mode: "walking" });
  // #when called twice with same date
  const a = pickDayKind(s, "2026-05-12");
  const b = pickDayKind(s, "2026-05-12");
  // #then identical
  assert.deepEqual(a, b);
});

test("pickDayKind: walking — ~30% meditate over 1000 dates", () => {
  // #given walking + 1000 unique dates
  const s = state({ mode: "walking" });
  let meditateCount = 0;
  for (let i = 0; i < 1000; i++) {
    const d = new Date(Date.UTC(2026, 0, 1) + i * 86400000)
      .toISOString()
      .slice(0, 10);
    if (pickDayKind(s, d).dayKind === "meditate") meditateCount++;
  }
  // #then count falls within ±40 of 300 (260..340)
  assert.ok(
    meditateCount >= 260 && meditateCount <= 340,
    `expected 260..340 meditate days, got ${meditateCount}`,
  );
});

test("pickDayKind: beginning mode uses coin (not auto-walk)", () => {
  // #given beginning mode
  const s = state({ mode: "beginning" });
  // #when across 100 dates
  const kinds = new Set<string>();
  for (let i = 0; i < 100; i++) {
    const d = new Date(Date.UTC(2026, 0, 1) + i * 86400000)
      .toISOString()
      .slice(0, 10);
    kinds.add(pickDayKind(s, d).dayKind);
  }
  // #then both outcomes appear (coin is firing)
  assert.ok(kinds.has("walk-with-line"));
  assert.ok(kinds.has("meditate"));
});
```

- [ ] **Step 2: Run failing tests**

Run: `npm test -- test/lines.test.ts`
Expected: FAIL — `pickDayKind` not exported.

- [ ] **Step 3: Implement `pickDayKind` in `src/lines.ts`**

Append to `src/lines.ts`:

```ts
import type { State, EntryKind } from "./types.ts";

export type DayKind = "walk-with-line" | "meditate";

export interface DayKindResult {
  dayKind: DayKind;
  entryKind: EntryKind;
}

function dateCoin(date: string): number {
  // Maps date → integer in [0, 100). Stable, no Math.random.
  const hex = sha1Hex(date).slice(0, 8);
  return parseInt(hex, 16) % 100;
}

export function pickDayKind(state: State, today: string): DayKindResult {
  // Closure-arrival: duck just landed at the closure site (resting + entered today).
  if (state.mode === "resting" && state.modeEnteredAt === today) {
    return { dayKind: "walk-with-line", entryKind: "threshold" };
  }
  // Resting-not-arrival: any later resting day — voice rules need motion, so meditate.
  if (state.mode === "resting" && state.modeEnteredAt < today) {
    return { dayKind: "meditate", entryKind: "meditation" };
  }
  // Walking / beginning / completing: coin at MEDITATE_PCT.
  if (dateCoin(today) < MEDITATE_PCT) {
    return { dayKind: "meditate", entryKind: "meditation" };
  }
  return { dayKind: "walk-with-line", entryKind: "offering" };
}
```

Also at top of file, change the existing `import { createHash } ...` line to additionally import the type:

```ts
import { createHash } from "node:crypto";
import type { State, EntryKind } from "./types.ts";
```

(Move the type import to the top with the other import. Delete the duplicate `import type` line that you'd otherwise be adding at the bottom.)

- [ ] **Step 4: Run tests**

Run: `npm test -- test/lines.test.ts`
Expected: all pass (parser tests + 5 coin tests).

- [ ] **Step 5: Commit**

```bash
git add src/lines.ts test/lines.test.ts
git commit -m "feat(lines): pickDayKind — closure-arrival + resting + 30% coin"
```

---

## Task 5: Line selection (pickLine) with same-date guard, recency window, empty-pool

**Files:**
- Modify: `src/lines.ts` — add `pickLine`.
- Modify: `test/lines.test.ts` — add selection tests.

- [ ] **Step 1: Write failing tests**

Append to `test/lines.test.ts`:

```ts
import { pickLine } from "../src/lines.ts";
import type { PoolLine, UsedRow } from "../src/lines.ts";

function pool(n: number): PoolLine[] {
  return Array.from({ length: n }, (_, i) => ({
    id: i.toString(16).padStart(8, "0"),
    text: `line ${i}`,
  }));
}

test("pickLine: empty pool returns null", () => {
  // #given empty pool
  // #when pickLine called
  // #then null
  assert.equal(pickLine("2026-05-12", [], []), null);
});

test("pickLine: same-date guard reuses logged id", () => {
  // #given today already in used.json
  const p = pool(5);
  const used: UsedRow[] = [
    { id: "00000002", date: "2026-05-12", kind: "heard" },
  ];
  // #when picked
  const out = pickLine("2026-05-12", p, used);
  // #then returns the logged line
  assert.equal(out!.id, "00000002");
  assert.equal(out!.text, "line 2");
});

test("pickLine: deterministic on same-date + same pool/used", () => {
  // #given walking-day-style: no prior usage today
  const p = pool(100);
  // #when called twice
  const a = pickLine("2026-05-12", p, []);
  const b = pickLine("2026-05-12", p, []);
  // #then same id both times
  assert.equal(a!.id, b!.id);
});

test("pickLine: returns from unused before exhaustion", () => {
  // #given pool of 3 with 2 used
  const p = pool(3);
  const used: UsedRow[] = [
    { id: "00000000", date: "2026-05-01", kind: "heard" },
    { id: "00000001", date: "2026-05-02", kind: "heard" },
  ];
  // #when picked for a new date
  const out = pickLine("2026-05-12", p, used);
  // #then the unused one (id 2)
  assert.equal(out!.id, "00000002");
});

test("pickLine: recency-window after exhaustion blocks last N", () => {
  // #given pool of 60, all 60 used over 60 days, RECENCY_WINDOW=50
  const p = pool(60);
  const used: UsedRow[] = p.map((line, i) => ({
    id: line.id,
    date: new Date(Date.UTC(2026, 0, 1) + i * 86400000).toISOString().slice(0, 10),
    kind: "heard" as const,
  }));
  // #when picked for date 61
  const out = pickLine("2026-05-12", p, used);
  // #then result must be from the oldest 10 ids (60 - 50 = 10 eligible)
  const eligibleIds = p.slice(0, 10).map((l) => l.id);
  assert.ok(
    eligibleIds.includes(out!.id),
    `expected id in oldest 10 (${eligibleIds.join(",")}), got ${out!.id}`,
  );
});

test("pickLine: recency window degrades when pool ≤ window", () => {
  // #given pool of 5, all 5 used, RECENCY_WINDOW=50
  const p = pool(5);
  const used: UsedRow[] = p.map((line, i) => ({
    id: line.id,
    date: new Date(Date.UTC(2026, 0, 1) + i * 86400000).toISOString().slice(0, 10),
    kind: "heard" as const,
  }));
  // #when picked for a new date
  const out = pickLine("2026-05-12", p, used);
  // #then returns the single oldest id (recency window blocks all but 1)
  assert.equal(out!.id, "00000000");
});
```

- [ ] **Step 2: Run failing tests**

Run: `npm test -- test/lines.test.ts`
Expected: FAIL — `pickLine` not exported.

- [ ] **Step 3: Implement `pickLine` in `src/lines.ts`**

Append to `src/lines.ts`:

```ts
function deterministicIndex(date: string, salt: string, len: number): number {
  const hex = sha1Hex(date + ":" + salt).slice(0, 8);
  return parseInt(hex, 16) % len;
}

export function pickLine(
  today: string,
  pool: PoolLine[],
  used: UsedRow[],
): PoolLine | null {
  // Empty pool → caller forces walk-with-line without heard.
  if (pool.length === 0) return null;

  // Same-date guard: reuse whatever was already logged for today.
  const todayRow = used.find((u) => u.date === today);
  if (todayRow) {
    const match = pool.find((p) => p.id === todayRow.id);
    if (match) return match;
    // Edge: logged id no longer in pool (deleted by refresh). Fall through to repick.
  }

  // Fresh-cycle: pool minus all-time used.
  const usedIds = new Set(used.map((u) => u.id));
  const unusedFresh = pool.filter((p) => !usedIds.has(p.id));
  if (unusedFresh.length > 0) {
    const idx = deterministicIndex(today, "line", unusedFresh.length);
    return unusedFresh[idx];
  }

  // Exhausted: recency window. Block the last min(RECENCY_WINDOW, pool.length - 1) ids.
  const windowSize = Math.min(RECENCY_WINDOW, pool.length - 1);
  const recencyIds = new Set(
    used.slice(-windowSize).map((u) => u.id),
  );
  const eligible = pool.filter((p) => !recencyIds.has(p.id));
  if (eligible.length === 0) {
    // Defensive: only triggers if pool.length === 1 and that 1 is in recency.
    return pool[0];
  }
  const idx = deterministicIndex(today, "line", eligible.length);
  return eligible[idx];
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- test/lines.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/lines.ts test/lines.test.ts
git commit -m "feat(lines): pickLine — same-date guard, fresh cycle, recency-50 window"
```

---

## Task 6: Used-log append (recordUsage), idempotent on date

**Files:**
- Modify: `src/lines.ts` — add `recordUsage`.
- Modify: `test/lines.test.ts` — add recordUsage tests.

- [ ] **Step 1: Write failing tests**

Append to `test/lines.test.ts`:

```ts
import { recordUsage } from "../src/lines.ts";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

test("recordUsage appends new row", async () => {
  // #given empty used.json
  const dir = await mkdtemp(path.join(os.tmpdir(), "lines-"));
  const usedPath = path.join(dir, "used.json");
  await writeFile(usedPath, "[]");

  // #when recordUsage called
  await recordUsage(usedPath, { id: "00000001", date: "2026-05-12", kind: "heard" });

  // #then file contains one row
  const data: UsedRow[] = JSON.parse(await readFile(usedPath, "utf8"));
  assert.equal(data.length, 1);
  assert.deepEqual(data[0], { id: "00000001", date: "2026-05-12", kind: "heard" });
});

test("recordUsage is idempotent on date — no duplicate rows", async () => {
  // #given used.json with today's row already
  const dir = await mkdtemp(path.join(os.tmpdir(), "lines-"));
  const usedPath = path.join(dir, "used.json");
  await writeFile(
    usedPath,
    JSON.stringify([{ id: "00000001", date: "2026-05-12", kind: "heard" }]),
  );

  // #when recordUsage called again for the same date (even with different id)
  await recordUsage(usedPath, { id: "00000099", date: "2026-05-12", kind: "meditation" });

  // #then no duplicate — original row preserved (first-write-wins)
  const data: UsedRow[] = JSON.parse(await readFile(usedPath, "utf8"));
  assert.equal(data.length, 1);
  assert.equal(data[0].id, "00000001");
});

test("recordUsage creates file if missing", async () => {
  // #given no used.json
  const dir = await mkdtemp(path.join(os.tmpdir(), "lines-"));
  const usedPath = path.join(dir, "used.json");

  // #when recordUsage called
  await recordUsage(usedPath, { id: "00000001", date: "2026-05-12", kind: "heard" });

  // #then file created with one row
  const data: UsedRow[] = JSON.parse(await readFile(usedPath, "utf8"));
  assert.equal(data.length, 1);
});
```

- [ ] **Step 2: Run failing tests**

Run: `npm test -- test/lines.test.ts`
Expected: FAIL — `recordUsage` not exported.

- [ ] **Step 3: Implement `recordUsage` in `src/lines.ts`**

Add to top imports of `src/lines.ts`:

```ts
import { readFile, writeFile } from "node:fs/promises";
```

Append to `src/lines.ts`:

```ts
export async function readUsed(usedPath: string): Promise<UsedRow[]> {
  try {
    const raw = await readFile(usedPath, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as UsedRow[];
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException)?.code === "ENOENT") return [];
    throw err;
  }
}

export async function recordUsage(usedPath: string, row: UsedRow): Promise<void> {
  const current = await readUsed(usedPath);
  if (current.some((r) => r.date === row.date)) {
    return; // idempotent: already logged for this date, first-write-wins
  }
  current.push(row);
  await writeFile(usedPath, JSON.stringify(current, null, 2) + "\n");
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- test/lines.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/lines.ts test/lines.test.ts
git commit -m "feat(lines): recordUsage append with date-keyed idempotency"
```

---

## Task 7: Pool loader helper (readPool)

**Files:**
- Modify: `src/lines.ts` — add `readPool`.
- Modify: `test/lines.test.ts` — add `readPool` tests.

- [ ] **Step 1: Write failing test**

Append to `test/lines.test.ts`:

```ts
import { readPool } from "../src/lines.ts";

test("readPool returns parsed pool from json", async () => {
  // #given pool.json on disk
  const dir = await mkdtemp(path.join(os.tmpdir(), "lines-"));
  const poolPath = path.join(dir, "pool.json");
  await writeFile(
    poolPath,
    JSON.stringify([{ id: "00000001", text: "the path forward seems to go back" }]),
  );

  // #when read
  const pool = await readPool(poolPath);

  // #then one line
  assert.equal(pool.length, 1);
  assert.equal(pool[0].id, "00000001");
});

test("readPool returns [] if file missing (first-run)", async () => {
  // #given non-existent path
  const dir = await mkdtemp(path.join(os.tmpdir(), "lines-"));
  // #when read
  const pool = await readPool(path.join(dir, "pool.json"));
  // #then empty
  assert.deepEqual(pool, []);
});
```

- [ ] **Step 2: Run failing test**

Run: `npm test -- test/lines.test.ts`
Expected: FAIL — `readPool` not exported.

- [ ] **Step 3: Implement `readPool` in `src/lines.ts`**

Append to `src/lines.ts`:

```ts
export async function readPool(poolPath: string): Promise<PoolLine[]> {
  try {
    const raw = await readFile(poolPath, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as PoolLine[];
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException)?.code === "ENOENT") return [];
    throw err;
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- test/lines.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/lines.ts test/lines.test.ts
git commit -m "feat(lines): readPool with ENOENT-safe defaults"
```

---

## Task 8: `refresh-lines` CLI script

**Files:**
- Create: `scripts/refresh-lines.ts`
- Modify: `package.json` — add `"refresh-lines"` npm script.

- [ ] **Step 1: Write the script**

Create `scripts/refresh-lines.ts`:

```ts
#!/usr/bin/env -S tsx
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { LINES_SOURCE_URL, parsePool, readPool } from "../src/lines.ts";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");
const POOL_PATH = path.join(REPO_ROOT, "lines", "pool.json");
const FETCH_TIMEOUT_MS = 30_000;
const MIN_BODY_BYTES = 32;

async function fetchSource(url: string): Promise<string> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ac.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const body = await res.text();
    if (body.length < MIN_BODY_BYTES) {
      throw new Error(`refused to overwrite pool: body too short (${body.length} bytes)`);
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const raw = await fetchSource(LINES_SOURCE_URL);
  const fresh = parsePool(raw);
  if (fresh.length === 0) {
    throw new Error("refused to overwrite pool: parser yielded zero lines");
  }

  const existing = await readPool(POOL_PATH);
  const existingIds = new Set(existing.map((p) => p.id));
  const freshIds = new Set(fresh.map((p) => p.id));

  const added = fresh.filter((p) => !existingIds.has(p.id)).length;
  const removed = existing.filter((p) => !freshIds.has(p.id)).length;
  const unchanged = fresh.filter((p) => existingIds.has(p.id)).length;

  await writeFile(POOL_PATH, JSON.stringify(fresh, null, 2) + "\n");
  console.log(
    `refresh-lines: pool=${fresh.length} added=${added} removed=${removed} unchanged=${unchanged}`,
  );
}

main().catch((err) => {
  console.error(`refresh-lines failed: ${err.message}`);
  process.exit(1);
});
```

- [ ] **Step 2: Add npm script**

In `package.json`, in the `scripts` block, add after `"voice-lint":`:

```json
    "refresh-lines": "tsx scripts/refresh-lines.ts",
```

- [ ] **Step 3: Create empty pool + used files**

Run:

```bash
mkdir -p lines
echo '[]' > lines/pool.json
echo '[]' > lines/used.json
```

- [ ] **Step 4: Smoke test the fetch path**

Run: `npm run refresh-lines`
Expected: stdout like `refresh-lines: pool=NNN added=NNN removed=0 unchanged=0` where NNN ≥ 200. `lines/pool.json` is now populated.

If fetch fails (offline / 404), the script exits non-zero and `pool.json` stays `[]`. That's correct behavior; verify by inspecting the file.

- [ ] **Step 5: Sanity-check pool**

Run: `head -c 200 lines/pool.json`
Expected: JSON array starting with `[{"id":"...","text":"..."}`.

- [ ] **Step 6: Commit**

```bash
git add scripts/refresh-lines.ts package.json lines/pool.json lines/used.json
git commit -m "feat(refresh-lines): fetch + parse one-line.md into lines/pool.json"
```

---

## Task 9: `duck.ts` — write meditation entries

**Files:**
- Modify: `duck.ts:28-75` (extend `writeEntry`).

Goal: `writeEntry` can produce a `kind: meditation` file at `entries/<today>-meditation.md` (slug fixed, not stage-derived) with `heardId` in frontmatter and the line as body. Walk-with-line writes get optional `heard` + `heardId`.

- [ ] **Step 1: Run baseline tests** — make sure types from Task 1 don't leave `duck.ts` broken.

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 2: Extend `writeEntry` signature**

Replace `writeEntry` in `duck.ts` (lines ~28-75) with:

```ts
async function writeEntry(opts: {
  kind: EntryKind;
  glyph: string;
  body: string;
  author?: string;
  heard?: string;
  heardId?: string;
}): Promise<string> {
  const state = await readState();
  const today = new Date().toISOString().slice(0, 10);
  const slug =
    opts.kind === "meditation"
      ? "meditation"
      : state.stageName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const fileName = `${today}-${slug}.md`;
  const filePath = path.join(REPO_ROOT, "entries", fileName);

  let kmFromStart: number | undefined;
  try {
    const route = await readRoute(state.route);
    const s = route.stages.find((x) => x.index === state.stage);
    if (s && typeof s.kmFromStart === "number") kmFromStart = s.kmFromStart;
  } catch {
    // ignore
  }

  const weather = await fetchWeather(state.coords).catch(() => null);

  const frontmatter: Record<string, unknown> = {
    date: today,
    route: state.route,
    stage: state.stage,
    stageName: state.stageName,
    coords: state.coords,
    kind: opts.kind,
    glyph: opts.glyph,
  };
  if (weather) frontmatter.weather = weather;
  if (kmFromStart !== undefined) frontmatter.kmFromStart = kmFromStart;
  if (opts.author) frontmatter.author = opts.author;
  if (opts.heard) frontmatter.heard = opts.heard;
  if (opts.heardId) frontmatter.heardId = opts.heardId;

  const fmYaml = yaml.dump(frontmatter, { flowLevel: 1 }).trim();
  const content = `---\n${fmYaml}\n---\n\n${opts.body}\n`;
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content);
  return filePath;
}
```

(Removed the `onRoute` km check — meditation days at closure perch still emit km when the stage has it; behaviour is unchanged for offerings.)

- [ ] **Step 3: Add date-seeded glyph helper near `cmdSilence` location**

In `duck.ts`, just below `REPO_ROOT`:

```ts
import { createHash } from "node:crypto";

const GLYPH_PALETTE = "⚇ ❂ ⛩️ 🔔 🪷 🕯️ 🌙 🪨 🌿 🍃 💧 🌧️ ☁️ 🗻 🪵 🐚 🌾 🌫️ 🕊️ ◯ △ ☰ ∅ ∞ ≡ 〰️ 🌀".split(" ");

function meditationGlyph(today: string): string {
  const hex = createHash("sha1").update(today + ":glyph").digest("hex").slice(0, 8);
  return GLYPH_PALETTE[parseInt(hex, 16) % GLYPH_PALETTE.length];
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Smoke test (manual)**

In a scratch directory, run a TS one-liner to confirm slug + frontmatter:

Run:
```bash
node --import tsx -e '
import("./duck.ts").catch((e) => { console.error("expected, duck.ts main runs"); });
'
```

(Optional — not strictly needed if compile passes; the real test is end-to-end in the next task.)

- [ ] **Step 6: Commit**

```bash
git add duck.ts
git commit -m "feat(duck): writeEntry supports heard/heardId + meditation slug"
```

---

## Task 10: `duck.ts` — replace `silence` with `refresh-lines` + `lines status`

**Files:**
- Modify: `duck.ts` — remove `cmdSilence`, add `cmdRefreshLines`, add `cmdLinesStatus`, update dispatch.

- [ ] **Step 1: Remove `cmdSilence`**

Delete the entire `cmdSilence` function in `duck.ts` (was lines 94-99 in original).

- [ ] **Step 2: Add `cmdRefreshLines` + `cmdLinesStatus`**

In `duck.ts`, near the other `cmd*` functions, add:

```ts
async function cmdRefreshLines() {
  await run("npx", ["tsx", "scripts/refresh-lines.ts"]);
}

async function cmdLinesStatus() {
  const { readPool, readUsed, RECENCY_WINDOW } = await import("./src/lines.ts");
  const poolPath = path.join(REPO_ROOT, "lines", "pool.json");
  const usedPath = path.join(REPO_ROOT, "lines", "used.json");
  const pool = await readPool(poolPath);
  const used = await readUsed(usedPath);
  const recentIds = new Set(used.slice(-RECENCY_WINDOW).map((u) => u.id));
  const usedRecent = pool.filter((p) => recentIds.has(p.id)).length;
  const lastDate = used.length > 0 ? used[used.length - 1].date : "(never)";
  console.log(`pool:           ${pool.length}`);
  console.log(`used (lifetime): ${used.length}`);
  console.log(`used (recency-${RECENCY_WINDOW}): ${usedRecent}`);
  console.log(`last used:      ${lastDate}`);
}
```

- [ ] **Step 3: Update dispatch switch + usage line**

In `duck.ts` `main()`, replace the switch block:

```ts
async function main() {
  const [, , cmd, sub] = process.argv;
  switch (cmd) {
    case "status":         return cmdStatus();
    case "advance":        return cmdAdvance();
    case "build":
    case "build-feed":     return cmdBuildFeed();
    case "offer":          return cmdOffer();
    case "letter":         return cmdLetter();
    case "next":           return cmdNext(process.argv[3]);
    case "preview":        return cmdPreview();
    case "refresh-lines":  return cmdRefreshLines();
    case "lines":
      if (sub === "status") return cmdLinesStatus();
      console.error("usage: ./duck lines status");
      process.exit(1);
    default:
      console.error("usage: ./duck {status|advance|build-feed|offer|letter|next <route-id>|preview|refresh-lines|lines status}");
      process.exit(1);
  }
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Smoke test the CLI**

Run: `./duck lines status`
Expected:
```
pool:           NNN
used (lifetime): 0
used (recency-50): 0
last used:      (never)
```

Run: `./duck silence`
Expected: `usage: ./duck {status|...}` and exit 1. (Confirms removal.)

- [ ] **Step 6: Commit**

```bash
git add duck.ts
git commit -m "feat(duck): refresh-lines + lines-status commands; remove silence"
```

---

## Task 11: Feed builder passes `heard`/`heardId` through

**Files:**
- Modify: `src/feed.ts:51-67`.
- Modify: `test/feed.test.ts` (if exists; otherwise create a small additional test).

- [ ] **Step 1: Check existing feed tests**

Run: `cat test/feed.test.ts | head -40`
Expected: file exists and has at least one test against `buildFeed`. Use its `makeEntry`-style helper as a template.

- [ ] **Step 2: Write failing test for heard pass-through**

Append to `test/feed.test.ts` (adapt the entry-shape helper from existing tests):

```ts
test("buildFeed passes heard + heardId from Entry to FeedEntry", () => {
  // #given an offering entry with heard fields
  const today = "2026-05-12";
  const entry: Entry = {
    date: today,
    route: "shikoku-88",
    stage: 1,
    stageName: "Ryozen-ji",
    coords: [134.503, 34.16],
    kind: "offering",
    glyph: "🪨",
    body: "A stone by the door.",
    paragraphs: ["A stone by the door."],
    filePath: "/fake.md",
    ageDays: 0,
    heard: "the path forward seems to go back",
    heardId: "8f2a7b91",
  };
  const state: State = {
    route: "shikoku-88", stage: 1, stageName: "Ryozen-ji",
    coords: [134.503, 34.16], mode: "walking",
    modeEnteredAt: today, lastAdvancedAt: today,
  };
  const route: Route = {
    id: "shikoku-88", name: "Shikoku 88", country: "JP",
    distanceKm: 1200, stages: [{ index: 1, name: "Ryozen-ji", coords: [134.503, 34.16], kmFromStart: 0 }],
  };

  // #when feed built
  const feed = buildFeed({ state, route, entries: [entry], today });

  // #then the FeedEntry surfaces heard fields verbatim
  assert.equal(feed.entries[0].heard, "the path forward seems to go back");
  assert.equal(feed.entries[0].heardId, "8f2a7b91");
});
```

(If `test/feed.test.ts` already has the `Entry` / `State` / `Route` imports, reuse them; otherwise add at the top.)

- [ ] **Step 3: Run failing test**

Run: `npm test -- test/feed.test.ts`
Expected: FAIL on the new test — fields are undefined.

- [ ] **Step 4: Update `buildFeed` to pass fields through**

In `src/feed.ts`, in the `feedEntries` map (around line 51-67), after the existing `if (entryKm !== undefined) fe.kmFromStart = entryKm;` line:

```ts
    if (e.heard) fe.heard = e.heard;
    if (e.heardId) fe.heardId = e.heardId;
```

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/feed.ts test/feed.test.ts
git commit -m "feat(feed): pass heard + heardId through to FeedEntry"
```

---

## Task 12: `walk-day.md` — rewrite slash command for new daily flow

**Files:**
- Modify: `.claude/commands/walk-day.md` (full rewrite).

This is the runtime playbook the cron-launched Claude session reads. It must encode the new pipeline.

- [ ] **Step 1: Replace contents of `.claude/commands/walk-day.md`**

```markdown
---
description: The duck's daily walk — advance, decide kind, write entry, build feed, render og, commit, push, purge
---

It is the duck's walk day. Follow the playbook in `CLAUDE.md` exactly. Summary:

1. **Advance.** Run `./duck advance` — always. Updates `state.json`. Idempotent on `lastAdvancedAt`.

2. **Entry-exists guard.** Glob `entries/<today>-*.md` (UTC date). If a file matches:
   - Read its frontmatter `heardId`. If present and not already logged in `lines/used.json` for today, append the row now via the same mechanism used in step 6 (atomic recovery from a prior crash between entry-write and used.json append).
   - Skip steps 3-7. Jump to step 8.

3. **Pick day kind.** Call `pickDayKind(state, today)` from `src/lines.ts`:
   - Closure-arrival (resting + entered today) → walk-with-line + threshold.
   - Resting non-arrival → meditate.
   - Walking / beginning / completing → 30% coin → meditate / walk-with-line.

4. **Pull line.** Call `pickLine(today, pool, used)`:
   - If pool is empty → force walk-with-line and skip `heard:` for the day.
   - Same-date guard returns previously-logged id.
   - Else fresh-cycle or recency-50 pick.

5. **Weather + km.** `npm run weather 2>/dev/null || echo unknown`. Read `kmFromStart` from `routes/<state.route>.json` for `state.stage`.

6. **Draft and write.**
   - **walk-with-line:** read the 3 most recent entries for voice context. Draft body per voice rules in CLAUDE.md. Write entry with `kind: offering` (or `threshold` on closure-arrival), `heard`, `heardId`.
   - **meditate:** no drafting. Write entry with `kind: meditation`, body = line text verbatim, `heardId`, date-seeded glyph from palette. Slug fixed to `meditation`.

7. **Self-review + voice-lint.** Walk-with-line only. Self-review against checklist; redraft up to 2x. Then run `npm run voice-lint -- entries/<file>.md`. If still failing after 3 drafts: delete the failed draft, fall back to meditate with today's line.

8. **Record line usage.** Append `{ id, date, kind }` to `lines/used.json`. Idempotent by date.

9. **Rebuild feed.** `./duck build-feed`.

10. **OG card.** `bash bin/render-og.sh`. Fail soft.

11. **Now.json.** Regenerate per `docs/now-voice.md`. Fail soft.

12. **Commit, push, purge.**
    ```bash
    git add -A
    git commit -m "the duck walks" || echo "(nothing to commit)"
    git push
    bash scripts/purge.sh
    ```

The 27-glyph palette, voice rules, banned-abstraction list, and the self-review checklist all live in `CLAUDE.md`. Load it before drafting.

Report back with:
- What the duck did today (advanced to X, walk-with-line or meditate, line text, lint pass/fail)
- Whether og-image.png regenerated successfully
- Any deviation from the playbook and why
```

- [ ] **Step 2: Commit**

```bash
git add .claude/commands/walk-day.md
git commit -m "docs(walk-day): rewrite slash command for new daily flow"
```

---

## Task 13: `CLAUDE.md` — rewrite step 2 + add Heard-lines section

**Files:**
- Modify: `CLAUDE.md`.

- [ ] **Step 1: Replace step 2 in the Daily schedule flow**

In `CLAUDE.md`, locate the "## Daily schedule flow" section. Replace step 2 ("Decide whether to write.") with:

```markdown
2. **Pick day kind.** Read the new `state.json` and call the helpers in `src/lines.ts`:
   - **Closure-arrival** (`state.mode == "resting"` AND `state.modeEnteredAt == today`, where `today` is the UTC date from `new Date().toISOString().slice(0,10)`): always write `kind: threshold`. Fires exactly once per route.
   - **Resting non-arrival** (`mode == "resting"` AND `modeEnteredAt < today`): always write `kind: meditation`. The duck stays at the closure-site coords and carries a line.
   - **Walking / beginning / completing:** flip the date-seeded coin (`MEDITATE_PCT = 30`). 30% chance `kind: meditation`, else `kind: offering`.

2a. **Pull the day's line** from `lines/pool.json` minus `lines/used.json` (same-date guard first; recency-50 window after exhaustion). If pool is empty (first-run before `./duck refresh-lines`), force `kind: offering` and omit `heard:` from the entry.

2b. **Entry-exists guard.** Before drafting: if `entries/<today>-*.md` already exists (cron re-run), read its `heardId` and reconcile into `used.json` if missing, then skip ahead to step 6.
```

- [ ] **Step 2: Update step 5a (programmatic lint section)**

Replace the existing "Programmatic voice lint" paragraph with:

```markdown
5a. **Programmatic voice lint** — run `npm run voice-lint -- entries/<new-entry>.md`. This applies to `offering` and `threshold` entries only. `meditation` and `letter` are exempt (body is an attributed quote or human-authored). If lint fails 3x on a walk-with-line draft, delete the file and re-emit as `kind: meditation` with today's line as the body — never produce a silence entry.

5b. **Record line usage.** After the entry file is successfully written, append `{ id, date, kind: "heard"|"meditation" }` to `lines/used.json`. Idempotent by date — second-time writes are no-ops.
```

- [ ] **Step 3: Add new section "## Heard lines"** after the "## Glyph palette" section:

```markdown
## Heard lines

The duck carries lines from chiefrubberduck's old one-line journal as **overheard material**. Lines are never spoken by the duck (they don't pass through voice rules) — they appear in entry frontmatter on walk days (`heard:`) or as the body verbatim on meditate days (`kind: meditation`, body = line).

**Source:** `https://raw.githubusercontent.com/momentmaker/um/refs/heads/master/self/one-line.md`. Populated into `lines/pool.json` via `./duck refresh-lines`. Each line gets a stable 8-char sha1 id.

**Rotation:** lifetime no-repeat (`lines/used.json` is append-only). When the pool is exhausted, a recency-50 window blocks the most recently surfaced lines — every line eventually returns, but not within ~50 days of its last appearance.

**Voice ownership:** lines are the chief's voice, not the duck's. The voice-lint rules (no "I", ≤20 words, no abstractions) do not apply to them. The duck carries; it does not speak them.

**UTC boundaries.** All dates in `state.json`, `used.json`, and entry frontmatter are UTC dates (`new Date().toISOString().slice(0,10)`). Cron may fire at any wall-clock time; UTC keeps day boundaries deterministic.
```

- [ ] **Step 4: Update the "## Emitting a silence entry" section**

Replace its contents with:

```markdown
## What happens when the duck can't speak

There is no longer a `kind: silence`. If the model can't draft a walk-with-line body that passes voice-lint after 3 tries, the day falls back to `kind: meditation` carrying today's pulled line. The duck never produces an empty entry. The `./duck silence` CLI command has been removed.
```

- [ ] **Step 5: Update the "## Writing an entry to disk" section**

Add to the frontmatter example (after `kmFromStart: 0`):

```markdown
    heard: a stone by the door, no one had moved it
    heardId: 8f2a7b91
```

And add a paragraph below the existing description:

```markdown
For `kind: meditation` entries, the slug is fixed to `meditation` (not derived from `stageName`). The body is the line text verbatim — voice rules do not apply. `heard:` is omitted (body is the line); only `heardId` appears in frontmatter.
```

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(CLAUDE.md): rewrite step 2 + heard-lines section"
```

---

## Task 14: `/walk` page (pilgrim-landing) — latest-entry resolver + duck marker swap

**Files:**
- Modify: `/Users/rubberduck/GitHub/momentmaker/pilgrim-landing/js/walk.js`.

- [ ] **Step 1: Open `walk.js`, locate the duck-marker section**

The duck-marker insertion is around line 632 in `js/walk.js`. The image source is set from `DUCK_GIF` constant (line ~13).

- [ ] **Step 2: Add `DUCK_STILL_PNG` constant + helpers**

Near the top of the IIFE (around the existing `const DUCK_GIF = ...;`), add:

```js
  const DUCK_STILL_PNG = "assets/duck/duck-still.png";

  // kind priority: threshold > letter > meditation > offering. Used to pick the
  // "latest" entry when two entries share a date (e.g., a recovery + meditation).
  const KIND_PRIORITY = { threshold: 4, letter: 3, meditation: 2, offering: 1 };

  function latestEntry(entries) {
    if (!entries || entries.length === 0) return null;
    // entries are already sorted by date desc in feed builder. Tiebreak on kind, then array order.
    const top = entries[0];
    const sameDate = entries.filter((e) => e.date === top.date);
    if (sameDate.length === 1) return top;
    sameDate.sort((a, b) => (KIND_PRIORITY[b.kind] ?? 0) - (KIND_PRIORITY[a.kind] ?? 0));
    return sameDate[0];
  }

  function duckMarkerSrc(entries) {
    const top = latestEntry(entries);
    if (top && top.kind === "meditation") return DUCK_STILL_PNG;
    return DUCK_GIF;
  }
```

- [ ] **Step 3: Use `duckMarkerSrc` where the marker is rendered**

Find the line that sets the duck marker `src`/`href`. In the existing code (around line 633-640):

```js
      img.setAttribute("href", DUCK_GIF);
```

Replace `DUCK_GIF` with `duckMarkerSrc(feed.entries)`:

```js
      img.setAttribute("href", duckMarkerSrc(feed.entries));
```

(The variable name may be `href` or `xlink:href` depending on the SVG renderer — match what's already there. Look at the surrounding 3 lines for context.)

- [ ] **Step 4: Smoke test locally**

Run from `pilgrim-landing`:

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000/walk.html`. The duck marker still appears (it'll be GIF since no meditation entries exist yet). Open dev-tools console — no JS errors.

- [ ] **Step 5: Commit (in pilgrim-landing repo)**

```bash
cd /Users/rubberduck/GitHub/momentmaker/pilgrim-landing
git add js/walk.js
git commit -m "feat(walk): swap duck marker between gif/still based on latest kind"
cd -
```

---

## Task 15: `/walk` page — render `heard:` line + meditation tile

**Files:**
- Modify: `/Users/rubberduck/GitHub/momentmaker/pilgrim-landing/js/walk.js`.
- Modify: `/Users/rubberduck/GitHub/momentmaker/pilgrim-landing/css/walk.css`.

- [ ] **Step 1: Locate entry-tile renderer**

Find the function in `walk.js` that creates an entry element (around line 360 — uses `walk-entry walk-entry--${entry.kind}` class).

- [ ] **Step 2: Render heard line for offering / threshold entries**

After the body element is appended (find where `entry-body` div is added, ~line 419), add:

```js
    if (entry.heard && (entry.kind === "offering" || entry.kind === "threshold")) {
      const heardEl = document.createElement("div");
      heardEl.className = "walk-entry-heard";
      heardEl.textContent = "— " + entry.heard;
      el.appendChild(heardEl);
    }
```

- [ ] **Step 3: Remove the silence branch**

Find the line `if (entry.kind !== "silence") { ... }` (around line 419). The `entry.kind !== "silence"` guard is no longer needed — meditation entries always have a body. Replace the wrapper conditional so the body is always rendered.

The existing block likely reads:
```js
    if (entry.kind !== "silence") {
      const bodyEl = document.createElement("div");
      // ...
    }
```

Replace with:
```js
    const bodyEl = document.createElement("div");
    // ...
```

(Unwrap the conditional — keep its inner contents.)

- [ ] **Step 4: Add DOT_RADIUS entry for meditation**

Find the `DOT_RADIUS` constant (around line 46). Add `meditation`:

```js
  const DOT_RADIUS = {
    offering: 8,
    threshold: 12,
    letter: 10,
    meditation: 8,
    silence: 4,  // ← if still present, remove this line
  };
```

(Drop any `silence` entry if it exists.)

- [ ] **Step 5: Add CSS for `walk-entry-heard` + `walk-entry--meditation`**

In `css/walk.css`, append:

```css
/* Heard line — small italic carry-through beneath the body on walk-with-line tiles. */
.walk-entry-heard {
  font-style: italic;
  font-size: 0.85em;
  opacity: 0.7;
  margin-top: 0.5em;
}

/* Meditation — body is the carried line itself; tile dimmed subtly to cue pause. */
.walk-entry--meditation { opacity: 0.92; }
.walk-entry--meditation .walk-entry-glyph { opacity: 0.7; }
.walk-entry--meditation .walk-entry-body {
  font-style: normal;
  font-weight: normal;
}
```

- [ ] **Step 6: Remove `.walk-entry--silence` CSS**

In `css/walk.css`, locate lines ~565-571:

```css
.walk-entry--silence .walk-entry-body { display: none; }
.walk-entry--silence .walk-entry-glyph { ... }
.walk-entry--silence .walk-entry-stage,
.walk-entry--silence .walk-entry-date { opacity: 0.55; }
```

Delete the entire silence block.

- [ ] **Step 7: Smoke test with a stubbed feed**

Create `pilgrim-landing/test-feed.json` temporarily:

```json
{
  "generatedAt": "2026-05-12T12:00:00Z",
  "duck": {
    "route": "shikoku-88", "routeName": "Shikoku 88", "stage": 15,
    "stageName": "Kokubun-ji", "coords": [134.49, 34.07], "mode": "walking",
    "progress": 0.17, "kmFromStart": 75.2, "totalKm": 1200, "daysOnRoute": 20
  },
  "entries": [
    {
      "date": "2026-05-13", "route": "shikoku-88", "stage": 15,
      "stageName": "Kokubun-ji", "coords": [134.49, 34.07], "kind": "meditation",
      "glyph": "🪷", "paragraphs": ["attention is worship"], "ageDays": 0,
      "heardId": "1d4c0e22"
    },
    {
      "date": "2026-05-12", "route": "shikoku-88", "stage": 15,
      "stageName": "Kokubun-ji", "coords": [134.49, 34.07], "kind": "offering",
      "glyph": "🪨", "paragraphs": ["A stone moved overnight."], "ageDays": 1,
      "heard": "the path forward seems to go back", "heardId": "8f2a7b91"
    }
  ],
  "routePath": { "shikoku-88": [[134.503, 34.16], [134.49, 34.07]] }
}
```

Temporarily edit `walk.js` line 12 to point `FEED_URL` at `test-feed.json`. Reload `http://localhost:8000/walk.html`. Verify:
- Meditation tile shows "attention is worship" with no italic, slightly dimmed.
- Offering tile shows "A stone moved overnight." with the italic heard line "— the path forward seems to go back" beneath.
- Duck marker is the still PNG (latest entry is meditation).

Revert the `FEED_URL` edit and delete `test-feed.json` before committing.

- [ ] **Step 8: Commit**

```bash
cd /Users/rubberduck/GitHub/momentmaker/pilgrim-landing
git add js/walk.js css/walk.css
git commit -m "feat(walk): heard-line rendering + meditation tile + silence cleanup"
cd -
```

---

## Task 16: Add `duck-still.png` asset

**Files:**
- Create: `/Users/rubberduck/GitHub/momentmaker/pilgrim-landing/assets/duck/duck-still.png`.

- [ ] **Step 1: Extract a still frame from `duck.gif`**

From `pilgrim-landing` root:

```bash
cd /Users/rubberduck/GitHub/momentmaker/pilgrim-landing
sips -s format png assets/duck/duck.gif --out assets/duck/duck-still.png 2>&1 || true
# `sips` on macOS extracts the first frame from a GIF as PNG.
# Fallback if sips fails: ImageMagick `magick assets/duck/duck.gif[0] assets/duck/duck-still.png`
```

- [ ] **Step 2: Verify the PNG**

Run: `file assets/duck/duck-still.png`
Expected: `PNG image data, ...` line.

Run: `ls -lh assets/duck/duck-still.png`
Expected: file exists, non-zero size (likely 1-50 KB).

- [ ] **Step 3: Reload `/walk` page and confirm marker swap works**

With the test feed from Task 15 (or by waiting for a real meditation day), reload `walk.html` and confirm the marker shows the PNG still frame (not the gif).

- [ ] **Step 4: Commit**

```bash
git add assets/duck/duck-still.png
git commit -m "assets: add duck-still.png for meditation-day marker"
cd -
```

---

## Task 17: End-to-end smoke test of the walk repo pipeline

**Files:** none — operational verification.

- [ ] **Step 1: Confirm baseline state**

From `rubberduck-walk`:

```bash
cd /Users/rubberduck/GitHub/rubberduck/walk
npm test
npx tsc --noEmit
```

Expected: all tests pass, typecheck clean.

- [ ] **Step 2: Verify `./duck lines status`**

Run: `./duck lines status`
Expected:
```
pool:           NNN  (≥ 200)
used (lifetime): 0
used (recency-50): 0
last used:      (never)
```

- [ ] **Step 3: Dry-run pickLine through CLI scratch**

```bash
node --import tsx -e '
import("./src/lines.ts").then(async (m) => {
  const pool = await m.readPool("./lines/pool.json");
  const used = await m.readUsed("./lines/used.json");
  console.log("pool size:", pool.length);
  console.log("today:", new Date().toISOString().slice(0,10));
  const line = m.pickLine(new Date().toISOString().slice(0,10), pool, used);
  console.log("picked:", line);
});
'
```

Expected: prints pool size, today's date, a `{ id, text }` object.

- [ ] **Step 4: No commit** — purely diagnostic.

---

## Task 18: Migration — first cron run safety

**Files:** none — operational.

- [ ] **Step 1: Confirm `lines/pool.json` is populated**

Run: `wc -l lines/pool.json`
Expected: a multi-line file, NOT `1 lines/pool.json` (which would mean empty `[]`).

If still empty:
```bash
./duck refresh-lines
```

- [ ] **Step 2: Inspect the launchd timer schedule**

Run: `launchctl list | grep duck`
Expected: a line for `org.walktalkmeditate.rubberduck-walk` with a non-error exit code.

If the next cron fire is imminent, confirm pool population is committed before it fires; otherwise the empty-pool guard will publish a walk-with-line without `heard:`.

- [ ] **Step 3: Final commit if anything's dirty**

```bash
cd /Users/rubberduck/GitHub/rubberduck/walk
git status
# If clean, done. If there are untracked lines/*.json or modified files, commit them.
```

---

## Self-Review checklist

Spec coverage verified against `docs/superpowers/specs/2026-05-11-daily-line-and-meditation-design.md`:
- Two daily outcomes (walk-with-line, meditate) — Tasks 4, 9, 12.
- Closure-arrival override → threshold — Task 4 test + Task 9 frontmatter.
- Resting-not-arrival → meditate — Task 4.
- 30% coin, date-seeded — Task 4.
- UTC `today` — Task 9 (`new Date().toISOString().slice(0,10)`), Task 13 (CLAUDE.md note).
- Lifetime used.json + recency-50 — Task 5.
- Empty-pool guard — Task 5, surfaced in Task 12 + 13.
- Same-date guard — Task 5.
- Entry-exists glob + reconcile — Task 12 (walk-day.md) + Task 13 (CLAUDE.md).
- Lint-fail fallback to meditation — Task 12, Task 13.
- `./duck refresh-lines` URL + failure modes — Task 8.
- `./duck silence` removed — Task 10.
- Meditation slug fixed — Task 9.
- Meditation glyph date-seeded — Task 9.
- `EntryKind` cleanup — Task 1.
- `heard`/`heardId` in `EntryFrontmatter` + `FeedEntry` — Task 1, Task 11.
- Voice-lint exemption — Task 2.
- UI duck marker swap — Task 14.
- UI latest-entry tiebreak — Task 14.
- UI heard line italic — Task 15.
- UI meditation styles + silence cleanup — Task 15.
- `duck-still.png` — Task 16.

Type consistency checked: `PoolLine`, `UsedRow`, `DayKindResult`, `DayKind` all defined once in `src/lines.ts` and reused. `EntryKind` narrowed in one place (Task 1) and consumed everywhere.

No placeholders. Every code step shows the code. Every test step shows expected output.

---

## Out of plan

- Tunable `MEDITATE_PCT` via env or CLI flag.
- Manual line additions (`./duck lines add "..."`).
- OG card surfacing the heard line on walk days (template already shows latest entry body, which on meditation days is the line).
- Pruning `lines/used.json` after extreme growth (not a real problem until ~years of data).
