import { useEffect, useRef, type ReactNode } from "react";
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

export function StatTile({ title, value, icon }: { title: string; value: string; icon: IconName }) {
  return (
    <div className="glass card stat-tile">
      <Icon name={icon} size={22} className="accent" />
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
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    panel.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = previous; };
  }, [onClose]);
  return (
    <div className="sheet-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet app-background" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={panel}>
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

export function Page({ title, children, actions, centered }: {
  title: string; children: ReactNode; actions?: ReactNode; centered?: boolean;
}) {
  return (
    <div className="page">
      <header className={`page-header ${centered ? "centered" : ""}`}>
        <h1>{title}</h1>
        {actions && <div className="page-actions">{actions}</div>}
      </header>
      <div className="page-content">{children}</div>
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
