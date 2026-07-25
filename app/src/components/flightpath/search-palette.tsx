import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { searchAsia, type SearchHit } from "../../lib/search";

export function SearchPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("fp:open-search", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("fp:open-search", onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      const id = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [open]);

  const results = useMemo(() => searchAsia(query), [query]);
  const flat = useMemo<SearchHit[]>(
    () => [...results.players, ...results.countries, ...results.events, ...results.courses],
    [results],
  );

  useEffect(() => {
    setActive((a) => (a >= flat.length ? 0 : a));
  }, [flat.length]);

  useEffect(() => {
    if (!open) return;
    const el = panelRef.current?.querySelector<HTMLElement>(
      `[data-idx="${active}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  if (!open) return null;

  function go(hit: SearchHit) {
    setOpen(false);
    if (hit.type === "player") {
      void navigate({ to: "/players/$slug", params: { slug: hit.slug } });
    } else if (hit.type === "country") {
      void navigate({ to: "/countries/$key", params: { key: hit.slug } });
    } else if (hit.type === "course") {
      void navigate({ to: "/courses/$slug", params: { slug: hit.slug } });
    } else {
      window.open(
        `https://www.pdga.com/tour/event/${hit.event_id}`,
        "_blank",
        "noreferrer",
      );
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, Math.max(flat.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = flat[active];
      if (hit) go(hit);
    }
  }

  let idx = -1;
  const offset = (n: number) => {
    idx += n;
    return idx;
  };

  return (
    <div
      className="fp-search-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Search Flightpath Asia"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="fp-search-panel" ref={panelRef}>
        <div className="fp-search-input-wrap">
          <span className="fp-search-icon" aria-hidden>
            ⌕
          </span>
          <input
            ref={inputRef}
            className="fp-search-input"
            placeholder="Search players, countries, events…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="fp-search-kbd" aria-hidden>
            Esc
          </kbd>
        </div>

        <div className="fp-search-body">
          {flat.length === 0 ? (
            <p className="fp-search-empty">
              {query
                ? "No matches in the Asia archive."
                : "Start typing a name, country, or event."}
            </p>
          ) : (
            <>
              {results.players.length > 0 && (
                <Section label="Players">
                  {results.players.map((hit) => {
                    const i = offset(1);
                    return (
                      <HitRow
                        key={`p-${hit.pdga}`}
                        hit={hit}
                        index={i}
                        active={i === active}
                        onPick={go}
                      />
                    );
                  })}
                </Section>
              )}
              {results.countries.length > 0 && (
                <Section label="Countries">
                  {results.countries.map((hit) => {
                    const i = offset(1);
                    return (
                      <HitRow
                        key={`c-${hit.key}`}
                        hit={hit}
                        index={i}
                        active={i === active}
                        onPick={go}
                      />
                    );
                  })}
                </Section>
              )}
              {results.events.length > 0 && (
                <Section label="Events">
                  {results.events.map((hit) => {
                    const i = offset(1);
                    return (
                      <HitRow
                        key={`e-${hit.event_id}`}
                        hit={hit}
                        index={i}
                        active={i === active}
                        onPick={go}
                      />
                    );
                  })}
                </Section>
              )}
              {results.courses.length > 0 && (
                <Section label="Courses">
                  {results.courses.map((hit) => {
                    const i = offset(1);
                    return (
                      <HitRow
                        key={`co-${hit.slug}`}
                        hit={hit}
                        index={i}
                        active={i === active}
                        onPick={go}
                      />
                    );
                  })}
                </Section>
              )}
            </>
          )}
        </div>

        <div className="fp-search-foot">
          <span>
            <kbd>↑</kbd> <kbd>↓</kbd> navigate
          </span>
          <span>
            <kbd>↵</kbd> open
          </span>
          <span>
            <kbd>Esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="fp-search-section">
      <p className="fp-search-section-label">{label}</p>
      {children}
    </div>
  );
}

function HitRow({
  hit,
  index,
  active,
  onPick,
}: {
  hit: SearchHit;
  index: number;
  active: boolean;
  onPick: (hit: SearchHit) => void;
}) {
  return (
    <button
      type="button"
      data-idx={index}
      className={`fp-search-row${active ? " is-active" : ""}`}
      onMouseEnter={() => {
        /* parent tracks active via arrow keys; hover handled by CSS */
      }}
      onClick={() => onPick(hit)}
    >
      <span className="fp-search-row-mark" aria-hidden>
        {hit.type === "player"
          ? hit.flag
          : hit.type === "country"
            ? hit.flag
            : hit.type === "course"
              ? hit.flag
              : hit.tier || "C"}
      </span>
      <span className="fp-search-row-copy">
        <strong>
          {hit.type === "player"
            ? hit.name
            : hit.type === "country"
              ? hit.name
              : hit.type === "course"
                ? hit.name
                : hit.title}
        </strong>
        <span>{hit.subtitle}</span>
      </span>
      <span className="fp-search-row-arrow" aria-hidden>
        →
      </span>
    </button>
  );
}
