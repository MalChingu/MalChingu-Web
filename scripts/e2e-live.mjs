// Live end-to-end check: the built site in a real browser against the real Supabase project,
// signed in as a dedicated email test account.
//
//   E2E_EMAIL=... E2E_PASSWORD=... npm run build && npm run e2e:live
//
// It seeds the account through the Claude connector (words and a study guide), plays through the
// main screens, checks what landed in the database, and checks that today's quiz syncs both ways.
// Needs email sign-in enabled in Supabase and Playwright with Chromium installed.
import { createClient } from "@supabase/supabase-js";
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const AXE = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

const SUPABASE_URL = "https://nxlsnpzfbazwlccxtwpt.supabase.co";
const KEY = "sb_publishable_9G82LPPiH9TnoSOfoQkxQg_4OWTAPtj";
const { E2E_EMAIL, E2E_PASSWORD } = process.env;
if (!E2E_EMAIL || !E2E_PASSWORD) throw new Error("Set E2E_EMAIL and E2E_PASSWORD");

const today = (() => { const d = new Date(); const p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; })();
const failures = [];
const check = (ok, message) => { console.log(`${ok ? "✔" : "✘"} ${message}`); if (!ok) failures.push(message); };

const supabase = createClient(SUPABASE_URL, KEY, { auth: { persistSession: false } });
const { data: auth, error } = await supabase.auth.signInWithPassword({ email: E2E_EMAIL, password: E2E_PASSWORD });
if (error) throw error;
const session = auth.session;
const userID = auth.user.id;

// Start each run from a clean slate for today, so the checks below are predictable.
await supabase.from("daily_quiz").delete().eq("day", today);

// Seed through the Claude connector, as Claude would.
const { data: connectorKey, error: keyError } = await supabase.rpc("rotate_connector_token");
if (keyError) throw keyError;
async function connector(name, args) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/mcp?key=${connectorKey}`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
  });
  const body = await response.json();
  return JSON.parse(body.result.content[0].text);
}
const { data: existingGuides } = await supabase.from("study_guides").select("id").eq("title", "E2E Travel Basics").is("deleted_at", null);
if (!existingGuides?.length) {
  const saved = await connector("save_study_guide", {
    title: "E2E Travel Basics", overview: "A short guide made by the live test.", start_date: today,
    days: [
      { day: 1, title: "Greetings", goals: ["Say hello"], tasks: ["Read the greetings list", "Practice the vocabulary"],
        grammar_notes: "Use 안녕하세요 with strangers.",
        vocabulary: [{ korean: "바다", romanization: "bada", meanings: ["sea", "ocean"], part_of_speech: "noun",
          examples: [{ korean: "바다에 가요.", romanization: "badae gayo.", english: "I go to the sea." }] }] },
      { day: 2, title: "Directions", tasks: ["Ask for the station"],
        vocabulary: [{ korean: "역", romanization: "yeok", meanings: ["station"], part_of_speech: "noun" }] },
    ],
  });
  check(Boolean(saved.guide_id), "connector saved a study guide");
}
const added = await connector("add_words", { words: [
  { korean: "도서관", romanization: "doseogwan", meanings: ["library"], part_of_speech: "noun" },
  { korean: "운동하다", romanization: "undonghada", meanings: ["to exercise", "exercise"], part_of_speech: "verb",
    tenses: { past: "운동했어요", present: "운동해요", future: "운동할 거예요" } },
] });
check(added.added + added.skipped_already_saved.length === 2, "connector added words");

const server = spawn("npx", ["vite", "preview", "--port", "4175", "--strictPort"], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 2500));
mkdirSync("screenshots/live", { recursive: true });
const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: "localhost,127.0.0.1" } : undefined;
const browser = await chromium.launch({ proxy });

async function open(viewport, colorScheme = "light") {
  const context = await browser.newContext({ viewport, colorScheme });
  await context.addInitScript((value) => localStorage.setItem("sb-nxlsnpzfbazwlccxtwpt-auth-token", value), JSON.stringify(session));
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return { context, page, errors };
}

try {
  const { context, page, errors } = await open({ width: 390, height: 844 });
  await page.goto("http://localhost:4175/#profile");
  await page.getByLabel("Your name").waitFor({ timeout: 20000 });
  await page.getByLabel("Your name").fill("Web Tester");
  await page.getByLabel("Your name").press("Enter");
  await page.waitForTimeout(800);
  const { data: profile } = await supabase.from("profiles").select("settings").single();
  check(profile?.settings?.profile?.name === "Web Tester", "name saved to the account");

  await page.getByRole("button", { name: "Today", exact: true }).click();
  await page.getByRole("heading", { name: "Welcome Back, Web" }).waitFor();
  check(true, "Today greets by name");
  // The test guide is created once and kept, so on later runs it may be past day 1, or finished.
  const { data: guide } = await supabase.from("study_guides").select("start_date,total_days").eq("title", "E2E Travel Basics").is("deleted_at", null).single();
  const day = Math.round((Date.parse(today) - Date.parse(guide.start_date)) / 86_400_000) + 1;
  if (day >= 1 && day <= guide.total_days) {
    check(await page.getByText(`E2E Travel Basics · Day ${day} of ${guide.total_days}`).isVisible(), "today's guide session shows");
  }

  // Web → database: a wrong guess opens hint 1 and is saved to the shared quiz.
  await page.getByLabel("Meaning in English").fill("zzz not it");
  await page.getByRole("button", { name: "Check answer" }).click();
  await page.getByText("Hint 1").waitFor();
  await page.waitForTimeout(800);
  const { data: afterGuess } = await supabase.from("daily_quiz").select("*").eq("day", today).single();
  check(afterGuess?.mistakes === 1 && afterGuess?.revealed_hints?.includes(0), `quiz progress saved for other devices (${JSON.stringify(afterGuess)})`);
  await page.screenshot({ path: "screenshots/live/today-guess.png" });

  // Database → web: another device (the app) finishes the quiz; the web shows that after a refresh.
  await supabase.from("daily_quiz").upsert({ ...afterGuess, state: "failed", mistakes: 3, revealed_hints: [0, 1, 2], recorded: true,
    updated_at: new Date().toISOString(), user_id: userID }, { onConflict: "user_id,day" });
  await page.reload();
  await page.getByText(/The answer is/).waitFor({ timeout: 20000 });
  check(true, "quiz finished on another device shows as finished here");
  check(await page.getByRole("button", { name: "Check answer" }).count() === 0, "no further guesses offered");

  // Guide task (whichever of today's tasks is shown).
  const taskButton = page.locator(".today-side .task").first();
  if (await taskButton.count()) {
    const text = (await taskButton.textContent()).trim();
    await taskButton.click();
    await page.waitForTimeout(800);
    const { data: task } = await supabase.from("guide_tasks").select("done").eq("text", text).limit(1).single();
    check(task?.done === true, "ticked task saved");
    await taskButton.click();   // untick, so the next run starts the same
    await page.waitForTimeout(800);
  }

  // Flashcards: a round of My Words.
  await page.getByRole("button", { name: "Flashcards", exact: true }).click();
  await page.getByRole("radio", { name: "My Words" }).click();
  const before = (await supabase.from("study_days").select("flashcard_answers").eq("day", today).maybeSingle()).data?.flashcard_answers ?? 0;
  await page.getByRole("button", { name: "Start" }).click();
  const heading = page.getByRole("heading", { name: /1 \/ \d+/ });
  await heading.waitFor();
  const total = Number((await heading.textContent()).split("/")[1]);
  for (let i = 0; i < total; i++) {
    await page.getByLabel("Meaning in English").fill(i === 0 ? "library" : "nope");
    await page.getByRole("button", { name: "Submit answer" }).click();
    await page.getByRole("button", { name: i === total - 1 ? "Finish round" : "Next card" }).click();
  }
  await page.getByRole("heading", { name: "Round Complete" }).waitFor();
  // Saves run one after another, so give the last one a moment to land.
  let after = before;
  for (let tries = 0; tries < 20 && after - before < total; tries++) {
    await page.waitForTimeout(500);
    after = (await supabase.from("study_days").select("flashcard_answers").eq("day", today).maybeSingle()).data?.flashcard_answers ?? 0;
  }
  check(after - before === total, `flashcard answers saved (${after - before} of ${total})`);
  await page.screenshot({ path: "screenshots/live/round-complete.png" });

  for (const tab of ["Guides", "Stats", "Profile"]) {
    await page.getByRole("button", { name: tab, exact: true }).click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `screenshots/live/${tab.toLowerCase()}.png`, fullPage: true });
  }
  check(errors.length === 0, `no page errors${errors.length ? ": " + errors.join("; ") : ""}`);
  await context.close();

  // Contrast on the live data, both themes, desktop size.
  for (const scheme of ["light", "dark"]) {
    const { context: c, page: p } = await open({ width: 1440, height: 900 }, scheme);
    for (const [hash, name] of [["today", "Today"], ["flashcards", "Flashcards"], ["guides", "Guides"], ["stats", "Stats"], ["profile", "Profile"]]) {
      await p.goto(`http://localhost:4175/#${hash}`);
      await p.getByRole("heading", { name: hash === "today" ? /Welcome Back/ : hash === "guides" ? "Study Guides" : name }).waitFor({ timeout: 20000 });
      await p.waitForTimeout(400);
      await p.addScriptTag({ content: AXE });
      const bad = await p.evaluate(async () => (await window.axe.run(document, { runOnly: ["color-contrast"] })).violations
        .flatMap((v) => v.nodes.map((n) => `${n.target.join(" ")}: ${n.any.map((a) => a.message).join(" ")}`)));
      check(bad.length === 0, `${scheme} · ${name}: text contrast${bad.length ? "\n    " + bad.slice(0, 5).join("\n    ") : ""}`);
      await p.screenshot({ path: `screenshots/live/${scheme}-${hash}.png` });
    }
    await c.close();
  }
} finally {
  await browser.close();
  server.kill();
}
if (failures.length) { console.error(`${failures.length} check(s) failed`); process.exit(1); }
console.log("All live checks passed");
