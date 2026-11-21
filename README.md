# MalChingu Web

Malchingu (말친구, "talking buddy") in the browser: the same Korean study app as the iPhone, iPad and Mac version ([MalChingu-Swift](https://github.com/MalChingu/MalChingu-Swift)), on the same accounts and data.

- **Today**: a greeting, your streak, and the word of the day with its quiz (red X to give up, green ✓ to check, three tap-to-reveal hints). It's the same word the app shows that day, and the quiz itself is shared: hints and the result carry over between the web and the app.
- **Flashcards**: built-in words, your own words or a mix; drag or swipe the card (or use the arrow keys), segmented progress, and every card turns over after you answer.
  Cards can show the **Dictionary**, **Past** or **Present** form (가다, 갔어요, 가요) and you type what that form means
  (to go, went, goes; "I went" counts too), with an optional **timer** of 10, 20 or 30 seconds per card. The setup is
  saved with your account (shared with the Mac app). The answer box is ready to type in on every card; Enter submits
  and moves on, Ctrl+L listens, Ctrl+D is "I don't know", and the ? button lists the shortcuts.
- **Guides**: study guides that Claude writes from your notes, day by day, with checkable tasks and vocabulary practice. Create Guide gives you a one-sentence request to paste into Claude. The round Notes button opens your notes (a guide's own notes inside a guide) with **+ Add Note**; on a computer it floats above the button so the guide stays readable and scrollable. In Past Form practice, what you say goes in the answer box to check before you submit.
- **Stats** and **Profile**: picture, name, level, appearance (System / Light / Dark), word-of-the-day settings, the Claude connector link (one per account, shown on every device), achievements and earned titles (see `src/core/achievements.ts`), and a listen button using the browser's Korean voice.

Not on the web: widgets, the lock screen and notifications. Those stay in the app.

## Run it

Requires Node 20 or later.

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:5173. Signing in needs the Apple and Google setup below.

## Tests

```bash
npm test
```

The tests in `src/core/__tests__/golden.test.ts` compare the web logic with outputs produced by the Swift app's own code (word of the day for every day of 2026–2027, 1,553 romanizations, answer checking, quizzes, streaks, levels), so both versions behave the same.

```bash
npm run build && npm run e2e
```

Runs the built site in a headless browser against an in-memory stand-in for Supabase (no account needed, no real data touched) and saves screenshots to `screenshots/`. It also checks both themes on every screen: text contrast (with axe-core), the look of the chosen option in tab controls, and that no native select menus are used. Needs Playwright with Chromium installed.

```bash
E2E_EMAIL=... E2E_PASSWORD=... npm run e2e:live
```

The same kind of run against the real Supabase project, signed in as an email test account (email sign-in must be enabled). It seeds words and a guide through the Claude connector, plays through the screens, checks what reached the database, and checks that today's quiz syncs both ways.

## How it's put together

| Path | What |
| --- | --- |
| `src/core` | Word list and app logic ported from the Swift app, with tests |
| `src/lib` | Supabase client, the data store, settings, speech, picture resizing |
| `src/components` | Shared pieces: cards, buttons, the quiz panel, icons |
| `src/pages` | The screens |
| `scripts/e2e.mjs` | Browser test |

There is no server of its own. The site talks to the Supabase project directly; row-level security limits every query to the signed-in user, exactly as for the app. Settings are the same `profiles.settings` record the app uses, and edits only change the fields the web knows about, so app-only settings (notification times, widget options) are left alone.

## Deploying

The site is a static build (`npm run build` → `dist/`). On Vercel, import this repo with the defaults (Vite is detected); `vercel.json` sends every page to `index.html`. Page views go to Vercel Web Analytics once it's enabled on the project's Analytics tab.

## One-time setup for Sign in with Apple on the web

The app's native sign-in already works. The web needs a few more pieces, done once:

1. **Apple Developer → Certificates, Identifiers & Profiles → Identifiers → +** → **Services IDs**. Description `Malchingu Web`, identifier e.g. `com.rezpoint.ktalk.web`. Enable **Sign in with Apple** → **Configure**: primary App ID `com.rezpoint.ktalk`; **Domains** `nxlsnpzfbazwlccxtwpt.supabase.co`; **Return URLs** `https://nxlsnpzfbazwlccxtwpt.supabase.co/auth/v1/callback`. Save.
2. **Keys → +**: enable **Sign in with Apple** (configure it with the same primary App ID), download the `.p8` file, and note the Key ID and your Team ID.
3. **Supabase → Authentication → Sign In / Providers → Apple**: in **Client IDs** add the Services ID next to the app's bundle ID, e.g. `com.rezpoint.ktalk,com.rezpoint.ktalk.web`. In **Secret Key (for OAuth)** paste a client secret generated from the `.p8` key, Key ID, Team ID and Services ID (Supabase's Apple guide links a generator). Save.
4. **Supabase → Authentication → URL Configuration**: set **Site URL** to the web address, and add it plus `http://localhost:5173` under **Redirect URLs**.

The client secret expires after at most 6 months. Make a new one from the same `.p8` key and paste it into Supabase before then, or web sign-in stops working (the app is unaffected).

## Sign in with Google

Google is already set up in **Supabase → Authentication → Sign In / Providers → Google** with the Web client from Google Cloud (its secret lives only in Supabase). The web button uses Supabase's redirect sign-in and comes back to the site, so it needs only the redirect URLs above. An account with the same verified email address is the same account whichever button is used.

## The logo

The logo is drawn inline (`Logo` in `src/components/ui.tsx`, the same drawing as `public/logo.svg`) so its eyes can blink: every few seconds on the home page, and once each time the pointer moves onto the sidebar logo or the About the App logo in Profile when signed in. Reduced motion stops the home page loop.
