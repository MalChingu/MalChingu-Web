import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useStore } from "../lib/store";
import { PRICES, TRIAL_DAYS, YEARLY_SAVING, checkoutLabel, checkoutTerms, type Interval } from "../lib/subscription";
import { PRO_BENEFITS, setUpgradeOpener, type UpgradeMode } from "../lib/upgrade";
import { pageZoom } from "../lib/zoom";
import { Icon } from "./Icon";
import { Segmented } from "./ui";

/** The sidebar's width less its inset (--side-width, 300px), wherever it opens. */
const WIDTH = 284;
const GAP = 10;
/** Inside the sidebar: this far in from its edges. */
const INSET = 8;

/** Upgrade to Pro: what Pro adds and the price, floating up from the control that opened it (above it when there's
 *  room, otherwise below), inside the sidebar when opened from it. Closes with a click outside or Esc.
 *  - Pointed at (an Upgrade button): what Pro adds, the two prices and the free trial, nothing to press.
 *  - Clicked open: the same, then monthly or yearly and Start Free Trial, which goes to Stripe's checkout.
 *  - A Pro account's badge: just what Pro adds.
 *  Mounted once in App. */
export function UpgradeModal() {
  const store = useStore();
  const [anchor, setAnchor] = useState<DOMRect | null | undefined>(undefined);
  const [mode, setMode] = useState<UpgradeMode>("upgrade");
  const [sidebar, setSidebar] = useState<DOMRect | null>(null);
  /** Showing only while the pointer is over the Pro badge: no backdrop, and it doesn't catch the pointer. */
  const [hover, setHover] = useState(false);
  const hoverRef = useRef(false);
  const card = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<CSSProperties>({ visibility: "hidden" });
  const [billing, setBilling] = useState<Interval>("month");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setUpgradeOpener(
      (rect, how, side, onHover) => { hoverRef.current = onHover; setMode(how); setSidebar(side); setHover(onHover); setAnchor(rect); },
      () => { if (hoverRef.current) { hoverRef.current = false; setHover(false); setAnchor(undefined); } },
    );
    return () => setUpgradeOpener(null);
  }, []);

  const open = anchor !== undefined;
  useEffect(() => {
    if (!open) return;
    // Esc closes just this, not a sheet it was opened from (sheets listen on window, after document).
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); hoverRef.current = false; setAnchor(undefined); } };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [open]);

  // Place it by the control (page units, which the Text Size zoom scales), kept inside the window. The width is set
  // first, so the height is measured at the width it will show at.
  useLayoutEffect(() => {
    const el = card.current;
    if (!open || !el) return;
    const z = pageZoom();
    const vw = window.innerWidth / z;
    const vh = window.innerHeight / z;
    // From the sidebar: inside it, edge to edge less a small inset. Anywhere else: the same width, by the control.
    const inSide = anchor && sidebar ? { left: sidebar.left / z + INSET, width: sidebar.width / z - 2 * INSET } : null;
    const w = inSide ? inSide.width : Math.min(WIDTH, vw - 32);
    el.style.width = `${w}px`;
    const height = el.offsetHeight;
    if (!anchor) {
      setPlace({ width: w, left: (vw - w) / 2, top: Math.max(16, (vh - height) / 2), transformOrigin: "50% 100%" });
      return;
    }
    const r = { left: anchor.left / z, right: anchor.right / z, top: anchor.top / z, bottom: anchor.bottom / z };
    const centre = (r.left + r.right) / 2;
    const left = inSide ? inSide.left : Math.min(Math.max(16, centre - w / 2), vw - w - 16);
    const above = r.top - GAP - height >= 16;
    const top = above ? r.top - GAP - height : Math.min(r.bottom + GAP, vh - height - 16);
    setPlace({ width: w, left, top, transformOrigin: `${centre - left}px ${above ? "100%" : "0%"}` });
  }, [open, anchor, mode, sidebar, hover, error]);

  // Each opening starts fresh.
  useEffect(() => { if (open) { setError(null); setBusy(false); } }, [open]);

  if (!open) return null;
  const close = () => setAnchor(undefined);
  const pro = mode === "pro";
  const sub = store.subscription;
  const trial = sub?.trialAvailable !== false;
  const checkout = async () => {
    setBusy(true);
    setError(null);
    const message = await store.startCheckout(billing);
    // On success the browser is already on its way to Stripe.
    if (message) { setError(message); setBusy(false); }
  };
  const body = (
      <div ref={card} className={`upgrade-modal glass ${hover ? "hovering" : ""}`} role="dialog" aria-modal={hover ? undefined : true}
        aria-label={pro ? "Korimal Pro" : "Upgrade to Pro"} style={place}>
        {/* What Pro adds first, then (free accounts) the price at the bottom. A Pro account's badge shows just the list. */}
        <ul className="upgrade-benefits">
          {PRO_BENEFITS.map((b) => (
            <li key={b}><Icon name="checkCircle" size={20} className="upgrade-check" /><span>{b}</span></li>
          ))}
        </ul>
        {!pro && hover && (
          // Pointed at: both prices and the trial, nothing to press (it goes as the pointer leaves).
          <div className="upgrade-price-block">
            <div className="upgrade-price">
              <strong>{PRICES.month.amount}</strong><span className="muted">/{PRICES.month.short}</span>
              <span className="muted upgrade-or">or</span>
              <strong>{PRICES.year.amount}</strong><span className="muted">/{PRICES.year.short}</span>
            </div>
            {trial && <div className="small muted upgrade-trial">{TRIAL_DAYS}-day free trial</div>}
          </div>
        )}
        {!pro && !hover && (
          // Clicked open: monthly or yearly, the price, and the button to Stripe's checkout.
          <div className="upgrade-checkout">
            <Segmented label="Billing" value={billing} onChange={(v) => setBilling(v)}
              options={[{ value: "month", label: "Monthly" }, { value: "year", label: "Yearly" }]} />
            <div className="upgrade-price">
              <strong>{PRICES[billing].amount}</strong><span className="muted">/{PRICES[billing].per}</span>
              {billing === "year" && <span className="upgrade-saving">{YEARLY_SAVING}</span>}
            </div>
            <button type="button" className="button prominent compact upgrade-button upgrade-cta" disabled={busy} onClick={checkout}>
              <Icon name="bolt" size={16} /><span>{busy ? "Opening Checkout…" : checkoutLabel(sub)}</span>
            </button>
            <p className="small muted upgrade-terms">{checkoutTerms(billing, sub)}</p>
            {error && <p className="small error upgrade-error" role="alert">{error}</p>}
          </div>
        )}
      </div>
  );
  // While hovering the Pro badge: just the card. Otherwise a backdrop, and a click on it closes the modal.
  return createPortal(hover ? body : (
    <div className="upgrade-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>{body}</div>
  ), document.body);
}
