#!/usr/bin/env -S tsx
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseEntry } from "../src/entries.ts";
import { lintEntry } from "../src/voice-lint.ts";

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    process.stderr.write("usage: voice-lint <entry-file.md>\n");
    process.exit(2);
  }
  const filePath = path.resolve(arg);
  const raw = await readFile(filePath, "utf8");
  const entry = parseEntry(raw, filePath);
  const issues = lintEntry(entry);
  if (issues.length > 0) {
    for (const issue of issues) {
      process.stderr.write(`${issue.kind}: ${issue.detail}\n`);
    }
    process.exit(1);
  }
  process.stdout.write("clean\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
