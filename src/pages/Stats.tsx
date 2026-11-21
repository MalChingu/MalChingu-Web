import { useState } from "react";
import type { Word } from "../core/models";
import { attempts, type WordProgress } from "../core/progress";
import { addDays, dayString } from "../core/wordOfDay";
import { Card, Page, RoundButton, SectionTitle, StatTile, WordRow, useSwipe } from "../components/ui";
import { useStore } from "../lib/store";

export function Stats() {
  const store = useStore();
  const { stats } = store;
  const byDay = new Map(store.data.studyDays.map((d) => [d.day, d]));
  const days = Array.from({ length: 14 }, (_, i) => addDays(dayString(), i - 13));
  const peak = Math.max(1, ...days.map((d) => byDay.get(d)?.reviews ?? 0));
  const practiced = store.data.progress
    .filter((p) => attempts(p) > 0)
    .map((p) => ({ progress: p, word: store.findWord(p.word_id) }))
    .filter((x) => x.word !== null);
  const best = practiced.filter((x) => x.progress.streak > 0).sort((a, b) => b.progress.streak - a.progress.streak);

  return (
    <Page title="Stats">
      <div className="tiles">
        <StatTile title="Day Streak" value={String(stats.dailyStreak)} icon="flame" tone="orange" />
        <StatTile title="Days Studied" value={String(stats.daysStudied)} icon="calendar" tone="red" />
        <StatTile title="Words Practiced" value={String(stats.wordsPracticed)} icon="textBook" />
        <StatTile title="Words Mastered" value={String(stats.wordsMastered)} icon="seal" tone="green" />
        <StatTile title="Accuracy" value={stats.accuracy === null ? "–" : `${Math.round(stats.accuracy * 100)}%`} icon="scope" tone="yellow" />
        <StatTile title="Answers" value={String(stats.totalCorrect + stats.totalWrong)} icon="keyboard" tone="text" />
      </div>
      <Card>
        <SectionTitle>Last 14 Days</SectionTitle>
        <div className="chart">
          {days.map((d) => {
            const reviews = byDay.get(d)?.reviews ?? 0;
            return (
              <div key={d} className="bar-column" tabIndex={0}
                aria-label={`${new Date(d + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}: ${reviews} ${reviews === 1 ? "word" : "words"} practiced`}>
                <div className={`bar ${reviews ? "filled" : ""}`} style={{ height: reviews ? Math.max(8, (90 * reviews) / peak) : 4 }}>
                  <span className="bar-tip" aria-hidden="true">{reviews} {reviews === 1 ? "word" : "words"}</span>
                </div>
                <span className="small muted">{new Date(d + "T00:00:00").toLocaleDateString(undefined, { weekday: "narrow" })}</span>
              </div>
            );
          })}
        </div>
      </Card>
      {practiced.length === 0 && <Card><p className="muted">Answer a quiz or a flashcard and your streaks will show up here.</p></Card>}
      {best.length > 0 && <BestStreaks items={best.map((x) => ({ word: x.word!, progress: x.progress }))} />}
    </Page>
  );
}

const PER_PAGE = 8;

/** Every word with a streak, longest first, 8 to a page. The arrows (or a swipe on a touch screen) move between pages. */
function BestStreaks({ items }: { items: { word: Word; progress: WordProgress }[] }) {
  const store = useStore();
  const pages = Math.ceil(items.length / PER_PAGE);
  const [page, setPage] = useState(0);
  const [direction, setDirection] = useState<"next" | "previous" | null>(null);
  const current = Math.min(page, pages - 1);
  const go = (to: number) => {
    if (to < 0 || to >= pages || to === current) return;
    setDirection(to > current ? "next" : "previous");
    setPage(to);
  };
  const shown = items.slice(current * PER_PAGE, (current + 1) * PER_PAGE);
  const swipe = useSwipe(() => go(current - 1), () => go(current + 1));
  return (
    <Card>
      <div className="best-head">
        <SectionTitle>Best Streaks</SectionTitle>
        {pages > 1 && (
          <div className="best-pager">
            <RoundButton icon="chevronLeft" tint="glass" label="Previous Page" size={34} disabled={current === 0} onClick={() => go(current - 1)} />
            <span className="small muted best-page" aria-live="polite">{current + 1} of {pages}</span>
            <RoundButton icon="chevron" tint="glass" label="Next Page" size={34} disabled={current === pages - 1} onClick={() => go(current + 1)} />
          </div>
        )}
      </div>
      <div key={current} className={`divided best-list ${direction ? `slide-${direction}` : ""}`} {...swipe}>
        {shown.map(({ word, progress }) => <WordRow key={word.id} word={word} progress={progress} onClick={() => store.openWord(word)} />)}
      </div>
    </Card>
  );
}
