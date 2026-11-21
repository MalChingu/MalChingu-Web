import { describe, expect, it } from "vitest";
import { buildDeck, computeStats, emptyDay, emptyProgress, recordOnDay, recordOnWord, type WordProgress } from "../progress";
import { activeCustomWords } from "../wordBank";
import { BUILT_IN } from "../wordBank";
import type { CustomWordRow } from "../models";
import { flashcardHint } from "../flashcardHint";

describe("progress recording", () => {
  it("records streaks, don't-knows, hints and first review", () => {
    let p = emptyProgress("b-가다", "t0");
    p = recordOnWord(p, { correct: false, gaveUp: true, hints: 2, source: "quiz" }, "t0");
    p = recordOnWord(p, { correct: false, source: "flashcard" }, "t1");
    p = recordOnWord(p, { correct: true, gaveUp: true, hints: 1, source: "quiz" }, "t1");
    expect(p).toMatchObject({ wrong: 2, dont_know: 1, correct: 1, hints_used: 3, streak: 1, best_streak: 1,
      first_reviewed: "t0", last_reviewed: "t1" });
  });

  it("counts a day's answers by source", () => {
    let d = emptyDay("2026-11-16", "t");
    d = recordOnDay(d, { correct: true, source: "quiz", hints: 2 }, "t");
    d = recordOnDay(d, { correct: false, source: "flashcard", gaveUp: true }, "t");
    expect(d).toMatchObject({ reviews: 2, correct: 1, quiz_answers: 1, flashcard_answers: 1, dont_know: 1, hints_used: 2 });
  });

  it("computes stats", () => {
    let p = emptyProgress("x", "t");
    for (let i = 0; i < 5; i++) p = recordOnWord(p, { correct: true, source: "quiz" }, "t");
    const stats = computeStats([p], [{ ...emptyDay("2026-11-16", "t"), reviews: 5 }], "2026-11-16");
    expect(stats).toMatchObject({ dailyStreak: 1, daysStudied: 1, wordsPracticed: 1, wordsMastered: 1, accuracy: 1 });
  });
});

describe("decks and custom words", () => {
  it("never repeats and favours unmastered words", () => {
    const pool = BUILT_IN.slice(0, 40);
    const progress = new Map<string, WordProgress>();
    for (const w of pool.slice(0, 20)) {
      let p = emptyProgress(w.id, "t");
      for (let i = 0; i < 10; i++) p = recordOnWord(p, { correct: true, source: "flashcard" }, "t");
      progress.set(w.id, p);
    }
    let masteredPicks = 0;
    for (let n = 0; n < 200; n++) {
      const deck = buildDeck(pool, progress, 10);
      expect(new Set(deck.map((w) => w.id)).size).toBe(10);
      masteredPicks += deck.filter((w) => progress.has(w.id)).length;
    }
    expect(masteredPicks).toBeLessThan(600);
    expect(buildDeck(pool, new Map(), 100)).toHaveLength(40);
  });

  it("orders custom words oldest first and drops deleted ones", () => {
    const row = (id: string, created: string, deleted: string | null = null): CustomWordRow => ({
      id, hangul: id, romanization: "", meanings: ["m"], pos: "noun", examples: [], tenses: null, source: "claude",
      guide_id: null, day_number: null, created_at: created, updated_at: created, deleted_at: deleted,
    });
    const words = activeCustomWords([row("B", "2026-02-01T00:00:00Z"), row("A", "2026-01-01T00:00:00Z"),
      row("C", "2026-03-01T00:00:00Z", "2026-03-02T00:00:00Z")]);
    expect(words.map((w) => w.id)).toEqual(["a", "b"]);
  });
});

import { overviewPoints } from "../guideOverview";

describe("guide overview points (same rules as the app)", () => {
  it("uses one point per line, without bullet markers", () => {
    expect(overviewPoints("- 5 days · 30 min a day\n\n• Days 1–2: past tense\n* Day 5: review"))
      .toEqual(["5 days · 30 min a day", "Days 1–2: past tense", "Day 5: review"]);
  });
  it("splits a paragraph into sentences", () => {
    const text = "A 5-day review of Lesson #12 (e.g. 갔어요). Days 1–2 lock in the past tense. 3 tasks a day! Every night, write 1–2 sentences.";
    expect(overviewPoints(text)).toEqual(["A 5-day review of Lesson #12 (e.g. 갔어요).", "Days 1–2 lock in the past tense.",
      "3 tasks a day!", "Every night, write 1–2 sentences."]);
    expect(overviewPoints("")).toEqual([]);
  });
});

import { noteBlocks } from "../noteMarkup";
import noteCases from "./noteMarkup.cases.json";

describe("guide notes markup (same cases as the iPhone and Android apps)", () => {
  for (const [i, c] of noteCases.entries()) {
    it(`case ${i + 1}: ${JSON.stringify(c.input.slice(0, 40))}`, () => {
      expect(noteBlocks(c.input)).toEqual(c.blocks);
    });
  }
});

import { gloss } from "../gloss";
import glossCases from "./gloss.cases.json";
import type { Word } from "../models";

describe("explaining a Korean form in the notes (same cases as the iPhone and Android apps)", () => {
  const words = [...(glossCases.words as Word[]), ...BUILT_IN];
  for (const c of glossCases.cases) {
    it(`${JSON.stringify(c.form)}`, () => {
      expect(gloss(c.form, words)).toEqual(c.gloss);
    });
  }
});

import { formInSentence, koreanWordGaps, pastFormRight, saidRight } from "../koreanWords";
import wordCases from "./word.cases.json";

describe("Korean word helpers (same cases as the iPhone and Android apps)", () => {
  it("finds the gaps between Korean words", () => {
    for (const c of wordCases.gaps) expect(koreanWordGaps(c.text), c.text).toEqual(c.gaps);
  });
  it("checks spoken answers", () => {
    for (const c of wordCases.spoken) expect(saidRight(c.spoken, c.answer), `${c.spoken} / ${c.answer}`).toBe(c.right);
  });
  it("checks past forms", () => {
    for (const c of wordCases.past) expect(pastFormRight(c.given, c.past), c.given).toBe(c.right);
  });
  it("finds the word's form in an example", () => {
    for (const c of wordCases.highlight) expect(formInSentence(c.sentence, c.word), c.sentence).toEqual(c.range);
  });
});

import { acceptedForForm, englishForms, formAnswerRight, formsFor, shownForForm } from "../englishForms";
import englishCases from "./english.cases.json";
import type { PartOfSpeech } from "../models";

describe("English for past and present forms (shared cases)", () => {
  it("conjugates each meaning", () => {
    for (const c of englishCases.forms) {
      expect(englishForms(c.meaning, c.pos as PartOfSpeech), c.meaning).toEqual({ past: c.past, present: c.present });
    }
  });
  it("checks typed meanings for a form", () => {
    for (const c of englishCases.answers) {
      const word = { meanings: c.meanings, pos: c.pos as PartOfSpeech };
      expect(formAnswerRight(c.given, word, c.form as "past" | "present"), `${c.given} (${c.form})`).toBe(c.right);
    }
  });
  it("shows the first form of each meaning", () => {
    for (const c of englishCases.shown) {
      expect(shownForForm({ meanings: c.meanings, pos: c.pos as PartOfSpeech }, c.form as "past" | "present")).toEqual(c.shown);
    }
  });
  it("gives every built-in verb and adjective a past and present", () => {
    const conjugated = BUILT_IN.filter((w) => w.pos === "verb" || w.pos === "adjective");
    expect(conjugated.length).toBe(137);
    for (const w of conjugated) {
      expect(acceptedForForm(w, "past").length, w.hangul).toBeGreaterThan(0);
      expect(acceptedForForm(w, "present").length, w.hangul).toBeGreaterThan(0);
      expect(formsFor(w, ["past", "present"]), w.hangul).toEqual(["past", "present"]);
    }
    expect(formsFor({ pos: "noun", tenses: null }, ["dictionary", "past"])).toEqual(["dictionary"]);
  });
});

describe("flashcard hints", () => {
  const go = { hangul: "가다", meanings: ["to go"], tenses: { past: "갔어요", present: "가요", future: "갈 거예요" },
    examples: [{ korean: "학교에 가요.", romanization: "", english: "I go to school." }, { korean: "어제 갔어요.", romanization: "", english: "I went yesterday." }] };
  it("prefers an example with the form on the card", () => {
    expect(flashcardHint(go, "갔어요")).toEqual({ kind: "example", example: go.examples[1] });
    expect(flashcardHint(go, "가다")).toEqual({ kind: "example", example: go.examples[0] });
  });
  it("gives the first syllable in the Past Form drill", () => {
    expect(flashcardHint(go, "가다", true)).toEqual({ kind: "start", text: "갔" });
  });
  it("falls back to the meaning's first letter", () => {
    expect(flashcardHint({ ...go, examples: [] }, "가다")).toEqual({ kind: "start", text: "g" });
  });
});
