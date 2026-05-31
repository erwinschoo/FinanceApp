import type { CSSProperties, ReactNode } from "react";

type Side = "top" | "right" | "bottom" | "left";

/* Herbruikbare "pretty tooltip" — dezelfde stijl als de zijbalk-tip (.nav-tip), nu als atom.
 * Wrapt een element en toont een popover op hover/focus. Op touch (≤860px) verborgen via CSS.
 * Gebruik dit i.p.v. een kale `title="..."` zodat tooltips overal consistent zijn.
 * `style`/`className` gaan naar de wrapper, zodat die layout-rollen (bv. marginLeft:auto) kan dragen. */
export function Tooltip({
  label, side = "top", className, style, children,
}: {
  label: ReactNode;
  side?: Side;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <span className={"tip-wrap" + (className ? " " + className : "")} style={style}>
      {children}
      <span className={"tooltip tooltip--" + side} role="tooltip">{label}</span>
    </span>
  );
}
