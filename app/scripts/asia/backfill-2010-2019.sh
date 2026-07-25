#!/usr/bin/env bash
# Queue next: resume-safe 2010–2019 Asia tournament discover + enrich.
# Run after Profile v2 UI ships. Rating history is optional and separate.
set -euo pipefail
cd "$(dirname "$0")/../.."
export PYTHONUNBUFFERED=1
mkdir -p scripts/asia/logs
exec python3 scripts/asia/asia_archive.py \
  --from=2010 --to=2019 \
  --discover --enrich --no-rating-history \
  "$@" 2>&1 | tee -a scripts/asia/logs/backfill-2010-2019.log
