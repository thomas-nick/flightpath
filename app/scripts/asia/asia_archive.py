#!/usr/bin/env python3
"""Asia Disc Golf archive scraper for Flightpath.

PDGA *tournaments only* (leagues / weeklies excluded). Builds a historical
Asia Tour + regional open/amateur archive:

  1. Seed known Asia Tour + major regional event IDs.
  2. Scrape MPO/FPO/MA*/FA* results (cache forever once complete).
  3. Discover more events via player /stats/{year} pages across the archive window.
  4. Keep only events hosted in Asian countries (location match).
  5. Aggregate players with class_bucket splits + write board/profile JSON.

Outputs (Flightpath site data):
  - scripts/asia/data/*.json caches
  - src/data/asia/board.json
  - src/data/asia/players/{pdga}.json
  - src/data/asia/events/{event_id}.json

Flags:
  --from=2010 --to=2026   archive year window (default 2010–current)
  --refresh-results       re-scrape cached event HTML
  --discover --enrich     walk player careers for new Asia event IDs
"""

from __future__ import annotations

import json
import re
import sys
import time
import threading
from dataclasses import dataclass, asdict, field
from datetime import datetime, timezone
from pathlib import Path

import requests
from bs4 import BeautifulSoup

SCRIPT_DIR = Path(__file__).resolve().parent
APP_ROOT = SCRIPT_DIR.parent.parent  # flightpath/app
DATA_DIR = SCRIPT_DIR / "data"
EVENTS_CACHE = DATA_DIR / "asia_events_cache.json"
PROFILES_CACHE = DATA_DIR / "asia_profiles_cache.json"
RESULTS_CACHE = DATA_DIR / "asia_results_cache.json"
RATING_HISTORY_CACHE = DATA_DIR / "asia_rating_history_cache.json"
DISCOVER_PROGRESS = DATA_DIR / "asia_discover_progress.json"
OUTPUT_FILE = DATA_DIR / "asia_players.json"
SITE_DATA = APP_ROOT / "src" / "data" / "asia"
EVENT_DETAIL_DIR = SITE_DATA / "events"
PLAYER_PROFILE_DIR = SITE_DATA / "players"
BOARD_FILE = SITE_DATA / "board.json"

# Leagues / bag-tag / weekly series — excluded from the tournament archive
LEAGUE_TITLE_RE = re.compile(
    r"\b("
    r"league|weekly|weeklies|bag\s*tag|tags?\s*league|"
    r"club\s*night|tuesday\s*night|wednesday\s*night|"
    r"singles?\s*league|doubles?\s*league|putt(ing)?\s*league|"
    r"winter\s*league|summer\s*league|spring\s*league|fall\s*league|"
    r"flex\s*start\s*league"
    r")\b",
    re.I,
)


def is_league_event(title: str, event_type: str = "") -> bool:
    blob = f"{title or ''} {event_type or ''}"
    return bool(LEAGUE_TITLE_RE.search(blob))


def include_division(code: str) -> bool:
    """MPO, FPO, and amateur open codes (MA*/FA*). Juniors excluded by default."""
    c = (code or "").upper().strip()
    if c in {"MPO", "FPO"}:
        return True
    return bool(re.match(r"^(MA|FA)\d", c))


def class_bucket(code: str) -> str:
    c = (code or "").upper().strip()
    if c == "MPO":
        return "open_mpo"
    if c == "FPO":
        return "open_fpo"
    if re.match(r"^MA|^FA", c):
        return "amateur"
    return "other"


def empty_class_stats() -> dict:
    return {
        "events": 0,
        "wins": 0,
        "podiums": 0,
        "top5": 0,
        "top10": 0,
        "top20": 0,
        "pdga_points": 0.0,
        "tour_weighted_points": 0.0,
        "places": [],
    }

HISTORICAL_START = 2010
HISTORICAL_END = datetime.now(timezone.utc).year
# Full archive years kept in the board (always aggregate the whole window).
YEARS: tuple[str, ...] = tuple(
    str(y) for y in range(HISTORICAL_START, HISTORICAL_END + 1)
)
# Subset used when walking player /stats/{year} during --discover.
DISCOVER_YEARS: tuple[str, ...] = YEARS


def parse_year_window(args: list[str]) -> tuple[str, ...]:
    """Parse --from=YYYY --to=YYYY for discovery walks (default full archive)."""
    start, end = HISTORICAL_START, HISTORICAL_END
    for a in args:
        if a.startswith("--from="):
            start = int(a.split("=", 1)[1])
        elif a.startswith("--to="):
            end = int(a.split("=", 1)[1])
    if start > end:
        start, end = end, start
    start = max(HISTORICAL_START, start)
    end = min(HISTORICAL_END, end)
    return tuple(str(y) for y in range(start, end + 1))

# Official 2026 PDGA Asia Tour event IDs (from https://www.pdga.com/asiatour)
SEED_EVENTS_2026_TOUR = [
    "96943",  # Asia Disc Golf Open (Chinese Taipei)
    "96727",  # Siam Open (Thailand)
    "95859",  # Samui Swine Classic XIII Pros (Thailand)
    "97037",  # Chiang Mai Open IV (Thailand)
    "97272",  # Lipad Pilipinas IV (Philippines)
    "97704",  # 14th Okinawa Open (Japan)
    "97588",  # Asia Tour Championship (China)
]

# Additional 2025 + 2026 Asian PDGA events (discovered via partial cache).
# Keep growing this list as we find more — the scraper auto-skips non-Asian ones.
SEED_EVENTS_EXTRA = [
    # 2025 Japan Open series
    "87628",  # 13th Okinawa Open
    "88891",  # 24th Chubu Open
    "89761",  # 22nd Saga Yoshinogari Open
    "90538",  # 32nd Tokyo Open
    "91149",  # 9th Fukui Open
    "93189",  # 14th Hokkaido Open
    "92377",  # 27th Nippon Open
    "94669",  # 28th Kansai Open
    "94274",  # 37th National Championships (Japan)
    "96591",  # 4th Maiko Classic
    "93358",  # 4th Disc Golf Japan Series
    "96928",  # 39th Kyushu Open
    # 2025 Thailand
    "84698",  # Samui Swine Classic XII
    "95658",  # Coco-breeze 3
    "96436",  # Trat Disc Golf Open 2025
    "96352",  # Hyzerween VII
    # 2026 Thailand
    "95844",  # Samui Swine XIII Ams
    "99712",  # King of Island v.4
    "99672",  # City of Trat
    "99236",  # Yasothon Valentine Classic
    "97979",  # Samui Winter Warm Up
    "99301",  # 11th Hyzenbrownie Open
    "99715",  # Koh Kood Open
    "103055", # Coco Splash
    # 2026 Vietnam / Cambodia / Philippines
    "99899",  # Saigon Open
    "101735", # Freedom Flight Open
    "102225", # 2026 Cavite Invitational (PH)
    "104201", # ONE USM Tournament + WGE (PH)
    # 2026 Japan
    "102712", # 1st Shibukawa Open
]

ALL_SEED_EVENTS = SEED_EVENTS_2026_TOUR + SEED_EVENTS_EXTRA

ASIA_COUNTRIES = {
    "thailand": ("TH", "🇹🇭", "Thailand"),
    "philippines": ("PH", "🇵🇭", "Philippines"),
    "japan": ("JP", "🇯🇵", "Japan"),
    "south korea": ("KR", "🇰🇷", "South Korea"),
    "singapore": ("SG", "🇸🇬", "Singapore"),
    "malaysia": ("MY", "🇲🇾", "Malaysia"),
    "indonesia": ("ID", "🇮🇩", "Indonesia"),
    "vietnam": ("VN", "🇻🇳", "Vietnam"),
    "chinese taipei": ("TW", "🇹🇼", "Chinese Taipei"),
    "taiwan": ("TW", "🇹🇼", "Chinese Taipei"),
    "china": ("CN", "🇨🇳", "China"),
    "mongolia": ("MN", "🇲🇳", "Mongolia"),
    "russia": ("RU", "🇷🇺", "Russia"),
    "hong kong": ("HK", "🇭🇰", "Hong Kong"),
    "cambodia": ("KH", "🇰🇭", "Cambodia"),
    "india": ("IN", "🇮🇳", "India"),
    "laos": ("LA", "🇱🇦", "Laos"),
    "brunei": ("BN", "🇧🇳", "Brunei"),
    "macau": ("MO", "🇲🇴", "Macau"),
    "myanmar": ("MM", "🇲🇲", "Myanmar"),
    "kazakhstan": ("KZ", "🇰🇿", "Kazakhstan"),
}

# Map PDGA 2-letter country codes (from /players?Country=XX) to tuples.
COUNTRY_BY_CODE = {key: (key, flag, name) for (key, flag, name) in ASIA_COUNTRIES.values()}

COUNTRY_LIST = sorted(
    {v for v in ASIA_COUNTRIES.values()},
    key=lambda x: x[2],
)

# Custom weighted scoring (mirror /players model, adapted for Asian tier mix)
TOUR_LEVELS = ("major", "elite", "asia_tour", "a_tier", "b_tier", "c_tier")
TIER_MULTIPLIERS = {
    "major": 4.0,
    "elite": 2.5,
    "asia_tour": 2.0,
    "a_tier": 1.0,
    "b_tier": 0.5,
    "c_tier": 0.2,
}


def finish_base_points(place: int) -> int:
    if place == 1:
        return 100
    if place == 2:
        return 75
    if place == 3:
        return 55
    if place <= 5:
        return 35
    if place <= 10:
        return 20
    if place <= 25:
        return 8
    return 3


def weighted_finish_points(place: int, level: str) -> float:
    mult = TIER_MULTIPLIERS.get(level, 0.0)
    if mult == 0:
        return 0.0
    return round(finish_base_points(place) * mult, 1)


# Official PDGA Asia Tour scoring per https://www.pdga.com/asiatour
#   1st=100, 2nd=90, 3rd=85, 4th=80, 5th=75, 6th=70, ...19th=5
ASIA_TOUR_POINTS = {
    1: 100, 2: 90, 3: 85, 4: 80, 5: 75, 6: 70, 7: 65, 8: 60, 9: 55, 10: 50,
    11: 45, 12: 40, 13: 35, 14: 30, 15: 25, 16: 20, 17: 15, 18: 10, 19: 5,
}
ASIA_TOUR_MIN_EVENTS = 2  # must play this many to qualify
ASIA_TOUR_COUNT_BEST = 4  # only best N events count toward final total


# ---------- HTTP plumbing ----------

SESSION = requests.Session()
SESSION.headers.update(
    {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 "
            "(KHTML, like Gecko) Version/17.5 Safari/605.1.15"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    }
)
PDGA_DELAY = 1.6
RETRY_DELAYS = (8, 25, 90, 240)
_RATE_LOCK = threading.Lock()
_LAST_CALL = [0.0]


def pdga_get(url: str, params: dict | None = None) -> requests.Response:
    last_exc: Exception | None = None
    for wait in (0,) + RETRY_DELAYS:
        if wait:
            time.sleep(wait)
        try:
            with _RATE_LOCK:
                elapsed = time.monotonic() - _LAST_CALL[0]
                if elapsed < PDGA_DELAY:
                    time.sleep(PDGA_DELAY - elapsed)
                _LAST_CALL[0] = time.monotonic()
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


def load_cache(path: Path) -> dict:
    return json.loads(path.read_text()) if path.exists() else {}


def save_cache(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, indent=2))


# ---------- event scraping ----------

DATE_TAIL = re.compile(r"(\d{4})\s*$")


def parse_event_year(date_text: str) -> str:
    m = DATE_TAIL.search(date_text)
    return m.group(1) if m else ""


def parse_event_country(location: str) -> tuple[str, str, str] | None:
    """Match Asia host country from a PDGA location string.

    Prefer the last comma segment (usually the country). Avoid naive substring
    matches — 'Indiana' must not match 'India'.
    """
    if not location:
        return None
    parts = [p.strip().lower() for p in location.split(",") if p.strip()]
    if not parts:
        return None
    tail = parts[-1]
    # Normalize common PDGA tails
    if tail in {"usa", "us", "u.s.", "u.s.a.", "united states of america"}:
        tail = "united states"
    if tail in ASIA_COUNTRIES:
        return ASIA_COUNTRIES[tail]
    # Exact segment match only (city/state/country tokens), longest key first
    # so 'chinese taipei' wins over shorter collisions.
    for key in sorted(ASIA_COUNTRIES.keys(), key=len, reverse=True):
        if key in parts:
            return ASIA_COUNTRIES[key]
    return None


def classify_event_tier(tier: str, name: str, is_asia_tour: bool) -> str:
    lower = (name or "").lower()
    if tier == "M" or "world championship" in lower or "champions cup" in lower:
        return "major"
    if tier == "NT" or "dgpt" in lower:
        return "elite"
    if is_asia_tour or "pdga asia tour" in lower:
        return "asia_tour"
    if tier == "A":
        return "a_tier"
    if tier == "B":
        return "b_tier"
    return "c_tier"


def scrape_event(event_id: str) -> dict:
    """Scrape an event page; return meta + MPO/FPO/MA*/FA* results."""
    r = pdga_get(f"https://www.pdga.com/tour/event/{event_id}")
    soup = BeautifulSoup(r.text, "html.parser")

    title_el = soup.find("h1")
    title = title_el.get_text(strip=True) if title_el else f"Event {event_id}"

    # event info
    info_table = soup.find("table")
    status = ""
    total_players = 0
    if info_table:
        info_headers = [th.get_text(strip=True) for th in info_table.find_all("th")]
        info_cells = info_table.find_all("td")
        info_map = {h: c.get_text(" ", strip=True) for h, c in zip(info_headers, info_cells)}
        status = info_map.get("Status", "")
        try:
            total_players = int(re.sub(r"[^0-9]", "", info_map.get("Total Players", "0")) or "0")
        except ValueError:
            total_players = 0

    # location + dates — the labels and values are in separate nodes, so
    # walk the rendered text of the sidebar pane instead.
    location = ""
    date_text = ""
    sidebar = soup.find("div", class_=re.compile(r"pane-pdga-event-info|event-info|sidebar"))
    body_text = (sidebar or soup).get_text("\n", strip=True)
    loc_match = re.search(r"Location\s*:?\s*\n?\s*([^\n]+)", body_text)
    if loc_match:
        location = loc_match.group(1).strip()
    date_match = re.search(r"(?:Dates?)\s*:?\s*\n?\s*([^\n]+)", body_text)
    if date_match:
        date_text = date_match.group(1).strip()
    year = parse_event_year(date_text)

    # course — PDGA event sidebar has a "Course" field, often linked to
    # /course/<id>. Capture name + url + id so courses.json can later group
    # events by real course instead of by host city.
    course = ""
    course_url = ""
    course_id = ""
    course_match = re.search(r"Course\s*:?\s*\n?\s*([^\n]+)", body_text)
    if course_match:
        course = course_match.group(1).strip()
    course_link = None
    search_root = sidebar or soup
    for a in search_root.find_all("a", href=True):
        href = a["href"]
        m = re.search(r"/course/(\d+)", href)
        if m:
            course_link = a
            course_id = m.group(1)
            course_url = href if href.startswith("http") else f"https://www.pdga.com{href}"
            break
    if course_link and course_link.get_text(strip=True):
        course = course_link.get_text(strip=True)
    if course and not course_url and re.search(r"/course/(\d+)", course):
        # course text itself embeds a course id — leave url empty
        pass

    # tier from sidebar (e.g. "Pro/Am B-Tier")
    tier_letter = ""
    for h in soup.find_all(["h2", "h3", "h4"]):
        txt = h.get_text(strip=True)
        m = re.search(r"([A-Z])-Tier", txt)
        if m:
            tier_letter = m.group(1)
            break

    is_asia_tour = bool(re.search(r"pdga\s+asia\s+tour", title.lower()))
    level = classify_event_tier(tier_letter, title, is_asia_tour)
    event_type = ""
    type_match = re.search(r"(?:Tournament|Event)\s*Type\s*:?\s*\n?\s*([^\n]+)", body_text, re.I)
    if type_match:
        event_type = type_match.group(1).strip()
    league = is_league_event(title, event_type)

    # results — MPO, FPO, and MA*/FA* amateur
    results = []
    for heading_el in soup.find_all(["h3", "h4"]):
        heading = heading_el.get_text(strip=True)
        div_match = re.match(r"^([A-Z]+\d*)\s*·", heading)
        if not div_match:
            continue
        division = div_match.group(1)
        if not include_division(division):
            continue
        table = heading_el.find_next("table")
        if not table:
            continue
        headers = [th.get_text(strip=True) for th in table.find_all("th")]
        col = {h: i for i, h in enumerate(headers)}
        if "Place" not in col:
            continue
        for tr in table.find_all("tr")[1:]:
            cells = tr.find_all("td")
            if not cells or len(cells) < 4:
                continue

            def cell(name: str) -> str:
                idx = col.get(name)
                if idx is None or idx >= len(cells):
                    return ""
                return cells[idx].get_text(" ", strip=True)

            place_text = cell("Place")
            try:
                place = int(re.sub(r"[^0-9]", "", place_text))
            except (ValueError, TypeError):
                continue
            try:
                pdga_pts = float(cell("Points") or "0")
            except ValueError:
                pdga_pts = 0.0
            name = cell("Name")
            pdga_text = cell("PDGA#")
            try:
                pdga_num = int(re.sub(r"[^0-9]", "", pdga_text))
            except (ValueError, TypeError):
                continue
            rating_text = cell("Rating")
            try:
                rating = int(rating_text) if rating_text.isdigit() else None
            except ValueError:
                rating = None
            prize_text = cell("Prize (USD)") or cell("Prize")
            bucket = class_bucket(division)

            results.append(
                {
                    "pdga": pdga_num,
                    "name": name,
                    "division": division,
                    "class_bucket": bucket,
                    "place": place,
                    "pdga_points": pdga_pts,
                    "rating": rating,
                    "prize": prize_text,
                    "weighted_points": weighted_finish_points(place, level),
                }
            )

    return {
        "event_id": event_id,
        "title": title,
        "location": location,
        "dates": date_text,
        "year": year,
        "tier": tier_letter,
        "level": level,
        "is_asia_tour": is_asia_tour,
        "status": status,
        "total_players": total_players,
        "event_type": event_type,
        "is_league": league,
        "course": course,
        "course_url": course_url,
        "course_id": course_id,
        "results": [] if league else results,
        "divisions_scraped": sorted({r["division"] for r in results}) if not league else [],
    }


# ---------- player profile scraping ----------


def fetch_player_profile(pdga: int) -> dict:
    """Hit /player/{id} once to get country / classification / rating.

    Strategy:
      1. Find the location <a href="/players?...Country=XX"> link — most reliable.
      2. Fall back to the player-info pane text "Location: <country>".
    """
    r = pdga_get(f"https://www.pdga.com/player/{pdga}")
    soup = BeautifulSoup(r.text, "html.parser")

    name_el = soup.find("h1")
    name = name_el.get_text(strip=True) if name_el else f"PDGA {pdga}"

    pane = soup.find("div", class_=re.compile(r"pane-pdga-player-info|player-info"))
    pane_text = (pane or soup).get_text("\n", strip=True)

    def field(label: str) -> str:
        m = re.search(rf"{re.escape(label)}\s*:?\s*\n?\s*([^\n]+)", pane_text)
        return m.group(1).strip() if m else ""

    location_text = field("Location")
    nationality = field("Nationality")
    classification = field("Classification")
    membership = field("Membership Status")
    rating_text = field("Current Rating")

    # find the country=XX link inside the pane
    country_code = ""
    if pane:
        for a in pane.find_all("a", href=re.compile(r"Country=([A-Z]{2})")):
            m = re.search(r"Country=([A-Z]{2})", a["href"])
            if m:
                country_code = m.group(1)
                break
    if not country_code:
        for a in soup.find_all("a", href=re.compile(r"\?City.*?Country=([A-Z]{2})")):
            m = re.search(r"Country=([A-Z]{2})", a["href"])
            if m:
                country_code = m.group(1)
                break

    flag_info = COUNTRY_BY_CODE.get(country_code)
    if flag_info:
        ckey, flag, cname = flag_info
    else:
        # location text fallback (last comma-separated segment)
        tail = location_text.split(",")[-1].strip().lower() if location_text else ""
        flag_info = ASIA_COUNTRIES.get(tail) or ASIA_COUNTRIES.get(nationality.lower())
        if flag_info:
            ckey, flag, cname = flag_info
        else:
            ckey, flag = "", "🌐"
            cname = location_text.split(",")[-1].strip() if location_text else nationality or "—"

    rating: int | None
    rating_match = re.match(r"(\d{3,4})", rating_text)
    rating = int(rating_match.group(1)) if rating_match else None

    return {
        "pdga": pdga,
        "name": name,
        "country": cname,
        "country_key": ckey,
        "country_code_raw": country_code,
        "flag": flag,
        "nationality": nationality,
        "classification": classification,
        "membership": membership,
        "city": location_text.split(",")[0].strip() if location_text else "",
        "location_raw": location_text,
        "rating": rating,
    }


def fetch_rating_history(pdga: int) -> list[dict]:
    """Return [{date: 'YYYY-MM-DD', rating: int, rounds: int}, ...] sorted oldest→newest."""
    r = pdga_get(f"https://www.pdga.com/player/{pdga}/history")
    soup = BeautifulSoup(r.text, "html.parser")
    out: list[dict] = []
    months = {
        "Jan": "01", "Feb": "02", "Mar": "03", "Apr": "04", "May": "05", "Jun": "06",
        "Jul": "07", "Aug": "08", "Sep": "09", "Oct": "10", "Nov": "11", "Dec": "12",
    }
    for table in soup.find_all("table"):
        headers = [th.get_text(strip=True) for th in table.find_all("th")]
        if "Effective Date" not in headers or "Rating" not in headers:
            continue
        col = {h: i for i, h in enumerate(headers)}
        for tr in table.find_all("tr")[1:]:
            cells = tr.find_all("td")
            if len(cells) < 2:
                continue
            date_txt = cells[col["Effective Date"]].get_text(strip=True)
            m = re.match(r"(\d{1,2})-([A-Za-z]+)-(\d{4})", date_txt)
            if not m:
                continue
            day, mon, year = m.groups()
            iso = f"{year}-{months.get(mon[:3], '00')}-{int(day):02d}"
            rating_txt = cells[col["Rating"]].get_text(strip=True)
            rounds_txt = cells[col["Rounds Used"]].get_text(strip=True) if "Rounds Used" in col else "0"
            try:
                rating = int(rating_txt)
            except ValueError:
                continue
            try:
                rounds = int(rounds_txt)
            except ValueError:
                rounds = 0
            out.append({"date": iso, "rating": rating, "rounds": rounds})
        break
    out.sort(key=lambda x: x["date"])
    # Trim to last ~24 months for sparkline relevance
    return out[-24:] if len(out) > 24 else out


def fetch_player_year_events(pdga: int, year: str) -> list[dict]:
    """Get all event IDs a player participated in for a given year."""
    r = pdga_get(f"https://www.pdga.com/player/{pdga}/stats/{year}")
    soup = BeautifulSoup(r.text, "html.parser")
    out = []
    for table in soup.find_all("table"):
        headers = [th.get_text(strip=True) for th in table.find_all("th")]
        if "Place" not in headers or "Tournament" not in headers:
            continue
        col = {h: i for i, h in enumerate(headers)}
        for tr in table.find_all("tr")[1:]:
            cells = tr.find_all("td")
            if len(cells) < 4:
                continue
            tour_cell = cells[col["Tournament"]]
            link = tour_cell.find("a")
            if not link or not link.get("href"):
                continue
            m = re.search(r"/tour/event/(\d+)", link["href"])
            if not m:
                continue
            out.append(
                {
                    "event_id": m.group(1),
                    "name": tour_cell.get_text(" ", strip=True),
                    "tier": cells[col["Tier"]].get_text(strip=True) if "Tier" in col else "",
                    "dates": cells[col["Dates"]].get_text(" ", strip=True) if "Dates" in col else "",
                    "year": year,
                }
            )
    return out


# ---------- orchestration ----------


def backfill_class_buckets(events_cache: dict) -> dict:
    """Ensure every cached result row has class_bucket (MPO/FPO/amateur)."""
    for ev in events_cache.values():
        for r in ev.get("results") or []:
            if "class_bucket" not in r:
                r["class_bucket"] = class_bucket(r.get("division", ""))
    return events_cache


def scrape_seed_events(
    seed_event_ids: list[str],
    events_cache: dict,
    log=print,
    refresh_results: bool = False,
) -> dict:
    """Scrape every seed event ID, skipping ones not held in Asia or outside 2025-2026."""
    log(f"\nScraping {len(seed_event_ids)} seed events")
    for eid in seed_event_ids:
        cached = events_cache.get(eid)
        if cached and not cached.get("error") and not refresh_results:
            log(f"  · {eid} cached: {cached.get('title','')[:60]}")
            continue
        try:
            ev = scrape_event(eid)
        except Exception as exc:
            log(f"  ✗ {eid}: {exc}")
            events_cache[eid] = {"event_id": eid, "error": str(exc), "results": []}
            continue
        if ev.get("is_league"):
            events_cache[eid] = {**ev, "skipped": True, "skip_reason": "league"}
            log(f"  − {eid} skipped (league): {ev.get('title','')[:55]}")
            continue
        country = parse_event_country(ev.get("location", ""))
        if country is None and not ev.get("is_asia_tour"):
            events_cache[eid] = {**ev, "skipped": True, "skip_reason": "non_asia"}
            log(f"  − {eid} skipped (non-Asia: {ev.get('location','')})")
            continue
        if ev.get("year") not in YEARS:
            events_cache[eid] = {**ev, "skipped": True, "skip_reason": "year"}
            log(f"  − {eid} skipped (year {ev.get('year','?')})")
            continue
        events_cache[eid] = ev
        divs = ", ".join(ev.get("divisions_scraped") or sorted({r["division"] for r in ev["results"]}))
        log(
            f"  ✓ {eid} [{ev['tier'] or '?'}] {ev['title'][:55]}"
            f"{' [Asia Tour]' if ev['is_asia_tour'] else ''} — {len(ev['results'])} rows ({divs})"
        )
    save_cache(EVENTS_CACHE, events_cache)
    return events_cache


def enrich_rating_history(
    aggregated_pdga_ids: list[int],
    history_cache: dict,
    log=print,
) -> dict:
    """Fetch rating history per pro (one PDGA request each)."""
    targets = [p for p in aggregated_pdga_ids if str(p) not in history_cache]
    log(f"\nFetching rating history for {len(targets)} players (cached: {len(history_cache)})")
    for i, pdga in enumerate(targets, 1):
        try:
            history_cache[str(pdga)] = fetch_rating_history(pdga)
        except Exception as exc:
            log(f"  ✗ history {pdga}: {exc}")
            history_cache[str(pdga)] = []
        if i % 25 == 0:
            log(f"  · {i}/{len(targets)} histories — checkpoint")
            save_cache(RATING_HISTORY_CACHE, history_cache)
    save_cache(RATING_HISTORY_CACHE, history_cache)
    return history_cache


def enrich_player_profiles(
    events_cache: dict,
    profiles_cache: dict,
    log=print,
) -> dict:
    """Fetch /player/{id} once per discovered pro to learn country + rating."""
    pros: set[int] = set()
    for ev in events_cache.values():
        if ev.get("skipped"):
            continue
        for row in ev.get("results", []):
            pros.add(row["pdga"])
    needs = [p for p in pros if str(p) not in profiles_cache]
    log(f"\nEnriching {len(needs)} profiles (cached: {len(profiles_cache)})")
    for i, pdga in enumerate(needs, 1):
        try:
            profiles_cache[str(pdga)] = fetch_player_profile(pdga)
        except Exception as exc:
            log(f"  ✗ profile {pdga}: {exc}")
            profiles_cache[str(pdga)] = {"pdga": pdga, "country": "", "country_key": "", "flag": "🌐"}
        if i % 25 == 0:
            log(f"  · {i}/{len(needs)} profiles — checkpoint")
            save_cache(PROFILES_CACHE, profiles_cache)
    save_cache(PROFILES_CACHE, profiles_cache)
    return profiles_cache


def infer_country_from_events(pdga: int, events_cache: dict) -> tuple[str, str, str] | None:
    """Best-effort: pick the country where the player played the most events."""
    from collections import Counter
    counts: Counter = Counter()
    for ev in events_cache.values():
        if ev.get("skipped") or not ev.get("results"):
            continue
        for row in ev["results"]:
            if row["pdga"] == pdga:
                country = parse_event_country(ev.get("location", ""))
                if country:
                    counts[country] += 1
    if not counts:
        return None
    return counts.most_common(1)[0][0]


def discover_window_key() -> str:
    return f"{DISCOVER_YEARS[0]}-{DISCOVER_YEARS[-1]}"


def load_discover_progress() -> dict:
    raw = load_cache(DISCOVER_PROGRESS)
    if raw.get("window") != discover_window_key():
        return {
            "window": discover_window_key(),
            "walked": [],
            "pending_ids": [],
        }
    return {
        "window": discover_window_key(),
        "walked": list(raw.get("walked") or []),
        "pending_ids": list(raw.get("pending_ids") or []),
    }


def save_discover_progress(progress: dict) -> None:
    progress["window"] = discover_window_key()
    progress["updated_at"] = datetime.now(timezone.utc).isoformat()
    save_cache(DISCOVER_PROGRESS, progress)


def discover_new_events(
    events_cache: dict,
    profiles_cache: dict,
    log=print,
    only_asian_residents: bool = True,
) -> dict:
    """Walk cached player profiles to find new Asian event IDs the seed list missed.

    Fetches /player/{id}/stats/{year} for Asian-resident players and adds any new
    event IDs that look Asian. Resume-safe via asia_discover_progress.json.
    Use after --enrich has populated profiles_cache.
    """
    candidates = []
    for pid_str, profile in profiles_cache.items():
        if only_asian_residents and not profile.get("country_key"):
            continue
        candidates.append(int(pid_str))
    candidates.sort()

    progress = load_discover_progress()
    walked = set(int(p) for p in progress.get("walked") or [])
    discovered: set[str] = set(str(x) for x in (progress.get("pending_ids") or []))
    remaining = [p for p in candidates if p not in walked]

    log(
        f"\nDiscovering events from {len(candidates)} cached profiles "
        f"({len(walked)} already walked, {len(remaining)} remaining, "
        f"window {discover_window_key()})"
    )
    if discovered:
        log(f"  · resuming with {len(discovered)} pending candidate ids")

    seen_ids: set[str] = set(events_cache.keys())
    for i, pdga in enumerate(remaining, 1):
        for year in DISCOVER_YEARS:
            try:
                ev_list = fetch_player_year_events(pdga, year)
            except Exception as exc:
                log(f"  ✗ {pdga}/{year}: {exc}")
                continue
            for ye in ev_list:
                eid = str(ye["event_id"])
                if eid not in seen_ids:
                    discovered.add(eid)
        walked.add(pdga)
        if i % 25 == 0 or i == len(remaining):
            progress["walked"] = sorted(walked)
            progress["pending_ids"] = sorted(discovered)
            save_discover_progress(progress)
            log(
                f"  · {i}/{len(remaining)} profiles walked this run — "
                f"{len(discovered)} candidate ids"
            )

    pending = sorted(eid for eid in discovered if eid not in events_cache)
    log(f"  → {len(pending)} candidate new event IDs to scrape")
    for n, eid in enumerate(pending, 1):
        try:
            ev = scrape_event(eid)
        except Exception as exc:
            events_cache[eid] = {"event_id": eid, "error": str(exc), "results": []}
            log(f"  ✗ {eid}: {exc}")
            continue
        if ev.get("is_league"):
            events_cache[eid] = {**ev, "skipped": True, "skip_reason": "league"}
            continue
        country = parse_event_country(ev.get("location", ""))
        if country is None and not ev.get("is_asia_tour"):
            events_cache[eid] = {**ev, "skipped": True, "skip_reason": "non_asia"}
            continue
        if ev.get("year") not in YEARS:
            events_cache[eid] = {**ev, "skipped": True, "skip_reason": "year"}
            continue
        events_cache[eid] = ev
        log(f"  + {eid} [{ev['tier'] or '?'}] {ev['title'][:55]} ({country[2] if country else '?'})")
        if n % 10 == 0:
            save_cache(EVENTS_CACHE, events_cache)
            progress["pending_ids"] = [x for x in discovered if x not in events_cache]
            save_discover_progress(progress)

    save_cache(EVENTS_CACHE, events_cache)
    # Clear pending once scraped; keep walked so re-runs skip finished profiles.
    progress["walked"] = sorted(walked)
    progress["pending_ids"] = []
    save_discover_progress(progress)
    return events_cache


# ---------- aggregation ----------


@dataclass
class AsiaPlayer:
    pdga: int
    name: str
    country: str
    country_key: str
    flag: str
    rating: int | None
    classification: str
    city: str
    nationality: str
    pdga_points: float = 0.0
    tour_weighted_points: float = 0.0
    events_played: int = 0
    wins: int = 0
    podiums: int = 0
    top5: int = 0
    top10: int = 0
    top20: int = 0
    asia_tour_events: int = 0
    asia_tour_points: float = 0.0
    division: str = ""
    primary_class: str = ""
    last_active: str = ""
    by_level: dict = field(default_factory=dict)
    by_class: dict = field(default_factory=dict)
    division_counts: dict = field(default_factory=dict)
    results: list[dict] = field(default_factory=list)
    rating_history: list[dict] = field(default_factory=list)
    streak: dict = field(default_factory=dict)


def finalize_class_stats(stats: dict) -> dict:
    places = list(stats.pop("places", []) or [])
    events = stats.get("events", 0) or 0
    out = {
        "events": events,
        "wins": stats.get("wins", 0),
        "podiums": stats.get("podiums", 0),
        "top5": stats.get("top5", 0),
        "top10": stats.get("top10", 0),
        "top20": stats.get("top20", 0),
        "pdga_points": round(float(stats.get("pdga_points", 0.0)), 2),
        "tour_weighted_points": round(float(stats.get("tour_weighted_points", 0.0)), 1),
        "avg_finish": round(sum(places) / len(places), 2) if places else None,
        "win_rate": round(stats.get("wins", 0) / events, 3) if events else 0.0,
        "top10_rate": round(stats.get("top10", 0) / events, 3) if events else 0.0,
    }
    return out


def bump_class_stats(bucket: dict, place: int, pdga_points: float, weighted: float) -> None:
    bucket["events"] += 1
    bucket["pdga_points"] = round(bucket["pdga_points"] + pdga_points, 2)
    bucket["tour_weighted_points"] = round(bucket["tour_weighted_points"] + weighted, 1)
    bucket["places"].append(place)
    if place == 1:
        bucket["wins"] += 1
    if place <= 3:
        bucket["podiums"] += 1
    if place <= 5:
        bucket["top5"] += 1
    if place <= 10:
        bucket["top10"] += 1
    if place <= 20:
        bucket["top20"] += 1


def pick_primary_division(division_counts: dict, by_class: dict) -> tuple[str, str]:
    """Return (division_code, class_bucket) preferring open play."""
    open_mpo = by_class.get("open_mpo", {}).get("events", 0)
    open_fpo = by_class.get("open_fpo", {}).get("events", 0)
    if open_mpo or open_fpo:
        if open_mpo >= open_fpo:
            return "MPO", "open_mpo"
        return "FPO", "open_fpo"
    if division_counts:
        best = max(division_counts.items(), key=lambda kv: kv[1])[0]
        return best, class_bucket(best)
    return "", ""


def aggregate(events_cache: dict, profiles_cache: dict) -> list[dict]:
    players: dict[int, AsiaPlayer] = {}

    for ev in events_cache.values():
        if ev.get("skipped") or not ev.get("results"):
            continue
        if ev.get("year") not in YEARS:
            continue
        ev_meta = {
            "event_id": ev["event_id"],
            "title": ev["title"],
            "dates": ev["dates"],
            "year": ev["year"],
            "tier": ev["tier"],
            "level": ev["level"],
            "is_asia_tour": ev["is_asia_tour"],
            "location": ev["location"],
        }
        for row in ev["results"]:
            pdga = row["pdga"]
            profile = profiles_cache.get(str(pdga))
            division = row.get("division") or ""
            bucket = row.get("class_bucket") or class_bucket(division)
            if pdga not in players:
                country_name = ""
                country_key = ""
                flag = ""
                if profile:
                    country_name = profile.get("country") or ""
                    country_key = profile.get("country_key") or ""
                    flag = profile.get("flag") or ""
                profile_blank = (
                    not country_key
                    and not (profile or {}).get("location_raw")
                )
                if not country_key and (not profile or profile_blank):
                    inferred = infer_country_from_events(pdga, events_cache)
                    if inferred:
                        country_key, flag, country_name = inferred
                if not country_name:
                    country_name = "—"
                if not flag:
                    flag = "🌐"
                profile = profile or {}
                players[pdga] = AsiaPlayer(
                    pdga=pdga,
                    name=profile.get("name") or row["name"],
                    country=country_name or "—",
                    country_key=country_key,
                    flag=flag,
                    rating=profile.get("rating") or row.get("rating"),
                    classification=profile.get("classification", "Pro"),
                    city=profile.get("city", ""),
                    nationality=profile.get("nationality", ""),
                    division=division,
                    by_level={lvl: {"events": 0, "points": 0.0, "weighted": 0.0, "wins": 0} for lvl in TOUR_LEVELS},
                    by_class={
                        "open_mpo": empty_class_stats(),
                        "open_fpo": empty_class_stats(),
                        "amateur": empty_class_stats(),
                        "all": empty_class_stats(),
                    },
                    division_counts={},
                )
            p = players[pdga]
            place = row["place"]
            p.pdga_points = round(p.pdga_points + row["pdga_points"], 2)
            p.tour_weighted_points = round(p.tour_weighted_points + row["weighted_points"], 1)
            p.events_played += 1
            if place == 1:
                p.wins += 1
            if place <= 3:
                p.podiums += 1
            if place <= 5:
                p.top5 += 1
            if place <= 10:
                p.top10 += 1
            if place <= 20:
                p.top20 += 1
            if ev["is_asia_tour"] and bucket in ("open_mpo", "open_fpo"):
                p.asia_tour_events += 1
                p.asia_tour_points = round(p.asia_tour_points + row["pdga_points"], 2)
            level = ev["level"]
            stats = p.by_level.setdefault(
                level, {"events": 0, "points": 0.0, "weighted": 0.0, "wins": 0}
            )
            stats["events"] += 1
            stats["points"] = round(stats["points"] + row["pdga_points"], 2)
            stats["weighted"] = round(stats["weighted"] + row["weighted_points"], 1)
            if place == 1:
                stats["wins"] += 1
            if bucket in p.by_class:
                bump_class_stats(p.by_class[bucket], place, row["pdga_points"], row["weighted_points"])
            bump_class_stats(p.by_class["all"], place, row["pdga_points"], row["weighted_points"])
            p.division_counts[division] = p.division_counts.get(division, 0) + 1
            if not p.last_active or ev["dates"][-4:] > p.last_active[-4:]:
                p.last_active = ev["dates"]
            p.results.append(
                {
                    **ev_meta,
                    "place": place,
                    "pdga_points": row["pdga_points"],
                    "division": division,
                    "class_bucket": bucket,
                    "prize": row.get("prize") or "",
                    "weighted_points": row.get("weighted_points", 0),
                }
            )

    aggregated = [asdict(p) for p in players.values()]
    for row in aggregated:
        finalized = {
            key: finalize_class_stats(stats)
            for key, stats in (row.get("by_class") or {}).items()
        }
        row["by_class"] = finalized
        am = finalized.get("amateur") or {}
        row["am_events"] = am.get("events", 0)
        row["am_wins"] = am.get("wins", 0)
        row["am_podiums"] = am.get("podiums", 0)
        row["am_top10"] = am.get("top10", 0)
        row["am_pdga_points"] = am.get("pdga_points", 0.0)
        div, primary = pick_primary_division(row.get("division_counts") or {}, finalized)
        if div:
            row["division"] = div
        row["primary_class"] = primary
        all_stats = finalized.get("all") or {}
        row["avg_finish"] = all_stats.get("avg_finish")
        row["win_rate"] = all_stats.get("win_rate", 0.0)
        row["top10_rate"] = all_stats.get("top10_rate", 0.0)

    aggregated.sort(key=lambda p: p["pdga_points"], reverse=True)
    for r, row in enumerate(aggregated, 1):
        row["pdga_rank"] = r
        full_results = sorted(
            row["results"],
            key=lambda x: x["dates"][-4:] + x["dates"][:6],
            reverse=True,
        )
        row["streak"] = compute_streak(full_results)
        row["cash_earned"] = round(
            sum(parse_prize_usd(r.get("prize")) for r in full_results), 2
        )
        row["results_full"] = full_results
        row["results"] = full_results[:8]
    by_weighted = sorted(aggregated, key=lambda p: p["tour_weighted_points"], reverse=True)
    for r, row in enumerate(by_weighted, 1):
        row["weighted_rank"] = r
    return aggregated


def parse_prize_usd(prize: str | None) -> float:
    """Parse PDGA prize strings like '$1,250' or '1250' into USD floats."""
    if not prize:
        return 0.0
    text = str(prize).strip()
    if not text or text in {"-", "—", "N/A", "n/a"}:
        return 0.0
    cleaned = re.sub(r"[^\d.]", "", text.replace(",", ""))
    if not cleaned:
        return 0.0
    try:
        return float(cleaned)
    except ValueError:
        return 0.0


def compute_streak(results_sorted_desc: list[dict]) -> dict:
    """Compare avg PDGA pts in last 3 finishes vs the player's season avg."""
    if len(results_sorted_desc) < 4:
        return {"direction": "flat", "recent_avg": 0.0, "season_avg": 0.0, "delta_pct": 0.0}
    recent = results_sorted_desc[:3]
    earlier = results_sorted_desc[3:]
    recent_avg = sum(r["pdga_points"] for r in recent) / max(len(recent), 1)
    earlier_avg = sum(r["pdga_points"] for r in earlier) / max(len(earlier), 1)
    if earlier_avg <= 0:
        return {"direction": "flat", "recent_avg": recent_avg, "season_avg": earlier_avg, "delta_pct": 0.0}
    delta_pct = (recent_avg - earlier_avg) / earlier_avg * 100
    direction = "up" if delta_pct >= 15 else "down" if delta_pct <= -15 else "flat"
    return {
        "direction": direction,
        "recent_avg": round(recent_avg, 1),
        "season_avg": round(earlier_avg, 1),
        "delta_pct": round(delta_pct, 1),
    }


def attach_rating_history(aggregated: list[dict], history_cache: dict) -> None:
    """Inline each pro's recent rating history into the aggregated payload."""
    for row in aggregated:
        history = history_cache.get(str(row["pdga"])) or []
        # Keep last 18 months for sparkline (~12 rating updates)
        row["rating_history"] = history[-15:]


def write_event_details(events_cache: dict, players_by_pdga: dict, log=print) -> int:
    """Emit per-event JSON files for the /asia/event/[id] detail pages."""
    EVENT_DETAIL_DIR.mkdir(parents=True, exist_ok=True)
    written = 0
    for ev in events_cache.values():
        if ev.get("skipped") or not ev.get("results") or ev.get("year") not in YEARS:
            continue
        rows = []
        for r in ev["results"]:
            player = players_by_pdga.get(r["pdga"], {})
            bucket = r.get("class_bucket") or class_bucket(r.get("division", ""))
            rows.append(
                {
                    "pdga": r["pdga"],
                    "name": r["name"],
                    "division": r["division"],
                    "class_bucket": bucket,
                    "place": r["place"],
                    "pdga_points": r["pdga_points"],
                    "rating": r.get("rating"),
                    "prize": r.get("prize"),
                    "flag": player.get("flag", "🌐"),
                    "country": player.get("country", "—"),
                    "country_key": player.get("country_key", ""),
                }
            )
        # split by division and sort by place
        mpo = sorted([r for r in rows if r["division"] == "MPO"], key=lambda r: r["place"])
        fpo = sorted([r for r in rows if r["division"] == "FPO"], key=lambda r: r["place"])
        amateur = sorted(
            [r for r in rows if r.get("class_bucket") == "amateur"],
            key=lambda r: (r["division"], r["place"]),
        )
        # compute MPO field strength
        mpo_ratings = [r["rating"] for r in mpo if r.get("rating")]
        avg_rating = round(sum(mpo_ratings) / len(mpo_ratings), 1) if mpo_ratings else None
        # country breakdown
        from collections import Counter
        cc = Counter((r["flag"], r["country"]) for r in rows if r["country_key"])
        breakdown = [{"flag": f, "country": c, "count": n} for (f, c), n in cc.most_common()]
        payload = {
            "event_id": ev["event_id"],
            "title": ev["title"],
            "location": ev["location"],
            "dates": ev["dates"],
            "year": ev["year"],
            "tier": ev["tier"],
            "level": ev["level"],
            "is_asia_tour": ev["is_asia_tour"],
            "status": ev.get("status", ""),
            "field_size": len(rows),
            "avg_mpo_rating": avg_rating,
            "country_breakdown": breakdown,
            "course": ev.get("course", ""),
            "course_url": ev.get("course_url", ""),
            "course_id": ev.get("course_id", ""),
            "mpo": mpo,
            "fpo": fpo,
            "amateur": amateur,
            "divisions": sorted({r["division"] for r in rows}),
        }
        (EVENT_DETAIL_DIR / f"{ev['event_id']}.json").write_text(json.dumps(payload, indent=2))
        written += 1
    log(f"Wrote {written} per-event detail JSON files to {EVENT_DETAIL_DIR}")
    return written


def write_player_profiles(aggregated: list[dict], log=print) -> int:
    """Emit per-player profile JSON for /leaderboards/asia/player/[pdga]."""
    PLAYER_PROFILE_DIR.mkdir(parents=True, exist_ok=True)
    written = 0
    for row in aggregated:
        full = list(row.get("results_full") or row.get("results") or [])
        wins_ledger = [r for r in full if r.get("place") == 1]
        by_year: dict[str, dict] = {}
        for r in full:
            year = str(r.get("year") or "?")
            slot = by_year.setdefault(
                year,
                {
                    "events": 0,
                    "wins": 0,
                    "podiums": 0,
                    "top10": 0,
                    "pdga_points": 0.0,
                    "places": [],
                },
            )
            slot["events"] += 1
            slot["pdga_points"] = round(slot["pdga_points"] + float(r.get("pdga_points") or 0), 2)
            slot["places"].append(r["place"])
            if r["place"] == 1:
                slot["wins"] += 1
            if r["place"] <= 3:
                slot["podiums"] += 1
            if r["place"] <= 10:
                slot["top10"] += 1
        yearly = []
        for year, slot in sorted(by_year.items(), reverse=True):
            places = slot.pop("places")
            yearly.append(
                {
                    "year": year,
                    **slot,
                    "avg_finish": round(sum(places) / len(places), 2) if places else None,
                }
            )
        profile = {
            "pdga": row["pdga"],
            "name": row["name"],
            "country": row["country"],
            "country_key": row["country_key"],
            "flag": row["flag"],
            "rating": row.get("rating"),
            "classification": row.get("classification", ""),
            "city": row.get("city", ""),
            "nationality": row.get("nationality", ""),
            "division": row.get("division", ""),
            "primary_class": row.get("primary_class", ""),
            "pdga_points": row.get("pdga_points", 0),
            "tour_weighted_points": row.get("tour_weighted_points", 0),
            "asia_tour_points": row.get("asia_tour_points", 0),
            "asia_tour_events": row.get("asia_tour_events", 0),
            "events_played": row.get("events_played", 0),
            "wins": row.get("wins", 0),
            "podiums": row.get("podiums", 0),
            "top5": row.get("top5", 0),
            "top10": row.get("top10", 0),
            "top20": row.get("top20", 0),
            "avg_finish": row.get("avg_finish"),
            "win_rate": row.get("win_rate", 0),
            "top10_rate": row.get("top10_rate", 0),
            "cash_earned": row.get("cash_earned", 0),
            "pdga_rank": row.get("pdga_rank"),
            "weighted_rank": row.get("weighted_rank"),
            "country_rank": row.get("country_rank"),
            "am_events": row.get("am_events", 0),
            "am_wins": row.get("am_wins", 0),
            "am_podiums": row.get("am_podiums", 0),
            "am_top10": row.get("am_top10", 0),
            "am_pdga_points": row.get("am_pdga_points", 0),
            "last_active": row.get("last_active", ""),
            "by_level": row.get("by_level") or {},
            "by_class": row.get("by_class") or {},
            "division_counts": row.get("division_counts") or {},
            "results": full,
            "wins_ledger": wins_ledger,
            "by_year": yearly,
            "rating_history": row.get("rating_history") or [],
            "streak": row.get("streak") or {},
            "pdga_url": f"https://www.pdga.com/player/{row['pdga']}",
        }
        (PLAYER_PROFILE_DIR / f"{row['pdga']}.json").write_text(json.dumps(profile, indent=2))
        written += 1
    log(f"Wrote {written} per-player profile JSON files to {PLAYER_PROFILE_DIR}")
    return written


def compute_asia_tour_standings(events_cache: dict, players_by_pdga: dict) -> list[dict]:
    """Official PDGA Asia Tour standings: best 4 finishes count, min 2 events."""
    from collections import defaultdict

    per_player: dict[int, list[dict]] = defaultdict(list)
    tour_event_ids: list[str] = []
    for ev in events_cache.values():
        if not ev.get("is_asia_tour") or ev.get("skipped"):
            continue
        if not ev.get("results"):
            continue
        tour_event_ids.append(ev["event_id"])
        for row in ev["results"]:
            # Official Asia Tour standings are open MPO/FPO only
            if row.get("division") not in ("MPO", "FPO"):
                continue
            per_player[row["pdga"]].append(
                {
                    "event_id": ev["event_id"],
                    "event": ev["title"][:55],
                    "tour_event": _asia_tour_number(ev["title"]),
                    "division": row["division"],
                    "place": row["place"],
                    "points": ASIA_TOUR_POINTS.get(row["place"], 0),
                    "dates": ev["dates"],
                }
            )

    standings = []
    for pdga, results in per_player.items():
        if len(results) < ASIA_TOUR_MIN_EVENTS:
            continue
        top = sorted(results, key=lambda r: r["points"], reverse=True)[:ASIA_TOUR_COUNT_BEST]
        total = sum(r["points"] for r in top)
        player_meta = players_by_pdga.get(pdga, {})
        standings.append(
            {
                "pdga": pdga,
                "name": player_meta.get("name") or (results[0].get("name", f"PDGA {pdga}")),
                "flag": player_meta.get("flag", "🌐"),
                "country": player_meta.get("country", "—"),
                "country_key": player_meta.get("country_key", ""),
                "division": results[0]["division"],
                "rating": player_meta.get("rating"),
                "events_played": len(results),
                "counting": top,
                "all_results": sorted(results, key=lambda r: r["dates"][-4:] + r["dates"][:6]),
                "total_points": total,
            }
        )
    standings.sort(key=lambda s: s["total_points"], reverse=True)
    for r, s in enumerate(standings, 1):
        s["rank"] = r
    return standings


def _asia_tour_number(title: str) -> str:
    m = re.search(r"Asia Tour\s*(?:Event\s*)?#?(\d+|Championship)", title, re.IGNORECASE)
    if not m:
        return ""
    return m.group(1)


def build_country_champions(aggregated: list[dict], min_events: int = 2) -> list[dict]:
    """Pick the leading player per country (by PDGA points) with at least N events."""
    by_country: dict[str, list[dict]] = {}
    for p in aggregated:
        if not p["country_key"]:
            continue
        if p["events_played"] < min_events:
            continue
        by_country.setdefault(p["country_key"], []).append(p)
    champions = []
    for key, players in by_country.items():
        players.sort(key=lambda p: p["pdga_points"], reverse=True)
        leader = players[0]
        champions.append(
            {
                "country_key": key,
                "country": leader["country"],
                "flag": leader["flag"],
                "player_count": len(players),
                "leader_pdga": leader["pdga"],
                "leader_name": leader["name"],
                "leader_division": leader["division"],
                "leader_rating": leader["rating"],
                "leader_points": leader["pdga_points"],
                "leader_events": leader["events_played"],
                "leader_wins": leader["wins"],
            }
        )
    champions.sort(key=lambda c: c["leader_points"], reverse=True)
    return champions


def build_highlights(events_cache: dict, aggregated: list[dict]) -> dict:
    """Fun stats: biggest fields, most internationally diverse events, etc."""
    asia_events = [
        e for e in events_cache.values()
        if not e.get("skipped") and e.get("results") and e.get("year") in YEARS
    ]
    if not asia_events or not aggregated:
        return {}

    biggest = max(asia_events, key=lambda e: len(e["results"]))
    avg_rating_per_event = []
    for ev in asia_events:
        ratings = [r["rating"] for r in ev["results"] if r["division"] == "MPO" and r.get("rating")]
        if len(ratings) >= 3:
            avg_rating_per_event.append((sum(ratings) / len(ratings), ev))
    strongest = max(avg_rating_per_event, key=lambda x: x[0]) if avg_rating_per_event else None

    most_active = max(aggregated, key=lambda p: p["events_played"])
    most_wins = max(aggregated, key=lambda p: p["wins"])
    podium_machine = max(aggregated, key=lambda p: p["podiums"])

    # most international: distinct profile countries by event field
    diversity = []
    countries_by_pdga = {p["pdga"]: p["country_key"] for p in aggregated if p["country_key"]}
    for ev in asia_events:
        cs = {countries_by_pdga.get(r["pdga"]) for r in ev["results"] if countries_by_pdga.get(r["pdga"])}
        cs.discard(None)
        diversity.append((len(cs), ev))
    most_diverse = max(diversity, key=lambda x: x[0]) if diversity else None

    return {
        "biggest_field": {
            "event_id": biggest["event_id"],
            "title": biggest["title"],
            "field_size": len(biggest["results"]),
            "dates": biggest["dates"],
        },
        "strongest_mpo_field": {
            "event_id": strongest[1]["event_id"],
            "title": strongest[1]["title"],
            "avg_rating": round(strongest[0], 1),
            "dates": strongest[1]["dates"],
        } if strongest else None,
        "most_diverse_event": {
            "event_id": most_diverse[1]["event_id"],
            "title": most_diverse[1]["title"],
            "country_count": most_diverse[0],
            "dates": most_diverse[1]["dates"],
        } if most_diverse else None,
        "most_active_player": {
            "pdga": most_active["pdga"],
            "name": most_active["name"],
            "flag": most_active["flag"],
            "events": most_active["events_played"],
        },
        "most_wins_player": {
            "pdga": most_wins["pdga"],
            "name": most_wins["name"],
            "flag": most_wins["flag"],
            "wins": most_wins["wins"],
        },
        "podium_machine": {
            "pdga": podium_machine["pdga"],
            "name": podium_machine["name"],
            "flag": podium_machine["flag"],
            "podiums": podium_machine["podiums"],
        },
    }


def reclassify_cached_events(events_cache: dict, log=print) -> dict:
    """Re-apply league / Asia-host filters to already-cached events.

    Fixes false positives from older country matching (e.g. Indiana → India).
    """
    flipped = 0
    for eid, ev in list(events_cache.items()):
        if not isinstance(ev, dict):
            continue
        title = ev.get("title") or ""
        if is_league_event(title, ev.get("event_type") or ""):
            if not ev.get("skipped") or ev.get("skip_reason") != "league":
                events_cache[eid] = {**ev, "skipped": True, "skip_reason": "league", "is_league": True}
                flipped += 1
            continue
        country = parse_event_country(ev.get("location") or "")
        asia_ok = country is not None or bool(ev.get("is_asia_tour"))
        if not asia_ok:
            if not ev.get("skipped") or ev.get("skip_reason") != "non_asia":
                events_cache[eid] = {**ev, "skipped": True, "skip_reason": "non_asia"}
                flipped += 1
            continue
        # Previously skipped as non_asia but now matches (shouldn't happen often)
        if ev.get("skipped") and ev.get("skip_reason") == "non_asia" and asia_ok:
            fixed = {**ev, "skipped": False}
            fixed.pop("skip_reason", None)
            events_cache[eid] = fixed
            flipped += 1
    if flipped:
        log(f"Reclassified {flipped} cached events (league / Asia-host filter)")
        save_cache(EVENTS_CACHE, events_cache)
    return events_cache


# ---------- main ----------


def main() -> None:
    global DISCOVER_YEARS
    args = sys.argv[1:]
    DISCOVER_YEARS = parse_year_window(args)
    refresh_events = "--refresh-events" in args
    refresh_results = "--refresh-results" in args or refresh_events
    refresh_profiles = "--refresh-profiles" in args
    refresh_history = "--refresh-history" in args
    enrich = "--enrich" in args
    discover = "--discover" in args
    # Rating history is expensive; only with --rating-history (or --enrich unless skipped).
    rating_history = (
        "--rating-history" in args
        or ("--enrich" in args and "--no-rating-history" not in args)
    )

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    SITE_DATA.mkdir(parents=True, exist_ok=True)
    events_cache = {} if refresh_events else load_cache(EVENTS_CACHE)
    profiles_cache = {} if refresh_profiles else load_cache(PROFILES_CACHE)
    history_cache = {} if refresh_history else load_cache(RATING_HISTORY_CACHE)

    print(
        f"Starting with {len(events_cache)} cached events / "
        f"{len(profiles_cache)} profiles / {len(history_cache)} rating histories"
    )
    print(
        f"Archive board: {YEARS[0]}–{YEARS[-1]} · discover walk: "
        f"{DISCOVER_YEARS[0]}–{DISCOVER_YEARS[-1]} · tournaments only (leagues excluded)"
    )
    print(f"Seeded with {len(SEED_EVENTS_2026_TOUR)} Asia Tour 2026 + {len(SEED_EVENTS_EXTRA)} extra Asian events")
    if refresh_results and not refresh_events:
        print("Re-scraping cached events for MPO/FPO/MA*/FA* rows (--refresh-results)")

    events_cache = reclassify_cached_events(events_cache, log=print)
    events_cache = backfill_class_buckets(events_cache)
    events_cache = scrape_seed_events(
        ALL_SEED_EVENTS, events_cache, log=print, refresh_results=refresh_results
    )
    events_cache = backfill_class_buckets(events_cache)

    if enrich:
        profiles_cache = enrich_player_profiles(events_cache, profiles_cache, log=print)

    if discover:
        events_cache = discover_new_events(events_cache, profiles_cache, log=print)
        # New events introduce players — enrich again before aggregation.
        if enrich:
            profiles_cache = enrich_player_profiles(events_cache, profiles_cache, log=print)

    if rating_history:
        pros_in_data = sorted({r["pdga"] for ev in events_cache.values() if not ev.get("skipped") for r in ev.get("results", [])})
        history_cache = enrich_rating_history(pros_in_data, history_cache, log=print)

    print("\nAggregating...")
    aggregated = aggregate(events_cache, profiles_cache)
    attach_rating_history(aggregated, history_cache)

    # per-country stats
    by_country: dict = {}
    for (key, flag, name) in COUNTRY_LIST:
        players_for = [p for p in aggregated if p["country_key"] == key]
        players_for.sort(key=lambda p: p["pdga_points"], reverse=True)
        for r, row in enumerate(players_for, 1):
            row["country_rank"] = r
        by_country[key] = {
            "key": key,
            "name": name,
            "flag": flag,
            "player_count": len(players_for),
            "leader": players_for[0] if players_for else None,
        }
    # international bucket for players without an Asian home country
    intl = [p for p in aggregated if not p["country_key"]]
    by_country["INTL"] = {
        "key": "INTL",
        "name": "International",
        "flag": "🌐",
        "player_count": len(intl),
        "leader": intl[0] if intl else None,
    }

    asia_events = [
        e
        for e in events_cache.values()
        if not e.get("skipped") and e.get("results") and e.get("year") in YEARS
    ]
    asia_events.sort(key=lambda e: (e["year"], e["dates"]), reverse=True)

    players_by_pdga = {p["pdga"]: p for p in aggregated}
    tour_standings = compute_asia_tour_standings(events_cache, players_by_pdga)
    country_champions = build_country_champions(aggregated)
    highlights = build_highlights(events_cache, aggregated)

    # Strip full-result payloads from the board file (profiles keep them).
    board_players = []
    for p in aggregated:
        board_row = {k: v for k, v in p.items() if k != "results_full"}
        board_players.append(board_row)

    payload = {
        "title": "PDGA Asia Tour & Regional Leaderboard",
        "description": "MPO + FPO + Amateur (MA*/FA*) results across 2025-2026 Asian PDGA events",
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "years": list(YEARS),
        "scoring": {
            "levels": list(TOUR_LEVELS),
            "tier_multipliers": TIER_MULTIPLIERS,
            "primary": "pdga_points",
            "notes": (
                "Primary metric is PDGA's official Points sum (already weighted by "
                "tier + field strength). Tour weighted is our custom finish model — "
                "PDGA Asia Tour events get a 2.0x multiplier, A/B/C tier follow the "
                "global player tour weighting. Amateur boards use MA*/FA* finishes."
            ),
            "asia_tour_official": {
                "rule": "Top 4 finishes count, min 2 events to qualify (MPO/FPO only)",
                "points": ASIA_TOUR_POINTS,
            },
        },
        "countries": [{"key": k, "name": n, "flag": f} for (k, f, n) in COUNTRY_LIST],
        "country_stats": by_country,
        "country_champions": country_champions,
        "tour_standings": tour_standings,
        "highlights": highlights,
        "events": [
            {
                "event_id": e["event_id"],
                "title": e["title"],
                "location": e["location"],
                "dates": e["dates"],
                "year": e["year"],
                "tier": e["tier"],
                "level": e["level"],
                "is_asia_tour": e["is_asia_tour"],
                "field_size": len(e["results"]),
            }
            for e in asia_events
        ],
        "asia_tour_events": [
            e
            for e in [
                {
                    "event_id": ev["event_id"],
                    "title": ev["title"],
                    "location": ev["location"],
                    "dates": ev["dates"],
                    "field_size": len(ev["results"]),
                }
                for ev in events_cache.values()
                if ev.get("is_asia_tour") and not ev.get("skipped")
            ]
        ],
        "total_events": len(asia_events),
        "total_players": len(board_players),
        "players": board_players,
    }

    OUTPUT_FILE.write_text(json.dumps(payload, indent=2))
    print(f"\nSaved {OUTPUT_FILE} — {len(board_players)} players across {len(asia_events)} Asian tournaments")

    BOARD_FILE.parent.mkdir(parents=True, exist_ok=True)
    BOARD_FILE.write_text(OUTPUT_FILE.read_text())
    print(f"Synced {BOARD_FILE}")

    write_player_profiles(aggregated, log=print)
    write_event_details(events_cache, players_by_pdga, log=print)

    print("\nTop 15 (by PDGA points):")
    for row in aggregated[:15]:
        print(
            f"  {row['pdga_rank']:>3}. {row['flag']} {row['name']:<26} "
            f"{row['pdga_points']:>7.1f} pts · {row['events_played']:>2} ev "
            f"({row['wins']}W/{row['podiums']}P) {row['division']}"
        )


if __name__ == "__main__":
    main()
