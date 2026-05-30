export interface DonutDatum {
  id: string;
  label: string;
  value: number;
  color: string;
}

interface Props {
  data: DonutDatum[];
  size?: number;
  thickness?: number;
  active?: number | null;
  onHover?: (i: number | null) => void;
}

export function DonutChart({ data, size = 200, thickness = 26, active = null, onHover }: Props) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = (size - thickness) / 2;
  const cx = size / 2, cy = size / 2;
  const C = 2 * Math.PI * r;
  let acc = 0;
  const segs = data.map((d) => {
    const frac = d.value / total;
    const seg = { ...d, frac, offset: acc };
    acc += frac;
    return seg;
  });

  return (
    <svg width={size} height={size} style={{ display: "block", transform: "rotate(-90deg)" }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--line-soft)" strokeWidth={thickness} />
      {segs.map((s, i) => {
        const len = s.frac * C;
        const gap = C - len;
        const isActive = active === i;
        const tw = isActive ? thickness + 6 : thickness;
        return (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth={tw}
            strokeDasharray={`${len} ${gap}`} strokeDashoffset={-s.offset * C} strokeLinecap="butt"
            style={{ transition: "stroke-width .18s var(--ease), opacity .18s", opacity: active == null || isActive ? 1 : 0.42, cursor: "pointer" }}
            onMouseEnter={() => onHover && onHover(i)} onMouseLeave={() => onHover && onHover(null)} />
        );
      })}
    </svg>
  );
}
