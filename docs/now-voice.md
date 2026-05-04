# /now voice

Voice rules for `now.json`, the data feed behind chiefrubberduck.com/now.

This is **chief-voice**, not duck-voice. Looser than `entries/`. Different banlist.

## Source material per update

Read in this order:

1. `state.json` — duck's current route, stage, mode.
2. The latest entry in `entries/` if today produced one (offering / notice / threshold / silence / letter). Frontmatter + body.
3. `feed.json` — for context on the last few entries.
4. The previous `now.json` — to avoid repeating phrasing or kinds.

## Shape

`now.json` at repo root:

```json
{
  "updatedAt": "<ISO-8601 UTC>",
  "context": {
    "route": "<route id from state.json>",
    "stage": <number>,
    "stageName": "<string>",
    "duckMode": "<walking|completing|resting|beginning>"
  },
  "bullets": [
    { "kind": "<walk|doing|feeling|noticing|silly|wisdom>", "text": "<string>" }
  ]
}
```

## Hard rules

- 3–7 bullets per update.
- Each bullet ≤ 25 words. Plain text. Lowercase.
- **Exactly one** `kind: walk` bullet — references today's stage / glyph / what duck noticed. On silence days, acknowledges rest in concrete terms ("duck rested. the rooftiles didn't notice.").
- Mix kinds. Don't ship 5 bullets of the same kind.
- Concrete nouns. Specific over general.
- First-person allowed (`i`, `my`) but sparingly. No corporate `we`.
- No exclamation marks.
- No advice voice (`remember to`, `try`, `consider`, `notice`).
- No corporate / wellness / LinkedIn voice.

## Banned words

`grateful`, `blessed`, `manifesting`, `mindfulness`, `presence`, `journey` (metaphorical), `peaceful`, `serene`, `holding space`, `bandwidth` (metaphorical), `lean in`, `learnings`.

## Kind palette

| kind | what it is | example |
|------|-----------|---------|
| `walk` | today's duck reflection (required, exactly 1) | `duck stood at iwamoto-ji. heron didn't move.` |
| `doing` | what hands or body are on right now | `rebuilding a synth from 1987 because the manual is funnier than youtube.` |
| `feeling` | inner weather, plain | `low-grade dread, also sandwich.` |
| `noticing` | something pulled the eye | `crows know my route. one of them blinked first today.` |
| `silly` | rare, surprise + specificity | `the toaster sounds judgmental at this hour.` |
| `wisdom` | rare (≤1 per update), koan-shaped, doesn't try too hard | `the path is also the kettle.` |

## Discipline

Memeable = surprise + specificity. Not "feeling content today". Try "the kettle whistled before i did".

Self-aware humor over earnestness. Earnest is OK, just rare.

Vary opening kind across days. Don't always start with `walk`.

If the model can't produce a clean update, ship 3 bullets, not 7. Restraint over volume.

## Not enforced (yet)

There is no programmatic lint for `now.json` in v1. Voice quality is the model's job until enough drift shows up to justify a `now-voice-lint`. If that day comes, model the lint after `scripts/voice-lint.ts` with a different banlist.
