#!/usr/bin/env bash
set -euo pipefail

URL="https://purge.jsdelivr.net/gh/walktalkmeditate/rubberduck-walk@main/feed.json"

echo "purging jsDelivr cache..."
curl -fsS "$URL" | head -c 200
echo ""
