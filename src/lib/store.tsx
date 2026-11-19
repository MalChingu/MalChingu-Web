import { achievementProgress, earnedAchievements, type Achievement } from "../core/achievements";
import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { CustomWordRow, GuideSessionRow, GuideTaskRow, SavedTranslationRow, StudyGuideRow, UserNoteRow, Word } from "../core/models";
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
  /** The learner's own notes and saved translations, deleted ones included (deleted_at set). */
  notes: UserNoteRow[];
  savedTranslations: SavedTranslationRow[];
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
  notes: [], savedTranslations: [], hasConnectorToken: false, connectorToken: null, dailyQuiz: null };

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
  /** The account's data has been loaded at least once since the page opened. */
  loaded: boolean;
  /** Today's quiz has been loaded, so it shows its real state instead of changing a moment later. */
  todayLoaded: boolean;
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
  /** Resolves to whether the answer was saved. */
  record: (wordID: string, answer: Answer, quiz?: { day: string; word_id: string }) => Promise<boolean>;
  refresh: () => Promise<void>;
  updateSettings: (change: Partial<Settings>) => Promise<void>;
  deleteWord: (row: CustomWordRow) => Promise<void>;
  saveNote: (note: Pick<UserNoteRow, "body" | "guide_id" | "day_number" | "section"> & { id?: string }) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  saveTranslation: (t: Pick<SavedTranslationRow, "source" | "source_lang" | "translation" | "guide_id" | "day_number">) => Promise<void>;
  deleteTranslation: (id: string) => Promise<void>;
  /** Deletes several words at once. */
  deleteWords: (ids: string[]) => Promise<void>;
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
  const [loadedFor, setLoadedFor] = useState<{ user: string; day: string } | null>(null);
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
    const day = dayString();
    const started = performance.now();
    try {
      const [profiles, customWords, progress, studyDays, guides, sessions, tasks, tokens, quizzes, notes, savedTranslations] = await Promise.all([
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
        selectAll<UserNoteRow>("user_notes", "id"),
        selectAll<SavedTranslationRow>("saved_translations", "id"),
      ]);
      const loaded: Data = { settingsRaw: profiles[0]?.settings ?? {}, customWords, progress, studyDays, guides, sessions, tasks,
        notes, savedTranslations, hasConnectorToken: tokens.length > 0, connectorToken: tokens[0]?.token ?? null, dailyQuiz: quizzes[0] ?? null };
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
      // Also after a failure, so nothing waits forever when offline.
      setLoadedFor({ user: userID, day });
    }
  }, [userID]);

  // A new day brings a new quiz: load it.
  useEffect(() => { if (userID && loadedFor && loadedFor.day !== today) refresh(); }, [today]);   // eslint-disable-line react-hooks/exhaustive-deps

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
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());

  /** Record one answer. The rows are re-read first so answers given on another device aren't overwritten. */
  const record = useCallback((wordID: string, answer: Answer, quiz?: { day: string; word_id: string }): Promise<boolean> => {
    const next = saveQueue.current.then(() => saveAnswer(wordID, answer, quiz));
    saveQueue.current = next.catch(() => undefined);
    return next;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userID]);

  /** With `quiz`, the answer is today's finished quiz: it is saved only if the quiz hasn't been counted
   *  already (on another page or device), in one step with marking it counted. */
  async function saveAnswer(wordID: string, answer: Answer, quiz?: { day: string; word_id: string }): Promise<boolean> {
    if (!userID) return false;
    const stamp = now();
    const day = dayString();
    try {
      const [{ data: wp }, { data: sd }] = await Promise.all([
        supabase.from("word_progress").select("*").eq("word_id", wordID).maybeSingle(),
        supabase.from("study_days").select("*").eq("day", day).maybeSingle(),
      ]);
      const progress = recordOnWord((wp as WordProgress | null) ?? emptyProgress(wordID, stamp), answer, stamp);
      const studyDay = recordOnDay((sd as StudyDay | null) ?? emptyDay(day, stamp), answer, stamp);
      if (quiz) {
        const { data: counted, error } = await supabase.rpc("record_daily_quiz",
          { p_day: quiz.day, p_word_id: quiz.word_id, p_progress: progress, p_study_day: studyDay });
        if (error) throw new Error(error.message);
        if (!counted) return true;   // already counted elsewhere; the next load brings its numbers
      }
      edit("progress", "studyDays");
      setData((d) => ({
        ...d,
        progress: [...d.progress.filter((p) => p.word_id !== wordID), progress],
        studyDays: [...d.studyDays.filter((s) => s.day !== day), studyDay],
      }));
      if (quiz) return true;
      const [a, b] = await Promise.all([
        supabase.from("word_progress").upsert({ ...progress, user_id: userID }, { onConflict: "user_id,word_id" }),
        supabase.from("study_days").upsert({ ...studyDay, user_id: userID }, { onConflict: "user_id,day" }),
      ]);
      if (a.error || b.error) throw new Error((a.error ?? b.error)!.message);
      return true;
    } catch (e) {
      setError(`Couldn't save your answer: ${(e as Error).message}`);
      return false;
    }
  }

  /** Quiz saves run one after another, so the result is saved before it is claimed below. */
  const quizQueue = useRef<Promise<unknown>>(Promise.resolve());
  const upsertQuiz = useCallback((row: DailyQuizRow) => {
    if (!userID) return;
    edit("dailyQuiz");
    setData((d) => ({ ...d, dailyQuiz: row }));
    quizQueue.current = quizQueue.current.then(() =>
      supabase.from("daily_quiz").upsert({ ...row, user_id: userID }, { onConflict: "user_id,day" }).then(({ error }) => {
        if (error) setError(`Couldn't save today's word: ${error.message}`);
      }));
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
  // Count a finished quiz in the stats exactly once, across reloads, tabs and devices. The database
  // marks it counted and saves the count in one step (record_daily_quiz), so it can be neither counted
  // twice nor marked without being counted. The quiz's own save goes first (quizQueue).
  const counting = useRef<string | null>(null);
  useEffect(() => {
    const row = data.dailyQuiz;
    if (!userID || !quiz || !row || row.day !== today || row.word_id !== quiz.word.id) return;
    if (!isFinished(quiz) || row.recorded) return;
    const key = `${row.day}:${row.word_id}`;
    if (counting.current === key) return;
    counting.current = key;
    const answer = {
      correct: quiz.state === "solved", source: "quiz" as const,
      gaveUp: quiz.state === "failed" && quiz.mistakes < 3, hints: quiz.revealedHints.length,
    };
    quizQueue.current = quizQueue.current.then(async () => {
      if (await record(quiz.word.id, answer, { day: row.day, word_id: row.word_id })) {
        edit("dailyQuiz");
        setData((d) => d.dailyQuiz?.day === row.day ? { ...d, dailyQuiz: { ...d.dailyQuiz, recorded: true } } : d);
      } else {
        counting.current = null;   // try again on the next change or load
      }
    });
  }, [userID, quiz, data.dailyQuiz, today, record]);

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

  const deleteWords = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    const stamp = now();
    const doomed = new Set(ids);
    edit("customWords");
    setData((d) => ({ ...d, customWords: d.customWords.map((w) => doomed.has(w.id) ? { ...w, deleted_at: stamp, updated_at: stamp } : w) }));
    const { error } = await supabase.from("custom_words").update({ deleted_at: stamp, updated_at: stamp }).in("id", ids);
    if (error) setError(`Couldn't delete ${ids.length === 1 ? "the word" : "the words"}: ${error.message}`);
  }, []);
  const deleteWord = useCallback((row: CustomWordRow) => deleteWords([row.id]), [deleteWords]);

  const setTaskDone = useCallback(async (task: GuideTaskRow, done: boolean) => {
    const stamp = now();
    edit("tasks");
    setData((d) => ({ ...d, tasks: d.tasks.map((t) => t.id === task.id ? { ...t, done, updated_at: stamp } : t) }));
    const { error } = await supabase.from("guide_tasks").update({ done, updated_at: stamp }).eq("id", task.id);
    if (error) setError(`Couldn't update the task: ${error.message}`);
  }, []);

  /** Adds a note, or saves changes to one (same id). */
  const saveNote = useCallback(async (note: Pick<UserNoteRow, "body" | "guide_id" | "day_number" | "section"> & { id?: string }) => {
    const stamp = now();
    const existing = note.id ? data.notes.find((n) => n.id === note.id) : undefined;
    const row: UserNoteRow = {
      id: note.id ?? crypto.randomUUID(), body: note.body, guide_id: note.guide_id, day_number: note.day_number, section: note.section,
      created_at: existing?.created_at ?? stamp, updated_at: stamp, deleted_at: null,
    };
    edit("notes");
    setData((d) => ({ ...d, notes: existing ? d.notes.map((n) => n.id === row.id ? row : n) : [...d.notes, row] }));
    const { error } = await supabase.from("user_notes").upsert(row, { onConflict: "id" });
    if (error) setError(`Couldn't save the note: ${error.message}`);
  }, [data.notes]);

  const deleteNote = useCallback(async (id: string) => {
    const stamp = now();
    edit("notes");
    setData((d) => ({ ...d, notes: d.notes.map((n) => n.id === id ? { ...n, deleted_at: stamp, updated_at: stamp } : n) }));
    const { error } = await supabase.from("user_notes").update({ deleted_at: stamp, updated_at: stamp }).eq("id", id);
    if (error) setError(`Couldn't delete the note: ${error.message}`);
  }, []);

  const saveTranslation = useCallback(async (t: Pick<SavedTranslationRow, "source" | "source_lang" | "translation" | "guide_id" | "day_number">) => {
    const stamp = now();
    const row: SavedTranslationRow = { ...t, id: crypto.randomUUID(), created_at: stamp, updated_at: stamp, deleted_at: null };
    edit("savedTranslations");
    setData((d) => ({ ...d, savedTranslations: [...d.savedTranslations, row] }));
    const { error } = await supabase.from("saved_translations").insert(row);
    if (error) setError(`Couldn't save the translation: ${error.message}`);
  }, []);

  const deleteTranslation = useCallback(async (id: string) => {
    const stamp = now();
    edit("savedTranslations");
    setData((d) => ({ ...d, savedTranslations: d.savedTranslations.map((t) => t.id === id ? { ...t, deleted_at: stamp, updated_at: stamp } : t) }));
    const { error } = await supabase.from("saved_translations").update({ deleted_at: stamp, updated_at: stamp }).eq("id", id);
    if (error) setError(`Couldn't delete the translation: ${error.message}`);
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
    session, ready, loading, error,
    loaded: loadedFor?.user === userID, todayLoaded: loadedFor?.user === userID && loadedFor.day === today, setError, data, settings, myWords, allWords, findWord,
    progressFor: (id) => progressMap.get(id), progressMap, stats, level, earned, wordOfTheDay,
    dailyQuiz: quiz, submitDaily, giveUpDaily, revealDailyHint, record, refresh, updateSettings, deleteWord, deleteWords,
    setTaskDone, deleteGuide, saveNote, deleteNote, saveTranslation, deleteTranslation,
    connectorURL: connectorShown ? `${CONNECTOR_BASE_URL}?key=${connectorShown}` : null,
    createConnectorLink, revokeConnectorLink, signInWithApple, signOut,
    openWord: (word, quizMode = false) => setOpenedWord({ word, quiz: quizMode }),
    openedWord, closeWord: () => setOpenedWord(null),
  };
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}
