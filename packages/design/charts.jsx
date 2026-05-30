/* FinanceApp — hand-rolled SVG charts (calm, brand-tinted) */

// euro formatter
const eur = (n, dec = 0) => "€\u00a0" + Number(Math.abs(n)).toLocaleString("nl-NL", { minimumFractionDigits: dec, maximumFractionDigits: dec });
const eurSign = (n, dec = 0) => (n < 0 ? "−" : "") + eur(n, dec);

// resolve a CSS var() string to a real color (for SVG gradients/strokes that need a literal sometimes)
function useMeasuredWidth() {
  const ref = React.useRef(null);
  const [w, setW] = React.useState(0);
  React.useLayoutEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((entries) => { setW(entries[0].contentRect.width); });
    ro.observe(ref.current);
    setW(ref.current.clientWidth);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/* ── Trend area-line chart ── */
function TrendChart({ series, labels, height = 260, format = (v) => eur(v) }) {
  const [ref, W] = useMeasuredWidth();
  const [hover, setHover] = React.useState(null);
  const H = height;
  const pad = { l: 52, r: 16, t: 16, b: 30 };
  const iw = Math.max(10, W - pad.l - pad.r);
  const ih = H - pad.t - pad.b;
  const n = labels.length;

  const allVals = series.flatMap(s => s.data);
  const rawMax = Math.max(1, ...allVals);
  // round max up to a nice number
  const niceMax = (() => {
    const mag = Math.pow(10, Math.floor(Math.log10(rawMax)));
    return Math.ceil(rawMax / (mag / 2)) * (mag / 2);
  })();

  const x = (i) => pad.l + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v) => pad.t + ih - (v / niceMax) * ih;

  const ticks = 4;
  const gridVals = Array.from({ length: ticks + 1 }, (_, i) => (niceMax / ticks) * i);

  function linePath(data) {
    return data.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  }
  function areaPath(data) {
    return linePath(data) + ` L${x(n - 1).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`;
  }

  function onMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    let idx = Math.round(((mx - pad.l) / iw) * (n - 1));
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
          {/* gridlines */}
          {gridVals.map((gv, i) => (
            <g key={i}>
              <line x1={pad.l} y1={y(gv)} x2={W - pad.r} y2={y(gv)} stroke="var(--line-soft)" strokeWidth="1" />
              <text x={pad.l - 10} y={y(gv) + 4} textAnchor="end" fontSize="11" fontWeight="600" fill="var(--faint)">
                {gv >= 1000 ? (gv / 1000) + "k" : gv}
              </text>
            </g>
          ))}
          {/* areas + lines */}
          {series.map((s) => (
            s.noArea ? null : <path key={"a" + s.key} d={areaPath(s.data)} fill={`url(#grad-${s.key})`} />
          ))}
          {series.map((s) => (
            <path key={"l" + s.key} d={linePath(s.data)} fill="none" stroke={s.color} strokeWidth={s.dashed ? 2 : 2.5}
              strokeDasharray={s.dashed ? "6 5" : undefined}
              strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {/* x labels */}
          {labels.map((lb, i) => (
            <text key={i} x={x(i)} y={H - 9} textAnchor="middle" fontSize="11" fontWeight="600"
              fill={hover === i ? "var(--ink)" : "var(--muted)"}>{lb}</text>
          ))}
          {/* hover guide */}
          {hover != null && (
            <g>
              <line x1={x(hover)} y1={pad.t} x2={x(hover)} y2={pad.t + ih} stroke="var(--faint)" strokeWidth="1" strokeDasharray="4 4" />
              {series.map((s) => (
                <circle key={s.key} cx={x(hover)} cy={y(s.data[hover])} r="5" fill="#fff" stroke={s.color} strokeWidth="2.5" />
              ))}
            </g>
          )}
          {/* capture layer */}
          <rect x={pad.l} y={pad.t} width={iw} height={ih} fill="transparent"
            onMouseMove={onMove} onMouseLeave={() => setHover(null)} />
        </svg>
      )}
      {hover != null && W > 0 && (
        <div className="chart-tip" style={{ left: x(hover), top: pad.t + 6, opacity: 1 }}>
          <div className="tt-h">{labels[hover]}</div>
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

/* ── Donut chart ── */
function DonutChart({ data, size = 200, thickness = 26, active, onHover }) {
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
  const hi = active != null ? segs[active] : null;

  return (
    <svg width={size} height={size} style={{ display: "block", transform: "rotate(-90deg)" }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--line-soft)" strokeWidth={thickness} />
      {segs.map((s, i) => {
        const len = s.frac * C;
        const gap = C - len;
        const isActive = active === i;
        const tw = isActive ? thickness + 6 : thickness;
        return (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={s.color} strokeWidth={tw}
            strokeDasharray={`${len} ${gap}`}
            strokeDashoffset={-s.offset * C}
            strokeLinecap="butt"
            style={{ transition: "stroke-width .18s var(--ease), opacity .18s", opacity: active == null || isActive ? 1 : 0.42, cursor: "pointer" }}
            onMouseEnter={() => onHover && onHover(i)}
            onMouseLeave={() => onHover && onHover(null)} />
        );
      })}
    </svg>
  );
}

/* ── Progress ring ── */
function ProgressRing({ value, max, size = 150, thickness = 14, color = "var(--blue)", track = "var(--line)" }) {
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

/* ── mini sparkline for KPI cards ── */
function Spark({ data, color = "var(--blue)", w = 78, h = 30 }) {
  const max = Math.max(...data), min = Math.min(...data);
  const range = max - min || 1;
  const x = (i) => (i / (data.length - 1)) * w;
  const y = (v) => h - 3 - ((v - min) / range) * (h - 6);
  const path = data.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
    </svg>
  );
}

Object.assign(window, { TrendChart, DonutChart, ProgressRing, Spark, eur, eurSign });
