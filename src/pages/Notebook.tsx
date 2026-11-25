import { useMemo, useState } from "react";
import { Icon } from "../components/Icon";
import { KoreanText } from "../components/KoreanText";
import { noteTags, type NoteDraft } from "../components/NoteMenu";
import { Card, ConfirmDialog, Page, Segmented, SpeakButton, copyText, useSwipe } from "../components/ui";
import { romanize } from "../core/romanizer";
import { useStore } from "../lib/store";

type Tab = "notes" | "translations";
type When = "all" | "week" | "today";

const formatWhen = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

function within(iso: string, when: When): boolean {
  if (when === "all") return true;
  const date = new Date(iso);
  const now = new Date();
  if (when === "today") return date.toDateString() === now.toDateString();
  return now.getTime() - date.getTime() < 7 * 24 * 3600 * 1000;
}

/** My Notes: the learner's own notes and the translations they saved, filtered by guide, day and date. */
export function Notebook({ startTab = "notes", onBack, addNote }: {
  startTab?: Tab; onBack: () => void; addNote: (draft: NoteDraft) => void;
}) {
  const store = useStore();
  const [tab, setTab] = useState<Tab>(startTab);
  const [guide, setGuide] = useState("all");   // "all", "none" or a guide id
  const [day, setDay] = useState("all");
  const [when, setWhen] = useState<When>("all");
  const [deleting, setDeleting] = useState<{ kind: Tab; id: string } | null>(null);

  const titles = useMemo(() => new Map(store.data.guides.map((g) => [g.id, g.title])), [store.data.guides]);
  const guides = [...store.data.guides].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const days = guide === "all" || guide === "none" ? []
    : store.data.sessions.filter((s) => s.guide_id === guide).map((s) => s.day_number).sort((a, b) => a - b);

  const matches = (row: { guide_id: string | null; day_number: number | null; created_at: string }) =>
    (guide === "all" || (guide === "none" ? row.guide_id === null : row.guide_id === guide))
    && (day === "all" || row.day_number === Number(day))
    && within(row.created_at, when);

  const notes = store.data.notes.filter((n) => matches(n)).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const saved = store.data.savedTranslations.filter((t) => matches(t))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const swipe = useSwipe(() => setTab("notes"), () => setTab("translations"));
  return (
    <Page title="My Notes" back={{ label: "Back to Study Guides", onClick: onBack }}>
      <Segmented label="Show" value={tab} onChange={setTab}
        options={[{ value: "notes", label: "Notes" }, { value: "translations", label: "Translations" }]} />
      {/* On a phone, a sideways swipe switches between Notes and Translations. */}
      <div className="swipe-area" {...swipe}>
      <Card>
        <div className="filters">
          <label className="form-row"><span>Guide</span>
            <select value={guide} onChange={(e) => { setGuide(e.target.value); setDay("all"); }}>
              <option value="all">All Guides</option>
              {guides.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
              <option value="none">No Guide</option>
            </select>
          </label>
          {days.length > 0 && (
            <label className="form-row"><span>Day</span>
              <select value={day} onChange={(e) => setDay(e.target.value)}>
                <option value="all">All Days</option>
                {days.map((d) => <option key={d} value={d}>Day {d}</option>)}
              </select>
            </label>
          )}
          <Segmented label="When" value={when} onChange={setWhen}
            options={[{ value: "all", label: "All" }, { value: "week", label: "This Week" }, { value: "today", label: "Today" }]} />
        </div>
      </Card>

      {tab === "notes" && (notes.length === 0 ? (
        <Card><p className="muted center">{when === "today" ? "No notes today" : when === "week" ? "No notes this week" : "No notes yet"}</p></Card>
      ) : notes.map((n) => (
        <Card key={n.id} className="notebook-item">
          <div className="note-body"><KoreanText text={n.body} /></div>
          <div className="row">
            <span className="small muted grow">
              {[noteTags(n.guide_id ? titles.get(n.guide_id) ?? "Deleted guide" : null, n.day_number, n.section), formatWhen(n.created_at)]
                .filter(Boolean).join(" · ")}
            </span>
            <button type="button" className="icon-button" aria-label="Copy Note" title="Copy" onClick={() => copyText(n.body)}><Icon name="copy" size={18} /></button>
            <button type="button" className="icon-button" aria-label="Edit Note" title="Edit"
              onClick={() => addNote({ id: n.id, body: n.body, guide_id: n.guide_id, day_number: n.day_number, section: n.section })}>
              <Icon name="pencil" size={18} />
            </button>
            <button type="button" className="icon-button danger" aria-label="Delete Note" title="Delete" onClick={() => setDeleting({ kind: "notes", id: n.id })}>
              <Icon name="trash" size={18} />
            </button>
          </div>
        </Card>
      )))}

      {tab === "translations" && (saved.length === 0 ? (
        <Card><p className="muted center">{when === "today" ? "No translations today" : when === "week" ? "No translations this week" : "No translations yet"}</p></Card>
      ) : saved.map((t) => {
        const korean = t.source_lang === "ko" ? t.source : t.translation;
        return (
          <Card key={t.id} className="notebook-item">
            <div className="saved-pair">
              <span lang={t.source_lang} className="saved-source"><KoreanText text={t.source} /></span>
              <span lang={t.source_lang === "ko" ? "en" : "ko"} className="saved-translation"><KoreanText text={t.translation} /></span>
              <span className="small muted">{romanize(korean)}</span>
            </div>
            <div className="row">
              <span className="small muted grow">
                {[noteTags(t.guide_id ? titles.get(t.guide_id) ?? "Deleted guide" : null, t.day_number, null), formatWhen(t.created_at)]
                  .filter(Boolean).join(" · ")}
              </span>
              <SpeakButton text={korean} size={18} />
              <button type="button" className="icon-button" aria-label="Copy Translation" title="Copy"
                onClick={() => copyText(`${t.source}\n${t.translation}`)}><Icon name="copy" size={18} /></button>
              <button type="button" className="icon-button danger" aria-label="Delete Translation" title="Delete"
                onClick={() => setDeleting({ kind: "translations", id: t.id })}><Icon name="trash" size={18} /></button>
            </div>
          </Card>
        );
      }))}

      </div>
      {deleting && (
        <ConfirmDialog title={deleting.kind === "notes" ? "Delete This Note?" : "Delete This Translation?"}
          message="It's removed on all your devices." confirmLabel="Delete"
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            if (deleting.kind === "notes") void store.deleteNote(deleting.id);
            else void store.deleteTranslation(deleting.id);
            setDeleting(null);
          }} />
      )}
    </Page>
  );
}
