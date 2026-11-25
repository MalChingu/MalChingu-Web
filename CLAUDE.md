# Korimal web app: conventions

- **Selects:** every `<select>` uses the one global `select` style in `src/styles.css`. Its arrow sits as far in from the right edge as the text is from the left (`--select-pad`). Don't add per-select arrow, padding or `appearance` rules; change the shared rule if selects need to look different.
- **Shared rules:** logic that also lives in the iPhone/Mac (`malchingu-swift`) and Android (`malchingu-android`) apps sits in `src/core/` with a `*.cases.json` file in `src/core/__tests__/`. The same JSON is copied into the other two apps' tests, so change all three together. Examples: names, hints, gloss, avatars, plan.
- **Data shared with the apps:** `src/core/words.json` and `src/core/hintWords.json` (the hint lexicon) are identical copies in the other two apps.
- **Checks before pushing:** `npx vitest run`, `npx tsc --noEmit -p .`, `npm run build`, then `node scripts/e2e.mjs` against `vite preview --port 4173`.
