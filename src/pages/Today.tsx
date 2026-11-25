import { QuizPanel, QuizResult } from "../components/QuizPanel";
import { KoreanText } from "../components/KoreanText";
import { Icon } from "../components/Icon";
import { Button, Card, KoreanHeadline, Page, PosTag, SectionTitle, SpeakButton, StreakStar } from "../components/ui";
import { isFinished } from "../core/quiz";
import type { GuideSessionRow, GuideTaskRow, StudyGuideRow } from "../core/models";
import { useStore } from "../lib/store";
import { guideDayNumber } from "./guideDates";

export function Today({ openGuide }: { openGuide: (id: string) => void }) {
  const store = useStore();
  const { dailyQuiz: quiz, settings, stats } = store;
  const first = settings.profile.name.split(" ").filter(Boolean)[0];

  const todays = store.data.guides
    .map((guide) => {
      const day = guideDayNumber(guide);
      const session = day ? store.data.sessions.find((s) => s.guide_id === guide.id && s.day_number === day) : undefined;
      return session ? { guide, session } : null;
    })
    .filter((x): x is { guide: StudyGuideRow; session: GuideSessionRow } => x !== null);

  return (
    // The streak star sits beside the greeting (under it, both centred, on phones). The word of the day and today's
    // guide sessions run full width.
    <Page title={first ? `Welcome Back, ${first}` : "Welcome Back"} waiting={!store.todayLoaded} className="today-page"
      actions={<StreakStar days={stats.dailyStreak} />}>
      <div className="today-layout">
        <div className="today-main">
          {quiz && (
            <div className="glass card wotd">
              <div className="row">
                <SectionTitle>Word of the Day</SectionTitle>
                <span className="grow" />
                <PosTag pos={quiz.word.pos} />
              </div>
              <div className="center stack wotd-word">
                <KoreanHeadline word={quiz.word} mode={isFinished(quiz) ? "both" : settings.display} size={60} />
                <SpeakButton text={quiz.word.hangul} size={24} />
              </div>
              {isFinished(quiz) ? (
                <div className="stack">
                  <QuizResult session={quiz} />
                  {quiz.state === "solved" && <div className="meaning-line left">{quiz.word.meanings[0]}</div>}
                  <Button icon="textBook" full large onClick={() => store.openWord(quiz.word)}>Usage and Tenses</Button>
                </div>
              ) : (
                <QuizPanel session={quiz} onSubmit={store.submitDaily} onGiveUp={store.giveUpDaily} onRevealHint={store.revealDailyHint} />
              )}
            </div>
          )}
        </div>
        {todays.length > 0 && (
          <div className="today-guides">
            {todays.map(({ guide, session }) => (
              <Card key={session.id}>
                <SectionTitle>{guide.title} · Day {session.day_number} of {guide.total_days}</SectionTitle>
                <h3>{session.title}</h3>
                <TaskList tasks={store.data.tasks.filter((t) => t.session_id === session.id)} />
                <Button icon="book" onClick={() => openGuide(guide.id)}>Open Guide</Button>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Page>
  );
}

/** True when the person has just selected text inside `el` (a drag, not a click). */
export function selectingIn(el: Element): boolean {
  const selection = window.getSelection();
  return !!selection && !selection.isCollapsed && !!selection.anchorNode && el.contains(selection.anchorNode);
}

/** The circle ticks a task; the text can be selected and copied, and a plain click on it ticks too. */
export function TaskList({ tasks }: { tasks: GuideTaskRow[] }) {
  const { setTaskDone } = useStore();
  return (
    <div className="tasks">
      {[...tasks].sort((a, b) => a.position - b.position).map((task) => (
        <div key={task.id} className={`task ${task.done ? "done" : ""}`}>
          <button type="button" className="task-check" role="checkbox" aria-checked={task.done} aria-label={task.text}
            onClick={() => setTaskDone(task, !task.done)}>
            <Icon name={task.done ? "checkCircle" : "circle"} size={22} className={task.done ? "good" : "muted"} />
          </button>
          <span className="task-text" onClick={(e) => { if (!selectingIn(e.currentTarget)) setTaskDone(task, !task.done); }}>
            <KoreanText text={task.text} />
          </span>
        </div>
      ))}
    </div>
  );
}
