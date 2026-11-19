import { Fragment, useMemo, useState, type ReactNode } from "react";
import type { CheckItem } from "../core/models";
import { noteBlocks, type NoteBlock, type NoteSpan } from "../core/noteMarkup";
import { Icon, type IconName } from "./Icon";

const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힯]/;

function Spans({ spans }: { spans: NoteSpan[] }) {
  return (
    <>
      {spans.map((s, i) => {
        // Short key forms such as -았어요 stay on one line.
        if (s.kind === "bold") {
          const key = HANGUL.test(s.text);
          return <strong key={i} className={`${key ? "note-key" : ""} ${s.text.length <= 14 ? "nowrap" : ""}`.trim() || undefined}>{s.text}</strong>;
        }
        if (s.kind === "pron") return <span key={i} className="note-pron" title="Pronunciation">{s.text}</span>;
        return <Fragment key={i}>{s.text}</Fragment>;
      })}
    </>
  );
}

/** Runs of bullets or numbered items become one list. */
function renderBlocks(blocks: NoteBlock[]): ReactNode[] {
  const out: ReactNode[] = [];
  for (let i = 0; i < blocks.length;) {
    const block = blocks[i];
    if (block.kind === "bullet" || block.kind === "numbered") {
      const run: NoteBlock[] = [];
      while (i < blocks.length && blocks[i].kind === block.kind) run.push(blocks[i++]);
      const items = run.map((b, j) => <li key={j} value={b.number}><Spans spans={b.spans} /></li>);
      out.push(block.kind === "bullet"
        ? <ul key={out.length} className="note-list">{items}</ul>
        : <ol key={out.length} className="note-list">{items}</ol>);
      continue;
    }
    out.push(block.kind === "heading"
      ? <h4 key={out.length} className="note-heading"><Spans spans={block.spans} /></h4>
      : <p key={out.length} className="note-p"><Spans spans={block.spans} /></p>);
    i++;
  }
  return out;
}

/** A guide day's section: an icon and title that open and close it, the section's own actions, and an
 *  arrow at the right that turns down when it opens. Closed by default; the content slides open. */
export function GuideSection({ icon, title, actions, children }: {
  icon: IconName; title: string; actions?: (open: boolean) => ReactNode; children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const toggle = () => setOpen(!open);
  return (
    <section className="guide-section top-rule">
      <div className="row">
        <button type="button" className="section-toggle grow" aria-expanded={open} onClick={toggle}>
          <Icon name={icon} size={18} className="accent" />
          <strong className="section-label">{title}</strong>
        </button>
        {actions?.(open)}
        {/* The title is the keyboard stop; the arrow is a second, larger target for the pointer. */}
        <button type="button" className="chev-button" tabIndex={-1} aria-hidden="true" onClick={toggle}>
          <Icon name="chevron" size={18} className={`chev ${open ? "open" : ""}`} />
        </button>
      </div>
      <div className={`collapsible ${open ? "open" : ""}`} inert={!open}>
        <div>{children}</div>
      </div>
    </section>
  );
}

/** The day's notes from Claude, formatted from their simple Markdown. */
export function GuideNotes({ text }: { text: string }) {
  const blocks = useMemo(() => noteBlocks(text), [text]);
  return (
    <GuideSection icon="book" title="Notes">
      <div className="notes-panel">{renderBlocks(blocks)}</div>
    </GuideSection>
  );
}

/** Quick questions on the notes; each answer stays hidden until its row is tapped. */
export function CheckYourself({ items }: { items: CheckItem[] }) {
  const [shown, setShown] = useState<ReadonlySet<number>>(new Set());
  const all = shown.size === items.length;
  const toggle = (i: number) => {
    const next = new Set(shown);
    if (next.has(i)) next.delete(i); else next.add(i);
    setShown(next);
  };
  return (
    <GuideSection icon="question" title={`Check Yourself · ${items.length}`} actions={(open) => open && (
      <button type="button" className="link small" onClick={() => setShown(all ? new Set() : new Set(items.map((_, i) => i)))}>
        {all ? "Hide All" : "Show All"}
      </button>
    )}>
      <div className="check-list">
        {items.map((item, i) => {
          const open = shown.has(i);
          return (
            <button key={i} type="button" className={`check-row ${open ? "open" : ""}`} aria-expanded={open} onClick={() => toggle(i)}>
              <span className="check-q"><span className="check-n">{i + 1}</span>{item.question}</span>
              {open
                ? <span className="check-a">{item.answer}</span>
                : <span className="check-hint">Tap to Show Answer</span>}
            </button>
          );
        })}
      </div>
    </GuideSection>
  );
}
