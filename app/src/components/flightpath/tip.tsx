import type { ReactNode } from "react";

type TipProps = {
  text: string;
  children: ReactNode;
  className?: string;
  /** Prefer "top" when the tip sits near the bottom of the viewport. */
  side?: "top" | "bottom";
  /** Set true for standalone labels (stats). Keep false inside buttons/links. */
  focusable?: boolean;
};

/** Hover / focus description for scoring metrics. */
export function Tip({
  text,
  children,
  className,
  side = "top",
  focusable = false,
}: TipProps) {
  return (
    <span
      className={`fp-tip fp-tip-${side}${className ? ` ${className}` : ""}`}
      tabIndex={focusable ? 0 : undefined}
    >
      {children}
      <span className="fp-tip-bubble" role="tooltip">
        {text}
      </span>
    </span>
  );
}
