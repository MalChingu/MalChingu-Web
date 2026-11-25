// Profile pictures: seven presets (BankingBook's, less Camera), stored as their key, e.g. "Rocket", or for Pro
// accounts their own photo, a small square JPEG stored as base64. The presets ship with each app
// (web: public/profile/<key>.png). The database keeps the list in `avatar_presets` and refuses anything else (and
// photos from free accounts). Same as the iPhone and Android apps.

export const AVATAR_PRESETS = ["Astro", "Bolt", "Car", "Chess", "Coffee", "Game", "Rocket"] as const;

export type AvatarPreset = (typeof AVATAR_PRESETS)[number];

/** Shown for a missing or unknown value. */
export const DEFAULT_AVATAR: AvatarPreset = "Astro";

export const isAvatarPreset = (value: string | null | undefined): value is AvatarPreset =>
  AVATAR_PRESETS.includes(value as AvatarPreset);

/** A stored value as a known preset (the default for anything else). */
export const toAvatarPreset = (value: string | null | undefined): AvatarPreset => (isAvatarPreset(value) ? value : DEFAULT_AVATAR);

/** A photo: a JPEG as base64 (JPEG's first bytes are "/9j/" in base64). */
export const isPhotoAvatar = (value: string | null | undefined): value is string =>
  typeof value === "string" && value.startsWith("/9j/") && /^[A-Za-z0-9+/]+={0,2}$/.test(value);

/** What a saved picture shows: a preset, "photo", or null for none. Anything else shows the default preset. */
export function shownAvatar(value: string | null | undefined): AvatarPreset | "photo" | null {
  if (!value) return null;
  return isPhotoAvatar(value) ? "photo" : toAvatarPreset(value);
}

/** A preset at random, never the one being replaced. @param random in [0, 1) */
export function pickAvatarPreset(replacing: string | null = null, random: number = Math.random()): AvatarPreset {
  const choices = AVATAR_PRESETS.filter((a) => a !== replacing);
  return choices[Math.min(choices.length - 1, Math.floor(random * choices.length))];
}

export const avatarURL = (preset: AvatarPreset) => `/profile/${preset}.png`;
