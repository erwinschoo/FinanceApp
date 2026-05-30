import { useEffect, useRef, useState } from "react";
import { useApp } from "../state/AppContext";
import { CatTag } from "./CatTag";
import { Ic } from "./Ic";
import type { Category } from "../db/types";

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

  const byName = (a: Category, b: Category) => a.name.localeCompare(b.name, "nl");
  const tops = categories.filter((c) => !c.parentId && c.id !== "inkomen").sort(byName);
  const childrenOf = (id: string) => categories.filter((c) => c.parentId === id).sort(byName);

  function opt(c: Category) {
    return (
      <button key={c.id} className={"cat-opt" + (value === c.id ? " sel" : "")} onClick={() => { onChange(c.id); setOpen(false); }}>
        <span className="dot" style={{ background: c.color }}></span>
        {c.name}
        {value === c.id && <span className="ck"><Ic name="check" size={15} /></span>}
      </button>
    );
  }

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
          {tops.map((c) => {
            const kids = childrenOf(c.id);
            if (kids.length === 0) return opt(c);
            return (
              <div key={c.id}>
                <div className="cat-group">{c.name}</div>
                {kids.map(opt)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
