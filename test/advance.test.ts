import { test } from "node:test";
import assert from "node:assert/strict";
import { advance, beginRoute } from "../src/advance.ts";
import type { State, Route } from "../src/types.ts";

const shikoku: Route = {
  id: "shikoku-88",
  name: "Shikoku Henro",
  country: "JP",
  distanceKm: 1200,
  stages: [
    { index: 1, name: "Ryōzenji", coords: [134.537, 34.128] },
    { index: 2, name: "Gokurakuji", coords: [134.556, 34.130] },
    { index: 3, name: "Konsenji", coords: [134.570, 34.135] },
  ],
  closure: {
    name: "Kōya-san",
    coords: [135.589, 34.216],
    transitStages: [
      { index: 1, name: "Wakayama", coords: [135.17, 34.23] },
      { index: 2, name: "Kōya-san", coords: [135.589, 34.216] },
    ],
  },
};

test("advance moves duck from stage 1 to stage 2 during walking", () => {
  const state: State = {
    route: "shikoku-88",
    stage: 1,
    stageName: "Ryōzenji",
    coords: [134.537, 34.128],
    mode: "walking",
    modeEnteredAt: "2026-04-20",
    lastAdvancedAt: "2026-04-22",
  };
  const next = advance(state, shikoku, "2026-04-23");
  assert.equal(next.stage, 2);
  assert.equal(next.stageName, "Gokurakuji");
  assert.equal(next.mode, "walking");
  assert.equal(next.lastAdvancedAt, "2026-04-23");
});

test("advance flips to completing when final stage reached", () => {
  const state: State = {
    route: "shikoku-88",
    stage: 3,
    stageName: "Konsenji",
    coords: [134.570, 34.135],
    mode: "walking",
    modeEnteredAt: "2026-04-20",
    lastAdvancedAt: "2026-04-22",
  };
  const next = advance(state, shikoku, "2026-04-23");
  assert.equal(next.mode, "completing");
  assert.equal(next.stage, 1);
  assert.equal(next.stageName, "Wakayama");
  assert.equal(next.modeEnteredAt, "2026-04-23");
});

test("advance flips to resting when closure site reached", () => {
  const state: State = {
    route: "shikoku-88",
    stage: 1,
    stageName: "Wakayama",
    coords: [135.17, 34.23],
    mode: "completing",
    modeEnteredAt: "2026-04-23",
    lastAdvancedAt: "2026-04-23",
  };
  const next = advance(state, shikoku, "2026-04-24");
  assert.equal(next.mode, "resting");
  assert.equal(next.stageName, "Kōya-san");
  assert.equal(next.modeEnteredAt, "2026-04-24");
});

test("advance does not move during resting", () => {
  const state: State = {
    route: "shikoku-88",
    stage: 2,
    stageName: "Kōya-san",
    coords: [135.589, 34.216],
    mode: "resting",
    modeEnteredAt: "2026-04-24",
    lastAdvancedAt: "2026-04-24",
  };
  const next = advance(state, shikoku, "2026-05-01");
  assert.equal(next.mode, "resting");
  assert.equal(next.stage, 2);
  assert.equal(next.stageName, "Kōya-san");
  assert.equal(next.lastAdvancedAt, "2026-04-24"); // unchanged
});

const kumano: Route = {
  id: "kumano-kodo",
  name: "Kumano Kodō",
  country: "JP",
  distanceKm: 150,
  stages: [
    { index: 1, name: "Takijiri-oji", coords: [135.507, 33.778] },
  ],
};

test("beginRoute flips from resting to beginning at stage 1 of new route", () => {
  const resting: State = {
    route: "shikoku-88",
    stage: 2,
    stageName: "Kōya-san",
    coords: [135.589, 34.216],
    mode: "resting",
    modeEnteredAt: "2026-12-14",
    lastAdvancedAt: "2026-12-14",
  };
  const next = beginRoute(resting, kumano, "2026-12-28");
  assert.equal(next.route, "kumano-kodo");
  assert.equal(next.mode, "beginning");
  assert.equal(next.stage, 1);
  assert.equal(next.stageName, "Takijiri-oji");
  assert.equal(next.modeEnteredAt, "2026-12-28");
});

test("beginRoute throws if state is not resting", () => {
  const walking: State = {
    route: "shikoku-88",
    stage: 5,
    stageName: "Jizōji",
    coords: [134.5, 34.1],
    mode: "walking",
    modeEnteredAt: "2026-04-20",
    lastAdvancedAt: "2026-05-01",
  };
  assert.throws(() => beginRoute(walking, kumano, "2026-05-02"));
});
