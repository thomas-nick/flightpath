const KEY = "fp:compare";
export const COMPARE_MAX = 3;
const CHANGE = "fp:compare-change";

export function getCompare(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : null;
    return Array.isArray(arr) ? (arr as string[]).slice(0, COMPARE_MAX) : [];
  } catch {
    return [];
  }
}

function save(slugs: string[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(slugs));
  } catch {
    /* ignore quota / privacy mode */
  }
  window.dispatchEvent(new CustomEvent(CHANGE));
}

export function addToCompare(slug: string) {
  const cur = getCompare();
  if (cur.includes(slug)) return;
  save([...cur, slug].slice(-COMPARE_MAX));
}

export function removeFromCompare(slug: string) {
  save(getCompare().filter((s) => s !== slug));
}

export function clearCompare() {
  save([]);
}

export function subscribeCompare(cb: () => void) {
  const handler = () => cb();
  window.addEventListener(CHANGE, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(CHANGE, handler);
    window.removeEventListener("storage", handler);
  };
}
