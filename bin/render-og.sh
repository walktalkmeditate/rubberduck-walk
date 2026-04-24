#!/usr/bin/env bash
# Render the OG card by screenshotting og/template.html via headless Chrome.
# Invoked by the /walk-day slash command between build-feed and commit, so the
# resulting og-image.png gets committed alongside the day's feed update.
#
# Output: $REPO_ROOT/og-image.png (1200×630, committed, served via jsDelivr)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TEMPLATE="file://${REPO_ROOT}/og/template.html"
OUTPUT="${REPO_ROOT}/og-image.png"

CHROME_BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
if [[ ! -x "${CHROME_BIN}" ]]; then
  # Fall back to Chromium variants on non-macOS / alt installs
  if command -v chromium >/dev/null 2>&1; then
    CHROME_BIN="$(command -v chromium)"
  elif command -v google-chrome >/dev/null 2>&1; then
    CHROME_BIN="$(command -v google-chrome)"
  else
    echo "render-og: no Chrome/Chromium found — cannot render og-image" >&2
    exit 1
  fi
fi

# Use a temp user-data-dir so we don't conflict with the user's live Chrome session.
TMP_PROFILE="$(mktemp -d /tmp/duck-og-chrome.XXXXXX)"
trap 'rm -rf "${TMP_PROFILE}"' EXIT

"${CHROME_BIN}" \
  --headless=new \
  --disable-gpu \
  --no-sandbox \
  --hide-scrollbars \
  --force-device-scale-factor=1 \
  --allow-file-access-from-files \
  --disable-web-security \
  --user-data-dir="${TMP_PROFILE}" \
  --window-size=1200,630 \
  --virtual-time-budget=4000 \
  --screenshot="${OUTPUT}" \
  "${TEMPLATE}" \
  > /dev/null 2>&1

if [[ ! -s "${OUTPUT}" ]]; then
  echo "render-og: output file missing or empty: ${OUTPUT}" >&2
  exit 2
fi

BYTES=$(wc -c < "${OUTPUT}" | tr -d ' ')
echo "og-image: rendered ${BYTES} bytes → ${OUTPUT}"
