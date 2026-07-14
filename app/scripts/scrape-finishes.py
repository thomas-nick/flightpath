#!/usr/bin/env python3
"""Scrape PDGA public pages for wins, places, and rating history."""

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


def get(url: str, retries: int = 7) -> str:
    last: Exception | None = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9"},
            )
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read().decode("utf-8", errors="replace")
        except urllib.error.HTTPError as e:
            last = e
            if e.code in (429, 503, 502):
                wait = min(120, 10 * (2**attempt))
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


def parse_results_table(html: str) -> list[dict]:
    out: list[dict] = []
    for table in re.findall(r"<table[^>]*>(.*?)</table>", html, re.I | re.S):
        headers = [
            clean(h).lower()
            for h in re.findall(r"<th[^>]*>(.*?)</th>", table, re.I | re.S)
        ]
        if "place" not in headers or "tournament" not in headers:
            continue
        idx = {h: i for i, h in enumerate(headers)}
        for row in re.findall(r"<tr[^>]*>(.*?)</tr>", table, re.I | re.S)[1:]:
            cells = [
                clean(c)
                for c in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", row, re.I | re.S)
            ]
            if len(cells) < 4:
                continue
            try:
                place = int(re.match(r"(\d+)", cells[idx["place"]]).group(1))
            except Exception:
                continue
            dates = ""
            if "dates" in idx:
                dates = cells[idx["dates"]]
            elif "date" in idx:
                dates = cells[idx["date"]]
            href = re.search(r'href="(/tour/event/\d+[^"]*)"', row)
            out.append(
                {
                    "place": place,
                    "points": float(
                        re.sub(
                            r"[^0-9.]",
                            "",
                            cells[idx["points"]] if "points" in idx else "0",
                        )
                        or 0
                    ),
                    "tournament": cells[idx["tournament"]],
                    "tier": cells[idx["tier"]] if "tier" in idx else "",
                    "dates": dates,
                    "year": year_from_dates(dates),
                    "prize": parse_money(cells[idx["prize"]]) if "prize" in idx else 0,
                    "event_url": (
                        "https://www.pdga.com" + href.group(1).split("#")[0]
                        if href
                        else None
                    ),
                }
            )
    return out


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
            d = clean(date.group(1))
            rt = clean(rating.group(1))
            if not rt.isdigit():
                continue
            rows.append(
                {
                    "date": d,
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
            tier = re.search(r'class="tier"[^>]*>(.*?)</td>', row, re.I | re.S)
            prize = re.search(r'class="prize"[^>]*>(.*?)</td>', row, re.I | re.S)
            href = re.search(r'href="(/tour/event/\d+[^"]*)"', row)
            if not (dates and tourney):
                continue
            d = clean(dates.group(1))
            out.append(
                {
                    "dates": d,
                    "year": year_from_dates(d),
                    "tournament": clean(tourney.group(1)),
                    "tier": clean(tier.group(1)) if tier else "",
                    "prize": parse_money(clean(prize.group(1)) if prize else ""),
                    "event_url": (
                        "https://www.pdga.com" + href.group(1).split("#")[0]
                        if href
                        else None
                    ),
                }
            )
    return out


def enrich_player(p: dict) -> dict:
    num = p["pdga_number"]
    profile = get(f"https://www.pdga.com/player/{num}")
    time.sleep(1.5)
    career = parse_career(profile)
    wins = parse_wins(get(f"https://www.pdga.com/player/{num}/wins"))
    time.sleep(1.5)
    history = parse_rating_history(get(f"https://www.pdga.com/player/{num}/history"))
    time.sleep(1.5)

    years = sorted(
        {s.get("year") for s in p.get("stats") or [] if s.get("year")}
        | {w.get("year") for w in wins if w.get("year")}
    )
    recent = years[-6:] if len(years) > 6 else years
    results: list[dict] = []
    for y in recent:
        results.extend(
            parse_results_table(get(f"https://www.pdga.com/player/{num}/stats/{y}"))
        )
        time.sleep(1.4)

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

    wins_by_year = collections.Counter(w["year"] for w in wins if w.get("year"))
    year_keys = set(by_year) | set(wins_by_year)
    year_series = []
    for y in sorted(year_keys):
        b = by_year[y]
        avg = sum(b["places"]) / len(b["places"]) if b["places"] else None
        year_series.append(
            {
                "year": y,
                "events": b["events"],
                "wins": max(b["wins"], wins_by_year.get(y, 0)),
                "podiums": b["podiums"],
                "top5": b["top5"],
                "top10": b["top10"],
                "top20": b["top20"],
                "avg_place": round(avg, 2) if avg is not None else None,
            }
        )

    places = [r["place"] for r in results]
    n = len(places) or 1
    finishes = {
        "events_tracked": len(results),
        "wins": career["career_wins"] or len(wins),
        "podiums": sum(1 for x in places if x <= 3),
        "top5": sum(1 for x in places if x <= 5),
        "top10": sum(1 for x in places if x <= 10),
        "top20": sum(1 for x in places if x <= 20),
        "win_rate": round(100 * sum(1 for x in places if x == 1) / n, 1)
        if places
        else 0,
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
    return {
        "pdga_number": num,
        "career": career,
        "finishes": finishes,
        "year_finishes": year_series,
        "wins_list": wins[:40],
        "rating_history": history[:100],
        "recent_results": results[:20],
        "all_results_count": len(results),
    }


def main() -> None:
    players = json.loads(PLAYERS.read_text())
    enriched = json.loads(OUT.read_text()) if OUT.exists() else {}
    pending = [p for p in players if "finishes" not in enriched.get(p["pdga_number"], {})]
    print("pending", len(pending), flush=True)
    if pending:
        time.sleep(5)
    for i, p in enumerate(pending):
        num = p["pdga_number"]
        name = p.get("display_name") or f"{p['first_name']} {p['last_name']}"
        print(f"[{i + 1}/{len(pending)}] {name} #{num}", flush=True)
        try:
            enriched[num] = enrich_player(p)
            OUT.write_text(json.dumps(enriched, indent=2))
            f = enriched[num]["finishes"]
            print(
                "  wins",
                f["wins"],
                "podiums",
                f["podiums"],
                "top10",
                f["top10"],
                "tracked",
                f["events_tracked"],
                flush=True,
            )
            time.sleep(4)
        except Exception as e:  # noqa: BLE001
            print("  FAIL", type(e).__name__, e, flush=True)
            time.sleep(20)
    ok = sum(1 for v in enriched.values() if "finishes" in v)
    print("DONE ok", ok, "total", len(enriched), flush=True)


if __name__ == "__main__":
    main()
