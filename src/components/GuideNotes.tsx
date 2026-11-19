import { Fragment, useMemo, useState, type ReactNode } from "react";
import type { CheckItem } from "../core/models";
import { noteBlocks, type NoteBlock, type NoteSpan } from "../core/noteMarkup";
import { Icon } from "./Icon";

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

/** The day's notes from Claude: open by default, formatted from their simple Markdown. */
export function GuideNotes({ text }: { text: string }) {
  const [open, setOpen] = useState(true);
  const blocks = useMemo(() => noteBlocks(text), [text]);
  return (
    <section className="guide-section top-rule">
      <button type="button" className="section-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Icon name="book" size={18} className="accent" />
        <strong className="grow">Notes</strong>
        <Icon name="chevron" size={16} className={`chev ${open ? "open" : ""}`} />
      </button>
      {open && <div className="notes-panel">{renderBlocks(blocks)}</div>}
    </section>
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
    <section className="guide-section top-rule">
      <div className="row">
        <Icon name="question" size={18} className="accent" />
        <strong className="grow section-label">Check Yourself · {items.length}</strong>
        <button type="button" className="link small" onClick={() => setShown(all ? new Set() : new Set(items.map((_, i) => i)))}>
          {all ? "Hide All" : "Show All"}
        </button>
      </div>
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
    </section>
  );
}
