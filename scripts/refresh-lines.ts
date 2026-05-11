#!/usr/bin/env -S tsx
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { LINES_SOURCE_URL, parsePool, readPool } from "../src/lines.ts";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");
const POOL_PATH = path.join(REPO_ROOT, "lines", "pool.json");
const FETCH_TIMEOUT_MS = 30_000;
const MIN_BODY_BYTES = 32;

async function fetchSource(url: string): Promise<string> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ac.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const body = await res.text();
    if (body.length < MIN_BODY_BYTES) {
      throw new Error(`refused to overwrite pool: body too short (${body.length} bytes)`);
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const raw = await fetchSource(LINES_SOURCE_URL);
  const fresh = parsePool(raw);
  if (fresh.length === 0) {
    throw new Error("refused to overwrite pool: parser yielded zero lines");
  }

  const existing = await readPool(POOL_PATH);
  const existingIds = new Set(existing.map((p) => p.id));
  const freshIds = new Set(fresh.map((p) => p.id));

  const added = fresh.filter((p) => !existingIds.has(p.id)).length;
  const removed = existing.filter((p) => !freshIds.has(p.id)).length;
  const unchanged = fresh.filter((p) => existingIds.has(p.id)).length;

  await writeFile(POOL_PATH, JSON.stringify(fresh, null, 2) + "\n");
  console.log(
    `refresh-lines: pool=${fresh.length} added=${added} removed=${removed} unchanged=${unchanged}`,
  );
}

main().catch((err) => {
  console.error(`refresh-lines failed: ${err.message}`);
  process.exit(1);
});
