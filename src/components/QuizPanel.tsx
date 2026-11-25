import { useRef, useState } from "react";
import { HINT_SLOTS, MAX_MISTAKES, hintAt, isHintRevealed, triesLeft, type Outcome, type QuizSession } from "../core/quiz";
import { hintHasEnglish, hintWords } from "../core/hints";
import { saidRight } from "../core/koreanWords";
import type { Heard } from "../lib/listen";
import { MicButton, heardNothing } from "./KoreanText";
import { useStore } from "../lib/store";
import { Icon } from "./Icon";
import { ExampleView, RoundButton } from "./ui";

/** The guess box: red X to give up, the answer field, green ✓ to check, and three tap-to-reveal hints. */
export function QuizPanel({ session, onSubmit, onGiveUp, onRevealHint }: {
  session: QuizSession; onSubmit: (answer: string) => Outcome; onGiveUp: () => void; onRevealHint: (index: number) => void;
}) {
  const store = useStore();
  const [answer, setAnswer] = useState("");
  const [shake, setShake] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const canSubmit = answer.trim().length > 0;

  const check = () => {
    if (!canSubmit) return;
    const outcome = onSubmit(answer);
    if (outcome.kind === "wrong") {
      setAnswer("");
      setShake(true);
      window.setTimeout(() => setShake(false), 600);
      input.current?.focus();
    }
  };

  return (
    <div className="quiz">
      <form className="quiz-row" onSubmit={(e) => { e.preventDefault(); check(); }}>
        <RoundButton icon="x" tint="red" label="I don't know, show the answer" onClick={onGiveUp} />
        <input ref={input} className={`answer-input ${shake ? "wrong" : ""}`} value={answer} placeholder="Meaning in English"
          autoCapitalize="off" autoCorrect="off" spellCheck={false} aria-label="Meaning in English"
          onChange={(e) => setAnswer(e.target.value)} />
        <RoundButton icon="check" tint="green" label="Check answer" onClick={check} disabled={!canSubmit} />
      </form>

      <div className="tries" aria-label={`${triesLeft(session)} tries left`}>
        {Array.from({ length: MAX_MISTAKES }, (_, i) => (
          <span key={i} className={`dot ${i < session.mistakes ? "used" : ""}`} />
        ))}
        <span className={`small ${session.mistakes ? "bad" : "muted"}`}>
          {session.mistakes === 0 ? `${MAX_MISTAKES} tries`
            : triesLeft(session) === 1 ? "Not quite. Last try." : `Not quite. ${triesLeft(session)} tries left.`}
        </span>
      </div>

      {Array.from({ length: HINT_SLOTS }, (_, i) => {
        const example = hintAt(session, i);
        if (!example) return <div key={i} className="hint-empty small muted">No hint {i + 1} for this word</div>;
        if (isHintRevealed(session, i)) {
          return (
            <div key={i} className="hint-open">
              <div className="small muted strong">Hint {i + 1}</div>
              <ExampleView example={example} showEnglish={false}
                glossed={hintHasEnglish(store.level, i, HINT_SLOTS) ? hintWords(example.korean, session.word, store.allWords) : null} />
            </div>
          );
        }
        return (
          <button key={i} type="button" className="hint-closed" onClick={() => onRevealHint(i)}>
            <Icon name="bulb" size={16} /> Tap to Show Hint {i + 1}
          </button>
        );
      })}
    </div>
  );
}

/** The result line once a quiz is over, with a microphone on the right to practice saying the word. */
export function QuizResult({ session }: { session: QuizSession }) {
  const solved = session.state === "solved";
  const [said, setSaid] = useState<{ right: boolean; n: number } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  // Say it as many times as you like: each try shows ✓ or ✗ beside the microphone.
  const onHeard = (heard: Heard) => {
    if (heard.said.length === 0) { setSaid(null); setProblem(heardNothing(heard)); return; }
    setProblem(null);
    setSaid((s) => ({ right: heard.said.some((x) => saidRight(x, session.word.hangul)), n: (s?.n ?? 0) + 1 }));
  };
  return (
    <>
      <div className={`quiz-result ${solved ? "good" : "warn"}`}>
        <Icon name={solved ? "checkCircle" : "bulb"} size={20} />
        <span className="grow">{solved
          ? session.mistakes === 0 ? "Correct!" : `Correct after ${session.mistakes} miss${session.mistakes === 1 ? "" : "es"}.`
          : `The answer is “${session.word.meanings[0]}”.`}</span>
        <span className="say-practice">
          <MicButton lang="ko-KR" label={`Practice Saying ${session.word.hangul}`} size={20} onHeard={onHeard} />
          {said && (
            <span key={said.n} className={`say-mark ${said.right ? "right" : "wrong"}`} role="status"
              aria-label={said.right ? "You said it right" : "Not quite. Try again"}>
              <Icon name={said.right ? "check" : "x"} size={16} strokeWidth={3} />
            </span>
          )}
        </span>
      </div>
      {problem && <p className="small muted say-problem" role="status">{problem}</p>}
    </>
  );
}
