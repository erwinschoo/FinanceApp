interface Props {
  data: number[];
  color?: string;
  w?: number;
  h?: number;
}

export function Spark({ data, color = "var(--blue)", w = 78, h = 30 }: Props) {
  const max = Math.max(...data), min = Math.min(...data);
  const range = max - min || 1;
  const x = (i: number) => (i / (data.length - 1)) * w;
  const y = (v: number) => h - 3 - ((v - min) / range) * (h - 6);
  const path = data.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
    </svg>
  );
}
