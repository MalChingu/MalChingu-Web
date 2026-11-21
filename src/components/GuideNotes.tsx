import { createContext, Fragment, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cleanForm, gloss } from "../core/gloss";
import type { CheckItem, NoteSection, Word } from "../core/models";
import { saidRight } from "../core/koreanWords";
import { selectingIn } from "../pages/Today";
import { KoreanText, koreanToSay, MicButton, heardNothing } from "./KoreanText";
import type { Heard } from "../lib/listen";
import { useNoteMenu } from "./NoteMenu";
import { noteBlocks, type NoteBlock, type NoteSpan } from "../core/noteMarkup";
import { romanize } from "../core/romanizer";
import { activeCustomWords, BUILT_IN } from "../core/wordBank";
import { useStore } from "../lib/store";
import { pageZoom } from "../lib/zoom";
import { canTranslate, translate } from "../lib/translator";
import { Icon, type IconName } from "./Icon";
import { SpeakButton } from "./ui";

const HANGUL = /[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF]/;

/** The learner's words for explanations: guide words and My Words first, then the built-in ones. */
export function useKnownWords(): Word[] {
  const { data } = useStore();
  return useMemo(() => [...activeCustomWords(data.customWords), ...BUILT_IN], [data.customWords]);
}

interface Tip { form: string; rect: DOMRect; pinned: boolean }
interface TipControls { hover: (form: string, el: HTMLElement) => void; leave: () => void; toggle: (form: string, el: HTMLElement) => void }
const TipContext = createContext<TipControls | null>(null);

function Spans({ spans }: { spans: NoteSpan[] }) {
  const tips = useContext(TipContext);
  return (
    <>
      {spans.map((s, i) => {
        if (s.kind === "bold") {
          // Short key forms such as -았어요 stay on one line.
          const wrap = s.text.length <= 14 ? "nowrap" : "";
          if (!HANGUL.test(s.text) || !tips) return <strong key={i} className={wrap || undefined}>{s.text}</strong>;
          // Purple Korean: hover, focus or tap shows what it means.
          return (
            // An inline span acting as a button, so the text around it wraps naturally.
            <strong key={i} role="button" tabIndex={0} lang="ko" className={`note-key ${wrap}`} aria-describedby="gloss-tip"
              onMouseEnter={(e) => tips.hover(s.text, e.currentTarget)} onMouseLeave={tips.leave}
              onFocus={(e) => tips.hover(s.text, e.currentTarget)} onBlur={tips.leave}
              onClick={(e) => tips.toggle(s.text, e.currentTarget)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tips.toggle(s.text, e.currentTarget); } }}>
              <KoreanText text={s.text} />
            </strong>
          );
        }
        if (s.kind === "pron") return <span key={i} className="note-pron" title="Pronunciation">{s.text}</span>;
        return <Fragment key={i}><KoreanText text={s.text} /></Fragment>;
      })}
    </>
  );
}

/** Whether the browser can translate: null while it's checking. */
export function useTranslator(from: "ko" | "en", to: "ko" | "en"): boolean | null {
  const [ready, setReady] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    void canTranslate(from, to).then((ok) => { if (live) setReady(ok); });
    return () => { live = false; };
  }, [from, to]);
  return ready;
}

/** What a purple form means: from the learner's words first, else the browser's translator. */
function GlossTip({ tip, words, keep, leave }: { tip: Tip; words: Word[]; keep: () => void; leave: () => void }) {
  const known = useMemo(() => gloss(tip.form, words), [tip.form, words]);
  const [translation, setTranslation] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "pending" | "failed">("idle");
  const ready = useTranslator("ko", "en");
  const form = known?.form ?? cleanForm(tip.form);
  const spoken = form.replace(/^-/, "");
  // Above the word, or below it near the top of the window; kept inside the window sideways. With Text Size above
  // 100% the page is zoomed: the word's screen position is divided by the zoom to place the (zoomed) popup.
  const z = pageZoom();
  const rect = { top: tip.rect.top / z, bottom: tip.rect.bottom / z, left: tip.rect.left / z, width: tip.rect.width / z };
  const width = window.innerWidth / z;
  const below = rect.top < 150;
  const half = Math.min(150, width / 2 - 16);
  const x = Math.min(Math.max(rect.left + rect.width / 2, half + 16), width - half - 16);
  const run = async () => {
    setState("pending");
    const result = await translate(spoken, "ko", "en");
    setTranslation(result);
    setState(result ? "idle" : "failed");
  };
  return createPortal(
    <div id="gloss-tip" role="tooltip" className={`gloss-tip ${below ? "below" : ""}`} onMouseEnter={keep} onMouseLeave={leave}
      style={{ left: x, top: below ? rect.bottom + 8 : rect.top - 8 }}>
      <div className="row gloss-head">
        <strong lang="ko" className="gloss-form grow">{form}</strong>
        <SpeakButton text={spoken} size={18} />
      </div>
      <span className="small muted">{known?.romanization ?? romanize(spoken)}</span>
      {known && <span className="gloss-meaning">{known.meaning}</span>}
      {!known && translation && <span className="gloss-meaning">{translation}</span>}
      {!known && !translation && (
        <>
          <span className="small muted">Not in your words.</span>
          {ready === false && <span className="small muted">Translations work in Chrome or Edge on a computer.</span>}
          {ready === true && state === "idle" && <button type="button" className="link small gloss-translate" onClick={run}>Translate</button>}
          {state === "pending" && <span className="small muted">Translating…</span>}
          {state === "failed" && <span className="small muted">Couldn't translate this.</span>}
        </>
      )}
    </div>,
    document.body,
  );
}

/** Shows one explanation at a time for the purple forms inside it. Hovering shows it; a click or tap
 *  keeps it until you click elsewhere, press Escape or scroll. */
function GlossTips({ children }: { children: ReactNode }) {
  const words = useKnownWords();
  const [tip, setTip] = useState<Tip | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const keep = () => window.clearTimeout(timer.current);
  const leave = () => {
    keep();
    timer.current = window.setTimeout(() => setTip((t) => (t?.pinned ? t : null)), 180);
  };
  const controls = useMemo<TipControls>(() => ({
    hover: (form, el) => { window.clearTimeout(timer.current); setTip((t) => (t?.pinned ? t : { form, rect: el.getBoundingClientRect(), pinned: false })); },
    leave,
    toggle: (form, el) => setTip((t) => (t?.pinned && t.form === form ? null : { form, rect: el.getBoundingClientRect(), pinned: true })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);
  useEffect(() => {
    if (!tip) return;
    const close = () => setTip(null);
    const outside = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (!target?.closest(".gloss-tip, .note-key")) close();
    };
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
  }, [tip]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <TipContext.Provider value={controls}>
      {children}
      {tip && <GlossTip key={tip.form} tip={tip} words={words} keep={keep} leave={leave} />}
    </TipContext.Provider>
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
export function GuideSection({ icon, title, actions, below, section, children }: {
  icon: IconName; title: string; actions?: (open: boolean) => ReactNode;
  /** Always shown under the header, open or closed (Vocabulary's flashcard buttons). */
  below?: ReactNode;
  /** Which part of the day it is, for "Add Note Here" on right-click. */
  section?: NoteSection;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const toggle = () => setOpen(!open);
  const menu = useNoteMenu();
  return (
    <section className="guide-section top-rule" onContextMenu={section && menu ? (e) => menu.open(e, section) : undefined}>
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
      {below}
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
    <GuideSection icon="book" title="Notes" section="notes">
      <GlossTips><div className="notes-panel">{renderBlocks(blocks)}</div></GlossTips>
    </GuideSection>
  );
}

/** Quick questions on the notes; each answer stays hidden until its row is tapped, or until it's said right. */
export function CheckYourself({ items }: { items: CheckItem[] }) {
  const [shown, setShown] = useState<ReadonlySet<number>>(new Set());
  const all = shown.size === items.length;
  const set = (i: number, open: boolean) => {
    const next = new Set(shown);
    if (open) next.add(i); else next.delete(i);
    setShown(next);
  };
  return (
    <GuideSection icon="question" title={`Check Yourself · ${items.length}`} section="check" actions={(open) => open && (
      <button type="button" className="link small" onClick={() => setShown(all ? new Set() : new Set(items.map((_, i) => i)))}>
        {all ? "Hide All" : "Show All"}
      </button>
    )}>
      <div className="check-list">
        {items.map((item, i) => (
          <CheckRow key={i} n={i + 1} item={item} open={shown.has(i)} setOpen={(open) => set(i, open)} />
        ))}
      </div>
    </GuideSection>
  );
}

type Said = { text: string; right: boolean } | { problem: string };

/** One question. Clicking the row shows or hides the answer (dragging selects the text instead); 🎤 checks a
 *  spoken answer without opening it (an answer can have two parts), and 🔊 reads the answer aloud. */
function CheckRow({ n, item, open, setOpen }: { n: number; item: CheckItem; open: boolean; setOpen: (open: boolean) => void }) {
  const [said, setSaid] = useState<Said | null>(null);
  const onHeard = (heard: Heard) => {
    const right = heard.said.find((s) => saidRight(s, item.answer));
    if (right) setSaid({ text: right, right: true });
    else if (heard.said[0]) setSaid({ text: heard.said[0], right: false });
    else setSaid({ problem: heardNothing(heard) });
  };
  return (
    <div className={`check-row ${open ? "open" : ""}`} onClick={(e) => { if (!selectingIn(e.currentTarget)) setOpen(!open); }}>
      <div className="check-q">
        <span className="check-n">{n}</span>
        <span className="check-text"><KoreanText text={item.question} /></span>
        <MicButton lang="ko-KR" label="Say Your Answer" size={18} onHeard={onHeard} />
      </div>
      {said && ("problem" in said
        ? <span className="check-said muted">{said.problem}</span>
        : <span className={`check-said ${said.right ? "good" : "bad"}`}>
            {said.right ? "✓ You said " : "You said "}<span lang="ko">“{said.text}”</span>{said.right ? "" : " · not quite. Tap to see the answer."}
          </span>)}
      {open ? (
        <div className="check-a">
          <span className="grow"><KoreanText text={item.answer} /></span>
          <span onClick={(e) => e.stopPropagation()}><SpeakButton text={koreanToSay(item.answer)} size={18} /></span>
        </div>
      ) : (
        <button type="button" className="check-hint" aria-expanded={false} onClick={(e) => { e.stopPropagation(); setOpen(true); }}>
          Tap to Show Answer
        </button>
      )}
    </div>
  );
}
