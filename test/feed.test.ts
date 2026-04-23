import { test } from "node:test";
import assert from "node:assert/strict";
import { buildFeed } from "../src/feed.ts";
import type { State, Route, Entry } from "../src/types.ts";

const shikoku: Route = {
  id: "shikoku-88",
  name: "Shikoku Henro",
  country: "JP",
  distanceKm: 1200,
  stages: [
    { index: 1, name: "Ryōzenji", coords: [134.537, 34.128] },
    { index: 2, name: "Gokurakuji", coords: [134.556, 34.130] },
  ],
};

const state: State = {
  route: "shikoku-88",
  stage: 2,
  stageName: "Gokurakuji",
  coords: [134.556, 34.130],
  mode: "walking",
  modeEnteredAt: "2026-04-20",
  lastAdvancedAt: "2026-04-23",
};

const recentEntry: Entry = {
  date: "2026-04-23",
  route: "shikoku-88",
  stage: 2,
  stageName: "Gokurakuji",
  coords: [134.556, 34.130],
  kind: "offering",
  glyph: "🪨",
  body: "A stone.",
  paragraphs: ["A stone."],
  filePath: "/fake/a.md",
  ageDays: 0,
};

const oldEntry: Entry = {
  ...recentEntry,
  date: "2025-04-22",
  filePath: "/fake/b.md",
  ageDays: 366,
};

test("buildFeed includes recent entries", () => {
  const feed = buildFeed({ state, route: shikoku, entries: [recentEntry], today: "2026-04-23" });
  assert.equal(feed.entries.length, 1);
  assert.equal(feed.entries[0].date, "2026-04-23");
  assert.deepEqual(feed.entries[0].paragraphs, ["A stone."]);
  assert.equal(feed.duck.stage, 2);
  assert.equal(feed.duck.routeName, "Shikoku Henro");
  assert.equal(feed.duck.progress, 1); // 2 / 2 stages
});

test("buildFeed excludes entries older than 365 days", () => {
  const feed = buildFeed({
    state,
    route: shikoku,
    entries: [recentEntry, oldEntry],
    today: "2026-04-23",
  });
  assert.equal(feed.entries.length, 1);
  assert.equal(feed.entries[0].date, "2026-04-23");
});

test("buildFeed sorts entries newest first", () => {
  const older = { ...recentEntry, date: "2026-03-15", filePath: "/fake/c.md", ageDays: 39 };
  const feed = buildFeed({
    state,
    route: shikoku,
    entries: [older, recentEntry],
    today: "2026-04-23",
  });
  assert.equal(feed.entries[0].date, "2026-04-23");
  assert.equal(feed.entries[1].date, "2026-03-15");
});

test("buildFeed includes routePath with stage coords", () => {
  const feed = buildFeed({ state, route: shikoku, entries: [], today: "2026-04-23" });
  assert.deepEqual(feed.routePath["shikoku-88"], [
    [134.537, 34.128],
    [134.556, 34.130],
  ]);
});

test("buildFeed copies author from letter entries", () => {
  const letter: Entry = {
    ...recentEntry,
    kind: "letter",
    author: "— the pilgrim",
    filePath: "/fake/l.md",
  };
  const feed = buildFeed({ state, route: shikoku, entries: [letter], today: "2026-04-23" });
  assert.equal(feed.entries[0].author, "— the pilgrim");
});
