import { Logo } from "../components/ui";
import { useStore } from "../lib/store";

/** Shown until the learner signs in. Everything they study is saved to their account. */
export function SignIn() {
  const { signInWithApple, error } = useStore();
  return (
    <div className="sign-in">
      <div className="sign-in-top">
        <Logo size={132} />
        <h1 className="brand">Malchingu</h1>
        <p className="lead">말친구 · your Korean talking buddy</p>
        <p className="muted measure">A word a day, flashcards that remember what you miss, and study guides built from your own notes.</p>
      </div>
      <div className="sign-in-bottom">
        <button type="button" className="apple-button" onClick={signInWithApple}>
          <svg width="18" height="22" viewBox="0 0 17 21" aria-hidden="true" fill="currentColor">
            <path d="M14.1 11.1c0-2.4 2-3.6 2.1-3.7-1.2-1.7-3-1.9-3.6-2-1.5-.2-3 .9-3.8.9-.8 0-2-.9-3.3-.9-1.7 0-3.3 1-4.2 2.5-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8 1.6 0 2 .8 3.4.8 1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9 0 0-2.8-1-2.9-4.2zM11.6 3.6c.7-.8 1.2-2 1-3.1-1 0-2.2.7-2.9 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.6 2.9-1.4z" />
          </svg>
          Sign in with Apple
        </button>
        {error && <p className="error small" role="alert">{error}</p>}
        <p className="muted small measure">Your words, streaks and guides are saved to your account and sync with the Malchingu app on your iPhone, iPad and Mac.</p>
      </div>
    </div>
  );
}
