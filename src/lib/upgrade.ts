// Upgrade to Pro: every Upgrade button, the Guides and My Words notes, the photo upload tile and the longer Create
// Guide lengths open one modal, floating up from the control that was tapped (see components/UpgradeModal). A Pro
// account's badge shows the same modal, just what Pro adds, while the pointer is over it.

/** The price, once checkout (Stripe) is set up ("$5/month"). Until then the modal says Coming Soon. */
export const PRO_PRICE: string | null = null;
/** What Pro adds: one line each, with a green ✓. */
export const PRO_BENEFITS = ["Unlimited Study Guides", "Unlimited Guide Timeframes", "Unlimited “My Words”", "Custom Profile Photo"] as const;

/** "upgrade": the price (Coming Soon for now) and what Pro adds. "pro": a Pro account's own badge, just what Pro adds. */
export type UpgradeMode = "upgrade" | "pro";
/** The control's rect, the sidebar's when the control is in it (the modal then fits inside the sidebar), and whether
 *  it only shows while the pointer is over the control (`hover`). */
type Opener = (anchor: DOMRect | null, mode: UpgradeMode, sidebar: DOMRect | null, hover: boolean) => void;
let opener: Opener | null = null;
let hoverCloser: (() => void) | null = null;

/** Called once by the modal, so the buttons can open it (and the Pro badge close it when the pointer leaves). */
export function setUpgradeOpener(next: Opener | null, closeHover: (() => void) | null = null): void {
  opener = next;
  hoverCloser = closeHover;
}

/** Opens the modal from `from` (the tapped control), or centred without one. */
export function upgradeToPro(from?: EventTarget | null): void {
  open(from, "upgrade");
}

/** A Pro account's badge: the same modal with what Pro adds, without the price or a button. With `hover`, it shows
 *  only while the pointer is over the badge (see hideProFeatures). */
export function showProFeatures(from?: EventTarget | null, hover = false): void {
  open(from, "pro", hover);
}

/** The pointer left the Pro badge: what Pro adds goes, if it was showing for the hover. */
export function hideProFeatures(): void {
  hoverCloser?.();
}

function open(from: EventTarget | null | undefined, mode: UpgradeMode, hover = false) {
  const el = from instanceof Element ? from : null;
  const sidebar = el?.closest(".tabs");
  opener?.(el?.getBoundingClientRect() ?? null, mode, sidebar ? sidebar.getBoundingClientRect() : null, hover);
}
