// What a purple Korean form in a guide's notes means, from what the app already knows: a small table of
// endings and particles, then the learner's words (guide words and My Words first, then the built-in ones)
// and their tenses. Free and offline; anything else goes to the browser's translator, if it has one.
// The same rules as Shared/Gloss.swift and Android's core/Gloss.kt; the three share gloss-cases.json.

import type { Word } from "./models";
import { containsHangul, romanize } from "./romanizer";

export interface Gloss { form: string; romanization: string; meaning: string }

const TABLE: Record<string, string> = {
  "-았어요": "Past ending, after ㅏ or ㅗ",
  "-었어요": "Past ending, after other vowels",
  "-했어요": "Past of 하다 verbs",
  "-아요": "Present ending, after ㅏ or ㅗ",
  "-어요": "Present ending, after other vowels",
  "-해요": "Present of 하다 verbs",
  "-지 않아요": "Not (after a verb stem)",
  "-지 않았어요": "Did not (after a verb stem)",
  "-고": "And (links two verbs)",
  "-는데": "But / and (sets the scene)",
  "-(으)ㄹ 거예요": "Future ending",
  "-ㄹ 거예요": "Future ending",
  "-을 거예요": "Future ending",
  "ㅆ": "Past marker",
  "안": "Not (before a verb)",
  "은/는": "Topic marker",
  "은": "Topic marker (after a consonant)",
  "는": "Topic marker (after a vowel)",
  "이/가": "Subject marker",
  "이": "Subject marker (after a consonant)",
  "가": "Subject marker (after a vowel)",
  "을/를": "Object marker",
  "을": "Object marker (after a consonant)",
  "를": "Object marker (after a vowel)",
  "제가": "I (polite, as the subject)",
  "내가": "I (casual, as the subject)",
  "네가": "You (casual, as the subject)",
  "니가": "You (casual, as the subject; spoken)",
  "저는": "I (polite, as the topic)",
  "나는": "I (casual, as the topic)",
};

/** Longest first, so 에서는 is tried before 에서 and 는, and 이랑 before 랑. */
const PARTICLES: [string, string][] = [
  ["에서는", "at / from (as the topic)"], ["에게는", "to (as the topic)"], ["한테는", "to (as the topic)"],
  ["께서는", "topic (polite)"], ["에서도", "at / from, too"], ["에게서", "from"],
  ["에서", "at / from"], ["에는", "at / in (as the topic)"], ["에도", "at / to, too"], ["에게", "to"], ["한테", "to"],
  ["께서", "subject (polite)"], ["까지", "until / to"], ["부터", "from"], ["보다", "than"], ["처럼", "like"],
  ["으로", "by / to"], ["이나", "or"], ["하고", "and / with"], ["이랑", "and / with"], ["랑", "and / with"],
  ["은", "topic"], ["는", "topic"], ["이", "subject"], ["가", "subject"], ["을", "object"], ["를", "object"],
  ["와", "and / with"], ["과", "and / with"], ["로", "by / to"], ["도", "also"], ["만", "only"], ["께", "to"],
  ["에", "at / to"], ["의", "'s"], ["나", "or"],
];

const OPENERS = new Set([..." \t\"'“”‘’([{"]);
const CLOSERS = new Set([..." \t\"'“”‘’)]}.,!?…:;·✓✗"]);

/** Trims quotes, brackets and punctuation; a leading ~ means an ending, like -. */
export function cleanForm(form: string): string {
  const chars = Array.from(form);
  let start = 0, end = chars.length;
  while (start < end && OPENERS.has(chars[start])) start++;
  while (end > start && CLOSERS.has(chars[end - 1])) end--;
  const s = chars.slice(start, end).join("");
  return s.startsWith("~") || s.startsWith("～") ? "-" + s.slice(1) : s;
}

type Hit = { word: Word; tense: "past" | "present" | "future" | null };

function find(s: string, words: Word[], tenses = true): Hit | null {
  const word = words.find((w) => w.hangul === s);
  if (word) return { word, tense: null };
  if (!tenses) return null;
  for (const w of words) {
    const t = w.tenses;
    if (!t) continue;
    if (t.past === s) return { word: w, tense: "past" };
    if (t.present === s) return { word: w, tense: "present" };
    if (t.future === s) return { word: w, tense: "future" };
  }
  return null;
}

const first = (w: Word) => w.meanings[0] ?? "";
const TENSE = { past: "Past", present: "Present", future: "Future" } as const;

function describe(h: Hit): string {
  return h.tense ? `${TENSE[h.tense]} of ${h.word.hangul} · ${first(h.word)}` : first(h.word);
}

function negative(h: Hit): string {
  return `${h.tense === "past" ? "Not (past)" : "Not"} · ${h.word.hangul} · ${first(h.word)}`;
}

/** 덥고 → 덥다 + -고. */
function connective(s: string, words: Word[]): string | null {
  if (s.length < 2 || !s.endsWith("고")) return null;
  const h = find(s.slice(0, -1) + "다", words, false);
  return h ? `${h.word.hangul} · ${first(h.word)} + -고 (and)` : null;
}

function explain(s: string, words: Word[]): string | null {
  const fixed = TABLE[s] ?? (s.startsWith("-") ? undefined : TABLE["-" + s]);
  if (fixed) return fixed;
  const hit = find(s, words);
  if (hit) return describe(hit);

  if (s.startsWith("안 ")) {
    const rest = s.slice(2).trim();
    const h = find(rest, words);
    if (h) return negative(h);
    const c = connective(rest, words);
    if (c) return `Not · ${c}`;
  }
  // 공부 안 해요: with 하다 verbs, 안 goes right before 해요.
  for (const [ending, past] of [[" 안 했어요", true], [" 안 해요", false]] as const) {
    if (s.length > ending.length && s.endsWith(ending)) {
      const h = find(s.slice(0, -ending.length) + "하다", words, false);
      if (h) return `${past ? "Not (past)" : "Not"} · ${h.word.hangul} · ${first(h.word)}`;
    }
  }
  for (const [ending, past] of [["지 않았어요", true], ["지 않아요", false]] as const) {
    if (s.length > ending.length && s.endsWith(ending)) {
      const h = find(s.slice(0, -ending.length) + "다", words, false);
      if (h) return `${past ? "Not (past)" : "Not"} · ${h.word.hangul} · ${first(h.word)}`;
    }
  }
  const c = connective(s, words);
  if (c) return c;

  for (const [particle, name] of PARTICLES) {
    if (s.length > particle.length && s.endsWith(particle)) {
      const h = find(s.slice(0, -particle.length), words, false);
      if (h) return `${h.word.hangul} (${first(h.word)}) + ${particle} · ${name}`;
    }
  }
  return null;
}

/** Null when the form isn't Korean or the app doesn't know it. */
export function gloss(form: string, words: Word[]): Gloss | null {
  const s = cleanForm(form);
  if (!containsHangul(s)) return null;
  const meaning = explain(s, words);
  return meaning ? { form: s, romanization: romanize(s.replace(/^-/, "")), meaning } : null;
}
