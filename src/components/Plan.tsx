import { planLimit } from "../core/plan";
import { useStore } from "../lib/store";
import { hideProFeatures, showProFeatures, upgradeToPro } from "../lib/upgrade";
import { Icon } from "./Icon";
import { Button } from "./ui";

// Free accounts hold 2 study guides at a time; Pro has no limit. Wide screens show the plan at the bottom of the
// sidebar, phones in Profile → About, and free accounts also on the Guides page.

/** Pro shows a badge; a free account shows its guide count and Upgrade to Pro (payments come later, so the button
 *  doesn't do anything yet). Nothing until the plan has loaded. */
export function PlanCard({ className = "" }: { className?: string }) {
  const store = useStore();
  if (!store.plan) return null;
  if (store.plan === "pro") {
    return <div className={`glass card plan-card pro ${className}`}><ProBadge /><span className="small muted">No limit on study guides.</span></div>;
  }
  const limit = planLimit(store.plan, store.data.guides.length);
  return (
    <div className={`glass card plan-card ${className}`}>
      <div className="plan-card-text">
        <strong>Free</strong>
        <span className="small muted">{limit.message ?? limit.label}</span>
      </div>
      <UpgradeButton full={false} />
    </div>
  );
}

/** A pointer that can hover (a mouse or trackpad), as opposed to a touch screen. */
const canHover = () => window.matchMedia?.("(hover: hover)").matches ?? true;

/** A Pro account's badge: pointed at (or focused), it shines and shows what Pro adds, which goes when the pointer
 *  leaves. On a touch screen a tap shows it instead. No price, nothing to buy. */
export const ProBadge = () => (
  <button type="button" className="pro-badge" aria-label="Korimal Pro: what Pro adds"
    onMouseEnter={(e) => showProFeatures(e.currentTarget, true)} onMouseLeave={hideProFeatures}
    onFocus={(e) => { if (e.currentTarget.matches(":focus-visible")) showProFeatures(e.currentTarget, true); }} onBlur={hideProFeatures}
    onClick={(e) => { if (!canHover()) showProFeatures(e.currentTarget); }}>
    <Icon name="seal" size={16} /> Pro
  </button>
);

/** Upgrade to Pro: opens the Upgrade modal from this button (see components/UpgradeModal). */
export function UpgradeButton({ full = true }: { full?: boolean }) {
  return <Button kind="prominent" icon="bolt" full={full} onClick={(e) => upgradeToPro(e.currentTarget)}>Upgrade to Pro</Button>;
}

/** A free account's limit on Guides or My Words: the count and what it means, with Upgrade to Pro beside it on wide
 *  screens and under it on phones. `full` outlines it once the limit is reached. */
export function LimitNote({ label, message, full }: { label: string; message: string; full: boolean }) {
  return (
    <div className={`glass card guide-limit ${full ? "full" : ""}`}>
      <div className="guide-limit-text">
        <strong>{label}</strong>
        <span className="small muted">{message}</span>
      </div>
      <UpgradeButton full={false} />
    </div>
  );
}
