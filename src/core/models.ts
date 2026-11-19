// Data shapes shared with the Swift app and the Supabase tables.

export type PartOfSpeech = "verb" | "adjective" | "noun" | "adverb" | "phrase";
export const PARTS_OF_SPEECH: PartOfSpeech[] = ["verb", "adjective", "noun", "adverb", "phrase"];

export const posLabel: Record<PartOfSpeech, string> = {
  verb: "Verb", adjective: "Adjective", noun: "Noun", adverb: "Adverb", phrase: "Phrase",
};
export const posPlural = (pos: PartOfSpeech) => posLabel[pos] + "s";

export type DisplayMode = "korean" | "romanization" | "both";
export const displayLabel: Record<DisplayMode, string> = { korean: "Korean", romanization: "Romanization", both: "Both" };

export interface Example { korean: string; romanization: string; english: string }
export interface Tenses { past: string; present: string; future: string }

export interface Word {
  /** Built-in words use "b-" + hangul; custom words use their row id (lowercase uuid). */
  id: string;
  hangul: string;
  romanization: string;
  /** Accepted English answers, most common first. */
  meanings: string[];
  pos: PartOfSpeech;
  examples: Example[];
  tenses?: Tenses | null;
}

/** A row of `custom_words`. */
export interface CustomWordRow {
  id: string;
  user_id?: string;
  hangul: string;
  romanization: string;
  meanings: string[];
  pos: PartOfSpeech;
  examples: Example[];
  tenses: Tenses | null;
  source: string;
  guide_id: string | null;
  day_number: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface StudyGuideRow {
  id: string;
  title: string;
  overview: string;
  start_date: string;
  total_days: number;
  source_summary: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface GuideSessionRow {
  id: string;
  guide_id: string;
  day_number: number;
  title: string;
  goals: string[];
  grammar_notes: string;
  /** "Check Yourself" questions; missing on rows saved before it existed. */
  self_check?: CheckItem[];
  updated_at: string;
}

/** A row of `user_notes`: the learner's own note, optionally tagged with a guide, a day and a section. */
export interface UserNoteRow {
  id: string;
  guide_id: string | null;
  day_number: number | null;
  section: NoteSection | null;
  body: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type NoteSection = "notes" | "check" | "vocabulary" | "tasks";

/** A row of `saved_translations`: a translation kept from the Translate card. */
export interface SavedTranslationRow {
  id: string;
  source: string;
  source_lang: "ko" | "en";
  translation: string;
  guide_id: string | null;
  day_number: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CheckItem {
  question: string;
  answer: string;
}

export interface GuideTaskRow {
  id: string;
  session_id: string;
  guide_id: string;
  position: number;
  text: string;
  done: boolean;
  updated_at: string;
}
