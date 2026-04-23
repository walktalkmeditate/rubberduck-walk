#!/usr/bin/env -S tsx
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildFeed } from "../src/feed.ts";
import { loadAllEntries } from "../src/entries.ts";
import type { State, Route } from "../src/types.ts";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const state: State = JSON.parse(
    await readFile(path.join(REPO_ROOT, "state.json"), "utf8")
  );
  const route: Route = JSON.parse(
    await readFile(path.join(REPO_ROOT, "routes", `${state.route}.json`), "utf8")
  );
  const entries = await loadAllEntries(path.join(REPO_ROOT, "entries"), today);

  const feed = buildFeed({ state, route, entries, today });
  await writeFile(
    path.join(REPO_ROOT, "feed.json"),
    JSON.stringify(feed, null, 2) + "\n"
  );
  console.log(`feed.json built — ${feed.entries.length} entries, duck at ${feed.duck.stageName}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
