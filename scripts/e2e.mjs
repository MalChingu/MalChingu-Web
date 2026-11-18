// End-to-end check of the built site in a real browser.
//
//   npm run build && npm run e2e
//
// Supabase is replaced by an in-memory stand-in (requests are intercepted in the browser), so the
// run needs no account and touches no real data. It checks the screens and exactly what the app
// sends to the database; the real backend is exercised by signing in with Apple.
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const AXE = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

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
  study_guides: [{ id: GUIDE, user_id: USER, title: "Travel Basics", overview: "A short test guide for greetings and directions. Day 1 covers hello and goodbye. Day 2 asks for the station.", start_date: today, total_days: 2,
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
  daily_quiz: [],
};
const KEYS = { profiles: ["user_id"], word_progress: ["user_id", "word_id"], study_days: ["user_id", "day"], daily_quiz: ["user_id", "day"] };

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
    check(await page.locator(".guide-main .card h3").count() === 1, `${label}: guide shows one day at a time`);
    check(await page.locator(".points li").count() === 3, `${label}: overview shows as points`);
    await page.getByRole("button", { name: "Next day" }).click();
    check(await page.getByRole("heading", { name: "Directions" }).isVisible(), `${label}: next-day button switches day`);
    await page.locator(".day-item").first().click();
    check(await page.getByRole("heading", { name: "Greetings" }).isVisible(), `${label}: day list switches day`);
    await page.getByRole("button", { name: "Delete Guide" }).click();
    check(await page.getByRole("alertdialog", { name: "Delete This Guide?" }).isVisible(), `${label}: deleting a guide asks first`);
    await page.getByRole("button", { name: "Cancel" }).click();
    check(await page.getByRole("alertdialog").count() === 0 && db.study_guides[0].deleted_at === null, `${label}: cancel keeps the guide`);
    await page.screenshot({ path: `screenshots/guide-${label}.png`, fullPage: true });

    await page.getByRole("button", { name: "Profile", exact: true }).click();
    check(await page.getByLabel("Your name").inputValue() === "Test Learner", `${label}: profile shows the name`);
    check(await page.getByText("Beginner").isVisible(), `${label}: profile shows the level`);
    check(errors.length === 0, `${label}: no page errors${errors.length ? ": " + errors.join("; ") : ""}`);
    await page.waitForLoadState("networkidle");   // let the last saves finish before closing
    await context.close();
  }

  // Appearance: follows the system, and Light / Dark in Profile override it and survive a reload.
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: "dark" });
    await context.route("https://nxlsnpzfbazwlccxtwpt.supabase.co/**", fakeSupabase);
    await context.addInitScript((value) => localStorage.setItem("sb-nxlsnpzfbazwlccxtwpt-auth-token", value), JSON.stringify(session));
    const page = await context.newPage();
    const base = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--base").trim());
    await page.goto("http://localhost:4173/#profile");
    await page.getByRole("radio", { name: "System" }).waitFor({ timeout: 15000 });
    check(await base() === "#0e0d1c", "System follows a dark device");
    await page.screenshot({ path: "screenshots/profile-dark-system.png" });
    await page.getByRole("radio", { name: "Light" }).click();
    check(await base() === "#f4f3fb", "Light overrides a dark device");
    await page.reload();
    await page.getByRole("radio", { name: "Light" }).waitFor({ timeout: 15000 });
    check(await base() === "#f4f3fb" && await page.getByRole("radio", { name: "Light" }).getAttribute("aria-checked") === "true",
      "Light is kept after a reload");
    await page.screenshot({ path: "screenshots/profile-light-override.png" });
    await page.getByRole("radio", { name: "Dark" }).click();
    await page.goto("http://localhost:4173/#today");
    await page.getByRole("heading", { name: "Welcome Back, Test" }).waitFor({ timeout: 15000 });
    check(await base() === "#0e0d1c", "Dark applies across pages");
    await page.screenshot({ path: "screenshots/today-dark.png" });
    await page.goto("http://localhost:4173/#profile");
    await page.getByRole("radio", { name: "System" }).click();
    check(await page.evaluate(() => localStorage.getItem("malchingu.theme")) === null, "System clears the override");
    await page.waitForLoadState("networkidle");
    await context.close();
  }

  // Both themes on every screen and dialog: text contrast (axe-core), the chosen tab's colours,
  // equal content widths across pages, and nothing spilling sideways on a phone.
  const expectedTab = { light: ["rgb(21, 19, 43)", "rgb(244, 243, 251)"], dark: ["rgb(242, 241, 250)", "rgb(14, 13, 28)"] };
  for (const scheme of ["light", "dark"]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: scheme });
    await context.route("https://nxlsnpzfbazwlccxtwpt.supabase.co/**", fakeSupabase);
    await context.addInitScript((value) => localStorage.setItem("sb-nxlsnpzfbazwlccxtwpt-auth-token", value), JSON.stringify(session));
    const page = await context.newPage();
    const audit = async (where, shot) => {
      await page.waitForTimeout(350);   // let sheets and dialogs finish animating in
      await page.addScriptTag({ content: AXE });
      const result = await page.evaluate(async () =>
        (await window.axe.run(document, { runOnly: ["color-contrast"] })).violations.flatMap((v) =>
          v.nodes.map((n) => `${n.target.join(" ")}: ${n.any.map((a) => a.message).join(" ")}`)));
      check(result.length === 0, `${scheme} · ${where}: text contrast${result.length ? "\n    " + result.slice(0, 6).join("\n    ") : ""}`);
      if (shot) await page.screenshot({ path: `screenshots/theme-${scheme}-${shot}.png` });
    };
    const tab = (name) => page.getByRole("button", { name, exact: true }).click();
    const widths = {};
    const width = async (name) => { widths[name] = Math.round((await page.locator(".page-content").first().boundingBox()).width); };

    await page.goto("http://localhost:4173/#today");
    await page.getByRole("heading", { name: /Welcome Back/ }).waitFor({ timeout: 15000 });
    await audit("Today", "today"); await width("Today");

    await tab("Flashcards");
    await audit("Flashcards", "flashcards"); await width("Flashcards");
    const chosen = await page.locator('.segmented [aria-checked="true"]').first().evaluate((el) => {
      const st = getComputedStyle(el);
      return [st.backgroundColor, st.color];
    });
    check(chosen[0] === expectedTab[scheme][0] && chosen[1] === expectedTab[scheme][1],
      `${scheme}: chosen tab is ${scheme === "light" ? "dark with light" : "light with dark"} text (${chosen})`);
    await page.getByRole("button", { name: "Start" }).click();
    await audit("Flashcard card", "flashcard");
    await page.getByRole("button", { name: "I don't know" }).click();
    await audit("Flashcard answer");
    await page.getByRole("button", { name: "Close" }).click();
    await page.getByRole("button", { name: /My Words/ }).click();
    await audit("My Words", "my-words");
    await page.getByRole("button", { name: "How to Add Words" }).click();
    await audit("How to Add Words sheet", "help");
    await page.keyboard.press("Escape");

    await tab("Guides");
    await audit("Guides", "guides"); await width("Guides");
    await page.getByRole("button", { name: "Create Guide" }).click();
    await audit("Create Guide sheet", "create-guide");
    check(await page.getByRole("button", { name: "Continue in Claude" }).count() === 0, `${scheme}: no Continue in Claude button on the web`);
    check(await page.locator("textarea[aria-label='Focus']").getAttribute("rows") === "3", `${scheme}: focus box is three lines`);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: /Travel Basics/ }).click();
    await audit("Guide detail", "guide"); await width("Guide detail");
    await page.getByRole("button", { name: "Delete Guide" }).click();
    await audit("Delete confirmation", "confirm");
    await page.getByRole("button", { name: "Cancel" }).click();
    await page.locator(".guide-main .word-row").first().click();
    await audit("Word page", "word");
    await page.keyboard.press("Escape");

    await tab("Stats");
    await audit("Stats", "stats"); await width("Stats");
    const tiles = await page.locator(".tiles > *").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
    check(new Set(tiles).size === 2 && tiles.filter((t) => t === tiles[0]).length === 3, `${scheme}: stats tiles are two even rows of three`);
    await page.locator(".bar-column").last().hover();
    await page.waitForTimeout(250);
    check(await page.locator(".bar-column").last().locator(".bar-tip").evaluate((e) => getComputedStyle(e).opacity) === "1",
      `${scheme}: hovering a bar shows its count`);

    await tab("Profile");
    await audit("Profile", "profile"); await width("Profile");
    check(await page.locator("select").count() === 0, `${scheme}: no native select boxes`);
    await page.getByRole("button", { name: "Sign Out" }).click();
    await audit("Sign-out confirmation");
    await page.getByRole("button", { name: "Cancel" }).click();

    check(new Set(Object.values(widths)).size === 1, `${scheme}: every page has the same content width (${JSON.stringify(widths)})`);

    // Phone: nothing should spill off the side of any page.
    await page.setViewportSize({ width: 375, height: 812 });
    for (const name of ["Today", "Flashcards", "Guides", "Stats", "Profile"]) {
      await tab(name);
      await page.waitForTimeout(200);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(overflow <= 0, `${scheme} · phone ${name}: no sideways scrolling${overflow > 0 ? ` (${overflow}px too wide)` : ""}`);
    }
    await page.waitForLoadState("networkidle");
    await context.close();
  }
  for (const scheme of ["light", "dark"]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, colorScheme: scheme });
    await page.route("https://nxlsnpzfbazwlccxtwpt.supabase.co/**", fakeSupabase);
    await page.goto("http://localhost:4173/");
    await page.getByRole("button", { name: "Sign in with Apple" }).waitFor();
    await page.addScriptTag({ content: AXE });
    const bad = await page.evaluate(async () => (await window.axe.run(document, { runOnly: ["color-contrast"] })).violations.length);
    check(bad === 0, `${scheme} · sign-in page: text contrast`);
    await page.close();
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
  const quiz = db.daily_quiz[0];
  check(db.daily_quiz.length === 1 && quiz.day === today && quiz.state === "failed" && quiz.recorded === true
    && quiz.revealed_hints.includes(2), `today's quiz saved to the shared table (${JSON.stringify(quiz ?? {})})`);
} finally {
  await browser.close();
  server.kill();
}
if (failures.length) { console.error(`${failures.length} check(s) failed`); process.exit(1); }
console.log("All end-to-end checks passed");
