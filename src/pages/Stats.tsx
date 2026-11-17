import { attempts } from "../core/progress";
import { addDays, dayString } from "../core/wordOfDay";
import { Card, Page, SectionTitle, StatTile, WordRow } from "../components/ui";
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
  const best = practiced.filter((x) => x.progress.streak > 0).sort((a, b) => b.progress.streak - a.progress.streak).slice(0, 10);

  return (
    <Page title="Stats">
      <div className="tiles">
        <StatTile title="Day Streak" value={String(stats.dailyStreak)} icon="flame" />
        <StatTile title="Days Studied" value={String(stats.daysStudied)} icon="sun" />
        <StatTile title="Words Practiced" value={String(stats.wordsPracticed)} icon="textBook" />
        <StatTile title="Words Mastered" value={String(stats.wordsMastered)} icon="seal" />
        <StatTile title="Accuracy" value={stats.accuracy === null ? "–" : `${Math.round(stats.accuracy * 100)}%`} icon="scope" />
        <StatTile title="Answers" value={String(stats.totalCorrect + stats.totalWrong)} icon="check" />
      </div>
      <Card>
        <SectionTitle>Last 14 Days</SectionTitle>
        <div className="chart">
          {days.map((d) => {
            const reviews = byDay.get(d)?.reviews ?? 0;
            return (
              <div key={d} className="bar-column" title={`${d}: ${reviews} answers, ${byDay.get(d)?.correct ?? 0} correct`}>
                <div className={`bar ${reviews ? "filled" : ""}`} style={{ height: reviews ? Math.max(8, (90 * reviews) / peak) : 4 }} />
                <span className="small muted">{new Date(d + "T00:00:00").toLocaleDateString(undefined, { weekday: "narrow" })}</span>
              </div>
            );
          })}
        </div>
      </Card>
      {practiced.length === 0 && <Card><p className="muted">Answer a quiz or a flashcard and your streaks will show up here.</p></Card>}
      {best.length > 0 && (
        <Card>
          <SectionTitle>Best Streaks</SectionTitle>
          <div className="divided">
            {best.map(({ word, progress }) => <WordRow key={word!.id} word={word!} progress={progress} onClick={() => store.openWord(word!)} />)}
          </div>
        </Card>
      )}
    </Page>
  );
}
