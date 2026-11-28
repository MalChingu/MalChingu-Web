// Korimal Pro on the web: Stripe's prices. Checkout and the customer portal are Stripe's own pages, opened through the
// billing edge function (supabase/functions/billing in the iPhone/Mac repository). The shared rules (the line under
// Pro, the checkout words) are in core/subscription, the same as the iPhone/iPad/Mac app.

import { yearlySaving, type Interval } from "../core/subscription";

export * from "../core/subscription";

/** The same as the Stripe prices (lookup keys korimal_pro_monthly and korimal_pro_yearly). */
export const PRICES: Record<Interval, { amount: string; value: number; per: string; short: string }> = {
  month: { amount: "$4.99", value: 4.99, per: "month", short: "mo" },
  year: { amount: "$49.99", value: 49.99, per: "year", short: "yr" },
};

/** "$4.99/month". */
export const priceText = (interval: Interval) => `${PRICES[interval].amount}/${PRICES[interval].per}`;

/** Paying yearly: "2 months free". */
export const YEARLY_SAVING = yearlySaving(PRICES.month.value, PRICES.year.value);
