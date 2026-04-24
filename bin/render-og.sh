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

# Chrome's --headless=new reserves some vertical space inside the window for
# its internal chrome, so a --window-size=1200,630 screenshot actually renders
# into a ~1200×540 viewport and pads the bottom with the html background,
# clipping the goshuin seal + metadata strip. We render into a taller window
# and crop back to 1200×630 to get the real composition.
RENDER_TMP="$(mktemp -t duck-og-render.XXXXXX).png"
trap 'rm -rf "${TMP_PROFILE}" "${RENDER_TMP}"' EXIT

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
  > /dev/null 2>&1

if [[ ! -s "${RENDER_TMP}" ]]; then
  echo "render-og: chrome screenshot missing or empty" >&2
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
