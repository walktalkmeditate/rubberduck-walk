import type { State, Route } from "./types.ts";

export function advance(state: State, route: Route, today: string): State {
  if (state.route !== route.id) {
    throw new Error(`state.route=${state.route} does not match route.id=${route.id}`);
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
    const nextTransit = route.closure.transitStages.find(
      (s) => s.index === nextTransitIndex
    );

    if (!nextTransit) {
      throw new Error(
        `No transit stage ${nextTransitIndex} defined for route ${route.id}`
      );
    }

    const arrivedAtClosure = nextTransit.name === route.closure.name;

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
