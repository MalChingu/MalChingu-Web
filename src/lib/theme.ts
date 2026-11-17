import { useState } from "react";

// Light, dark, or follow the device. Remembered in this browser only.
export type Appearance = "system" | "light" | "dark";
const KEY = "malchingu.theme";

function read(): Appearance {
  try {
    const saved = localStorage.getItem(KEY);
    return saved === "light" || saved === "dark" ? saved : "system";
  } catch {
    return "system";
  }
}

const isDark = (appearance: Appearance) =>
  appearance === "dark" || (appearance === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

/** Sets the theme on the page and the browser's toolbar colour to match. */
export function applyAppearance(appearance: Appearance = read()) {
  const root = document.documentElement;
  if (appearance === "system") delete root.dataset.theme;
  else root.dataset.theme = appearance;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", isDark(appearance) ? "#0e0d1c" : "#f4f3fb");
}

/** Keeps the toolbar colour right when the device switches while set to System. */
export function watchSystemAppearance() {
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => applyAppearance());
}

export function useAppearance(): [Appearance, (next: Appearance) => void] {
  const [appearance, setAppearance] = useState<Appearance>(read);
  const update = (next: Appearance) => {
    try {
      if (next === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch {
      // Private browsing can refuse storage; the choice still applies until the page closes.
    }
    applyAppearance(next);
    setAppearance(next);
  };
  return [appearance, update];
}
