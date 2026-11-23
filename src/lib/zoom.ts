import { useState, useSyncExternalStore } from "react";

// Text size for big, sharp screens: the whole page at 100%, 150% or 200%. Remembered in this browser only, and
// only used on screens wide enough for the sidebar (where its button is); phones always show the page at 100%.
export type Zoom = 1 | 1.5 | 2;
export const ZOOMS: Zoom[] = [1, 1.5, 2];
const KEY = "malchingu.zoom";

function read(): Zoom {
  try {
    const saved = Number(localStorage.getItem(KEY));
    return (ZOOMS as number[]).includes(saved) ? (saved as Zoom) : 1;
  } catch {
    return 1;
  }
}

/** The next size for the Text Size button: 100% → 150% → 200% → back to 100%. */
export const nextZoom = (zoom: Zoom): Zoom => ZOOMS[(ZOOMS.indexOf(zoom) + 1) % ZOOMS.length];

/** The same width as the sidebar layout in styles.css. */
const WIDE = "(min-width: 900px)";
const isWide = () => typeof window.matchMedia !== "function" || window.matchMedia(WIDE).matches;

/** The size chosen, and the one in use (100% on narrow screens). */
let chosen: Zoom = 1;
let current: Zoom = 1;
let watching = false;

/** The page's zoom, for code that turns screen positions into page positions (popups at a word). */
export const pageZoom = () => current;

/** The room the guide's side column needs, in page pixels (the 1180 px layout in styles.css). */
const ROOMY = 1180;
const COMPACT_EVENT = "korimal:compact";

/** Zoomed in (150% or 200%) on a window too small for that size, e.g. a laptop: there's no sidebar (it opens from ☰)
 *  and no side column on a guide. At 100% and on wide monitors the layout is unchanged. */
export const isCompact = () => current > 1 && window.innerWidth / current < ROOMY;

function markCompact() {
  const root = document.documentElement;
  const compact = isCompact();
  if (compact === ("compact" in root.dataset)) return;
  if (compact) root.dataset.compact = ""; else delete root.dataset.compact;
  window.dispatchEvent(new Event(COMPACT_EVENT));
}

export function applyZoom(zoom: Zoom = read()) {
  chosen = zoom;
  current = isWide() ? zoom : 1;
  const root = document.documentElement;
  if (current === 1) root.style.removeProperty("zoom");
  else root.style.setProperty("zoom", String(current));
  root.style.setProperty("--zoom", String(current));
  markCompact();
  // Narrowing the window to phone width goes back to 100%; widening it again brings the chosen size back.
  if (!watching && typeof window.matchMedia === "function") {
    watching = true;
    window.matchMedia(WIDE).addEventListener("change", () => applyZoom(chosen));
    window.addEventListener("resize", markCompact);
  }
}

/** Whether the page is compact (see isCompact), following window resizes and Text Size changes. */
export function useCompact(): boolean {
  return useSyncExternalStore(
    (changed) => { window.addEventListener(COMPACT_EVENT, changed); return () => window.removeEventListener(COMPACT_EVENT, changed); },
    () => "compact" in document.documentElement.dataset,
    () => false,
  );
}

export function useZoom(): [Zoom, (next: Zoom) => void] {
  const [zoom, setZoom] = useState<Zoom>(read);
  const update = (next: Zoom) => {
    try {
      if (next === 1) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, String(next));
    } catch {
      // Private browsing can refuse storage; it still applies until the page closes.
    }
    applyZoom(next);
    setZoom(next);
  };
  return [zoom, update];
}
