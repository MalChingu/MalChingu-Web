import { useEffect, useRef, type ReactNode, useLayoutEffect } from "react";
import { posLabel, type DisplayMode, type Example, type PartOfSpeech, type Word } from "../core/models";
import { attempts, isMastered, type WordProgress } from "../core/progress";
import { displayRomanization, romanize } from "../core/romanizer";
import { speak, useKoreanVoice } from "../lib/speech";
import { Icon, type IconName } from "./Icon";


export function Card({ children, className = "", padding = 18 }: { children: ReactNode; className?: string; padding?: number }) {
  return <div className={`glass card ${className}`} style={{ padding }}>{children}</div>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <div className="section-title">{children}</div>;
}

export function PosTag({ pos }: { pos: PartOfSpeech }) {
  return <span className="pos-tag">{posLabel[pos].toUpperCase()}</span>;
}

/** The Korean side of a word, honouring the Korean / Romanization / Both setting. */
export function KoreanHeadline({ word, mode = "both", size = 52 }: { word: Word; mode?: DisplayMode; size?: number }) {
  return (
    <div className="headline">
      {mode !== "romanization" && <div className="headline-hangul" style={{ fontSize: size }} lang="ko">{word.hangul}</div>}
      {mode !== "korean" && (
        <div className={mode === "romanization" ? "headline-hangul" : "headline-roman"}
          style={mode === "romanization" ? { fontSize: size * 0.8 } : undefined}>
          {displayRomanization(word)}
        </div>
      )}
    </div>
  );
}

/** A speaker icon that reads Korean aloud. Hidden when the browser has no Korean voice. */
export function SpeakButton({ text, size = 20 }: { text: string; size?: number }) {
  const voice = useKoreanVoice();
  if (!voice) return null;
  return (
    <button type="button" className="icon-button" aria-label="Listen" onClick={(e) => { e.stopPropagation(); speak(text); }}>
      <Icon name="speaker" size={size} />
    </button>
  );
}

/** One example sentence. `showEnglish` is off when it's used as a quiz hint. */
export function ExampleView({ example, showEnglish = true }: { example: Example; showEnglish?: boolean }) {
  return (
    <div className="example">
      <div className="example-text">
        <div className="example-korean" lang="ko">{example.korean}</div>
        <div className="muted">{example.romanization || romanize(example.korean)}</div>
        {showEnglish && <div>{example.english}</div>}
      </div>
      <SpeakButton text={example.korean} />
    </div>
  );
}

export function WordRow({ word, progress, onClick }: { word: Word; progress?: WordProgress; onClick?: () => void }) {
  return (
    <button type="button" className="word-row" onClick={onClick}>
      <span className="word-row-left">
        <span className="word-row-hangul" lang="ko">{word.hangul}</span>
        <span className="muted small">{displayRomanization(word)}</span>
      </span>
      <span className="word-row-right">
        <span className="word-row-meaning">{word.meanings[0]}</span>
        {progress && attempts(progress) > 0 && (
          <span className={`small ${isMastered(progress) ? "good" : "muted"}`} aria-label={`Streak ${progress.streak}`}>
            <Icon name={isMastered(progress) ? "seal" : "flame"} size={13} /> {progress.streak}
          </span>
        )}
      </span>
    </button>
  );
}

/** `tone` colours the icon (e.g. "orange", "red"); the accent colour when left out. */
export function StatTile({ title, value, icon, tone = "accent" }: { title: string; value: string; icon: IconName; tone?: string }) {
  return (
    <div className="glass card stat-tile">
      <Icon name={icon} size={22} className={`tone-${tone}`} />
      <div className="stat-value">{value}</div>
      <div className="muted small">{title}</div>
    </div>
  );
}

type ButtonKind = "prominent" | "glass" | "danger";

export function Button({ children, icon, kind = "glass", onClick, disabled, full, type = "button", large }: {
  children: ReactNode; icon?: IconName; kind?: ButtonKind; onClick?: () => void; disabled?: boolean; full?: boolean;
  type?: "button" | "submit"; large?: boolean;
}) {
  return (
    <button type={type} className={`button ${kind} ${full ? "full" : ""} ${large ? "large" : ""}`} onClick={onClick} disabled={disabled}>
      {icon && <Icon name={icon} size={18} />}
      <span>{children}</span>
    </button>
  );
}

/** Round button: red X, green check, accent arrow. */
export function RoundButton({ icon, tint, label, onClick, disabled, size = 44 }: {
  icon: IconName; tint: "red" | "green" | "accent" | "glass"; label: string; onClick: () => void; disabled?: boolean; size?: number;
}) {
  return (
    <button type="button" className={`round-button ${tint}`} style={{ width: size, height: size }} aria-label={label}
      title={label} onClick={onClick} disabled={disabled}>
      <Icon name={icon} size={size * 0.42} strokeWidth={2.6} />
    </button>
  );
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="row toggle-row">
      <span>{label}</span>
      <input type="checkbox" role="switch" className="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

/** A modal sheet: centred on wide screens, sliding up from the bottom on phones. */
export function Sheet({ title, onClose, children, trailing }: {
  title: string; onClose: () => void; children: ReactNode; trailing?: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  // Runs once per opening (not on every re-render), so typing in the sheet doesn't replay its setup.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close.current(); };
    window.addEventListener("keydown", onKey);
    panel.current?.focus({ preventScroll: true });
    const { overflow, paddingRight } = document.body.style;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;   // no jump when the scrollbar hides
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = paddingRight;
    };
  }, []);
  return (
    <div className="sheet-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={panel}>
        <div className="sheet-header">
          <RoundButton icon="x" tint="glass" label="Close" onClick={onClose} size={36} />
          <h2>{title}</h2>
          <div className="sheet-trailing">{trailing}</div>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

/** A row of options where one is chosen (the selected one is light with dark text in both themes). */
export function Segmented<T extends string>({ options, value, onChange, label }: {
  options: { value: T; label: string }[]; value: T; onChange: (value: T) => void; label: string;
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} className={value === o.value ? "on" : ""}
          onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

export function Stepper({ onMinus, onPlus, minusLabel, plusLabel, minusDisabled, plusDisabled }: {
  onMinus: () => void; onPlus: () => void; minusLabel: string; plusLabel: string; minusDisabled?: boolean; plusDisabled?: boolean;
}) {
  return (
    <div className="stepper">
      <button type="button" aria-label={minusLabel} disabled={minusDisabled} onClick={onMinus}><Icon name="minus" size={18} /></button>
      <button type="button" aria-label={plusLabel} disabled={plusDisabled} onClick={onPlus}><Icon name="plus" size={18} /></button>
    </div>
  );
}

/** A screen. `back` puts a round back button on the title line; long titles get a smaller size. */
export function Page({ title, children, actions, centered, back }: {
  title: string; children: ReactNode; actions?: ReactNode; centered?: boolean; back?: { label: string; onClick: () => void };
}) {
  return (
    <div className="page">
      <header className={`page-header ${centered ? "centered" : ""}`}>
        {back && <RoundButton icon="chevronLeft" tint="glass" label={back.label} onClick={back.onClick} size={40} />}
        <FitTitle text={title} />
        {actions && <div className="page-actions">{actions}</div>}
      </header>
      <div className="page-content">{children}</div>
    </div>
  );
}

/** A page title that wraps onto at most two lines and shrinks (down to half size) rather than being cut off. */
function FitTitle({ text }: { text: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => {
    const h1 = ref.current;
    if (!h1) return;
    const fit = () => {
      h1.style.fontSize = "";
      const base = parseFloat(getComputedStyle(h1).fontSize);
      const twoLines = () => h1.scrollHeight <= parseFloat(getComputedStyle(h1).lineHeight) * 2 + 2 && h1.scrollWidth <= h1.clientWidth;
      for (let step = 19; step >= 10 && !twoLines(); step--) h1.style.fontSize = `${(base * step) / 20}px`;
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(h1.parentElement ?? h1);
    return () => observer.disconnect();
  }, [text]);
  return <h1 ref={ref} className="fit-title">{text}</h1>;
}

/** A small centred question with Cancel and a confirm button, used before anything is deleted or replaced. */
export function ConfirmDialog({ title, message, confirmLabel, destructive = true, onConfirm, onCancel }: {
  title: string; message: string; confirmLabel: string; destructive?: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  const cancel = useRef<HTMLButtonElement>(null);
  const close = useRef(onCancel);
  close.current = onCancel;
  useEffect(() => {
    cancel.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close.current(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <div className="sheet-backdrop confirm-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="confirm" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message">
        <h2 id="confirm-title">{title}</h2>
        <p id="confirm-message" className="muted">{message}</p>
        <div className="confirm-buttons">
          <button ref={cancel} type="button" className="button full" onClick={onCancel}>Cancel</button>
          <button type="button" className={`button full ${destructive ? "destructive" : "prominent"}`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

export function Logo({ size = 120 }: { size?: number }) {
  return <img src="/logo.svg" width={size} height={size} alt="" className="logo" />;
}

export function Steps({ steps }: { steps: { title?: string; text: string }[] }) {
  return (
    <ol className="steps">
      {steps.map((s, i) => (
        <li key={i}>
          <span className="step-number">{i + 1}</span>
          <span>{s.title && <strong>{s.title}<br /></strong>}<span className={s.title ? "muted" : ""}>{s.text}</span></span>
        </li>
      ))}
    </ol>
  );
}

export function copyText(text: string) {
  return navigator.clipboard?.writeText(text).catch(() => undefined);
}
