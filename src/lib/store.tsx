import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { CustomWordRow, GuideSessionRow, GuideTaskRow, StudyGuideRow, Word } from "../core/models";
import { computeStats, emptyDay, emptyProgress, estimateLevel, recordOnDay, recordOnWord,
  type Answer, type StudyDay, type WordProgress } from "../core/progress";
import { giveUp, newQuiz, revealHint, submit, isFinished, type Outcome, type QuizSession } from "../core/quiz";
import { activeCustomWords, BUILT_IN, builtInWord } from "../core/wordBank";
import { dayString, wordOfDay } from "../core/wordOfDay";
import { readSettings, settingsPatch, type RawSettings, type Settings } from "./settings";
import { CONNECTOR_BASE_URL, supabase } from "./supabase";

// App state for a signed-in learner: everything is read from and written straight to Supabase,
// the same tables the iPhone/Mac app syncs with.

interface Data {
  settingsRaw: RawSettings;
  customWords: CustomWordRow[];
  progress: WordProgress[];
  studyDays: StudyDay[];
  guides: StudyGuideRow[];
  sessions: GuideSessionRow[];
  tasks: GuideTaskRow[];
  hasConnectorToken: boolean;
}

const EMPTY: Data = { settingsRaw: {}, customWords: [], progress: [], studyDays: [], guides: [], sessions: [], tasks: [],
  hasConnectorToken: false };

async function selectAll<T>(table: string, order: string): Promise<T[]> {
  const rows: T[] = [];
  for (;;) {
    const { data, error } = await supabase.from(table).select("*").order(order).range(rows.length, rows.length + 999);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) return rows;
  }
}

const now = () => new Date().toISOString();

function quizKey(userID: string, day: string) {
  return `malchingu.dailyQuiz.${userID}.${day}`;
}

interface Store {
  session: Session | null;
  ready: boolean;
  loading: boolean;
  error: string | null;
  setError: (message: string | null) => void;
  data: Data;
  settings: Settings;
  myWords: CustomWordRow[];
  allWords: Word[];
  findWord: (id: string) => Word | null;
  progressFor: (wordID: string) => WordProgress | undefined;
  progressMap: Map<string, WordProgress>;
  stats: ReturnType<typeof computeStats>;
  level: ReturnType<typeof estimateLevel>;
  wordOfTheDay: Word | null;
  dailyQuiz: QuizSession | null;
  submitDaily: (answer: string) => Outcome;
  giveUpDaily: () => void;
  revealDailyHint: (index: number) => void;
  record: (wordID: string, answer: Answer) => Promise<void>;
  refresh: () => Promise<void>;
  updateSettings: (change: Partial<Settings>) => Promise<void>;
  deleteWord: (row: CustomWordRow) => Promise<void>;
  setTaskDone: (task: GuideTaskRow, done: boolean) => Promise<void>;
  deleteGuide: (guide: StudyGuideRow) => Promise<void>;
  connectorURL: string | null;
  createConnectorLink: () => Promise<void>;
  revokeConnectorLink: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
  openWord: (word: Word, quiz?: boolean) => void;
  openedWord: { word: Word; quiz: boolean } | null;
  closeWord: () => void;
}

const StoreContext = createContext<Store | null>(null);

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore outside StoreProvider");
  return store;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Data>(EMPTY);
  const [today, setToday] = useState(dayString());
  const [quiz, setQuiz] = useState<QuizSession | null>(null);
  const [openedWord, setOpenedWord] = useState<{ word: Word; quiz: boolean } | null>(null);
  const [connectorKey, setConnectorKey] = useState<string | null>(null);
  const userID = session?.user.id ?? null;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { setSession(session); setReady(true); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    // A new day brings a new word.
    const timer = window.setInterval(() => setToday(dayString()), 60_000);
    return () => { subscription.unsubscribe(); window.clearInterval(timer); };
  }, []);

  const refresh = useCallback(async () => {
    if (!userID) return;
    setLoading(true);
    try {
      const [profiles, customWords, progress, studyDays, guides, sessions, tasks, tokens] = await Promise.all([
        selectAll<{ settings: RawSettings }>("profiles", "user_id"),
        selectAll<CustomWordRow>("custom_words", "id"),
        selectAll<WordProgress>("word_progress", "word_id"),
        selectAll<StudyDay>("study_days", "day"),
        selectAll<StudyGuideRow>("study_guides", "id"),
        selectAll<GuideSessionRow>("guide_sessions", "id"),
        selectAll<GuideTaskRow>("guide_tasks", "id"),
        selectAll<{ user_id: string }>("connector_tokens", "user_id"),
      ]);
      setData({ settingsRaw: profiles[0]?.settings ?? {}, customWords, progress, studyDays, guides, sessions, tasks,
        hasConnectorToken: tokens.length > 0 });
      setError(null);
    } catch (e) {
      setError(`Couldn't load your data: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [userID]);

  useEffect(() => {
    if (!userID) { setData(EMPTY); return; }
    setConnectorKey(localStorage.getItem(`malchingu.connectorKey.${userID}`));
    refresh();
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [userID, refresh]);

  const settings = useMemo(() => readSettings(data.settingsRaw), [data.settingsRaw]);
  const myWordsList = useMemo(() => activeCustomWords(data.customWords), [data.customWords]);
  const myWords = useMemo(() => data.customWords.filter((r) => !r.deleted_at)
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)), [data.customWords]);
  const allWords = useMemo(() => [...BUILT_IN, ...myWordsList], [myWordsList]);
  const findWord = useCallback((id: string) => builtInWord(id) ?? myWordsList.find((w) => w.id === id.toLowerCase()) ?? null,
    [myWordsList]);
  const progressMap = useMemo(() => new Map(data.progress.map((p) => [p.word_id, p])), [data.progress]);
  const stats = useMemo(() => computeStats(data.progress, data.studyDays, today), [data.progress, data.studyDays, today]);
  const level = useMemo(() => estimateLevel(data.progress), [data.progress]);

  const wordOfTheDay = useMemo(() => {
    const pool = settings.includeMyWords ? [...BUILT_IN, ...myWordsList] : BUILT_IN;
    return wordOfDay(today, pool, settings.wordTypes) ?? wordOfDay(today, BUILT_IN);
  }, [today, settings.includeMyWords, settings.wordTypes, myWordsList]);

  // Today's quiz, kept in this browser so revealed hints and the result stay for the day.
  useEffect(() => {
    if (!userID || !wordOfTheDay) { setQuiz(null); return; }
    try {
      const saved = JSON.parse(localStorage.getItem(quizKey(userID, today)) ?? "null") as QuizSession | null;
      setQuiz(saved && saved.word.id === wordOfTheDay.id ? saved : newQuiz(wordOfTheDay));
    } catch {
      setQuiz(newQuiz(wordOfTheDay));
    }
  }, [userID, today, wordOfTheDay]);

  /** Record one answer. The rows are re-read first so answers given on another device aren't overwritten. */
  const record = useCallback(async (wordID: string, answer: Answer) => {
    if (!userID) return;
    const stamp = now();
    const day = dayString();
    try {
      const [{ data: wp }, { data: sd }] = await Promise.all([
        supabase.from("word_progress").select("*").eq("word_id", wordID).maybeSingle(),
        supabase.from("study_days").select("*").eq("day", day).maybeSingle(),
      ]);
      const progress = recordOnWord((wp as WordProgress | null) ?? emptyProgress(wordID, stamp), answer, stamp);
      const studyDay = recordOnDay((sd as StudyDay | null) ?? emptyDay(day, stamp), answer, stamp);
      setData((d) => ({
        ...d,
        progress: [...d.progress.filter((p) => p.word_id !== wordID), progress],
        studyDays: [...d.studyDays.filter((s) => s.day !== day), studyDay],
      }));
      const [a, b] = await Promise.all([
        supabase.from("word_progress").upsert({ ...progress, user_id: userID }, { onConflict: "user_id,word_id" }),
        supabase.from("study_days").upsert({ ...studyDay, user_id: userID }, { onConflict: "user_id,day" }),
      ]);
      if (a.error || b.error) throw new Error((a.error ?? b.error)!.message);
    } catch (e) {
      setError(`Couldn't save your answer: ${(e as Error).message}`);
    }
  }, [userID]);

  const saveQuiz = useCallback((next: QuizSession, previous: QuizSession) => {
    setQuiz(next);
    if (userID) localStorage.setItem(quizKey(userID, today), JSON.stringify(next));
    if (isFinished(next) && !isFinished(previous)) {
      record(next.word.id, {
        correct: next.state === "solved", source: "quiz",
        gaveUp: next.state === "failed" && next.mistakes < 3, hints: next.revealedHints.length,
      });
    }
  }, [userID, today, record]);

  const submitDaily = useCallback((answer: string): Outcome => {
    if (!quiz) return { kind: "ignored" };
    const [next, outcome] = submit(quiz, answer);
    saveQuiz(next, quiz);
    return outcome;
  }, [quiz, saveQuiz]);
  const giveUpDaily = useCallback(() => { if (quiz) saveQuiz(giveUp(quiz), quiz); }, [quiz, saveQuiz]);
  const revealDailyHint = useCallback((i: number) => { if (quiz) saveQuiz(revealHint(quiz, i), quiz); }, [quiz, saveQuiz]);

  const updateSettings = useCallback(async (change: Partial<Settings>) => {
    if (!userID) return;
    const merged = { ...data.settingsRaw, ...settingsPatch(change, data.settingsRaw), updated_at: now() };
    setData((d) => ({ ...d, settingsRaw: merged }));
    const { error } = await supabase.from("profiles")
      .upsert({ user_id: userID, settings: merged, updated_at: merged.updated_at }, { onConflict: "user_id" });
    if (error) setError(`Couldn't save settings: ${error.message}`);
  }, [userID, data.settingsRaw]);

  const deleteWord = useCallback(async (row: CustomWordRow) => {
    const stamp = now();
    setData((d) => ({ ...d, customWords: d.customWords.map((w) => w.id === row.id ? { ...w, deleted_at: stamp, updated_at: stamp } : w) }));
    const { error } = await supabase.from("custom_words").update({ deleted_at: stamp, updated_at: stamp }).eq("id", row.id);
    if (error) setError(`Couldn't delete the word: ${error.message}`);
  }, []);

  const setTaskDone = useCallback(async (task: GuideTaskRow, done: boolean) => {
    const stamp = now();
    setData((d) => ({ ...d, tasks: d.tasks.map((t) => t.id === task.id ? { ...t, done, updated_at: stamp } : t) }));
    const { error } = await supabase.from("guide_tasks").update({ done, updated_at: stamp }).eq("id", task.id);
    if (error) setError(`Couldn't update the task: ${error.message}`);
  }, []);

  const deleteGuide = useCallback(async (guide: StudyGuideRow) => {
    const stamp = now();
    setData((d) => ({ ...d, guides: d.guides.map((g) => g.id === guide.id ? { ...g, deleted_at: stamp, updated_at: stamp } : g) }));
    const { error } = await supabase.from("study_guides").update({ deleted_at: stamp, updated_at: stamp }).eq("id", guide.id);
    if (error) setError(`Couldn't delete the guide: ${error.message}`);
  }, []);

  const createConnectorLink = useCallback(async () => {
    if (!userID) return;
    const { data: key, error } = await supabase.rpc("rotate_connector_token");
    if (error || typeof key !== "string") { setError(`Couldn't create the connector link: ${error?.message ?? "no key"}`); return; }
    localStorage.setItem(`malchingu.connectorKey.${userID}`, key);
    setConnectorKey(key);
    setData((d) => ({ ...d, hasConnectorToken: true }));
  }, [userID]);

  const revokeConnectorLink = useCallback(async () => {
    if (!userID) return;
    const { error } = await supabase.from("connector_tokens").delete().eq("user_id", userID);
    if (error) { setError(`Couldn't turn off the connector: ${error.message}`); return; }
    localStorage.removeItem(`malchingu.connectorKey.${userID}`);
    setConnectorKey(null);
    setData((d) => ({ ...d, hasConnectorToken: false }));
  }, [userID]);

  const signInWithApple = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "apple",
      options: { redirectTo: window.location.origin, scopes: "name email" },
    });
    if (error) setError(`Sign-in failed: ${error.message}`);
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setData(EMPTY);
    setConnectorKey(null);
  }, []);

  const store: Store = {
    session, ready, loading, error, setError, data, settings, myWords, allWords, findWord,
    progressFor: (id) => progressMap.get(id), progressMap, stats, level, wordOfTheDay,
    dailyQuiz: quiz, submitDaily, giveUpDaily, revealDailyHint, record, refresh, updateSettings, deleteWord,
    setTaskDone, deleteGuide,
    connectorURL: connectorKey ? `${CONNECTOR_BASE_URL}?key=${connectorKey}` : null,
    createConnectorLink, revokeConnectorLink, signInWithApple, signOut,
    openWord: (word, quizMode = false) => setOpenedWord({ word, quiz: quizMode }),
    openedWord, closeWord: () => setOpenedWord(null),
  };
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}
