import { useApp } from "../state/AppContext";
import { catTint } from "../lib/catColor";

export function CatTag({ catId, small }: { catId: string; small?: boolean }) {
  const { catMap } = useApp();
  const c = catMap[catId];
  if (!c)
    return (
      <span className="tag" style={{ background: "var(--orange-soft)", color: "var(--orange)" }}>
        <span className="dot" style={{ background: "var(--orange)" }}></span>Niet ingedeeld
      </span>
    );
  return (
    <span className="tag" style={{ background: catTint(c.color), color: c.color, padding: small ? "3px 9px" : undefined }}>
      <span className="dot" style={{ background: c.color }}></span>
      {c.name}
    </span>
  );
}
