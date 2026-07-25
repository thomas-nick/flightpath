/**
 * Public PDGA player-page career header (no API login required).
 * Complements the Asia tournament archive with official career totals.
 */

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export type PdgaCareerHeader = {
  rating: number | null;
  career_events: number | null;
  career_wins: number | null;
  classification: string | null;
  city: string | null;
  state_prov: string | null;
  country: string | null;
  membership_status: string | null;
};

function num(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const n = Number(String(raw).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

export async function fetchPdgaCareerHeader(
  pdga: number | string,
): Promise<PdgaCareerHeader | null> {
  try {
    const res = await fetch(`https://www.pdga.com/player/${pdga}`, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!res.ok) return null;
    const html = await res.text();

    const rating =
      num(
        html.match(
          /Current Rating:<\/strong>\s*([0-9]+)(?:\s*<[^>]*>)?(?:\s*[+\-]?\d+)?/i,
        )?.[1],
      ) ??
      num(html.match(/current-rating[^>]*>[\s\S]*?<strong>[^<]*<\/strong>\s*([0-9]+)/i)?.[1]);

    const career_events = num(
      html.match(/Career Events:<\/strong>\s*([0-9,]+)/i)?.[1],
    );
    const career_wins = num(
      html.match(/Career Wins:<\/strong>\s*(?:<a[^>]*>)?([0-9,]+)/i)?.[1],
    );
    const classification =
      html.match(/Classification:<\/strong>\s*([^<\n]+)/i)?.[1]?.trim() ?? null;
    const membership_status =
      html
        .match(/Membership Status:<\/strong>\s*([^<\n]+)/i)?.[1]
        ?.replace(/\s+/g, " ")
        .trim() ?? null;

    const location =
      html.match(/Location:<\/strong>\s*([^<\n]+)/i)?.[1]?.trim() ?? "";
    const parts = location.split(",").map((s) => s.trim()).filter(Boolean);

    return {
      rating,
      career_events,
      career_wins,
      classification,
      city: parts[0] || null,
      state_prov: parts.length >= 3 ? parts[1] : null,
      country: parts[parts.length - 1] || null,
      membership_status,
    };
  } catch {
    return null;
  }
}
