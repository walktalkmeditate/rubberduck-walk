#!/usr/bin/env -S tsx
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { advance } from "../src/advance.ts";
import type { State, Route } from "../src/types.ts";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const statePath = path.join(REPO_ROOT, "state.json");
  const state: State = JSON.parse(await readFile(statePath, "utf8"));
  const route: Route = JSON.parse(
    await readFile(path.join(REPO_ROOT, "routes", `${state.route}.json`), "utf8")
  );

  const next = advance(state, route, today);
  await writeFile(statePath, JSON.stringify(next, null, 2) + "\n");

  if (next.stage !== state.stage || next.mode !== state.mode) {
    console.log(
      `duck: ${state.stageName} (${state.mode}) → ${next.stageName} (${next.mode})`
    );
  } else {
    console.log(`duck: still at ${next.stageName} (${next.mode})`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
