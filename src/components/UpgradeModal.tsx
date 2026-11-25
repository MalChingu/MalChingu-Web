import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { PRO_BENEFITS, PRO_PRICE, setUpgradeOpener, type UpgradeMode } from "../lib/upgrade";
import { pageZoom } from "../lib/zoom";
import { Icon, type IconName } from "./Icon";
import { Button } from "./ui";

const WIDTH = 340;
const GAP = 10;

/** Upgrade to Pro: the price and what Pro adds, floating up from the control that opened it (above it when there's
 *  room, otherwise below). Closes with ✕, a click outside, or Esc. Payments aren't set up yet, so the button
 *  doesn't charge anything. A Pro account's badge opens it with just what Pro adds. Mounted once in App. */
export function UpgradeModal() {
  const [anchor, setAnchor] = useState<DOMRect | null | undefined>(undefined);
  const [mode, setMode] = useState<UpgradeMode>("upgrade");
  const card = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<CSSProperties>({ visibility: "hidden" });

  useEffect(() => {
    setUpgradeOpener((rect, how) => { setMode(how); setAnchor(rect); });
    return () => setUpgradeOpener(null);
  }, []);

  const open = anchor !== undefined;
  useEffect(() => {
    if (!open) return;
    // Esc closes just this, not a sheet it was opened from (sheets listen on window, after document).
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setAnchor(undefined); } };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [open]);

  // Place it by the control (page units, which the Text Size zoom scales), kept inside the window.
  useLayoutEffect(() => {
    if (!open || !card.current) return;
    const z = pageZoom();
    const vw = window.innerWidth / z;
    const vh = window.innerHeight / z;
    const width = Math.min(WIDTH, vw - 32);
    const height = card.current.offsetHeight;
    if (!anchor) {
      setPlace({ width, left: (vw - width) / 2, top: Math.max(16, (vh - height) / 2), transformOrigin: "50% 100%" });
      return;
    }
    const r = { left: anchor.left / z, right: anchor.right / z, top: anchor.top / z, bottom: anchor.bottom / z };
    const centre = (r.left + r.right) / 2;
    const left = Math.min(Math.max(16, centre - width / 2), vw - width - 16);
    const above = r.top - GAP - height >= 16;
    const top = above ? r.top - GAP - height : Math.min(r.bottom + GAP, vh - height - 16);
    setPlace({ width, left, top, transformOrigin: `${centre - left}px ${above ? "100%" : "0%"}` });
  }, [open, anchor, mode]);

  if (!open) return null;
  const close = () => setAnchor(undefined);
  const pro = mode === "pro";
  return createPortal(
    <div className="upgrade-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div ref={card} className="upgrade-modal glass" role="dialog" aria-modal="true" aria-label={pro ? "Korimal Pro" : "Upgrade to Pro"} style={place}>
        <button type="button" className="icon-button upgrade-close" aria-label="Close" onClick={close}><Icon name="x" size={18} /></button>
        <div className="upgrade-head">
          <span className="pro-badge"><Icon name="seal" size={16} /> Pro</span>
          <h2>Korimal Pro</h2>
          {pro ? <span className="small muted">Your account has everything Pro adds.</span> : (
            <div className="upgrade-price">{PRO_PRICE
              ? <><strong>{PRO_PRICE.split("/")[0]}</strong><span className="muted">/month (USD)</span></>
              : <strong>Coming Soon</strong>}</div>
          )}
        </div>
        <ul className="upgrade-benefits">
          {PRO_BENEFITS.map((b) => (
            <li key={b.title}>
              <span className="upgrade-benefit-icon"><Icon name={b.icon as IconName} size={18} /></span>
              <span><strong>{b.title}</strong><span className="small muted">{b.detail}</span></span>
            </li>
          ))}
        </ul>
        {/* Checkout comes later (Stripe); until then the button can't be pressed. */}
        {!pro && (
          <Button kind="prominent" icon="bolt" full large disabled={!PRO_PRICE} onClick={() => {}}>
            {PRO_PRICE ? `Upgrade for ${PRO_PRICE}` : "Coming Soon"}</Button>
        )}
      </div>
    </div>,
    document.body,
  );
}
