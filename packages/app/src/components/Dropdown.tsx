import { useEffect, useRef, useState } from "react";
import { Ic } from "./Ic";

export interface DropdownOption {
  value: string;
  label: string;
  color?: string;   // optioneel kleurbolletje (zoals categorieën)
  group?: string;   // optionele groepskop
}

/* Gestylede dropdown in dezelfde stijl als de categorie-dropdown (cat-menu).
 * Generiek bruikbaar voor maand- en categorie-selectie. */
export function Dropdown({
  value, onChange, options, ariaLabel, minWidth = 188, fullWidth = false,
}: {
  value: string;
  onChange: (v: string) => void;
  options: DropdownOption[];
  ariaLabel?: string;
  minWidth?: number;
  fullWidth?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const selected = options.find((o) => o.value === value);

  let lastGroup: string | undefined;
  return (
    <div className="cat-select" ref={ref} style={fullWidth ? { width: "100%" } : undefined}>
      <button type="button" className="dd-trigger" aria-label={ariaLabel} onClick={() => setOpen((o) => !o)}
        style={fullWidth ? { width: "100%" } : undefined}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          {selected?.color && <span className="dd-dot" style={{ background: selected.color }}></span>}
          <span className="dd-lbl" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selected?.label ?? ""}</span>
        </span>
        <Ic name="chevronDown" size={15} style={fullWidth ? { marginLeft: "auto" } : undefined} />
      </button>
      {open && (
        <div className="cat-menu scroll" style={{ minWidth }}>
          {options.map((o) => {
            const header = o.group && o.group !== lastGroup ? o.group : null;
            lastGroup = o.group;
            return (
              <div key={o.value}>
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
        </div>
      )}
    </div>
  );
}
