import type { Entry } from "./types.ts";

export const GLYPH_PALETTE: readonly string[] = Object.freeze([
  "⚇",
  "❂",
  "⛩️",
  "🔔",
  "🪷",
  "🕯️",
  "🌙",
  "🪨",
  "🌿",
  "🍃",
  "💧",
  "🌧️",
  "☁️",
  "🗻",
  "🪵",
  "🐚",
  "🌾",
  "🌫️",
  "🕊️",
  "◯",
  "△",
  "☰",
  "∅",
  "∞",
  "≡",
  "〰️",
  "🌀",
]);

export interface LintIssue {
  kind: string;
  detail: string;
}

const FIRST_PERSON_WORDS = ["i", "me", "my", "we"];
const BANNED_ABSTRACTIONS = [
  "presence",
  "mindfulness",
  "journey",
  "peaceful",
  "serene",
  "grateful",
  "blessed",
];
const ADVICE_VERBS = ["remember", "notice", "try", "consider", "learn"];
const MAX_WORDS = 20;

const UNCONSTRAINED_KINDS = new Set(["letter", "silence"]);

function buildWordBoundaryRegex(words: readonly string[]): RegExp {
  const alternation = words.map(escapeRegex).join("|");
  return new RegExp(`(?<![A-Za-z])(?:${alternation})(?![A-Za-z])`, "gi");
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const FIRST_PERSON_RE = buildWordBoundaryRegex(FIRST_PERSON_WORDS);
const ABSTRACTION_RE = buildWordBoundaryRegex(BANNED_ABSTRACTIONS);
const ADVICE_RE = buildWordBoundaryRegex(ADVICE_VERBS);
const DIGIT_RE = /[0-9]/;

function uniqueMatches(body: string, re: RegExp): string[] {
  const found = new Set<string>();
  for (const match of body.matchAll(re)) {
    found.add(match[0].toLowerCase());
  }
  return [...found];
}

function countWords(body: string): number {
  return body
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0).length;
}

export function lintEntry(entry: Entry): LintIssue[] {
  if (UNCONSTRAINED_KINDS.has(entry.kind)) {
    return [];
  }

  const issues: LintIssue[] = [];
  const body = entry.body ?? "";
  const trimmed = body.trim();

  if (trimmed.length === 0) {
    issues.push({
      kind: "empty-body",
      detail: `kind=${entry.kind} requires a non-empty body`,
    });
  }

  const firstPersonHits = uniqueMatches(body, FIRST_PERSON_RE);
  if (firstPersonHits.length > 0) {
    issues.push({
      kind: "first-person",
      detail: `body contains first-person word(s): ${firstPersonHits.join(", ")}`,
    });
  }

  const wordCount = countWords(body);
  if (wordCount > MAX_WORDS) {
    issues.push({
      kind: "word-count",
      detail: `body has ${wordCount} words; max is ${MAX_WORDS}`,
    });
  }

  if (DIGIT_RE.test(body)) {
    issues.push({
      kind: "digit-in-body",
      detail: "body contains a digit; numbers belong only in frontmatter",
    });
  }

  if (body.includes("!")) {
    issues.push({
      kind: "exclamation",
      detail: "body contains '!'",
    });
  }

  const abstractionHits = uniqueMatches(body, ABSTRACTION_RE);
  if (abstractionHits.length > 0) {
    issues.push({
      kind: "banned-abstraction",
      detail: `body contains banned abstraction(s): ${abstractionHits.join(", ")}`,
    });
  }

  const adviceHits = uniqueMatches(body, ADVICE_RE);
  if (adviceHits.length > 0) {
    issues.push({
      kind: "advice-verb",
      detail: `body contains advice verb(s): ${adviceHits.join(", ")}`,
    });
  }

  if (!GLYPH_PALETTE.includes(entry.glyph)) {
    issues.push({
      kind: "glyph-not-in-palette",
      detail: `glyph '${entry.glyph}' is not in the 27-symbol palette`,
    });
  }

  return issues;
}
