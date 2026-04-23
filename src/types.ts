export type DuckMode = "walking" | "completing" | "resting" | "beginning";

export type EntryKind = "offering" | "notice" | "silence" | "threshold" | "letter";

export type Coords = [number, number]; // [latitude, longitude]

export interface State {
  route: string;
  stage: number;
  stageName: string;
  coords: Coords;
  mode: DuckMode;
  modeEnteredAt: string;   // ISO date "YYYY-MM-DD"
  lastAdvancedAt: string;  // ISO date "YYYY-MM-DD"
}

export interface RouteStage {
  index: number;
  name: string;
  coords: Coords;
}

export interface Route {
  id: string;
  name: string;
  country: string;
  distanceKm: number;
  stages: RouteStage[];
  /** Optional route-specific closure site used when mode=completing. */
  closure?: {
    name: string;
    coords: Coords;
    transitStages: RouteStage[];
  };
}

export interface EntryFrontmatter {
  date: string;          // "YYYY-MM-DD"
  route: string;
  stage: number;
  stageName: string;
  coords: Coords;
  kind: EntryKind;
  glyph: string;
  weather?: string;      // human-readable, e.g. "light rain, 14°C"
  author?: string;       // only for kind=letter; defaults to "— the pilgrim"
}

export interface Entry extends EntryFrontmatter {
  body: string;          // raw plain-text body
  paragraphs: string[];  // split on blank-line boundaries; each is plain text
  filePath: string;      // absolute path on disk
  ageDays: number;       // computed at build time
}

export interface FeedDuck {
  route: string;
  routeName: string;
  stage: number;
  stageName: string;
  coords: Coords;
  mode: DuckMode;
  progress: number;      // 0..1
}

export interface FeedEntry {
  date: string;
  route: string;
  stage: number;
  stageName: string;
  coords: Coords;
  kind: EntryKind;
  glyph: string;
  paragraphs: string[];  // plain text — client renders with textContent
  author?: string;
  ageDays: number;
}

export interface Feed {
  generatedAt: string;  // ISO 8601 UTC
  duck: FeedDuck;
  entries: FeedEntry[];
  routePath: Record<string, Coords[]>;  // route id → ordered coords
}
