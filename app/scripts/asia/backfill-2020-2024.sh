#!/usr/bin/env bash
# Resume-safe 2020–2024 Asia tournament discover + enrich (no rating-history).
# Re-run anytime; walked profiles and event caches are checkpointed.
set -euo pipefail
cd "$(dirname "$0")/../.."
export PYTHONUNBUFFERED=1
exec python3 scripts/asia/asia_archive.py \
  --from=2020 --to=2024 \
  --discover --enrich --no-rating-history \
  "$@"
