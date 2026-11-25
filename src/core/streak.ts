// How hot a streak burns: the streak star takes a flame's colours, coolest to hottest, as the streak grows (red, then
// orange, yellow, white-hot and blue). The same rule as Shared/Streak.swift and Android core/Streak.kt; the three
// share streak.cases.json.

export type StreakHeat = "none" | "red" | "orange" | "yellow" | "white" | "blue";

/** No streak; 1–9 days red; 10–49 orange; 50–99 yellow; 100–199 white-hot; 200 and up blue. */
export function streakHeat(days: number): StreakHeat {
  if (days < 1) return "none";
  if (days < 10) return "red";
  if (days < 50) return "orange";
  if (days < 100) return "yellow";
  if (days < 200) return "white";
  return "blue";
}
