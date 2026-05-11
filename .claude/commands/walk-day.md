---
description: The duck's daily walk — advance, decide kind, write entry, build feed, render og, commit, push, purge
---

It is the duck's walk day. Follow the playbook in `CLAUDE.md` exactly. Summary:

1. **Advance.** Run `./duck advance` — always. Updates `state.json`. Idempotent on `lastAdvancedAt`.

2. **Entry-exists guard.** Glob `entries/<today>-*.md` (UTC date). If a file matches:
   - Read its frontmatter `heardId`. If present and not already logged in `lines/used.json` for today, append the row now via the same mechanism used in step 6 (atomic recovery from a prior crash between entry-write and used.json append).
   - Skip steps 3-7. Jump to step 8.

3. **Pick day kind.** Call `pickDayKind(state, today)` from `src/lines.ts`:
   - Closure-arrival (resting + entered today) → walk-with-line + threshold.
   - Resting non-arrival → meditate.
   - Walking / beginning / completing → 30% coin → meditate / walk-with-line.

4. **Pull line.** Call `pickLine(today, pool, used)`:
   - If pool is empty → force walk-with-line and skip `heard:` for the day.
   - Same-date guard returns previously-logged id.
   - Else fresh-cycle or recency-50 pick.

5. **Weather + km.** `npm run weather 2>/dev/null || echo unknown`. Read `kmFromStart` from `routes/<state.route>.json` for `state.stage`.

6. **Draft and write.**
   - **walk-with-line:** read the 3 most recent entries for voice context. Draft body per voice rules in CLAUDE.md. Write entry with `kind: offering` (or `threshold` on closure-arrival), `heard`, `heardId`.
   - **meditate:** no drafting. Write entry with `kind: meditation`, body = line text verbatim, `heardId`, date-seeded glyph via `meditationGlyph(today)` from `src/lines.ts`. Slug fixed to `meditation`.

7. **Self-review + voice-lint.** Walk-with-line only. Self-review against checklist; redraft up to 2x. Then run `npm run voice-lint -- entries/<file>.md`. If still failing after 3 drafts: delete the failed draft, fall back to meditate with today's line.

8. **Record line usage.** Append `{ id, date, kind }` to `lines/used.json` via `recordUsage()` from `src/lines.ts`. Idempotent by date.

9. **Rebuild feed.** `./duck build-feed`.

10. **OG card.** `bash bin/render-og.sh`. Fail soft.

11. **Now.json.** Regenerate per `docs/now-voice.md`. Fail soft.

12. **Commit, push, purge.**
    ```bash
    git add -A
    git commit -m "the duck walks" || echo "(nothing to commit)"
    git push
    bash scripts/purge.sh
    ```

The 27-glyph palette, voice rules, banned-abstraction list, and the self-review checklist all live in `CLAUDE.md`. Load it before drafting.

Report back with:
- What the duck did today (advanced to X, walk-with-line or meditate, line text, lint pass/fail)
- Whether og-image.png regenerated successfully
- Any deviation from the playbook and why
