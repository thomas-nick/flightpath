#!/usr/bin/env python3
"""Upcoming-events scraper for Flightpath Asia.

Queries the PDGA tournament search per Asian country and writes
`upcoming-events.json` consumed by the site (landing rail, events page,
country hubs).

Approach:
  1. For each Asian country with a PDGA search checkbox, GET
     /tour/search?Country[]=CountryName&date_filter[min][date]=today&...
  2. Parse the results table (Name, Tier, Location, Dates) — one request
     per country, no per-event fetches needed.
  3. Walk pagination until a page yields no rows.
  4. Normalize dates ("August 8 - 9, 2026" → ISO start/end).
  5. Tag is_asia_tour from the title; assign country_key from the query.
  6. Sort by start_date; write src/data/asia/upcoming-events.json.

Usage:
  python3 scrape_upcoming.py                 # write JSON
  python3 scrape_upcoming.py --dry-run       # print, don't write
  python3 scrape_upcoming.py --verbose       # print parsed rows
  python3 scrape_upcoming.py --days 540      # date window (default)
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests
from bs4 import BeautifulSoup

SCRIPT_DIR = Path(__file__).resolve().parent
APP_ROOT = SCRIPT_DIR.parent.parent
SITE_DATA = APP_ROOT / "src" / "data" / "asia"
OUT_FILE = SITE_DATA / "upcoming-events.json"

UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)
SESSION = requests.Session()
SESSION.headers.update({"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9"})

RETRY_DELAYS = (2, 5, 10)
PDGA_DELAY = 1.2
_LAST_CALL = [0.0]

# Asian country keys → exact PDGA search form values (capitalized names)
COUNTRY_QUERIES = {
    "JP": "Japan",
    "TH": "Thailand",
    "CN": "China",
    "KR": "South Korea",
    "MY": "Malaysia",
    "SG": "Singapore",
    "PH": "Philippines",
    "KH": "Cambodia",
    "TW": "Chinese Taipei",
    "VN": "Vietnam",
    "MN": "Mongolia",
    "IN": "India",
}

MONTHS = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}


def pdga_get(url: str, params: dict | None = None) -> requests.Response:
    last_exc = None
    for wait in (0,) + RETRY_DELAYS:
        if wait:
            time.sleep(wait)
        elapsed = time.monotonic() - _LAST_CALL[0]
        if elapsed < PDGA_DELAY:
            time.sleep(PDGA_DELAY - elapsed)
        _LAST_CALL[0] = time.monotonic()
        try:
            r = SESSION.get(url, params=params, timeout=30)
            if r.status_code in (403, 429, 502, 503):
                last_exc = requests.HTTPError(f"{r.status_code} for {r.url}")
                continue
            r.raise_for_status()
            return r
        except requests.RequestException as exc:
            last_exc = exc
            continue
    raise last_exc if last_exc else RuntimeError("pdga_get failed")


def iso(day: str, mon: str, year: str) -> str:
    mo = MONTHS.get(mon.lower()[:3])
    if not mo:
        return ""
    return f"{int(year):04d}-{mo:02d}-{int(day):02d}"


def parse_search_date(text: str) -> tuple[str | None, str | None]:
    """Parse 'August 8 - 9, 2026' or 'August 29 - September 1, 2026' or 'August 8, 2026'."""
    text = (text or "").strip()
    if not text:
        return None, None
    # Cross-month range: "August 29 - September 1, 2026"
    m = re.search(r"([A-Za-z]+)\s+(\d{1,2})\s*[-–]\s*([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})", text)
    if m:
        mon1, d1, mon2, d2, y = m.groups()
        return iso(d1, mon1, y), iso(d2, mon2, y)
    # Same-month range: "August 8 - 9, 2026"
    m = re.search(r"([A-Za-z]+)\s+(\d{1,2})\s*[-–]\s+(\d{1,2}),?\s+(\d{4})", text)
    if m:
        mon, d1, d2, y = m.groups()
        return iso(d1, mon, y), iso(d2, mon, y)
    # Single day: "August 8, 2026"
    m = re.search(r"([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})", text)
    if m:
        mon, d, y = m.groups()
        s = iso(d, mon, y)
        return s, s
    return None, None


def parse_search_results(html: str, verbose: bool = False) -> list[dict]:
    """Parse the PDGA search results table for event rows."""
    soup = BeautifulSoup(html, "html.parser")
    table = soup.find("table")
    if not table:
        return []
    rows: list[dict] = []
    for tr in table.find_all("tr")[1:]:  # skip header row
        cells = tr.find_all("td")
        if len(cells) < 8:
            continue
        a = cells[0].find("a", href=re.compile(r"/tour/event/\d+"))
        if not a:
            continue
        m = re.search(r"/tour/event/(\d+)", a["href"])
        if not m:
            continue
        eid = m.group(1)
        title = a.get_text(strip=True)
        tier = cells[3].get_text(strip=True)
        location = cells[6].get_text(" ", strip=True)
        date_text = cells[7].get_text(" ", strip=True)
        s_iso, e_iso = parse_search_date(date_text)
        row = {
            "event_id": eid,
            "title": title,
            "tier": tier,
            "location": location,
            "dates": date_text,
            "start_date": s_iso or "",
            "end_date": e_iso or "",
            "url": f"https://www.pdga.com/tour/event/{eid}",
        }
        if verbose:
            print(f"    {row}")
        rows.append(row)
    return rows


def scrape_country(country_key: str, country_name: str, days: int, verbose: bool = False) -> list[dict]:
    today = datetime.now(timezone.utc).date()
    date_from = today.isoformat()
    date_to = (today + timedelta(days=days)).isoformat()
    all_rows: list[dict] = []
    for page in range(0, 20):
        params = {
            "Country[]": country_name,
            "date_filter[min][date]": date_from,
            "date_filter[max][date]": date_to,
            "page": page,
        }
        try:
            r = pdga_get("https://www.pdga.com/tour/search", params=params)
        except Exception as exc:  # noqa: BLE001
            print(f"  {country_name} page {page} fetch failed: {exc}", file=sys.stderr)
            break
        rows = parse_search_results(r.text, verbose=verbose)
        if not rows:
            break
        for row in rows:
            row["country_key"] = country_key
            row["is_asia_tour"] = bool(re.search(r"pdga\s+asia\s+tour", row["title"], re.I))
            row["level"] = "Asia Tour" if row["is_asia_tour"] else "Tournament"
        all_rows.extend(rows)
        print(f"  {country_name} page {page}: {len(rows)} events")
        if len(rows) < 25:  # last page
            break
    return all_rows


def scrape(verbose: bool = False, days: int = 540) -> list[dict]:
    seen: set[str] = set()
    all_events: list[dict] = []
    for key, name in COUNTRY_QUERIES.items():
        print(f"Querying {name} ({key})…")
        rows = scrape_country(key, name, days=days, verbose=verbose)
        for row in rows:
            if not row["start_date"]:
                continue
            if row["event_id"] in seen:
                continue
            seen.add(row["event_id"])
            all_events.append(row)
    all_events.sort(key=lambda r: r["start_date"])
    return all_events


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=540)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--verbose", action="store_true")
    args = ap.parse_args()

    print("Scraping PDGA upcoming Asia events (per-country search)…")
    events = scrape(verbose=args.verbose, days=args.days)
    print(f"Found {len(events)} upcoming Asia events.")

    out = {
        "updated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "seeded": False,
        "events": events,
    }
    if args.dry_run:
        print(json.dumps(out, indent=2)[:4000])
        print("  (dry-run — not writing)")
        return 0

    SITE_DATA.mkdir(parents=True, exist_ok=True)
    OUT_FILE.write_text(json.dumps(out, indent=2))
    print(f"Wrote {OUT_FILE} ({len(events)} events)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

