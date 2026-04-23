import type { Feed, FeedEntry, Route, State, Entry } from "./types.ts";

const MAX_AGE_DAYS = 365;

interface BuildFeedOpts {
  state: State;
  route: Route;
  entries: Entry[];
  today: string;
}

export function buildFeed({ state, route, entries, today }: BuildFeedOpts): Feed {
  const fresh = entries
    .filter((e) => e.ageDays <= MAX_AGE_DAYS)
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const feedEntries: FeedEntry[] = fresh.map((e) => ({
    date: e.date,
    route: e.route,
    stage: e.stage,
    stageName: e.stageName,
    coords: e.coords,
    kind: e.kind,
    glyph: e.glyph,
    paragraphs: e.paragraphs,
    author: e.author,
    ageDays: e.ageDays,
  }));

  const totalStages = route.stages.length;
  const onRoute = state.mode === "walking" || state.mode === "beginning";
  const progress = onRoute
    ? totalStages === 0
      ? 0
      : Math.min(1, state.stage / totalStages)
    : 1; // completing/resting — duck has walked the full route

  return {
    generatedAt: new Date().toISOString(),
    duck: {
      route: state.route,
      routeName: route.name,
      stage: state.stage,
      stageName: state.stageName,
      coords: state.coords,
      mode: state.mode,
      progress,
    },
    entries: feedEntries,
    routePath: {
      [route.id]: route.stages.map((s) => s.coords),
    },
  };
}
