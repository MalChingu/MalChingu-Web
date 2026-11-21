import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { displayMeanings, isCorrectAnswer } from "../core/answerChecker";
import { PARTS_OF_SPEECH, posPlural, type PartOfSpeech, type Word } from "../core/models";
import { buildDeck } from "../core/progress";
import { BUILT_IN } from "../core/wordBank";
import { Icon } from "../components/Icon";
import { Button, Card, ConfirmDialog, KoreanHeadline, Page, PosTag, RoundButton, Segmented, Sheet, SpeakButton, Stepper, Toggle, WordRow } from "../components/ui";
import { formAnswerRight, formsFor, shownForForm, type CardForm } from "../core/englishForms";
import { flashcardHint, type FlashcardHint } from "../core/flashcardHint";
import type { FlashcardSource } from "../lib/settings";
import { speak } from "../lib/speech";
import { useStore, type Duel } from "../lib/store";
import { duelWinner } from "../core/friends";
import { pageZoom } from "../lib/zoom";
import { MyWords } from "./MyWords";
import { formInSentence, pastFormRight } from "../core/koreanWords";
import { romanize } from "../core/romanizer";
import { KoreanText, MicButton, heardNothing } from "../components/KoreanText";
import type { Example } from "../core/models";

/** Meaning: what the dictionary form means, in English. Past form: the polite past (맛있다 → 맛있었어요). */
export type PracticeMode = "meaning" | "past";
export type Practice = (words: Word[], mode: PracticeMode) => void;

type Deck = { words: Word[]; forms: CardForm[]; seconds: number };
type View = { kind: "setup" } | ({ kind: "round" } & Deck) | { kind: "myWords" };

export function Flashcards() {
  const [view, setView] = useState<View>({ kind: "setup" });
  if (view.kind === "round") {
    return <Round words={view.words} forms={view.forms} seconds={view.seconds} onClose={() => setView({ kind: "setup" })} />;
  }
  if (view.kind === "myWords") return <MyWords onBack={() => setView({ kind: "setup" })} />;
  return <Setup start={(deck) => setView({ kind: "round", ...deck })} openMyWords={() => setView({ kind: "myWords" })} />;
}

const SOURCES: { value: FlashcardSource; label: string }[] = [
  { value: "builtIn", label: "Built-in" }, { value: "mine", label: "My Words" }, { value: "mix", label: "Mix" },
];
const FORM_LABEL: Record<CardForm, string> = { dictionary: "Dictionary", past: "Past", present: "Present" };

/** The round setup. Every choice is saved with the account, so the next round (and the Mac app) starts the same way. */
function Setup({ start, openMyWords }: { start: (deck: Deck) => void; openMyWords: () => void }) {
  const store = useStore();
  const { flashcardSource: source, flashcardTypes: types, flashcardForms: forms, flashcardSeconds: seconds, deckSize } = store.settings;
  const mine = store.allWords.slice(BUILT_IN.length);
  const words = source === "builtIn" ? BUILT_IN : source === "mine" ? mine : store.allWords;
  // Past and Present only use verbs and adjectives with their tenses.
  const pool = (types.length ? words.filter((w) => types.includes(w.pos)) : words).filter((w) => formsFor(w, forms).length > 0);

  const toggle = (pos: PartOfSpeech) =>
    store.updateSettings({ flashcardTypes: types.includes(pos) ? types.filter((p) => p !== pos) : [...types, pos] });
  // At least one form stays on.
  const toggleForm = (form: CardForm) => {
    const next = forms.includes(form) ? forms.filter((f) => f !== form) : [...forms, form];
    if (next.length) store.updateSettings({ flashcardForms: (["dictionary", "past", "present"] as CardForm[]).filter((f) => next.includes(f)) });
  };
  const begin = () => {
    const deck = buildDeck(pool, store.progressMap, deckSize);
    const cardForms = deck.map((w) => {
      const options = formsFor(w, forms);
      return options[Math.floor(Math.random() * options.length)];
    });
    start({ words: deck, forms: cardForms, seconds });
  };

  return (
    <Page title="Flashcards">
      <Card padding={20}>
        <div className="stack">
          <h3>New Round</h3>
          <Segmented label="Words From" value={source} onChange={(v) => store.updateSettings({ flashcardSource: v })} options={SOURCES} />
          <div className="small muted">Word Types</div>
          <div className="chips">
            <button type="button" className={`chip ${types.length === 0 ? "on" : ""}`} onClick={() => store.updateSettings({ flashcardTypes: [] })}>All</button>
            {PARTS_OF_SPEECH.map((pos) => (
              <button key={pos} type="button" className={`chip ${types.includes(pos) ? "on" : ""}`} aria-pressed={types.includes(pos)}
                onClick={() => toggle(pos)}>{posPlural(pos)}</button>
            ))}
          </div>
          <div className="small muted">Forms</div>
          <div className="chips" role="group" aria-label="Forms">
            {(["dictionary", "past", "present"] as CardForm[]).map((f) => (
              <button key={f} type="button" className={`chip ${forms.includes(f) ? "on" : ""}`} aria-pressed={forms.includes(f)}
                onClick={() => toggleForm(f)}>{FORM_LABEL[f]}</button>
            ))}
          </div>
          <p className="small muted">
            {forms.length === 1 && forms[0] === "dictionary"
              ? "Cards show the dictionary form (가다). Type what it means."
              : "Cards show the word in a chosen form (가다, 갔어요 or 가요). Type what that form means: to go, went, goes. Past and Present use verbs and adjectives."}
          </p>
          <div className="small muted">Timer</div>
          <Segmented label="Timer" value={String(seconds)} onChange={(v) => store.updateSettings({ flashcardSeconds: Number(v) })}
            options={[{ value: "0", label: "Off" }, { value: "10", label: "10 s" }, { value: "20", label: "20 s" }, { value: "30", label: "30 s" }]} />
          <Toggle label="Hints: One per Card" checked={store.settings.flashcardHints}
            onChange={(on) => store.updateSettings({ flashcardHints: on })} />
          <div className="row">
            <span className="grow">Cards per Round: {deckSize}</span>
            <Stepper minusLabel="Fewer cards" plusLabel="More cards" minusDisabled={deckSize <= 5} plusDisabled={deckSize >= 40}
              onMinus={() => store.updateSettings({ deckSize: deckSize - 5 })} onPlus={() => store.updateSettings({ deckSize: deckSize + 5 })} />
          </div>
          {pool.length === 0 && (
            <p className="small muted">{source === "mine"
              ? "You haven't added any words yet. Ask Claude to add them; My Words explains how."
              : "No words match these filters."}</p>
          )}
          <Button kind="prominent" icon="play" full large disabled={pool.length === 0} onClick={begin}>Start</Button>
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

type Phase = { kind: "answering" } | { kind: "revealed"; correct: boolean; given: string | null; spoken: boolean; timedOut?: boolean };

/** The example sentence with the word's form in the accent colour (음식이 **맛있었어요**), a dot between words
 *  and Listen. For Past Form it prefers an example that uses the past form. */
function ExampleLine({ word, prefer }: { word: Word; prefer?: string }) {
  const example: Example | undefined = (prefer ? word.examples.find((e) => e.korean.includes(prefer)) : undefined) ?? word.examples[0];
  if (!example) return null;
  const range = formInSentence(example.korean, word);
  const k = example.korean;
  return (
    <div className="example-line">
      <div className="row center-row">
        <span lang="ko" className="example-korean">
          {range ? <><KoreanText text={k.slice(0, range[0])} /><strong className="accent"><KoreanText text={k.slice(range[0], range[1])} /></strong>
            <KoreanText text={k.slice(range[1])} /></> : <KoreanText text={k} />}
        </span>
        <SpeakButton text={k} size={18} />
      </div>
      <span className="small muted">{example.english}</span>
    </div>
  );
}

/** One round. Swipe (or drag) right to submit, left if you don't know; then right again to move on. Enter submits,
 *  then moves on. `doneLabel` is the last button: New Round, or Back to Guide when it came from a guide. */
export function Round({ words, onClose, mode = "meaning", doneLabel = "New Round", forms, seconds = 0, duel }: {
  words: Word[]; onClose: () => void; mode?: PracticeMode; doneLabel?: string;
  /** The form each card shows (from the Flashcards setup); the dictionary form when not given. */
  forms?: CardForm[];
  /** Seconds per card; 0 is no timer. */
  seconds?: number;
  /** A Flashcard Duel: no hints, and the score is sent once, at the end or on leaving. */
  duel?: Duel;
}) {
  const store = useStore();
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>({ kind: "answering" });
  const [answer, setAnswer] = useState("");
  const [results, setResults] = useState<{ word: Word; correct: boolean }[]>([]);
  const [nudge, setNudge] = useState<string | null>(null);
  const [dragX, setDragX] = useState(0);
  const drag = useRef<{ x: number; id: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  /** Whether this card's one hint is showing. */
  const [hintShown, setHintShown] = useState(false);
  /** What the microphone heard for this card, put in the answer box to check before submitting. */
  const [heard, setHeard] = useState<string | null>(null);
  /** Milliseconds left on this card's timer. */
  const [remaining, setRemaining] = useState(seconds * 1000);
  /** A duel's score is sent once; leaving early asks first. */
  const duelSent = useRef(false);
  const [duelError, setDuelError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  const word = words[index] as Word | undefined;
  const answering = phase.kind === "answering";
  const last = index === words.length - 1;
  // The form this card shows: 갔어요 for a Past card. (The guide's Past Form drill asks for it instead.)
  const form: CardForm = mode === "past" ? "dictionary" : forms?.[index] ?? "dictionary";
  const shown = (form === "past" ? word?.tenses?.past : form === "present" ? word?.tenses?.present : undefined) ?? word?.hangul ?? "";
  // One hint per card, when hints are on (Flashcards → Hints).
  const hint = word && !duel && store.settings.flashcardHints ? flashcardHint(word, shown, mode === "past") : null;
  const right = results.filter((r) => r.correct).length;

  const sendDuel = async () => {
    if (!duel || duelSent.current) return;
    duelSent.current = true;
    setDuelError(await store.submitDuel(duel.id, right));
  };
  // The duel's score goes in as soon as the last card is answered.
  useEffect(() => { if (duel && !word) sendDuel(); });   // eslint-disable-line react-hooks/exhaustive-deps
  /** Close, except mid-duel: that asks first, since a duel is played once. */
  const close = () => { if (duel && word) setLeaving(true); else onClose(); };

  const finish = (correct: boolean, gaveUp = false) => {
    if (!word) return;
    store.record(word.id, { correct, source: "flashcard", gaveUp, hints: hintShown ? 1 : 0 });
    setResults((r) => [...r, { word, correct }]);
    setNudge(null);
  };

  const advance = () => {
    setIndex((i) => i + 1);
    setPhase({ kind: "answering" });
    setAnswer("");
    setNudge(null);
    setRemaining(seconds * 1000);   // with the new card, so it doesn't start out of time
    setHeard(null);
    setHintShown(false);
  };

  const check = (given: string) => mode === "past"
    ? pastFormRight(given, word?.tenses?.past ?? "")
    : word && form !== "dictionary" ? formAnswerRight(given, word, form)
    : isCorrectAnswer(given, word?.meanings ?? []);

  const submitAnswer = (given: string, spoken = false) => {
    if (!word) return;
    inputRef.current?.blur();
    const correct = check(given);
    finish(correct);
    setPhase({ kind: "revealed", correct, given, spoken });
  };

  const swipeRight = () => {
    if (!word) return;
    if (!answering) { advance(); return; }
    const typed = answer.trim();
    if (!typed) {
      setNudge(mode === "past" ? "Type or say the past form first, or swipe left if you don't know"
        : "Type the meaning first, or swipe left if you don't know");
      return;
    }
    submitAnswer(typed, typed === heard);   // "You said" when it's still what was heard
  };

  const swipeLeft = () => {
    if (!word) return;
    if (!answering) { advance(); return; }
    inputRef.current?.blur();
    finish(false, true);
    setPhase({ kind: "revealed", correct: false, given: null, spoken: false });
  };

  /** Time's up: what was typed is submitted; with nothing typed, the card counts as wrong. */
  const timeUp = () => {
    if (!word || !answering) return;
    const typed = answer.trim();
    if (typed) { submitAnswer(typed); return; }
    inputRef.current?.blur();
    finish(false);
    setPhase({ kind: "revealed", correct: false, given: null, spoken: false, timedOut: true });
  };

  // The timer: restarts on each card, stops once the answer shows, and waits while Keyboard Shortcuts is open.
  useEffect(() => {
    if (!seconds || !answering || helpOpen || !word) return;
    let before = performance.now();
    const tick = window.setInterval(() => {
      const now = performance.now();
      const step = now - before;
      before = now;
      setRemaining((left) => Math.max(0, left - step));
    }, 100);
    return () => window.clearInterval(tick);
  }, [seconds, answering, helpOpen, index, word]);
  useEffect(() => { if (seconds && answering && remaining <= 0) timeUp(); });

  // The answer box is ready to type in on every card (and after closing Keyboard Shortcuts).
  useEffect(() => {
    if (answering && !helpOpen) inputRef.current?.focus({ preventScroll: true });
  }, [index, answering, helpOpen]);

  // Ctrl+L listens and Ctrl+D is "I don't know", even while typing. Arrow keys work like swipes, except while
  // typing in the answer field; Enter moves on after an answer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (helpOpen || leaving || !word) return;
      if (e.ctrlKey && !e.metaKey && !e.altKey) {
        const key = e.key.toLowerCase();
        if (key === "l") { e.preventDefault(); speak(phase.kind === "revealed" && mode === "past" ? word.tenses?.past ?? shown : shown); return; }
        if (key === "d") { e.preventDefault(); if (answering) swipeLeft(); return; }
      }
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "ArrowRight") swipeRight();
      if (e.key === "ArrowLeft") swipeLeft();
      if (e.key === "Escape") close();
      // (A focused button handles its own Enter.)
      if (e.key === "Enter" && !answering && !(e.target instanceof HTMLButtonElement)) { e.preventDefault(); advance(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const onPointerDown = (e: ReactPointerEvent) => {
    if ((e.target as HTMLElement).closest("input, button")) return;
    drag.current = { x: e.clientX, id: e.pointerId };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  // Screen distance over the zoom (Text Size), so the card follows the pointer exactly.
  const onPointerMove = (e: ReactPointerEvent) => { if (drag.current) setDragX((e.clientX - drag.current.x) / pageZoom()); };
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
      <RoundButton icon="x" tint="glass" label={duel ? "Leave Duel" : "Close"} onClick={close} size={38} />
      <h1 className="inline-title">{title}</h1>
      {word && !duel
        ? <span className="round-help"><RoundButton icon="question" tint="glass" label="Keyboard Shortcuts" onClick={() => setHelpOpen(true)} size={38} /></span>
        : <span style={{ width: 38 }} />}
    </header>
  );

  if (!word) {
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
          {duel && <DuelResult duel={duel} error={duelError} />}
          <Card>
            <div className="divided">
              {results.map((r, i) => (
                <div key={i} className="row">
                  <Icon name={r.correct ? "checkCircle" : "x"} size={20} className={r.correct ? "good" : "bad"} />
                  <WordRow word={r.word} progress={store.progressFor(r.word.id)} onClick={() => store.openWord(r.word)} />
                  <SpeakButton text={r.word.hangul} size={18} />
                </div>
              ))}
            </div>
          </Card>
          <Button kind="prominent" icon={doneLabel === "New Round" ? "refresh" : "chevronLeft"} full large onClick={onClose}>{doneLabel}</Button>
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
        {seconds > 0 && (
          <div className={`timer-bar ${answering && remaining <= 3000 ? "low" : ""}`} role="timer"
            aria-label={answering ? `${Math.ceil(remaining / 1000)} seconds left` : "Timer stopped"}>
            <span style={{ width: `${answering ? (remaining / (seconds * 1000)) * 100 : 0}%` }} />
          </div>
        )}
        <div className="round-center">
          <div className="glass flashcard" style={{ transform: `translateX(${dragX}px) rotate(${dragX / 22}deg)` }}
            onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
            {badge && <span className={`swipe-badge ${badge[1]}`} style={{ opacity: Math.min(Math.abs(dragX) / 100, 1) }}>{badge[0]}</span>}
            <div className="flashcard-top">
              <div className="row center-row">
                <PosTag pos={word.pos} />
                {form !== "dictionary" && <span className="pos-tag form-tag">{form.toUpperCase()}</span>}
              </div>
              <KoreanHeadline word={form === "dictionary" ? word : { ...word, hangul: shown, romanization: romanize(shown) }} mode="both" size={54} />
              <SpeakButton text={shown} size={24} />
            </div>
            <div className="flashcard-bottom">
              {phase.kind === "answering" ? (
                <div className="answer-stack">
                  <span className="small muted">{mode === "past" ? "Past form (polite)" : `Meaning of the ${form === "dictionary" ? "dictionary" : form} form`}</span>
                  <div className="answer-row">
                    <input ref={inputRef} className="flashcard-input" value={answer} lang={mode === "past" ? "ko" : "en"} autoFocus
                      placeholder={mode === "past" ? "Type it in Korean" : "Meaning in English"}
                      autoCapitalize="off" autoCorrect="off" spellCheck={false} enterKeyHint="done"
                      aria-label={mode === "past" ? "Past form in Korean" : `Meaning of the ${form === "dictionary" ? "dictionary" : form} form, in English`}
                      onChange={(e) => setAnswer(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); swipeRight(); } }} />
                    {mode === "past" && (
                      <MicButton lang="ko-KR" label="Say the Past Form" onHeard={(heard) => {
                        // What was heard goes in the box to check (and fix) before submitting.
                        const said = heard.said.find((s) => check(s)) ?? heard.said[0];
                        if (said) {
                          setAnswer(said);
                          setHeard(said);
                          setNudge("Check what was heard, then submit");
                          inputRef.current?.focus();
                        } else setNudge(heardNothing(heard));
                      }} />
                    )}
                  </div>
                  {hint && (hintShown ? <HintView hint={hint} /> : (
                    <button type="button" className="link small hint-button" onClick={() => { setHintShown(true); inputRef.current?.focus(); }}>
                      <Icon name="bulb" size={16} /> Show Hint
                    </button>
                  ))}
                </div>
              ) : (
                <div className="center stack small-gap">
                  {mode === "past" && word.tenses ? (
                    <>
                      <div className="meaning-line" lang="ko">{word.tenses.past}</div>
                      <div className="row center-row">
                        <span className="small muted">{romanize(word.tenses.past)} · {displayMeanings(word.meanings)[0]}</span>
                        <SpeakButton text={word.tenses.past} size={18} />
                      </div>
                    </>
                  ) : form !== "dictionary" ? (
                    <>
                      <div className="meaning-line">{shownForForm(word, form).join(", ")}</div>
                      <span className="small muted"><span lang="ko">{shown}</span> is the {form} of <span lang="ko">{word.hangul}</span> · {displayMeanings(word.meanings)[0]}</span>
                    </>
                  ) : (
                    <div className="meaning-line">{displayMeanings(word.meanings).join(", ")}</div>
                  )}
                  {phase.correct
                    ? <span className="good strong"><Icon name="checkCircle" size={16} /> Correct!{phase.spoken && phase.given ? ` You said “${phase.given}”.` : ""}</span>
                    : phase.given
                      ? <span className="bad"><Icon name="x" size={14} /> {phase.spoken ? "You said" : "Your answer:"} “{phase.given}”</span>
                      : phase.timedOut
                        ? <span className="bad"><Icon name="x" size={14} /> Time's up.</span>
                        : <span className="muted">You skipped this one.</span>}
                  <ExampleLine word={word} prefer={mode === "past" ? word.tenses?.past : form !== "dictionary" ? shown : undefined} />
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
      {helpOpen && <ShortcutsSheet onClose={() => setHelpOpen(false)} />}
      {leaving && (
        <ConfirmDialog title="Leave the Duel?" confirmLabel="Leave"
          message={`A duel is played once, so your score is sent now: ${right} / ${words.length}, with the cards you haven't answered counted as wrong.`}
          onCancel={() => setLeaving(false)}
          onConfirm={async () => { setLeaving(false); await sendDuel(); onClose(); }} />
      )}
    </div>
  );
}

/** Round Complete in a duel: who won, or that your friend hasn't played yet. */
function DuelResult({ duel, error }: { duel: Duel; error: string | null }) {
  const store = useStore();
  const c = store.challenges.find((x) => x.id === duel.id);
  const first = duel.friend.split(/\s+/)[0];
  const both = c?.my_done && c.their_done;
  const winner = both ? duelWinner(c.my_score ?? 0, c.their_score ?? 0) : null;
  return (
    <Card>
      <div className="center stack small-gap" role="status">
        <Icon name={winner ? "trophy" : "bolt"} size={26} className="accent" />
        <span className="strong">Flashcard Duel with {duel.friend}</span>
        {error ? <span className="error small">Couldn't send your score: {error}</span>
          : !c?.my_done ? <span className="muted small">Sending your score…</span>
          : winner ? <span>You {c.my_score} · {first} {c.their_score} · {winner === "me" ? "You win!" : winner === "them" ? `${first} wins` : "It's a tie"}</span>
          : <span className="muted small">Your score is in. You'll see who won once {first} plays.</span>}
      </div>
    </Card>
  );
}

const SHORTCUTS: { keys: string[]; action: string }[] = [
  { keys: ["Enter"], action: "Submit your answer, then go to the next card" },
  { keys: ["Ctrl", "L"], action: "Listen" },
  { keys: ["Ctrl", "D"], action: "I don't know" },
  { keys: ["→"], action: "Submit, or the next card (when not typing)" },
  { keys: ["←"], action: "I don't know, or the next card (when not typing)" },
  { keys: ["Esc"], action: "Close the round" },
];

/** The round's keyboard shortcuts, from the ? button. */
function ShortcutsSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet title="Keyboard Shortcuts" onClose={onClose}>
      <div className="shortcut-list">
        {SHORTCUTS.map((s) => (
          <div key={s.action} className="shortcut-row">
            <span className="shortcut-keys">{s.keys.map((k) => <kbd key={k}>{k}</kbd>)}</span>
            <span>{s.action}</span>
          </div>
        ))}
      </div>
    </Sheet>
  );
}

/** The card's hint: an example sentence in Korean with its romanization (not the English, which would give the answer
 *  away), or the answer's first letter. */
function HintView({ hint }: { hint: FlashcardHint }) {
  if (hint.kind === "start") return <p className="hint small" role="status">Starts with “<strong>{hint.text}</strong>…”</p>;
  const { example } = hint;
  return (
    <div className="hint" role="status">
      <div className="row center-row">
        <span lang="ko"><KoreanText text={example.korean} /></span>
        <SpeakButton text={example.korean} size={16} />
      </div>
      {example.romanization && <span className="small muted">{example.romanization}</span>}
    </div>
  );
}
