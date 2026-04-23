import { test } from "node:test";
import assert from "node:assert/strict";
import { parseEntry, computeAgeDays } from "../src/entries.ts";

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
