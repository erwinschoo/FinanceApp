/* FinanceApp — inline stroke icons (UI chrome). Lucide-style, brand-neutral. */
function Ic({ name, size = 20, className, style, strokeWidth = 1.8 }) {
  const p = {
    fill: "none", stroke: "currentColor", strokeWidth, strokeLinecap: "round", strokeLinejoin: "round",
  };
  const paths = {
    dashboard: <><rect x="3" y="3" width="7" height="9" rx="1.5" {...p} /><rect x="14" y="3" width="7" height="5" rx="1.5" {...p} /><rect x="14" y="12" width="7" height="9" rx="1.5" {...p} /><rect x="3" y="16" width="7" height="5" rx="1.5" {...p} /></>,
    list: <><line x1="8" y1="6" x2="21" y2="6" {...p} /><line x1="8" y1="12" x2="21" y2="12" {...p} /><line x1="8" y1="18" x2="21" y2="18" {...p} /><circle cx="3.5" cy="6" r="1.2" fill="currentColor" stroke="none" /><circle cx="3.5" cy="12" r="1.2" fill="currentColor" stroke="none" /><circle cx="3.5" cy="18" r="1.2" fill="currentColor" stroke="none" /></>,
    sliders: <><line x1="4" y1="8" x2="20" y2="8" {...p} /><line x1="4" y1="16" x2="20" y2="16" {...p} /><circle cx="9" cy="8" r="2.6" {...p} fill="#fff" /><circle cx="15" cy="16" r="2.6" {...p} fill="#fff" /></>,
    target: <><circle cx="12" cy="12" r="8" {...p} /><circle cx="12" cy="12" r="4" {...p} /><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" /></>,
    upload: <><path d="M12 16V4" {...p} /><path d="m7 9 5-5 5 5" {...p} /><path d="M5 16v3a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3" {...p} /></>,
    chevronLeft: <path d="m15 6-6 6 6 6" {...p} />,
    chevronRight: <path d="m9 6 6 6-6 6" {...p} />,
    chevronDown: <path d="m6 9 6 6 6-6" {...p} />,
    arrowUp: <><path d="M12 19V5" {...p} /><path d="m6 11 6-6 6 6" {...p} /></>,
    arrowDown: <><path d="M12 5v14" {...p} /><path d="m6 13 6 6 6-6" {...p} /></>,
    trendUp: <><path d="M3 17 9 11l4 4 8-8" {...p} /><path d="M15 7h6v6" {...p} /></>,
    search: <><circle cx="11" cy="11" r="7" {...p} /><line x1="21" y1="21" x2="16.65" y2="16.65" {...p} /></>,
    check: <path d="M20 6 9 17l-5-5" {...p} />,
    plus: <><line x1="12" y1="5" x2="12" y2="19" {...p} /><line x1="5" y1="12" x2="19" y2="12" {...p} /></>,
    x: <><line x1="18" y1="6" x2="6" y2="18" {...p} /><line x1="6" y1="6" x2="18" y2="18" {...p} /></>,
    calendar: <><rect x="3" y="4.5" width="18" height="16" rx="2" {...p} /><line x1="3" y1="9" x2="21" y2="9" {...p} /><line x1="8" y1="2.5" x2="8" y2="6.5" {...p} /><line x1="16" y1="2.5" x2="16" y2="6.5" {...p} /></>,
    pie: <><path d="M12 3a9 9 0 1 0 9 9h-9V3z" {...p} /><path d="M12 3v9h9" {...p} opacity="0" /></>,
    wallet: <><rect x="3" y="6" width="18" height="13" rx="2.5" {...p} /><path d="M3 10h18" {...p} /><circle cx="16.5" cy="14.5" r="1.2" fill="currentColor" stroke="none" /></>,
    edit: <><path d="M12 20h9" {...p} /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" {...p} /></>,
    info: <><circle cx="12" cy="12" r="9" {...p} /><line x1="12" y1="11" x2="12" y2="16" {...p} /><circle cx="12" cy="8" r="1" fill="currentColor" stroke="none" /></>,
    sparkle: <><path d="M12 3v4M12 17v4M3 12h4M17 12h4" {...p} /><path d="M12 8a4 4 0 0 0 4 4 4 4 0 0 0-4 4 4 4 0 0 0-4-4 4 4 0 0 0 4-4z" {...p} fill="currentColor" /></>,
    file: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" {...p} /><path d="M14 3v5h5" {...p} /></>,
    filter: <path d="M3 5h18l-7 8v5l-4 2v-7L3 5z" {...p} />,
    piggy: <><path d="M19 9V7a2 2 0 0 0-2-2h-1l-1-2-2 2H9a6 6 0 0 0-6 6 5 5 0 0 0 2 4v3h3v-2h4v2h3v-3a5 5 0 0 0 2-4z" {...p} /><circle cx="15.5" cy="11" r="1" fill="currentColor" stroke="none" /></>,
    award: <><circle cx="12" cy="9" r="6" {...p} /><path d="M8.5 14 7 22l5-3 5 3-1.5-8" {...p} /></>,
    trophy: <><path d="M7 4h10v4a5 5 0 0 1-10 0V4z" {...p} /><path d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3M9 17h6M10 21h4M12 14v3" {...p} /></>,
  };
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} style={style}>
      {paths[name] || null}
    </svg>
  );
}
window.Ic = Ic;
