---
description: The duck's daily walk — advance, decide kind, write entry, build feed, render og, commit, push, purge
---

Daily walk pipeline. All steps are shell commands; no inline tsx scripts needed.

1. **Advance.** `./duck advance` — always runs, idempotent on `lastAdvancedAt`.

2. **Entry-exists guard.** Check `entries/<today>-*.md` exists (today = UTC date via `date -u +%Y-%m-%d`). If a file matches: read its `heardId` from frontmatter and call `./duck record-usage <heardId> <kind>` (where kind = "meditation" if filename is `<today>-meditation.md`, else "heard"). Then skip ahead to step 7. (Reconciles a partial prior run.)

3. **Pick day kind.** `./duck pick-kind` — prints JSON `{"dayKind": "walk-with-line"|"meditate", "entryKind": "offering"|"threshold"|"meditation"}`.

4. **Pick line.** `./duck pick-line` — prints `{"id": "...", "text": "..."}` or `null`. If `null`, treat as empty pool: force `dayKind=walk-with-line` and omit heard from the entry.

5. **Weather + km.** `npm run weather 2>/dev/null || echo unknown`. Look up `kmFromStart` from `routes/<state.route>.json` for `state.stage`.

6. **Write entry by dayKind.**

   - **walk-with-line:** read the 3 most recent files in `entries/` for voice context. Draft body per CLAUDE.md voice rules. Write the entry file at `entries/<today>-<slug>.md` (slug from state.stageName) via the Write tool. Include frontmatter fields: `date, route, stage, stageName, coords, kind: offering` (or `threshold` if dayKind=walk-with-line + entryKind=threshold), `glyph, weather, kmFromStart, heard, heardId`.

   - **meditate:** `./duck meditate <heardId> <line text>`. The duck CLI writes the file with slug=meditation, body=line, date-seeded glyph, heardId.

7. **Self-review + voice-lint** (walk-with-line only). Self-review against CLAUDE.md checklist; redraft up to 2x. Then run `npm run voice-lint -- entries/<file>.md`. If lint still fails: delete the failed file, fall back to meditate via `./duck meditate <heardId> <line text>`.

8. **Record line usage.** `./duck record-usage <id> heard` (or `meditation`). Idempotent by date.

9. **Build feed.** `./duck build-feed`.

10. **OG card.** `bash bin/render-og.sh`. Fail soft.

11. **Now.json.** Regenerate per `docs/now-voice.md`. Fail soft.

12. **Commit + push + purge.**
    ```bash
    git add -A
    git commit -m "the duck walks" || echo "(nothing to commit)"
    git push
    bash scripts/purge.sh
    ```

Glyph palette, voice rules, banned-abstraction list, self-review checklist all live in `CLAUDE.md`.

Report back with:
- What duck did (advanced to X, kind, line text, lint pass/fail)
- og-image.png regen status
- Any deviation from playbook
