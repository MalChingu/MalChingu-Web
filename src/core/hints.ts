// English in hints, by level. A hint is one of the word's example sentences; for learners who need it, each word of
// the sentence shows its English underneath, except the word being asked about (in any of its forms). Fewer hints
// get English as the level rises: the later hints, opened when you're stuck, keep it longest. The English sentence
// itself still only appears once you've answered. The same rules as Shared/Hints.swift and Android core/Hints.kt;
// the three share hints.cases.json and hintWords.json.
//
// A word's English comes from, in order: a future across two words (만날 거예요 → "meet" "will"), the hint lexicon
// (hintWords.json: everyday words and forms the sentences use that aren't study words, like 그 "that" or 더 "more"),
// then the notes' gloss rules over the learner's words and the lexicon (so 봄에는 is 봄 "spring" + 에는).

import { cleanForm, gloss } from "./gloss";
import lexicon from "./hintWords.json";
import { formInSentence } from "./koreanWords";
import type { Tenses, Word } from "./models";
import type { Level } from "./progress";

/** Form → [English] or [English, the word it's a form of] (so a form of the word being asked about stays hidden).
 *  A key with its punctuation ("네," yes) is tried before the bare form ("네" four). */
export const HINT_LEXICON: Record<string, string[]> = lexicon;

/** The lexicon as words, for the gloss rules (particles after a lexicon word). */
const LEXICON_WORDS: Word[] = Object.entries(HINT_LEXICON).map(([hangul, [english]]) => ({
  id: `h-${hangul}`, hangul, romanization: "", meanings: [english], pos: "noun", examples: [], tenses: null,
}));

/** "to meet" → "meet", "to be busy" → "busy". */
const plainVerb = (meaning: string) => meaning.replace(/^to (be )?/, "");

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

/** The sentence's words, each with its English, the asked-about word (in any of its forms) left without. */
export function hintWords(sentence: string, target: { hangul: string; tenses?: Tenses | null }, words: Word[]): HintWord[] {
  const span = formInSentence(sentence, target);
  const tokens = Array.from(sentence.matchAll(/\S+/g), (m) => ({ text: m[0], start: m.index ?? 0, end: (m.index ?? 0) + m[0].length }));
  const known = [...words, ...LEXICON_WORDS];
  const out: HintWord[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const { text, start, end } = tokens[i];
    if (span !== null && start < span[1] && end > span[0]) {
      out.push({ text, english: null, target: true });
      continue;
    }
    // A future across two words: 만날 거예요 → "meet" "will".
    const next = tokens[i + 1];
    if (next && cleanForm(next.text) === "거예요") {
      const phrase = `${cleanForm(text)} 거예요`;
      // 살 거예요 is the future of both 사다 (buy) and 살다 (live): both meanings.
      const verbs = words.filter((w) => w.tenses?.future === phrase);
      if (verbs.length > 0) {
        const isTarget = verbs.some((v) => v.hangul === target.hangul);
        const english = [...new Set(verbs.map((v) => plainVerb(v.meanings[0] ?? "")))].join(" / ");
        out.push({ text, english: isTarget ? null : english, target: isTarget });
        out.push({ text: next.text, english: isTarget ? null : "will", target: isTarget });
        i++;
        continue;
      }
    }
    const lex = HINT_LEXICON[text] ?? HINT_LEXICON[cleanForm(text)];
    if (lex) {
      const isTarget = lex[1] === target.hangul;
      out.push({ text, english: isTarget ? null : lex[0], target: isTarget });
      continue;
    }
    const g = gloss(text, known);
    const isTarget = g !== null && g.meaning.includes(target.hangul);
    out.push({ text, english: isTarget || !g ? null : shortMeaning(g.meaning), target: isTarget });
  }
  return out;
}
