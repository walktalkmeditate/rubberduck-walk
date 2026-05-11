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
