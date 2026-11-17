import type { DisplayMode, PartOfSpeech } from "../core/models";

// `profiles.settings` is shared with the app, which also stores fields the web doesn't use
// (notification times, widget options). Edits patch this object rather than rebuild it,
// so nothing the app saved is lost.
export type RawSettings = Record<string, unknown>;

export interface Profile { name: string; avatar: string | null }

export interface Settings {
  display: DisplayMode;
  wordTypes: PartOfSpeech[];
  includeMyWords: boolean;
  deckSize: number;
  profile: Profile;
}

export function readSettings(raw: RawSettings): Settings {
  const profile = (raw.profile ?? {}) as Record<string, unknown>;
  return {
    display: (raw.display as DisplayMode) ?? "both",
    wordTypes: (raw.word_types as PartOfSpeech[]) ?? [],
    includeMyWords: (raw.include_my_words as boolean) ?? true,
    deckSize: (raw.deck_size as number) ?? 10,
    profile: { name: (profile.name as string) ?? "", avatar: (profile.avatar as string) ?? null },
  };
}

/** Patch for each setting, in the app's column names. */
export function settingsPatch(change: Partial<Settings>, raw: RawSettings): RawSettings {
  const patch: RawSettings = {};
  if (change.display !== undefined) patch.display = change.display;
  if (change.wordTypes !== undefined) patch.word_types = change.wordTypes;
  if (change.includeMyWords !== undefined) patch.include_my_words = change.includeMyWords;
  if (change.deckSize !== undefined) patch.deck_size = change.deckSize;
  if (change.profile !== undefined) {
    patch.profile = { ...((raw.profile ?? {}) as object), name: change.profile.name, avatar: change.profile.avatar };
  }
  return patch;
}

export const initials = (name: string) =>
  name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
