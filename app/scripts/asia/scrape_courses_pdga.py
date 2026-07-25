#!/usr/bin/env python3
"""Scrape the PDGA course directory for Asian courses.

Two-step scrape:
  1. Fetch https://www.pdga.com/course-directory (one big HTML page ~2.3MB) and
     parse the embedded Leaflet `features` JSON — every PDGA course with its
     slug, name, lat, lon.
  2. Bbox-filter to an Asia-ish candidate set (~220), then fetch each
     per-course page (/course-directory/course/<slug>) for Holes, Par,
     Established, Course Type, and a Google Maps location link whose `q=`
     ends with the ISO country code. Keep only the 16 PDGA-Asia countries.

Resumable: caches per-course results in data/asia_courses_cache.json so
re-runs only fetch missing slugs. Emits src/data/asia/courses-directory.json.

Usage:
  python3 scripts/asia/scrape_courses_pdga.py            # fetch missing
  python3 scripts/asia/scrape_courses_pdga.py --refresh   # re-fetch all pages
  python3 scripts/asia/scrape_courses_pdga.py --limit 10 # smoke test
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))
from asia_archive import pdga_get  # noqa: E402  shared polite HTTP layer
from bs4 import BeautifulSoup

DATA_DIR = SCRIPT_DIR / "data"
SITE_DATA = SCRIPT_DIR.parent.parent / "src" / "data" / "asia"
CACHE_FILE = DATA_DIR / "asia_courses_cache.json"
OUT_FILE = SITE_DATA / "courses-directory.json"

DIRECTORY_URL = "https://www.pdga.com/course-directory"

# Rough Asia bbox for the pre-filter; the per-course ISO code is authoritative.
ASIA_BBOX = (-12.0, 55.0, 25.0, 150.0)  # lat_min, lat_max, lon_min, lon_max

# The 16 PDGA-Asia countries we keep (ISO-2 → name).
ASIA_COUNTRIES = {
    "JP": "Japan", "TH": "Thailand", "KR": "South Korea", "CN": "China",
    "MY": "Malaysia", "SG": "Singapore", "PH": "Philippines", "KH": "Cambodia",
    "TW": "Chinese Taipei", "VN": "Vietnam", "HK": "Hong Kong", "MN": "Mongolia",
    "ID": "Indonesia", "LA": "Laos", "KZ": "Kazakhstan", "IN": "India",
}


def parse_directory_features(html: str) -> list[dict]:
    """Extract the Leaflet `features` array from the directory HTML."""
    m = re.search(r'"features":\s*\[', html)
    if not m:
        return []
    start = m.end() - 1  # at '['
    depth = 0
    i = start
    while i < len(html):
        c = html[i]
        if c == "[":
            depth += 1
        elif c == "]":
            depth -= 1
            if depth == 0:
                break
        i += 1
    return json.loads(html[start:i + 1])


def feature_to_course(f: dict) -> dict | None:
    popup = f.get("popup", "") or ""
    sm = re.search(r'href="/course-directory/course/([^"]+)"', popup)
    nm = re.search(r">([^<]+)</a>", popup)
    if not sm or not nm:
        return None
    try:
        lat = float(f["lat"])
        lon = float(f["lon"])
    except (KeyError, ValueError, TypeError):
        return None
    return {
        "slug": sm.group(1),
        "name": nm.group(1).strip(),
        "lat": lat,
        "lon": lon,
    }


def in_asia_bbox(lat: float, lon: float) -> bool:
    lo, la, lomin, lomax = ASIA_BBOX
    return lo <= lat <= la and lomin <= lon <= lomax


def extract_course_fields(html: str) -> dict:
    def field(label: str) -> str | None:
        m = re.search(
            rf'{label}:&nbsp;</div><div class="field-items"><div class="field-item[^"]*">([^<]+)</div>',
            html,
        )
        return m.group(1).strip() if m else None

    out = {
        "holes": None,
        "par": None,
        "established": None,
        "course_type": None,
        "country": "",
        "region": "",
        "address": "",
    }
    h = field("Holes")
    if h:
        mh = re.search(r"\d+", h)
        out["holes"] = int(mh.group()) if mh else None
    p = field("Par")
    if p:
        mp = re.search(r"\d+", p)
        out["par"] = int(mp.group()) if mp else None
    ct = field("Course Type")
    if ct:
        out["course_type"] = ct
    m = re.search(r'Established:.*?content="(\d{4})', html, re.S)
    if m:
        out["established"] = int(m.group(1))

    # course's own location field → Google Maps q= (ends with ISO country code)
    m = re.search(
        r'field-name-field-course-location.*?href="(https://maps\.google\.com[^"]+)"',
        html,
        re.S,
    )
    if m:
        q = parse_qs(urlparse(m.group(1)).query).get("q", [""])[0]
        addr = unquote(q).strip().rstrip(", ")
        out["address"] = addr
        parts = [p.strip() for p in addr.split(",") if p.strip()]
        iso = next((p for p in parts if re.fullmatch(r"[A-Z]{2}", p)), "")
        if iso:
            out["country"] = iso
            idx = parts.index(iso)
            if idx > 0:
                out["region"] = parts[idx - 1]
    return out


def load_cache() -> dict:
    if CACHE_FILE.exists():
        return json.loads(CACHE_FILE.read_text())
    return {}


def save_cache(cache: dict) -> None:
    CACHE_FILE.write_text(json.dumps(cache, indent=2))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--refresh", action="store_true", help="re-fetch all per-course pages")
    ap.add_argument("--limit", type=int, default=0, help="stop after N page fetches (0=no limit)")
    ap.add_argument("--no-directory", action="store_true", help="skip directory fetch (use cache)")
    args = ap.parse_args()

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    SITE_DATA.mkdir(parents=True, exist_ok=True)

    # 1. directory
    if args.no_directory and CACHE_FILE.exists():
        candidates = json.loads(CACHE_FILE.read_text()).get("__candidates", [])
        print(f"Using {len(candidates)} cached candidates (--no-directory)")
    else:
        print("Fetching PDGA course directory...")
        r = pdga_get(DIRECTORY_URL)
        if r.status_code != 200:
            raise SystemExit(f"directory HTTP {r.status_code}")
        feats = parse_directory_features(r.text)
        print(f"  {len(feats)} features embedded")
        candidates = []
        for f in feats:
            c = feature_to_course(f)
            if c and in_asia_bbox(c["lat"], c["lon"]):
                candidates.append(c)
        print(f"  {len(candidates)} in Asia bbox")

    cache = load_cache()
    cache["__candidates"] = candidates

    # 2. per-course pages
    todo = [c for c in candidates if args.refresh or c["slug"] not in cache]
    print(f"{len(todo)} per-course pages to fetch (of {len(candidates)} candidates)")
    done = 0
    for c in todo:
        if args.limit and done >= args.limit:
            break
        url = f"https://www.pdga.com/course-directory/course/{c['slug']}"
        try:
            r = pdga_get(url)
        except Exception as exc:
            print(f"  ! {c['slug']}: {exc}")
            time.sleep(1)
            continue
        if r.status_code != 200:
            print(f"  ! {c['slug']}: HTTP {r.status_code}")
            continue
        fields = extract_course_fields(r.text)
        cache[c["slug"]] = {**c, **fields}
        done += 1
        if done % 20 == 0:
            save_cache(cache)
            print(f"  … {done}/{len(todo)} fetched")
    save_cache(cache)

    # 3. emit (keep only our 16 countries)
    out = []
    for slug, entry in cache.items():
        if slug == "__candidates":
            continue
        iso = entry.get("country", "")
        if iso not in ASIA_COUNTRIES:
            continue
        out.append({
            "slug": entry["slug"],
            "name": entry["name"],
            "lat": entry["lat"],
            "lon": entry["lon"],
            "holes": entry.get("holes"),
            "par": entry.get("par"),
            "established": entry.get("established"),
            "course_type": entry.get("course_type") or "",
            "country_key": iso,
            "country": ASIA_COUNTRIES[iso],
            "region": entry.get("region", ""),
            "address": entry.get("address", ""),
            "pdga_url": f"https://www.pdga.com/course-directory/course/{entry['slug']}",
        })
    out.sort(key=lambda c: (c["country_key"], c["name"].lower()))

    from datetime import datetime, timezone
    payload = {
        "updated_at": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "source": "PDGA course directory (pdga.com/course-directory)",
        "count": len(out),
        "courses": out,
    }
    OUT_FILE.write_text(json.dumps(payload, indent=2))
    print(f"Wrote {OUT_FILE} ({len(out)} courses across {len({c['country_key'] for c in out})} countries)")


if __name__ == "__main__":
    main()
