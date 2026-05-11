import { createHash } from "node:crypto";
import type { State, EntryKind } from "./types.ts";

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

export type DayKind = "walk-with-line" | "meditate";

export interface DayKindResult {
  dayKind: DayKind;
  entryKind: EntryKind;
}

function dateCoin(date: string): number {
  // Maps date → integer in [0, 100). Stable, no Math.random.
  const hex = sha1Hex(date).slice(0, 8);
  return parseInt(hex, 16) % 100;
}

export function pickDayKind(state: State, today: string): DayKindResult {
  // Closure-arrival: duck just landed at the closure site (resting + entered today).
  if (state.mode === "resting" && state.modeEnteredAt === today) {
    return { dayKind: "walk-with-line", entryKind: "threshold" };
  }
  // Resting-not-arrival: any later resting day — voice rules need motion, so meditate.
  if (state.mode === "resting" && state.modeEnteredAt < today) {
    return { dayKind: "meditate", entryKind: "meditation" };
  }
  // Walking / beginning / completing: coin at MEDITATE_PCT.
  if (dateCoin(today) < MEDITATE_PCT) {
    return { dayKind: "meditate", entryKind: "meditation" };
  }
  return { dayKind: "walk-with-line", entryKind: "offering" };
}
