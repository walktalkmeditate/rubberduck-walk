import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Route, RouteStage, Coords } from "../src/types.ts";

const SOURCE = join(
  homedir(),
  "GitHub/momentmaker/open-pilgrimages/routes/shikoku-88/waypoints.geojson",
);

const __dirname = dirname(fileURLToPath(import.meta.url));
const TARGET = join(__dirname, "..", "routes", "shikoku-88.json");

interface GeoFeature {
  type: "Feature";
  id?: string;
  geometry: { type: string; coordinates: [number, number] };
  properties: {
    type?: string;
    subtype?: string;
    name?: string;
    templeNumber?: number;
    [k: string]: unknown;
  };
}

interface FeatureCollection {
  type: "FeatureCollection";
  features: GeoFeature[];
}

function isTempleFeature(f: GeoFeature): boolean {
  const p = f.properties;
  if (p.subtype !== "temple") return false;
  const n = p.templeNumber;
  return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 88;
}

function buildStages(fc: FeatureCollection): RouteStage[] {
  const stages: RouteStage[] = [];
  for (const feature of fc.features) {
    if (!isTempleFeature(feature)) continue;
    const p = feature.properties;
    const name = p.name;
    if (typeof name !== "string" || name.length === 0) {
      throw new Error(
        `Temple ${p.templeNumber} (id=${feature.id}) has no name`,
      );
    }
    const [lon, lat] = feature.geometry.coordinates;
    const coords: Coords = [lat, lon];
    stages.push({ index: p.templeNumber as number, name, coords });
  }
  stages.sort((a, b) => a.index - b.index);
  return stages;
}

function main(): void {
  const raw = readFileSync(SOURCE, "utf8");
  const fc = JSON.parse(raw) as FeatureCollection;
  const stages = buildStages(fc);

  if (stages.length !== 88) {
    console.error(`Expected 88 stages, got ${stages.length}`);
    process.exit(1);
  }

  const seen = new Set<number>();
  for (const s of stages) {
    if (seen.has(s.index)) {
      console.error(`Duplicate templeNumber: ${s.index}`);
      process.exit(1);
    }
    seen.add(s.index);
  }

  const route: Route = {
    id: "shikoku-88",
    name: "Shikoku Henro",
    country: "JP",
    distanceKm: 1200,
    stages,
    closure: {
      name: "Kōya-san Okunoin",
      coords: [34.2167, 135.589],
      transitStages: [
        { index: 1, name: "Tokushima port", coords: [34.067, 134.555] },
        { index: 2, name: "Wakayama", coords: [34.23, 135.17] },
        { index: 3, name: "Hashimoto", coords: [34.312, 135.604] },
        { index: 4, name: "Kōya-san Okunoin", coords: [34.2167, 135.589] },
      ],
    },
  };

  mkdirSync(dirname(TARGET), { recursive: true });
  writeFileSync(TARGET, JSON.stringify(route, null, 2) + "\n", "utf8");
  console.log(`Wrote ${TARGET} with ${stages.length} stages.`);
  console.log(`First: ${stages[0].index} ${stages[0].name} ${JSON.stringify(stages[0].coords)}`);
  console.log(`Last:  ${stages[87].index} ${stages[87].name} ${JSON.stringify(stages[87].coords)}`);
}

main();
