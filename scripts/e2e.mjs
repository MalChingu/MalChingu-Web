// End-to-end check of the built site in a real browser.
//
//   npm run build && npm run e2e
//
// Supabase is replaced by an in-memory stand-in (requests are intercepted in the browser), so the
// run needs no account and touches no real data. It checks the screens and exactly what the app
// sends to the database; the real backend is exercised by signing in with Apple.
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const USER = "44444444-4444-4444-8444-444444444444";
const GUIDE = "55555555-5555-4555-8555-555555555555";
const today = (() => { const d = new Date(); const p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; })();
const stamp = new Date().toISOString();

/** The stand-in database. */
const db = {
  profiles: [{ user_id: USER, settings: { display: "both", profile: { name: "Test Learner" }, word_notification: true, word_notification_minutes: 540 }, updated_at: stamp }],
  custom_words: [
    { id: "77777777-7777-4777-8777-777777777771", user_id: USER, hangul: "바다", romanization: "bada", meanings: ["sea", "ocean"], pos: "noun",
      examples: [{ korean: "바다에 가요.", romanization: "badae gayo.", english: "I go to the sea." }], tenses: null, source: "claude",
      guide_id: GUIDE, day_number: 1, created_at: stamp, updated_at: stamp, deleted_at: null },
    { id: "77777777-7777-4777-8777-777777777772", user_id: USER, hangul: "역", romanization: "yeok", meanings: ["station"], pos: "noun",
      examples: [], tenses: null, source: "claude", guide_id: GUIDE, day_number: 2, created_at: stamp, updated_at: stamp, deleted_at: null },
  ],
  word_progress: [],
  study_days: [],
  study_guides: [{ id: GUIDE, user_id: USER, title: "Travel Basics", overview: "A short test guide.", start_date: today, total_days: 2,
    source_summary: "", created_at: stamp, updated_at: stamp, deleted_at: null }],
  guide_sessions: [
    { id: "66666666-6666-4666-8666-666666666661", guide_id: GUIDE, user_id: USER, day_number: 1, title: "Greetings", goals: ["Say hello"], grammar_notes: "Use 안녕하세요 with strangers.", updated_at: stamp },
    { id: "66666666-6666-4666-8666-666666666662", guide_id: GUIDE, user_id: USER, day_number: 2, title: "Directions", goals: [], grammar_notes: "", updated_at: stamp },
  ],
  guide_tasks: [
    { id: "88888888-8888-4888-8888-888888888881", session_id: "66666666-6666-4666-8666-666666666661", guide_id: GUIDE, user_id: USER, position: 0, text: "Read the greetings list", done: false, updated_at: stamp },
    { id: "88888888-8888-4888-8888-888888888882", session_id: "66666666-6666-4666-8666-666666666661", guide_id: GUIDE, user_id: USER, position: 1, text: "Practice the vocabulary", done: false, updated_at: stamp },
    { id: "88888888-8888-4888-8888-888888888883", session_id: "66666666-6666-4666-8666-666666666662", guide_id: GUIDE, user_id: USER, position: 0, text: "Ask for the station", done: false, updated_at: stamp },
  ],
  connector_tokens: [],
};
const KEYS = { profiles: ["user_id"], word_progress: ["user_id", "word_id"], study_days: ["user_id", "day"] };

/** Just enough of PostgREST for this app: eq filters, upserts, updates, deletes and one RPC. */
async function fakeSupabase(route) {
  const request = route.request();
  const url = new URL(request.url());
  const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  if (url.pathname.startsWith("/auth/v1/")) return json({});
  if (url.pathname === "/rest/v1/rpc/rotate_connector_token") {
    db.connector_tokens = [{ user_id: USER }];
    return json("kt_e2etestkey");
  }
  const table = url.pathname.replace("/rest/v1/", "");
  const rows = db[table];
  if (!rows) return json({ message: `unknown table ${table}` }, 404);
  const filters = [...url.searchParams].filter(([k, v]) => v.startsWith("eq.")).map(([k, v]) => [k, v.slice(3)]);
  const matches = (row) => filters.every(([k, v]) => String(row[k]) === v);
  const method = request.method();
  if (method === "GET") {
    const offset = Number(url.searchParams.get("offset") ?? 0);
    const limit = Number(url.searchParams.get("limit") ?? 1000);
    return json(rows.filter(matches).slice(offset, offset + limit));
  }
  if (method === "POST") {
    const body = [].concat(request.postDataJSON());
    for (const item of body) {
      const keys = KEYS[table] ?? ["id"];
      const existing = rows.find((r) => keys.every((k) => r[k] === item[k]));
      if (existing) Object.assign(existing, item); else rows.push({ ...item });
    }
    return route.fulfill({ status: 201, body: "" });
  }
  if (method === "PATCH") {
    rows.filter(matches).forEach((r) => Object.assign(r, request.postDataJSON()));
    return route.fulfill({ status: 204, body: "" });
  }
  if (method === "DELETE") {
    db[table] = rows.filter((r) => !matches(r));
    return route.fulfill({ status: 204, body: "" });
  }
  return json({ message: "unsupported" }, 405);
}

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const expires = Math.floor(Date.now() / 1000) + 3600;
const fakeJWT = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: USER, role: "authenticated", exp: expires, email: "test@example.invalid" })}.sig`;
const session = {
  access_token: fakeJWT, refresh_token: "fake", token_type: "bearer", expires_in: 3600, expires_at: expires,
  user: { id: USER, aud: "authenticated", role: "authenticated", email: "test@example.invalid", app_metadata: {}, user_metadata: {}, created_at: stamp },
};

const server = spawn("npx", ["vite", "preview", "--port", "4173", "--strictPort"], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 2500));
mkdirSync("screenshots", { recursive: true });

const browser = await chromium.launch();
const failures = [];
const check = (ok, message) => { console.log(`${ok ? "✔" : "✘"} ${message}`); if (!ok) failures.push(message); };

try {
  // Signed out: the sign-in page.
  const signedOut = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await signedOut.route("https://nxlsnpzfbazwlccxtwpt.supabase.co/**", fakeSupabase);
  await signedOut.goto("http://localhost:4173/");
  await signedOut.getByRole("button", { name: "Sign in with Apple" }).waitFor();
  check(true, "sign-in page renders");
  await signedOut.screenshot({ path: "screenshots/sign-in.png" });
  await signedOut.close();

  for (const [label, viewport] of [["phone", { width: 390, height: 844 }], ["desktop", { width: 1280, height: 860 }]]) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
    await context.route("https://nxlsnpzfbazwlccxtwpt.supabase.co/**", fakeSupabase);
    await context.addInitScript((value) => {
      localStorage.setItem("sb-nxlsnpzfbazwlccxtwpt-auth-token", value);
    }, JSON.stringify(session));
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://localhost:4173/#today");

    await page.getByRole("heading", { name: "Welcome Back, Test" }).waitFor({ timeout: 15000 });
    check(true, `${label}: Today greets by name`);
    await page.getByText("Travel Basics · Day 1 of 2").waitFor();
    check(true, `${label}: today's guide session shows`);

    if (label === "phone") {
      // Word of the day quiz: a wrong guess opens hint 1, X reveals the answer.
      await page.getByLabel("Meaning in English").fill("zzz not it");
      await page.getByRole("button", { name: "Check answer" }).click();
      await page.getByText("Hint 1").waitFor();
      check(await page.getByText("Not quite. 2 tries left.").isVisible(), "wrong guess opens hint 1 and costs a try");
      await page.getByRole("button", { name: "Tap to Show Hint 3" }).click();
      check(await page.getByText("Hint 3").isVisible(), "tapping a hint opens it");
      await page.screenshot({ path: `screenshots/today-quiz-${label}.png` });
      await page.getByRole("button", { name: "I don't know, show the answer" }).click();
      await page.getByText(/The answer is/).waitFor();
      check(true, "X reveals the answer");
      await page.reload();
      await page.getByText(/The answer is/).waitFor({ timeout: 15000 });
      check(true, "quiz result is kept after a reload");

      // Guide task toggles.
      await page.getByRole("button", { name: "Read the greetings list" }).click();
      check(await page.getByRole("button", { name: "Read the greetings list" }).getAttribute("aria-pressed") === "true", "guide task ticks");

      // Flashcards: a three-card round.
      await page.getByRole("button", { name: "Flashcards" }).click();
      await page.getByRole("button", { name: "Fewer cards" }).click();
      await page.getByRole("button", { name: "Start" }).click();
      await page.getByRole("heading", { name: /1 \/ \d+/ }).waitFor();
      await page.screenshot({ path: `screenshots/flashcard-${label}.png` });
      const total = Number((await page.getByRole("heading", { name: /1 \/ \d+/ }).textContent()).split("/")[1]);
      for (let i = 0; i < total; i++) {
        if (i % 2 === 0) {
          await page.getByRole("button", { name: "I don't know" }).click();
        } else {
          await page.getByLabel("Meaning in English").fill("definitely wrong");
          await page.keyboard.press("Enter");   // closes the keyboard only, must not submit
          check(await page.getByLabel("Meaning in English").isVisible(), "Return doesn't submit a flashcard");
          await page.getByRole("button", { name: "Submit answer" }).click();
        }
        await page.getByRole("button", { name: i === total - 1 ? "Finish round" : "Next card" }).click();
      }
      await page.getByRole("heading", { name: "Round Complete" }).waitFor();
      await page.waitForLoadState("networkidle");
      check(true, `flashcard round of ${total} completes`);
      await page.screenshot({ path: `screenshots/round-complete-${label}.png` });
    }

    for (const tab of ["Guides", "Stats", "Profile"]) {
      await page.getByRole("button", { name: tab, exact: true }).click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: `screenshots/${tab.toLowerCase()}-${label}.png`, fullPage: label === "desktop" });
    }
    await page.getByRole("button", { name: "Guides", exact: true }).click();
    await page.getByRole("button", { name: /Travel Basics/ }).click();
    await page.getByText("Vocabulary · 1").first().waitFor();
    check(true, `${label}: guide detail shows days and vocabulary`);
    await page.screenshot({ path: `screenshots/guide-${label}.png`, fullPage: true });

    await page.getByRole("button", { name: "Profile", exact: true }).click();
    check(await page.getByLabel("Your name").inputValue() === "Test Learner", `${label}: profile shows the name`);
    check(await page.getByText("Beginner").isVisible(), `${label}: profile shows the level`);
    check(errors.length === 0, `${label}: no page errors${errors.length ? ": " + errors.join("; ") : ""}`);
    await page.waitForLoadState("networkidle");   // let the last saves finish before closing
    await context.close();
  }

  // What the app wrote to the database.
  const progress = db.word_progress;
  const days = db.study_days;
  check(progress.length >= 2 && progress.every((p) => p.user_id === USER), `word_progress rows saved for the user (${progress.length})`);
  check(days.length === 1 && days[0].day === today && days[0].quiz_answers === 1 && days[0].flashcard_answers >= 2,
    `study_days counts quiz and flashcard answers (${JSON.stringify(days[0] ?? {})})`);
  check(progress.some((p) => p.dont_know > 0 && p.hints_used > 0), "don't-knows and hints recorded");
  check(db.guide_tasks.filter((t) => t.done).length === 1, "ticked task saved");
  check(db.profiles[0].settings.word_notification === true, "app-only settings kept intact");
} finally {
  await browser.close();
  server.kill();
}
if (failures.length) { console.error(`${failures.length} check(s) failed`); process.exit(1); }
console.log("All end-to-end checks passed");
