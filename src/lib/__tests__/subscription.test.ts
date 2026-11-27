import { describe, expect, it } from "vitest";
import { NO_SUBSCRIPTION, checkoutLabel, checkoutTerms, readSubscription, subscriptionLine } from "../subscription";

const stripe = (over: Record<string, unknown>) => readSubscription({ source: "stripe", interval: "month", ...over });

describe("subscription", () => {
  it("reads my_plan's subscription fields", () => {
    expect(readSubscription({ plan: "free" })).toEqual(NO_SUBSCRIPTION);
    expect(readSubscription({ source: "stripe", status: "trialing", interval: "year", renews_at: "2026-12-04T12:00:00Z",
      trial_end: "2026-12-04T12:00:00Z", cancel_at_period_end: true, trial_available: false })).toEqual({
      source: "stripe", status: "trialing", interval: "year", renewsAt: "2026-12-04T12:00:00Z", trialEnd: "2026-12-04T12:00:00Z",
      cancelAtPeriodEnd: true, trialAvailable: false,
    });
  });

  it("says where the subscription stands", () => {
    expect(subscriptionLine(stripe({ status: "trialing", trial_end: "2026-12-04T12:00:00Z" })))
      .toBe("Free trial until Dec 4, then $4.99/month.");
    expect(subscriptionLine(stripe({ status: "trialing", trial_end: "2026-12-04T12:00:00Z", cancel_at_period_end: true })))
      .toBe("Free trial, ends Dec 4. It won't renew.");
    expect(subscriptionLine(stripe({ status: "active", interval: "year", renews_at: "2027-11-27T12:00:00Z" })))
      .toBe("$39.99/year, renews Nov 27.");
    expect(subscriptionLine(stripe({ status: "active", renews_at: "2026-12-27T12:00:00Z", cancel_at_period_end: true })))
      .toBe("Ends Dec 27. It won't renew.");
    expect(subscriptionLine(stripe({ status: "past_due" }))).toMatch(/didn't go through/);
    // Pro given by hand has nothing to manage.
    expect(subscriptionLine(readSubscription({ source: "manual" }))).toBeNull();
  });

  it("offers the trial once", () => {
    expect(checkoutLabel(null)).toBe("Start Free Trial");
    expect(checkoutTerms("month", null)).toBe("Free for 7 days, then $4.99/month. Cancel anytime.");
    const used = readSubscription({ trial_available: false });
    expect(checkoutLabel(used)).toBe("Upgrade to Pro");
    expect(checkoutTerms("year", used)).toBe("$39.99/year, renews automatically. Cancel anytime.");
  });
});
