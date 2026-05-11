import { createHash } from "node:crypto";

export const MEDITATE_PCT = 30;
export const RECENCY_WINDOW = 50;
export const LINES_SOURCE_URL =
  "https://raw.githubusercontent.com/momentmaker/um/refs/heads/master/self/one-line.md";

export interface PoolLine {
  id: string;
  text: string;
}

export interface UsedRow {
  id: string;
  date: string;
  kind: "heard" | "meditation";
}

const LIST_MARKER_RE = /^[-*>]\s+/;
const PUNCTUATION_ONLY_RE = /^[\s!?.,;:'"`~@#$%^&*()\-+=\[\]{}\\|/<>]+$/;

function sha1Hex(input: string): string {
  return createHash("sha1").update(input).digest("hex");
}

export function parsePool(raw: string): PoolLine[] {
  const lines = raw.split(/\r?\n/);
  const out: PoolLine[] = [];
  for (const line of lines) {
    let text = line.trim();
    if (text.length === 0) continue;
    if (text.startsWith("#")) continue;
    text = text.replace(LIST_MARKER_RE, "");
    if (text.length === 0) continue;
    if (PUNCTUATION_ONLY_RE.test(text)) continue;
    const id = sha1Hex(text).slice(0, 8);
    out.push({ id, text });
  }
  return out;
}
