#!/usr/bin/env python3
"""Merge the PDGA course directory with the venue-derived event history.

Base = real courses from courses-directory.json (PDGA directory: specs, coords,
country, region). Enriched with event history from courses.json (venue-derived:
event_count, event_ids, distinct_winners, top_finisher, upcoming_event_ids)
matched by country + name similarity.

Emits a unified src/data/asia/courses.json (overwriting the provisional
venue-derived one). Each course carries:
  - real identity: slug (PDGA), name, lat, lon, holes, par, established,
    course_type, country, region, address, pdga_url
  - event history (when a venue match was found): event_count, event_ids,
    distinct_winners, top_finisher, upcoming_event_ids
  - aliases: venue slugs (city-countrykey) so event-row links that derive a
    venue slug still resolve to this real course
  - provisional: false

Usage:
  python3 scripts/asia/merge_courses.py
"""

from __future__ import annotations

import json
import re
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
SITE_DATA = SCRIPT_DIR.parent.parent / "src" / "data" / "asia"
DIRECTORY_FILE = SITE_DATA / "courses-directory.json"
VENUE_FILE = SITE_DATA / "courses.json"  # provisional, venue-derived
OUT_FILE = SITE_DATA / "courses.json"


def tokens(s: str) -> set[str]:
    return set(re.findall(r"[a-z0-9]+", (s or "").lower()))


def name_similarity(a: str, b: str) -> float:
    ta, tb = tokens(a), tokens(b)
    if not ta or not tb:
        return 0.0
    inter = ta & tb
    union = ta | tb
    return len(inter) / len(union)  # Jaccard


def main() -> None:
    if not DIRECTORY_FILE.exists():
        raise SystemExit(f"missing {DIRECTORY_FILE} — run scrape_courses_pdga.py first")
    directory = json.loads(DIRECTORY_FILE.read_text())
    venues = {}
    if VENUE_FILE.exists():
        venues = {c["slug"]: c for c in json.loads(VENUE_FILE.read_text()).get("courses", [])}

    # index venue courses by country for fast matching
    by_country: dict[str, list[dict]] = {}
    for v in venues.values():
        by_country.setdefault(v.get("country_key", ""), []).append(v)

    out = []
    matched = 0
    for dc in directory.get("courses", []):
        country = dc.get("country_key", "")
        best_v = None
        best_score = 0.0
        for v in by_country.get(country, []):
            score = name_similarity(dc.get("name", ""), v.get("name", ""))
            # also consider the venue city vs directory region/address
            score = max(score, name_similarity(dc.get("region", ""), v.get("city", "")))
            if score > best_score:
                best_score = score
                best_v = v
        # require a non-trivial match
        if best_v and best_score >= 0.15:
            matched += 1
            event_history = {
                "event_count": best_v.get("event_count", 0),
                "event_ids": best_v.get("event_ids", []),
                "upcoming_event_ids": best_v.get("upcoming_event_ids", []),
                "distinct_winners": best_v.get("distinct_winners", 0),
                "top_finisher": best_v.get("top_finisher"),
                "first_year": best_v.get("first_year"),
                "last_year": best_v.get("last_year"),
                "aliases": [best_v["slug"]] if best_v.get("slug") and best_v["slug"] != dc["slug"] else [],
            }
        else:
            event_history = {
                "event_count": 0,
                "event_ids": [],
                "upcoming_event_ids": [],
                "distinct_winners": 0,
                "top_finisher": None,
                "aliases": [],
            }
        out.append({
            "slug": dc["slug"],
            "name": dc["name"],
            "city": dc.get("region", ""),
            "country_key": country,
            "country": dc.get("country", ""),
            "flag": "",  # filled by TS accessor from country_stats
            "course_id": "",
            "course_url": dc.get("pdga_url", ""),
            "lat": dc.get("lat"),
            "lon": dc.get("lon"),
            "holes": dc.get("holes"),
            "par": dc.get("par"),
            "established": dc.get("established"),
            "course_type": dc.get("course_type", ""),
            "region": dc.get("region", ""),
            "address": dc.get("address", ""),
            "pdga_url": dc.get("pdga_url", ""),
            **event_history,
            "provisional": False,
        })

    out.sort(key=lambda c: (c["country_key"], c["name"].lower()))

    from datetime import datetime, timezone
    payload = {
        "updated_at": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "provisional": False,
        "source": "PDGA course directory + venue-derived event history (merge_courses.py)",
        "count": len(out),
        "courses": out,
    }
    OUT_FILE.write_text(json.dumps(payload, indent=2))
    print(f"Wrote {OUT_FILE} ({len(out)} courses, {matched} matched to event history)")


if __name__ == "__main__":
    main()
