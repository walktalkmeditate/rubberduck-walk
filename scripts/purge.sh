#!/usr/bin/env bash
# Purge jsDelivr for the files that actually change on each walk. We POST to
# the root purge endpoint with a `path[]` array so jsDelivr re-resolves the
# `@main` branch alias to the newest commit SHA, not just the file at the old
# SHA — the per-file GET form only clears the edge cache for the current
# resolution, which leaves `@main` stuck on whatever commit it last saw.
set -euo pipefail

REPO="gh/walktalkmeditate/rubberduck-walk@main"
PATHS=(
  "/${REPO}/feed.json"
  "/${REPO}/state.json"
  "/${REPO}/og-image.png"
)

BODY=$(printf '"%s",' "${PATHS[@]}")
BODY="{\"path\":[${BODY%,}]}"

echo "purging jsDelivr cache..."
curl -fsS -X POST "https://purge.jsdelivr.net/" \
  -H "Content-Type: application/json" \
  -d "${BODY}" | head -c 300
echo ""
