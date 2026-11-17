import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { displayMeanings, isCorrectAnswer } from "../core/answerChecker";
import { PARTS_OF_SPEECH, posPlural, type PartOfSpeech, type Word } from "../core/models";
import { buildDeck } from "../core/progress";
import { BUILT_IN } from "../core/wordBank";
import { Icon } from "../components/Icon";
import { Button, Card, KoreanHeadline, Page, PosTag, RoundButton, SpeakButton, WordRow } from "../components/ui";
import { useStore } from "../lib/store";
import { MyWords } from "./MyWords";

type Source = "Built-in" | "My Words" | "Mix";
type View = { kind: "setup" } | { kind: "round"; words: Word[] } | { kind: "myWords" };

export function Flashcards() {
  const [view, setView] = useState<View>({ kind: "setup" });
  if (view.kind === "round") return <Round words={view.words} onClose={() => setView({ kind: "setup" })} />;
  if (view.kind === "myWords") return <MyWords onBack={() => setView({ kind: "setup" })} />;
  return <Setup start={(words) => setView({ kind: "round", words })} openMyWords={() => setView({ kind: "myWords" })} />;
}

function Setup({ start, openMyWords }: { start: (words: Word[]) => void; openMyWords: () => void }) {
  const store = useStore();
  const [source, setSource] = useState<Source>("Built-in");
  const [types, setTypes] = useState<PartOfSpeech[]>([]);
  const mine = store.allWords.slice(BUILT_IN.length);
  const words = source === "Built-in" ? BUILT_IN : source === "My Words" ? mine : store.allWords;
  const pool = types.length ? words.filter((w) => types.includes(w.pos)) : words;
  const deckSize = store.settings.deckSize;

  const toggle = (pos: PartOfSpeech) =>
    setTypes((t) => (t.includes(pos) ? t.filter((p) => p !== pos) : [...t, pos]));

  return (
    <Page title="Flashcards">
      <Card padding={20}>
        <div className="stack">
          <h3>New Round</h3>
          <div className="segmented" role="radiogroup" aria-label="Words From">
            {(["Built-in", "My Words", "Mix"] as Source[]).map((s) => (
              <button key={s} type="button" role="radio" aria-checked={source === s} className={source === s ? "on" : ""}
                onClick={() => setSource(s)}>{s}</button>
            ))}
          </div>
          <div className="small muted">Word Types</div>
          <div className="chips">
            <button type="button" className={`chip ${types.length === 0 ? "on" : ""}`} onClick={() => setTypes([])}>All</button>
            {PARTS_OF_SPEECH.map((pos) => (
              <button key={pos} type="button" className={`chip ${types.includes(pos) ? "on" : ""}`} aria-pressed={types.includes(pos)}
                onClick={() => toggle(pos)}>{posPlural(pos)}</button>
            ))}
          </div>
          <div className="row">
            <span className="grow">Cards per Round: {deckSize}</span>
            <div className="stepper">
              <button type="button" aria-label="Fewer cards" disabled={deckSize <= 5}
                onClick={() => store.updateSettings({ deckSize: deckSize - 5 })}>−</button>
              <button type="button" aria-label="More cards" disabled={deckSize >= 40}
                onClick={() => store.updateSettings({ deckSize: deckSize + 5 })}>+</button>
            </div>
          </div>
          {pool.length === 0 && (
            <p className="small muted">{source === "My Words"
              ? "You haven't added any words yet. Ask Claude to add them; My Words explains how."
              : "No words match these filters."}</p>
          )}
          <Button kind="prominent" icon="play" full large disabled={pool.length === 0}
            onClick={() => start(buildDeck(pool, store.progressMap, deckSize))}>Start</Button>
        </div>
      </Card>
      <button type="button" className="glass card nav-row" onClick={openMyWords}>
        <Icon name="textBook" size={20} className="accent" />
        <span className="grow">My Words</span>
        <span className="muted">{store.myWords.length}</span>
        <Icon name="chevron" size={16} className="muted" />
      </button>
    </Page>
  );
}

type Phase = { kind: "answering" } | { kind: "revealed"; correct: boolean; typed: string | null };

/** One round. Swipe (or drag) right to submit, left if you don't know; then right again to move on. */
export function Round({ words, onClose }: { words: Word[]; onClose: () => void }) {
  const store = useStore();
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>({ kind: "answering" });
  const [answer, setAnswer] = useState("");
  const [results, setResults] = useState<{ word: Word; correct: boolean }[]>([]);
  const [nudge, setNudge] = useState<string | null>(null);
  const [dragX, setDragX] = useState(0);
  const drag = useRef<{ x: number; id: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const word = words[index] as Word | undefined;
  const answering = phase.kind === "answering";
  const last = index === words.length - 1;

  const finish = (correct: boolean, gaveUp = false) => {
    if (!word) return;
    store.record(word.id, { correct, source: "flashcard", gaveUp });
    setResults((r) => [...r, { word, correct }]);
    setNudge(null);
  };

  const advance = () => {
    setIndex((i) => i + 1);
    setPhase({ kind: "answering" });
    setAnswer("");
    setNudge(null);
  };

  const swipeRight = () => {
    if (!word) return;
    if (!answering) { advance(); return; }
    const typed = answer.trim();
    if (!typed) { setNudge("Type the meaning first, or swipe left if you don't know"); return; }
    inputRef.current?.blur();
    const correct = isCorrectAnswer(typed, word.meanings);
    finish(correct);
    setPhase({ kind: "revealed", correct, typed: correct ? null : typed });
  };

  const swipeLeft = () => {
    if (!word) return;
    if (!answering) { advance(); return; }
    inputRef.current?.blur();
    finish(false, true);
    setPhase({ kind: "revealed", correct: false, typed: null });
  };

  // Arrow keys work like swipes, except while typing in the answer field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "ArrowRight") swipeRight();
      if (e.key === "ArrowLeft") swipeLeft();
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const onPointerDown = (e: ReactPointerEvent) => {
    if ((e.target as HTMLElement).closest("input, button")) return;
    drag.current = { x: e.clientX, id: e.pointerId };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent) => { if (drag.current) setDragX(e.clientX - drag.current.x); };
  const onPointerUp = () => {
    if (!drag.current) return;
    if (dragX > 100) swipeRight();
    else if (dragX < -100) swipeLeft();
    drag.current = null;
    setDragX(0);
  };

  const title = word ? `${index + 1} / ${words.length}` : "Round Complete";
  const header = (
    <header className="page-header centered with-close">
      <RoundButton icon="x" tint="glass" label="Close" onClick={onClose} size={38} />
      <h1 className="inline-title">{title}</h1>
      <span style={{ width: 38 }} />
    </header>
  );

  if (!word) {
    const right = results.filter((r) => r.correct).length;
    return (
      <div className="page">
        {header}
        <div className="page-content narrow">
          <Card padding={24}>
            <div className="center stack">
              <div className="big-number">{right} / {results.length}</div>
              <div className="muted">{right === results.length ? "Perfect round!" : "Missed words will come up more often."}</div>
            </div>
          </Card>
          <Card>
            <div className="divided">
              {results.map((r, i) => (
                <div key={i} className="row">
                  <Icon name={r.correct ? "checkCircle" : "x"} size={20} className={r.correct ? "good" : "bad"} />
                  <WordRow word={r.word} progress={store.progressFor(r.word.id)} onClick={() => store.openWord(r.word)} />
                </div>
              ))}
            </div>
          </Card>
          <Button kind="prominent" icon="refresh" full large onClick={onClose}>New Round</Button>
        </div>
      </div>
    );
  }

  const badge = dragX > 8 ? (answering ? ["Submit", "green"] : [last ? "Finish" : "Next", "accent"])
    : dragX < -8 ? (answering ? ["Don't Know", "red"] : [last ? "Finish" : "Next", "accent"]) : null;

  return (
    <div className="page round">
      {header}
      <div className="round-body">
        <div className="segments" aria-label={`Card ${index + 1} of ${words.length}`}>
          {words.map((_, i) => (
            <span key={i} className={`segment ${i < results.length ? (results[i].correct ? "good" : "bad") : i === index ? "current" : ""}`} />
          ))}
        </div>
        <div className="round-center">
          <div className="glass flashcard" style={{ transform: `translateX(${dragX}px) rotate(${dragX / 22}deg)` }}
            onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
            {badge && <span className={`swipe-badge ${badge[1]}`} style={{ opacity: Math.min(Math.abs(dragX) / 100, 1) }}>{badge[0]}</span>}
            <div className="flashcard-top">
              <PosTag pos={word.pos} />
              <KoreanHeadline word={word} mode="both" size={54} />
              <SpeakButton text={word.hangul} size={24} />
            </div>
            <div className="flashcard-bottom">
              {phase.kind === "answering" ? (
                <input ref={inputRef} className="flashcard-input" value={answer} placeholder="Meaning in English"
                  autoCapitalize="off" autoCorrect="off" spellCheck={false} aria-label="Meaning in English" enterKeyHint="done"
                  onChange={(e) => setAnswer(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }} />
              ) : (
                <div className="center stack small-gap">
                  <div className="meaning-line">{displayMeanings(word.meanings).join(", ")}</div>
                  {phase.correct ? <span className="good strong"><Icon name="checkCircle" size={16} /> Correct!</span>
                    : phase.typed ? <span className="bad">You wrote “{phase.typed}”</span>
                    : <span className="muted">Now you know.</span>}
                  {word.examples[0] && (
                    <div className="small muted">
                      <span lang="ko">{word.examples[0].korean}</span><br />{word.examples[0].english}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <p className="small muted center">
            {nudge ?? (answering ? "Swipe right to submit · left if you don't know"
              : last ? "Swipe right to finish the round" : "Swipe right for the next card")}
          </p>
          <div className="round-controls">
            {answering ? (
              <>
                <RoundButton icon="x" tint="red" label="I don't know" onClick={swipeLeft} size={56} />
                <RoundButton icon="check" tint="green" label="Submit answer" onClick={swipeRight} size={56} disabled={!answer.trim()} />
              </>
            ) : (
              <>
                <span />
                <RoundButton icon={last ? "flag" : "arrowRight"} tint="accent" label={last ? "Finish round" : "Next card"}
                  onClick={advance} size={56} />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
