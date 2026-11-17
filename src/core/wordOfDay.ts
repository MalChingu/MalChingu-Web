import type { PartOfSpeech, Word } from "./models";

// The word of the day depends only on the calendar date and the pool, so the web,
// the iPhone app and its widgets all agree. Port of Shared/WordOfDayPicker.swift.

const MASK = (1n << 64n) - 1n;

/** SplitMix64: spreads consecutive day numbers across the whole pool. */
function mix(value: bigint): bigint {
  let z = (value + 0x9e3779b97f4a7c15n) & MASK;
  z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK;
  z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & MASK;
  return z ^ (z >> 31n);
}

/** Local calendar date as "yyyy-MM-dd". */
export function dayString(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "2026-11-11" -> 20261111 */
export function dayNumber(day: string): number {
  return Number(day.replaceAll("-", ""));
}

/** @param day "yyyy-MM-dd"; @param types empty means all. */
export function wordOfDay(day: string, pool: Word[], types: PartOfSpeech[] = []): Word | null {
  const candidates = types.length ? pool.filter((w) => types.includes(w.pos)) : pool;
  if (!candidates.length) return null;
  const index = Number(mix(BigInt(dayNumber(day))) % BigInt(candidates.length));
  return candidates[index];
}

/** Adds days to a "yyyy-MM-dd" string in the local calendar. */
export function addDays(day: string, days: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return dayString(new Date(y, m - 1, d + days));
}
