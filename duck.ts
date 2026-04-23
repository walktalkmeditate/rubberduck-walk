#!/usr/bin/env -S tsx
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline/promises";
import path from "node:path";
import yaml from "js-yaml";
import type { State, Route, EntryKind } from "./src/types.ts";
import { beginRoute } from "./src/advance.ts";

const REPO_ROOT = path.resolve(import.meta.dirname);

async function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit", cwd: REPO_ROOT });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
  });
}

async function readState(): Promise<State> {
  return JSON.parse(await readFile(path.join(REPO_ROOT, "state.json"), "utf8"));
}

async function readRoute(id: string): Promise<Route> {
  return JSON.parse(await readFile(path.join(REPO_ROOT, "routes", `${id}.json`), "utf8"));
}

async function writeEntry(opts: {
  kind: EntryKind;
  glyph: string;
  body: string;
  author?: string;
}): Promise<string> {
  const state = await readState();
  const today = new Date().toISOString().slice(0, 10);
  const slug = state.stageName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const fileName = `${today}-${slug}.md`;
  const filePath = path.join(REPO_ROOT, "entries", fileName);
  const frontmatter: Record<string, unknown> = {
    date: today,
    route: state.route,
    stage: state.stage,
    stageName: state.stageName,
    coords: state.coords,
    kind: opts.kind,
    glyph: opts.glyph,
  };
  if (opts.author) frontmatter.author = opts.author;
  const fmYaml = yaml.dump(frontmatter, { flowLevel: 1 }).trim();
  const content = `---\n${fmYaml}\n---\n\n${opts.body}\n`;
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content);
  return filePath;
}

async function cmdStatus() {
  const state = await readState();
  console.log(`Route:       ${state.route}`);
  console.log(`Stage:       ${state.stage} — ${state.stageName}`);
  console.log(`Coords:      ${state.coords.join(", ")}`);
  console.log(`Mode:        ${state.mode} (since ${state.modeEnteredAt})`);
  console.log(`Last moved:  ${state.lastAdvancedAt}`);
}

async function cmdAdvance() {
  await run("npx", ["tsx", "scripts/advance.ts"]);
}

async function cmdBuildFeed() {
  await run("npx", ["tsx", "scripts/build-feed.ts"]);
}

async function cmdSilence() {
  const glyphPalette = "⚇ ❂ ⛩️ 🔔 🪷 🕯️ 🌙 🪨 🌿 🍃 💧 🌧️ ☁️ 🗻 🪵 🐚 🌾 🌫️ 🕊️ ◯ △ ☰ ∅ ∞ ≡ 〰️ 🌀".split(" ");
  const glyph = glyphPalette[Math.floor(Math.random() * glyphPalette.length)];
  const filePath = await writeEntry({ kind: "silence", glyph, body: "" });
  console.log(`silence: ${filePath}`);
}

async function cmdOffer() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const glyph = await rl.question("glyph: ");
  const body = await rl.question("offering (≤20 words, no 'I'): ");
  rl.close();
  const filePath = await writeEntry({ kind: "offering", glyph: glyph.trim(), body: body.trim() });
  console.log(`wrote: ${filePath}`);
}

async function cmdLetter() {
  const editor = process.env.EDITOR ?? "vi";
  const today = new Date().toISOString().slice(0, 10);
  const state = await readState();
  const slug = state.stageName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const tmpPath = path.join(REPO_ROOT, "entries", `${today}-${slug}-letter.md`);
  const stub = `---
date: ${today}
route: ${state.route}
stage: ${state.stage}
stageName: ${state.stageName}
coords: [${state.coords.join(", ")}]
kind: letter
glyph: 🕯️
author: — the pilgrim
---

write freely below this line


`;
  await mkdir(path.dirname(tmpPath), { recursive: true });
  await writeFile(tmpPath, stub);
  await run(editor, [tmpPath]);
  console.log(`letter saved at: ${tmpPath}`);
}

async function cmdNext(routeId: string | undefined) {
  if (!routeId) {
    const queue: string[] = JSON.parse(
      await readFile(path.join(REPO_ROOT, "routes", "queue.json"), "utf8")
    );
    const state = await readState();
    const suggest = queue.find((r) => r !== state.route) ?? "(none)";
    console.log(`./duck next <route-id>  (suggested: ${suggest})`);
    process.exit(2);
  }
  const state = await readState();
  const route = await readRoute(routeId);
  const today = new Date().toISOString().slice(0, 10);
  const next = beginRoute(state, route, today);
  await writeFile(path.join(REPO_ROOT, "state.json"), JSON.stringify(next, null, 2) + "\n");

  const queuePath = path.join(REPO_ROOT, "routes", "queue.json");
  const queue: string[] = JSON.parse(await readFile(queuePath, "utf8"));
  const filtered = queue.filter((r) => r !== routeId);
  if (filtered.length !== queue.length) {
    await writeFile(queuePath, JSON.stringify(filtered, null, 2) + "\n");
  }
  console.log(`duck: beginning ${route.name} at ${next.stageName}`);
}

async function cmdPreview() {
  await cmdBuildFeed();
  const feed = JSON.parse(await readFile(path.join(REPO_ROOT, "feed.json"), "utf8"));
  console.log(JSON.stringify(feed, null, 2));
}

async function main() {
  const [, , cmd, ...rest] = process.argv;
  switch (cmd) {
    case "status":    return cmdStatus();
    case "advance":   return cmdAdvance();
    case "build":
    case "build-feed": return cmdBuildFeed();
    case "silence":   return cmdSilence();
    case "offer":     return cmdOffer();
    case "letter":    return cmdLetter();
    case "next":      return cmdNext(rest[0]);
    case "preview":   return cmdPreview();
    default:
      console.error("usage: ./duck {status|advance|build-feed|silence|offer|letter|next <route-id>|preview}");
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
