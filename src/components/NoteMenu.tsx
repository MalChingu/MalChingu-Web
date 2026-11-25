import { createContext, useContext, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { NoteSection } from "../core/models";
import { useStore } from "../lib/store";
import { pageZoom } from "../lib/zoom";
import { Icon } from "./Icon";
import { KoreanText } from "./KoreanText";
import { Card, ConfirmDialog, FloatingPanel, RoundButton, SectionTitle, Segmented, Sheet, SpeakButton, copyText, useSwipe, useWide } from "./ui";
import { romanize } from "../core/romanizer";

export const SECTION_LABEL: Record<NoteSection, string> = {
  notes: "Notes", check: "Check Yourself", vocabulary: "Vocabulary", tasks: "Goals & Tasks",
};

/** What a new or edited note says and where it belongs. */
export interface NoteDraft {
  id?: string;
  body: string;
  guide_id: string | null;
  day_number: number | null;
  section: NoteSection | null;
}

// ---------------------------------------------------------------- Translate card hand-off

export const TRANSLATE_EVENT = "malchingu:translate";
/** Puts text into the Translate card (it translates it and scrolls into view). */
export function sendToTranslate(text: string) {
  window.dispatchEvent(new CustomEvent<string>(TRANSLATE_EVENT, { detail: text }));
}

// ---------------------------------------------------------------- right-click menu

interface NoteMenuControls { open: (e: MouseEvent, section: NoteSection) => void }
const NoteMenuContext = createContext<NoteMenuControls | null>(null);
export const useNoteMenu = () => useContext(NoteMenuContext);

type Menu = { x: number; y: number; section: NoteSection; selection: string };

/** Right-click inside a guide day's section: Add Note Here, and Copy or Translate what's selected.
 *  Shift + right-click keeps the browser's own menu. */
export function NoteMenuProvider({ onAddNote, children }: { onAddNote: (section: NoteSection) => void; children: ReactNode }) {
  const [menu, setMenu] = useState<Menu | null>(null);
  const add = useRef(onAddNote);
  add.current = onAddNote;
  const controls = useMemo<NoteMenuControls>(() => ({
    open: (e, section) => {
      if (e.shiftKey) return;
      e.preventDefault();
      // Screen positions are in zoomed pixels; the menu is placed in page pixels.
      const z = pageZoom();
      setMenu({ x: e.clientX / z, y: e.clientY / z, section, selection: window.getSelection()?.toString().trim() ?? "" });
    },
  }), []);
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const outside = (e: PointerEvent) => { if (!(e.target as Element | null)?.closest(".note-menu")) close(); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", key);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", key);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [menu]);
  const z = pageZoom();
  return (
    <NoteMenuContext.Provider value={controls}>
      {children}
      {menu && createPortal(
        <div className="note-menu" role="menu" aria-label="Section"
          style={{ left: Math.min(menu.x, window.innerWidth / z - 230), top: Math.min(menu.y, window.innerHeight / z - 170) }}>
          <button type="button" role="menuitem" autoFocus onClick={() => { setMenu(null); add.current(menu.section); }}>
            <Icon name="pencil" size={16} /> Add Note to {SECTION_LABEL[menu.section]}
          </button>
          <button type="button" role="menuitem" disabled={!menu.selection} onClick={() => { void copyText(menu.selection); setMenu(null); }}>
            <Icon name="copy" size={16} /> Copy
          </button>
          <button type="button" role="menuitem" disabled={!menu.selection} onClick={() => { sendToTranslate(menu.selection); setMenu(null); }}>
            <Icon name="swap" size={16} /> Translate
          </button>
          <span className="note-menu-hint">Shift + right-click for the browser's menu</span>
        </div>,
        document.body,
      )}
    </NoteMenuContext.Provider>
  );
}

// ---------------------------------------------------------------- floating Notes button

/** The round button at the bottom right: on Guides it opens your notes ("notes"); on My Notes, which already lists
 *  them, it starts a new one ("add"). */
export function NoteFab({ onClick, kind = "notes" }: { onClick: () => void; kind?: "notes" | "add" }) {
  const label = kind === "notes" ? "Open Notes" : "Add Note";
  return (
    <button type="button" className="fab" aria-label={label} title={label} onClick={onClick}>
      <Icon name={kind === "notes" ? "notes" : "pencil"} size={24} strokeWidth={2.2} />
    </button>
  );
}

// ---------------------------------------------------------------- Notes panel

const formatWhen = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

/** What a note being written says, keeping its guide, day and section only where they apply. */
const tidy = (draft: NoteDraft): NoteDraft => ({
  ...draft, body: draft.body.trim(),
  day_number: draft.guide_id ? draft.day_number : null,
  section: draft.guide_id && draft.day_number ? draft.section : null,
});

/** The Notes panel from the Notes button: your notes and saved translations (this guide's inside a guide, otherwise
 *  all of them), newest first, on two tabs (swipe between them on a phone), with + in the header for a new note. A note opens in the same panel, with ← back to the list; ✓ or Ctrl/⌘ + Enter saves it.
 *  On a desktop it floats above the button so the guide stays readable and scrollable; on a phone it's a sheet.
 *  `draft` is the note being written (null for the list). */
export function NotesPanel({ guideID, dayNumber, draft, setDraft, onClose, openAll, single }: {
  guideID: string | null; dayNumber: number | null; draft: NoteDraft | null;
  setDraft: (draft: NoteDraft | null) => void; onClose: () => void; openAll?: () => void;
  /** Opened from My Notes for one note: a modal with no ← (My Notes already lists them), closed by a click outside
   *  or Esc, and closed once saved. */
  single?: boolean;
}) {
  const store = useStore();
  const wide = useWide();
  const Frame = wide && !single ? FloatingPanel : Sheet;
  const titles = new Map(store.data.guides.map((g) => [g.id, g.title]));
  const notes = store.data.notes.filter((n) => (!guideID || n.guide_id === guideID))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const translations = store.data.savedTranslations.filter((t) => (!guideID || t.guide_id === guideID))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const [tab, setTab] = useState<"notes" | "translations">("notes");
  /** The note or translation waiting for Delete to be confirmed. */
  const [deleting, setDeleting] = useState<{ kind: "note" | "translation"; id: string } | null>(null);
  const swipe = useSwipe(() => setTab("notes"), () => setTab("translations"));
  // An edited note can be saved once something in it has changed; a new one once it says something.
  const saved = draft?.id ? store.data.notes.find((n) => n.id === draft.id) : undefined;
  const changed = !!draft && (!saved || (() => {
    const t = tidy(draft);
    return t.body !== saved.body || t.guide_id !== saved.guide_id || t.day_number !== saved.day_number || t.section !== saved.section;
  })());
  const canSave = !!draft && draft.body.trim().length > 0 && changed;
  const save = async () => {
    if (!draft || !canSave) return;
    if (single) onClose(); else setDraft(null);   // back to the list, where it shows up
    await store.saveNote(tidy(draft));
  };

  if (draft) {
    return (
      <Frame title={draft.id ? "Edit Note" : "New Note"} onClose={onClose}
        leading={single ? undefined : <RoundButton icon="chevronLeft" tint="glass" label="Back to Notes" onClick={() => setDraft(null)} size={36} />}
        trailing={<RoundButton icon="check" tint="green" label="Save Note" onClick={save} disabled={!canSave} size={36} />}>
        <NoteFields draft={draft} onChange={setDraft} onSave={save} />
      </Frame>
    );
  }
  const addNote = () => setDraft({ body: "", guide_id: guideID, day_number: guideID ? dayNumber : null, section: null });
  const tag = (guide: string | null, day: number | null, section: NoteSection | null, created: string) =>
    [noteTags(guideID ? null : guide ? titles.get(guide) ?? "Deleted guide" : null, day, section), formatWhen(created)].filter(Boolean).join(" · ");
  return (
    <Frame title="Notes" onClose={onClose} trailing={tab === "notes"
      ? <RoundButton icon="plus" tint="accent" label="Add Note" onClick={addNote} size={36} /> : undefined}>
      <Segmented label="Show" value={tab} onChange={setTab}
        options={[{ value: "notes", label: "Notes" }, { value: "translations", label: "Translations" }]} />
      {/* On a phone, a sideways swipe switches between Notes and Translations. */}
      <div className="swipe-area" {...swipe}>
        {tab === "notes" && (notes.length === 0 ? (
          <p className="muted center small">No notes yet</p>
        ) : (
          <div className="notes-list">
            {notes.map((n) => (
              <div key={n.id} className="glass card note-item note-row">
                <button type="button" className="note-open" aria-label={`Edit note: ${n.body.slice(0, 60)}`}
                  onClick={() => setDraft({ id: n.id, body: n.body, guide_id: n.guide_id, day_number: n.day_number, section: n.section })}>
                  <span className="note-body note-clamp"><KoreanText text={n.body} /></span>
                  <span className="small muted">{tag(n.guide_id, n.day_number, n.section, n.created_at)}</span>
                </button>
                <button type="button" className="icon-button bad" aria-label="Delete note" title="Delete Note"
                  onClick={() => setDeleting({ kind: "note", id: n.id })}>
                  <Icon name="trash" size={18} />
                </button>
              </div>
            ))}
          </div>
        ))}
        {tab === "translations" && (translations.length === 0 ? (
          <p className="muted center small">No translations yet</p>
        ) : (
          <div className="notes-list">
            {translations.map((t) => {
              const korean = t.source_lang === "ko" ? t.source : t.translation;
              return (
                <div key={t.id} className="glass card note-item">
                  <div className="translate-line">
                    <span className="saved-pair grow">
                      <span lang={t.source_lang} className="saved-source"><KoreanText text={t.source} /></span>
                      <span lang={t.source_lang === "ko" ? "en" : "ko"} className="saved-translation"><KoreanText text={t.translation} /></span>
                      <span className="small muted">{romanize(korean)}</span>
                    </span>
                    <span className="item-tools">
                      <button type="button" className="icon-button bad" aria-label="Delete translation" title="Delete Translation"
                        onClick={() => setDeleting({ kind: "translation", id: t.id })}>
                        <Icon name="trash" size={18} />
                      </button>
                      <SpeakButton text={korean} size={18} />
                    </span>
                  </div>
                  <span className="small muted">{tag(t.guide_id, t.day_number, null, t.created_at)}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {openAll && <button type="button" className="link small center" onClick={openAll}>All Notes and Translations</button>}
      {deleting && (
        <ConfirmDialog title={deleting.kind === "note" ? "Delete Note?" : "Delete Translation?"}
          message={deleting.kind === "note" ? "The note is deleted on every device." : "The saved translation is deleted on every device."}
          confirmLabel="Delete" onCancel={() => setDeleting(null)}
          onConfirm={() => {
            const gone = deleting;
            setDeleting(null);
            void (gone.kind === "note" ? store.deleteNote(gone.id) : store.deleteTranslation(gone.id));
          }} />
      )}
    </Frame>
  );
}

/** The note's text, and where it belongs: a guide, a day and a section (all optional). */
function NoteFields({ draft, onChange, onSave }: { draft: NoteDraft; onChange: (draft: NoteDraft) => void; onSave: () => void }) {
  const store = useStore();
  const guides = [...store.data.guides]
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const days = store.data.sessions.filter((s) => s.guide_id === draft.guide_id).map((s) => s.day_number).sort((a, b) => a - b);
  return (
    <>
      <Card>
        <textarea className="text-input text-area note-input" rows={6} value={draft.body} autoFocus aria-label="Note"
          placeholder="What do you want to remember?" onChange={(e) => onChange({ ...draft, body: e.target.value })}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onSave(); } }} />
      </Card>
      <Card>
        <SectionTitle>Where It Belongs</SectionTitle>
        <label className="form-row"><span>Guide</span>
          <select value={draft.guide_id ?? ""} onChange={(e) => onChange({ ...draft, guide_id: e.target.value || null, day_number: null, section: null })}>
            <option value="">None</option>
            {guides.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
          </select>
        </label>
        {draft.guide_id && (
          <label className="form-row"><span>Day</span>
            <select value={draft.day_number ?? ""}
              onChange={(e) => onChange({ ...draft, day_number: e.target.value ? Number(e.target.value) : null, section: e.target.value ? draft.section : null })}>
              <option value="">Whole Guide</option>
              {days.map((d) => <option key={d} value={d}>Day {d}</option>)}
            </select>
          </label>
        )}
        {draft.guide_id && draft.day_number && (
          <label className="form-row"><span>Section</span>
            <select value={draft.section ?? ""} onChange={(e) => onChange({ ...draft, section: (e.target.value || null) as NoteSection | null })}>
              <option value="">Whole Day</option>
              {(Object.keys(SECTION_LABEL) as NoteSection[]).map((s) => <option key={s} value={s}>{SECTION_LABEL[s]}</option>)}
            </select>
          </label>
        )}
      </Card>
    </>
  );
}

export function noteTags(guideTitle: string | null, day: number | null, section: NoteSection | null): string {
  return [guideTitle, day ? `Day ${day}` : null, section ? SECTION_LABEL[section] : null].filter(Boolean).join(" · ");
}

