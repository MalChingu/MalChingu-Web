import { useEffect, useState } from "react";

// Reads Korean aloud with the browser's built-in speech. Like the app, it only speaks
// when a real Korean voice is available, so the pronunciation is right.

function koreanVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
  return window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().replace("_", "-").startsWith("ko"));
}

/** Better-sounding voices first: Premium/Enhanced (Apple), then neural/online ones, then the rest. */
function rank(v: SpeechSynthesisVoice): number {
  const name = v.name.toLowerCase();
  if (name.includes("premium")) return 5;
  if (name.includes("enhanced")) return 4;
  if (name.includes("natural") || name.includes("neural")) return 3;
  if (name.includes("google") || name.includes("online")) return 2;
  return v.localService ? 1 : 0;
}

export function bestKoreanVoice(): SpeechSynthesisVoice | null {
  return koreanVoices().sort((a, b) => rank(b) - rank(a))[0] ?? null;
}

export function speak(text: string) {
  const voice = bestKoreanVoice();
  const trimmed = text.trim();
  if (!voice || !trimmed) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(trimmed);
  utterance.voice = voice;
  utterance.lang = voice.lang;
  utterance.rate = 0.85;   // a little slower, for learners
  window.speechSynthesis.speak(utterance);
}

/** The Korean voice in use, updating when the browser finishes loading its voices. */
export function useKoreanVoice(): SpeechSynthesisVoice | null {
  const [voice, setVoice] = useState(bestKoreanVoice);
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const update = () => setVoice(bestKoreanVoice());
    window.speechSynthesis.addEventListener("voiceschanged", update);
    update();
    return () => window.speechSynthesis.removeEventListener("voiceschanged", update);
  }, []);
  return voice;
}
