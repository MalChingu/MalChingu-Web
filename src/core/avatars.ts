// Default pictures: the app logo on one of five backgrounds (two plain, three gradients), none of them the app icon's
// own purple-to-teal. Saved as their key ("default:3") instead of an image. Same as the iPhone and Android apps.

export interface DefaultAvatar { key: string; colors: string[]; ink: string }

export const DEFAULT_AVATARS: DefaultAvatar[] = [
  { key: "default:1", colors: ["#F26B5B"], ink: "#B4372A" },
  { key: "default:2", colors: ["#F5A524"], ink: "#A16207" },
  { key: "default:3", colors: ["#EC4899", "#F97316"], ink: "#BE185D" },
  { key: "default:4", colors: ["#16A34A", "#84CC16"], ink: "#166534" },
  { key: "default:5", colors: ["#1E3A8A", "#38BDF8"], ink: "#1E3A8A" },
];

export const defaultAvatar = (avatar: string | null | undefined) => DEFAULT_AVATARS.find((a) => a.key === avatar) ?? null;
export const isDefaultAvatar = (avatar: string | null | undefined) => defaultAvatar(avatar) !== null;

/** A default picture at random, never the one being replaced. @param random in [0, 1) */
export function pickDefaultAvatar(replacing: string | null = null, random: number = Math.random()): string {
  const choices = DEFAULT_AVATARS.filter((a) => a.key !== replacing);
  return choices[Math.min(choices.length - 1, Math.floor(random * choices.length))].key;
}
