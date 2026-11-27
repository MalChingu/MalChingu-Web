import { useEffect, useState } from "react";
import { useStore } from "../lib/store";
import { PRICES, TRIAL_DAYS, shortDate } from "../lib/subscription";
import { PRO_BENEFITS } from "../lib/upgrade";
import { Icon } from "./Icon";
import { Button, Card, LoadingSpinner, Sheet } from "./ui";

/** What the checkout page sent back (?checkout=success or cancel), read once and then taken out of the address. */
function takeCheckoutResult(): "success" | "cancel" | null {
  const url = new URL(window.location.href);
  const result = url.searchParams.get("checkout");
  if (!result) return null;
  url.searchParams.delete("checkout");
  window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  return result === "success" ? "success" : result === "cancel" ? "cancel" : null;
}

/** Back from Stripe's checkout: "Welcome to Korimal Pro". Stripe tells the server a moment later (its webhook), so the
 *  plan is reloaded every 2 seconds until it says Pro (up to 30 seconds). A cancelled checkout shows nothing. */
export function CheckoutReturn() {
  const store = useStore();
  const [result] = useState(takeCheckoutResult);
  const [open, setOpen] = useState(result === "success");
  const [waited, setWaited] = useState(false);
  const pro = store.plan === "pro";

  useEffect(() => {
    if (!open || pro || !store.session) return;
    let tries = 0;
    const timer = window.setInterval(async () => {
      tries += 1;
      const plan = await store.refreshPlan();
      if (plan === "pro" || tries >= 15) {
        window.clearInterval(timer);
        if (plan !== "pro") setWaited(true);
      }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [open, pro, store.session]);   // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;
  const sub = store.subscription;
  const trialEnd = sub?.status === "trialing" && sub.trialEnd ? shortDate(sub.trialEnd) : null;
  const price = sub?.interval ? `${PRICES[sub.interval].amount}/${PRICES[sub.interval].per}` : null;
  return (
    <Sheet title="Welcome to Korimal Pro" onClose={() => setOpen(false)}>
      <Card className="checkout-welcome">
        {pro ? (
          <>
            <p className="checkout-welcome-lead">
              {trialEnd
                ? `Your ${TRIAL_DAYS}-day free trial has started. It ends ${trialEnd}${price ? `, then ${price}` : ""}.`
                : "You're on Korimal Pro. Thank you!"}
            </p>
            <ul className="upgrade-benefits">
              {PRO_BENEFITS.map((b) => (
                <li key={b}><Icon name="checkCircle" size={20} className="upgrade-check" /><span>{b}</span></li>
              ))}
            </ul>
            <p className="small muted">Pro works in every Korimal app. Manage or cancel it anytime in Profile.</p>
          </>
        ) : waited ? (
          <p>
            Your payment went through, and Pro is still being set up. It usually takes a moment: check Profile again soon,
            or email us if it doesn't appear.
          </p>
        ) : (
          <div className="checkout-waiting"><LoadingSpinner /><span className="muted">Setting up Pro…</span></div>
        )}
      </Card>
      <Button kind="prominent" large full onClick={() => setOpen(false)}>Done</Button>
    </Sheet>
  );
}
