// Korimal Pro on the web: the prices, the 7-day trial, and the subscription's state for Profile. Checkout and the
// customer portal are Stripe's own pages, opened through the billing edge function (supabase/functions/billing in
// the iPhone/Mac repository). The apps don't sell Pro; they pick it up from the account (my_plan).

export type Interval = "month" | "year";

/** The same as the Stripe prices (lookup keys korimal_pro_monthly and korimal_pro_yearly). */
export const PRICES: Record<Interval, { amount: string; per: string; short: string }> = {
  month: { amount: "$4.99", per: "month", short: "mo" },
  year: { amount: "$39.99", per: "year", short: "yr" },
};
export const TRIAL_DAYS = 7;
/** A year at the yearly price against twelve months: $39.99 vs $59.88. */
export const YEARLY_SAVING = "Save 33%";

/** The subscription, as my_plan() returns it. */
export interface Subscription {
  /** "stripe" when it's a subscription (Manage Subscription); "manual" for Pro given by hand. */
  source: string | null;
  /** Stripe's status: trialing, active, past_due, canceled, ... */
  status: string | null;
  interval: Interval | null;
  /** When it renews, or ends if cancelled. */
  renewsAt: string | null;
  trialEnd: string | null;
  cancelAtPeriodEnd: boolean;
  /** A free account that hasn't had its trial yet. */
  trialAvailable: boolean;
}

export const NO_SUBSCRIPTION: Subscription = {
  source: null, status: null, interval: null, renewsAt: null, trialEnd: null, cancelAtPeriodEnd: false, trialAvailable: true,
};

const text = (v: unknown) => (typeof v === "string" && v ? v : null);

export function readSubscription(raw: unknown): Subscription {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    source: text(r.source),
    status: text(r.status),
    interval: r.interval === "month" || r.interval === "year" ? r.interval : null,
    renewsAt: text(r.renews_at),
    trialEnd: text(r.trial_end),
    cancelAtPeriodEnd: r.cancel_at_period_end === true,
    trialAvailable: r.trial_available !== false,
  };
}

/** "Dec 4", in the browser's own time zone. */
export const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/** The line under Pro in Profile: the trial, renewal or end date, or a failed payment. Null for Pro given by hand. */
export function subscriptionLine(sub: Subscription): string | null {
  if (sub.source !== "stripe") return null;
  const price = sub.interval ? `${PRICES[sub.interval].amount}/${PRICES[sub.interval].per}` : null;
  if (sub.status === "past_due") return "Your last payment didn't go through. Update your card in Manage Subscription.";
  if (sub.status === "trialing" && sub.trialEnd) {
    return sub.cancelAtPeriodEnd
      ? `Free trial, ends ${shortDate(sub.trialEnd)}. It won't renew.`
      : `Free trial until ${shortDate(sub.trialEnd)}, then ${price ?? "your plan"}.`;
  }
  if (sub.renewsAt) {
    return sub.cancelAtPeriodEnd ? `Ends ${shortDate(sub.renewsAt)}. It won't renew.` : `${price ? `${price}, renews` : "Renews"} ${shortDate(sub.renewsAt)}.`;
  }
  return null;
}

/** The checkout button: Start Free Trial while the trial is still there, otherwise Upgrade to Pro. */
export const checkoutLabel = (sub: Subscription | null) => (sub?.trialAvailable !== false ? "Start Free Trial" : "Upgrade to Pro");

/** Under the checkout button: what happens after the trial (or today), and that it can be cancelled. */
export function checkoutTerms(interval: Interval, sub: Subscription | null): string {
  const price = `${PRICES[interval].amount}/${PRICES[interval].per}`;
  return sub?.trialAvailable !== false
    ? `Free for ${TRIAL_DAYS} days, then ${price}. Cancel anytime.`
    : `${price}, renews automatically. Cancel anytime.`;
}
