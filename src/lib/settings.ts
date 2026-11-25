import { DEFAULT_AVATAR, isAvatarPreset, isPhotoAvatar } from "../core/avatars";
import type { CardForm } from "../core/englishForms";
import type { DisplayMode, PartOfSpeech } from "../core/models";

/** Your row of `profiles`: every setting is its own column (typed and checked by the database), shared with the
 *  iPhone, Mac and Android apps, which also use the notification and widget columns. */
export interface ProfileRow {
  name?: string;
  avatar?: string | null;
  title?: string | null;
  display?: string;
  quiz_on_tap?: boolean;
  deck_size?: number;
  flashcard_source?: string;
  flashcard_types?: string[];
  flashcard_forms?: string[];
  flashcard_seconds?: number;
  flashcard_hints?: boolean;
  tour_done?: boolean;
  word_notification?: boolean;
  word_notification_minutes?: number;
  practice_reminder?: boolean;
  practice_reminder_minutes?: number;
  updated_at?: string;
}

/** `avatar` is a preset key or a Pro account's photo (see core/avatars). `title` is the id of the earned achievement shown under the name
 *  (see core/achievements). */
export interface Profile { name: string; avatar: string | null; title?: string | null }

/** A saved picture: a preset key or a photo; anything else (an older default picture) reads as the default preset, so
 *  saving the profile again never sends a value the database refuses. */
export const readAvatar = (value: unknown): string | null =>
  typeof value === "string" && value ? (isAvatarPreset(value) || isPhotoAvatar(value) ? value : DEFAULT_AVATAR) : null;

/** Where a flashcard round's words come from. */
export type FlashcardSource = "builtIn" | "mine" | "mix";

export interface Settings {
  display: DisplayMode;
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
  /** The first-time tour of Today, Flashcards, Guides and Stats has been shown (finished or skipped). */
  tourDone: boolean;
  profile: Profile;
}

const FORMS: CardForm[] = ["dictionary", "past", "present"];

const POS: PartOfSpeech[] = ["verb", "adjective", "noun", "adverb", "phrase"];

export function readSettings(row: ProfileRow): Settings {
  const forms = FORMS.filter((f) => (row.flashcard_forms ?? []).includes(f));
  return {
    display: (["korean", "romanization", "both"] as DisplayMode[]).find((d) => d === row.display) ?? "both",
    deckSize: typeof row.deck_size === "number" ? row.deck_size : 10,
    flashcardSource: (["builtIn", "mine", "mix"] as const).find((s) => s === row.flashcard_source) ?? "builtIn",
    flashcardTypes: POS.filter((p) => (row.flashcard_types ?? []).includes(p)),
    flashcardForms: forms.length ? forms : ["dictionary"],
    flashcardSeconds: [10, 20, 30].includes(row.flashcard_seconds as number) ? (row.flashcard_seconds as number) : 0,
    flashcardHints: row.flashcard_hints !== false,
    tourDone: row.tour_done === true,
    profile: { name: row.name ?? "", avatar: readAvatar(row.avatar), title: row.title ?? null },
  };
}

/** The columns a change touches (only those are sent, so two devices changing different settings don't clash). */
export function settingsPatch(change: Partial<Settings>): ProfileRow {
  const patch: ProfileRow = {};
  if (change.display !== undefined) patch.display = change.display;
  if (change.deckSize !== undefined) patch.deck_size = change.deckSize;
  if (change.flashcardSource !== undefined) patch.flashcard_source = change.flashcardSource;
  if (change.flashcardTypes !== undefined) patch.flashcard_types = change.flashcardTypes;
  if (change.flashcardForms !== undefined) patch.flashcard_forms = change.flashcardForms;
  if (change.flashcardSeconds !== undefined) patch.flashcard_seconds = change.flashcardSeconds;
  if (change.flashcardHints !== undefined) patch.flashcard_hints = change.flashcardHints;
  if (change.tourDone !== undefined) patch.tour_done = change.tourDone;
  if (change.profile !== undefined) {
    patch.name = change.profile.name;
    patch.avatar = change.profile.avatar;
    if (change.profile.title !== undefined) patch.title = change.profile.title;
  }
  return patch;
}

export const initials = (name: string) =>
  name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
