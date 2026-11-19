// Listening through the browser's own speech recogniser (Chrome, Edge and Safari; free). Firefox has none,
// so the microphone buttons don't show there.

interface RecognitionResultList { [index: number]: { length: number; [alt: number]: { transcript: string } }; length: number }
interface Recognition {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: { results: RecognitionResultList }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

const Recognizer = (): (new () => Recognition) | undefined => {
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};

export const canListen = () => Recognizer() !== undefined;

export type Heard = { said: string[]; error?: string };

/** Listens until the person stops talking. `said` holds the recogniser's guesses, best first (empty if it heard
 *  nothing); `error` is set when the microphone wasn't allowed. */
export function listenOnce(lang: "ko-KR" | "en-US"): { heard: Promise<Heard>; stop: () => void } {
  const R = Recognizer();
  if (!R) return { heard: Promise.resolve({ said: [], error: "unsupported" }), stop: () => {} };
  const recognition = new R();
  recognition.lang = lang;
  recognition.interimResults = false;
  recognition.maxAlternatives = 5;
  recognition.continuous = false;
  const heard = new Promise<Heard>((resolve) => {
    let said: string[] = [];
    let error: string | undefined;
    recognition.onresult = (event) => {
      const best = event.results[0];
      said = Array.from({ length: best?.length ?? 0 }, (_, i) => best[i].transcript.trim()).filter(Boolean);
    };
    recognition.onerror = (event) => { error = event.error; };
    recognition.onend = () => resolve({ said, error });
  });
  try {
    recognition.start();
  } catch {
    return { heard: Promise.resolve({ said: [], error: "busy" }), stop: () => {} };
  }
  return { heard, stop: () => recognition.stop() };
}

/** What to tell the person when nothing usable came back. */
export function heardNothing(h: Heard): string {
  if (h.error === "not-allowed" || h.error === "service-not-allowed") return "Allow the microphone for this site to use this.";
  return "Didn't catch that. Try again a little closer to the microphone.";
}
