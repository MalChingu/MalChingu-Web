import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { PRO_BENEFITS, PRO_PRICE, setUpgradeOpener, type UpgradeMode } from "../lib/upgrade";
import { pageZoom } from "../lib/zoom";
import { Icon } from "./Icon";
import { Button } from "./ui";

/** The sidebar's width less its inset (--side-width, 300px), wherever it opens. */
const WIDTH = 284;
const GAP = 10;
/** Inside the sidebar: this far in from its edges. */
const INSET = 8;

/** Upgrade to Pro: the price and what Pro adds, floating up from the control that opened it (above it when there's
 *  room, otherwise below), inside the sidebar when opened from it. Closes with a click outside or Esc. Payments
 *  aren't set up yet, so the button doesn't charge anything. A Pro account's badge shows just what Pro adds while the
 *  pointer is over it (or, on a touch screen, after a tap). Mounted once in App. */
export function UpgradeModal() {
  const [anchor, setAnchor] = useState<DOMRect | null | undefined>(undefined);
  const [mode, setMode] = useState<UpgradeMode>("upgrade");
  const [sidebar, setSidebar] = useState<DOMRect | null>(null);
  /** Showing only while the pointer is over the Pro badge: no backdrop, and it doesn't catch the pointer. */
  const [hover, setHover] = useState(false);
  const hoverRef = useRef(false);
  const card = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<CSSProperties>({ visibility: "hidden" });

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
  }, [open, anchor, mode, sidebar]);

  if (!open) return null;
  const close = () => setAnchor(undefined);
  const pro = mode === "pro";
  const body = (
      <div ref={card} className={`upgrade-modal glass ${hover ? "hovering" : ""}`} role="dialog" aria-modal={hover ? undefined : true}
        aria-label={pro ? "Korimal Pro" : "Upgrade to Pro"} style={place}>
        {/* Free accounts: Coming Soon as the heading (the price, once checkout is set up). A Pro account's badge shows
            just the list. */}
        {!pro && (
          <div className="upgrade-head">
            <div className="upgrade-price">{PRO_PRICE
              ? <><strong>{PRO_PRICE.split("/")[0]}</strong><span className="muted">/month (USD)</span></>
              : <strong>Coming Soon</strong>}</div>
          </div>
        )}
        <ul className="upgrade-benefits">
          {PRO_BENEFITS.map((b) => (
            <li key={b}><Icon name="checkCircle" size={20} className="upgrade-check" /><span>{b}</span></li>
          ))}
        </ul>
        {/* No button until checkout (Stripe) is set up: there's nothing to press yet. */}
        {!pro && PRO_PRICE && (
          <Button kind="prominent" icon="bolt" full large onClick={() => {}}>{`Upgrade for ${PRO_PRICE}`}</Button>
        )}
      </div>
  );
  // While hovering the Pro badge: just the card. Otherwise a backdrop, and a click on it closes the modal.
  return createPortal(hover ? body : (
    <div className="upgrade-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>{body}</div>
  ), document.body);
}
