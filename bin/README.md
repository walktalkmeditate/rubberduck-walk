# bin/

Local tooling for running the duck's daily walk via launchd.

## `walk-day.sh`

Wrapper invoked by launchd once a day. Handles:

- `cd` into the repo
- `git pull --rebase --autostash` to avoid overwriting work from another machine
- Aborts cleanly if the repo has uncommitted changes
- Invokes `claude -p "/walk-day"` which runs the slash command at `.claude/commands/walk-day.md`
- Logs everything to `~/Library/Logs/duck-walk/walk-day.log` (kept under 2000 lines)

## LaunchAgent

The plist lives at `~/Library/LaunchAgents/org.walktalkmeditate.rubberduck-walk.plist` (not in the repo — it's machine-specific).

Fires daily at **07:03 local time**. If the Mac is asleep at fire time, launchd runs the agent on the next wake.

### Install / enable

```bash
launchctl bootstrap "gui/$(id -u)" ~/Library/LaunchAgents/org.walktalkmeditate.rubberduck-walk.plist
```

Confirm it's loaded:

```bash
launchctl print "gui/$(id -u)/org.walktalkmeditate.rubberduck-walk" | head -20
```

### Disable / uninstall

```bash
launchctl bootout "gui/$(id -u)/org.walktalkmeditate.rubberduck-walk"
# optional — remove the plist file too:
rm ~/Library/LaunchAgents/org.walktalkmeditate.rubberduck-walk.plist
```

### Trigger manually (to test)

```bash
launchctl kickstart "gui/$(id -u)/org.walktalkmeditate.rubberduck-walk"
# watch the log:
tail -f ~/Library/Logs/duck-walk/walk-day.log
```

Or run the wrapper directly, bypassing launchd:

```bash
~/GitHub/rubberduck/walk/bin/walk-day.sh
```

### Inspect logs

- `~/Library/Logs/duck-walk/walk-day.log` — the wrapper's captured output (duck's own log, newest at bottom)
- `~/Library/Logs/duck-walk/launchd-stdout.log` — launchd's stdout (usually empty)
- `~/Library/Logs/duck-walk/launchd-stderr.log` — launchd's stderr (only populated on launchd-level failures)

## Why launchd instead of `/schedule`

The `/schedule` skill's remote agents can clone public repos but cannot commit (mandatory commit-signing with a `source` field not available to ad-hoc tasks) and have no GitHub credentials to push. Local launchd uses the chiefrubberduck SSH + PGP keys already configured for this tree, so both commit signing and push auth work out of the box.
