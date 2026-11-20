import { useEffect, useState } from "react";
import { Logo } from "../components/ui";
import { useStore } from "../lib/store";

/** What Malchingu does, typed out one at a time on the home page. */
const FEATURES = ["Word of the Day", "Flashcards", "Study Guides", "Notes", "Translator", "Voice Mode"];

/** Types each phrase, holds it, backspaces it, then types the next, round and round. With reduced motion on, the
 *  phrases simply change every two seconds. */
function useTypewriter(phrases: string[]): string {
  const [text, setText] = useState("");
  useEffect(() => {
    const reduced = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let phrase = 0;
    let shown = 0;
    let erasing = false;
    let timer = 0;
    const step = () => {
      const word = phrases[phrase];
      if (reduced) {
        setText(word);
        phrase = (phrase + 1) % phrases.length;
        timer = window.setTimeout(step, 2000);
        return;
      }
      if (!erasing) {
        shown += 1;
        setText(word.slice(0, shown));
        if (shown === word.length) { erasing = true; timer = window.setTimeout(step, 1400); return; }
        timer = window.setTimeout(step, 85);
      } else {
        shown -= 1;
        setText(word.slice(0, shown));
        if (shown === 0) { erasing = false; phrase = (phrase + 1) % phrases.length; timer = window.setTimeout(step, 350); return; }
        timer = window.setTimeout(step, 40);
      }
    };
    timer = window.setTimeout(step, 400);
    return () => window.clearTimeout(timer);
  }, [phrases]);
  return text;
}

/** The home page, shown until the learner signs in. Everything they study is saved to their account. */
export function SignIn() {
  const { signInWithApple, error } = useStore();
  const typed = useTypewriter(FEATURES);
  return (
    <div className="sign-in">
      <div className="sign-in-main">
        <div className="sign-in-top">
          <Logo size={132} />
          <h1 className="brand">Malchingu</h1>
          <p className="lead korean-name" lang="ko">말친구</p>
          <p className="lead">Your Korean Talking Buddy</p>
          <p className="typed" aria-label={FEATURES.join(", ")}>
            <span aria-hidden="true">{typed}</span><span className="caret" aria-hidden="true" />
          </p>
        </div>
        <div className="sign-in-bottom">
          <button type="button" className="apple-button" onClick={signInWithApple}>
            <svg width="18" height="22" viewBox="0 0 17 21" aria-hidden="true" fill="currentColor">
              <path d="M14.1 11.1c0-2.4 2-3.6 2.1-3.7-1.2-1.7-3-1.9-3.6-2-1.5-.2-3 .9-3.8.9-.8 0-2-.9-3.3-.9-1.7 0-3.3 1-4.2 2.5-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8 1.6 0 2 .8 3.4.8 1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9 0 0-2.8-1-2.9-4.2zM11.6 3.6c.7-.8 1.2-2 1-3.1-1 0-2.2.7-2.9 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.6 2.9-1.4z" />
            </svg>
            Sign in with Apple
          </button>
          {error && <p className="error small" role="alert">{error}</p>}
          <p className="muted small measure legal-consent">
            By signing up, you agree to our <a href="/terms">Terms of Service</a> and <a href="/privacy">Privacy Policy</a>.
          </p>
        </div>
      </div>
      {/* © on the left (this year), the Terms and Privacy Policy on the right. */}
      <footer className="home-footer">
        <span>© {new Date().getFullYear()} RezPoint Inc.</span>
        <nav className="home-footer-links" aria-label="Legal">
          <a href="/terms">Terms of Service</a>
          <a href="/privacy">Privacy Policy</a>
        </nav>
      </footer>
    </div>
  );
}
