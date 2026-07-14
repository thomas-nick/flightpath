#!/usr/bin/env python3
"""Scrape PDGA public pages for wins/places split by Open (MPO/FPO) vs Amateur."""

from __future__ import annotations

import collections
import json
import re
import time
import urllib.error
import urllib.request
from pathlib import Path

UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src/data/finishes.json"
PLAYERS = ROOT / "src/data/players.json"


def get(url: str, retries: int = 8) -> str:
    last: Exception | None = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read().decode("utf-8", errors="replace")
        except urllib.error.HTTPError as e:
            last = e
            if e.code in (429, 503, 502):
                wait = min(150, 12 * (attempt + 1))
                print(f"  rate {e.code}, sleep {wait}s", flush=True)
                time.sleep(wait)
                continue
            raise
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(4 + attempt)
    assert last is not None
    raise last


def clean(s: str) -> str:
    return re.sub(r"\s+", " ", re.sub("<[^>]+>", " ", s or "")).strip()


def parse_money(s: str) -> float:
    s = re.sub(r"[^0-9.]", "", s or "")
    return float(s) if s else 0.0


def year_from_dates(s: str) -> str | None:
    m = re.search(r"(20\d{2}|19\d{2})", s or "")
    return m.group(1) if m else None


def classify_division(code: str, label: str = "") -> str:
    c = (code or "").upper().strip()
    n = (label or "").lower()
    if c in {"MPO", "FPO"}:
        return "open"
    if c.startswith(("MA", "FA", "MJ", "FJ")):
        return "amateur"
    if any(
        k in n
        for k in (
            "advanced",
            "intermediate",
            "recreational",
            "novice",
            "junior",
            "amateur",
        )
    ):
        return "amateur"
    if c.startswith(("MP", "FP", "MG", "FG")) or "pro" in n:
        return "other_pro"
    if "open" in n and "pro" in n:
        return "open"
    return "other"


def parse_career(html: str) -> dict:
    events = re.search(
        r"career-events[^>]*>.*?<strong>Career Events:</strong>\s*([0-9,]+)",
        html,
        re.I | re.S,
    )
    wins = re.search(
        r"career-wins[^>]*>.*?<strong>Career Wins:</strong>\s*(?:<a[^>]*>)?([0-9,]+)",
        html,
        re.I | re.S,
    )
    earnings = re.search(
        r"career-earnings[^>]*>.*?<strong>Career Earnings:</strong>\s*\$?([0-9,\.]+)",
        html,
        re.I | re.S,
    )
    rating = re.search(
        r"current-rating[^>]*>.*?<strong>Current Rating:</strong>\s*([0-9]+)",
        html,
        re.I | re.S,
    )
    return {
        "career_events": int((events.group(1) if events else "0").replace(",", "")),
        "career_wins": int((wins.group(1) if wins else "0").replace(",", "")),
        "career_earnings": float(
            (earnings.group(1) if earnings else "0").replace(",", "")
        ),
        "current_rating": int(rating.group(1)) if rating else None,
    }


def parse_rating_history(html: str) -> list[dict]:
    rows: list[dict] = []
    for table in re.findall(r"<table[^>]*>(.*?)</table>", html, re.I | re.S):
        headers = [
            clean(h).lower()
            for h in re.findall(r"<th[^>]*>(.*?)</th>", table, re.I | re.S)
        ]
        joined = " ".join(headers)
        if "rating" not in joined or "effective" not in joined:
            continue
        for row in re.findall(r"<tr[^>]*>(.*?)</tr>", table, re.I | re.S)[1:]:
            date = re.search(r'class="date"[^>]*>(.*?)</td>', row, re.I | re.S)
            rating = re.search(
                r'class="player-rating"[^>]*>(.*?)</td>', row, re.I | re.S
            )
            rounds = re.search(r'class="round"[^>]*>(.*?)</td>', row, re.I | re.S)
            if not (date and rating):
                continue
            rt = clean(rating.group(1))
            if not rt.isdigit():
                continue
            rows.append(
                {
                    "date": clean(date.group(1)),
                    "rating": int(rt),
                    "rounds": (
                        int(clean(rounds.group(1)))
                        if rounds and clean(rounds.group(1)).isdigit()
                        else None
                    ),
                }
            )
    return rows


def parse_wins(html: str) -> list[dict]:
    out: list[dict] = []
    for table in re.findall(r"<table[^>]*>(.*?)</table>", html, re.I | re.S):
        headers = [
            clean(h).lower()
            for h in re.findall(r"<th[^>]*>(.*?)</th>", table, re.I | re.S)
        ]
        if "tournament" not in headers:
            continue
        for row in re.findall(r"<tr[^>]*>(.*?)</tr>", table, re.I | re.S)[1:]:
            dates = re.search(r'class="dates"[^>]*>(.*?)</td>', row, re.I | re.S)
            tourney = re.search(
                r'class="tournament"[^>]*>(.*?)</td>', row, re.I | re.S
            )
            division = re.search(
                r'class="division"[^>]*>(.*?)</td>', row, re.I | re.S
            )
            tier = re.search(r'class="tier"[^>]*>(.*?)</td>', row, re.I | re.S)
            prize = re.search(r'class="prize"[^>]*>(.*?)</td>', row, re.I | re.S)
            href = re.search(r'href="(/tour/event/\d+#?([A-Z0-9]+)?)"', row)
            href2 = re.search(r'href="(/tour/event/\d+[^"]*)"', row)
            if not (dates and tourney):
                continue
            div_label = clean(division.group(1)) if division else ""
            div_code = ""
            if href and href.group(2):
                div_code = href.group(2).upper()
            elif href2 and "#" in href2.group(1):
                div_code = href2.group(1).split("#")[-1].upper()
            # infer code from label when missing
            if not div_code and div_label:
                if "women" in div_label.lower() and "open" in div_label.lower():
                    div_code = "FPO"
                elif "open" in div_label.lower() and "women" not in div_label.lower():
                    div_code = "MPO"
            d = clean(dates.group(1))
            bucket = classify_division(div_code, div_label)
            out.append(
                {
                    "dates": d,
                    "year": year_from_dates(d),
                    "tournament": clean(tourney.group(1)),
                    "division": div_label,
                    "division_code": div_code,
                    "class_bucket": bucket,
                    "tier": clean(tier.group(1)) if tier else "",
                    "prize": parse_money(clean(prize.group(1)) if prize else ""),
                    "event_url": (
                        "https://www.pdga.com" + href2.group(1).split("#")[0]
                        if href2
                        else None
                    ),
                }
            )
    return out


def parse_results_by_division(html: str) -> list[dict]:
    """Parse result tables keyed by id=player-results-{division}."""
    out: list[dict] = []
    for m in re.finditer(
        r'<table[^>]*id="player-results-([^"]+)"[^>]*>(.*?)</table>',
        html,
        re.I | re.S,
    ):
        code = m.group(1).upper().replace("_", "")
        table = m.group(2)
        before = html[: m.start()]
        h4s = re.findall(r"<h4>(.*?)</h4>", before, re.I | re.S)
        label = clean(h4s[-1]) if h4s else code
        # keep label short if a bad match leaked season-totals text
        if len(label) > 48 or "Totals" in label:
            label = code
        bucket = classify_division(code, label)
        for row in re.findall(r"<tr[^>]*>(.*?)</tr>", table, re.I | re.S):
            if "<th" in row.lower():
                continue
            place_m = re.search(r'class="place"[^>]*>(.*?)</td>', row, re.I | re.S)
            points_m = re.search(r'class="points"[^>]*>(.*?)</td>', row, re.I | re.S)
            tourney_m = re.search(
                r'class="tournament"[^>]*>(.*?)</td>', row, re.I | re.S
            )
            tier_m = re.search(r'class="tier"[^>]*>(.*?)</td>', row, re.I | re.S)
            dates_m = re.search(r'class="dates"[^>]*>(.*?)</td>', row, re.I | re.S)
            prize_m = re.search(r'class="prize"[^>]*>(.*?)</td>', row, re.I | re.S)
            href = re.search(r'href="(/tour/event/\d+[^"]*)"', row)
            if not (place_m and tourney_m):
                continue
            try:
                place = int(re.match(r"(\d+)", clean(place_m.group(1))).group(1))
            except Exception:
                continue
            dates = clean(dates_m.group(1)) if dates_m else ""
            out.append(
                {
                    "place": place,
                    "points": parse_money(clean(points_m.group(1)) if points_m else ""),
                    "tournament": clean(tourney_m.group(1)),
                    "tier": clean(tier_m.group(1)) if tier_m else "",
                    "dates": dates,
                    "year": year_from_dates(dates),
                    "prize": parse_money(clean(prize_m.group(1)) if prize_m else ""),
                    "division": label,
                    "division_code": code,
                    "class_bucket": bucket,
                    "event_url": (
                        "https://www.pdga.com" + href.group(1).split("#")[0]
                        if href
                        else None
                    ),
                }
            )
    # newest first
    out.sort(key=lambda r: (r.get("year") or "", r.get("dates") or ""), reverse=True)
    return out


def summarize(places: list[int], wins_count: int | None = None) -> dict:
    n = len(places) or 1
    return {
        "events_tracked": len(places),
        "wins": wins_count if wins_count is not None else sum(1 for x in places if x == 1),
        "podiums": sum(1 for x in places if x <= 3),
        "top5": sum(1 for x in places if x <= 5),
        "top10": sum(1 for x in places if x <= 10),
        "top20": sum(1 for x in places if x <= 20),
        "win_rate": round(100 * sum(1 for x in places if x == 1) / n, 1) if places else 0,
        "podium_rate": round(100 * sum(1 for x in places if x <= 3) / n, 1)
        if places
        else 0,
        "top10_rate": round(100 * sum(1 for x in places if x <= 10) / n, 1)
        if places
        else 0,
        "avg_place": round(sum(places) / len(places), 2) if places else None,
        "best_place": min(places) if places else None,
        "place_histogram": {
            str(k): v
            for k, v in sorted(
                collections.Counter(
                    min(x, 25) if x <= 25 else 26 for x in places
                ).items()
            )
        },
    }


def year_series(results: list[dict], wins: list[dict]) -> list[dict]:
    by_year: dict[str, dict] = collections.defaultdict(
        lambda: {
            "events": 0,
            "wins": 0,
            "podiums": 0,
            "top5": 0,
            "top10": 0,
            "top20": 0,
            "places": [],
        }
    )
    for r in results:
        y = r.get("year") or "unknown"
        b = by_year[y]
        b["events"] += 1
        b["places"].append(r["place"])
        if r["place"] == 1:
            b["wins"] += 1
        if r["place"] <= 3:
            b["podiums"] += 1
        if r["place"] <= 5:
            b["top5"] += 1
        if r["place"] <= 10:
            b["top10"] += 1
        if r["place"] <= 20:
            b["top20"] += 1
    wby = collections.Counter(w["year"] for w in wins if w.get("year"))
    keys = set(by_year) | set(wby)
    out = []
    for y in sorted(keys):
        b = by_year[y]
        avg = sum(b["places"]) / len(b["places"]) if b["places"] else None
        out.append(
            {
                "year": y,
                "events": b["events"],
                "wins": max(b["wins"], wby.get(y, 0)),
                "podiums": b["podiums"],
                "top5": b["top5"],
                "top10": b["top10"],
                "top20": b["top20"],
                "avg_place": round(avg, 2) if avg is not None else None,
            }
        )
    return out


def open_code_for_player(player: dict) -> str:
    return "FPO" if player.get("division") == "FPO" else "MPO"


def enrich_player(p: dict) -> dict:
    num = p["pdga_number"]
    open_code = open_code_for_player(p)

    career = parse_career(get(f"https://www.pdga.com/player/{num}"))
    time.sleep(1.6)
    wins = parse_wins(get(f"https://www.pdga.com/player/{num}/wins"))
    time.sleep(1.6)
    history = parse_rating_history(get(f"https://www.pdga.com/player/{num}/history"))
    time.sleep(1.6)

    years = sorted(
        {s.get("year") for s in p.get("stats") or [] if s.get("year")}
        | {w.get("year") for w in wins if w.get("year")}
    )
    # Need amateur years too — pull a wider window for players with am history
    recent = years[-10:] if len(years) > 10 else years
    results: list[dict] = []
    for y in recent:
        results.extend(
            parse_results_by_division(
                get(f"https://www.pdga.com/player/{num}/stats/{y}")
            )
        )
        time.sleep(1.5)

    def match_open(row: dict) -> bool:
        code = (row.get("division_code") or "").upper()
        if code == open_code:
            return True
        # wins often lack code but have label
        if row.get("class_bucket") == "open":
            label = (row.get("division") or "").lower()
            if open_code == "FPO":
                return "women" in label or code == "FPO"
            return "women" not in label

    open_results = [r for r in results if match_open(r)]
    am_results = [r for r in results if r.get("class_bucket") == "amateur"]
    open_wins = [w for w in wins if match_open(w)]
    am_wins = [w for w in wins if w.get("class_bucket") == "amateur"]
    # keep recent lists newest-first
    open_results.sort(
        key=lambda r: (r.get("year") or "", r.get("dates") or ""), reverse=True
    )
    am_results.sort(
        key=lambda r: (r.get("year") or "", r.get("dates") or ""), reverse=True
    )
    results.sort(
        key=lambda r: (r.get("year") or "", r.get("dates") or ""), reverse=True
    )

    open_places = [r["place"] for r in open_results]
    am_places = [r["place"] for r in am_results]
    all_places = [r["place"] for r in results]

    splits = {
        "open": {
            "label": open_code,
            "finishes": summarize(open_places, wins_count=len(open_wins) or None),
            "year_finishes": year_series(open_results, open_wins),
            "recent_results": open_results[:20],
            "wins_list": open_wins[:40],
        },
        "amateur": {
            "label": "Amateur",
            "finishes": summarize(am_places, wins_count=len(am_wins) or None),
            "year_finishes": year_series(am_results, am_wins),
            "recent_results": am_results[:20],
            "wins_list": am_wins[:40],
        },
        "all": {
            "label": "All",
            "finishes": summarize(all_places, wins_count=career["career_wins"] or len(wins)),
            "year_finishes": year_series(results, wins),
            "recent_results": results[:20],
            "wins_list": wins[:40],
        },
    }
    # default aggregate stays open-first for pros
    default = splits["open"] if splits["open"]["finishes"]["events_tracked"] else splits["all"]

    return {
        "pdga_number": num,
        "open_division": open_code,
        "career": career,
        "finishes": default["finishes"],
        "year_finishes": default["year_finishes"],
        "wins_list": default["wins_list"],
        "rating_history": history[:100],
        "recent_results": default["recent_results"],
        "all_results_count": len(results),
        "splits": splits,
    }


def main() -> None:
    players = json.loads(PLAYERS.read_text())
    # force full rebuild for division splits
    enriched: dict = {}
    print("rebuilding", len(players), "players with open/amateur splits", flush=True)
    time.sleep(3)
    for i, p in enumerate(players):
        num = p["pdga_number"]
        name = p.get("display_name") or f"{p['first_name']} {p['last_name']}"
        print(f"[{i + 1}/{len(players)}] {name} #{num} ({p.get('division')})", flush=True)
        try:
            enriched[num] = enrich_player(p)
            OUT.write_text(json.dumps(enriched, indent=2))
            s = enriched[num]["splits"]
            print(
                "  open",
                s["open"]["finishes"]["events_tracked"],
                "ev /",
                s["open"]["finishes"]["wins"],
                "W · am",
                s["amateur"]["finishes"]["events_tracked"],
                "ev /",
                s["amateur"]["finishes"]["wins"],
                "W",
                flush=True,
            )
            time.sleep(3.5)
        except Exception as e:  # noqa: BLE001
            print("  FAIL", type(e).__name__, e, flush=True)
            time.sleep(20)
    print("DONE", len(enriched), flush=True)


if __name__ == "__main__":
    main()
