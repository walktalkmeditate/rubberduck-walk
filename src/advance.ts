import type { State, Route } from "./types.ts";

export function advance(state: State, route: Route, today: string): State {
  if (state.route !== route.id) {
    throw new Error(`state.route=${state.route} does not match route.id=${route.id}`);
  }

  // Idempotency: if already advanced today, do nothing. Prevents double-fires
  // from the cron skipping stages.
  if (state.lastAdvancedAt === today) {
    return state;
  }

  if (state.mode === "resting") {
    return state; // frozen until beginRoute()
  }

  if (state.mode === "walking") {
    const nextStageIndex = state.stage + 1;
    const nextStage = route.stages.find((s) => s.index === nextStageIndex);

    if (nextStage) {
      return {
        ...state,
        stage: nextStage.index,
        stageName: nextStage.name,
        coords: nextStage.coords,
        lastAdvancedAt: today,
      };
    }

    // final stage reached — flip to completing
    if (!route.closure) {
      throw new Error(`Route ${route.id} has no closure defined`);
    }
    const firstTransit = route.closure.transitStages[0];
    return {
      ...state,
      stage: firstTransit.index,
      stageName: firstTransit.name,
      coords: firstTransit.coords,
      mode: "completing",
      modeEnteredAt: today,
      lastAdvancedAt: today,
    };
  }

  if (state.mode === "completing") {
    if (!route.closure) {
      throw new Error(`Route ${route.id} has no closure defined`);
    }
    const nextTransitIndex = state.stage + 1;
    const transits = route.closure.transitStages;
    const nextTransit = transits.find((s) => s.index === nextTransitIndex);

    if (!nextTransit) {
      throw new Error(
        `No transit stage ${nextTransitIndex} defined for route ${route.id}`
      );
    }

    // Arrived-at-closure detection is by position in the transit list, not
    // name equality — avoids the fragile invariant that closure.name must
    // match the last transit stage's name verbatim.
    const arrivedAtClosure = nextTransitIndex === transits[transits.length - 1].index;

    return {
      ...state,
      stage: nextTransit.index,
      stageName: nextTransit.name,
      coords: nextTransit.coords,
      mode: arrivedAtClosure ? "resting" : "completing",
      ...(arrivedAtClosure ? { modeEnteredAt: today } : {}),
      lastAdvancedAt: today,
    };
  }

  if (state.mode === "beginning") {
    // beginning → walking on next advance
    const firstStage = route.stages[0];
    return {
      ...state,
      stage: firstStage.index,
      stageName: firstStage.name,
      coords: firstStage.coords,
      mode: "walking",
      modeEnteredAt: today,
      lastAdvancedAt: today,
    };
  }

  throw new Error(`Unknown mode: ${state.mode}`);
}

export function beginRoute(state: State, nextRoute: Route, today: string): State {
  if (state.mode !== "resting") {
    throw new Error(`Cannot begin a new route while mode=${state.mode}`);
  }
  const first = nextRoute.stages[0];
  return {
    route: nextRoute.id,
    stage: first.index,
    stageName: first.name,
    coords: first.coords,
    mode: "beginning",
    modeEnteredAt: today,
    lastAdvancedAt: today,
  };
}
