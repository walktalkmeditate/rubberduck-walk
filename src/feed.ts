import type { Feed, FeedEntry, Route, State, Entry } from "./types.ts";

const MAX_AGE_DAYS = 365;

interface BuildFeedOpts {
  state: State;
  route: Route;
  entries: Entry[];
  today: string;
}

function daysBetween(earlierIso: string, laterIso: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const a = Date.parse(earlierIso + "T00:00:00Z");
  const b = Date.parse(laterIso + "T00:00:00Z");
  return Math.max(0, Math.round((b - a) / msPerDay));
}

function stageKm(route: Route, stageIndex: number): number | undefined {
  return route.stages.find((s) => s.index === stageIndex)?.kmFromStart;
}

export function buildFeed({ state, route, entries, today }: BuildFeedOpts): Feed {
  const fresh = entries
    .filter((e) => e.ageDays <= MAX_AGE_DAYS)
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  // Pre-compute kmFromStart for every fresh entry on the current route, so we
  // can derive kmSinceLastEntry by diffing adjacent newer→older km values.
  // Prefer the entry's own frontmatter km (captured at write time) when
  // present, falling back to a lookup from the current route.
  const entryKmFor = (e: Entry): number | undefined => {
    if (typeof e.kmFromStart === "number") return e.kmFromStart;
    return e.route === route.id ? stageKm(route, e.stage) : undefined;
  };
  const feedEntries: FeedEntry[] = fresh.map((e, i) => {
    const entryKm = entryKmFor(e);
    let kmSince: number | undefined;
    if (entryKm !== undefined) {
      // Next-older entry on the same route
      for (let j = i + 1; j < fresh.length; j++) {
        if (fresh[j].route !== e.route) continue;
        const prevKm = entryKmFor(fresh[j]);
        if (prevKm !== undefined) {
          kmSince = Math.max(0, entryKm - prevKm);
        }
        break;
      }
    }

    const fe: FeedEntry = {
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
    };
    if (e.weather) fe.weather = e.weather;
    if (entryKm !== undefined) fe.kmFromStart = entryKm;
    if (kmSince !== undefined) fe.kmSinceLastEntry = kmSince;
    return fe;
  });

  const totalStages = route.stages.length;
  const onRoute = state.mode === "walking" || state.mode === "beginning";
  const progress = onRoute
    ? totalStages === 0
      ? 0
      : Math.min(1, state.stage / totalStages)
    : 1; // completing/resting — duck has walked the full route

  const duckKm = onRoute ? stageKm(route, state.stage) : route.distanceKm;
  const daysOnRoute = state.modeEnteredAt
    ? daysBetween(state.modeEnteredAt, today)
    : undefined;

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
      ...(duckKm !== undefined ? { kmFromStart: duckKm } : {}),
      ...(route.distanceKm !== undefined ? { totalKm: route.distanceKm } : {}),
      ...(daysOnRoute !== undefined ? { daysOnRoute } : {}),
    },
    entries: feedEntries,
    routePath: {
      [route.id]: route.stages.map((s) => s.coords),
    },
  };
}
