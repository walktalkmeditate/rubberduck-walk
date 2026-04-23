import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parseEntry, computeAgeDays, pruneOldEntries } from "../src/entries.ts";

function entryFile(date: string): string {
  return `---
date: ${date}
route: shikoku-88
stage: 1
stageName: Ryozen-ji
coords: [134.537, 34.128]
kind: offering
glyph: 🪨
---

A stone.
`;
}

function dateMinusDays(today: string, days: number): string {
  const msPerDay = 24 * 60 * 60 * 1000;
  const t = Date.parse(today + "T00:00:00Z");
  return new Date(t - days * msPerDay).toISOString().slice(0, 10);
}

test("parseEntry reads frontmatter and body as paragraphs", () => {
  const raw = `---
date: 2026-04-23
route: shikoku-88
stage: 1
stageName: Ryozen-ji
coords: [134.537, 34.128]
kind: offering
glyph: 🪨
weather: clear, 15°C
---

A stone by the door. No one had moved it. No one needed to.
`;
  const result = parseEntry(raw, "/fake/path.md");
  assert.equal(result.date, "2026-04-23");
  assert.equal(result.kind, "offering");
  assert.equal(result.glyph, "🪨");
  assert.deepEqual(result.coords, [134.537, 34.128]);
  assert.deepEqual(result.paragraphs, [
    "A stone by the door. No one had moved it. No one needed to.",
  ]);
  assert.equal(result.filePath, "/fake/path.md");
});

test("parseEntry splits letter on blank lines", () => {
  const raw = `---
date: 2026-05-02
route: shikoku-88
stage: 13
stageName: Dainichiji
coords: [134.1, 33.9]
kind: letter
glyph: 🕯️
author: — the pilgrim
---

First paragraph here.

Second paragraph here.
`;
  const result = parseEntry(raw, "/fake/letter.md");
  assert.equal(result.kind, "letter");
  assert.equal(result.author, "— the pilgrim");
  assert.deepEqual(result.paragraphs, [
    "First paragraph here.",
    "Second paragraph here.",
  ]);
});

test("parseEntry handles silence (empty body → no paragraphs)", () => {
  const raw = `---
date: 2026-04-30
route: shikoku-88
stage: 5
stageName: Jizōji
coords: [134.5, 34.1]
kind: silence
glyph: 〰️
---
`;
  const result = parseEntry(raw, "/fake/silence.md");
  assert.equal(result.kind, "silence");
  assert.deepEqual(result.paragraphs, []);
});

test("parseEntry normalizes whitespace in paragraphs", () => {
  const raw = `---
date: 2026-04-23
route: shikoku-88
stage: 1
stageName: Ryozen-ji
coords: [134.537, 34.128]
kind: offering
glyph: 🪨
---

  A stone.
`;
  const result = parseEntry(raw, "/fake/p.md");
  assert.deepEqual(result.paragraphs, ["A stone."]);
});

test("computeAgeDays returns whole days between two dates", () => {
  assert.equal(computeAgeDays("2026-04-23", "2026-04-23"), 0);
  assert.equal(computeAgeDays("2026-04-22", "2026-04-23"), 1);
  assert.equal(computeAgeDays("2026-01-23", "2026-04-23"), 90);
});

test("parseEntry throws when coords is missing", () => {
  const raw = `---
date: 2026-04-23
route: shikoku-88
stage: 1
stageName: Ryozen-ji
kind: offering
glyph: 🪨
---

A stone.
`;
  assert.throws(() => parseEntry(raw, "/fake/no-coords.md"), /coords/);
});

test("parseEntry throws when stage is missing", () => {
  const raw = `---
date: 2026-04-23
route: shikoku-88
stageName: Ryozen-ji
coords: [134.537, 34.128]
kind: offering
glyph: 🪨
---

A stone.
`;
  assert.throws(() => parseEntry(raw, "/fake/no-stage.md"), /stage/);
});

test("parseEntry throws when glyph is missing", () => {
  const raw = `---
date: 2026-04-23
route: shikoku-88
stage: 1
stageName: Ryozen-ji
coords: [134.537, 34.128]
kind: offering
---

A stone.
`;
  assert.throws(() => parseEntry(raw, "/fake/no-glyph.md"), /glyph/);
});

test("parseEntry error lists all missing fields at once", () => {
  const raw = `---
date: 2026-04-23
route: shikoku-88
kind: offering
---
`;
  assert.throws(
    () => parseEntry(raw, "/fake/sparse.md"),
    /stage.*stageName.*coords.*glyph/s,
  );
});

test("pruneOldEntries deletes files older than maxAgeDays", async () => {
  const today = "2026-04-23";
  const tmp = await mkdtemp(path.join(os.tmpdir(), "duck-prune-"));
  try {
    const recent = path.join(tmp, "recent.md");
    const boundary = path.join(tmp, "boundary.md");
    const ancient = path.join(tmp, "ancient.md");
    await writeFile(recent, entryFile(dateMinusDays(today, 10)));
    await writeFile(boundary, entryFile(dateMinusDays(today, 365)));
    await writeFile(ancient, entryFile(dateMinusDays(today, 400)));

    const deleted = await pruneOldEntries(tmp, today, 365);

    assert.deepEqual(deleted, [ancient]);
    const remaining = (await readdir(tmp)).sort();
    assert.deepEqual(remaining, ["boundary.md", "recent.md"]);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test("pruneOldEntries returns empty array when nothing to prune", async () => {
  const today = "2026-04-23";
  const tmp = await mkdtemp(path.join(os.tmpdir(), "duck-prune-"));
  try {
    await writeFile(path.join(tmp, "a.md"), entryFile(dateMinusDays(today, 1)));
    await writeFile(path.join(tmp, "b.md"), entryFile(dateMinusDays(today, 100)));

    const deleted = await pruneOldEntries(tmp, today, 365);

    assert.deepEqual(deleted, []);
    const remaining = (await readdir(tmp)).sort();
    assert.deepEqual(remaining, ["a.md", "b.md"]);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test("pruneOldEntries skips non-md files in the dir", async () => {
  const today = "2026-04-23";
  const tmp = await mkdtemp(path.join(os.tmpdir(), "duck-prune-"));
  try {
    await writeFile(path.join(tmp, ".gitkeep"), "");
    await writeFile(path.join(tmp, "notes.txt"), "stray");
    await writeFile(
      path.join(tmp, "old.md"),
      entryFile(dateMinusDays(today, 500)),
    );

    const deleted = await pruneOldEntries(tmp, today, 365);

    assert.deepEqual(deleted, [path.join(tmp, "old.md")]);
    const remaining = (await readdir(tmp)).sort();
    assert.deepEqual(remaining, [".gitkeep", "notes.txt"]);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});
