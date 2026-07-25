#!/usr/bin/env python3
"""Backfill the PDGA "Course" field onto cached events + event detail JSONs.

Resumable + rate-limited (reuses asia_archive.pdga_get). For each event that
doesn't yet have a `course`, fetch its PDGA event page, extract the course
name + /course/<id> link, and write the result back to:

  - data/asia/asia_events_cache.json   (so asia_archive.py picks it up on
    the next aggregate run)
  - src/data/asia/events/<event_id>.json (so build_courses.py can group by
    real course without a full re-scrape)

Usage:
  python3 scripts/asia/backfill_courses.py            # backfill missing only
  python3 scripts/asia/backfill_courses.py --force     # re-scrape all
  python3 scripts/asia/backfill_courses.py --limit 20  # smoke test
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))
from asia_archive import pdga_get  # noqa: E402  (shared polite HTTP layer)

from bs4 import BeautifulSoup

DATA_DIR = SCRIPT_DIR / "data"
SITE_DATA = SCRIPT_DIR.parent.parent / "src" / "data" / "asia"
EVENTS_CACHE = DATA_DIR / "asia_events_cache.json"
EVENT_DETAIL_DIR = SITE_DATA / "events"


def extract_course(soup: BeautifulSoup) -> tuple[str, str, str]:
    """Return (course, course_url, course_id) from an event page."""
    sidebar = soup.find("div", class_=re.compile(r"pane-pdga-event-info|event-info|sidebar"))
    body_text = (sidebar or soup).get_text("\n", strip=True)
    course = ""
    m = re.search(r"Course\s*:?\s*\n?\s*([^\n]+)", body_text)
    if m:
        course = m.group(1).strip()
    course_url = ""
    course_id = ""
    search_root = sidebar or soup
    for a in search_root.find_all("a", href=True):
        href = a["href"]
        cm = re.search(r"/course/(\d+)", href)
        if cm:
            course_id = cm.group(1)
            course_url = href if href.startswith("http") else f"https://www.pdga.com{href}"
            if a.get_text(strip=True):
                course = a.get_text(strip=True)
            break
    return course, course_url, course_id


def load_cache() -> dict:
    if not EVENTS_CACHE.exists():
        raise SystemExit(f"missing cache: {EVENTS_CACHE}")
    return json.loads(EVENTS_CACHE.read_text())


def save_cache(cache: dict) -> None:
    EVENTS_CACHE.write_text(json.dumps(cache, indent=2))


def update_detail(event_id: str, course: str, course_url: str, course_id: str) -> bool:
    path = EVENT_DETAIL_DIR / f"{event_id}.json"
    if not path.exists():
        return False
    ev = json.loads(path.read_text())
    ev["course"] = course
    ev["course_url"] = course_url
    ev["course_id"] = course_id
    path.write_text(json.dumps(ev, indent=2))
    return True


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true", help="re-scrape even if course present")
    ap.add_argument("--limit", type=int, default=0, help="stop after N scrapes (0 = no limit)")
    args = ap.parse_args()

    cache = load_cache()
    EVENT_DETAIL_DIR.mkdir(parents=True, exist_ok=True)

    targets = [
        eid for eid, ev in cache.items()
        if args.force or not ev.get("course")
    ]
    print(f"{len(targets)} events to backfill (of {len(cache)} cached). force={args.force}")

    done = 0
    found = 0
    for eid in targets:
        if args.limit and done >= args.limit:
            break
        url = f"https://www.pdga.com/tour/event/{eid}"
        try:
            r = pdga_get(url)
        except Exception as exc:
            print(f"  ! {eid}: request failed ({exc})")
            time.sleep(1)
            continue
        if r.status_code != 200:
            print(f"  ! {eid}: HTTP {r.status_code}")
            continue
        soup = BeautifulSoup(r.text, "html.parser")
        course, course_url, course_id = extract_course(soup)
        cache[eid]["course"] = course
        cache[eid]["course_url"] = course_url
        cache[eid]["course_id"] = course_id
        update_detail(eid, course, course_url, course_id)
        done += 1
        if course:
            found += 1
        if done % 25 == 0:
            save_cache(cache)
            print(f"  … {done}/{len(targets)} scraped, {found} with course")
        time.sleep(0.1)

    save_cache(cache)
    print(f"Done. {done} scraped, {found} had a course field. Cache saved.")


if __name__ == "__main__":
    main()
