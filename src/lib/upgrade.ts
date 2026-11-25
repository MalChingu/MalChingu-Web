// Upgrade to Pro: every Upgrade button, the Guides and My Words notes, the photo upload tile and the longer Create
// Guide lengths open one modal, floating up from the control that was tapped (see components/UpgradeModal).

/** The price, once checkout (Stripe) is set up ("$5/month"). Until then the modal says Coming Soon. */
export const PRO_PRICE: string | null = null;
export const PRO_BENEFITS = [
  { icon: "book", title: "Unlimited study guides", detail: "Free: 2 at a time" },
  { icon: "calendar", title: "Guides longer than a week", detail: "2 weeks, a month, 2 months" },
  { icon: "cards", title: "Unlimited My Words", detail: "Free: 50 words" },
  { icon: "camera", title: "Your own profile photo", detail: "Upload any picture" },
] as const;

type Opener = (anchor: DOMRect | null) => void;
let opener: Opener | null = null;

/** Called once by the modal, so the buttons can open it. */
export function setUpgradeOpener(next: Opener | null): void {
  opener = next;
}

/** Opens the modal from `from` (the tapped control), or centred without one. */
export function upgradeToPro(from?: EventTarget | null): void {
  opener?.(from instanceof Element ? from.getBoundingClientRect() : null);
}
