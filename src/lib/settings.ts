import type { CardForm } from "../core/englishForms";
import type { DisplayMode, PartOfSpeech } from "../core/models";

// `profiles.settings` is shared with the app, which also stores fields the web doesn't use
// (notification times, widget options). Edits patch this object rather than rebuild it,
// so nothing the app saved is lost.
export type RawSettings = Record<string, unknown>;

/** `title` is the id of the earned achievement shown under the name (see core/achievements). */
export interface Profile { name: string; avatar: string | null; title?: string | null }

/** Where a flashcard round's words come from. */
export type FlashcardSource = "builtIn" | "mine" | "mix";

export interface Settings {
  display: DisplayMode;
  wordTypes: PartOfSpeech[];
  includeMyWords: boolean;
  deckSize: number;
  /** The Flashcards round setup, saved with the account (shared with the Mac app). */
  flashcardSource: FlashcardSource;
  /** Parts of speech for flashcards; empty means all. */
  flashcardTypes: PartOfSpeech[];
  /** The forms cards show: at least one. */
  flashcardForms: CardForm[];
  /** Seconds per card; 0 is no timer. */
  flashcardSeconds: number;
  /** Whether a card offers one hint (an example sentence). */
  flashcardHints: boolean;
  /** Whether the app has asked once for a username (Not Now counts), so it doesn't ask again on its own. */
  usernameAsked: boolean;
  profile: Profile;
}

const FORMS: CardForm[] = ["dictionary", "past", "present"];

export function readSettings(raw: RawSettings): Settings {
  const profile = (raw.profile ?? {}) as Record<string, unknown>;
  return {
    display: (raw.display as DisplayMode) ?? "both",
    wordTypes: (raw.word_types as PartOfSpeech[]) ?? [],
    includeMyWords: (raw.include_my_words as boolean) ?? true,
    deckSize: (raw.deck_size as number) ?? 10,
    flashcardSource: (["builtIn", "mine", "mix"] as const).find((s) => s === raw.flashcard_source) ?? "builtIn",
    flashcardTypes: Array.isArray(raw.flashcard_types) ? (raw.flashcard_types as PartOfSpeech[]) : [],
    flashcardForms: (() => {
      const forms = Array.isArray(raw.flashcard_forms) ? FORMS.filter((f) => (raw.flashcard_forms as string[]).includes(f)) : [];
      return forms.length ? forms : ["dictionary"];
    })(),
    flashcardSeconds: [10, 20, 30].includes(raw.flashcard_seconds as number) ? (raw.flashcard_seconds as number) : 0,
    flashcardHints: raw.flashcard_hints !== false,
    usernameAsked: raw.username_asked === true,
    profile: { name: (profile.name as string) ?? "", avatar: (profile.avatar as string) ?? null, title: (profile.title as string) ?? null },
  };
}

/** Patch for each setting, in the app's column names. */
export function settingsPatch(change: Partial<Settings>, raw: RawSettings): RawSettings {
  const patch: RawSettings = {};
  if (change.display !== undefined) patch.display = change.display;
  if (change.wordTypes !== undefined) patch.word_types = change.wordTypes;
  if (change.includeMyWords !== undefined) patch.include_my_words = change.includeMyWords;
  if (change.deckSize !== undefined) patch.deck_size = change.deckSize;
  if (change.flashcardSource !== undefined) patch.flashcard_source = change.flashcardSource;
  if (change.flashcardTypes !== undefined) patch.flashcard_types = change.flashcardTypes;
  if (change.flashcardForms !== undefined) patch.flashcard_forms = change.flashcardForms;
  if (change.flashcardSeconds !== undefined) patch.flashcard_seconds = change.flashcardSeconds;
  if (change.flashcardHints !== undefined) patch.flashcard_hints = change.flashcardHints;
  if (change.usernameAsked !== undefined) patch.username_asked = change.usernameAsked;
  if (change.profile !== undefined) {
    patch.profile = { ...((raw.profile ?? {}) as object), name: change.profile.name, avatar: change.profile.avatar,
      ...(change.profile.title !== undefined ? { title: change.profile.title } : {}) };
  }
  return patch;
}

export const initials = (name: string) =>
  name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
