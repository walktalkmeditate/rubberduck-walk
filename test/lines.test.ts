import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePool, pickDayKind, pickLine } from "../src/lines.ts";
import type { State } from "../src/types.ts";
import type { PoolLine, UsedRow } from "../src/lines.ts";

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
