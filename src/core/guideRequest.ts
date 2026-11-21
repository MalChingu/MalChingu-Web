import { addDays, dayString } from "./wordOfDay";

// The sentence handed to Claude to ask for a study guide. Port of Shared/GuideRequest.swift.

export function guideLength(days: number): string {
  if (days === 1) return "a day";
  if (days === 7) return "a week";
  if (days === 30) return "a month";
  if (days % 7 === 0 && days <= 56) return `${days / 7} weeks`;
  if (days === 60) return "2 months";
  return `${days} days`;
}

/** @param start, today: "yyyy-MM-dd" */
export function guideRequest(days: number, minutesPerDay: number, start: string, focus = "", today: string = dayString()): string {
  const when = start === today ? "today" : start === addDays(today, 1) ? "tomorrow" : `on ${start}`;
  let text = `Create a guide in Korimal for ${guideLength(days)}, learning ${minutesPerDay} minutes a day, starting ${when}.`;
  if (focus) text += ` Focus on ${focus}.`;
  return text;
}
