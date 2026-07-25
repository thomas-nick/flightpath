#!/usr/bin/env python3
"""Build src/data/asia/courses.json from event detail JSONs.

Provisional venue model: every event's `location` is "City, ... , Country".
We group events by (city, country_key) into a "venue" course and aggregate
event counts, year span, distinct winners, and the top finisher (most wins
at the venue). Upcoming events are matched by the same (city, country_key)
key and attached as `upcoming_event_ids`.

When the scraper later captures a real PDGA "Course" field per event
(see backfill_courses.py), this script can be extended to group by real
course name / course_id instead. Until then, courses are flagged
`provisional: true` and named after the host city.
"""

from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
SITE_DATA = SCRIPT_DIR.parent.parent / "src" / "data" / "asia"
EVENT_DETAIL_DIR = SITE_DATA / "events"
UPCOMING_FILE = SITE_DATA / "upcoming-events.json"
BOARD_FILE = SITE_DATA / "board.json"
OUT_FILE = SITE_DATA / "courses.json"


def load_country_meta() -> dict[str, dict]:
    """country_key -> {name, flag} from board.json (authoritative host names)."""
    meta: dict[str, dict] = {}
    if not BOARD_FILE.exists():
        return meta
    try:
        board = json.loads(BOARD_FILE.read_text())
    except Exception:
        return meta
    for c in board.get("countries", []) or []:
        key = (c.get("key") or "").upper()
        if key:
            meta[key] = {"name": c.get("name", ""), "flag": c.get("flag", "")}
    for key, c in (board.get("country_stats") or {}).items():
        key = key.upper()
        meta.setdefault(key, {"name": c.get("name", ""), "flag": c.get("flag", "")})
    return meta


def prettify_city(city: str) -> str:
    """Title-case all-caps city names; leave mixed-case names untouched."""
    if not city:
        return ""
    if city.isupper():
        return " ".join(w.capitalize() for w in city.split())
    return city

# Location tail (PDGA event country string) -> ISO-2 key. Mirrors asia-countries.ts.
LOCATION_TO_KEY = {
    "japan": "JP", "thailand": "TH", "china": "CN", "south korea": "KR",
    "korea": "KR", "malaysia": "MY", "singapore": "SG", "philippines": "PH",
    "cambodia": "KH", "chinese taipei": "TW", "taiwan": "TW", "vietnam": "VN",
    "hong kong": "HK", "mongolia": "MN", "indonesia": "ID", "laos": "LA",
    "kazakhstan": "KZ", "india": "IN", "russia": "RU",
}


def host_country_key(location: str | None) -> str | None:
    if not location:
        return None
    parts = [p.strip().lower() for p in location.split(",") if p.strip()]
    if not parts:
        return None
    if parts[-1] in LOCATION_TO_KEY:
        return LOCATION_TO_KEY[parts[-1]]
    for name, key in LOCATION_TO_KEY.items():
        if name in parts:
            return key
    return None


def city_of(location: str | None) -> str:
    """Most specific locality: the first comma segment (e.g. 'Hokuto' in
    'Hokuto, Yamanashi, Japan'). Empty when there's no comma."""
    if not location:
        return ""
    parts = [p.strip() for p in location.split(",") if p.strip()]
    if len(parts) < 2:
        return ""
    return parts[0]


def slugify(text: str) -> str:
    base = text.lower()
    base = re.sub(r"[^a-z0-9]+", "-", base).strip("-")
    return base or "venue"


def course_slug(city: str, country_key: str) -> str:
    return f"{slugify(city)}-{country_key.lower()}"


def main() -> None:
    if not EVENT_DETAIL_DIR.exists():
        raise SystemExit(f"missing event dir: {EVENT_DETAIL_DIR}")

    country_meta = load_country_meta()

    # key -> aggregate (key is course_id / name+country / venue slug)
    groups: dict[str, dict] = {}
    # venue slug -> group key (so upcoming events + event-row links resolve)
    venue_to_key: dict[str, str] = {}

    files = sorted(EVENT_DETAIL_DIR.glob("*.json"))
    print(f"Reading {len(files)} event detail files...")

    for path in files:
        try:
            ev = json.loads(path.read_text())
        except Exception:
            continue
        location = ev.get("location", "")
        country_key = host_country_key(location) or ""
        city = city_of(location)
        venue_slug = course_slug(city, country_key) if (city and country_key) else ""

        course = (ev.get("course") or "").strip()
        course_id = (ev.get("course_id") or "").strip()
        course_url = ev.get("course_url") or ""

        if course_id:
            key = f"id:{course_id}"
            slug = f"{slugify(course)}-{course_id}" if course else f"course-{course_id}"
            name = course or city or f"Course {course_id}"
            provisional = False
        elif course:
            key = f"name:{country_key}:{slugify(course)}"
            slug = f"{slugify(course)}-{country_key.lower()}"
            name = course
            provisional = False
        else:
            if not venue_slug:
                continue  # can't derive a venue
            key = f"venue:{venue_slug}"
            slug = venue_slug
            name = prettify_city(city)
            provisional = True

        g = groups.get(key)
        if g is None:
            g = {
                "slug": slug,
                "name": name,
                "city": prettify_city(city),
                "country_key": country_key,
                "course_id": course_id,
                "course_url": course_url,
                "event_ids": [],
                "first_year": None,
                "last_year": None,
                "winners": defaultdict(int),
                "winner_meta": {},
                "venue_aliases": set(),
                "provisional": provisional,
            }
            groups[key] = g

        # keep the most informative name/city once a real course appears
        if not g["course_id"] and course_id:
            g["course_id"] = course_id
            g["course_url"] = course_url
            g["slug"] = slug
            g["name"] = name
            g["provisional"] = False
        if not g["country_key"]:
            g["country_key"] = country_key

        year = str(ev.get("year", "") or "")
        g["event_ids"].append(str(ev.get("event_id", "")))
        if year:
            if g["first_year"] is None or year < g["first_year"]:
                g["first_year"] = year
            if g["last_year"] is None or year > g["last_year"]:
                g["last_year"] = year
        if venue_slug:
            g["venue_aliases"].add(venue_slug)
            venue_to_key.setdefault(venue_slug, key)

        # winners across all divisions (place == 1)
        for div_key in ("mpo", "fpo", "amateur"):
            for row in ev.get(div_key, []) or []:
                place = row.get("place")
                if place != 1:
                    continue
                pdga = row.get("pdga")
                if not pdga:
                    continue
                g["winners"][int(pdga)] += 1
                g["winner_meta"][int(pdga)] = {
                    "name": row.get("name", ""),
                    "flag": row.get("flag", ""),
                    "country": row.get("country", ""),
                    "country_key": row.get("country_key", country_key),
                }

    # attach upcoming events by venue slug (resolved through venue_to_key)
    upcoming_by_key: dict[str, list[str]] = defaultdict(list)
    if UPCOMING_FILE.exists():
        try:
            up = json.loads(UPCOMING_FILE.read_text())
            for e in up.get("events", []) or []:
                u_city = city_of(e.get("location", ""))
                u_key = (e.get("country_key") or host_country_key(e.get("location")) or "").upper()
                if not u_city or not u_key:
                    continue
                vslug = course_slug(u_city, u_key)
                key = venue_to_key.get(vslug) or f"venue:{vslug}"
                eid = e.get("event_id")
                if eid:
                    upcoming_by_key[key].append(str(eid))
        except Exception as exc:
            print(f"warn: could not read upcoming-events.json: {exc}")

    out = []
    for key, g in groups.items():
        country = country_meta.get(g["country_key"], {})
        winners = g["winners"]
        distinct = len(winners)
        top_pdga = None
        top_wins = 0
        for pdga, w in winners.items():
            if w > top_wins or (w == top_wins and top_pdga is None):
                top_wins = w
                top_pdga = pdga
        top_finisher = None
        if top_pdga is not None:
            meta = g["winner_meta"].get(top_pdga, {})
            top_finisher = {
                "pdga": top_pdga,
                "name": meta.get("name", ""),
                "slug": "",  # filled by TS accessor (playerDisplayName + slugify)
                "flag": meta.get("flag", ""),
                "country": meta.get("country", ""),
                "country_key": meta.get("country_key", g["country_key"]),
                "wins": top_wins,
            }
        # venue aliases: drop the course's own slug if it coincides with a venue
        aliases = sorted(a for a in g["venue_aliases"] if a != g["slug"])
        out.append({
            "slug": g["slug"],
            "name": g["name"],
            "city": g["city"],
            "country_key": g["country_key"],
            "country": country.get("name", ""),
            "flag": country.get("flag", ""),
            "course_id": g["course_id"],
            "course_url": g["course_url"],
            "event_count": len(g["event_ids"]),
            "first_year": g["first_year"],
            "last_year": g["last_year"],
            "event_ids": g["event_ids"],
            "upcoming_event_ids": upcoming_by_key.get(key, []),
            "distinct_winners": distinct,
            "top_finisher": top_finisher,
            "aliases": aliases,
            "provisional": g["provisional"],
        })

    out.sort(key=lambda c: (-c["event_count"], c["name"], c["country_key"]))

    any_provisional = any(c["provisional"] for c in out)
    payload = {
        "updated_at": None,
        "provisional": any_provisional,
        "note": (
            "Venue-derived from event locations. Run scripts/asia/backfill_courses.py "
            "then scripts/asia/build_courses.py to upgrade to real PDGA course names/IDs."
            if any_provisional
            else "Grouped by real PDGA course names/IDs via backfill_courses.py."
        ),
        "courses": out,
    }
    from datetime import datetime, timezone
    payload["updated_at"] = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    OUT_FILE.write_text(json.dumps(payload, indent=2))
    print(f"Wrote {OUT_FILE} ({len(out)} courses)")
    top = out[:10]
    print("Top venues:")
    for c in top:
        print(f"  {c['event_count']:>3}  {c['flag']} {c['name']}, {c['country']} ({c['slug']})")


if __name__ == "__main__":
    main()
