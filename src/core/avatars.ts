// Profile pictures: eight presets (the same as BankingBook's), stored as their key, e.g. "Rocket". The pictures ship
// with each app (web: public/profile/<key>.png). The database keeps the list in `avatar_presets` and refuses any
// other value. Same as the iPhone and Android apps.

export const AVATAR_PRESETS = ["Astro", "Bolt", "Camera", "Car", "Chess", "Coffee", "Game", "Rocket"] as const;

export type AvatarPreset = (typeof AVATAR_PRESETS)[number];

/** Shown for a missing or unknown value. */
export const DEFAULT_AVATAR: AvatarPreset = "Astro";

export const isAvatarPreset = (value: string | null | undefined): value is AvatarPreset =>
  AVATAR_PRESETS.includes(value as AvatarPreset);

/** A stored value as a known preset (the default for anything else). */
export const toAvatarPreset = (value: string | null | undefined): AvatarPreset => (isAvatarPreset(value) ? value : DEFAULT_AVATAR);

/** A preset at random, never the one being replaced. @param random in [0, 1) */
export function pickAvatarPreset(replacing: string | null = null, random: number = Math.random()): AvatarPreset {
  const choices = AVATAR_PRESETS.filter((a) => a !== replacing);
  return choices[Math.min(choices.length - 1, Math.floor(random * choices.length))];
}

export const avatarURL = (preset: AvatarPreset) => `/profile/${preset}.png`;
