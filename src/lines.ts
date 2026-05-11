import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
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

function deterministicIndex(date: string, salt: string, len: number): number {
  const hex = sha1Hex(date + ":" + salt).slice(0, 8);
  return parseInt(hex, 16) % len;
}

export function pickLine(
  today: string,
  pool: PoolLine[],
  used: UsedRow[],
): PoolLine | null {
  // Empty pool → caller forces walk-with-line without heard.
  if (pool.length === 0) return null;

  // Same-date guard: reuse whatever was already logged for today.
  const todayRow = used.find((u) => u.date === today);
  if (todayRow) {
    const match = pool.find((p) => p.id === todayRow.id);
    if (match) return match;
    // Edge: logged id no longer in pool (deleted by refresh). Fall through to repick.
  }

  // Fresh-cycle: pool minus all-time used.
  const usedIds = new Set(used.map((u) => u.id));
  const unusedFresh = pool.filter((p) => !usedIds.has(p.id));
  if (unusedFresh.length > 0) {
    const idx = deterministicIndex(today, "line", unusedFresh.length);
    return unusedFresh[idx];
  }

  // Exhausted: recency window. Block the last min(RECENCY_WINDOW, pool.length - 1) ids.
  const windowSize = Math.min(RECENCY_WINDOW, pool.length - 1);
  const recencyIds = new Set(
    used.slice(-windowSize).map((u) => u.id),
  );
  const eligible = pool.filter((p) => !recencyIds.has(p.id));
  if (eligible.length === 0) {
    // Defensive: only triggers if pool.length === 1 and that 1 is in recency.
    return pool[0];
  }
  const idx = deterministicIndex(today, "line", eligible.length);
  return eligible[idx];
}

export async function readUsed(usedPath: string): Promise<UsedRow[]> {
  try {
    const raw = await readFile(usedPath, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as UsedRow[];
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException)?.code === "ENOENT") return [];
    throw err;
  }
}

export async function recordUsage(usedPath: string, row: UsedRow): Promise<void> {
  const current = await readUsed(usedPath);
  if (current.some((r) => r.date === row.date)) {
    return; // idempotent: already logged for this date, first-write-wins
  }
  current.push(row);
  await writeFile(usedPath, JSON.stringify(current, null, 2) + "\n");
}

export async function readPool(poolPath: string): Promise<PoolLine[]> {
  try {
    const raw = await readFile(poolPath, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as PoolLine[];
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException)?.code === "ENOENT") return [];
    throw err;
  }
}
