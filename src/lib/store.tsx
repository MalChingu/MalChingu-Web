import { achievementProgress, earnedAchievements, type Achievement } from "../core/achievements";
import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
  /** The account's connector key, shared by every device. Null for links made before keys were shared. */
  connectorToken: string | null;
  /** Today's word-of-the-day quiz, shared with the app so hints and the result match on every device. */
  dailyQuiz: DailyQuizRow | null;
}

/** A row of `daily_quiz`. */
interface DailyQuizRow {
  day: string;
  word_id: string;
  state: QuizSession["state"];
  mistakes: number;
  revealed_hints: number[];
  recorded: boolean;
  updated_at: string;
}

const EMPTY: Data = { settingsRaw: {}, customWords: [], progress: [], studyDays: [], guides: [], sessions: [], tasks: [],
  hasConnectorToken: false, connectorToken: null, dailyQuiz: null };

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
  /** Titles earned so far (see core/achievements). */
  earned: Achievement[];
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
  const [openedWord, setOpenedWord] = useState<{ word: Word; quiz: boolean } | null>(null);
  const [connectorKey, setConnectorKey] = useState<string | null>(null);
  const userID = session?.user.id ?? null;
  /** When each part of the data was last changed on this page, so a load already in flight can't undo it. */
  const editedAt = useRef<Partial<Record<keyof Data, number>>>({});
  const edit = (...keys: (keyof Data)[]) => { const t = performance.now(); keys.forEach((k) => { editedAt.current[k] = t; }); };

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
    const started = performance.now();
    try {
      const [profiles, customWords, progress, studyDays, guides, sessions, tasks, tokens, quizzes] = await Promise.all([
        selectAll<{ settings: RawSettings }>("profiles", "user_id"),
        selectAll<CustomWordRow>("custom_words", "id"),
        selectAll<WordProgress>("word_progress", "word_id"),
        selectAll<StudyDay>("study_days", "day"),
        selectAll<StudyGuideRow>("study_guides", "id"),
        selectAll<GuideSessionRow>("guide_sessions", "id"),
        selectAll<GuideTaskRow>("guide_tasks", "id"),
        selectAll<{ user_id: string; token: string | null }>("connector_tokens", "user_id"),
        supabase.from("daily_quiz").select("*").eq("day", dayString()).then(({ data, error }) => {
          if (error) throw new Error(error.message);
          return (data ?? []) as DailyQuizRow[];
        }),
      ]);
      const loaded: Data = { settingsRaw: profiles[0]?.settings ?? {}, customWords, progress, studyDays, guides, sessions, tasks,
        hasConnectorToken: tokens.length > 0, connectorToken: tokens[0]?.token ?? null, dailyQuiz: quizzes[0] ?? null };
      // Keep anything edited here after this load started; the server copy is older than the edit.
      setData((current) => {
        const next = { ...loaded };
        for (const key of Object.keys(editedAt.current) as (keyof Data)[]) {
          if ((editedAt.current[key] ?? 0) > started) (next as Record<keyof Data, unknown>)[key] = current[key];
        }
        return next;
      });
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
    // Pick up changes made on other devices (e.g. today's quiz on the phone): on return to the
    // page, and every minute while it's visible.
    const onFocus = () => refresh();
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") refresh(); }, 60_000);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [userID, refresh]);

  const settings = useMemo(() => readSettings(data.settingsRaw), [data.settingsRaw]);
  const myWordsList = useMemo(() => activeCustomWords(data.customWords), [data.customWords]);
  const myWords = useMemo(() => data.customWords.filter((r) => !r.deleted_at)
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)), [data.customWords]);
  const allWords = useMemo(() => [...BUILT_IN, ...myWordsList], [myWordsList]);
  const findWord = useCallback((id: string) => builtInWord(id) ?? myWordsList.find((w) => w.id === id.toLowerCase()) ?? null,
    [myWordsList]);
  const progressMap = useMemo(() => new Map(data.progress.map((p) => [p.word_id, p])), [data.progress]);
  const earned = useMemo(() => {
    const guidesCompleted = data.guides.filter((g) => {
      const tasks = data.tasks.filter((t) => t.guide_id === g.id);
      return !g.deleted_at && tasks.length > 0 && tasks.every((t) => t.done);
    }).length;
    return earnedAchievements(achievementProgress({ progress: data.progress, days: data.studyDays, today,
      myWords: data.customWords.filter((w) => !w.deleted_at).length, guidesCompleted,
      tasksDone: data.tasks.filter((t) => t.done).length }));
  }, [data.guides, data.tasks, data.progress, data.studyDays, data.customWords, today]);
  const stats = useMemo(() => computeStats(data.progress, data.studyDays, today), [data.progress, data.studyDays, today]);
  const level = useMemo(() => estimateLevel(data.progress), [data.progress]);

  const wordOfTheDay = useMemo(() => {
    const pool = settings.includeMyWords ? [...BUILT_IN, ...myWordsList] : BUILT_IN;
    return wordOfDay(today, pool, settings.wordTypes) ?? wordOfDay(today, BUILT_IN);
  }, [today, settings.includeMyWords, settings.wordTypes, myWordsList]);

  // Today's quiz comes from the shared daily_quiz row, so it matches the app.
  const quiz = useMemo<QuizSession | null>(() => {
    if (!wordOfTheDay) return null;
    const row = data.dailyQuiz;
    if (!row || row.day !== today || row.word_id !== wordOfTheDay.id) return newQuiz(wordOfTheDay);
    return {
      word: wordOfTheDay,
      mistakes: Math.min(Math.max(row.mistakes, 0), 3),
      state: row.state,
      revealedHints: row.revealed_hints.filter((i) => i >= 0 && i < wordOfTheDay.examples.length).sort((x, y) => x - y),
    };
  }, [wordOfTheDay, data.dailyQuiz, today]);

  /** Saves run one at a time: each re-reads the day's totals, so overlapping saves would lose counts. */
  const saveQueue = useRef<Promise<void>>(Promise.resolve());

  /** Record one answer. The rows are re-read first so answers given on another device aren't overwritten. */
  const record = useCallback((wordID: string, answer: Answer): Promise<void> => {
    const next = saveQueue.current.then(() => saveAnswer(wordID, answer));
    saveQueue.current = next.catch(() => undefined);
    return next;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userID]);

  async function saveAnswer(wordID: string, answer: Answer) {
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
      edit("progress", "studyDays");
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
  }

  const upsertQuiz = useCallback((row: DailyQuizRow) => {
    if (!userID) return;
    edit("dailyQuiz");
    setData((d) => ({ ...d, dailyQuiz: row }));
    supabase.from("daily_quiz").upsert({ ...row, user_id: userID }, { onConflict: "user_id,day" }).then(({ error }) => {
      if (error) setError(`Couldn't save today's word: ${error.message}`);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userID]);

  const saveQuiz = useCallback((next: QuizSession) => {
    const sameQuiz = data.dailyQuiz?.day === today && data.dailyQuiz.word_id === next.word.id;
    upsertQuiz({
      day: today, word_id: next.word.id, state: next.state, mistakes: next.mistakes,
      revealed_hints: next.revealedHints, recorded: sameQuiz && data.dailyQuiz!.recorded, updated_at: now(),
    });
  }, [today, data.dailyQuiz, upsertQuiz]);

  // A finished quiz is counted in the stats once, and only marked as counted after that has saved, so
  // closing the page mid-save doesn't lose it: it's counted on the next load instead.
  const counting = useRef<string | null>(null);
  useEffect(() => {
    const row = data.dailyQuiz;
    if (!userID || !quiz || !row || row.day !== today || row.word_id !== quiz.word.id) return;
    if (!isFinished(quiz) || row.recorded) return;
    const key = `${row.day}:${row.word_id}`;
    if (counting.current === key) return;
    counting.current = key;
    record(quiz.word.id, {
      correct: quiz.state === "solved", source: "quiz",
      gaveUp: quiz.state === "failed" && quiz.mistakes < 3, hints: quiz.revealedHints.length,
    }).then(() => upsertQuiz({ ...row, recorded: true, updated_at: now() }));
  }, [userID, quiz, data.dailyQuiz, today, record, upsertQuiz]);

  const submitDaily = useCallback((answer: string): Outcome => {
    if (!quiz) return { kind: "ignored" };
    const [next, outcome] = submit(quiz, answer);
    saveQuiz(next);
    return outcome;
  }, [quiz, saveQuiz]);
  const giveUpDaily = useCallback(() => { if (quiz) saveQuiz(giveUp(quiz)); }, [quiz, saveQuiz]);
  const revealDailyHint = useCallback((i: number) => { if (quiz) saveQuiz(revealHint(quiz, i)); }, [quiz, saveQuiz]);

  const updateSettings = useCallback(async (change: Partial<Settings>) => {
    if (!userID) return;
    const merged = { ...data.settingsRaw, ...settingsPatch(change, data.settingsRaw), updated_at: now() };
    edit("settingsRaw");
    setData((d) => ({ ...d, settingsRaw: merged }));
    const { error } = await supabase.from("profiles")
      .upsert({ user_id: userID, settings: merged, updated_at: merged.updated_at }, { onConflict: "user_id" });
    if (error) setError(`Couldn't save settings: ${error.message}`);
  }, [userID, data.settingsRaw]);

  const deleteWord = useCallback(async (row: CustomWordRow) => {
    const stamp = now();
    edit("customWords");
    setData((d) => ({ ...d, customWords: d.customWords.map((w) => w.id === row.id ? { ...w, deleted_at: stamp, updated_at: stamp } : w) }));
    const { error } = await supabase.from("custom_words").update({ deleted_at: stamp, updated_at: stamp }).eq("id", row.id);
    if (error) setError(`Couldn't delete the word: ${error.message}`);
  }, []);

  const setTaskDone = useCallback(async (task: GuideTaskRow, done: boolean) => {
    const stamp = now();
    edit("tasks");
    setData((d) => ({ ...d, tasks: d.tasks.map((t) => t.id === task.id ? { ...t, done, updated_at: stamp } : t) }));
    const { error } = await supabase.from("guide_tasks").update({ done, updated_at: stamp }).eq("id", task.id);
    if (error) setError(`Couldn't update the task: ${error.message}`);
  }, []);

  const deleteGuide = useCallback(async (guide: StudyGuideRow) => {
    const stamp = now();
    edit("guides");
    setData((d) => ({ ...d, guides: d.guides.map((g) => g.id === guide.id ? { ...g, deleted_at: stamp, updated_at: stamp } : g) }));
    const { error } = await supabase.from("study_guides").update({ deleted_at: stamp, updated_at: stamp }).eq("id", guide.id);
    if (error) setError(`Couldn't delete the guide: ${error.message}`);
  }, []);

  // One link per account: a new one can only be made once the current one is turned off.
  const createConnectorLink = useCallback(async () => {
    if (!userID || data.hasConnectorToken) return;
    const { data: key, error } = await supabase.rpc("rotate_connector_token");
    if (error || typeof key !== "string") {
      setError(`Couldn't create the connector link: ${error?.message ?? "no key"}`);
      refresh();   // most likely another device made one meanwhile; show it
      return;
    }
    localStorage.setItem(`malchingu.connectorKey.${userID}`, key);
    setConnectorKey(key);
    edit("hasConnectorToken", "connectorToken");
    setData((d) => ({ ...d, hasConnectorToken: true, connectorToken: key }));
  }, [userID, data.hasConnectorToken, refresh]);

  const revokeConnectorLink = useCallback(async () => {
    if (!userID) return;
    const { error } = await supabase.from("connector_tokens").delete().eq("user_id", userID);
    if (error) { setError(`Couldn't turn off the connector: ${error.message}`); return; }
    localStorage.removeItem(`malchingu.connectorKey.${userID}`);
    setConnectorKey(null);
    edit("hasConnectorToken", "connectorToken");
    setData((d) => ({ ...d, hasConnectorToken: false, connectorToken: null }));
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

  // The shared key if there is one; otherwise the copy this browser kept when it made the link.
  const connectorShown = data.hasConnectorToken ? (data.connectorToken ?? connectorKey) : null;

  const store: Store = {
    session, ready, loading, error, setError, data, settings, myWords, allWords, findWord,
    progressFor: (id) => progressMap.get(id), progressMap, stats, level, earned, wordOfTheDay,
    dailyQuiz: quiz, submitDaily, giveUpDaily, revealDailyHint, record, refresh, updateSettings, deleteWord,
    setTaskDone, deleteGuide,
    connectorURL: connectorShown ? `${CONNECTOR_BASE_URL}?key=${connectorShown}` : null,
    createConnectorLink, revokeConnectorLink, signInWithApple, signOut,
    openWord: (word, quizMode = false) => setOpenedWord({ word, quiz: quizMode }),
    openedWord, closeWord: () => setOpenedWord(null),
  };
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}
