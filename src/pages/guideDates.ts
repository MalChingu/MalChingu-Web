import type { StudyGuideRow } from "../core/models";
import { addDays, dayString } from "../core/wordOfDay";

/** 1-based day of the guide that `today` falls on; null before it starts or after it ends. */
export function guideDayNumber(guide: StudyGuideRow, today: string = dayString()): number | null {
  const start = new Date(guide.start_date + "T00:00:00");
  const now = new Date(today + "T00:00:00");
  const day = Math.round((now.getTime() - start.getTime()) / 86_400_000) + 1;
  return day >= 1 && day <= Math.max(guide.total_days, 1) ? day : null;
}

export const guideDate = (guide: StudyGuideRow, day: number) => addDays(guide.start_date, day - 1);

export function formatDay(day: string, options: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }) {
  return new Date(day + "T00:00:00").toLocaleDateString(undefined, options);
}
