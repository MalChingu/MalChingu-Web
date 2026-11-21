// Friends: usernames, friend requests and the two challenges (a Flashcard Duel and a 7-Day Challenge).
// The rules here are shared with the iPhone/Mac app (Shared/Friends.swift) and the Android app (core/Friends.kt);
// friends.cases.json checks that all three agree.

import type { Word } from "./models";
import type { Level } from "./progress";
import { romanize } from "./romanizer";

/** A row of `my_friends()`: a friend, or a request either way. An outgoing request by email has only `email`. */
export interface FriendRow {
  id: string;
  user_id: string | null;
  direction: "incoming" | "outgoing";
  status: "pending" | "accepted";
  username: string | null;
  name: string | null;
  avatar: string | null;
  level: Level | null;
  email: string | null;
  created_at: string;
}

/** A row of `my_challenges()`. Duel: `their_score` only once both have played. Week: both sides' answers in its 7 days. */
export interface ChallengeRow {
  id: string;
  kind: "duel" | "week";
  status: "pending" | "active";
  /** Whether you sent it. */
  sent: boolean;
  friend_id: string;
  friend_username: string | null;
  friend_name: string | null;
  friend_avatar: string | null;
  words: string[] | null;
  start_day: string | null;
  end_day: string | null;
  my_score: number | null;
  their_score: number | null;
  my_done: boolean;
  their_done: boolean;
  my_correct: number;
  my_total: number;
  their_correct: number;
  their_total: number;
  created_at: string;
}

/** A row of `search_users()`: what anyone signed in can see. */
export interface UserSearchRow { user_id: string; username: string; avatar: string | null; level: Level }

/** 3–20 lowercase letters, digits, dots or underscores, starting with a letter or digit (the database's rule). */
export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9_.]{2,19}$/;
export const isValidUsername = (name: string) => USERNAME_PATTERN.test(name);
/** What a typed username is stored as: trimmed, without a leading @, lowercase. */
export const normalizeUsername = (typed: string) => typed.trim().replace(/^@+/, "").toLowerCase();
/** Whether the add box holds an email address rather than a username. */
export const looksLikeEmail = (typed: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(typed.trim());

/** A username to suggest from a name: its letters and digits (Hangul romanized, accents dropped), lowercase, at most
 *  16 characters. "learner" when that leaves fewer than 3. */
export function usernameBase(name: string): string {
  const latin = /[가-힣]/.test(name) ? romanize(name) : name;
  const base = latin.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 16);
  return base.length >= 3 ? base : "learner";
}

/** Suggestions to try in turn: the base, then the base with two digits (10–99). "learner" always gets digits. */
export function usernameCandidates(name: string, count = 6, random: () => number = Math.random): string[] {
  const base = usernameBase(name);
  const out = new Set(base === "learner" ? [] : [base]);
  for (let i = 0; out.size < count && i < count * 4; i++) out.add(`${base}${10 + Math.floor(random() * 90)}`);
  return [...out];
}

/** The 10 words of a new duel: built-in words only (both players have them), picked at random. */
export function pickDuelWords(pool: Word[], count = 10, random: () => number = Math.random): Word[] {
  const words = pool.filter((w) => w.id.startsWith("b-"));
  for (let i = words.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [words[i], words[j]] = [words[j], words[i]];
  }
  return words.slice(0, count);
}

export type Winner = "me" | "them" | "tie";

/** Days from `from` to `to` (both "yyyy-mm-dd"). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** Where a 7-Day Challenge is on `today`: running with days left (today counts), or finished. */
export function weekStatus(endDay: string, today: string): { kind: "running"; daysLeft: number } | { kind: "finished" } {
  const left = daysBetween(today, endDay) + 1;
  return left > 0 ? { kind: "running", daysLeft: Math.min(left, 7) } : { kind: "finished" };
}

/** Correct out of answered, as a whole percent; null with no answers. */
export const percent = (correct: number, total: number): number | null =>
  total > 0 ? Math.round((correct / total) * 100) : null;

/** The 7-Day Challenge winner: the higher share of answers correct (exactly, not rounded). No answers counts as 0%. */
export function weekWinner(myCorrect: number, myTotal: number, theirCorrect: number, theirTotal: number): Winner {
  // Cross-multiplied, so 1/3 and 2/6 tie exactly.
  const a = myTotal > 0 ? myCorrect * Math.max(theirTotal, 1) : 0;
  const b = theirTotal > 0 ? theirCorrect * Math.max(myTotal, 1) : 0;
  return a === b ? "tie" : a > b ? "me" : "them";
}

export function duelWinner(mine: number, theirs: number): Winner {
  return mine === theirs ? "tie" : mine > theirs ? "me" : "them";
}

/** Whether a challenge is waiting on you: a duel you haven't played, or a 7-Day Challenge sent to you. */
export function challengeNeedsMe(c: Pick<ChallengeRow, "kind" | "status" | "sent" | "my_done">): boolean {
  return c.kind === "duel" ? !c.my_done : c.status === "pending" && !c.sent;
}

/** The name to show for a friend: their name, else @username, else the email a request went to. */
export function friendLabel(f: Pick<FriendRow, "name" | "username" | "email">): string {
  return f.name?.trim() || (f.username ? `@${f.username}` : f.email ?? "Friend");
}

/** The first word of a friend's label, for the small caption under their picture. */
export function shortLabel(f: Pick<FriendRow, "name" | "username" | "email">): string {
  const name = f.name?.trim();
  return name ? name.split(/\s+/)[0] : f.username ? `@${f.username}` : f.email?.split("@")[0] ?? "Friend";
}

/** Friends first in the row: requests to you, then friends, then requests you sent; oldest first within each. */
export function orderFriends<T extends Pick<FriendRow, "direction" | "status" | "created_at">>(rows: T[]): T[] {
  const rank = (f: T) => f.status === "accepted" ? 1 : f.direction === "incoming" ? 0 : 2;
  return [...rows].sort((a, b) => rank(a) - rank(b) || a.created_at.localeCompare(b.created_at));
}
