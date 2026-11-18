// Titles a learner earns by completing achievements, e.g. "Word Collector" for practising 100 words.
// An earned title can be shown under their name on the Profile card.
//
// To add one, append it to ACHIEVEMENTS with a stable `id` (it is stored in the profile, so never
// rename an id) and a rule that reads AchievementProgress. The app has the same list in
// Shared/Achievements.swift; keep the two in step.
import { KNOWN_STREAK, computeStats, estimateLevel, type Level, type Stats, type StudyDay, type WordProgress } from "./progress";

export interface AchievementProgress {
  stats: Stats;
  level: Level;
  /** Words answered correctly 3 times in a row. */
  wordsKnown: number;
  /** Highest number of consecutive correct answers on any one word. */
  bestWordStreak: number;
  myWords: number;
  guidesCompleted: number;
  tasksDone: number;
}

export interface Achievement {
  id: string;
  /** The title the learner earns. */
  title: string;
  /** What to do to earn it. */
  detail: string;
  isEarned: (progress: AchievementProgress) => boolean;
}

/** The achievements, in the order they are listed. Empty until they are chosen. */
export const ACHIEVEMENTS: Achievement[] = [
  // Example:
  // { id: "words-100", title: "Word Collector", detail: "Practice 100 different words",
  //   isEarned: (p) => p.stats.wordsPracticed >= 100 },
];

export function achievementProgress(input: {
  progress: WordProgress[]; days: StudyDay[]; myWords: number; guidesCompleted: number; tasksDone: number; today?: string;
}): AchievementProgress {
  return {
    stats: computeStats(input.progress, input.days, input.today),
    level: estimateLevel(input.progress),
    wordsKnown: input.progress.filter((p) => p.best_streak >= KNOWN_STREAK).length,
    bestWordStreak: Math.max(0, ...input.progress.map((p) => p.best_streak)),
    myWords: input.myWords,
    guidesCompleted: input.guidesCompleted,
    tasksDone: input.tasksDone,
  };
}

export const earnedAchievements = (progress: AchievementProgress, list: Achievement[] = ACHIEVEMENTS) =>
  list.filter((a) => a.isEarned(progress));

/** The title to show: the one the learner chose, if they still have it. */
export const shownTitle = (chosen: string | null | undefined, earned: Achievement[]) =>
  earned.find((a) => a.id === chosen) ?? null;
