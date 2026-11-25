// English in hints, by level. A hint is one of the word's example sentences; for learners who need it, each word of
// the sentence shows its English underneath, except the word being asked about (in any of its forms). Fewer hints
// get English as the level rises: the later hints, opened when you're stuck, keep it longest. The English sentence
// itself still only appears once you've answered. The same rules as Shared/Hints.swift and Android core/Hints.kt;
// the three share hints.cases.json.

import { gloss } from "./gloss";
import { formInSentence } from "./koreanWords";
import type { Tenses, Word } from "./models";
import type { Level } from "./progress";

/** How many of a word's hints (counted from the last) show English at each level. */
const ENGLISH_HINTS: Record<Level, number> = { beginner: 3, upperBeginner: 2, intermediate: 1, advanced: 0 };

/** Whether hint `index` (from 0) of `slots` shows English: Beginner all 3, Upper Beginner hints 2–3, Intermediate
 *  hint 3, Advanced none. A flashcard's single hint (`slots` 1) shows it up to Intermediate. */
export function hintHasEnglish(level: Level, index: number, slots: number): boolean {
  return index >= slots - ENGLISH_HINTS[level];
}

export interface HintWord {
  text: string;
  /** Null for the word being asked about, and for words the app doesn't know. */
  english: string | null;
  /** The word being asked about (or a form of it). */
  target: boolean;
}

/** A gloss's meaning, cut down to fit under a word: "커피 (coffee) + 는 · topic" → "coffee",
 *  "Past of 가다 · to go" → "to go (past)", "Not · 덥다 · to be hot" → "not hot", "I (polite, as the topic)" → "I". */
export function shortMeaning(meaning: string): string {
  let m: RegExpExecArray | null;
  if ((m = /^\S+ \((.+?)\) \+ \S+ · .+$/.exec(meaning))) return m[1];
  if ((m = /^Past of \S+ · (.+)$/.exec(meaning))) return `${m[1]} (past)`;
  if ((m = /^Present of \S+ · (.+)$/.exec(meaning))) return m[1];
  if ((m = /^Not( \(past\))? · \S+ · (.+?)( \+ .*)?$/.exec(meaning))) return `not ${m[2].replace(/^to (be )?/, "")}${m[1] ? " (past)" : ""}`;
  // A table entry: "I (polite, as the topic)" → "I", "Not (before a verb)" → "not".
  const plain = meaning.replace(/ \([^)]*\)$/, "");
  return /^[A-Z][a-z]/.test(plain) ? plain[0].toLowerCase() + plain.slice(1) : plain;
}

/** The sentence's words, each with its English (from the app's own words), the asked-about word left without. */
export function hintWords(sentence: string, target: { hangul: string; tenses?: Tenses | null }, words: Word[]): HintWord[] {
  const span = formInSentence(sentence, target);
  const out: HintWord[] = [];
  for (const m of sentence.matchAll(/\S+/g)) {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    const inSpan = span !== null && start < span[1] && end > span[0];
    const g = inSpan ? null : gloss(m[0], words);
    const isTarget = inSpan || (g !== null && g.meaning.includes(target.hangul));
    out.push({ text: m[0], english: isTarget || !g ? null : shortMeaning(g.meaning), target: isTarget });
  }
  return out;
}
