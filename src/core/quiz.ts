import { isCorrectAnswer } from "./answerChecker";
import type { Example, Word } from "./models";

// The "guess the meaning" quiz. Port of Shared/QuizSession.swift.
// Hints can be revealed for free; a wrong answer also reveals the next unrevealed one.
// After MAX_MISTAKES wrong answers the word is revealed.

export const MAX_MISTAKES = 3;
export const HINT_SLOTS = 3;

export type QuizState = "answering" | "solved" | "failed";
export type Outcome =
  | { kind: "correct" }
  | { kind: "wrong"; hint: Example | null }
  | { kind: "outOfTries" }
  | { kind: "ignored" };

export interface QuizSession {
  word: Word;
  mistakes: number;
  state: QuizState;
  revealedHints: number[];
}

export const newQuiz = (word: Word): QuizSession => ({ word, mistakes: 0, state: "answering", revealedHints: [] });

export const isFinished = (q: QuizSession) => q.state !== "answering";
export const triesLeft = (q: QuizSession) => MAX_MISTAKES - q.mistakes;
/** Ended with "I don't know" rather than by running out of tries. */
export const gaveUp = (q: QuizSession) => q.state === "failed" && q.mistakes < MAX_MISTAKES;
export const hintAt = (q: QuizSession, index: number): Example | null => q.word.examples[index] ?? null;
export const isHintRevealed = (q: QuizSession, index: number) => q.revealedHints.includes(index);

export function revealHint(q: QuizSession, index: number): QuizSession {
  if (index < 0 || index >= q.word.examples.length || q.revealedHints.includes(index)) return q;
  return { ...q, revealedHints: [...q.revealedHints, index].sort((a, b) => a - b) };
}

export function submit(q: QuizSession, answer: string): [QuizSession, Outcome] {
  if (q.state !== "answering" || !answer.trim()) return [q, { kind: "ignored" }];
  if (isCorrectAnswer(answer, q.word.meanings)) return [{ ...q, state: "solved" }, { kind: "correct" }];
  const mistakes = q.mistakes + 1;
  const next = q.word.examples.findIndex((_, i) => !q.revealedHints.includes(i));
  const revealedHints = next >= 0 ? [...q.revealedHints, next].sort((a, b) => a - b) : q.revealedHints;
  if (mistakes >= MAX_MISTAKES) {
    return [{ ...q, mistakes, revealedHints, state: "failed" }, { kind: "outOfTries" }];
  }
  return [{ ...q, mistakes, revealedHints }, { kind: "wrong", hint: next >= 0 ? q.word.examples[next] : null }];
}

export function giveUp(q: QuizSession): QuizSession {
  return q.state === "answering" ? { ...q, state: "failed" } : q;
}
