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

test("advance is idempotent when lastAdvancedAt === today", () => {
  // Double-fire protection: cron retries or manual re-run shouldn't skip stages.
  const state: State = {
    route: "shikoku-88",
    stage: 1,
    stageName: "Ryōzenji",
    coords: [134.537, 34.128],
    mode: "walking",
    modeEnteredAt: "2026-04-20",
    lastAdvancedAt: "2026-04-23",
  };
  const next = advance(state, shikoku, "2026-04-23");
  assert.equal(next.stage, 1);
  assert.equal(next.stageName, "Ryōzenji");
  assert.equal(next.lastAdvancedAt, "2026-04-23");
  assert.equal(next.mode, "walking");
});

test("advance arrives at closure when closure.name differs from last transit name", () => {
  // Detection should be by position in transitStages, not name equality.
  const custom: Route = {
    ...shikoku,
    closure: {
      name: "Some Different Closure Name",
      coords: [135.589, 34.216],
      transitStages: [
        { index: 1, name: "Wakayama", coords: [135.17, 34.23] },
        { index: 2, name: "Final Transit", coords: [135.589, 34.216] },
      ],
    },
  };
  const state: State = {
    route: "shikoku-88",
    stage: 1,
    stageName: "Wakayama",
    coords: [135.17, 34.23],
    mode: "completing",
    modeEnteredAt: "2026-04-23",
    lastAdvancedAt: "2026-04-23",
  };
  const next = advance(state, custom, "2026-04-24");
  assert.equal(next.mode, "resting");
  assert.equal(next.stageName, "Final Transit");
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

test("advance walks the full pilgrimage lifecycle end-to-end", () => {
  const routeA: Route = {
    id: "route-a",
    name: "Route A",
    country: "JP",
    distanceKm: 100,
    stages: [
      { index: 1, name: "A1", coords: [134.50, 34.10] },
      { index: 2, name: "A2", coords: [134.55, 34.12] },
      { index: 3, name: "A3", coords: [134.60, 34.14] },
    ],
    closure: {
      name: "A-Closure",
      coords: [134.80, 34.30],
      transitStages: [
        { index: 1, name: "A-Transit-1", coords: [134.70, 34.20] },
        { index: 2, name: "A-Transit-2", coords: [134.80, 34.30] },
      ],
    },
  };

  const routeB: Route = {
    id: "route-b",
    name: "Route B",
    country: "JP",
    distanceKm: 50,
    stages: [
      { index: 1, name: "B1", coords: [135.00, 33.80] },
    ],
  };

  const day = (n: number) => `2026-01-${String(n).padStart(2, "0")}`;

  let state: State = {
    route: "route-a",
    stage: 1,
    stageName: "A1",
    coords: [134.50, 34.10],
    mode: "walking",
    modeEnteredAt: "2025-12-31",
    lastAdvancedAt: "2025-12-31",
  };

  // 1 → 2
  state = advance(state, routeA, day(1));
  assert.equal(state.stage, 2);
  assert.equal(state.stageName, "A2");
  assert.equal(state.mode, "walking");
  assert.equal(state.lastAdvancedAt, day(1));

  // idempotency inside the sequence — second call same day is a no-op
  const frozen = advance(state, routeA, day(1));
  assert.equal(frozen.stage, 2);
  assert.equal(frozen.stageName, "A2");
  assert.equal(frozen.mode, "walking");
  assert.equal(frozen.lastAdvancedAt, day(1));

  // 2 → 3
  state = advance(state, routeA, day(2));
  assert.equal(state.stage, 3);
  assert.equal(state.stageName, "A3");
  assert.equal(state.mode, "walking");

  // 3 → completing at transit 1
  state = advance(state, routeA, day(3));
  assert.equal(state.mode, "completing");
  assert.equal(state.stage, 1);
  assert.equal(state.stageName, "A-Transit-1");
  assert.equal(state.modeEnteredAt, day(3));

  // completing transit 1 → resting at transit 2 (final closure site)
  state = advance(state, routeA, day(4));
  assert.equal(state.mode, "resting");
  assert.equal(state.stage, 2);
  assert.equal(state.stageName, "A-Transit-2");
  assert.equal(state.modeEnteredAt, day(4));

  // resting — frozen; further advance is a no-op
  state = advance(state, routeA, day(5));
  assert.equal(state.mode, "resting");
  assert.equal(state.stage, 2);
  assert.equal(state.stageName, "A-Transit-2");

  // beginRoute to routeB — flips to beginning at stage 1 of new route
  state = beginRoute(state, routeB, day(6));
  assert.equal(state.route, "route-b");
  assert.equal(state.mode, "beginning");
  assert.equal(state.stage, 1);
  assert.equal(state.stageName, "B1");
  assert.equal(state.modeEnteredAt, day(6));

  // beginning → walking on next advance
  state = advance(state, routeB, day(7));
  assert.equal(state.route, "route-b");
  assert.equal(state.mode, "walking");
  assert.equal(state.stage, 1);
  assert.equal(state.stageName, "B1");
  assert.equal(state.modeEnteredAt, day(7));
});
