import type { CustomWordRow, Word } from "./models";
import raw from "./words.json";

/** The 287 built-in words, identical to the Swift app's words.json. */
export const BUILT_IN: Word[] = raw as Word[];
const byID = new Map(BUILT_IN.map((w) => [w.id, w]));
export const builtInWord = (id: string) => byID.get(id) ?? null;

export const customToWord = (row: CustomWordRow): Word => ({
  id: row.id.toLowerCase(), hangul: row.hangul, romanization: row.romanization, meanings: row.meanings,
  pos: row.pos, examples: row.examples ?? [], tenses: row.tenses,
});

/** The learner's own words, oldest first. */
export function activeCustomWords(rows: CustomWordRow[]): Word[] {
  return [...rows]
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
    .map(customToWord);
}

const byHangul = new Map(BUILT_IN.map((w) => [w.hangul, w]));

/** Why a spelling can't be added to My Words: it's built in, or already saved. Null when it's new. */
export function duplicateOf(hangul: string, mine: { hangul: string }[]): "builtIn" | "mine" | null {
  const h = hangul.trim();
  if (byHangul.has(h)) return "builtIn";
  return mine.some((w) => w.hangul.trim() === h) ? "mine" : null;
}

/** A guide day's words: each spelling looked up in My Words first (the guide may have added it), then the
 *  built-in words. Spellings found in neither are skipped; each spelling appears once. */
export function guideDayWords(spellings: string[], mine: Word[]): Word[] {
  const own = new Map(mine.map((w) => [w.hangul, w]));
  const seen = new Set<string>();
  const out: Word[] = [];
  for (const raw of spellings) {
    const h = raw.trim();
    if (seen.has(h)) continue;
    seen.add(h);
    const word = own.get(h) ?? byHangul.get(h);
    if (word) out.push(word);
  }
  return out;
}

const folded = (s: string) => s.toLowerCase().normalize("NFC").replace(/[\s\-'’.]/g, "");

/** The My Words search: the Hangul, the romanization (spaces and hyphens ignored) or any meaning contains the query. */
export function matchesSearch(word: { hangul: string; romanization: string; meanings: string[] }, query: string): boolean {
  const q = folded(query);
  if (!q) return true;
  return folded(word.hangul).includes(q) || folded(word.romanization).includes(q) || word.meanings.some((m) => folded(m).includes(q));
}
