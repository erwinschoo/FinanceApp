import { useCallback, useEffect, useRef, useState } from "react";

/* Pointer-gebaseerd verslepen van een categorie naar een andere groep — werkt voor
 * zowel muis als touch (anders dan native HTML5 drag, dat op touch niet werkt) en
 * scrollt de pagina mee wanneer je vinger bij de boven-/onderrand komt.
 *
 * Gebruik: hang `startDrag` aan onPointerDown van de grip. Groepen moeten een
 * `data-group-id`-attribuut hebben. `onMove(catId, groupId)` wordt aangeroepen bij
 * loslaten boven een (andere) groep. */

const THRESHOLD = 6;   // px beweging voordat het een echte drag is (anders: tik)
const EDGE = 72;       // px rand-zone waarin auto-scroll begint
const MAX_SPEED = 16;  // px per frame

function groupAt(x: number, y: number): string | null {
  return document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-group-id]")?.dataset.groupId ?? null;
}

/* Zoek de daadwerkelijke verticale scroll-container vanaf de grip omhoog. Op desktop is
 * dit `main.content`; op mobiel scrollt vaak het document zelf. Val daarop terug. */
function findScroller(start: HTMLElement | null): HTMLElement {
  let n: HTMLElement | null = start;
  while (n) {
    const oy = getComputedStyle(n).overflowY;
    if ((oy === "auto" || oy === "scroll") && n.scrollHeight > n.clientHeight + 1) return n;
    n = n.parentElement;
  }
  return (document.scrollingElement as HTMLElement) ?? document.documentElement;
}

/* Zichtbare boven-/onderrand van de scroller in viewport-coördinaten. Voor het document
 * is dat de viewport (0..innerHeight); voor een element zijn rect-randen. */
function edges(sc: HTMLElement): { top: number; bottom: number } {
  const isDoc = sc === document.scrollingElement || sc === document.documentElement || sc === document.body;
  if (isDoc) return { top: 0, bottom: window.innerHeight };
  const r = sc.getBoundingClientRect();
  return { top: r.top, bottom: r.bottom };
}

interface DragState {
  active: boolean;
  catId: string | null;
  pointerId: number;
  grip: HTMLElement | null;
  startX: number; startY: number;
  lastX: number; lastY: number;
  target: string | null;
  scroller: HTMLElement | null;
  raf: number | null;
  move: ((e: PointerEvent) => void) | null;
  up: ((e: PointerEvent) => void) | null;
}

export function usePointerDragMove({ onMove }: { onMove: (catId: string, groupId: string) => void }) {
  const [dragCat, setDragCat] = useState<string | null>(null);
  const [dropGroup, setDropGroup] = useState<string | null>(null);

  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  const st = useRef<DragState>({
    active: false, catId: null, pointerId: -1, grip: null,
    startX: 0, startY: 0, lastX: 0, lastY: 0, target: null, scroller: null, raf: null, move: null, up: null,
  });

  const setTarget = useCallback((x: number, y: number) => {
    const g = groupAt(x, y);
    st.current.target = g;
    setDropGroup(g);
  }, []);

  const tick = useCallback(() => {
    const s = st.current;
    const sc = s.scroller;
    if (!sc) { s.raf = null; return; }
    const { top, bottom } = edges(sc);
    const y = s.lastY;
    let dv = 0;
    if (y < top + EDGE) dv = -MAX_SPEED * Math.min(1, (top + EDGE - y) / EDGE);
    else if (y > bottom - EDGE) dv = MAX_SPEED * Math.min(1, (y - (bottom - EDGE)) / EDGE);
    if (dv !== 0) {
      sc.scrollTop += dv;
      setTarget(s.lastX, y); // ingescrolde groep meteen geldig drop-target
      s.raf = requestAnimationFrame(tick);
    } else {
      s.raf = null;
    }
  }, [setTarget]);

  const cleanup = useCallback(() => {
    const s = st.current;
    if (s.raf != null) { cancelAnimationFrame(s.raf); s.raf = null; }
    if (s.move) window.removeEventListener("pointermove", s.move);
    if (s.up) { window.removeEventListener("pointerup", s.up); window.removeEventListener("pointercancel", s.up); }
    if (s.grip && s.pointerId !== -1) { try { s.grip.releasePointerCapture(s.pointerId); } catch { /* genegeerd */ } }
    s.active = false; s.catId = null; s.pointerId = -1; s.grip = null; s.target = null; s.scroller = null; s.move = null; s.up = null;
    setDragCat(null);
    setDropGroup(null);
  }, []);

  const startDrag = useCallback((id: string, e: React.PointerEvent) => {
    if (e.button != null && e.button !== 0) return; // alleen primaire muisknop
    const s = st.current;
    s.catId = id; s.pointerId = e.pointerId; s.grip = e.currentTarget as HTMLElement;
    s.startX = e.clientX; s.startY = e.clientY; s.lastX = e.clientX; s.lastY = e.clientY; s.active = false;
    s.scroller = findScroller(s.grip);
    try { s.grip.setPointerCapture(e.pointerId); } catch { /* genegeerd */ }

    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== s.pointerId) return;
      s.lastX = ev.clientX; s.lastY = ev.clientY;
      if (!s.active) {
        if (Math.hypot(ev.clientX - s.startX, ev.clientY - s.startY) < THRESHOLD) return;
        s.active = true;
        setDragCat(s.catId);
      }
      ev.preventDefault();
      setTarget(ev.clientX, ev.clientY);
      if (s.raf == null && s.scroller) {
        const { top, bottom } = edges(s.scroller);
        if (ev.clientY < top + EDGE || ev.clientY > bottom - EDGE) s.raf = requestAnimationFrame(tick);
      }
    };
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== s.pointerId) return;
      if (s.active && s.catId && s.target) onMoveRef.current(s.catId, s.target); // repo: no-op bij zelfde groep
      cleanup();
    };
    s.move = move; s.up = up;
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  }, [setTarget, tick, cleanup]);

  useEffect(() => cleanup, [cleanup]); // opruimen bij unmount

  return { dragCat, dropGroup, startDrag };
}
