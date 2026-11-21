import { useMemo, useState } from "react";
import { guideRequest } from "../core/guideRequest";
import type { GuideSessionRow, StudyGuideRow, Word } from "../core/models";
import { customToWord } from "../core/wordBank";
import { addDays, dayString } from "../core/wordOfDay";
import { Icon } from "../components/Icon";
import { CheckYourself, GuideNotes, GuideSection } from "../components/GuideNotes";
import { TranslateCard } from "../components/TranslateCard";
import { Button, Card, ConfirmDialog, Page, RoundButton, SectionTitle, Segmented, Sheet, Stepper, WordRow, copyText } from "../components/ui";
import { overviewPoints } from "../core/guideOverview";
import { useStore } from "../lib/store";
import { formatDay, guideDate, guideDayNumber } from "./guideDates";
import { TaskList } from "./Today";
import { KoreanText } from "../components/KoreanText";
import { NoteFab, NoteMenuProvider, NotesPanel, useNoteMenu, type NoteDraft } from "../components/NoteMenu";
import { Notebook } from "./Notebook";
import type { Practice } from "./Flashcards";

export function Guides({ openGuideID, setOpenGuideID, practice }: {
  openGuideID: string | null; setOpenGuideID: (id: string | null) => void; practice: Practice;
}) {
  const store = useStore();
  const [creating, setCreating] = useState(false);
  const [notebook, setNotebook] = useState<"notes" | "translations" | null>(null);
  // The Notes panel: its list (this guide's notes inside a guide) or the note being written.
  const [notesPanel, setNotesPanel] = useState<{ guideID: string | null; day: number | null; draft: NoteDraft | null } | null>(null);
  const guides = store.data.guides.filter((g) => !g.deleted_at).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const open = guides.find((g) => g.id === openGuideID);
  const noteCount = store.data.notes.filter((n) => !n.deleted_at).length + store.data.savedTranslations.filter((t) => !t.deleted_at).length;
  const blank: NoteDraft = { body: "", guide_id: null, day_number: null, section: null };
  /** The Notes button: opens the list (or keeps what's open). */
  const openNotes = (guideID: string | null, day: number | null) =>
    setNotesPanel((p) => (p ? { ...p, guideID, day } : { guideID, day, draft: null }));
  /** A new note (Add Note Here, or + on My Notes) or one to edit. A new note already being written keeps its text and
   *  takes the new place. */
  const addNote = (draft: NoteDraft) => setNotesPanel((p) => ({
    guideID: draft.guide_id, day: draft.day_number,
    draft: p?.draft && !p.draft.id && p.draft.body.trim() && !draft.id
      ? { ...p.draft, guide_id: draft.guide_id, day_number: draft.day_number, section: draft.section } : draft,
  }));
  const panel = (inNotebook: boolean) => notesPanel && (
    <NotesPanel guideID={notesPanel.guideID} dayNumber={notesPanel.day} draft={notesPanel.draft}
      setDraft={(draft) => setNotesPanel((p) => p && { ...p, draft })} onClose={() => setNotesPanel(null)}
      openAll={inNotebook ? undefined : () => { setNotesPanel(null); setNotebook("notes"); }} />
  );

  if (notebook) {
    return (
      <>
        <Notebook startTab={notebook} onBack={() => setNotebook(null)} addNote={addNote} />
        <NoteFab kind="add" onClick={() => addNote(blank)} />
        {panel(true)}
      </>
    );
  }
  if (open) {
    return (
      <>
        <GuideDetail guide={open} onBack={() => setOpenGuideID(null)} practice={practice} addNote={addNote}
          openNotes={(day) => openNotes(open.id, day)} openNotebook={setNotebook} />
        {panel(false)}
      </>
    );
  }

  return (
    <Page title="Study Guides" actions={guides.length > 0
      ? <RoundButton icon="plus" tint="glass" label="Create Guide" onClick={() => setCreating(true)} size={38} /> : undefined}>
      <button type="button" className="glass card nav-row" onClick={() => setNotebook("notes")}>
        <Icon name="pencil" size={20} className="accent" />
        <span className="grow">My Notes</span>
        <span className="muted">{noteCount}</span>
        <Icon name="chevron" size={16} className="muted" />
      </button>
      {guides.length === 0 && (
        <Card padding={22}>
          <div className="stack">
            <Icon name="bulb" size={32} className="accent" />
            <h3>Turn Your Notes Into a Plan</h3>
            <p className="muted">Give Claude your tutor's notes, PDFs, screenshots or anything you found online, plus a timeframe. Claude builds a day-by-day study guide and saves it here, with the vocabulary ready as flashcards.</p>
            <Button kind="prominent" icon="plus" full large onClick={() => setCreating(true)}>Create Guide</Button>
          </div>
        </Card>
      )}
      {guides.length > 0 && <div className="guide-grid">{guides.map((guide) => {
        const tasks = store.data.tasks.filter((t) => t.guide_id === guide.id);
        const done = tasks.filter((t) => t.done).length;
        return (
          <button key={guide.id} type="button" className="glass card guide-card" onClick={() => setOpenGuideID(guide.id)}>
            <div className="row"><h3 className="grow">{guide.title}</h3><Icon name="chevron" size={16} className="muted" /></div>
            <div className="muted">{guideStatus(guide)}</div>
            <progress value={done} max={Math.max(tasks.length, 1)} />
            <div className="small muted">{done} of {tasks.length} tasks done</div>
          </button>
        );
      })}</div>}
      {creating && <CreateGuide onClose={() => setCreating(false)} />}
      <NoteFab onClick={() => openNotes(null, null)} />
      {panel(false)}
    </Page>
  );
}

function guideStatus(guide: StudyGuideRow): string {
  const day = guideDayNumber(guide);
  if (day) return `Day ${day} of ${guide.total_days}`;
  if (guide.start_date > dayString()) return `Starts ${formatDay(guide.start_date, { month: "short", day: "numeric", year: "numeric" })} · ${guide.total_days} days`;
  return `${guide.total_days} days · finished`;
}

/** The day to open on: today if the guide is running, the first day if it hasn't started, the last if it's over. */
function startingDay(guide: StudyGuideRow, days: number[]): number {
  const today = guideDayNumber(guide);
  if (today && days.includes(today)) return today;
  if (guide.start_date > dayString()) return days[0];
  return days[days.length - 1];
}

function GuideDetail({ guide, onBack, practice, addNote, openNotes, openNotebook }: {
  guide: StudyGuideRow; onBack: () => void; practice: Practice;
  addNote: (draft: NoteDraft) => void; openNotes: (day: number | null) => void; openNotebook: (tab: "notes" | "translations") => void;
}) {
  const store = useStore();
  const today = guideDayNumber(guide);
  const sessions = store.data.sessions.filter((s) => s.guide_id === guide.id).sort((a, b) => a.day_number - b.day_number);
  const dayNumbers = sessions.map((s) => s.day_number);
  const [selected, setSelected] = useState(() => startingDay(guide, dayNumbers));
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const vocabulary = store.data.customWords.filter((w) => !w.deleted_at && w.guide_id === guide.id);
  const tasks = store.data.tasks.filter((t) => t.guide_id === guide.id);
  const done = tasks.filter((t) => t.done).length;
  const shuffled = (words: Word[]) => [...words].sort(() => Math.random() - 0.5);
  const index = Math.max(0, dayNumbers.indexOf(selected));
  const session = sessions[index];
  const points = overviewPoints(guide.overview);

  return (
    <Page title={guide.title} back={{ label: "Back to Study Guides", onClick: onBack }} actions={
      <RoundButton icon="trash" tint="glass" label="Delete Guide" size={40} onClick={() => setConfirmingDelete(true)} />
    }>
      <NoteMenuProvider onAddNote={(section) => addNote({ body: "", guide_id: guide.id, day_number: session?.day_number ?? null, section })}>
      <div className="guide-layout">
        <div className="guide-main">
          <Card>
            {points.length > 0 && <ul className="points">{points.map((p, i) => <li key={i}>{p}</li>)}</ul>}
            <progress value={done} max={Math.max(tasks.length, 1)} />
            <div className="row">
              <span className="small muted grow">{done} of {tasks.length} tasks · {vocabulary.length} words</span>
              {vocabulary.length > 0 && (
                <Button icon="cards" onClick={() => practice(shuffled(vocabulary.map(customToWord)), "meaning")}>All Vocabulary Flashcards</Button>
              )}
            </div>
          </Card>

          {session && (
            <>
              <div className="day-switcher">
                <RoundButton icon="chevronLeft" tint="glass" label="Previous day" size={40} disabled={index === 0}
                  onClick={() => setSelected(dayNumbers[index - 1])} />
                <div className="day-switcher-label">
                  <strong>Day {session.day_number} of {guide.total_days}</strong>
                  <span className="small muted">{formatDay(guideDate(guide, session.day_number))}</span>
                </div>
                <RoundButton icon="chevron" tint="glass" label="Next day" size={40} disabled={index === sessions.length - 1}
                  onClick={() => setSelected(dayNumbers[index + 1])} />
              </div>
              <DayCard key={session.id} guide={guide} session={session} isToday={session.day_number === today}
                words={vocabulary.filter((w) => w.day_number === session.day_number).map(customToWord)}
                practice={(words, mode) => practice(shuffled(words), mode)} />
            </>
          )}
        </div>

        <aside className="guide-side">
        <nav className="glass card day-list" aria-label="Days">
          <div className="section-title">Days</div>
          {sessions.map((s) => {
            const dayTasks = tasks.filter((t) => t.session_id === s.id);
            const finished = dayTasks.length > 0 && dayTasks.every((t) => t.done);
            // Green once every task is done; red for a day that has passed with tasks left.
            const missed = !finished && guideDate(guide, s.day_number) < dayString();
            const status = finished ? "done" : missed ? "missed" : "";
            return (
              <button key={s.id} type="button" className={`day-item ${status} ${s.day_number === selected ? "on" : ""}`}
                aria-current={s.day_number === selected ? "true" : undefined} onClick={() => setSelected(s.day_number)}
                aria-label={`Day ${s.day_number}: ${s.title}${finished ? ", done" : missed ? ", not finished" : ""}`}>
                <span className="day-number">{s.day_number}</span>
                <span className="day-item-text">
                  <span className="day-item-title">{s.title}</span>
                  <span className="small muted">
                    {formatDay(guideDate(guide, s.day_number))}{s.day_number === today ? " · Today" : ""}
                  </span>
                </span>
              </button>
            );
          })}
        </nav>
        <TranslateCard guideID={guide.id} dayNumber={session?.day_number ?? null} openSaved={() => openNotebook("translations")} />
        </aside>
      </div>
      </NoteMenuProvider>

      <NoteFab onClick={() => openNotes(session?.day_number ?? null)} />
      {confirmingDelete && (
        <ConfirmDialog title="Delete This Guide?" message="Its days and tasks are removed on all your devices. Its vocabulary stays in My Words."
          confirmLabel="Delete Guide" onCancel={() => setConfirmingDelete(false)}
          onConfirm={() => { setConfirmingDelete(false); store.deleteGuide(guide); onBack(); }} />
      )}
    </Page>
  );
}

function DayCard({ guide, session, isToday, words, practice }: {
  guide: StudyGuideRow; session: GuideSessionRow; isToday: boolean; words: Word[]; practice: Practice;
}) {
  const store = useStore();
  const menu = useNoteMenu();
  const checks = session.self_check ?? [];
  const withTenses = words.filter((w) => w.tenses);
  void guide;
  return (
    <Card className="day-card">
      {/* The day's title, goals and tasks share one right-click menu: Add Note to Goals & Tasks. */}
      <div className="day-top" onContextMenu={menu ? (e) => menu.open(e, "tasks") : undefined}>
        <div className="row">
          <h3 className="grow">{session.title}</h3>
          {isToday && <span className="today-badge">TODAY</span>}
        </div>
        {session.goals.length > 0 && (
          <div className="goals-block">
            <span className="section-title">Goals</span>
            <ul className="goals">{session.goals.map((g, i) => <li key={i}><KoreanText text={g} /></li>)}</ul>
          </div>
        )}
        <TaskList tasks={store.data.tasks.filter((t) => t.session_id === session.id)} />
      </div>
      {session.grammar_notes && <GuideNotes text={session.grammar_notes} />}
      {checks.length > 0 && <CheckYourself items={checks} />}
      {words.length > 0 && (
        // The flashcards work without opening the list: the meaning, or the past form of verbs and adjectives.
        <GuideSection icon="cards" title={`Vocabulary · ${words.length}`} section="vocabulary" below={
          <div className="flash-row">
            <span className="small muted grow">Flashcards</span>
            <Button compact kind="prominent" onClick={() => practice(words, "meaning")}>Meaning</Button>
            {withTenses.length > 0 && <Button compact kind="prominent" onClick={() => practice(withTenses, "past")}>Past Form</Button>}
          </div>
        }>
          <div className="divided">
            {words.map((w) => <WordRow key={w.id} word={w} progress={store.progressFor(w.id)} onClick={() => store.openWord(w)} />)}
          </div>
        </GuideSection>
      )}
    </Card>
  );
}

const PRESETS = [{ label: "1 week", days: 7 }, { label: "2 weeks", days: 14 }, { label: "1 month", days: 30 }, { label: "2 months", days: 60 }];

/** Builds the one-sentence request for Claude, which writes the guide and saves it through the connector. */
function CreateGuide({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const [days, setDays] = useState(7);
  const [minutes, setMinutes] = useState(30);
  const [start, setStart] = useState(dayString());
  const [focus, setFocus] = useState("");
  const [copied, setCopied] = useState(false);
  const request = useMemo(() => guideRequest(days, minutes, start, focus.trim()), [days, minutes, start, focus]);
  const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

  return (
    <Sheet title="Create Guide" onClose={onClose}>
      {!store.data.hasConnectorToken && (
        <Card>
          <div className="stack">
            <strong><Icon name="link" size={16} /> Connect Claude First</strong>
            <p className="muted small">Guides are written by Claude and saved to Korimal through a connector. Set it up once in Profile → Claude Connector.</p>
          </div>
        </Card>
      )}
      <Card>
        <SectionTitle>Timeframe</SectionTitle>
        <Segmented label="Length" value={String(days)} onChange={(v) => setDays(Number(v))}
          options={PRESETS.map((p) => ({ value: String(p.days), label: p.label }))} />
        <div className="form-row"><span>{days} days</span>
          <Stepper minusLabel="Fewer days" plusLabel="More days" minusDisabled={days <= 1} plusDisabled={days >= 180}
            onMinus={() => setDays(clamp(days - 1, 1, 180))} onPlus={() => setDays(clamp(days + 1, 1, 180))} />
        </div>
        <label className="form-row"><span>Start</span>
          <input type="date" value={start} min={dayString()} max={addDays(dayString(), 365)} onChange={(e) => e.target.value && setStart(e.target.value)} />
        </label>
        <div className="form-row"><span>{minutes} minutes a day</span>
          <Stepper minusLabel="Fewer minutes" plusLabel="More minutes" minusDisabled={minutes <= 10} plusDisabled={minutes >= 180}
            onMinus={() => setMinutes(clamp(minutes - 5, 10, 180))} onPlus={() => setMinutes(clamp(minutes + 5, 10, 180))} />
        </div>
      </Card>
      <Card>
        <SectionTitle>Focus</SectionTitle>
        <textarea className="text-input text-area" rows={3} value={focus} aria-label="Focus"
          placeholder="Optional, e.g. past tense, travel phrases" onChange={(e) => setFocus(e.target.value)} />
      </Card>
      <Card>
        <SectionTitle>Request</SectionTitle>
        <p>{request}</p>
        <Button kind="prominent" icon={copied ? "check" : "copy"} full large onClick={() => { copyText(request); setCopied(true); }}>
          {copied ? "Request Copied" : "Copy Request"}
        </Button>
        <p className="small muted">Paste it into a Claude chat, attach your PDFs, screenshots or notes if you have any, then send. Claude sets the level from your stats. When it says the guide is saved, come back here.</p>
      </Card>
    </Sheet>
  );
}
