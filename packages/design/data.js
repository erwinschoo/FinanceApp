/* FinanceApp — sample data (Nederlands huishouden)
 * Deterministic generation so the prototype is stable across reloads. */
(function () {
  // ── seeded PRNG ──
  let _s = 20260529;
  function rnd() { _s = (_s * 1664525 + 1013904223) % 4294967296; return _s / 4294967296; }
  function pick(a) { return a[Math.floor(rnd() * a.length)]; }
  function between(lo, hi) { return lo + rnd() * (hi - lo); }
  function round2(n) { return Math.round(n * 100) / 100; }

  // ── categories ──
  const CATS = [
    { id: "inkomen",       name: "Inkomen",        color: "var(--pos)",   tint:"var(--pos-soft)",    initial:"€" },
    { id: "boodschappen",  name: "Boodschappen",   color: "var(--cat-1)", tint:"var(--orange-soft)", initial:"B" },
    { id: "wonen",         name: "Wonen",          color: "var(--cat-2)", tint:"var(--blue-soft)",   initial:"W" },
    { id: "vervoer",       name: "Vervoer",        color: "var(--cat-3)", tint:"#ECF3F1",            initial:"V" },
    { id: "abonnementen",  name: "Abonnementen",   color: "var(--cat-4)", tint:"#F2EFF7",            initial:"A" },
    { id: "gezondheid",    name: "Gezondheid",     color: "var(--cat-5)", tint:"#EBF1F2",            initial:"G" },
    { id: "vrijetijd",     name: "Vrije tijd",     color: "var(--cat-6)", tint:"#F7EEF1",            initial:"T" },
    { id: "verzekeringen", name: "Verzekeringen",  color: "var(--cat-7)", tint:"#FAF1E6",            initial:"Z" },
    { id: "overig",        name: "Overig",         color: "var(--cat-8)", tint:"#F1F2F4",            initial:"O" },
  ];
  const CAT = Object.fromEntries(CATS.map(c => [c.id, c]));

  // ── merchant catalogues per category ──
  const M = {
    boodschappen: [["Albert Heijn",28,96],["Jumbo",22,84],["Lidl",16,52],["Dirk",18,60],["Bakker Bart",4,14],["Marqt",24,70]],
    wonen:        [["Energie — Eneco",118,168],["Vitens water",18,32],["Gemeente — afval",0,0]],
    vervoer:      [["NS Reizen",8,46],["Shell",55,82],["OV-chipkaart",10,30],["Q-Park",4,18],["Swapfiets",19,19]],
    abonnementen: [["Netflix",13.99,13.99],["Spotify",11.99,11.99],["KPN internet",54.5,54.5],["iCloud+",2.99,2.99],["Het Parool",9.95,9.95]],
    gezondheid:   [["Etos apotheek",6,34],["Tandarts Dental07",48,160],["Fysio Centrum",36,36]],
    vrijetijd:    [["Restaurant Toscana",38,92],["Café de Sluis",14,46],["Pathé bioscoop",24,38],["bol.com",12,78],["Coolblue",29,210],["Decathlon",18,86]],
    verzekeringen:[["Zilveren Kruis zorg",147.5,147.5],["Centraal Beheer auto",62,62],["Inboedel — Interpolis",13.5,13.5]],
    overig:       [["Tikkie — vrienden",6,40],["PostNL",3.95,3.95],["HEMA",8,40],["Donatie KWF",10,10]],
  };
  // monthly fixed (charged once / month, near a set day)
  const FIXED = [
    { cat:"wonen",        merchant:"Huur — Vesteda",   day:1,  lo:1150, hi:1150, gym:false },
    { cat:"wonen",        merchant:"Energie — Eneco",  day:3,  lo:124,  hi:158 },
    { cat:"abonnementen", merchant:"KPN internet",     day:5,  lo:54.5, hi:54.5 },
    { cat:"abonnementen", merchant:"Netflix",          day:8,  lo:13.99,hi:13.99 },
    { cat:"abonnementen", merchant:"Spotify",          day:12, lo:11.99,hi:11.99 },
    { cat:"abonnementen", merchant:"FitForFree gym",   day:2,  lo:29.95,hi:29.95 },
    { cat:"abonnementen", merchant:"iCloud+",          day:9,  lo:2.99, hi:2.99 },
    { cat:"verzekeringen",merchant:"Zilveren Kruis zorg",day:27,lo:147.5,hi:147.5 },
    { cat:"verzekeringen",merchant:"Centraal Beheer auto",day:27,lo:62,hi:62 },
    { cat:"verzekeringen",merchant:"Interpolis inboedel",day:27,lo:13.5,hi:13.5 },
  ];

  const MONTHS_NL = ["januari","februari","maart","april","mei","juni","juli","augustus","september","oktober","november","december"];
  const MONTHS_SH = ["jan","feb","mrt","apr","mei","jun","jul","aug","sep","okt","nov","dec"];

  // generate from Jun 2025 .. May 2026 (12 months); "now" = May 2026
  const NOW = { y: 2026, m: 4 }; // 0-indexed month (May)
  const monthsList = [];
  for (let i = 11; i >= 0; i--) {
    let m = NOW.m - i, y = NOW.y;
    while (m < 0) { m += 12; y -= 1; }
    monthsList.push({ y, m, key: `${y}-${String(m+1).padStart(2,"0")}` });
  }

  function iso(y,m,d){ return `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`; }
  let _id = 1;
  function tx(date, merchant, cat, amount, opts={}) {
    return { id: "t"+(_id++), date, merchant, category: cat, amount: round2(amount),
             auto: opts.auto !== false, note: opts.note || "" };
  }

  const all = [];
  monthsList.forEach((mo, idx) => {
    const last = idx === monthsList.length - 1;
    // income — salary
    let salary = 3250 + (idx > 8 ? 90 : 0); // small raise in last months
    all.push(tx(iso(mo.y, mo.m, 25), "Salaris — Mediter BV", "inkomen", salary, {note:"Maandsalaris"}));
    // occasional extra income
    if (mo.m === 11) all.push(tx(iso(mo.y, mo.m, 20), "Salaris — eindejaar", "inkomen", 980, {note:"13e maand"}));
    if (mo.m === 3) all.push(tx(iso(mo.y, mo.m, 18), "Belastingdienst", "inkomen", 612, {note:"Teruggave"}));
    if (idx === 6) all.push(tx(iso(mo.y, mo.m, 14), "Tikkie — Lars", "inkomen", 45, {note:"Verrekening"}));

    // fixed costs
    FIXED.forEach(f => {
      const amt = -between(f.lo, f.hi);
      all.push(tx(iso(mo.y, mo.m, f.day), f.merchant, f.cat, amt));
    });

    // groceries 9–12 per month
    const nGroc = Math.round(between(9, 12));
    for (let i = 0; i < nGroc; i++) {
      const [name, lo, hi] = pick(M.boodschappen);
      const day = 1 + Math.floor(rnd() * 27);
      all.push(tx(iso(mo.y, mo.m, day), name, "boodschappen", -between(lo, hi)));
    }
    // vervoer 3–5
    const nV = Math.round(between(3, 5));
    for (let i = 0; i < nV; i++) {
      const [name, lo, hi] = pick(M.vervoer);
      all.push(tx(iso(mo.y, mo.m, 1 + Math.floor(rnd()*27)), name, "vervoer", -between(lo, hi)));
    }
    // vrije tijd 3–6
    const nL = Math.round(between(3, 6));
    for (let i = 0; i < nL; i++) {
      const [name, lo, hi] = pick(M.vrijetijd);
      all.push(tx(iso(mo.y, mo.m, 1 + Math.floor(rnd()*27)), name, "vrijetijd", -between(lo, hi)));
    }
    // gezondheid 0–2
    const nG = Math.round(between(0, 2));
    for (let i = 0; i < nG; i++) {
      const [name, lo, hi] = pick(M.gezondheid);
      all.push(tx(iso(mo.y, mo.m, 1 + Math.floor(rnd()*27)), name, "gezondheid", -between(lo, hi)));
    }
    // overig 1–3
    const nO = Math.round(between(1, 3));
    for (let i = 0; i < nO; i++) {
      const [name, lo, hi] = pick(M.overig);
      all.push(tx(iso(mo.y, mo.m, 1 + Math.floor(rnd()*27)), name, "overig", -between(lo, hi)));
    }
    // krant abonnement
    all.push(tx(iso(mo.y, mo.m, 6), "Het Parool", "abonnementen", -9.95));

    // monthly savings transfer
    all.push(tx(iso(mo.y, mo.m, 26), "Naar Spaarrekening", "sparen", -(idx>8?520:450), {note:"Automatische inleg"}));

    // in the CURRENT month, leave a few recent transactions UNCATEGORIZED for the categorize flow
    if (last) {
      all.push(tx(iso(mo.y, mo.m, 22), "Coolblue", "", -184.99, {auto:false, note:"Nieuw"}));
      all.push(tx(iso(mo.y, mo.m, 21), "Restaurant Toscana", "", -67.50, {auto:false}));
      all.push(tx(iso(mo.y, mo.m, 20), "MediaMarkt", "", -42.00, {auto:false}));
      all.push(tx(iso(mo.y, mo.m, 19), "Albert Heijn", "", -58.30, {auto:false}));
      all.push(tx(iso(mo.y, mo.m, 18), "Shell", "", -71.20, {auto:false}));
    }
  });

  // sort newest first
  all.sort((a,b) => a.date < b.date ? 1 : a.date > b.date ? -1 : 0);

  // ── budgets (per category, monthly) ──
  const BUDGETS = {
    boodschappen: 520, wonen: 1400, vervoer: 180, abonnementen: 140,
    gezondheid: 90, vrijetijd: 320, verzekeringen: 230, overig: 80,
  };

  // ── savings ── kept for backward-compat (primary goal mirror)
  const SAVINGS = {
    goalName: "Verbouwing keuken",
    target: 18000,
    current: 11250,
    monthly: 520,
    startDate: "2024-09-01",
    targetDate: "2027-03-01",
    accountStart: 5400,
  };

  // ── savings GROUPS — categories, each with prioritised goals ──
  // The category "balance" (already saved) cascades into goals by priority:
  // goal #1 fills first, the overflow flows into #2, etc.
  let _gid = 1; const gid = () => "g" + (_gid++);
  const SAVINGS_GROUPS = [
    {
      id: "sparen", name: "Sparen", color: "var(--blue)", tint: "var(--blue-soft)", icon: "piggy",
      monthly: 520, balance: 11250,
      goals: [
        { id: gid(), name: "Noodbuffer (3 mnd)", target: 5000, priority: 1 },
        { id: gid(), name: "Verbouwing keuken", target: 18000, priority: 2 },
        { id: gid(), name: "Nieuwe auto", target: 12000, priority: 3 },
      ],
    },
    {
      id: "beleggen", name: "Beleggen", color: "var(--cat-3)", tint: "#ECF3F1", icon: "trendUp",
      monthly: 220, balance: 7600,
      goals: [
        { id: gid(), name: "Wereld ETF — basis", target: 10000, priority: 1 },
        { id: gid(), name: "Dividendportefeuille", target: 20000, priority: 2 },
      ],
    },
    {
      id: "pensioen", name: "Pensioen", color: "var(--cat-4)", tint: "#F2EFF7", icon: "wallet",
      monthly: 150, balance: 6800,
      goals: [
        { id: gid(), name: "Lijfrente aanvulling", target: 25000, priority: 1 },
      ],
    },
  ];

  // categories the user can still ADD (not yet in use)
  const SAVINGS_LIBRARY = [
    { id: "vakantie", name: "Vakantie",     color: "var(--cat-1)", tint: "var(--orange-soft)", icon: "calendar" },
    { id: "buffer",   name: "Extra buffer", color: "var(--cat-5)", tint: "#EBF1F2",            icon: "wallet" },
    { id: "studie",   name: "Studie kind",  color: "var(--cat-6)", tint: "#F7EEF1",            icon: "award" },
    { id: "schenken", name: "Schenken",     color: "var(--cat-7)", tint: "#FAF1E6",            icon: "sparkle" },
    { id: "auto",     name: "Auto & vervoer", color: "var(--cat-2)", tint: "var(--blue-soft)", icon: "target" },
  ];

  window.FA_DATA = {
    CATS, CAT, BUDGETS, SAVINGS, SAVINGS_GROUPS, SAVINGS_LIBRARY,
    transactions: all,
    months: monthsList,
    MONTHS_NL, MONTHS_SH,
    NOW,
  };
})();
