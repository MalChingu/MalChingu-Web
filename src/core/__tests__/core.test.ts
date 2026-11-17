import { describe, expect, it } from "vitest";
import { buildDeck, computeStats, emptyDay, emptyProgress, recordOnDay, recordOnWord, type WordProgress } from "../progress";
import { activeCustomWords } from "../wordBank";
import { BUILT_IN } from "../wordBank";
import type { CustomWordRow } from "../models";

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
