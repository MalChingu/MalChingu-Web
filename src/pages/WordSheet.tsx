import { useState } from "react";
import { displayMeanings } from "../core/answerChecker";
import type { Word } from "../core/models";
import { giveUp, newQuiz, revealHint, submit, type QuizSession } from "../core/quiz";
import { romanize } from "../core/romanizer";
import { QuizPanel, QuizResult } from "../components/QuizPanel";
import { Card, ExampleView, KoreanHeadline, PosTag, SectionTitle, Sheet, SpeakButton } from "../components/ui";
import { useStore } from "../lib/store";

/** A word's page: meaning, sentences and tenses. In quiz mode those stay hidden until the meaning is guessed. */
export function WordSheet({ word, startInQuiz, onClose }: { word: Word; startInQuiz: boolean; onClose: () => void }) {
  const { settings, record } = useStore();
  const [quiz, setQuiz] = useState<QuizSession>(() => newQuiz(word));
  const [revealed, setRevealed] = useState(!startInQuiz);

  const finish = (next: QuizSession, gaveUpNow = false) => {
    record(word.id, { correct: next.state === "solved", source: "quiz", gaveUp: gaveUpNow, hints: next.revealedHints.length });
    setRevealed(true);
  };

  return (
    <Sheet title={revealed ? "Word" : "What Does It Mean?"} onClose={onClose}>
      <Card padding={24}>
        <div className="center stack">
          <PosTag pos={word.pos} />
          <KoreanHeadline word={word} mode={revealed ? "both" : settings.display} />
          <SpeakButton text={word.hangul} size={24} />
          {revealed && <div className="meaning-line">{displayMeanings(word.meanings).join(", ")}</div>}
        </div>
      </Card>

      {!revealed ? (
        <Card>
          <QuizPanel session={quiz}
            onSubmit={(answer) => {
              const [next, outcome] = submit(quiz, answer);
              setQuiz(next);
              if (outcome.kind === "correct" || outcome.kind === "outOfTries") finish(next);
              return outcome;
            }}
            onGiveUp={() => { const next = giveUp(quiz); setQuiz(next); finish(next, true); }}
            onRevealHint={(i) => setQuiz(revealHint(quiz, i))} />
        </Card>
      ) : (
        <>
          {startInQuiz && quiz.state !== "answering" && <Card padding={14}><QuizResult session={quiz} /></Card>}
          {word.examples.length > 0 && (
            <Card>
              <SectionTitle>In a Sentence</SectionTitle>
              <div className="divided">
                {word.examples.map((example, i) => <ExampleView key={i} example={example} />)}
              </div>
            </Card>
          )}
          {word.tenses && (
            <Card>
              <SectionTitle>Tenses</SectionTitle>
              <div className="divided">
                {(["past", "present", "future"] as const).map((tense) => (
                  <div key={tense} className="tense-row">
                    <span className="muted tense-name">{tense[0].toUpperCase() + tense.slice(1)}</span>
                    <span className="tense-form">
                      <span className="example-korean" lang="ko">{word.tenses![tense]}</span>
                      <span className="muted">{romanize(word.tenses![tense])}</span>
                    </span>
                    <SpeakButton text={word.tenses![tense]} />
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </Sheet>
  );
}
