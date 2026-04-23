#!/usr/bin/env -S tsx
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fetchWeather } from "../src/weather.ts";
import type { State } from "../src/types.ts";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");

async function main() {
  const state: State = JSON.parse(
    await readFile(path.join(REPO_ROOT, "state.json"), "utf8")
  );
  const weather = await fetchWeather(state.coords);
  if (weather) {
    process.stdout.write(weather);
  } else {
    process.stdout.write("unknown");
    process.exit(2);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
