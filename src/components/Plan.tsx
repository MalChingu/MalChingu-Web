import { useState } from "react";
import { planLimit } from "../core/plan";
import { useStore } from "../lib/store";
import { APPLE_CANCEL_STEPS, cancelMessage, deleteNotice, hasSubscription, priceText, subscriptionLine, type Subscription } from "../lib/subscription";
import { hideProFeatures, showProFeatures, showUpgrade, upgradeToPro } from "../lib/upgrade";
import { Icon } from "./Icon";
import { Button, ConfirmDialog } from "./ui";

// Free accounts hold 2 study guides at a time; Pro has no limit. Wide screens show the plan at the bottom of the
// sidebar, phones in Profile → About, and free accounts also on the Guides page.

/** Pro shows a badge and where the subscription stands (trial, renewal or end date); a subscription bought in the
 *  iPhone/iPad/Mac app adds where it's managed. Its controls are in Settings (SubscriptionSettings). A free account
 *  shows its guide count and Upgrade to Pro. Nothing until the plan has loaded. */
export function PlanCard({ className = "" }: { className?: string }) {
  const store = useStore();
  if (!store.plan) return null;
  if (store.plan === "pro") {
    const sub = store.subscription;
    return (
      <div className={`glass card plan-card pro ${className}`}>
        <div className="plan-card-text">
          <ProBadge />
          {/* The price is Stripe's; the App Store charges in each country's own currency, so its line goes without. */}
          <span className="small muted">
            {(sub && subscriptionLine(sub, sub.source === "stripe" && sub.interval ? priceText(sub.interval) : null))
              ?? "No limit on study guides."}
          </span>
          {sub?.source === "apple" && (
            <span className="small muted">Subscribed through the App Store. Manage it on your iPhone, iPad or Mac.</span>
          )}
        </div>
      </div>
    );
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

/** Upgrade to Pro (the sidebar and the limit notes; no page headers on the web). Pointed at or focused, it shows what
 *  Pro adds and the price, which goes when the pointer leaves. Clicking (or tapping) opens it to stay, with monthly or
 *  yearly and Start Free Trial (Stripe's checkout). */
export function UpgradeButton({ full = true }: { full?: boolean }) {
  return (
    <button type="button" className={`button prominent upgrade-button ${full ? "full" : ""}`}
      onMouseEnter={(e) => showUpgrade(e.currentTarget, true)} onMouseLeave={hideProFeatures}
      onFocus={(e) => { if (e.currentTarget.matches(":focus-visible")) showUpgrade(e.currentTarget, true); }} onBlur={hideProFeatures}
      onClick={(e) => upgradeToPro(e.currentTarget)}>
      <Icon name="bolt" size={18} /><span>Upgrade to Pro</span>
    </button>
  );
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

/** Settings → Account, between Blocked and Delete Account: the subscription, where it stands, and its controls. A
 *  website subscription has Manage Subscription (Stripe's portal: card, invoices, monthly or yearly) and Cancel
 *  Subscription (it ends with the paid period), or Resume once it's set to end. An App Store one is cancelled in
 *  Apple's settings, so it says where. Nothing without a subscription. */
export function SubscriptionSettings() {
  const store = useStore();
  const [busy, setBusy] = useState<"manage" | "cancel" | "resume" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sub = store.subscription;
  if (store.plan !== "pro" || !hasSubscription(sub)) return null;
  const run = async (what: "manage" | "cancel" | "resume", action: () => Promise<string | null>) => {
    setBusy(what);
    setError(null);
    const message = await action();
    if (message) setError(message);
    // Manage Subscription leaves the page on success.
    if (message || what !== "manage") setBusy(null);
  };
  const stripe = sub.source === "stripe";
  return (
    <div className="subscription-settings" aria-label="Subscription">
      <div className="plain-row static">
        <Icon name="seal" size={20} className="accent" />
        <span className="grow">Subscription</span>
      </div>
      <p className="small muted subscription-line">
        {subscriptionLine(sub, stripe && sub.interval ? priceText(sub.interval) : null)}
      </p>
      {stripe ? (
        <div className="subscription-buttons">
          <Button compact disabled={busy !== null} onClick={() => run("manage", store.manageSubscription)}>
            {busy === "manage" ? "Opening…" : "Manage Subscription"}
          </Button>
          {sub.cancelAtPeriodEnd ? (
            <Button compact disabled={busy !== null} onClick={() => run("resume", store.resumeSubscription)}>
              {busy === "resume" ? "Resuming…" : "Resume Subscription"}
            </Button>
          ) : (
            <Button compact disabled={busy !== null} onClick={() => setConfirming(true)}>
              {busy === "cancel" ? "Cancelling…" : "Cancel Subscription"}
            </Button>
          )}
        </div>
      ) : !sub.cancelAtPeriodEnd ? (
        <p className="small muted">{APPLE_CANCEL_STEPS}</p>
      ) : null}
      {error && <p className="small error" role="alert">{error}</p>}
      {confirming && (
        <ConfirmDialog title="Cancel Korimal Pro?" message={cancelMessage(sub)} confirmLabel="Cancel Subscription" cancelLabel="Keep Pro"
          onCancel={() => setConfirming(false)}
          onConfirm={() => { setConfirming(false); run("cancel", store.cancelSubscription); }} />
      )}
    </div>
  );
}

/** Delete Account: what happens to the subscription. A website one is cancelled with the account; an App Store one
 *  keeps billing until it's cancelled in Apple's settings, so that says where. Nothing to say: nothing shown. */
export function DeleteSubscriptionNotice({ sub }: { sub: Subscription | null }) {
  const notice = deleteNotice(sub);
  if (!notice) return null;
  return (
    <div className="delete-subscription-notice" role="note">
      <p className="strong">{notice}</p>
      {sub?.source === "apple" && <p className="small muted">{APPLE_CANCEL_STEPS}</p>}
    </div>
  );
}
