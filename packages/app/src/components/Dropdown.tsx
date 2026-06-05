import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Ic } from "./Ic";

export interface DropdownOption {
  value: string;
  label: string;
  color?: string;   // optioneel kleurbolletje (zoals categorieën)
  group?: string;   // optionele groepskop
  divider?: boolean; // render een scheidingslijn vóór deze optie
}

/* Gestylede dropdown in dezelfde stijl als de categorie-dropdown (cat-menu).
 * Generiek bruikbaar voor maand- en categorie-selectie.
 *
 * floating=true rendert het menu in een portal met position:fixed, berekend t.o.v. de trigger.
 * Zo wordt het menu niet afgekapt door een overflow-/scroll-container (bv. de spaardoel-ribbon).
 * Een eigen trigger (bv. een actie-knop i.p.v. een waarde-selectie) kan via `trigger`. */
export function Dropdown({
  value, onChange, options, ariaLabel, minWidth = 188, fullWidth = false,
  disabled = false, floating = false, align = "left", menuHeader, trigger,
  className, style,
}: {
  value: string;
  onChange: (v: string) => void;
  options: DropdownOption[];
  ariaLabel?: string;
  minWidth?: number;
  fullWidth?: boolean;
  disabled?: boolean;
  floating?: boolean;
  align?: "left" | "right";              // uitlijning van het zwevende menu t.o.v. de trigger
  menuHeader?: string;                   // optionele kop bovenaan het menu
  trigger?: (state: { open: boolean }) => ReactNode;  // eigen trigger-inhoud i.p.v. .dd-trigger
  className?: string;                    // extra class op de .cat-select-wrapper
  style?: CSSProperties;                 // extra stijl op de wrapper (bv. flex in een ribbon)
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left?: number; right?: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function h(e: MouseEvent) {
      const t = e.target as Node;
      // ook het geportaleerde menu negeren — dat zit buiten de wrapper-subtree
      if (ref.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    if (open) document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  function toggle() {
    if (disabled) return;
    if (!open && floating && ref.current) {
      const r = ref.current.getBoundingClientRect();
      // Laag in beeld → opwaarts openen, zodat het menu niet onder de schermrand wegvalt.
      const openUp = r.bottom > window.innerHeight * 0.6;
      const vert = openUp ? { bottom: window.innerHeight - r.top + 6 } : { top: r.bottom + 6 };
      setPos(align === "right"
        ? { ...vert, right: Math.max(8, window.innerWidth - r.right) }
        : { ...vert, left: r.left });
    }
    setOpen((o) => !o);
  }

  const selected = options.find((o) => o.value === value);

  let lastGroup: string | undefined;
  const menuItems = (
    <>
      {menuHeader && <div className="cat-group">{menuHeader}</div>}
      {options.map((o) => {
        const header = o.group && o.group !== lastGroup ? o.group : null;
        lastGroup = o.group;
        return (
          <div key={o.value}>
            {o.divider && <div className="cat-div" />}
            {header && <div className="cat-group">{header}</div>}
            <button
              type="button"
              className={"cat-opt" + (o.value === value ? " sel" : "")}
              onClick={() => { onChange(o.value); setOpen(false); }}
            >
              {o.color !== undefined && <span className="dot" style={{ background: o.color || "var(--faint)" }}></span>}
              {o.label}
              {o.value === value && <span className="ck"><Ic name="check" size={15} /></span>}
            </button>
          </div>
        );
      })}
    </>
  );

  const wrapStyle = fullWidth ? { width: "100%", ...style } : style;

  return (
    <div className={"cat-select" + (className ? " " + className : "")} ref={ref} style={wrapStyle}>
      {trigger ? (
        <button type="button" aria-label={ariaLabel} disabled={disabled} onClick={toggle}
          style={{ border: 0, background: "transparent", padding: 0, margin: 0, font: "inherit", color: "inherit",
            display: "block", width: fullWidth ? "100%" : undefined, height: "100%", textAlign: "inherit",
            cursor: disabled ? "default" : "pointer" }}>
          {trigger({ open })}
        </button>
      ) : (
        <button type="button" className="dd-trigger" aria-label={ariaLabel} disabled={disabled} onClick={toggle}
          style={fullWidth ? { width: "100%" } : undefined}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            {selected?.color && <span className="dd-dot" style={{ background: selected.color }}></span>}
            <span className="dd-lbl" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selected?.label ?? ""}</span>
          </span>
          <Ic name="chevronDown" size={15} style={fullWidth ? { marginLeft: "auto" } : undefined} />
        </button>
      )}

      {open && (floating
        ? createPortal(
            <div ref={menuRef} className="cat-menu scroll"
              style={{ position: "fixed", top: pos?.top ?? "auto", bottom: pos?.bottom ?? "auto",
                left: pos?.left ?? "auto", right: pos?.right ?? "auto",
                minWidth, maxHeight: "min(60vh,360px)" }}>
              {menuItems}
            </div>,
            document.body,
          )
        : (
          <div className="cat-menu scroll" style={{ minWidth }}>
            {menuItems}
          </div>
        ))}
    </div>
  );
}
