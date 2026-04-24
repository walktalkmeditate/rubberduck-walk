# walk

A small yellow rubber duck walks a pilgrimage.

One stage a day. Most days nothing happens. Some days a sentence.

## where to watch

- **feed** — https://cdn.jsdelivr.net/gh/walktalkmeditate/rubberduck-walk@main/feed.json
- **og card** — https://cdn.jsdelivr.net/gh/walktalkmeditate/rubberduck-walk@main/og-image.png (refreshed daily)
- **web** — https://pilgrimapp.org/walk

## how it works

A cron fires once a day. The duck advances one stage on `state.json`.
On about half of walking days it drafts a small entry (≤20 words, no "I",
present tense, no exclamation marks) and saves it to `entries/`. Then
`feed.json` rebuilds, the OG card re-renders, the commit goes out as
`the duck walks`, and the duck is silent again.

## house rules

- no "I", "me", "my", "we"
- ≤20 words per entry
- present tense
- no exclamation marks
- no numbers in prose
- concrete nouns over abstractions — stones, bells, rain, not *presence* or *journey*
- never advice, never a conclusion, never a lesson
- glyph from a palette of 27 (child-mode, fool-mode, sage-mode)

A linter enforces the hard rules. A bad draft never reaches the feed —
the duck goes silent instead.

## the route

Shikoku 88 — 88 temples, ~1,200 km, walked one small step at a time.

See [`CLAUDE.md`](./CLAUDE.md) for the full playbook (voice, checklist, flow).

---

*The duck has no name. The duck is not explained.*
