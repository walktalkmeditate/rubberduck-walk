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

  if (!fm.date || !fm.route || !fm.kind) {
    throw new Error(`Entry frontmatter missing required fields: ${filePath}`);
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
