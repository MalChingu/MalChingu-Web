// Plans: free accounts hold 2 study guides at a time; Pro has no limit. The database enforces it (a trigger on
// study_guides); this is what the apps show. Same as the iPhone and Android apps.

export type Plan = "free" | "pro";

export const FREE_GUIDES = 2;
/** The longest guide a free account can make (Pro: any length). */
export const FREE_GUIDE_DAYS = 7;
/** Words a free account can keep in My Words, guide vocabulary included (Pro: no limit). */
export const FREE_WORDS = 50;

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
export const WORDS_REACHED = "You've maxed out your words. Upgrade to Pro for Unlimited Words";

/** The longest guide this plan can make: 7 days on the free plan, null for no limit (Pro, or not loaded yet). */
export const maxGuideDays = (plan: Plan | null): number | null => (plan === "free" ? FREE_GUIDE_DAYS : null);

export interface WordLimit {
  /** A free account at (or over) 50 words: My Words shows the note with Upgrade to Pro. */
  full: boolean;
  label: string | null;
  message: string | null;
}

export function wordLimit(plan: Plan | null, words: number): WordLimit {
  if (plan !== "free" || words < FREE_WORDS) return { full: false, label: null, message: null };
  return {
    full: true,
    label: words === FREE_WORDS ? `${words} of ${FREE_WORDS} words` : `${words} words; free accounts keep ${FREE_WORDS}`,
    message: WORDS_REACHED,
  };
}

/** The `plan` field of my_plan(), or null when it's missing. */
export const readPlan = (value: unknown): Plan | null => (value === "pro" || value === "free" ? value : null);
