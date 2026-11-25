// Plans: free accounts hold 2 study guides at a time; Pro has no limit. The database enforces it (a trigger on
// study_guides); this is what the apps show. Same as the iPhone and Android apps.

export type Plan = "free" | "pro";

export const FREE_GUIDES = 2;

export interface PlanLimit {
  /** Free accounts see the count and the Upgrade button; Pro (or a plan not loaded yet) sees nothing. */
  limited: boolean;
  canCreate: boolean;
  /** "1 of 2 guides". */
  label: string | null;
  /** Shown once the limit is reached. */
  message: string | null;
}

export function planLimit(plan: Plan | null, guides: number): PlanLimit {
  if (plan !== "free") return { limited: false, canCreate: true, label: null, message: null };
  const full = guides >= FREE_GUIDES;
  return {
    limited: true,
    canCreate: !full,
    label: guides <= FREE_GUIDES ? `${guides} of ${FREE_GUIDES} guides` : `${guides} guides; free accounts hold ${FREE_GUIDES}`,
    message: full ? LIMIT_REACHED : null,
  };
}

export const LIMIT_REACHED = "You've maxed out your guides. Upgrade to Pro for Unlimited Guides";

/** The `plan` field of my_plan(), or null when it's missing. */
export const readPlan = (value: unknown): Plan | null => (value === "pro" || value === "free" ? value : null);
