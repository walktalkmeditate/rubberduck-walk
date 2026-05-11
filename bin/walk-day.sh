#!/usr/bin/env bash
# Daily duck-walk wrapper — invoked by launchd (~/Library/LaunchAgents/org.walktalkmeditate.rubberduck-walk.plist).
# Invokes Claude Code with the /walk-day slash command defined in .claude/commands/walk-day.md.
# The slash command handles: advance, maybe write, lint, build feed, commit, push, purge.

set -euo pipefail

REPO_DIR="/Users/rubberduck/GitHub/rubberduck/walk"
LOG_DIR="${HOME}/Library/Logs/duck-walk"
LOG_FILE="${LOG_DIR}/walk-day.log"

mkdir -p "${LOG_DIR}"

# Trim log file to last 2000 lines before appending — keeps it bounded without cron rotation.
if [[ -f "${LOG_FILE}" ]]; then
  tail -n 2000 "${LOG_FILE}" > "${LOG_FILE}.tmp" && mv "${LOG_FILE}.tmp" "${LOG_FILE}"
fi

{
  echo ""
  echo "=== $(date -u '+%Y-%m-%dT%H:%M:%SZ') walk-day starting ==="

  cd "${REPO_DIR}"

  # Self-healing prelude — if the prior run left dirt (e.g. files staged but commit
  # failed because the signing agent was locked), try to commit and push it now
  # before today's walk. If recovery itself fails, escalate so the next operator
  # sees the real problem rather than letting a second day's work pile on top.
  if [[ -n "$(git status --porcelain)" ]]; then
    echo "!! leftover state from prior run — attempting recovery"
    git status --short
    git add -A
    git commit -m "the duck walks (recovered)" || echo "(nothing new to commit)"
    # Recovery must actually clean the tree. If commit silently failed
    # (e.g. signing), the `|| echo` above swallowed the error and the tree
    # is still dirty — escalate rather than pile today's walk on top.
    if [[ -n "$(git status --porcelain)" ]]; then
      echo "!! recovery commit failed — repo still dirty, not proceeding"
      git status --short
      exit 2
    fi
    if ! git push; then
      echo "!! recovery push failed — escalating, not proceeding"
      exit 2
    fi
    echo "recovered prior run; proceeding"
  fi

  # Sync with remote so the duck doesn't overwrite anything pushed from another machine.
  # No-op if the recovery block above just pushed.
  # Retry: cold network after wake intermittently times out SSH to github.com.
  pulled=0
  for attempt in 1 2 3; do
    if git pull --rebase --autostash; then
      pulled=1
      break
    fi
    if [[ $attempt -lt 3 ]]; then
      echo "!! git pull failed (attempt $attempt) — sleeping $((attempt * 30))s"
      sleep $((attempt * 30))
    fi
  done
  if [[ $pulled -eq 0 ]]; then
    echo "!! git pull failed 3x — aborting"
    exit 3
  fi

  # Hand off to Claude Code. --dangerously-skip-permissions is required for
  # unattended execution (no TTY to prompt against). The /walk-day command
  # is defined in .claude/commands/walk-day.md and references CLAUDE.md.
  claude -p "/walk-day" --dangerously-skip-permissions

  echo "=== $(date -u '+%Y-%m-%dT%H:%M:%SZ') walk-day finished ==="
} >> "${LOG_FILE}" 2>&1
