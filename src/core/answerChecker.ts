// Lenient matching of a typed English answer. Port of Shared/AnswerChecker.swift.

/** "To go (somewhere)" -> "go"; "I'm sorry." -> "im sorry" */
export function normalize(text: string): string {
  let s = text.toLowerCase();
  // Drop parenthetical clarifications such as "(honorific)".
  for (;;) {
    const open = s.indexOf("(");
    if (open < 0) break;
    const close = s.indexOf(")", open);
    if (close < 0) break;
    s = s.slice(0, open) + s.slice(close + 1);
  }
  let mapped = "";
  for (const ch of s) {
    if (/[\p{L}\p{N}]/u.test(ch)) mapped += ch;
    else if (ch === "'" || ch === "’") continue;
    else mapped += " ";
  }
  const words = mapped.split(" ").filter((w) => w.length > 0);
  while (words.length > 1 && ["to", "a", "an", "the"].includes(words[0])) words.shift();
  return words.join(" ");
}

/** "hello / hi" counts as two accepted answers. */
function variants(meaning: string): string[] {
  const parts = meaning.split(/[/;]/).map(normalize);
  return [normalize(meaning), ...parts].filter((v) => v.length > 0);
}

/** Levenshtein distance, giving up early once it must exceed `limit`. */
function distance(a: string, b: string, limit: number): number {
  const x = Array.from(a), y = Array.from(b);
  if (Math.abs(x.length - y.length) > limit) return limit + 1;
  if (x.length === 0) return y.length;
  if (y.length === 0) return x.length;
  let previous = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i++) {
    const current = [i, ...new Array(y.length).fill(0)];
    for (let j = 1; j <= y.length; j++) {
      const cost = x[i - 1] === y[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
    }
    previous = current;
  }
  return previous[y.length];
}

export function isCorrectAnswer(answer: string, accepted: string[]): boolean {
  const given = normalize(answer);
  if (!given) return false;
  for (const meaning of accepted.flatMap(variants)) {
    if (given === meaning) return true;
    const length = Array.from(meaning).length;
    const allowed = length >= 9 ? 2 : length >= 5 ? 1 : 0;
    if (allowed > 0 && distance(given, meaning, allowed) <= allowed) return true;
  }
  return false;
}

/** Meanings to show a reader, without the variants that exist only for answer matching. */
export function displayMeanings(meanings: string[]): string[] {
  const seen = new Set<string>();
  return meanings.filter((m) => {
    const key = normalize(m);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
