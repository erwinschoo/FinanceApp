import { useEffect, useRef, useState } from "react";
import { useApp } from "../state/AppContext";
import { CatTag } from "./CatTag";
import { Ic } from "./Ic";

export function CatSelect({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const { categories } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  const opts = categories.filter((c) => c.id !== "inkomen");
  return (
    <div className="cat-select" ref={ref}>
      <button style={{ border: 0, background: "transparent", padding: 0, cursor: "pointer" }} onClick={() => setOpen((o) => !o)}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <CatTag catId={value} />
          <Ic name="chevronDown" size={14} style={{ color: "var(--faint)" }} />
        </span>
      </button>
      {open && (
        <div className="cat-menu scroll">
          {opts.map((c) => (
            <button key={c.id} className={"cat-opt" + (value === c.id ? " sel" : "")} onClick={() => { onChange(c.id); setOpen(false); }}>
              <span className="dot" style={{ background: c.color }}></span>
              {c.name}
              {value === c.id && <span className="ck"><Ic name="check" size={15} /></span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
