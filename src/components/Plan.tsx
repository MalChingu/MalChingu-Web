import { planLimit } from "../core/plan";
import { useStore } from "../lib/store";
import { upgradeToPro } from "../lib/upgrade";
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

export const ProBadge = () => <span className="pro-badge"><Icon name="seal" size={16} /> Pro</span>;

/** Upgrade to Pro (see lib/upgrade: it does nothing until payments are set up). */
export function UpgradeButton({ full = true }: { full?: boolean }) {
  return <Button kind="prominent" icon="bolt" full={full} onClick={upgradeToPro}>Upgrade to Pro</Button>;
}
