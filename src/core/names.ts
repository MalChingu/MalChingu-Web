// The word filter for names and usernames, which other people see. The lists and rules are the same in every app
// and in the database (private.name_allowed), checked by names.cases.json.
//
// Text is lowercased and 0 1 3 4 5 7 @ $ ! read as o i e a s t a s i. A word in ANYWHERE_WORDS is refused wherever
// it appears inside a space-separated part once everything but letters (a-z and Hangul) is removed, so f_u_c_k
// counts. A word in WHOLE_WORDS is refused only as a whole word (or with an s on the end), so class, Nazir and
// Kshitij are fine.

export const ANYWHERE_WORDS = [
  "fuck", "cunt", "nigger", "nigga", "faggot", "bitch", "whore", "pussy", "dildo", "jizz", "twat", "hitler",
  "shithead", "bullshit", "asshole",
  "씨발", "시발", "씨팔", "씨빨", "병신", "개새끼", "좆", "존나", "지랄", "썅", "ㅅㅂ", "ㅄ",
];

export const WHOLE_WORDS = [
  "shit", "shitty", "ass", "cock", "cum", "sex", "anal", "tits", "boobs", "rape", "rapist", "kike", "chink", "spic",
  "fag", "slut", "porn", "porno", "nude", "nudes", "penis", "vagina", "retard", "retarded", "wank", "wanker",
  "nazi", "bastard", "nsfw", "xxx",
];

const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "!": "i" };

/** Anything but a-z and Hangul (syllables and jamo). */
const NOT_LETTER = /[^a-z가-힣ㄱ-ㅣ]+/gu;

/** False when a name or username has a word other people shouldn't see. */
export function nameAllowed(text: string): boolean {
  const t = Array.from(text.toLowerCase(), (c) => LEET[c] ?? c).join("");
  for (const part of t.split(/\s+/)) {
    const squashed = part.replace(NOT_LETTER, "");
    if (ANYWHERE_WORDS.some((w) => squashed.includes(w))) return false;
  }
  return !t.split(NOT_LETTER).some((token) => WHOLE_WORDS.some((w) => token === w || token === `${w}s`));
}

export const NAME_REFUSED = "Choose a different name.";
export const USERNAME_REFUSED = "Choose a different username.";
