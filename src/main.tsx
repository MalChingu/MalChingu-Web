import { Analytics } from "@vercel/analytics/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { StoreProvider } from "./lib/store";
import { applyAppearance, watchSystemAppearance } from "./lib/theme";
import { applyZoom } from "./lib/zoom";
import "./styles.css";

applyAppearance();
applyZoom();
watchSystemAppearance();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
    {/* Page views for Vercel Web Analytics (enabled in the Vercel project). No cookies. */}
    <Analytics />
  </StrictMode>,
);
