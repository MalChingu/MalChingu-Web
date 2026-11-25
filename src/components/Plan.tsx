import { planLimit } from "../core/plan";
import { useStore } from "../lib/store";
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
      <span className="small muted">Free · {limit.label}</span>
      <UpgradeButton />
    </div>
  );
}

export const ProBadge = () => <span className="pro-badge"><Icon name="seal" size={16} /> Pro</span>;

/** Upgrade to Pro. Payments aren't set up yet, so it does nothing for now. */
export function UpgradeButton({ full = true }: { full?: boolean }) {
  return <Button kind="prominent" icon="bolt" full={full} onClick={() => {}}>Upgrade to Pro</Button>;
}
