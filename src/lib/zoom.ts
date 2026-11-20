import { useState } from "react";

// Text size for big, sharp screens: the whole page at 100%, 150% or 200%. Remembered in this browser only.
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

let current: Zoom = 1;

/** The page's zoom, for code that turns screen positions into page positions (popups at a word). */
export const pageZoom = () => current;

export function applyZoom(zoom: Zoom = read()) {
  current = zoom;
  const root = document.documentElement;
  if (zoom === 1) root.style.removeProperty("zoom");
  else root.style.setProperty("zoom", String(zoom));
  root.style.setProperty("--zoom", String(zoom));
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
