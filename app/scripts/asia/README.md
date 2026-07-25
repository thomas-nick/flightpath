# Asia Disc Golf archive

PDGA **tournament** scraper for Flightpath Asia. Weekly leagues / bag-tag series are skipped.

## Data outputs

| Path | Purpose |
| --- | --- |
| `scripts/asia/data/*.json` | Scrape caches (events, profiles, ratings) |
| `src/data/asia/board.json` | Leaderboard + tour standings |
| `src/data/asia/players/{pdga}.json` | Full player dossiers |
| `src/data/asia/events/{id}.json` | Per-event results |
| `src/data/asia/courses.json` | Course/venue index (events hosted, winners, top finisher) |
| `src/data/asia/upcoming-events.json` | Future PDGA tournaments scheduled across Asia |

## Run

```bash
cd flightpath/app
pip3 install requests beautifulsoup4

# Re-aggregate current cache into site data
PYTHONUNBUFFERED=1 python3 scripts/asia/asia_archive.py

# Historical backfill (slow — polite delays, resume-safe)
# --from/--to only control which player-stat years to walk; the board always
# keeps the full 2010→current archive once events are cached.
# Progress: scripts/asia/data/asia_discover_progress.json + event/profile caches.
# Skip expensive rating scrapes during discover with --no-rating-history.
./scripts/asia/backfill-2020-2024.sh
# or:
PYTHONUNBUFFERED=1 python3 scripts/asia/asia_archive.py \
  --from=2020 --to=2024 --discover --enrich --no-rating-history

# Re-aggregate caches into board/profile JSON (no network discover)
PYTHONUNBUFFERED=1 python3 scripts/asia/asia_archive.py --no-rating-history

# Next archive job (queued after Profile v2): 2010–2019 discover
./scripts/asia/backfill-2010-2019.sh
# or:
PYTHONUNBUFFERED=1 python3 scripts/asia/asia_archive.py \
  --from=2010 --to=2019 --discover --enrich --no-rating-history

# Optional: fill rating sparkline history after a deep backfill
PYTHONUNBUFFERED=1 python3 scripts/asia/asia_archive.py --rating-history

# Deferred: round scores / round ratings require extending the event scraper
# (Rd1…Total columns) — do not start until 2010–2019 discover finishes.

# Tail a running backfill
tail -f scripts/asia/logs/backfill-2020-2024.log
tail -f scripts/asia/logs/backfill-2010-2019.log

# Re-scrape event HTML for open + amateur rows
PYTHONUNBUFFERED=1 python3 scripts/asia/asia_archive.py --refresh-results

# Courses: rebuild the course/venue index from cached event details
# (provisional — groups events by host city until the Course field is backfilled)
PYTHONUNBUFFERED=1 python3 scripts/asia/build_courses.py

# Courses: backfill the real PDGA "Course" field onto cached events
# (resumable + rate-limited; reuses asia_archive.pdga_get). Adds course /
# course_id / course_url to the cache + per-event JSONs. Re-run build_courses.py
# afterwards to upgrade courses.json from venue-derived to real course names.
PYTHONUNBUFFERED=1 python3 scripts/asia/backfill_courses.py            # missing only
PYTHONUNBUFFERED=1 python3 scripts/asia/backfill_courses.py --limit 20 # smoke test
PYTHONUNBUFFERED=1 python3 scripts/asia/backfill_courses.py --force     # re-scrape all

# Courses: scrape the PDGA course directory for real Asian courses
# (holes, par, established, course type, coords, country). Two-step: parse the
# embedded Leaflet features from /course-directory, then fetch each per-course
# page. Resumable via data/asia_courses_cache.json. Emits courses-directory.json.
PYTHONUNBUFFERED=1 python3 scripts/asia/scrape_courses_pdga.py --limit 10 # smoke test
PYTHONUNBUFFERED=1 python3 scripts/asia/scrape_courses_pdga.py            # full run

# Courses: merge the PDGA directory (real specs + coords) with the venue-derived
# event history (event_count, winners, top finisher) into a unified courses.json.
# Run after scrape_courses_pdga.py (and ideally after backfill_courses.py).
PYTHONUNBUFFERED=1 python3 scripts/asia/merge_courses.py

# Upcoming events: scrape PDGA's tour search for future Asia-hosted events
PYTHONUNBUFFERED=1 python3 scripts/asia/scrape_upcoming.py
```

Then run the site:

```bash
bun install
bun run dev
# http://localhost:5173
```

Leagues / weeklies / bag-tag series are detected by title and skipped.
