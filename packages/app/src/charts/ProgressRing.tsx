interface Props {
  value: number;
  max: number;
  size?: number;
  thickness?: number;
  color?: string;
  track?: string;
}

export function ProgressRing({ value, max, size = 150, thickness = 14, color = "var(--blue)", track = "var(--line)" }: Props) {
  const r = (size - thickness) / 2;
  const cx = size / 2, cy = size / 2;
  const C = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, max ? value / max : 0));
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)", display: "block" }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={track} strokeWidth={thickness} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={thickness}
        strokeDasharray={`${frac * C} ${C}`} strokeLinecap="round"
        style={{ transition: "stroke-dasharray .7s var(--ease)" }} />
    </svg>
  );
}
