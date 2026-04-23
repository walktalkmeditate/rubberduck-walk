import { readdir, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import yaml from "js-yaml";
import type { Entry, EntryFrontmatter } from "./types.ts";

const FRONTMATTER_RE = /^---\r?\n([\s\S]+?)\r?\n---\r?\n([\s\S]*)$/;

export function parseEntry(raw: string, filePath: string): Entry {
  const match = raw.match(FRONTMATTER_RE);
  if (!match) {
    throw new Error(`Entry missing frontmatter: ${filePath}`);
  }
  const [, fmRaw, body] = match;
  const fm = yaml.load(fmRaw, { schema: yaml.JSON_SCHEMA }) as EntryFrontmatter;

  const missing: string[] = [];
  if (!fm.date) missing.push("date");
  if (!fm.route) missing.push("route");
  if (!fm.kind) missing.push("kind");
  if (fm.stage === undefined || fm.stage === null) missing.push("stage");
  if (!fm.stageName) missing.push("stageName");
  if (!Array.isArray(fm.coords) || fm.coords.length !== 2) missing.push("coords");
  if (!fm.glyph) missing.push("glyph");
  if (missing.length > 0) {
    throw new Error(
      `Entry frontmatter missing required fields [${missing.join(", ")}]: ${filePath}`,
    );
  }

  const paragraphs = body
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  return {
    ...fm,
    body,
    paragraphs,
    filePath,
    ageDays: 0,
  };
}

export function computeAgeDays(entryDate: string, today: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const a = Date.parse(entryDate + "T00:00:00Z");
  const b = Date.parse(today + "T00:00:00Z");
  return Math.round((b - a) / msPerDay);
}

export async function pruneOldEntries(
  dir: string,
  today: string,
  maxAgeDays = 365,
): Promise<string[]> {
  const names = await readdir(dir);
  const mdNames = names.filter((n) => n.endsWith(".md"));
  const deleted: string[] = [];
  for (const name of mdNames) {
    const filePath = path.join(dir, name);
    const raw = await readFile(filePath, "utf8");
    let entry: Entry;
    try {
      entry = parseEntry(raw, filePath);
    } catch {
      continue;
    }
    const ageDays = computeAgeDays(entry.date, today);
    if (ageDays > maxAgeDays) {
      await unlink(filePath);
      deleted.push(filePath);
    }
  }
  return deleted;
}

export async function loadAllEntries(dir: string, today: string): Promise<Entry[]> {
  const names = await readdir(dir);
  const mdNames = names.filter((n) => n.endsWith(".md"));
  const entries: Entry[] = [];
  for (const name of mdNames) {
    const filePath = path.join(dir, name);
    const raw = await readFile(filePath, "utf8");
    const entry = parseEntry(raw, filePath);
    entry.ageDays = computeAgeDays(entry.date, today);
    entries.push(entry);
  }
  entries.sort((a, b) => (a.date < b.date ? 1 : -1));
  return entries;
}
