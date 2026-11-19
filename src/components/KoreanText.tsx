import { useState, type ReactNode } from "react";
import { koreanWordGaps } from "../core/koreanWords";
import { canListen, heardNothing, listenOnce, type Heard } from "../lib/listen";
import { Icon } from "./Icon";

/** Text with a faint dot in the gaps between Korean words (주말에 · 뭐 · 했어요?). The dot is drawn by CSS, so
 *  it isn't part of the text: copying gives plain spaces. */
export function KoreanText({ text }: { text: string }) {
  const gaps = koreanWordGaps(text);
  if (gaps.length === 0) return <>{text}</>;
  const parts: ReactNode[] = [];
  let from = 0;
  gaps.forEach((gap, i) => {
    parts.push(text.slice(from, gap), <span key={i} className="kw-gap"> </span>);
    from = gap + 1;
  });
  parts.push(text.slice(from));
  return <>{parts}</>;
}

/** Only the Korean in an answer, for reading it aloud: "갔어요 (gasseoyo)" → "갔어요". */
export function koreanToSay(text: string): string {
  const plain = text.replace(/\([^)]*\)/g, " ").replace(/\[[^\]]*\]/g, " ");
  const runs = plain.match(/[ᄀ-ᇿ㄰-㆏가-힯][ᄀ-ᇿ㄰-㆏가-힯\s.,?!…~]*/g) ?? [];
  return runs.map((r) => r.trim()).filter(Boolean).join(", ");
}

/** A microphone button: listens once and hands back what was heard. Hidden where the browser can't listen. */
export function MicButton({ lang, label, onHeard, size = 20 }: {
  lang: "ko-KR" | "en-US"; label: string; onHeard: (heard: Heard) => void; size?: number;
}) {
  const [listening, setListening] = useState<{ stop: () => void } | null>(null);
  if (!canListen()) return null;
  const start = async () => {
    if (listening) { listening.stop(); return; }
    const session = listenOnce(lang);
    setListening(session);
    const heard = await session.heard;
    setListening(null);
    onHeard(heard);
  };
  return (
    <button type="button" className={`icon-button mic ${listening ? "listening" : ""}`} aria-label={listening ? "Stop listening" : label}
      title={listening ? "Listening… tap to stop" : label} aria-pressed={!!listening}
      onClick={(e) => { e.stopPropagation(); void start(); }}>
      <Icon name="mic" size={size} />
    </button>
  );
}

export { heardNothing };
