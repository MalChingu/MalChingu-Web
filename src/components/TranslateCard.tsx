import { useState, type FormEvent } from "react";
import { gloss, type Gloss } from "../core/gloss";
import type { Word } from "../core/models";
import { containsHangul, romanize } from "../core/romanizer";
import { useStore } from "../lib/store";
import { canTranslate, translate } from "../lib/translator";
import { useKnownWords } from "./GuideNotes";
import { Icon } from "./Icon";
import { Button, SpeakButton, WordRow, copyText } from "./ui";

/** English → the learner's words whose meaning matches, exact matches first ("go" finds 가다 "to go"). */
export function wordsMeaning(query: string, words: Word[], limit = 5): Word[] {
  const norm = (s: string) => s.toLowerCase().replace(/^to\s+/, "").replace(/\s*\(.*?\)\s*/g, " ").trim();
  const q = norm(query);
  if (!q) return [];
  const exact: Word[] = [];
  const starts: Word[] = [];
  const seen = new Set<string>();
  for (const w of words) {
    if (seen.has(w.hangul)) continue;
    const meanings = w.meanings.map(norm);
    if (meanings.includes(q)) { exact.push(w); seen.add(w.hangul); }
    else if (meanings.some((m) => m.startsWith(q + " "))) { starts.push(w); seen.add(w.hangul); }
  }
  return [...exact, ...starts].slice(0, limit);
}

type Result = { query: string; korean: boolean; known: Gloss | null; matches: Word[]; translation: string | null; state: "pending" | "done" | "failed" | "none" };

/** Korean or English in, what the app knows plus the browser's translation (Chrome and Edge) out. */
export function TranslateCard() {
  const store = useStore();
  const words = useKnownWords();
  const [text, setText] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    const query = text.trim();
    if (!query) return;
    const korean = containsHangul(query);
    const base: Result = {
      query, korean,
      known: korean ? gloss(query, words) : null,
      matches: korean ? [] : wordsMeaning(query, words),
      translation: null,
      state: "pending",
    };
    setResult(base);
    const from = korean ? "ko" : "en";
    if (!(await canTranslate(from, korean ? "en" : "ko"))) {
      setResult((r) => (r?.query === query ? { ...r, state: "none" } : r));
      return;
    }
    const translation = await translate(query, korean ? "ko" : "en", korean ? "en" : "ko");
    setResult((r) => (r?.query === query ? { ...r, translation, state: translation ? "done" : "failed" } : r));
  };

  const koreanOut = result && !result.korean ? result.translation : null;
  return (
    <form className="glass card translate-card" onSubmit={submit}>
      <div className="section-title">Translate</div>
      <textarea className="text-input text-area" rows={2} value={text} aria-label="Korean or English to translate"
        placeholder="Type Korean or English" onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void submit(); } }} />
      <Button type="submit" kind="prominent" compact full disabled={!text.trim()}>Translate</Button>

      {result && (
        <div className="translate-results">
          {result.korean && (
            <div className="stack small-gap">
              <span className="small muted">{romanize(result.query)}</span>
            </div>
          )}
          <div className="stack small-gap">
            <span className="section-title">From Your Words</span>
            {result.known && (
              <div className="translate-known">
                <strong lang="ko">{result.known.form}</strong>
                <span>{result.known.meaning}</span>
              </div>
            )}
            {result.matches.length > 0 && (
              <div className="divided">
                {result.matches.map((w) => <WordRow key={w.id} word={w} progress={store.progressFor(w.id)} onClick={() => store.openWord(w)} />)}
              </div>
            )}
            {!result.known && result.matches.length === 0 && <span className="small muted">Not in your words.</span>}
          </div>
          <div className="stack small-gap">
            <span className="section-title">Translation</span>
            {result.state === "none" && <span className="small muted">Full sentences translate in Chrome or Edge on a computer.</span>}
            {result.state === "pending" && <span className="small muted">Translating…</span>}
            {result.state === "failed" && <span className="small muted">Couldn't translate this.</span>}
            {result.state === "done" && result.translation && (
              <div className="translate-out">
                <span lang={koreanOut ? "ko" : "en"} className="translate-text">{result.translation}</span>
                {koreanOut && <span className="small muted">{romanize(koreanOut)}</span>}
                <div className="row">
                  {koreanOut && <SpeakButton text={koreanOut} size={18} />}
                  <button type="button" className="icon-button" aria-label="Copy Translation" title="Copy"
                    onClick={() => copyText(result.translation ?? "")}>
                    <Icon name="copy" size={18} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </form>
  );
}
