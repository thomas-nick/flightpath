import { useEffect, useState } from "react";

// Leaflet is loaded from CDN at runtime (the project is bun-managed and we
// avoid adding a build dependency). This singleton injects the CSS + JS once
// and resolves to the global `L`.
const LEAFLET_VERSION = "1.9.4";
const LEAFLET_CSS = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.css`;
const LEAFLET_JS = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.js`;

// Minimal, permissive type — the full Leaflet typings aren't bundled.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LeafletNS = any;

let loader: Promise<LeafletNS> | null = null;

function loadLeaflet(): Promise<LeafletNS> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (loader) return loader;
  loader = new Promise<LeafletNS>((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    if (w.L) {
      resolve(w.L);
      return;
    }
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = LEAFLET_CSS;
    document.head.appendChild(css);

    const script = document.createElement("script");
    script.src = LEAFLET_JS;
    script.async = true;
    script.onload = () => {
      if (w.L) resolve(w.L);
      else reject(new Error("Leaflet loaded but global L missing"));
    };
    script.onerror = () => reject(new Error("Failed to load Leaflet from CDN"));
    document.head.appendChild(script);
  });
  return loader;
}

/** Returns the Leaflet global once it's loaded, or null while loading / on SSR. */
export function useLeaflet(): LeafletNS | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [L, setL] = useState<LeafletNS | null>(
    typeof window !== "undefined" ? (window as any).L ?? null : null,
  );
  useEffect(() => {
    let alive = true;
    loadLeaflet()
      .then((lib) => {
        if (alive) setL(lib);
      })
      .catch(() => {
        /* leave L null; map renders a fallback */
      });
    return () => {
      alive = false;
    };
  }, []);
  return L;
}
