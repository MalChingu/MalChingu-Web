// Small Korean text helpers shared by the three apps (Shared/KoreanWords.swift, Android core/KoreanWords.kt);
// they share word-cases.json.
//  - where to draw a faint dot between Korean words (display only),
//  - checking a spoken or typed Korean answer,
//  - finding a word's form in an example sentence to highlight it.

import type { Tenses } from "./models";

const HANGUL = /[ᄀ-ᇿ㄰-㆏ꥠ-꥿가-힯ힰ-퟿]/;
const isHangul = (c: string | undefined) => c !== undefined && HANGUL.test(c);

/** The spaces between two Korean words: a Hangul letter right before and right after. "먹었어요?, 뭐" has
 *  none, since punctuation already separates it. */
export function koreanWordGaps(text: string): number[] {
  const gaps: number[] = [];
  for (let i = 1; i < text.length - 1; i++) {
    if (text[i] === " " && isHangul(text[i - 1]) && isHangul(text[i + 1])) gaps.push(i);
  }
  return gaps;
}

/** Only the Korean letters (no spaces, punctuation or romanization), for comparing answers. */
export function koreanLetters(text: string): string {
  return Array.from(text).filter(isHangul).join("");
}

/** The Korean answers a Check Yourself answer accepts: each part between "·", "/", ",", ";" or "…", a bracketed
 *  pronunciation ([씨서써요]), and all the parts together. Notes in (parentheses) don't count. */
export function acceptedAnswers(answer: string): string[] {
  const pronunciations = Array.from(answer.matchAll(/\[([^\]]*)\]/g), (m) => koreanLetters(m[1])).filter(Boolean);
  const plain = answer.replace(/\([^)]*\)/g, " ").replace(/\[[^\]]*\]/g, " ");
  const parts = plain.split(/[·/,;…]/).map(koreanLetters).filter(Boolean);
  const accepted = [...parts, ...pronunciations];
  if (parts.length > 1) accepted.push(parts.join(""));
  return Array.from(new Set(accepted));
}

/** Whether what was said (as the speech recogniser wrote it) is one of the accepted answers. */
export function saidRight(spoken: string, answer: string): boolean {
  const said = koreanLetters(spoken);
  return said.length > 0 && acceptedAnswers(answer).includes(said);
}

/** The past form typed or said for a Past Form card, ignoring spaces and punctuation. */
export function pastFormRight(given: string, past: string): boolean {
  const g = koreanLetters(given);
  return g.length > 0 && g === koreanLetters(past);
}

/** Where the word appears in an example sentence, in any of its forms (갔어요 in 어제 서울에 갔어요.), so it can be
 *  highlighted: [start, end), or null. Tries the tenses and the dictionary form, longest first, then a word that
 *  starts with the stem (맛있 → 맛있었네요). */
export function formInSentence(sentence: string, word: { hangul: string; tenses?: Tenses | null }): [number, number] | null {
  const t = word.tenses;
  const forms = [t?.past, t?.present, t?.future, word.hangul]
    .filter((f): f is string => !!f)
    .map((f, i) => ({ f, i }))
    .sort((a, b) => b.f.length - a.f.length || a.i - b.i)
    .map((x) => x.f);
  for (const f of forms) {
    const at = sentence.indexOf(f);
    if (at >= 0) return [at, at + f.length];
  }
  const stem = word.hangul.endsWith("다") ? word.hangul.slice(0, -1) : word.hangul;
  if (!stem) return null;
  let start = 0;
  while (start < sentence.length) {
    while (start < sentence.length && sentence[start] === " ") start++;
    let end = start;
    while (end < sentence.length && sentence[end] !== " ") end++;
    if (end > start && sentence.startsWith(stem, start)) {
      let last = end;
      while (last > start && !isHangul(sentence[last - 1])) last--;
      return [start, last];
    }
    start = end;
  }
  return null;
}
