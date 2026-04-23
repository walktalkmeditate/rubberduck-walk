---
description: The duck's daily walk — advance, maybe write, build feed, commit, push, purge
---

It is the duck's walk day. Follow the playbook in `CLAUDE.md` exactly.

Summary of the daily flow (full details and voice rules are in CLAUDE.md):

1. Run `./duck advance` to move the duck's position and update `state.json`.
2. Decide whether to write based on the new `state.mode`:
   - `resting` → skip writing entirely.
   - `completing` and duck has arrived at the closure site → write a single `kind: threshold` entry.
   - `beginning` → write a short quiet arrival entry.
   - `walking` → write with ~0.5 probability; skip cleanly otherwise.
3. If writing: fetch weather via `npm run weather 2>/dev/null || echo unknown`, draft the entry following the voice rules, self-review against the checklist, and either save the entry or emit `./duck silence` after 3 failed drafts.
4. Run `./duck build-feed` to regenerate `feed.json`.
5. Commit, push, purge (in that order):
   ```bash
   git add -A
   git commit -m "the duck walks" || echo "(nothing to commit)"
   git push
   bash scripts/purge.sh
   ```

The 27-glyph palette, voice rules (no "I", ≤20 words, present tense, concrete nouns, no advice), and the self-review checklist all live in `CLAUDE.md`. Load it before drafting.

Report back with:
- What the duck did today (advanced to X, wrote Y kind, or fell silent)
- Any deviation from the playbook you had to make and why
