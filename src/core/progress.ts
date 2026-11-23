import { addDays, dayString } from "./wordOfDay";
import type { Word } from "./models";

// Practice history and stats. Port of Shared/Progress.swift.

/** A row of `word_progress`. */
export interface WordProgress {
  word_id: string;
  streak: number;
  best_streak: number;
  correct: number;
  wrong: number;
  dont_know: number;
  hints_used: number;
  first_reviewed: string | null;
  last_reviewed: string | null;
  updated_at: string;
}

/** A row of `study_days`. */
export interface StudyDay {
  day: string;
  reviews: number;
  correct: number;
  quiz_answers: number;
  flashcard_answers: number;
  dont_know: number;
  hints_used: number;
  updated_at: string;
}

export type AnswerSource = "quiz" | "flashcard";

export interface Answer {
  correct: boolean;
  source: AnswerSource;
  /** The learner chose "I don't know". */
  gaveUp?: boolean;
  /** Quiz hints showing when the answer was given. */
  hints?: number;
}

export const MASTERY_STREAK = 5;
export const KNOWN_STREAK = 3;

export function emptyProgress(wordID: string, now: string): WordProgress {
  return { word_id: wordID, streak: 0, best_streak: 0, correct: 0, wrong: 0, dont_know: 0, hints_used: 0,
    first_reviewed: null, last_reviewed: null, updated_at: now };
}

export function recordOnWord(p: WordProgress, a: Answer, now: string): WordProgress {
  const next = { ...p };
  if (a.correct) {
    next.correct += 1;
    next.streak += 1;
    next.best_streak = Math.max(next.best_streak, next.streak);
  } else {
    next.wrong += 1;
    next.streak = 0;
    if (a.gaveUp) next.dont_know += 1;
  }
  next.hints_used += a.hints ?? 0;
  next.first_reviewed ??= now;
  next.last_reviewed = now;
  next.updated_at = now;
  return next;
}

export function emptyDay(day: string, now: string): StudyDay {
  return { day, reviews: 0, correct: 0, quiz_answers: 0, flashcard_answers: 0, dont_know: 0, hints_used: 0, updated_at: now };
}

export function recordOnDay(d: StudyDay, a: Answer, now: string): StudyDay {
  return {
    ...d,
    reviews: d.reviews + 1,
    correct: d.correct + (a.correct ? 1 : 0),
    quiz_answers: d.quiz_answers + (a.source === "quiz" ? 1 : 0),
    flashcard_answers: d.flashcard_answers + (a.source === "flashcard" ? 1 : 0),
    dont_know: d.dont_know + (a.gaveUp && !a.correct ? 1 : 0),
    hints_used: d.hints_used + (a.hints ?? 0),
    updated_at: now,
  };
}

export const attempts = (p: WordProgress) => p.correct + p.wrong;
export const isMastered = (p: WordProgress) => p.streak >= MASTERY_STREAK;

/** Consecutive studied days ending today, or yesterday so the streak isn't shown broken before today's session. */
export function dailyStreak(studied: Set<string>, today: string = dayString()): number {
  let cursor = today;
  if (!studied.has(cursor)) cursor = addDays(cursor, -1);
  let streak = 0;
  while (studied.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export interface Stats {
  dailyStreak: number;
  daysStudied: number;
  wordsPracticed: number;
  wordsMastered: number;
  totalCorrect: number;
  /** Every answer that wasn't right: wrong ones and "I don't know"s together. */
  totalWrong: number;
  /** Of those, the "I don't know"s (no answer tried) … */
  totalDontKnow: number;
  /** … and the answers that were tried but wrong. */
  totalMissed: number;
  accuracy: number | null;
}

export function computeStats(progress: WordProgress[], days: StudyDay[], today: string = dayString()): Stats {
  const studied = new Set(days.filter((d) => d.reviews > 0).map((d) => d.day));
  const totalCorrect = progress.reduce((n, p) => n + p.correct, 0);
  const totalWrong = progress.reduce((n, p) => n + p.wrong, 0);
  const totalDontKnow = progress.reduce((n, p) => n + Math.min(p.dont_know, p.wrong), 0);
  return {
    totalDontKnow,
    totalMissed: totalWrong - totalDontKnow,
    dailyStreak: dailyStreak(studied, today),
    daysStudied: studied.size,
    wordsPracticed: progress.filter((p) => attempts(p) > 0).length,
    wordsMastered: progress.filter(isMastered).length,
    totalCorrect,
    totalWrong,
    accuracy: totalCorrect + totalWrong ? totalCorrect / (totalCorrect + totalWrong) : null,
  };
}

export type Level = "beginner" | "upperBeginner" | "intermediate" | "advanced";
export const levelLabel: Record<Level, string> = {
  beginner: "Beginner", upperBeginner: "Upper Beginner", intermediate: "Intermediate", advanced: "Advanced",
};

/** Estimated from how many words have been answered correctly three times in a row (same rule as the app and connector). */
export function estimateLevel(progress: WordProgress[]): Level {
  const known = progress.filter((p) => p.best_streak >= KNOWN_STREAK).length;
  if (known < 50) return "beginner";
  if (known < 150) return "upperBeginner";
  if (known < 400) return "intermediate";
  return "advanced";
}

/** A flashcard deck that favours words the learner hasn't nailed yet, with no repeats. */
export function buildDeck(pool: Word[], progress: Map<string, WordProgress>, count: number, random = Math.random): Word[] {
  const remaining = pool.map((word) => {
    const p = progress.get(word.id);
    return { word, weight: !p || attempts(p) === 0 ? 1.5 : 0.15 + 1 / (1 + p.streak) };
  });
  const deck: Word[] = [];
  while (deck.length < count && remaining.length) {
    const total = remaining.reduce((n, r) => n + r.weight, 0);
    let roll = random() * total;
    let chosen = remaining.length - 1;
    for (let i = 0; i < remaining.length; i++) {
      roll -= remaining[i].weight;
      if (roll < 0) { chosen = i; break; }
    }
    deck.push(remaining.splice(chosen, 1)[0].word);
  }
  return deck;
}
