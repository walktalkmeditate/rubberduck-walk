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

  if [[ -n "$(git status --porcelain)" ]]; then
    echo "!! repo has uncommitted changes — not walking today. clean them and try again."
    git status --short
    exit 2
  fi

  # Pull first so the duck doesn't overwrite anything pushed from another machine.
  git pull --rebase --autostash

  # Hand off to Claude Code. --dangerously-skip-permissions is required for
  # unattended execution (no TTY to prompt against). The /walk-day command
  # is defined in .claude/commands/walk-day.md and references CLAUDE.md.
  claude -p "/walk-day" --dangerously-skip-permissions

  echo "=== $(date -u '+%Y-%m-%dT%H:%M:%SZ') walk-day finished ==="
} >> "${LOG_FILE}" 2>&1
