import { useState } from "react";
import { useMeasuredWidth } from "./useMeasuredWidth";
import { eur } from "../lib/format";

export interface TrendSeries {
  key: string;
  name: string;
  color: string;
  data: number[];
  noArea?: boolean;
  dashed?: boolean;
}

interface Props {
  series: TrendSeries[];
  labels: string[];
  tipLabels?: string[];   // optionele, rijkere koppen voor de tooltip (val terug op labels)
  height?: number;
  format?: (v: number) => string;
}

export function TrendChart({ series, labels, tipLabels, height = 260, format = (v) => eur(v) }: Props) {
  const [ref, W] = useMeasuredWidth();
  const [hover, setHover] = useState<number | null>(null);
  const H = height;
  const pad = { l: 52, r: 16, t: 16, b: 30 };
  const iw = Math.max(10, W - pad.l - pad.r);
  const ih = H - pad.t - pad.b;
  const n = labels.length;

  const allVals = series.flatMap((s) => s.data);
  const rawMax = Math.max(1, ...allVals);
  const niceMax = (() => {
    const mag = Math.pow(10, Math.floor(Math.log10(rawMax)));
    return Math.ceil(rawMax / (mag / 2)) * (mag / 2);
  })();

  const x = (i: number) => pad.l + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v: number) => pad.t + ih - (v / niceMax) * ih;

  const ticks = 4;
  const gridVals = Array.from({ length: ticks + 1 }, (_, i) => (niceMax / ticks) * i);

  // X-as-labels uitdunnen zodat ze niet in elkaar lopen (bv. 30/31 dagen): toon er hooguit
  // ~één per ~40px. Bij weinig punten (12 maanden) blijft elke label gewoon staan.
  const labelStep = Math.max(1, Math.ceil(n / Math.max(4, Math.floor(iw / 40))));
  const tip = tipLabels ?? labels;

  const linePath = (data: number[]) =>
    data.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const areaPath = (data: number[]) =>
    linePath(data) + ` L${x(n - 1).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`;

  function onMove(e: React.MouseEvent) {
    // De overlay-rect begint al op x=pad.l, dus mx is relatief aan de plotzone zelf.
    const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
    const mx = e.clientX - rect.left;
    let idx = Math.round((mx / iw) * (n - 1));
    idx = Math.max(0, Math.min(n - 1, idx));
    setHover(idx);
  }

  return (
    <div ref={ref} style={{ position: "relative", width: "100%" }}>
      {W > 0 && (
        <svg width={W} height={H} style={{ display: "block" }}>
          <defs>
            {series.map((s, i) => (
              <linearGradient key={i} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity="0.18" />
                <stop offset="100%" stopColor={s.color} stopOpacity="0.01" />
              </linearGradient>
            ))}
          </defs>
          {gridVals.map((gv, i) => (
            <g key={i}>
              <line x1={pad.l} y1={y(gv)} x2={W - pad.r} y2={y(gv)} stroke="var(--line-soft)" strokeWidth="1" />
              <text x={pad.l - 10} y={y(gv) + 4} textAnchor="end" fontSize="11" fontWeight="600" fill="var(--faint)">
                {gv >= 1000 ? gv / 1000 + "k" : gv}
              </text>
            </g>
          ))}
          {series.map((s) => (s.noArea ? null : <path key={"a" + s.key} d={areaPath(s.data)} fill={`url(#grad-${s.key})`} />))}
          {series.map((s) => (
            <path key={"l" + s.key} d={linePath(s.data)} fill="none" stroke={s.color} strokeWidth={s.dashed ? 2 : 2.5}
              strokeDasharray={s.dashed ? "6 5" : undefined} strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {labels.map((lb, i) => (i % labelStep === 0 || hover === i) ? (
            <text key={i} x={x(i)} y={H - 9} textAnchor="middle" fontSize="11" fontWeight="600"
              fill={hover === i ? "var(--ink)" : "var(--muted)"}>{lb}</text>
          ) : null)}
          {hover != null && (
            <g>
              <line x1={x(hover)} y1={pad.t} x2={x(hover)} y2={pad.t + ih} stroke="var(--faint)" strokeWidth="1" strokeDasharray="4 4" />
              {series.map((s) => (
                <circle key={s.key} cx={x(hover)} cy={y(s.data[hover])} r="5" fill="#fff" stroke={s.color} strokeWidth="2.5" />
              ))}
            </g>
          )}
          <rect x={pad.l} y={pad.t} width={iw} height={ih} fill="transparent" onMouseMove={onMove} onMouseLeave={() => setHover(null)} />
        </svg>
      )}
      {hover != null && W > 0 && (
        <div className="chart-tip" style={{ left: x(hover), top: pad.t + 6, opacity: 1 }}>
          <div className="tt-h">{tip[hover]}</div>
          {series.map((s) => (
            <div className="tt-row" key={s.key}>
              <span className="d" style={{ background: s.color }}></span>
              <span>{s.name}</span>
              <span style={{ marginLeft: 10, fontWeight: 800 }}>{format(s.data[hover])}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
