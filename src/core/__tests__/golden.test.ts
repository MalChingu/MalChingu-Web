import { describe, expect, it } from "vitest";
import { displayMeanings, isCorrectAnswer, normalize } from "../answerChecker";
import type { PartOfSpeech, Word } from "../models";
import { dailyStreak, estimateLevel, emptyProgress, recordOnWord } from "../progress";
import { giveUp, newQuiz, revealHint, submit, type QuizSession } from "../quiz";
import { romanize } from "../romanizer";
import { guideRequest } from "../guideRequest";
import { addDays, wordOfDay } from "../wordOfDay";
import { BUILT_IN } from "../wordBank";
import golden from "./golden.json";

// Every expectation here was produced by the Swift app's own code (see scripts/golden in the
// Swift repo notes in README), so passing means the web behaves exactly like the app.

const custom: Word[] = Array.from({ length: 5 }, (_, i) => ({
  id: `c${i}`, hangul: `단어${i}`, romanization: "", meanings: [`word ${i}`],
  pos: (i % 2 === 0 ? "noun" : "phrase") as PartOfSpeech, examples: [],
}));

describe("matches the Swift app", () => {
  it("word of the day for every day of 2026-2027", () => {
    for (const g of golden.wordOfDay) {
      expect(wordOfDay(g.day, BUILT_IN)?.id, g.day).toBe(g.all);
      expect(wordOfDay(g.day, BUILT_IN, ["verb"])?.id).toBe(g.verbs);
      expect(wordOfDay(g.day, BUILT_IN, ["noun", "adjective"])?.id).toBe(g.nounsAdjectives);
      expect(wordOfDay(g.day, [...BUILT_IN, ...custom])?.id).toBe(g.withCustom);
      expect(wordOfDay(g.day, custom, ["phrase"])?.id).toBe(g.customOnlyPhrases);
    }
  });

  it("romanization of all 1,553 Korean strings", () => {
    const mismatches = golden.romanize.filter((g) => romanize(g.in) !== g.out);
    expect(mismatches).toEqual([]);
  });

  it("answer checking and normalizing", () => {
    for (const g of golden.answers) expect(isCorrectAnswer(g.answer, g.accepted), `${g.answer} vs ${g.accepted}`).toBe(g.correct);
    for (const g of golden.normalize) expect(normalize(g.in), g.in).toBe(g.out);
  });

  it("display meanings", () => {
    const byID = new Map(BUILT_IN.map((w) => [w.id, w]));
    for (const g of golden.displayMeanings) expect(displayMeanings(byID.get(g.id)!.meanings)).toEqual(g.out);
  });

  it("guide request sentences", () => {
    const today = "2026-11-16";
    for (const g of golden.guideRequest) {
      expect(guideRequest(g.days, g.minutes, addDays(today, g.startOffset), g.focus, today)).toBe(g.out);
    }
  });

  it("daily streaks", () => {
    for (const g of golden.streaks) expect(dailyStreak(new Set(g.days), "2026-11-11"), g.days.join()).toBe(g.out);
  });

  it("level thresholds", () => {
    for (const g of golden.levels) {
      const progress = Array.from({ length: g.known }, (_, i) => {
        let p = emptyProgress(`k${i}`, "t");
        for (let n = 0; n < 3; n++) p = recordOnWord(p, { correct: true, source: "quiz" }, "t");
        return p;
      });
      expect(estimateLevel(progress)).toBe(g.out);
    }
  });

  it("quiz sessions", () => {
    const gada = BUILT_IN.find((w) => w.id === "b-가다")!;
    for (const g of golden.quizzes) {
      let q: QuizSession = newQuiz(gada);
      const outcomes: string[] = [];
      for (const step of g.script) {
        if (step === "giveUp") { q = giveUp(q); outcomes.push("-"); continue; }
        if (step.startsWith("reveal:")) { q = revealHint(q, Number(step.slice(7))); outcomes.push("-"); continue; }
        const [next, outcome] = submit(q, step.slice(7));
        q = next;
        outcomes.push(outcome.kind === "wrong" ? `wrong:${outcome.hint?.korean ?? "nil"}` : outcome.kind);
      }
      expect(outcomes, g.script.join(" | ")).toEqual(g.outcomes);
      expect(q.state).toBe(g.state);
      expect(q.mistakes).toBe(g.mistakes);
      expect(q.revealedHints).toEqual(g.revealed);
      expect(q.state === "failed" && q.mistakes < 3).toBe(g.gaveUp);
    }
  });
});
