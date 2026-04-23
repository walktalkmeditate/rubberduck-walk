import { test } from "node:test";
import assert from "node:assert/strict";
import { GLYPH_PALETTE, lintEntry } from "../src/voice-lint.ts";
import type { Entry, EntryKind } from "../src/types.ts";

function makeEntry(overrides: Partial<Entry> = {}): Entry {
  const body = overrides.body ?? "";
  const paragraphs =
    overrides.paragraphs ??
    body
      .split(/\r?\n\s*\r?\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
  const base: Entry = {
    date: "2026-04-23",
    route: "shikoku-88",
    stage: 1,
    stageName: "Ryozen-ji",
    coords: [134.503, 34.16],
    kind: "offering" as EntryKind,
    glyph: "🪨",
    body,
    paragraphs,
    filePath: "/fake/path.md",
    ageDays: 0,
  };
  return { ...base, ...overrides };
}

test("clean offering entry passes with zero issues", () => {
  const entry = makeEntry({
    body: "A stone by the door. No one had moved it. No one needed to.",
  });
  assert.deepEqual(lintEntry(entry), []);
});

test("rejects 'I walked today'", () => {
  const entry = makeEntry({ body: "I walked today" });
  const issues = lintEntry(entry);
  const kinds = issues.map((i) => i.kind);
  assert.ok(kinds.includes("first-person"), `expected first-person, got ${kinds.join(", ")}`);
});

test("rejects 'We kept going'", () => {
  const entry = makeEntry({ body: "We kept going" });
  const kinds = lintEntry(entry).map((i) => i.kind);
  assert.ok(kinds.includes("first-person"));
});

test("rejects body with exclamation mark", () => {
  const entry = makeEntry({ body: "The bell rang!" });
  const kinds = lintEntry(entry).map((i) => i.kind);
  assert.ok(kinds.includes("exclamation"));
});

test("rejects body with numbers", () => {
  const entry = makeEntry({ body: "Walked 5 kilometers" });
  const kinds = lintEntry(entry).map((i) => i.kind);
  assert.ok(kinds.includes("digit-in-body"));
});

test("rejects body over 20 words", () => {
  const body = Array.from({ length: 25 }, () => "stone").join(" ");
  const entry = makeEntry({ body });
  const kinds = lintEntry(entry).map((i) => i.kind);
  assert.ok(kinds.includes("word-count"));
});

test("rejects banned abstraction 'presence'", () => {
  const entry = makeEntry({ body: "A moment of presence by the gate." });
  const kinds = lintEntry(entry).map((i) => i.kind);
  assert.ok(kinds.includes("banned-abstraction"));
});

test("rejects advice verb 'remember'", () => {
  const entry = makeEntry({ body: "Remember the stone." });
  const kinds = lintEntry(entry).map((i) => i.kind);
  assert.ok(kinds.includes("advice-verb"));
});

test("rejects glyph not in palette", () => {
  const entry = makeEntry({ glyph: "🌮", body: "A stone by the door." });
  const kinds = lintEntry(entry).map((i) => i.kind);
  assert.ok(kinds.includes("glyph-not-in-palette"));
});

test("rejects empty body for kind=offering", () => {
  const entry = makeEntry({ body: "" });
  const kinds = lintEntry(entry).map((i) => i.kind);
  assert.ok(kinds.includes("empty-body"));
});

test("kind=letter returns no issues regardless of content", () => {
  const entry = makeEntry({
    kind: "letter" as EntryKind,
    body:
      "I walked 12 kilometers today! It was a peaceful journey full of presence and serene mindfulness. Remember what I noticed: my shoes were covered in dust.",
    glyph: "🕯️",
    author: "— the pilgrim",
  });
  assert.deepEqual(lintEntry(entry), []);
});

test("kind=silence returns no issues for empty body", () => {
  const entry = makeEntry({ kind: "silence" as EntryKind, body: "", glyph: "〰️" });
  assert.deepEqual(lintEntry(entry), []);
});

test("'iced' does not trigger first-person match for 'i'", () => {
  const entry = makeEntry({ body: "The road iced over. Stones under frost." });
  const kinds = lintEntry(entry).map((i) => i.kind);
  assert.ok(!kinds.includes("first-person"), `unexpected first-person: ${JSON.stringify(lintEntry(entry))}`);
});

test("'I.' triggers first-person", () => {
  const entry = makeEntry({ body: "A stone. I. The door." });
  const kinds = lintEntry(entry).map((i) => i.kind);
  assert.ok(kinds.includes("first-person"));
});

test("\"I'm\" triggers first-person", () => {
  const entry = makeEntry({ body: "I'm at the gate" });
  const kinds = lintEntry(entry).map((i) => i.kind);
  assert.ok(kinds.includes("first-person"));
});

test("GLYPH_PALETTE has 27 symbols", () => {
  assert.equal(GLYPH_PALETTE.length, 27);
});
