// Korimal Pro's subscription: what my_plan() says about it, the line under Pro in Profile, and the checkout words.
// Shared with the iPhone/iPad/Mac app (Shared/Subscription.swift), checked by subscription.cases.json. A subscription
// comes from Stripe (the website) or Apple (the app's in-app purchase); prices are passed in as text ("$4.99/month"),
// because the App Store shows each country its own.

export type Interval = "month" | "year";

export const TRIAL_DAYS = 7;

/** The subscription, as my_plan() returns it. */
export interface Subscription {
  /** "stripe" (the website), "apple" (the app's in-app purchase), "manual" (Pro given by hand), or null. */
  source: string | null;
  /** trialing, active, past_due, canceled, ... */
  status: string | null;
  interval: Interval | null;
  /** When it renews, or ends if cancelled (ISO). */
  renewsAt: string | null;
  trialEnd: string | null;
  cancelAtPeriodEnd: boolean;
  /** A free account that hasn't had its trial on the website yet. */
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

/** "Dec 4", in the device's own time zone. */
export const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/** The line under Pro in Profile: the trial, renewal or end date, or a failed payment. `price` is what it costs each
 *  period ("$4.99/month"), or null when it isn't known. Null for Pro given by hand or a subscription that has ended. */
export function subscriptionLine(sub: Subscription, price: string | null): string | null {
  if (sub.source !== "stripe" && sub.source !== "apple") return null;
  if (sub.status === "canceled") return null;
  if (sub.status === "past_due") {
    return sub.source === "apple"
      ? "Your last payment didn't go through. Update your payment method in your Apple Account settings."
      : "Your last payment didn't go through. Update your card in Manage Subscription.";
  }
  if (sub.status === "trialing" && sub.trialEnd) {
    const end = shortDate(sub.trialEnd);
    if (sub.cancelAtPeriodEnd) return `Free trial, ends ${end}. It won't renew.`;
    return price ? `Free trial until ${end}, then ${price}.` : `Free trial until ${end}.`;
  }
  if (sub.renewsAt) {
    const date = shortDate(sub.renewsAt);
    if (sub.cancelAtPeriodEnd) return `Ends ${date}. It won't renew.`;
    return price ? `${price}, renews ${date}.` : `Renews ${date}.`;
  }
  return null;
}

/** The checkout button: Start Free Trial while the trial is there, otherwise Upgrade to Pro. */
export const checkoutLabel = (trial: boolean) => (trial ? "Start Free Trial" : "Upgrade to Pro");

/** Under the checkout button: what happens after the trial (or today), and that it can be cancelled. */
export const checkoutTerms = (price: string, trial: boolean) =>
  trial ? `Free for ${TRIAL_DAYS} days, then ${price}. Cancel anytime.` : `${price}, renews automatically. Cancel anytime.`;

/** What paying yearly saves, in months ("2 months free": $49.99 a year against $4.99 a month), or null when it saves
 *  less than about a month. */
export function yearlySaving(monthly: number, yearly: number): string | null {
  if (!(monthly > 0) || !(yearly > 0)) return null;
  const months = Math.round(12 - yearly / monthly);
  return months >= 1 ? `${months} ${months === 1 ? "month" : "months"} free` : null;
}

/** A subscription to show in Settings: bought on the website or in the App Store, and not ended. */
export const hasSubscription = (sub: Subscription | null): sub is Subscription =>
  !!sub && (sub.source === "stripe" || sub.source === "apple") && sub.status !== "canceled";

/** Cancel Subscription's confirmation: when Pro ends, and that nothing more is charged. */
export function cancelMessage(sub: Subscription): string {
  if (sub.status === "trialing" && sub.trialEnd) return `Your free trial ends ${shortDate(sub.trialEnd)} and you won't be charged.`;
  if (sub.renewsAt) {
    return `You keep Pro until ${shortDate(sub.renewsAt)}, then your account goes back to free. You won't be charged again.`;
  }
  return "Your subscription ends and you won't be charged again.";
}

/** Delete Account: what happens to the subscription. A website subscription is cancelled with the account; an App Store
 *  one isn't (only the person can cancel it, in Apple's settings), so it says so while it's still set to renew. */
export function deleteNotice(sub: Subscription | null): string | null {
  if (!hasSubscription(sub)) return null;
  if (sub.source === "stripe") return "Your Korimal Pro subscription is cancelled straight away, and you won't be charged again.";
  return sub.cancelAtPeriodEnd
    ? null
    : "Deleting your account doesn't cancel your App Store subscription or free trial. Apple keeps billing until you cancel it.";
}

/** Where to cancel an App Store subscription, for screens that can't open Apple's settings (the website, Android). */
export const APPLE_CANCEL_STEPS = "Cancel it on your iPhone or iPad in Settings → your name → Subscriptions, or on a Mac in the App Store → your name → Account Settings → Subscriptions.";
