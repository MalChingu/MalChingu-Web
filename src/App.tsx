import { useEffect, useState } from "react";
import type { Word } from "./core/models";
import { Icon, type IconName } from "./components/Icon";
import { useStore } from "./lib/store";
import { Flashcards, Round } from "./pages/Flashcards";
import { Guides } from "./pages/Guides";
import { Profile } from "./pages/Profile";
import { SignIn } from "./pages/SignIn";
import { Stats } from "./pages/Stats";
import { Today } from "./pages/Today";
import { WordSheet } from "./pages/WordSheet";

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

export function App() {
  const store = useStore();
  const [tab, setTab] = useState<Tab>(tabFromHash);
  const [guideID, setGuideID] = useState<string | null>(null);
  const [practice, setPractice] = useState<Word[] | null>(null);

  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const go = (next: Tab) => {
    setTab(next);
    setPractice(null);
    if (next !== "guides") setGuideID(null);
    if (window.location.hash !== `#${next}`) history.replaceState(null, "", `#${next}`);
    window.scrollTo({ top: 0 });
  };

  if (!store.ready) return <div className="app-background loading-screen" aria-busy="true" />;
  if (!store.session) return <div className="app-background"><SignIn /></div>;

  return (
    <div className="app-background app">
      <nav className="tabs glass" aria-label="Sections">
        <div className="tabs-brand"><img src="/logo.svg" alt="" width={32} height={32} /> Malchingu</div>
        {TABS.map((t) => (
          <button key={t.id} type="button" className={`tab ${tab === t.id ? "on" : ""}`} aria-current={tab === t.id ? "page" : undefined}
            onClick={() => go(t.id)}>
            <Icon name={t.icon} size={22} />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
      <main className="main">
        {practice ? <Round words={practice} onClose={() => setPractice(null)} />
          : tab === "today" ? <Today openGuide={(id) => { go("guides"); setGuideID(id); }} />
          : tab === "flashcards" ? <Flashcards />
          : tab === "guides" ? <Guides openGuideID={guideID} setOpenGuideID={setGuideID} practice={setPractice} />
          : tab === "stats" ? <Stats />
          : <Profile />}
      </main>
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
