import { createContext, useContext, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { NoteSection } from "../core/models";
import { useStore } from "../lib/store";
import { pageZoom } from "../lib/zoom";
import { Icon } from "./Icon";
import { Card, RoundButton, SectionTitle, Sheet, copyText } from "./ui";

export const SECTION_LABEL: Record<NoteSection, string> = {
  notes: "Notes", check: "Check Yourself", vocabulary: "Vocabulary", tasks: "Tasks",
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

// ---------------------------------------------------------------- floating Note button

export function NoteFab({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="fab" aria-label="Add Note" title="Add Note" onClick={onClick}>
      <Icon name="pencil" size={24} strokeWidth={2.4} />
    </button>
  );
}

// ---------------------------------------------------------------- note sheet

/** Writing a note, tagged with a guide, a day and a section (all optional). ✓ or Ctrl/⌘ + Enter saves. */
export function NoteSheet({ draft, onClose }: { draft: NoteDraft; onClose: () => void }) {
  const store = useStore();
  const [body, setBody] = useState(draft.body);
  const [guideID, setGuideID] = useState(draft.guide_id);
  const [day, setDay] = useState(draft.day_number);
  const [section, setSection] = useState(draft.section);
  const guides = store.data.guides.filter((g) => !g.deleted_at || g.id === guideID)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const days = store.data.sessions.filter((s) => s.guide_id === guideID).map((s) => s.day_number).sort((a, b) => a - b);
  const canSave = body.trim().length > 0;
  const save = async () => {
    if (!canSave) return;
    onClose();
    await store.saveNote({
      id: draft.id, body: body.trim(), guide_id: guideID,
      day_number: guideID ? day : null, section: guideID && day ? section : null,
    });
  };
  return (
    <Sheet title={draft.id ? "Edit Note" : "New Note"} onClose={onClose}
      trailing={<RoundButton icon="check" tint="green" label="Save Note" onClick={save} disabled={!canSave} size={36} />}>
      <Card>
        <textarea className="text-input text-area note-input" rows={6} value={body} autoFocus aria-label="Note"
          placeholder="What do you want to remember?" onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void save(); } }} />
      </Card>
      <Card>
        <SectionTitle>Where It Belongs</SectionTitle>
        <label className="form-row"><span>Guide</span>
          <select value={guideID ?? ""} onChange={(e) => { setGuideID(e.target.value || null); setDay(null); setSection(null); }}>
            <option value="">None</option>
            {guides.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
          </select>
        </label>
        {guideID && (
          <label className="form-row"><span>Day</span>
            <select value={day ?? ""} onChange={(e) => { setDay(e.target.value ? Number(e.target.value) : null); if (!e.target.value) setSection(null); }}>
              <option value="">Whole Guide</option>
              {days.map((d) => <option key={d} value={d}>Day {d}</option>)}
            </select>
          </label>
        )}
        {guideID && day && (
          <label className="form-row"><span>Section</span>
            <select value={section ?? ""} onChange={(e) => setSection((e.target.value || null) as NoteSection | null)}>
              <option value="">Whole Day</option>
              {(Object.keys(SECTION_LABEL) as NoteSection[]).map((s) => <option key={s} value={s}>{SECTION_LABEL[s]}</option>)}
            </select>
          </label>
        )}
      </Card>
    </Sheet>
  );
}

/** "Jihoo Lessons · Day 2 · Check Yourself" */
export function noteTags(guideTitle: string | null, day: number | null, section: NoteSection | null): string {
  return [guideTitle, day ? `Day ${day}` : null, section ? SECTION_LABEL[section] : null].filter(Boolean).join(" · ");
}

