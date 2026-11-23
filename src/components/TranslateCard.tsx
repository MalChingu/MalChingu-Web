import { useEffect, useRef, useState, type FormEvent } from "react";
import { gloss, type Gloss } from "../core/gloss";
import type { Word } from "../core/models";
import { containsHangul, romanize } from "../core/romanizer";
import { useStore } from "../lib/store";
import { canTranslate, translate } from "../lib/translator";
import { useKnownWords } from "./GuideNotes";
import { Icon } from "./Icon";
import { KoreanText, MicButton, heardNothing } from "./KoreanText";
import { TRANSLATE_EVENT } from "./NoteMenu";
import { Button, SpeakButton, WordRow } from "./ui";

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

type Language = "ko" | "en";
type Result = {
  query: string; from: Language; known: Gloss | null; matches: Word[];
  translation: string | null; state: "pending" | "done" | "failed" | "none";
};

const NAME: Record<Language, string> = { ko: "Korean", en: "English" };

/** Korean → English or English → Korean: what the app knows, plus the browser's own translation (Chrome and
 *  Edge). 🎤 to say it, 🔊 to hear the Korean, Save to keep it (tagged with this guide and day). */
export function TranslateCard({ guideID, dayNumber, openSaved, initial, inPanel }: {
  guideID: string | null; dayNumber: number | null; openSaved: () => void;
  /** Text to translate as soon as it opens (a right-click → Translate that opened the panel). */
  initial?: string;
  /** Inside the Translate panel (zoomed in on a laptop), which has its own title and background. */
  inPanel?: boolean;
}) {
  const store = useStore();
  const words = useKnownWords();
  const [text, setText] = useState("");
  const [from, setFrom] = useState<Language>("ko");
  const [result, setResult] = useState<Result | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const card = useRef<HTMLFormElement>(null);
  const to: Language = from === "ko" ? "en" : "ko";

  const run = async (raw: string, source: Language) => {
    const query = raw.trim();
    if (!query) return;
    const korean = source === "ko";
    setNotice(null);
    setSaved(null);
    setResult({
      query, from: source, known: korean ? gloss(query, words) : null, matches: korean ? [] : wordsMeaning(query, words),
      translation: null, state: "pending",
    });
    const target: Language = korean ? "en" : "ko";
    // What your words say is the answer when they know it; the translator is only asked otherwise.
    if (korean ? gloss(query, words) : wordsMeaning(query, words).length) return;
    if (!(await canTranslate(source, target))) {
      setResult((r) => (r?.query === query ? { ...r, state: "none" } : r));
      return;
    }
    const translation = await translate(query, source, target);
    setResult((r) => (r?.query === query ? { ...r, translation, state: translation ? "done" : "failed" } : r));
  };

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    void run(text, from);
  };

  // Typing follows the language typed: Hangul means Korean → English. The swap button still decides.
  const type = (value: string) => {
    setText(value);
    if (containsHangul(value)) setFrom("ko");
    else if (/[A-Za-z]/.test(value)) setFrom("en");
  };

  // Opened by a right-click "Translate": translate that text straight away.
  useEffect(() => {
    if (!initial) return;
    const source: Language = containsHangul(initial) ? "ko" : "en";
    setText(initial);
    setFrom(source);
    void run(initial, source);
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  // Text sent here by a right-click "Translate" on a guide.
  useEffect(() => {
    const receive = (e: Event) => {
      const t = (e as CustomEvent<string>).detail;
      const source: Language = containsHangul(t) ? "ko" : "en";
      setText(t);
      setFrom(source);
      void run(t, source);
      card.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    };
    window.addEventListener(TRANSLATE_EVENT, receive);
    return () => window.removeEventListener(TRANSLATE_EVENT, receive);
  });

  // What Save keeps: the translation, else what the app knows (for English, the best matching word).
  const keep = result && (result.translation ?? result.known?.meaning ?? result.matches[0]?.hangul ?? null);
  const save = () => {
    if (!result || !keep) return;
    void store.saveTranslation({ source: result.query, source_lang: result.from, translation: keep, guide_id: guideID, day_number: dayNumber });
    setSaved(result.query);
  };

  const koreanOut = result && result.from === "en" ? result.translation : null;
  return (
    <form className={inPanel ? "stack translate-card in-panel" : "glass card translate-card"} onSubmit={submit} ref={card}>
      <div className="row">
        <div className="section-title grow">{inPanel ? "" : "Translate"}</div>
        <button type="button" className="link small" onClick={openSaved}>Saved Translations</button>
      </div>
      <div className="translate-direction">
        <span>{NAME[from]}</span>
        <button type="button" className="icon-button" aria-label={`Swap: translate ${NAME[to]} to ${NAME[from]}`}
          title="Swap languages" onClick={() => setFrom(to)}>
          <Icon name="swap" size={18} />
        </button>
        <span>{NAME[to]}</span>
      </div>
      <div className="translate-input">
        <textarea className="text-input text-area" rows={2} value={text} lang={from}
          aria-label={`${NAME[from]} to translate`} placeholder={`Type or say ${NAME[from]}`} onChange={(e) => type(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }} />
        <div className="translate-tools">
          <MicButton lang={from === "ko" ? "ko-KR" : "en-US"} label={`Say ${NAME[from]}`} size={18} onHeard={(heard) => {
            const said = heard.said[0];
            if (said) { setText(said); void run(said, from); } else setNotice(heardNothing(heard));
          }} />
        </div>
      </div>
      {notice && <span className="small muted">{notice}</span>}
      <Button type="submit" kind="prominent" compact full disabled={!text.trim()}>Translate</Button>

      {result && (
        <div className="translate-results">
          {/* What was typed, read aloud: its romanization with Listen at the far right. */}
          {result.from === "ko" && (
            <div className="translate-line">
              <span className="small muted grow">{romanize(result.query)}</span>
              <SpeakButton text={result.query} size={18} />
            </div>
          )}
          {/* From Your Words when your words know it; otherwise the translator's Translation. */}
          {(result.known || result.matches.length > 0) ? (
          <div className="stack small-gap">
            <span className="section-title">From Your Words</span>
            {result.known && (
              <div className="translate-line">
                <span className="translate-known grow">
                  {/* The form only when it isn't just what was typed (e.g. a word picked out of a sentence). */}
                  {result.known.form !== result.query && <strong lang="ko">{result.known.form}</strong>}
                  <MeaningLines meaning={result.known.meaning} />
                </span>
                {result.known.form !== result.query && <SpeakButton text={result.known.form.replace(/^-/, "")} size={18} />}
              </div>
            )}
            {result.matches.length > 0 && (
              <div className="divided">
                {result.matches.map((w) => (
                  <div key={w.id} className="translate-match">
                    <WordRow word={w} progress={store.progressFor(w.id)} onClick={() => store.openWord(w)} />
                    <SpeakButton text={w.hangul} size={18} />
                  </div>
                ))}
              </div>
            )}
          </div>
          ) : (
          <div className="stack small-gap">
            <span className="section-title">Translation</span>
            {result.state === "none" && <span className="small muted">Full sentences translate in Chrome or Edge on a computer.</span>}
            {result.state === "pending" && <span className="small muted">Translating…</span>}
            {result.state === "failed" && <span className="small muted">Couldn't translate this.</span>}
            {result.state === "done" && result.translation && (
              // The translation, with Listen on the right (as for the text above) when it's Korean.
              <div className="translate-line">
                <span className="translate-out grow">
                  <span lang={koreanOut ? "ko" : "en"} className="translate-text">
                    {koreanOut ? <KoreanText text={result.translation} /> : result.translation}
                  </span>
                  {koreanOut && <span className="small muted">{romanize(koreanOut)}</span>}
                </span>
                {koreanOut && <SpeakButton text={koreanOut} size={18} />}
              </div>
            )}
          </div>
          )}
          {keep && (
            <Button compact icon="bookmark" disabled={saved === result.query} onClick={save}>
              {saved === result.query ? "Saved to My Notes" : "Save"}
            </Button>
          )}
        </div>
      )}
    </form>
  );
}

/** A form's explanation over two lines: what it is ("Past of 바쁘다"), then the English in bold ("to be busy"). */
function MeaningLines({ meaning }: { meaning: string }) {
  const cut = meaning.lastIndexOf(" · ");
  if (cut < 0) return <span className="translate-text">{meaning}</span>;
  return (
    <>
      <span>{meaning.slice(0, cut)}</span>
      <span className="translate-text">{meaning.slice(cut + 3)}</span>
    </>
  );
}
