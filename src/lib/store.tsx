import { achievementProgress, earnedAchievements, type Achievement } from "../core/achievements";
import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { CustomWordRow, GuideSessionRow, GuideTaskRow, SavedTranslationRow, StudyGuideRow, UserNoteRow, Word } from "../core/models";
import { computeStats, emptyDay, emptyProgress, estimateLevel, recordOnDay, recordOnWord,
  type Answer, type StudyDay, type WordProgress } from "../core/progress";
import { giveUp, newQuiz, revealHint, submit, isFinished, type Outcome, type QuizSession } from "../core/quiz";
import { activeCustomWords, BUILT_IN, builtInWord } from "../core/wordBank";
import { challengeNeedsMe, friendLabel, isValidUsername, looksLikeEmail, normalizeUsername, pickDuelWords,
  type BlockRow, type ChallengeRow, type FriendRow, type UserSearchRow } from "../core/friends";
import { dayString, wordOfDay } from "../core/wordOfDay";
import { readPlan, type Plan } from "../core/plan";
import { readSettings, settingsPatch, type ProfileRow, type Settings } from "./settings";
import { CONNECTOR_BASE_URL, supabase } from "./supabase";

// App state for a signed-in learner: everything is read from and written straight to Supabase,
// the same tables the iPhone/Mac app syncs with.

interface Data {
  /** Your row of `profiles`: the settings, one column each. */
  profile: ProfileRow;
  customWords: CustomWordRow[];
  progress: WordProgress[];
  studyDays: StudyDay[];
  guides: StudyGuideRow[];
  sessions: GuideSessionRow[];
  tasks: GuideTaskRow[];
  /** The learner's own notes and saved translations. */
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

const EMPTY: Data = { profile: {}, customWords: [], progress: [], studyDays: [], guides: [], sessions: [], tasks: [],
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

/** Your own row of `public_profiles`: your username (for good once set) and level. */
interface PublicCard { username: string | null; level: string }

/** Friends, requests and challenges: loaded from the server each refresh, never kept offline. */
interface FriendsState { rows: FriendRow[]; challenges: ChallengeRow[]; blocks: BlockRow[]; loaded: boolean; error: string | null }
const NO_FRIENDS: FriendsState = { rows: [], challenges: [], blocks: [], loaded: false, error: null };

export const USERNAME_RULE = "Use 3–20 letters, numbers, dots or underscores, starting with a letter or number.";

/** A Flashcard Duel being played: its 10 words, the same for both friends. */
export interface Duel { id: string; words: Word[]; friend: string }

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
  renameGuide: (guide: StudyGuideRow, title: string) => Promise<void>;
  connectorURL: string | null;
  createConnectorLink: () => Promise<void>;
  revokeConnectorLink: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Deletes the account and all of its data (the delete-account function), then signs out. Resolves to an error message, or null. */
  deleteAccount: () => Promise<string | null>;
  openWord: (word: Word, quiz?: boolean) => void;
  openedWord: { word: Word; quiz: boolean } | null;
  closeWord: () => void;
  // Friends. Each action resolves to an error message, or null when it worked.
  friends: FriendRow[];
  challenges: ChallengeRow[];
  friendsLoaded: boolean;
  friendsError: string | null;
  /** Your username: null with none yet, undefined until your card has loaded. */
  username: string | null | undefined;
  /** Free (2 study guides at a time) or Pro; null until loaded. */
  plan: Plan | null;
  /** Requests to you and challenges waiting on you. */
  friendsWaiting: number;
  setUsername: (typed: string) => Promise<string | null>;
  /** Null when it couldn't be checked. */
  usernameAvailable: (name: string) => Promise<boolean | null>;
  searchUsers: (query: string) => Promise<UserSearchRow[]>;
  /** By username, or by email when it looks like one. */
  requestFriend: (typed: string) => Promise<{ error: string } | { result: "sent" | "friends" }>;
  acceptFriend: (id: string) => Promise<string | null>;
  /** Declines, cancels or removes, along with the challenges between you. */
  removeFriend: (id: string) => Promise<string | null>;
  /** People you blocked, newest first. */
  blocks: BlockRow[];
  /** Ends your friendship, requests and challenges with them; neither of you can find or add the other. */
  blockUser: (userID: string) => Promise<string | null>;
  unblockUser: (userID: string) => Promise<string | null>;
  /** A duel starts straight away (see `duel`); a 7-Day Challenge waits for your friend to accept. */
  challengeFriend: (friend: FriendRow, kind: "duel" | "week") => Promise<string | null>;
  acceptChallenge: (id: string) => Promise<string | null>;
  removeChallenge: (id: string) => Promise<string | null>;
  submitDuel: (id: string, score: number) => Promise<string | null>;
  playDuel: (challenge: ChallengeRow) => void;
  duel: Duel | null;
  endDuel: () => void;
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
  const [friendsState, setFriendsState] = useState<FriendsState>(NO_FRIENDS);
  /** Undefined until loaded; null when you have no card yet. */
  const [card, setCard] = useState<PublicCard | null | undefined>(undefined);
  /** Whether the account's data has loaded without an error, so your card isn't updated from empty data. */
  const [dataOK, setDataOK] = useState(false);
  const [duel, setDuel] = useState<Duel | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
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

  /** Only the newest friends load is kept, so an older one finishing late can't undo a change. */
  const friendsLoad = useRef(0);
  const loadFriends = useCallback(async () => {
    if (!userID) return;
    const ticket = ++friendsLoad.current;
    const [f, c, me, p, b] = await Promise.all([
      supabase.rpc("my_friends"),
      supabase.rpc("my_challenges"),
      supabase.from("public_profiles").select("username,level").eq("user_id", userID).maybeSingle(),
      supabase.rpc("my_plan"),
      supabase.rpc("my_blocks"),
    ]);
    if (ticket !== friendsLoad.current) return;
    if (!p.error) setPlan(readPlan((p.data as { plan?: unknown } | null)?.plan));
    const error = f.error ?? c.error ?? me.error;
    if (error) {
      setFriendsState((s) => ({ ...s, loaded: true, error: `Couldn't load your friends: ${error.message}` }));
      return;
    }
    setFriendsState({ rows: (f.data ?? []) as FriendRow[], challenges: (c.data ?? []) as ChallengeRow[],
      blocks: b.error ? [] : (b.data ?? []) as BlockRow[], loaded: true, error: null });
    setCard((me.data as PublicCard | null) ?? null);
  }, [userID]);

  const refresh = useCallback(async () => {
    if (!userID) return;
    loadFriends();
    setLoading(true);
    const day = dayString();
    const started = performance.now();
    try {
      const [profiles, customWords, progress, studyDays, guides, sessions, tasks, tokens, quizzes, notes, savedTranslations] = await Promise.all([
        selectAll<ProfileRow>("profiles", "user_id"),
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
      const loaded: Data = { profile: profiles[0] ?? {}, customWords, progress, studyDays, guides, sessions, tasks,
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
      setDataOK(true);
    } catch (e) {
      setError(`Couldn't load your data: ${(e as Error).message}`);
    } finally {
      setLoading(false);
      // Also after a failure, so nothing waits forever when offline.
      setLoadedFor({ user: userID, day });
    }
  }, [userID, loadFriends]);

  // A new day brings a new quiz: load it.
  useEffect(() => { if (userID && loadedFor && loadedFor.day !== today) refresh(); }, [today]);   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setFriendsState(NO_FRIENDS);
    setCard(undefined);
    setPlan(null);
    setDataOK(false);
    setDuel(null);
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

  const settings = useMemo(() => readSettings(data.profile), [data.profile]);
  const myWordsList = useMemo(() => activeCustomWords(data.customWords), [data.customWords]);
  const myWords = useMemo(() => [...data.customWords]
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)), [data.customWords]);
  const allWords = useMemo(() => [...BUILT_IN, ...myWordsList], [myWordsList]);
  const findWord = useCallback((id: string) => builtInWord(id) ?? myWordsList.find((w) => w.id === id.toLowerCase()) ?? null,
    [myWordsList]);
  const progressMap = useMemo(() => new Map(data.progress.map((p) => [p.word_id, p])), [data.progress]);
  const earned = useMemo(() => {
    const guidesCompleted = data.guides.filter((g) => {
      const tasks = data.tasks.filter((t) => t.guide_id === g.id);
      return tasks.length > 0 && tasks.every((t) => t.done);
    }).length;
    return earnedAchievements(achievementProgress({ progress: data.progress, days: data.studyDays, today,
      myWords: data.customWords.length, guidesCompleted,
      tasksDone: data.tasks.filter((t) => t.done).length }));
  }, [data.guides, data.tasks, data.progress, data.studyDays, data.customWords, today]);
  const stats = useMemo(() => computeStats(data.progress, data.studyDays, today), [data.progress, data.studyDays, today]);
  const level = useMemo(() => estimateLevel(data.progress), [data.progress]);

  // The same built-in word for everyone each day.
  const wordOfTheDay = useMemo(() => wordOfDay(today, BUILT_IN), [today]);

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

  // Settings are saved one at a time, newest last, and only the columns that changed: quick changes (two chips in a
  // row) could otherwise reach the server out of order. Changes waiting to be sent are combined into one save.
  const pendingPatch = useRef<ProfileRow | null>(null);
  const settingsQueue = useRef<Promise<void>>(Promise.resolve());
  const updateSettings = useCallback(async (change: Partial<Settings>) => {
    if (!userID) return;
    const patch: ProfileRow = { ...settingsPatch(change), updated_at: now() };
    pendingPatch.current = { ...(pendingPatch.current ?? {}), ...patch };
    edit("profile");
    setData((d) => ({ ...d, profile: { ...d.profile, ...patch } }));
    settingsQueue.current = settingsQueue.current.then(async () => {
      const sending = pendingPatch.current;
      if (!sending) return;   // an earlier save already sent this change
      pendingPatch.current = null;
      const { error } = await supabase.from("profiles").upsert({ user_id: userID, ...sending }, { onConflict: "user_id" });
      if (error) setError(`Couldn't save settings: ${error.message}`);
    });
    await settingsQueue.current;
  }, [userID]);

  /** Deletes words for good; their progress goes with them (the database removes it too). */
  const deleteWords = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    const doomed = new Set(ids);
    edit("customWords", "progress");
    setData((d) => ({ ...d, customWords: d.customWords.filter((w) => !doomed.has(w.id)),
      progress: d.progress.filter((p) => !doomed.has(p.word_id)) }));
    const { error } = await supabase.from("custom_words").delete().in("id", ids);
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
      created_at: existing?.created_at ?? stamp, updated_at: stamp,
    };
    edit("notes");
    setData((d) => ({ ...d, notes: existing ? d.notes.map((n) => n.id === row.id ? row : n) : [...d.notes, row] }));
    const { error } = await supabase.from("user_notes").upsert(row, { onConflict: "id" });
    if (error) setError(`Couldn't save the note: ${error.message}`);
  }, [data.notes]);

  const deleteNote = useCallback(async (id: string) => {
    edit("notes");
    setData((d) => ({ ...d, notes: d.notes.filter((n) => n.id !== id) }));
    const { error } = await supabase.from("user_notes").delete().eq("id", id);
    if (error) setError(`Couldn't delete the note: ${error.message}`);
  }, []);

  const saveTranslation = useCallback(async (t: Pick<SavedTranslationRow, "source" | "source_lang" | "translation" | "guide_id" | "day_number">) => {
    const stamp = now();
    const row: SavedTranslationRow = { ...t, id: crypto.randomUUID(), created_at: stamp, updated_at: stamp };
    edit("savedTranslations");
    setData((d) => ({ ...d, savedTranslations: [...d.savedTranslations, row] }));
    const { error } = await supabase.from("saved_translations").insert(row);
    if (error) setError(`Couldn't save the translation: ${error.message}`);
  }, []);

  const deleteTranslation = useCallback(async (id: string) => {
    edit("savedTranslations");
    setData((d) => ({ ...d, savedTranslations: d.savedTranslations.filter((t) => t.id !== id) }));
    const { error } = await supabase.from("saved_translations").delete().eq("id", id);
    if (error) setError(`Couldn't delete the translation: ${error.message}`);
  }, []);

  /** Deletes a guide with its days, tasks, notes, saved translations and the words it added (a word another
   *  guide also lists moves to that guide). The server does it in one step; the page then reloads. */
  const deleteGuide = useCallback(async (guide: StudyGuideRow) => {
    edit("guides", "sessions", "tasks", "notes", "savedTranslations");
    setData((d) => ({ ...d, guides: d.guides.filter((g) => g.id !== guide.id),
      sessions: d.sessions.filter((s) => s.guide_id !== guide.id), tasks: d.tasks.filter((t) => t.guide_id !== guide.id),
      notes: d.notes.filter((n) => n.guide_id !== guide.id),
      savedTranslations: d.savedTranslations.filter((t) => t.guide_id !== guide.id) }));
    const { error } = await supabase.rpc("delete_guide", { p_id: guide.id });
    if (error) setError(`Couldn't delete the guide: ${error.message}`);
    await refresh();
  }, [refresh]);

  const renameGuide = useCallback(async (guide: StudyGuideRow, title: string) => {
    const name = title.trim().slice(0, 300);
    if (!name || name === guide.title) return;
    const stamp = now();
    edit("guides");
    setData((d) => ({ ...d, guides: d.guides.map((g) => g.id === guide.id ? { ...g, title: name, updated_at: stamp } : g) }));
    const { error } = await supabase.from("study_guides").update({ title: name, updated_at: stamp }).eq("id", guide.id);
    if (error) setError(`Couldn't rename the guide: ${error.message}`);
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

  // Google: the same account as Apple's when both share a verified email address.
  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) setError(`Sign-in failed: ${error.message}`);
  }, []);

  // Your card holds your username and level; friends see your name and picture from your settings (kept once).
  const cardFields = useMemo(() => ({ level }), [level]);
  useEffect(() => {
    if (!userID || card === undefined || !dataOK) return;
    if (card && card.level === cardFields.level) return;
    setCard({ username: card?.username ?? null, ...cardFields });
    supabase.from("public_profiles").upsert({ user_id: userID, ...cardFields, updated_at: now() }, { onConflict: "user_id" })
      .then(({ error }) => { if (error) setFriendsState((s) => ({ ...s, error: `Couldn't update your card for friends: ${error.message}` })); });
  }, [userID, card, dataOK, cardFields]);

  const setUsername = useCallback(async (typed: string) => {
    if (!userID) return "Sign in first.";
    const username = normalizeUsername(typed);
    if (!isValidUsername(username)) return USERNAME_RULE;
    const { error } = await supabase.from("public_profiles")
      .upsert({ user_id: userID, username, ...cardFields, updated_at: now() }, { onConflict: "user_id" });
    if (error) return error.code === "23505" ? "That username is taken." : `Couldn't save your username: ${error.message}`;
    setCard({ username, ...cardFields });
    return null;
  }, [userID, cardFields]);

  const usernameAvailable = useCallback(async (name: string) => {
    const { data: free, error } = await supabase.rpc("username_available", { p_name: normalizeUsername(name) });
    return error ? null : free === true;
  }, []);

  const searchUsers = useCallback(async (query: string) => {
    const { data: rows, error } = await supabase.rpc("search_users", { p_query: query });
    if (error) throw new Error(error.message);
    return (rows ?? []) as UserSearchRow[];
  }, []);

  /** Runs one of the friends functions, then reloads friends and challenges. */
  const callFriends = useCallback(async (fn: string, args: Record<string, unknown>): Promise<string | null> => {
    const { error } = await supabase.rpc(fn, args);
    await loadFriends();
    return error ? error.message : null;
  }, [loadFriends]);

  const requestFriend = useCallback(async (typed: string): Promise<{ error: string } | { result: "sent" | "friends" }> => {
    // Friends are added by username only.
    if (looksLikeEmail(typed)) return { error: "Add friends by their username." };
    const { data: result, error } = await supabase.rpc("request_friend", { p_username: normalizeUsername(typed) });
    await loadFriends();
    return error ? { error: error.message } : { result: result === "friends" ? "friends" : "sent" };
  }, [loadFriends]);

  const acceptFriend = useCallback((id: string) => callFriends("accept_friend", { p_id: id }), [callFriends]);
  const removeFriend = useCallback((id: string) => callFriends("remove_friend", { p_id: id }), [callFriends]);
  const blockUser = useCallback((id: string) => callFriends("block_user", { p_user: id }), [callFriends]);
  const unblockUser = useCallback((id: string) => callFriends("unblock_user", { p_user: id }), [callFriends]);
  const acceptChallenge = useCallback((id: string) => callFriends("accept_challenge", { p_id: id, p_today: dayString() }), [callFriends]);
  const removeChallenge = useCallback((id: string) => callFriends("remove_challenge", { p_id: id }), [callFriends]);
  const submitDuel = useCallback((id: string, score: number) => callFriends("submit_duel", { p_id: id, p_score: score }), [callFriends]);

  const challengeFriend = useCallback(async (friend: FriendRow, kind: "duel" | "week") => {
    if (!friend.user_id) return "They haven't accepted yet.";
    const words = kind === "duel" ? pickDuelWords(BUILT_IN) : [];
    const { data: id, error } = await supabase.rpc("challenge_friend",
      { p_friend: friend.user_id, p_kind: kind, p_words: kind === "duel" ? words.map((w) => w.id) : null });
    await loadFriends();
    if (error) return error.message;
    if (kind === "duel" && typeof id === "string") setDuel({ id, words, friend: friendLabel(friend) });
    return null;
  }, [loadFriends]);

  const playDuel = useCallback((c: ChallengeRow) => {
    const words = (c.words ?? []).map((id) => builtInWord(id)).filter((w): w is Word => w !== null);
    if (words.length) setDuel({ id: c.id, words, friend: friendLabel({ name: c.friend_name, username: c.friend_username, email: null }) });
  }, []);

  const friendsWaiting = useMemo(() =>
    friendsState.rows.filter((f) => f.status === "pending" && f.direction === "incoming").length
      + friendsState.challenges.filter(challengeNeedsMe).length, [friendsState]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setData(EMPTY);
    setConnectorKey(null);
  }, []);

  const deleteAccount = useCallback(async () => {
    if (!userID) return "Sign in first.";
    const { data: result, error } = await supabase.functions.invoke("delete-account", { method: "POST" });
    if (error || !(result as { deleted?: boolean } | null)?.deleted) {
      let message = "Your account couldn't be deleted. Please try again.";
      try { message = (await (error as { context?: Response })?.context?.json())?.error ?? message; } catch { /* keep the default */ }
      return message;
    }
    localStorage.removeItem(`malchingu.connectorKey.${userID}`);
    // The account is gone, so only this browser's session is cleared.
    await supabase.auth.signOut({ scope: "local" });
    setData(EMPTY);
    setConnectorKey(null);
    return null;
  }, [userID]);

  // The shared key if there is one; otherwise the copy this browser kept when it made the link.
  const connectorShown = data.hasConnectorToken ? (data.connectorToken ?? connectorKey) : null;

  const store: Store = {
    session, ready, loading, error,
    loaded: loadedFor?.user === userID, todayLoaded: loadedFor?.user === userID && loadedFor.day === today, setError, data, settings, myWords, allWords, findWord,
    progressFor: (id) => progressMap.get(id), progressMap, stats, level, earned, wordOfTheDay,
    dailyQuiz: quiz, submitDaily, giveUpDaily, revealDailyHint, record, refresh, updateSettings, deleteWord, deleteWords,
    setTaskDone, deleteGuide, renameGuide, saveNote, deleteNote, saveTranslation, deleteTranslation,
    connectorURL: connectorShown ? `${CONNECTOR_BASE_URL}?key=${connectorShown}` : null,
    createConnectorLink, revokeConnectorLink, signInWithApple, signInWithGoogle, signOut, deleteAccount,
    openWord: (word, quizMode = false) => setOpenedWord({ word, quiz: quizMode }),
    openedWord, closeWord: () => setOpenedWord(null),
    friends: friendsState.rows, challenges: friendsState.challenges, blocks: friendsState.blocks, blockUser, unblockUser,
    friendsLoaded: friendsState.loaded,
    friendsError: friendsState.error, username: card === undefined ? undefined : card?.username ?? null, plan, friendsWaiting,
    setUsername, usernameAvailable, searchUsers, requestFriend, acceptFriend, removeFriend, challengeFriend, acceptChallenge,
    removeChallenge, submitDuel, playDuel, duel, endDuel: () => setDuel(null),
  };
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}
