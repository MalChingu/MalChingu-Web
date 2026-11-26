import { Analytics } from "@vercel/analytics/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { AFTER_SIGN_IN_KEY, Legal, legalKind } from "./pages/Legal";
import { supabase } from "./lib/supabase";
import { StoreProvider } from "./lib/store";
import { applyZoom } from "./lib/zoom";
import "./styles.css";

applyZoom();

// /privacy, /terms and /delete-account are plain pages that open without signing in; everything else is the app.
const legal = legalKind(window.location.pathname);

// Signed in from /delete-account but landed on the home page (the sign-in's return address): back to it.
if (!legal) {
  let back: string | null = null;
  try { back = localStorage.getItem(AFTER_SIGN_IN_KEY); localStorage.removeItem(AFTER_SIGN_IN_KEY); } catch { /* none */ }
  if (back) supabase.auth.getSession().then(({ data }) => { if (data.session) window.location.replace(back!); });
}

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
