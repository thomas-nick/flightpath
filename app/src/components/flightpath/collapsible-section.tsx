import type { ReactNode } from "react";

/** Native <details>-based collapsible section. Lightweight, accessible,
 *  works without JS, and styles cleanly with a rotating chevron. */
export function CollapsibleSection({
  title,
  subtitle,
  count,
  defaultOpen = false,
  className,
  children,
}: {
  title: string;
  subtitle?: string;
  count?: number;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <details
      className={`fp-section fp-collapsible ${className ?? ""}`}
      open={defaultOpen}
    >
      <summary className="fp-section-head fp-collapsible-head">
        <span className="fp-collapsible-titles">
          <h2>{title}</h2>
          {subtitle && <p className="fp-muted">{subtitle}</p>}
        </span>
        {count != null && (
          <span className="fp-collapsible-count">{count}</span>
        )}
        <span className="fp-collapsible-chevron" aria-hidden>
          <svg viewBox="0 0 12 12" width="12" height="12" fill="none">
            <path
              d="M3 4.5L6 7.5L9 4.5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </summary>
      <div className="fp-collapsible-body">{children}</div>
    </details>
  );
}
