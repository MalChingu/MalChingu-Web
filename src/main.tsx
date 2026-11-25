import { Analytics } from "@vercel/analytics/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { Legal, legalKind } from "./pages/Legal";
import { StoreProvider } from "./lib/store";
import { applyZoom } from "./lib/zoom";
import "./styles.css";

applyZoom();

// /privacy and /terms are plain pages that open without signing in; everything else is the app.
const legal = legalKind(window.location.pathname);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {legal ? <Legal kind={legal} /> : (
      <StoreProvider>
        <App />
      </StoreProvider>
    )}
    {/* Page views for Vercel Web Analytics (enabled in the Vercel project). No cookies. */}
    <Analytics />
  </StrictMode>,
);
