#!/usr/bin/env bash
# Render the OG card by screenshotting og/template.html via headless Chrome.
# Invoked by the /walk-day slash command between build-feed and commit, so the
# resulting og-image.png gets committed alongside the day's feed update.
#
# Output: $REPO_ROOT/og-image.png (1200×630, committed, served via jsDelivr)
#
# Why we don't just `chrome … "$TEMPLATE"` and wait for exit: Chrome on macOS
# spawns `GoogleUpdater --wake-all` on every headless launch and doesn't exit
# until that subprocess tree finishes, which empirically takes 16s–minutes.
# The PNG content is written within the first second or two, so we launch
# Chrome in the background, poll for the screenshot file to stabilize, then
# kill Chrome and every process still touching our tmp profile.

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

# Sweep profile dirs leaked by previous SIGKILL'd runs (only >1h old, so a
# concurrent invocation never nukes an in-flight profile).
# /tmp is a symlink on macOS — the trailing slash forces find to descend.
find /tmp/ -maxdepth 1 -type d -name 'duck-og-chrome.*' -mmin +60 -exec rm -rf {} + 2>/dev/null || true

TMP_PROFILE="$(mktemp -d /tmp/duck-og-chrome.XXXXXX)"
RENDER_TMP="$(mktemp -t duck-og-render.XXXXXX).png"
CHROME_PID=""

cleanup() {
  if [[ -n "${CHROME_PID}" ]]; then
    kill -9 "${CHROME_PID}" 2>/dev/null || true
    wait "${CHROME_PID}" 2>/dev/null || true
  fi
  # Sweep Chrome helpers + updater children still referencing our tmp profile.
  # The profile path is unique per run, so this match is safe.
  pkill -9 -f "${TMP_PROFILE}" 2>/dev/null || true
  rm -rf "${TMP_PROFILE}" "${RENDER_TMP}"
}
trap cleanup EXIT

# --headless=new reserves vertical space for internal chrome, so
# --window-size=1200,630 produces a ~540-tall viewport and pads the bottom.
# Render into 1200×800 and crop back to 1200×630 for the real composition.
"${CHROME_BIN}" \
  --headless=new \
  --disable-gpu \
  --no-sandbox \
  --hide-scrollbars \
  --force-device-scale-factor=1 \
  --allow-file-access-from-files \
  --disable-web-security \
  --user-data-dir="${TMP_PROFILE}" \
  --window-size=1200,800 \
  --virtual-time-budget=4000 \
  --screenshot="${RENDER_TMP}" \
  "${TEMPLATE}" \
  > /dev/null 2>&1 &
CHROME_PID=$!

# Poll for the screenshot file to appear and stabilize. Chrome writes the PNG
# 1–2s after launch, then lingers 16s+ on GoogleUpdater; we only need the PNG.
# Two consecutive size reads >10KB and matching = write is flushed.
DEADLINE=$(( $(date +%s) + 20 ))
PREV_SIZE=-1
STABLE_COUNT=0
while [[ $(date +%s) -lt ${DEADLINE} ]]; do
  if [[ -s "${RENDER_TMP}" ]]; then
    CURR_SIZE=$(wc -c < "${RENDER_TMP}" | tr -d ' ')
    if [[ "${CURR_SIZE}" == "${PREV_SIZE}" && "${CURR_SIZE}" -gt 10000 ]]; then
      STABLE_COUNT=$((STABLE_COUNT + 1))
      [[ ${STABLE_COUNT} -ge 2 ]] && break
    else
      STABLE_COUNT=0
    fi
    PREV_SIZE="${CURR_SIZE}"
  fi
  sleep 0.3
done

if [[ ! -s "${RENDER_TMP}" ]]; then
  echo "render-og: chrome screenshot never appeared within 20s" >&2
  exit 2
fi

# Crop to the OG card's true dimensions.
if command -v magick >/dev/null 2>&1; then
  magick "${RENDER_TMP}" -crop 1200x630+0+0 +repage "${OUTPUT}"
elif command -v sips >/dev/null 2>&1; then
  sips --cropToHeightWidth 630 1200 --cropOffset 0 0 "${RENDER_TMP}" --out "${OUTPUT}" > /dev/null
else
  echo "render-og: need 'magick' (ImageMagick) or 'sips' to crop the screenshot" >&2
  exit 3
fi

if [[ ! -s "${OUTPUT}" ]]; then
  echo "render-og: output file missing or empty: ${OUTPUT}" >&2
  exit 2
fi

BYTES=$(wc -c < "${OUTPUT}" | tr -d ' ')
echo "og-image: rendered ${BYTES} bytes → ${OUTPUT}"
