import process from "node:process";

const BASE = "https://api.pdga.com";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

type LoginResponse = {
  sessid: string;
  session_name: string;
  token: string;
};

let cached: { cookie: string; token: string; expires: number } | null = null;

function creds() {
  const username = process.env.PDGA_USERNAME;
  const password = process.env.PDGA_PASSWORD;
  if (!username || !password) {
    throw new Error("PDGA_USERNAME and PDGA_PASSWORD must be set");
  }
  return { username, password };
}

async function login(): Promise<{ cookie: string; token: string }> {
  if (cached && cached.expires > Date.now()) {
    return { cookie: cached.cookie, token: cached.token };
  }
  const { username, password } = creds();
  const res = await fetch(`${BASE}/services/json/user/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": UA,
      Origin: "https://www.pdga.com",
      Referer: "https://www.pdga.com/",
    },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    throw new Error(`PDGA login failed: ${res.status}`);
  }
  const data = (await res.json()) as LoginResponse;
  const cookie = `${data.session_name}=${data.sessid}`;
  cached = { cookie, token: data.token, expires: Date.now() + 1000 * 60 * 25 };
  return { cookie, token: data.token };
}

async function pdgaGet<T>(path: string): Promise<T> {
  const { cookie } = await login();
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": UA,
      Cookie: cookie,
      Origin: "https://www.pdga.com",
      Referer: "https://www.pdga.com/",
    },
  });
  if (!res.ok) {
    cached = null;
    throw new Error(`PDGA GET ${path} failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

export type PdgaPlayer = {
  pdga_number: string;
  first_name: string;
  last_name: string;
  city?: string;
  state_prov?: string;
  country?: string;
  classification?: string;
  membership_status?: string;
  rating?: string;
  rating_effective_date?: string;
  official_status?: string;
  upcoming_events?: string;
};

export type PdgaYearStat = {
  year: string;
  class?: string;
  division_code?: string;
  division_name?: string;
  gender?: string;
  rating?: string;
  rating_rounds_used?: string;
  tournaments?: string;
  points?: string;
  prize?: string;
  country?: string;
  state_prov?: string;
  first_name?: string;
  last_name?: string;
  pdga_number?: string;
  last_modified?: string;
};

export async function fetchPlayer(pdgaNumber: string) {
  const data = await pdgaGet<{ players: PdgaPlayer[] }>(
    `/services/json/players?pdga_number=${encodeURIComponent(pdgaNumber)}`,
  );
  return data.players?.[0] ?? null;
}

export async function fetchPlayerStatistics(pdgaNumber: string) {
  const data = await pdgaGet<{ players: PdgaYearStat[] }>(
    `/services/json/player-statistics?pdga_number=${encodeURIComponent(pdgaNumber)}&limit=50`,
  );
  return data.players ?? [];
}
