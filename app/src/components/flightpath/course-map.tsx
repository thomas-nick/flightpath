import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useLeaflet } from "../../lib/use-leaflet";
import type { Course } from "../../lib/courses";

export type MapPoint = {
  slug: string;
  name: string;
  lat: number;
  lon: number;
  flag?: string;
  sub?: string;
};

function toPoints(courses: Course[]): MapPoint[] {
  return courses
    .filter((c) => c.lat != null && c.lon != null)
    .map((c) => ({
      slug: c.slug,
      name: c.name,
      lat: c.lat as number,
      lon: c.lon as number,
      flag: c.flag,
      sub: [c.region, c.country].filter(Boolean).join(", "),
    }));
}

export function CourseMap({
  courses,
  focusSlug,
  className,
  height = 360,
  nearby,
}: {
  courses: Course[];
  focusSlug?: string;
  className?: string;
  height?: number;
  /** Extra courses (e.g. nearby) to layer on top, styled distinctly. */
  nearby?: Course[];
}) {
  const L = useLeaflet();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<unknown>(null);

  useEffect(() => {
    if (!L || !containerRef.current) return;
    if (mapRef.current) return; // guard against double-init in strict mode

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const map = L.map(containerRef.current, {
      scrollWheelZoom: false,
      zoomControl: true,
      attributionControl: true,
    }) as any;
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    const all = [...toPoints(courses), ...toPoints(nearby ?? [])];
    const focus = focusSlug ? all.find((p) => p.slug === focusSlug) : undefined;
    const focusSet = new Set(focus ? [focus.slug] : []);

    const latlngs: [number, number][] = [];
    for (const p of all) {
      const isFocus = focusSet.has(p.slug);
      const marker = L.circleMarker([p.lat, p.lon], {
        radius: isFocus ? 8 : 5,
        color: "#16382c",
        fillColor: isFocus ? "#d8e8de" : "#7fae8e",
        fillOpacity: 0.9,
        weight: isFocus ? 2 : 1,
      });
      marker.bindPopup(() => {
        const root = document.createElement("div");
        root.className = "fp-map-popup";
        const a = document.createElement("a");
        a.href = `/courses/${p.slug}`;
        a.className = "fp-map-popup-link";
        const flag = document.createElement("span");
        flag.className = "fp-map-popup-flag";
        flag.textContent = p.flag ? ` ${p.flag} ` : "";
        const name = document.createElement("strong");
        name.textContent = p.name;
        a.appendChild(flag);
        a.appendChild(name);
        a.addEventListener("click", (ev) => {
          ev.preventDefault();
          navigate({ to: "/courses/$slug", params: { slug: p.slug } });
          map.closePopup();
        });
        root.appendChild(a);
        if (p.sub) {
          const sub = document.createElement("div");
          sub.className = "fp-map-popup-sub";
          sub.textContent = p.sub;
          root.appendChild(sub);
        }
        return root;
      });
      marker.addTo(map);
      latlngs.push([p.lat, p.lon]);
    }

    if (focus) {
      map.setView([focus.lat, focus.lon], 12);
    } else if (latlngs.length > 1) {
      map.fitBounds(L.latLngBounds(latlngs).pad(0.1), { maxZoom: 12 });
    } else if (latlngs.length === 1) {
      map.setView(latlngs[0], 12);
    } else {
      map.setView([20, 100], 3); // Asia overview
    }

    // ensure tiles render after layout
    const t = setTimeout(() => map.invalidateSize(), 100);
    return () => {
      clearTimeout(t);
      map.remove();
      mapRef.current = null;
    };
  }, [L, courses, nearby, focusSlug, navigate]);

  if (!L) {
    return (
      <div
        className={`fp-course-map-fallback ${className ?? ""}`}
        style={{ height }}
        aria-label="Loading map"
      />
    );
  }

  return (
    <div
      ref={containerRef}
      className={className ?? "fp-course-leaflet"}
      style={{ height }}
      aria-label="Course map"
    />
  );
}
