import { useRef, useState } from "react";
import { isAvatarPreset, pickAvatarPreset } from "../core/avatars";
import { normalizeUsername } from "../core/friends";
import { NAME_REFUSED, nameAllowed } from "../core/names";
import { useStore } from "../lib/store";
import { AvatarImage, AvatarPicker } from "./Avatar";
import { useUsernameCheck, useUsernameSuggestion, UsernameStatus } from "./Friends";
import { Icon } from "./Icon";
import { Button, Logo, RoundButton } from "./ui";

/** First sign-in: your name, a username (for good) and one of the preset pictures (one is picked for you).
 *  Shown until the account has a username. */
export function Onboarding({ onDone }: { onDone: () => void }) {
  const store = useStore();
  const [step, setStep] = useState(0);
  // Empty to start: you type your name in.
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const typed = useRef(false);
  const suggestion = useUsernameSuggestion(name, typed.current || step !== 1);
  const shown = typed.current ? handle : handle || suggestion;
  const check = useUsernameCheck(shown);
  const nameOK = name.trim().length > 0 && nameAllowed(name);
  // A preset to start: a first sign-in has no photo of its own yet (uploading one is for Pro accounts).
  const [avatar, setAvatar] = useState<string>(() =>
    isAvatarPreset(store.settings.profile.avatar) ? store.settings.profile.avatar : pickAvatarPreset());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finish = async () => {
    setSaving(true);
    setError(null);
    await store.updateSettings({ profile: { ...store.settings.profile, name: name.trim(), avatar } });
    const failed = await store.setUsername(shown);
    setSaving(false);
    if (failed) { setError(failed); setStep(1); return; }
    onDone();
  };

  return (
    <div className="onboarding app-background" role="dialog" aria-modal="true" aria-label="Set Up Your Profile">
      {/* On the page itself, no card. */}
      <div className="onboarding-card">
        {/* Back: an arrow at the top left, from the second step on. */}
        {step > 0 && (
          <span className="onboarding-back">
            <RoundButton icon="chevronLeft" tint="glass" label="Back" size={38} onClick={() => { setError(null); setStep(step - 1); }} />
          </span>
        )}
        <Logo size={64} blink="loop" />
        <div className="onboarding-dots" aria-label={`Step ${step + 1} of 3`}>
          {[0, 1, 2].map((i) => <span key={i} className={i === step ? "on" : i < step ? "done" : ""} />)}
        </div>

        {step === 0 && (
          <form className="stack onboarding-step" onSubmit={(e) => { e.preventDefault(); if (nameOK) setStep(1); }}>
            <h1 className="onboarding-title">Welcome to Korimal</h1>
            <p className="muted center">What should we call you?</p>
            <input className="text-input sheet-input" value={name} aria-label="Your name" placeholder="Your Name" autoFocus maxLength={80}
              onChange={(e) => setName(e.target.value)} />
            {nameAllowed(name)
              ? <p className="small muted center">Friends see your name. You can change it later in Profile.</p>
              : <p className="small error center" role="alert">{NAME_REFUSED}</p>}
            <Button type="submit" kind="prominent" full large disabled={!nameOK}>Continue</Button>
          </form>
        )}

        {step === 1 && (
          <form className="stack onboarding-step"
            onSubmit={(e) => { e.preventDefault(); if (check === "free" || check === "unknown") setStep(2); }}>
            <h1 className="onboarding-title">Choose a Username</h1>
            <p className="muted center">Friends find you by it.</p>
            <label className="username-field">
              <span className="muted" aria-hidden="true">@</span>
              <input value={shown} aria-label="Username" autoFocus maxLength={21} autoCapitalize="off" autoCorrect="off" spellCheck={false}
                placeholder="username" onChange={(e) => { typed.current = true; setHandle(normalizeUsername(e.target.value)); setError(null); }} />
            </label>
            <UsernameStatus state={check} />
            <p className="small caption-note"><Icon name="lock" size={14} /> This cannot be changed later.</p>
            {error && <p className="error small" role="alert">{error}</p>}
            <Button type="submit" kind="prominent" full large disabled={!(check === "free" || check === "unknown")}>Continue</Button>
          </form>
        )}

        {step === 2 && (
          <div className="stack onboarding-step">
            <h1 className="onboarding-title">Choose a Picture</h1>
            <p className="muted center">Friends see it next to your name. You can change it later in Profile.</p>
            <div className="onboarding-avatar"><AvatarImage className="avatar" avatar={avatar} size={120} /></div>
            <AvatarPicker value={avatar} onChange={setAvatar} canUpload={store.plan === "pro"} />
            {error && <p className="error small" role="alert">{error}</p>}
            <Button kind="prominent" full large disabled={saving} onClick={finish}>{saving ? "Saving…" : "Start Learning"}</Button>
          </div>
        )}
      </div>
    </div>
  );
}

export type TourTab = "today" | "flashcards" | "guides" | "stats";

const TOUR: { tab: TourTab; title: string; text: string }[] = [
  { tab: "today", title: "Today", text: "Your word of the day to guess, with hints if you need them, and today's tasks from your study guides." },
  { tab: "flashcards", title: "Flashcards", text: "Quick rounds of built-in words and My Words: the meaning, or the past form of verbs. Swipe right to answer." },
  { tab: "guides", title: "Guides", text: "Day-by-day study plans that Claude builds from your tutor's notes, with notes, Check Yourself and vocabulary." },
  { tab: "stats", title: "Stats", text: "Your streak, accuracy, right, wrong and didn't-know answers, and your best streaks." },
];

/** A short first-time tour: each of the four pages in turn, with a sentence about it. */
export function Tour({ go, onDone }: { go: (tab: TourTab) => void; onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const step = TOUR[index];
  const last = index === TOUR.length - 1;
  const move = (next: number) => { setIndex(next); go(TOUR[next].tab); };
  return (
    <div className="tour" role="dialog" aria-label={`Tour: ${step.title}`}>
      <div className="tour-card glass">
        <div className="row">
          <span className="small muted grow">{index + 1} of {TOUR.length}</span>
          <button type="button" className="link small" onClick={onDone}>Skip Tour</button>
        </div>
        <h2 className="tour-title">{step.title}</h2>
        <p>{step.text}</p>
        <div className="button-pair">
          <Button full disabled={index === 0} onClick={() => move(index - 1)}>Back</Button>
          <Button kind="prominent" full onClick={() => (last ? onDone() : move(index + 1))}>{last ? "Done" : "Next"}</Button>
        </div>
      </div>
    </div>
  );
}
