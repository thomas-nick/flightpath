import playersJson from "../data/players.json";

export type YearStat = {
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
};

export type Player = {
  pdga_number: string;
  first_name: string;
  last_name: string;
  display_name?: string;
  slug: string;
  city?: string | null;
  state_prov?: string | null;
  country?: string | null;
  classification?: string | null;
  membership_status?: string | null;
  rating?: string | null;
  rating_effective_date?: string | null;
  official_status?: string | null;
  upcoming_events?: string | null;
  division: "MPO" | "FPO";
  accent?: number;
  career: {
    years_active: number;
    tournaments: number;
    points: number;
    prize: number;
    peak_rating: number;
    latest_year: string | null;
  };
  stats: YearStat[];
};

const players = playersJson as unknown as Player[];

export function getPlayers(division?: "MPO" | "FPO" | "ALL") {
  if (!division || division === "ALL") return players;
  return players.filter((p) => p.division === division);
}

export function getPlayerBySlug(slug: string) {
  return players.find((p) => p.slug === slug) ?? null;
}

export function getPlayerByNumber(pdgaNumber: string) {
  return players.find((p) => p.pdga_number === String(pdgaNumber)) ?? null;
}

export function playerName(p: Player) {
  return p.display_name || `${p.first_name} ${p.last_name}`;
}

export function playerLocation(p: Player) {
  return [p.city, p.state_prov, p.country].filter(Boolean).join(", ");
}

export function pdgaProfileUrl(pdgaNumber: string) {
  return `https://www.pdga.com/player/${pdgaNumber}`;
}

export function formatMoney(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatNumber(n: number) {
  return new Intl.NumberFormat("en-US").format(n);
}

export const ACCENT_GRADIENTS = [
  "linear-gradient(135deg, #16382C 0%, #2F6B52 45%, #C6E85A 100%)",
  "linear-gradient(145deg, #0F2420 0%, #3A6E58 50%, #D7E3DA 100%)",
  "linear-gradient(160deg, #1A4032 0%, #C6E85A 55%, #F2F5F0 100%)",
  "linear-gradient(120deg, #121816 0%, #16382C 40%, #8FBF4A 100%)",
  "linear-gradient(150deg, #244C3A 0%, #6FA86A 50%, #E8F0E4 100%)",
  "linear-gradient(135deg, #102820 0%, #C6E85A 35%, #16382C 100%)",
] as const;
