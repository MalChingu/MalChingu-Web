// One hint per flashcard (Shared/FlashcardHint.swift and Android core/FlashcardHint.kt do the same).
// Like the word-of-the-day quiz, the hint is one of the word's example sentences, preferring one that uses the form
// on the card. The guide's Past Form drill asks for Korean, so an example would give it away: its hint is the past
// form's first syllable. A word with no examples gets the first letter of its meaning.

import type { Example, Word } from "./models";

export type FlashcardHint = { kind: "example"; example: Example } | { kind: "start"; text: string };

/** The hint for a card showing `shown` (the dictionary, past or present form); `pastDrill` for the guide's Past
 *  Form drill. Null when there's nothing to hint with. */
export function flashcardHint(word: Pick<Word, "hangul" | "meanings" | "examples" | "tenses">, shown: string, pastDrill = false): FlashcardHint | null {
  if (pastDrill) {
    const past = word.tenses?.past ?? "";
    return past ? { kind: "start", text: Array.from(past)[0] } : null;
  }
  const example = word.examples.find((e) => e.korean.includes(shown)) ?? word.examples[0];
  if (example) return { kind: "example", example };
  const meaning = (word.meanings[0] ?? "").replace(/^to\s+/i, "").trim();
  return meaning ? { kind: "start", text: meaning[0] } : null;
}
