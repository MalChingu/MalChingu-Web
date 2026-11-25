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
const PRESETS = ["Astro", "Bolt", "Camera", "Chess", "Coffee", "Game", "Rocket"];
/** Friends (my_friends()), people blocked (my_blocks()) and Delete Account calls, for the safety checks. */
const FRIEND = "99999999-9999-4999-8999-999999999991";
let FRIENDS = [];
let BLOCKS = [];
let deleteCalls = 0;
/** The account's plan, as my_plan() returns it: free (2 guides at a time) or pro. */
let PLAN = "free";

/** The stand-in database. */
const db = {
  // Every setting is its own column.
  profiles: [{ user_id: USER, name: "Test Learner", display: "both", word_notification: true, word_notification_minutes: 540, updated_at: stamp }],
  custom_words: [
    { id: "77777777-7777-4777-8777-777777777771", user_id: USER, hangul: "바다", romanization: "bada", meanings: ["sea", "ocean"], pos: "noun",
      examples: [{ korean: "바다에 가요.", romanization: "badae gayo.", english: "I go to the sea." }], tenses: null, source: "claude",
      guide_id: GUIDE, day_number: 1, created_at: stamp, updated_at: stamp },
    { id: "77777777-7777-4777-8777-777777777772", user_id: USER, hangul: "역", romanization: "yeok", meanings: ["station"], pos: "noun",
      examples: [], tenses: null, source: "claude", guide_id: GUIDE, day_number: 2, created_at: stamp, updated_at: stamp },
  ],
  word_progress: [],
  study_days: [],
  study_guides: [{ id: GUIDE, user_id: USER, title: "Travel Basics: Greetings, Directions and Asking for Help", overview: "A short test guide for greetings and directions. Day 1 covers hello and goodbye. Day 2 asks for the station.", start_date: today, total_days: 2,
    source_summary: "", created_at: stamp, updated_at: stamp }],
  guide_sessions: [
    { id: "66666666-6666-4666-8666-666666666661", guide_id: GUIDE, user_id: USER, day_number: 1, title: "Greetings", goals: ["Say hello"], grammar_notes: "Use 안녕하세요 with strangers.", vocabulary: ["바다"], updated_at: stamp },
    { id: "66666666-6666-4666-8666-666666666662", guide_id: GUIDE, user_id: USER, day_number: 2, title: "Directions", goals: [], grammar_notes: "", vocabulary: ["역"], updated_at: stamp },
  ],
  guide_tasks: [
    { id: "88888888-8888-4888-8888-888888888881", session_id: "66666666-6666-4666-8666-666666666661", guide_id: GUIDE, user_id: USER, position: 0, text: "Read the greetings list", done: false, updated_at: stamp },
    { id: "88888888-8888-4888-8888-888888888882", session_id: "66666666-6666-4666-8666-666666666661", guide_id: GUIDE, user_id: USER, position: 1, text: "Practice the vocabulary", done: false, updated_at: stamp },
    { id: "88888888-8888-4888-8888-888888888883", session_id: "66666666-6666-4666-8666-666666666662", guide_id: GUIDE, user_id: USER, position: 0, text: "Ask for the station", done: false, updated_at: stamp },
  ],
  connector_tokens: [],
  daily_quiz: [],
  user_notes: [],
  saved_translations: [],
  public_profiles: [],
};
/** The words before the My Words delete test, to put back afterwards. */
let savedWords = [];
const KEYS = { public_profiles: ["user_id"], profiles: ["user_id"], word_progress: ["user_id", "word_id"], study_days: ["user_id", "day"], daily_quiz: ["user_id", "day"] };

/** Just enough of PostgREST for this app: eq filters, upserts, updates, deletes and one RPC. */
async function fakeSupabase(route) {
  const request = route.request();
  const url = new URL(request.url());
  const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  if (url.pathname.startsWith("/auth/v1/")) return json({});
  if (url.pathname === "/rest/v1/rpc/rotate_connector_token") {
    // Like the real function: one link per account, so a second one is refused.
    if (db.connector_tokens.length) return json({ code: "P0001", message: "A connector link is already active. Turn it off first to create a new one." }, 400);
    db.connector_tokens = [{ user_id: USER, token: "kt_e2etestkey" }];
    return json("kt_e2etestkey");
  }
  // Friends: none unless a test adds some.
  if (url.pathname === "/rest/v1/rpc/my_friends") return json(FRIENDS);
  if (url.pathname === "/rest/v1/rpc/my_challenges") return json([]);
  if (url.pathname === "/rest/v1/rpc/my_blocks") return json(BLOCKS);
  if (url.pathname === "/rest/v1/rpc/block_user") {
    // Like the real function: the friendship goes and they join your blocked list.
    const { p_user } = request.postDataJSON();
    const friend = FRIENDS.find((f) => f.user_id === p_user);
    FRIENDS = FRIENDS.filter((f) => f.user_id !== p_user);
    BLOCKS = [{ user_id: p_user, username: friend?.username ?? null, name: friend?.name ?? null, avatar: friend?.avatar ?? null, created_at: stamp }, ...BLOCKS];
    return json(null);
  }
  if (url.pathname === "/rest/v1/rpc/unblock_user") {
    const { p_user } = request.postDataJSON();
    BLOCKS = BLOCKS.filter((b) => b.user_id !== p_user);
    return json(null);
  }
  if (url.pathname === "/functions/v1/delete-account") { deleteCalls++; return json({ deleted: true }); }
  if (url.pathname === "/rest/v1/rpc/username_available") return json(true);
  if (url.pathname === "/rest/v1/rpc/my_plan") {
    return json({ plan: PLAN, guide_limit: PLAN === "pro" ? null : 2, guides: db.study_guides.length });
  }
  if (url.pathname === "/rest/v1/rpc/record_daily_quiz") {
    // Like the real function: claim today's quiz and save the count together, or do nothing.
    const { p_day, p_word_id, p_progress, p_study_day } = request.postDataJSON();
    const quiz = db.daily_quiz.find((q) => q.day === p_day && q.word_id === p_word_id && !q.recorded);
    if (!quiz) return json(false);
    quiz.recorded = true;
    const upsert = (rows, item, keys) => {
      const existing = rows.find((r) => keys.every((k) => r[k] === item[k]));
      if (existing) Object.assign(existing, item); else rows.push({ ...item });
    };
    upsert(db.word_progress, { ...p_progress, user_id: USER }, ["user_id", "word_id"]);
    upsert(db.study_days, { ...p_study_day, user_id: USER }, ["user_id", "day"]);
    return json(true);
  }
  const table = url.pathname.replace("/rest/v1/", "");
  const rows = db[table];
  if (!rows) return json({ message: `unknown table ${table}` }, 404);
  const filters = [...url.searchParams].filter(([k, v]) => v.startsWith("eq.")).map(([k, v]) => [k, v.slice(3)]);
  const lists = [...url.searchParams].filter(([k, v]) => v.startsWith("in.(")).map(([k, v]) => [k, v.slice(4, -1).split(",").map((x) => x.replace(/^"|"$/g, ""))]);
  const matches = (row) => filters.every(([k, v]) => String(row[k]) === v) && lists.every(([k, vs]) => vs.includes(String(row[k])));
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
    // Like Postgres: rows are matched and changed in one step, so two claims can't both win.
    const changed = rows.filter(matches);
    changed.forEach((r) => Object.assign(r, request.postDataJSON()));
    if ((request.headers()["prefer"] ?? "").includes("return=representation")) return json(changed);
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

    if (label === "phone") {
      // First sign-in: name, then a username (for good), then a picture; then a tour of the four pages.
      const setup = page.getByRole("dialog", { name: "Set Up Your Profile" });
      await setup.waitFor({ timeout: 15000 });
      check(await setup.getByLabel("Your name").inputValue() === "Test Learner", "onboarding starts with the name filled in");
      await setup.getByRole("button", { name: "Continue" }).click();
      await setup.getByText("Available").waitFor();
      const suggested = await setup.getByLabel("Username").inputValue();
      check(suggested === "testlearner", `onboarding suggests a username from the name (${suggested})`);
      check(await setup.getByText("This cannot be changed later.").isVisible(), "the username step says it can't be changed later");
      await page.screenshot({ path: "screenshots/onboarding-username.png" });
      await setup.getByRole("button", { name: "Continue" }).click();
      await setup.getByRole("heading", { name: "Choose a Picture" }).waitFor();
      const choices = setup.getByRole("radiogroup", { name: "Profile picture" }).getByRole("radio");
      check(await choices.count() === 8 && await setup.getByRole("radio", { name: "Upload your own photo with Pro" }).isVisible(),
        "the picture step offers the seven presets and an upload tile (Pro)");
      check(await setup.locator('[role="radio"][aria-checked="true"]').count() === 1, "one picture is picked for you");
      check(await setup.locator('input[type="file"]').count() === 0, "a free account can't upload a photo");
      await setup.getByRole("radio", { name: "Rocket" }).click();
      check(await setup.getByRole("radio", { name: "Rocket" }).getAttribute("aria-checked") === "true", "tapping a picture picks it");
      check(await setup.getByRole("button", { name: "Shuffle" }).count() === 0, "there's no Shuffle button");
      // Back is the arrow at the card's top left.
      check(await setup.getByRole("button", { name: "Back", exact: true }).count() === 1, "Back is one arrow, not a button beside Continue");
      await setup.getByRole("button", { name: "Back", exact: true }).click();
      await setup.getByRole("heading", { name: "Choose a Username" }).waitFor();
      await setup.getByRole("button", { name: "Continue" }).click();
      await setup.getByRole("heading", { name: "Choose a Picture" }).waitFor();
      check(await setup.getByRole("radio", { name: "Rocket" }).getAttribute("aria-checked") === "true", "going back keeps the chosen picture");
      check(await setup.locator(".onboarding-avatar img").evaluate((img) => img.complete && img.naturalWidth === 128), "the picture loads");
      await page.screenshot({ path: "screenshots/onboarding-picture.png" });
      await setup.getByRole("button", { name: "Start Learning" }).click();
      await setup.waitFor({ state: "detached" });
      check(db.public_profiles[0]?.username === "testlearner", "the username is saved");
      const saved = db.profiles[0].avatar;
      check(saved === "Rocket", `the picture is saved by its preset key (${saved})`);
      const tour = page.getByRole("dialog", { name: /^Tour:/ });
      await tour.waitFor();
      for (const stop of ["Today", "Flashcards", "Guides", "Stats"]) {
        check(await page.getByRole("dialog", { name: `Tour: ${stop}` }).isVisible(), `the tour shows ${stop}`);
        await tour.getByRole("button", { name: stop === "Stats" ? "Done" : "Next" }).click();
      }
      await tour.waitFor({ state: "detached" });
      check(db.profiles[0].tour_done === true, "the tour is shown once");
    }

    await page.getByRole("heading", { name: "Welcome Back, Test" }).waitFor({ timeout: 15000 });
    check(true, `${label}: Today greets by name`);
    await page.getByText(/Travel Basics.* · Day 1 of 2/).waitFor();
    check(true, `${label}: today's guide session shows`);
    // The streak is a star beside the greeting (under it, centred, on a phone); no streak card or stat tiles.
    const star = page.locator(".page-header .streak-star");
    check(await star.isVisible() && /^\d+-day streak$/.test(await star.getAttribute("aria-label")), `${label}: Today shows the streak star`);
    check(await page.locator(".stat-tile").count() === 0 && await page.getByText("Words Practiced").count() === 0,
      `${label}: Today has no streak card or stat tiles`);
    const header = await page.locator(".page-header").boundingBox();
    const titleBox = await page.locator(".page-header h1").boundingBox();
    const starBox = await star.boundingBox();
    if (label === "phone") {
      check(starBox.y >= titleBox.y + titleBox.height - 2 && Math.abs(starBox.x + starBox.width / 2 - (header.x + header.width / 2)) < 3
        && await page.locator(".page-header h1").evaluate((h) => getComputedStyle(h).textAlign) === "center",
        "phone: the star sits under the centred greeting");
    } else {
      check(starBox.x >= titleBox.x + titleBox.width - 2 && starBox.y < titleBox.y + titleBox.height, "desktop: the star sits right of the greeting");
    }
    const [wotd, content, guideCard] = [await page.locator(".wotd").boundingBox(), await page.locator(".page-content").boundingBox(),
      await page.locator(".today-guides .card").first().boundingBox()];
    check(Math.abs(wotd.width - content.width) < 2 && Math.abs(guideCard.width - content.width) < 2,
      `${label}: the word of the day and today's guide run full width`);

    if (label === "phone") {
      // Word of the day quiz: a wrong guess opens hint 1, X reveals the answer.
      await page.getByLabel("Meaning in English").fill("zzz not it");
      await page.getByRole("button", { name: "Check answer" }).click();
      await page.getByText("Hint 1").waitFor();
      check(await page.getByText("Not quite. 2 tries left.").isVisible(), "wrong guess opens hint 1 and costs a try");
      check(await page.locator(".hint-open .glossed").count() === 1 && await page.locator(".hint-open .glossed-word.target").count() >= 1,
        "beginner: hint 1 shows each word's English, the asked word without");
      await page.getByRole("button", { name: "Tap to Show Hint 3" }).click();
      check(await page.getByText("Hint 3").isVisible(), "tapping a hint opens it");
      await page.screenshot({ path: `screenshots/today-quiz-${label}.png` });
      await page.getByRole("button", { name: "I don't know, show the answer" }).click();
      await page.getByText(/The answer is/).waitFor();
      check(true, "X reveals the answer");
      await page.reload();
      await page.getByText(/The answer is/).waitFor({ timeout: 15000 });
      check(true, "quiz result is kept after a reload");

      // Once the guess is done: a microphone on the right of the result line to practice saying the word, as often
      // as you like, with ✓ or ✗ beside it. (A stand-in recogniser "hears" window.__say.)
      await page.addInitScript(() => {
        class FakeRecognition {
          start() { setTimeout(() => { this.onresult?.({ results: [[{ transcript: window.__say ?? "" }]] }); this.onend?.(); }, 50); }
          stop() { this.onend?.(); }
        }
        window.SpeechRecognition = FakeRecognition;
        window.webkitSpeechRecognition = FakeRecognition;
      });
      await page.reload();
      const mic = page.locator(".quiz-result .say-practice .mic");
      await mic.waitFor({ timeout: 15000 });
      const word = (await mic.getAttribute("aria-label")).replace("Practice Saying ", "");
      const [line, micBox] = [await page.locator(".quiz-result").boundingBox(), await mic.boundingBox()];
      check(micBox.x + micBox.width > line.x + line.width - 40 && micBox.y < line.y + line.height && micBox.y + micBox.height > line.y,
        "after the guess, a microphone sits on the right of the result line");
      await page.evaluate((w) => { window.__say = w; }, word);
      await mic.click();
      await page.locator(".say-mark.right").waitFor({ timeout: 5000 });
      await page.evaluate(() => { window.__say = "바나나우유"; });
      await mic.click();
      await page.locator(".say-mark.wrong").waitFor({ timeout: 5000 });
      await page.evaluate((w) => { window.__say = w; }, word);
      await mic.click();
      await page.locator(".say-mark.right").waitFor({ timeout: 5000 });
      check(true, `saying ${word} shows ✓, something else ✗, and it can be tried again and again`);
      await page.locator(".quiz-result").screenshot({ path: "screenshots/say-practice.png" });

      // Guide task toggles.
      await page.getByRole("checkbox", { name: "Read the greetings list" }).click();
      check(await page.getByRole("checkbox", { name: "Read the greetings list" }).getAttribute("aria-checked") === "true", "guide task ticks");

      // Flashcards: a three-card round.
      await page.getByRole("button", { name: "Flashcards" }).click();
      await page.getByRole("button", { name: "Fewer cards" }).click();
      await page.getByRole("button", { name: "Start" }).click();
      await page.getByRole("heading", { name: /1 \/ \d+/ }).waitFor();
      await page.screenshot({ path: `screenshots/flashcard-${label}.png` });
      const total = Number((await page.getByRole("heading", { name: /1 \/ \d+/ }).textContent()).split("/")[1]);
      const answerBox = page.getByLabel("Meaning of the dictionary form, in English");
      for (let i = 0; i < total; i++) {
        if (i % 2 === 0) {
          await page.getByRole("button", { name: "I don't know" }).click();
        } else if (i === 1) {
          // Return submits the answer (and shows it, since it's wrong).
          await answerBox.fill("definitely wrong");
          await page.keyboard.press("Enter");
          await page.getByText("Your answer: “definitely wrong”").waitFor();
          check(await answerBox.count() === 0, "Return submits a flashcard");
        } else {
          await answerBox.fill("definitely wrong");
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
      if (tab === "Profile") check(await page.getByRole("dialog", { name: "Set Up Your Profile" }).count() === 0, `${label}: set-up is only once`);
      await page.screenshot({ path: `screenshots/${tab.toLowerCase()}-${label}.png`, fullPage: label === "desktop" });
    }
    await page.getByRole("button", { name: "Guides", exact: true }).click();
    await page.getByRole("button", { name: /Travel Basics/ }).click();
    await page.getByText("Vocabulary · 1").first().waitFor();
    check(await page.locator(".guide-main .card h3").count() === 1, `${label}: guide shows one day at a time`);
    const titleFit = await page.locator("h1.fit-title").evaluate((h1) => ({
      lines: h1.scrollHeight / parseFloat(getComputedStyle(h1).lineHeight), cut: h1.scrollWidth > h1.clientWidth,
      size: parseFloat(getComputedStyle(h1).fontSize) }));
    check(titleFit.lines <= 2.1 && !titleFit.cut, `${label}: long guide title fits in two lines, not cut off (${JSON.stringify(titleFit)})`);
    check(await page.locator(".points li").count() === 3, `${label}: overview shows as points`);
    await page.getByRole("button", { name: "Next day" }).click();
    check(await page.getByRole("heading", { name: "Directions", exact: true }).isVisible(), `${label}: next-day button switches day`);
    await page.locator(".day-item").first().click();
    check(await page.getByRole("heading", { name: "Greetings", exact: true }).isVisible(), `${label}: day list switches day`);
    await page.getByRole("button", { name: "Guide Options" }).click();
    check(await page.getByRole("menuitem", { name: "Edit Title" }).isVisible(), `${label}: the ⋯ menu offers Edit Title`);
    await page.getByRole("menuitem", { name: "Delete Guide" }).click();
    check(await page.getByRole("alertdialog", { name: "Delete This Guide?" }).isVisible(), `${label}: deleting a guide asks first`);
    await page.getByRole("button", { name: "Cancel" }).click();
    check(await page.getByRole("alertdialog").count() === 0 && db.study_guides.length === 1, `${label}: cancel keeps the guide`);
    await page.screenshot({ path: `screenshots/guide-${label}.png`, fullPage: true });

    await page.getByRole("button", { name: "Profile", exact: true }).click();
    check(await page.locator(".profile-name").innerText() === "Test Learner", `${label}: profile shows the name`);
    check(await page.getByText("@testlearner").isVisible(), `${label}: profile shows the username`);
    if (label === "phone") {
      // Edit Profile: the pencil (or the picture) opens one sheet for the name and the picture.
      await page.getByRole("button", { name: "Change profile picture" }).click();
      const sheet = page.getByRole("dialog", { name: "Edit Profile" });
      check(await sheet.getByText(/@testlearner/).count() === 0 && await sheet.getByRole("textbox").count() === 1,
        "Edit Profile has the name and picture only, not the username");
      check(await sheet.getByRole("radio").count() === 8, "Edit Profile offers the seven presets and the upload tile");
      let chooser = false;
      page.once("filechooser", () => { chooser = true; });
      await sheet.getByRole("radio", { name: "Upload your own photo with Pro" }).click();
      await page.waitForTimeout(300);
      check(!chooser && await sheet.locator('input[type="file"]').count() === 0 && await page.getByRole("dialog", { name: "Upgrade to Pro" }).isVisible(),
        "free: the upload tile opens Upgrade to Pro instead of a file");
      await page.keyboard.press("Escape");
      await page.getByRole("dialog", { name: "Upgrade to Pro" }).waitFor({ state: "detached" });
      check(await sheet.isVisible(), "Esc closes Upgrade to Pro and leaves Edit Profile open");
      await sheet.getByRole("radio", { name: "Coffee" }).click();
      await page.screenshot({ path: "screenshots/edit-profile-phone.png" });
      await sheet.getByRole("button", { name: "Save" }).click();
      await sheet.waitFor({ state: "detached" });
      await page.waitForLoadState("networkidle");
      check(db.profiles[0].avatar === "Coffee", "Edit Profile saves the new picture");
      check((await page.locator(".profile-card img.avatar").getAttribute("src")) === "/profile/Coffee.png", "the profile card shows the new picture");
      await page.getByRole("button", { name: "Edit Profile" }).click();
      const editor = page.getByRole("dialog", { name: "Edit Profile" });
      check(await editor.getByRole("button", { name: "Cancel" }).count() === 0 && await editor.getByRole("button", { name: "Save" }).isDisabled(),
        "Edit Profile has no Cancel, and Save waits for a change");
      await editor.getByLabel("Your name").fill("Test Learner!");
      check(await editor.getByRole("button", { name: "Save" }).isEnabled(), "a change turns Save on");
      await page.keyboard.press("Escape");
      await editor.waitFor({ state: "detached" });
      check(await page.getByText("Take the Tour").count() === 0, "Profile has no Take the Tour");
      // Phones have no sidebar: the plan shows in Profile.
      check(await page.locator(".plan-profile").getByRole("button", { name: "Upgrade to Pro" }).isVisible(), "phone: Upgrade to Pro shows in Profile");
      check(await page.locator(".plan-profile").getByText("1 of 2 guides").isVisible(), "phone: Profile shows the guide count");
      const [text, upgradeBox] = [await page.locator(".plan-profile .plan-card-text").boundingBox(), await page.locator(".plan-profile .button").boundingBox()];
      check(upgradeBox.x > text.x + text.width - 1, "phone: Upgrade to Pro sits to the right of the note");
    } else {
      // Wide screens: Upgrade to Pro at the bottom of the sidebar, above Text Size; not in Profile.
      const upgrade = page.locator(".tabs").getByRole("button", { name: "Upgrade to Pro" });
      const above = (await upgrade.boundingBox()).y < (await page.locator(".tab.text-size").boundingBox()).y;
      check(await upgrade.isVisible() && above, "desktop: Upgrade to Pro sits above Text Size in the sidebar");
      check(!(await page.locator(".plan-profile").isVisible()), "desktop: Profile leaves the plan to the sidebar");
    }
    check(await page.getByText("Beginner").isVisible(), `${label}: profile shows the level`);
    const borders = await page.evaluate(() => ({
      card: getComputedStyle(document.querySelector(".profile-card")).borderTopColor,
      badge: getComputedStyle(document.querySelector(".level-tag .level-icon")).color }));
    check(borders.card === borders.badge, `${label}: profile card border matches the level badge (${JSON.stringify(borders)})`);
    await page.getByRole("radio", { name: "Settings", exact: true }).click();
    await page.getByText("Claude Connector", { exact: true }).waitFor();
    check(await page.getByRole("button", { name: "Create a New Link" }).count() === 0, `${label}: no way to replace an active link`);
    check(errors.length === 0, `${label}: no page errors${errors.length ? ": " + errors.join("; ") : ""}`);
    await page.waitForLoadState("networkidle");   // let the last saves finish before closing
    await context.close();
  }

  // No dark mode: a dark device (or an old saved Dark choice) still gets the light look, and there's no Appearance setting.
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: "dark" });
    await context.route("https://nxlsnpzfbazwlccxtwpt.supabase.co/**", fakeSupabase);
    await context.addInitScript((value) => {
      localStorage.setItem("sb-nxlsnpzfbazwlccxtwpt-auth-token", value);
      localStorage.setItem("malchingu.theme", "dark");
    }, JSON.stringify(session));
    const page = await context.newPage();
    const look = () => page.evaluate(() => ({ base: getComputedStyle(document.documentElement).getPropertyValue("--base").trim(),
      scheme: getComputedStyle(document.documentElement).colorScheme, body: getComputedStyle(document.body).backgroundColor }));
    await page.goto("http://localhost:4173/#today");
    await page.getByRole("heading", { name: "Welcome Back, Test" }).waitFor({ timeout: 15000 });
    const today = await look();
    check(today.base === "#f4f3fb" && today.scheme === "light" && today.body === "rgb(244, 243, 251)",
      `a dark device still gets the light look (${JSON.stringify(today)})`);
    await page.screenshot({ path: "screenshots/today-on-dark-device.png" });
    await page.goto("http://localhost:4173/#profile");
    await page.getByRole("radio", { name: "Settings", exact: true }).click({ timeout: 15000 });
    await page.getByText("Word of the Day", { exact: true }).waitFor();
    check(await page.getByText("Appearance", { exact: true }).count() === 0, "Profile → Settings has no Appearance setting");
    await page.waitForLoadState("networkidle");
    await context.close();
  }

  // Every screen and dialog: text contrast (axe-core), the chosen tab's colours,
  // equal content widths across pages, and nothing spilling sideways on a phone.
  const expectedTab = { light: ["rgb(21, 19, 43)", "rgb(244, 243, 251)"] };
  for (const scheme of ["light"]) {
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
      `${scheme}: chosen tab is dark with light text (${chosen})`);
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
    await page.getByRole("button", { name: "Select Words" }).click();
    await page.getByRole("checkbox", { name: "Select 바다" }).click();
    check(await page.getByRole("heading", { name: "1 Selected" }).isVisible(), `${scheme}: selecting a word counts it`);
    await audit("My Words selecting", "my-words-select");
    await page.getByRole("button", { name: "Done Selecting" }).click();

    await tab("Guides");
    await audit("Guides", "guides"); await width("Guides");
    await page.getByRole("button", { name: "Create Guide" }).click();
    await audit("Create Guide sheet", "create-guide");
    check(await page.getByRole("button", { name: "Continue in Claude" }).count() === 0, `${scheme}: no Continue in Claude button on the web`);
    check(await page.locator("textarea[aria-label='Focus']").getAttribute("rows") === "3", `${scheme}: focus box is three lines`);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: /Travel Basics/ }).click();
    await audit("Guide detail", "guide"); await width("Guide detail");
    await page.getByRole("button", { name: "Guide Options" }).click();
    check(await page.getByRole("menuitem", { name: "Edit Title" }).isVisible(), `${scheme}: the ⋯ menu offers Edit Title`);
    await page.getByRole("menuitem", { name: "Delete Guide" }).click();
    await audit("Delete confirmation", "confirm");
    await page.getByRole("button", { name: "Cancel" }).click();
    // A day's vocabulary is a section that starts closed.
    await page.getByRole("button", { name: "Vocabulary · 1" }).click();
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
    const tones = await page.locator(".stat-tile").evaluateAll((els) => Object.fromEntries(els.map((e) =>
      [e.querySelector(".muted").textContent, getComputedStyle(e.querySelector("svg")).color])));
    const v = await page.evaluate(() => Object.fromEntries(["--orange", "--red", "--accent", "--green", "--yellow", "--text"].map((n) => {
      const probe = document.createElement("span"); probe.style.color = `var(${n})`; document.body.append(probe);
      const c = getComputedStyle(probe).color; probe.remove(); return [n, c];
    })));
    const wanted = { "Day Streak": "--orange", "Days Studied": "--red", "Words Practiced": "--accent", "Words Mastered": "--green",
      "Accuracy": "--yellow", "Answers": "--text" };
    const wrong = Object.entries(wanted).filter(([name, token]) => tones[name] !== v[token]);
    check(wrong.length === 0, `${scheme}: stat icons are coloured${wrong.length ? " (" + wrong.map(([n]) => `${n}: ${tones[n]}`).join(", ") + ")" : ""}`);

    await tab("Profile");
    await audit("Profile", "profile"); await width("Profile");
    const selectsOnAbout = await page.locator("select").count();
    await page.getByRole("button", { name: "Sign Out" }).click();
    await audit("Sign-out confirmation");
    await page.getByRole("button", { name: "Cancel" }).click();
    // Profile → Settings: appearance, username, word of the day, voice and the connector.
    const settingsPart = () => page.getByRole("radio", { name: "Settings", exact: true }).click();
    await settingsPart();
    await audit("Profile settings", "profile-settings");
    check(selectsOnAbout === 0 && await page.locator("select").count() === 0, `${scheme}: no native select boxes`);

    // Connector: one link per account. Creating shows it; the only way to a new one is to turn it off first.
    db.connector_tokens = [];
    await page.reload();
    await settingsPart();
    await page.getByRole("button", { name: "Create Connector Link" }).click();
    await page.getByRole("button", { name: "Copy Connector Link" }).waitFor();
    check(await page.getByText("kt_e2etestkey").isVisible() && await page.getByRole("button", { name: /Create/ }).count() === 0,
      `${scheme}: an active link shows, with no button to make another`);
    await audit("Profile with a connector link");
    await page.getByRole("button", { name: "Turn Off Connector" }).click();
    check(await page.getByRole("alertdialog", { name: "Turn Off the Connector?" }).isVisible(), `${scheme}: turning off the link asks first`);
    await page.getByRole("button", { name: "Turn Off", exact: true }).click();
    await page.getByRole("button", { name: "Create Connector Link" }).waitFor();
    check(db.connector_tokens.length === 0, `${scheme}: turning off removes the link`);
    // A link made on another device shows here too.
    db.connector_tokens = [{ user_id: USER, token: "kt_otherdevice" }];
    await page.reload();
    await settingsPart();
    await page.getByText("kt_otherdevice").waitFor({ timeout: 10000 });
    check(true, `${scheme}: a link made on another device shows here`);
    db.connector_tokens = [];

    // The Profile tab uses the learner's picture when there is one; an old default picture shows the default preset.
    db.profiles[0].avatar = "Rocket";
    await page.reload();
    await page.locator("img.tab-avatar").first().waitFor({ timeout: 10000 });
    check(await page.locator("img.tab-avatar").first().evaluate((img) => img.complete && img.naturalWidth > 0), `${scheme}: profile tab shows the picture`);
    db.profiles[0].avatar = "default:3";
    await page.reload();
    await page.locator("img.tab-avatar").first().waitFor({ timeout: 10000 });
    check((await page.locator("img.tab-avatar").first().getAttribute("src")) === "/profile/Astro.png", `${scheme}: an old default picture shows the default preset`);
    delete db.profiles[0].avatar;
    await page.reload();
    await page.getByRole("heading", { name: "Profile" }).waitFor();

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


  // Loading: while the data is on its way, pages show the three dots instead of half-loaded content.
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    let slow = true;
    await context.route("https://nxlsnpzfbazwlccxtwpt.supabase.co/**", async (route) => {
      if (slow && route.request().url().includes("/rest/v1/")) await new Promise((r) => setTimeout(r, 1500));
      return fakeSupabase(route);
    });
    await context.addInitScript((value) => localStorage.setItem("sb-nxlsnpzfbazwlccxtwpt-auth-token", value), JSON.stringify(session));
    const page = await context.newPage();
    await page.goto("http://localhost:4173/#today");
    await page.locator(".loading-dots").waitFor({ timeout: 5000 });
    check(await page.getByRole("status", { name: "Loading" }).isVisible() && await page.getByText("Word of the Day").count() === 0,
      "Today shows loading dots, not the word, until the data arrives");
    const lit = await page.locator(".loading-dots span").evaluateAll((dots) => dots.map((d) => getComputedStyle(d).animationDelay));
    check(lit.join() === "0s,0.35s,0.7s", `the dots light up one after another (${lit})`);
    await page.getByText("Word of the Day").waitFor({ timeout: 10000 });
    check(await page.locator(".loading-dots").count() === 0, "the dots go once the word of the day has loaded");
    slow = false;
    for (const name of ["Flashcards", "Guides", "Stats", "Profile"]) {
      await page.getByRole("button", { name, exact: true }).click();
      check(await page.locator(".loading-dots").count() === 0, `${name}: no dots once loaded`);
    }
    slow = true;
    await page.reload();
    await page.getByRole("heading", { name: "Profile" }).waitFor();
    check(await page.locator(".loading-dots").isVisible(), "Profile also waits with dots while loading");
    await page.locator(".profile-name").waitFor({ timeout: 10000 });
    await context.close();
  }

  // My Words: select several words and delete them together.
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.route("https://nxlsnpzfbazwlccxtwpt.supabase.co/**", fakeSupabase);
    await context.addInitScript((value) => localStorage.setItem("sb-nxlsnpzfbazwlccxtwpt-auth-token", value), JSON.stringify(session));
    const page = await context.newPage();
    await page.goto("http://localhost:4173/#flashcards");
    await page.getByRole("button", { name: /My Words/ }).click();
    await page.getByRole("button", { name: "Select Words" }).click();
    check(await page.getByRole("button", { name: "Delete", exact: true }).isDisabled(), "delete is off until a word is selected");
    await page.getByRole("button", { name: "Select All" }).click();
    check(await page.getByRole("heading", { name: "2 Selected" }).isVisible(), "Select All picks every word");
    await page.getByRole("button", { name: "Delete 2 Words" }).click();
    check(await page.getByRole("alertdialog", { name: "Delete 2 Words?" }).isVisible(), "deleting several words asks first");
    await page.getByRole("button", { name: "Cancel" }).click();
    savedWords = db.custom_words.map((w) => ({ ...w }));
    check(db.custom_words.length === 2, "cancel keeps the words");
    await page.getByRole("checkbox", { name: "Select 역" }).click();   // untick one
    await page.getByRole("button", { name: "Delete 1 Word" }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await page.getByRole("heading", { name: "My Words" }).waitFor();
    await page.waitForLoadState("networkidle");
    const gone = savedWords.filter((w) => !db.custom_words.some((k) => k.id === w.id)).map((w) => w.hangul);
    check(gone.length === 1 && gone[0] === "바다", `only the selected word is deleted (${gone})`);
    check(await page.getByText("역").first().isVisible() && await page.getByRole("checkbox").count() === 0,
      "the rest stay, and selecting ends");
    await page.screenshot({ path: "screenshots/my-words-after-delete.png" });
    await context.close();
  }

  // Plans: a free account holds 2 guides at a time and sees the count with Upgrade to Pro; Pro sees a badge and no limit.
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
    await context.route("https://nxlsnpzfbazwlccxtwpt.supabase.co/**", fakeSupabase);
    await context.addInitScript((value) => localStorage.setItem("sb-nxlsnpzfbazwlccxtwpt-auth-token", value), JSON.stringify(session));
    const page = await context.newPage();
    const limit = page.locator(".guide-limit");
    await page.goto("http://localhost:4173/#guides");
    await limit.waitFor({ timeout: 15000 });
    check(await limit.getByText("1 of 2 guides").isVisible() && await limit.getByRole("button", { name: "Upgrade to Pro" }).isVisible(),
      "free, 1 guide: Guides shows 1 of 2 with Upgrade to Pro");
    const second = { ...db.study_guides[0], id: "55555555-5555-4555-8555-555555555556", title: "Second Guide", created_at: stamp };
    db.study_guides.push(second);
    await page.reload();
    await limit.getByText("2 of 2 guides").waitFor({ timeout: 15000 });
    check(await limit.getByText("You've maxed out your guides. Upgrade to Pro for Unlimited Guides").isVisible(),
      "free, 2 guides: Guides says the guides are maxed out");
    const [note, button] = [await limit.locator(".guide-limit-text").boundingBox(), await limit.getByRole("button").boundingBox()];
    check(button.x > note.x + note.width - 1 && button.y < note.y + note.height && note.y < button.y + button.height,
      "free, 2 guides: Upgrade to Pro sits to the right of the note, in line with it");
    await page.screenshot({ path: "screenshots/guides-limit-reached.png" });
    // Upgrade to Pro floats up from the button, inside the sidebar: Coming Soon (no price until checkout is set up) and
    // what Pro adds, a ✓ and the feature per line. A click outside or Esc closes it.
    const fromButton = page.locator(".tabs").getByRole("button", { name: "Upgrade to Pro" });
    await fromButton.click();
    const upgrade = page.getByRole("dialog", { name: "Upgrade to Pro" });
    await upgrade.waitFor();
    await page.waitForTimeout(350);
    const [modalBox, buttonBox] = [await upgrade.boundingBox(), await fromButton.boundingBox()];
    check((await upgrade.locator(".upgrade-price").innerText()).trim() === "Coming Soon" && await upgrade.locator(".upgrade-benefits li").count() === 4
      && await upgrade.getByRole("button", { name: "Coming Soon" }).isDisabled(), "Upgrade to Pro says Coming Soon (no price yet, button off) and lists four things Pro adds");
    check(modalBox.y + modalBox.height <= buttonBox.y + 1, "Upgrade to Pro floats up above the button that opened it");
    const sideBox = await page.locator(".tabs").boundingBox();
    check(modalBox.x >= sideBox.x && modalBox.x + modalBox.width <= sideBox.x + sideBox.width
      && await upgrade.locator(".upgrade-check").count() === 4 && await upgrade.getByText("Free:").count() === 0,
      "Upgrade to Pro fits inside the sidebar, with a green ✓ and the feature on each line");
    await page.screenshot({ path: "screenshots/upgrade-modal.png" });
    await page.keyboard.press("Escape");
    await upgrade.waitFor({ state: "detached" });
    await fromButton.click();
    await upgrade.waitFor();
    await page.mouse.click(1200, 40);
    await upgrade.waitFor({ state: "detached" });
    check(true, "Upgrade to Pro closes with Esc and a click outside");
    await page.getByRole("button", { name: "Create Guide" }).click();
    const sheet = page.getByRole("dialog", { name: "Create Guide" });
    check(await sheet.getByText(/maxed out/).count() === 0 && await sheet.getByRole("button", { name: "Upgrade to Pro" }).count() === 0,
      "Create Guide has no limit note or button");
    // Free accounts: guides of up to a week. A longer length opens Upgrade to Pro instead.
    const modal = page.getByRole("dialog", { name: "Upgrade to Pro" });
    await sheet.getByRole("radio", { name: "2 weeks" }).click();
    await modal.waitFor();
    check(await sheet.getByRole("radio", { name: "1 week" }).getAttribute("aria-checked") === "true",
      "free: 2 weeks opens Upgrade to Pro and keeps 1 week");
    await page.screenshot({ path: "screenshots/upgrade-from-length.png" });
    // No ✕: a click outside closes it.
    check(await modal.getByRole("button", { name: "Close" }).count() === 0, "Upgrade to Pro has no ✕ (a click outside or Esc closes it)");
    await page.mouse.click(5, 5);
    await modal.waitFor({ state: "detached" });
    await sheet.getByRole("button", { name: "More days" }).click();
    await modal.waitFor();
    check(await sheet.getByText("7 days").isVisible(), "free: + past 7 days opens Upgrade to Pro");
    await page.keyboard.press("Escape");
    await modal.waitFor({ state: "detached" });
    await page.keyboard.press("Escape");
    // On a phone too, the button stays to the right of the note.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(200);
    const [noteP, buttonP] = [await limit.locator(".guide-limit-text").boundingBox(), await limit.getByRole("button").boundingBox()];
    check(buttonP.y >= noteP.y + noteP.height - 1 && Math.abs(buttonP.width - noteP.width) < 2,
      "phone, 2 guides: Upgrade to Pro sits under the note, full width");
    await page.screenshot({ path: "screenshots/guides-limit-phone.png" });
    await page.setViewportSize({ width: 1280, height: 860 });
    PLAN = "pro";
    await page.reload();
    const badge = page.locator(".tabs .pro-badge");
    await badge.waitFor({ timeout: 15000 });
    check((await badge.boundingBox()).y < (await page.locator(".tab.text-size").boundingBox()).y, "pro: the sidebar shows a Pro badge above Text Size");
    check(await limit.count() === 0 && await page.getByRole("button", { name: "Upgrade to Pro" }).count() === 0, "pro: no limit note or Upgrade button");
    await page.screenshot({ path: "screenshots/guides-pro.png" });
    // The Pro badge shines when pointed at and opens what Pro adds, without the price or a button.
    await badge.hover();
    await page.waitForTimeout(400);
    const shine = await badge.evaluate((el) => getComputedStyle(el, "::after").transform);
    check(shine !== "none" && !shine.includes("-"), `pro: pointing at the badge sweeps a shine across it (${shine})`);
    // Pointing at the badge shows what Pro adds (inside the sidebar, a ✓ and the feature on each line, no price, no
    // buttons); it goes when the pointer leaves.
    const features = page.getByRole("dialog", { name: "Korimal Pro" });
    await features.waitFor();
    await page.waitForTimeout(350);
    const [side, card] = [await page.locator(".tabs").boundingBox(), await features.boundingBox()];
    check(await features.locator(".upgrade-benefits li").count() === 4 && await features.locator(".upgrade-check").count() === 4
      && await features.getByText("Coming Soon").count() === 0 && await features.locator(".upgrade-price").count() === 0
      && await features.getByRole("button").count() === 0 && await features.getByText("Free:").count() === 0,
      "pro: hovering the badge shows what Pro adds: a ✓ and the feature per line, no price, no buttons, no ✕");
    check(card.x >= side.x && card.x + card.width <= side.x + side.width, "pro: what Pro adds fits inside the sidebar");
    await page.screenshot({ path: "screenshots/pro-features.png" });
    await page.mouse.move(700, 400);
    await features.waitFor({ state: "detached" });
    check(true, "pro: it goes when the pointer leaves the badge");
    // Sidebar buttons: a 2px border like the profile card's, and the label centred against the icon.
    const tab = page.locator(".tab.on").first();
    const [tabBox, labelBox, border] = await tab.evaluate((el) => {
      const label = [...el.children].find((c) => !c.classList.contains("tab-icon"));
      const r = el.getBoundingClientRect(); const l = label.getBoundingClientRect();
      return [{ y: r.y, h: r.height }, { y: l.y, h: l.height }, getComputedStyle(el).borderTopWidth];
    });
    const off = Math.abs((labelBox.y + labelBox.h / 2) - (tabBox.y + tabBox.h / 2));
    check(border === "2px" && off < 1, `sidebar: 2px border and the label centred (border ${border}, ${off.toFixed(2)}px off centre)`);
    // Pro: upload your own photo in Edit Profile; it's saved as a small JPEG.
    const before = db.profiles[0].avatar;
    await page.getByRole("button", { name: "Profile", exact: true }).click();
    await page.getByRole("button", { name: "Change profile picture" }).click();
    const editor = page.getByRole("dialog", { name: "Edit Profile" });
    const [picker] = await Promise.all([page.waitForEvent("filechooser"), editor.getByRole("radio", { name: "Upload your own photo" }).click()]);
    await picker.setFiles("public/profile/Chess.png");
    await editor.locator(".onboarding-avatar img[src^='data:image/jpeg']").waitFor();
    check(await editor.getByRole("radio", { name: "Your photo. Choose another" }).getAttribute("aria-checked") === "true"
      && await editor.locator('[role="radio"][aria-checked="true"]').count() === 1, "pro: the upload tile shows the photo, chosen instead of a preset");
    await page.screenshot({ path: "screenshots/edit-profile-pro.png" });
    await editor.getByRole("button", { name: "Save" }).click();
    await page.waitForLoadState("networkidle");
    const photo = db.profiles[0].avatar ?? "";
    check(photo.startsWith("/9j/") && photo.length < 24000, `pro: the photo is saved as a small JPEG (${photo.length} characters)`);
    check((await page.locator(".profile-card img.avatar").getAttribute("src")).startsWith("data:image/jpeg"), "pro: the profile card shows the photo");
    db.profiles[0].avatar = before;
    PLAN = "free";
    db.study_guides = db.study_guides.filter((g) => g.id !== second.id);
    await context.close();
  }

  // My Words at the free limit, My Notes (empty states and the edit modal), the sidebar, and hints for an advanced
  // learner.
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
    await context.route("https://nxlsnpzfbazwlccxtwpt.supabase.co/**", fakeSupabase);
    await context.addInitScript((value) => localStorage.setItem("sb-nxlsnpzfbazwlccxtwpt-auth-token", value), JSON.stringify(session));
    const page = await context.newPage();

    // 50 words: My Words shows the limit note above the search.
    const words = db.custom_words;
    db.custom_words = Array.from({ length: 50 }, (_, i) => ({ ...words[0], id: `77777777-7777-4777-8777-${String(900000000000 + i)}`,
      hangul: `단어${i}`, guide_id: null, day_number: null }));
    await page.goto("http://localhost:4173/#flashcards");
    await page.getByRole("button", { name: /My Words/ }).click();
    const note = page.locator(".guide-limit");
    await note.waitFor({ timeout: 15000 });
    check(await note.getByText("50 of 50 words").isVisible() && await note.getByText("You've maxed out your words. Upgrade to Pro for Unlimited Words").isVisible()
      && await note.getByRole("button", { name: "Upgrade to Pro" }).isVisible(), "free, 50 words: My Words shows the limit note");
    check((await note.boundingBox()).y < (await page.locator(".search-field").boundingBox()).y, "the word limit note sits above the search");
    await page.screenshot({ path: "screenshots/my-words-limit.png" });
    db.custom_words = words;

    // My Notes: empty states for All, This Week and Today.
    await page.goto("http://localhost:4173/#guides");
    await page.getByRole("button", { name: /My Notes/ }).click();
    await page.getByText("No notes yet").waitFor({ timeout: 15000 });
    await page.getByRole("radio", { name: "This Week" }).click();
    check(await page.getByText("No notes this week").isVisible(), "My Notes: No notes this week");
    await page.getByRole("radio", { name: "Today" }).click();
    check(await page.getByText("No notes today").isVisible(), "My Notes: No notes today");
    await page.getByRole("radio", { name: "All", exact: true }).click();

    // Editing a note from My Notes: a modal with no ←, ✓ waits for a change, a click outside or Esc closes it.
    db.user_notes = [{ id: "99999999-9999-4999-8999-999999999991", user_id: USER, guide_id: null, day_number: null, section: null,
      body: "Ask about 에서", created_at: stamp, updated_at: stamp }];
    await page.reload();
    await page.getByRole("button", { name: /My Notes/ }).click();
    await page.getByRole("button", { name: "Edit Note" }).click();
    const editor = page.getByRole("dialog", { name: "Edit Note" });
    await editor.waitFor();
    check(await editor.getByRole("button", { name: "Back to Notes" }).count() === 0, "editing from My Notes has no Back button");
    check(await editor.getByRole("button", { name: "Save Note" }).isDisabled(), "✓ waits for a change");
    await editor.locator("textarea").fill("Ask about 에서 and 에");
    check(await editor.getByRole("button", { name: "Save Note" }).isEnabled(), "a change turns ✓ on");
    await page.screenshot({ path: "screenshots/my-notes-edit.png" });
    await page.mouse.click(40, 840);
    await editor.waitFor({ state: "detached" });
    check(db.user_notes[0].body === "Ask about 에서", "a click outside closes it without saving");
    await page.getByRole("button", { name: "Edit Note" }).click();
    await editor.waitFor();
    await page.keyboard.press("Escape");
    await editor.waitFor({ state: "detached" });
    check(true, "Esc closes it too");
    db.user_notes = [];

    // The sidebar: capsules, a tint on hover, the chosen page outlined (Profile in the level's colour).
    const flashTab = page.locator(".tabs").getByRole("button", { name: "Flashcards", exact: true });
    await flashTab.hover();
    await page.waitForTimeout(250);
    check(await flashTab.evaluate((b) => getComputedStyle(b).backgroundColor) !== "rgba(0, 0, 0, 0)", "a sidebar button tints on hover");
    await page.locator(".tabs").getByRole("button", { name: "Profile", exact: true }).click();
    await page.mouse.move(900, 500);
    await page.waitForTimeout(250);
    const profileTab = await page.locator(".tabs .profile-tab").evaluate((b) => ({ border: getComputedStyle(b).borderTopColor,
      radius: getComputedStyle(b).borderTopLeftRadius, level: getComputedStyle(document.querySelector(".level-tag .level-icon")).color }));
    check(profileTab.border === profileTab.level && parseFloat(profileTab.radius) > 20, `the Profile button is a capsule outlined in the level's colour (${JSON.stringify(profileTab)})`);
    await page.locator(".tabs").getByRole("button", { name: "Stats", exact: true }).click();
    await page.mouse.move(900, 500);
    await page.waitForTimeout(300);
    const statsTab = await page.locator(".tabs .tab.on").evaluate((b) => getComputedStyle(b).borderTopColor);
    const accent = await page.evaluate(() => { const p = document.createElement("span"); p.style.color = "var(--accent)"; document.body.append(p); const c = getComputedStyle(p).color; p.remove(); return c; });
    check(statsTab === accent, "the chosen page is outlined in purple");
    await page.screenshot({ path: "screenshots/sidebar.png", clip: { x: 0, y: 0, width: 320, height: 860 } });

    // Hints for an advanced learner: no English under the words.
    const progressBefore = db.word_progress;
    db.word_progress = Array.from({ length: 400 }, (_, i) => ({ user_id: USER, word_id: `b-known${i}`, streak: 3, best_streak: 3, correct: 3, wrong: 0,
      dont_know: 0, hints_used: 0, first_reviewed: stamp, last_reviewed: stamp, updated_at: stamp }));
    await page.goto("http://localhost:4173/#flashcards");
    await page.reload();   // a hash change alone doesn't reload the data
    await page.getByRole("button", { name: "Start" }).click({ timeout: 15000 });
    await page.locator(".hint-button").click();
    await page.locator(".hint").waitFor();
    check(await page.locator(".hint .glossed").count() === 0, "advanced: a flashcard hint has no English under the words");
    db.word_progress = progressBefore;
    await page.reload();
    await page.getByRole("button", { name: "Start" }).click();
    await page.locator(".hint-button").click();
    await page.locator(".hint").waitFor();
    check(await page.locator(".hint .glossed").count() === 1, "beginner: a flashcard hint shows the English under the words");
    await page.screenshot({ path: "screenshots/flashcard-hint-glossed.png" });
    await context.close();
  }

  // Safety: Block from a friend's page, the Blocked list and Unblock in Settings, the name filter, the pictures, and
  // Delete Account (typing "delete my account" first), which signs out.
  {
    FRIENDS = [{ id: "99999999-9999-4999-8999-999999999990", user_id: FRIEND, direction: "outgoing", status: "accepted", username: "minji",
      name: "Minji", avatar: "Rocket", level: "beginner", email: null, created_at: stamp }];
    const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
    await context.route("https://nxlsnpzfbazwlccxtwpt.supabase.co/**", fakeSupabase);
    await context.addInitScript((value) => localStorage.setItem("sb-nxlsnpzfbazwlccxtwpt-auth-token", value), JSON.stringify(session));
    const page = await context.newPage();
    await page.goto("http://localhost:4173/#profile");
    await page.locator(".friend").first().click();
    const friendPage = page.getByRole("dialog", { name: "Minji" });
    await friendPage.getByRole("button", { name: "Block" }).click();
    const ask = page.getByRole("alertdialog", { name: "Block Minji?" });
    check(await ask.getByText(/They aren't told/).isVisible(), "Block asks first and says they aren't told");
    await ask.getByRole("button", { name: "Block" }).click();
    await friendPage.waitFor({ state: "detached" });
    check(FRIENDS.length === 0 && BLOCKS.length === 1 && BLOCKS[0].user_id === FRIEND, "blocking ends the friendship and lists them as blocked");
    await page.getByRole("radio", { name: "Settings" }).click();
    const blockedRow = page.getByRole("button", { name: /Blocked/ });
    check((await blockedRow.innerText()).includes("1"), "Settings → Account shows Blocked with a count of 1");
    await blockedRow.click();
    const blocked = page.getByRole("dialog", { name: "Blocked" });
    check(await blocked.getByText("Minji", { exact: true }).isVisible() && await blocked.getByText("@minji", { exact: true }).isVisible(), "Blocked lists the person");
    await page.screenshot({ path: "screenshots/blocked.png" });
    await blocked.getByRole("button", { name: "Unblock" }).click();
    await blocked.getByText("You haven't blocked anyone.").waitFor();
    check(BLOCKS.length === 0, "Unblock removes them from the list");
    await page.keyboard.press("Escape");
    await blocked.waitFor({ state: "detached" });

    // The name filter and the pictures (Camera in, Car out).
    await page.getByRole("radio", { name: "About" }).click();
    await page.getByRole("button", { name: "Edit Profile" }).click();
    const edit = page.getByRole("dialog", { name: "Edit Profile" });
    check(await edit.getByRole("radio", { name: "Camera" }).count() === 1 && await edit.getByRole("radio", { name: "Car" }).count() === 0,
      "the pictures include Camera and not Car");
    await edit.getByRole("textbox", { name: "Your name" }).fill("Big Bitch");
    check(await edit.getByText("Choose a different name.").isVisible() && await edit.getByRole("button", { name: "Save" }).isDisabled(),
      "an offensive name is refused: a message, and Save stays off");
    await edit.getByRole("textbox", { name: "Your name" }).fill("Kshitij");
    check(await edit.getByText("Choose a different name.").count() === 0 && await edit.getByRole("button", { name: "Save" }).isEnabled(),
      "a name that only contains a word's letters (Kshitij) is fine");
    await page.keyboard.press("Escape");
    await edit.waitFor({ state: "detached" });

    // Delete Account.
    await page.getByRole("radio", { name: "Settings" }).click();
    await page.getByRole("button", { name: "Delete Account" }).click();
    const sure = page.getByRole("dialog", { name: "Delete Your Account?" });
    const confirm = sure.getByRole("button", { name: "Delete Account" });
    check(await confirm.isDisabled(), "Delete Account stays off until the phrase is typed");
    await sure.getByRole("textbox").fill("delete my account");
    check(await confirm.isEnabled(), "typing delete my account turns it on");
    await page.screenshot({ path: "screenshots/delete-account.png" });
    await confirm.click();
    await page.getByRole("button", { name: "Sign in with Apple" }).waitFor({ timeout: 10000 });
    check(deleteCalls === 1, "Delete Account calls the delete-account function once and signs out");
    await context.close();
  }

  // Alt+N: a new note from anywhere (inside a guide, for that guide). My Notes never turns the notes panel into a
  // centre modal. Selects: the arrow sits as far in from the right as the text from the left.
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
    await context.route("https://nxlsnpzfbazwlccxtwpt.supabase.co/**", fakeSupabase);
    await context.addInitScript((value) => localStorage.setItem("sb-nxlsnpzfbazwlccxtwpt-auth-token", value), JSON.stringify(session));
    const page = await context.newPage();
    await page.goto("http://localhost:4173/#today");
    await page.getByRole("heading", { name: /Welcome/ }).waitFor({ timeout: 15000 });
    await page.keyboard.press("Alt+KeyN");
    const newNote = page.getByRole("dialog", { name: "New Note" });
    await newNote.waitFor({ timeout: 5000 });
    check(new URL(page.url()).hash === "#guides", "Alt+N on Today goes to Guides and opens a new note");
    await page.keyboard.press("Escape");
    await newNote.waitFor({ state: "detached" });
    await page.locator(".guide-card").first().click();
    await page.getByRole("heading", { name: "Greetings", exact: true }).waitFor();
    await page.keyboard.press("Alt+KeyN");
    await newNote.waitFor();
    check(await newNote.locator("select").first().inputValue() === GUIDE, "Alt+N inside a guide starts a note for that guide");
    await page.keyboard.press("Escape");
    await newNote.waitFor({ state: "detached" });
    await page.getByRole("button", { name: "Back to Study Guides" }).click();
    await page.getByRole("button", { name: "Open Notes" }).click();
    await page.getByRole("dialog", { name: "Notes" }).waitFor();
    await page.getByRole("button", { name: /My Notes/ }).first().click();
    await page.getByRole("heading", { name: "My Notes" }).waitFor();
    await page.waitForTimeout(300);
    check(await page.locator('[aria-modal="true"]').count() === 0 && await page.getByRole("dialog").count() === 0,
      "going to My Notes with the notes panel open closes it (no centre modal)");
    const inset = await page.locator(".filters select").first().evaluate((el) => {
      const cs = getComputedStyle(el);
      return { left: cs.paddingLeft, x: cs.backgroundPositionX };
    });
    check(inset.x.includes(inset.left) && inset.left === "12px", `the select arrow's right inset matches the text's left inset (${JSON.stringify(inset)})`);
    await page.locator(".filters select").first().screenshot({ path: "screenshots/select.png" });
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
  check(db.profiles[0].word_notification === true && db.profiles[0].word_notification_minutes === 540,
    "app-only settings kept intact");
  check(!("settings" in db.profiles[0]), "settings are saved as columns, not a JSON object");
  const quiz = db.daily_quiz[0];
  check(db.daily_quiz.length === 1 && quiz.day === today && quiz.state === "failed" && quiz.recorded === true
    && quiz.revealed_hints.includes(2), `today's quiz saved to the shared table (${JSON.stringify(quiz ?? {})})`);

  // A finished quiz is counted once, even with the site open in two tabs (or reloaded mid-save).
  {
    quiz.recorded = false;
    // Deleting a word above changed the word pool (and so today's word); put it back.
    db.custom_words = savedWords.map((w) => ({ ...w }));
    const before = db.study_days[0].quiz_answers;
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.route("https://nxlsnpzfbazwlccxtwpt.supabase.co/**", fakeSupabase);
    await context.addInitScript((value) => localStorage.setItem("sb-nxlsnpzfbazwlccxtwpt-auth-token", value), JSON.stringify(session));
    const [a, b] = await Promise.all([context.newPage(), context.newPage()]);
    await Promise.all([a.goto("http://localhost:4173/#today"), b.goto("http://localhost:4173/#today")]);
    await Promise.all([a.getByText(/The answer is/).waitFor(), b.getByText(/The answer is/).waitFor()]);
    await a.waitForTimeout(1500);
    check(db.study_days[0].quiz_answers === before + 1 && quiz.recorded === true,
      `two open tabs count the finished quiz once (${before} → ${db.study_days[0].quiz_answers})`);
    await context.close();
  }
} finally {
  await browser.close();
  server.kill();
}
if (failures.length) { console.error(`${failures.length} check(s) failed`); process.exit(1); }
console.log("All end-to-end checks passed");
