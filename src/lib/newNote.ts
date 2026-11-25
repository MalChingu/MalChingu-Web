// The new-note shortcut: Alt+N anywhere (Option+N on a Mac). Ctrl+N and ⌘N work too where the browser lets a page have
// them, such as Korimal installed as an app; in a normal tab the browser keeps them for a new window.

export const NEW_NOTE_EVENT = "korimal:new-note";

let pending = false;

/** Asks for a new note: straight away when Guides is showing, otherwise once it opens. */
export function requestNewNote(guidesShowing: boolean): void {
  if (guidesShowing) window.dispatchEvent(new Event(NEW_NOTE_EVENT));
  else pending = true;
}

/** Whether a new note was asked for before Guides opened (and forgets it). */
export function takePendingNewNote(): boolean {
  const was = pending;
  pending = false;
  return was;
}

export function isNewNoteShortcut(e: KeyboardEvent): boolean {
  if (e.code !== "KeyN" || e.shiftKey || e.repeat) return false;
  return (e.altKey && !e.ctrlKey && !e.metaKey) || ((e.ctrlKey || e.metaKey) && !e.altKey);
}

/** Typing in a field, or a dialog is open: the shortcut is left alone. */
export function shortcutBlocked(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null;
  const typing = !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
  return typing || document.querySelector('[aria-modal="true"]') !== null;
}
