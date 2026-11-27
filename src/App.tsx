import { useEffect, useRef, useState } from "react";
import { nextZoom, useCompact, useZoom } from "./lib/zoom";
import { isNewNoteShortcut, requestNewNote, shortcutBlocked } from "./lib/newNote";
import type { Word } from "./core/models";
import { Icon, type IconName } from "./components/Icon";
import { LoadingSpinner, Logo, RoundButton } from "./components/ui";
import { useStore } from "./lib/store";
import { Flashcards, Round, type PracticeMode } from "./pages/Flashcards";
import { Guides } from "./pages/Guides";
import { Profile } from "./pages/Profile";
import { ProBadge, UpgradeButton } from "./components/Plan";
import { UpgradeModal } from "./components/UpgradeModal";
import { CheckoutReturn } from "./components/CheckoutReturn";
import { AvatarImage } from "./components/Avatar";
import { SignIn } from "./pages/SignIn";
import { Stats } from "./pages/Stats";
import { Today } from "./pages/Today";
import { WordSheet } from "./pages/WordSheet";
import { Onboarding, Tour } from "./components/Onboarding";

type Tab = "today" | "flashcards" | "guides" | "stats" | "profile";
const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: "today", label: "Today", icon: "sun" },
  { id: "flashcards", label: "Flashcards", icon: "cards" },
  { id: "guides", label: "Guides", icon: "book" },
  { id: "stats", label: "Stats", icon: "chart" },
  { id: "profile", label: "Profile", icon: "person" },
];

const tabFromHash = (): Tab => {
  const hash = window.location.hash.replace("#", "") as Tab;
  return TABS.some((t) => t.id === hash) ? hash : "today";
};

/** Bottom of the sidebar on wide screens: one button that steps the page through 100%, 150% and 200%, for big,
 *  sharp monitors. */
function TextSize() {
  const [zoom, setZoom] = useZoom();
  const next = nextZoom(zoom);
  return (
    <button type="button" className="tab text-size" onClick={() => setZoom(next)}
      aria-label={`Text Size ${zoom * 100}%. Change to ${next * 100}%`} title={`Change to ${next * 100}%`}>
      <Icon name="textSize" size={22} />
      <span>Text Size</span>
      <span className="text-size-value">{zoom * 100}%</span>
    </button>
  );
}

export function App() {
  const store = useStore();
  const [tab, setTab] = useState<Tab>(tabFromHash);
  const [guideID, setGuideID] = useState<string | null>(null);
  // Flashcards started from a guide: they come back to it.
  const [practice, setPractice] = useState<{ words: Word[]; mode: PracticeMode } | null>(null);
  // Zoomed in on a laptop-sized window: the sidebar is a drawer, opened from ☰.
  const compact = useCompact();
  const [drawer, setDrawer] = useState(false);
  useEffect(() => { if (!compact) setDrawer(false); }, [compact]);
  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setDrawer(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawer]);

  // The first-time tour, once, right after onboarding.
  const [touring, setTouring] = useState(false);
  const endTour = () => {
    setTouring(false);
    if (!store.settings.tourDone) store.updateSettings({ tourDone: true });
    go("today");
  };

  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const go = (next: Tab) => {
    setTab(next);
    setPractice(null);
    setDrawer(false);
    if (next !== "guides") setGuideID(null);
    if (window.location.hash !== `#${next}`) history.replaceState(null, "", `#${next}`);
    window.scrollTo({ top: 0 });
  };

  // Alt+N (or Ctrl/⌘+N where the browser allows it): a new note, from anywhere. Guides holds the notes.
  const goRef = useRef(go);
  goRef.current = go;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isNewNoteShortcut(e) || shortcutBlocked(e) || !store.session) return;
      e.preventDefault();
      const onGuides = tab === "guides" && !practice;
      requestNewNote(onGuides);
      if (!onGuides) goRef.current("guides");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tab, practice, store.session]);

  if (!store.ready) return <div className="app-background loading-screen" aria-busy="true" />;
  if (!store.session) return <div className="app-background"><SignIn /></div>;
  // Signed in, but whether the account still needs setting up isn't known yet (or it does, and its data is still on its
  // way): wait here instead of showing the app for a moment first. A check that fails (offline) falls back to the app.
  if ((store.username === undefined && !store.friendsLoaded) || (store.username === null && !store.loaded)) {
    return <div className="app-background loading-screen checking-setup" aria-busy="true"><LoadingSpinner /></div>;
  }
  // First sign-in: name, username and picture before anything else.
  if (store.loaded && store.username === null) {
    return <Onboarding onDone={() => { setTouring(true); go("today"); }} />;
  }

  return (
    <div className="app-background app">
      {compact && (
        <div className="compact-bar">
          <span className="menu-button">
            <RoundButton icon="menu" tint="glass" label="Menu" onClick={() => setDrawer(true)} size={40} />
            {store.friendsWaiting > 0 && <span className="tab-dot" />}
          </span>
          <Logo size={30} blink="hover" className="brand-logo" /> <span className="compact-brand">Korimal</span>
        </div>
      )}
      {drawer && <div className="drawer-backdrop" onMouseDown={() => setDrawer(false)} />}
      <nav className={`tabs glass ${drawer ? "open" : ""}`} aria-label="Sections" aria-hidden={compact && !drawer ? true : undefined}
        inert={compact && !drawer ? true : undefined}>
        <div className="tabs-brand"><Logo size={32} blink="hover" className="brand-logo" /> Korimal</div>
        {TABS.map((t) => (
          <button key={t.id} type="button"
            className={`tab ${tab === t.id ? "on" : ""} ${t.id === "profile" ? `profile-tab level-${store.level}` : ""}`} aria-current={tab === t.id ? "page" : undefined}
            onClick={() => go(t.id)}>
            <span className="tab-icon">
              {t.id === "profile" && store.settings.profile.avatar
                ? <AvatarImage className="tab-avatar" avatar={store.settings.profile.avatar} size={22} />
                : <Icon name={t.icon} size={22} />}
              {/* A friend request or a challenge is waiting. */}
              {t.id === "profile" && store.friendsWaiting > 0 && <span className="tab-dot" aria-label="Something from a friend is waiting" />}
            </span>
            <span>{t.label}</span>
          </button>
        ))}
        {/* The plan sits at the bottom, above Text Size: a Pro badge, or Upgrade to Pro. */}
        {store.plan && <div className="tabs-plan">{store.plan === "pro" ? <ProBadge /> : <UpgradeButton />}</div>}
        <TextSize />
      </nav>
      {/* A Flashcard Duel covers the whole app until it's finished or left, so it's played (and scored) once. */}
      {store.duel && (
        <div className="duel-screen app-background">
          <Round key={store.duel.id} words={store.duel.words} duel={store.duel} doneLabel="Back to Friends" onClose={store.endDuel} />
        </div>
      )}
      <main className="main" aria-hidden={store.duel ? true : undefined}>
        {practice ? <Round words={practice.words} mode={practice.mode} doneLabel="Back to Guide" onClose={() => setPractice(null)} />
          : tab === "today" ? <Today openGuide={(id) => { go("guides"); setGuideID(id); }} />
          : tab === "flashcards" ? <Flashcards />
          : tab === "guides" ? <Guides openGuideID={guideID} setOpenGuideID={setGuideID} practice={(words, mode) => setPractice({ words, mode })} />
          : tab === "stats" ? <Stats />
          : <Profile />}
      </main>
      {touring && <Tour go={go} onDone={endTour} />}
      <UpgradeModal />
      {/* Back from Stripe's checkout: Welcome to Korimal Pro. */}
      <CheckoutReturn />
      {store.openedWord && (
        <WordSheet key={store.openedWord.word.id} word={store.openedWord.word} startInQuiz={store.openedWord.quiz} onClose={store.closeWord} />
      )}
      {store.error && tab !== "profile" && (
        <div className="toast" role="alert">
          <span>{store.error}</span>
          <button type="button" className="icon-button" aria-label="Dismiss" onClick={() => store.setError(null)}><Icon name="x" size={16} /></button>
        </div>
      )}
    </div>
  );
}
