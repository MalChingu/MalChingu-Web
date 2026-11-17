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

/** The learner's own words that aren't deleted, oldest first (the order the app uses for the word of the day). */
export function activeCustomWords(rows: CustomWordRow[]): Word[] {
  return rows
    .filter((r) => !r.deleted_at)
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
    .map(customToWord);
}
