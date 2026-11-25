// The browser's own translator (Chrome and Edge on a computer): free and on-device, so nothing is sent
// anywhere. Other browsers don't have it; callers then show only what the app knows itself.

type Language = "ko" | "en";
type Availability = "unavailable" | "downloadable" | "downloading" | "available";
interface BrowserTranslator { translate(text: string): Promise<string> }
interface TranslatorAPI {
  availability(options: { sourceLanguage: Language; targetLanguage: Language }): Promise<Availability>;
  create(options: { sourceLanguage: Language; targetLanguage: Language }): Promise<BrowserTranslator>;
}

const api = (): TranslatorAPI | undefined => (globalThis as { Translator?: TranslatorAPI }).Translator;

/** Whether this browser can translate between the two languages at all (it may still need to download). */
export async function canTranslate(from: Language, to: Language): Promise<boolean> {
  const T = api();
  if (!T) return false;
  try {
    return await within(5_000, T.availability({ sourceLanguage: from, targetLanguage: to })) !== "unavailable";
  } catch {
    return false;
  }
}

/** Gives up after `ms`, so a translator that never answers doesn't leave a spinner forever. */
function within<T>(ms: number, promise: Promise<T>): Promise<T> {
  return Promise.race([promise, new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timed out")), ms))]);
}

const translators = new Map<string, Promise<BrowserTranslator>>();

/** Translates, or null when the browser can't. Call it from a click: the first use may download the
 *  language model, which Chrome only allows after the person does something. */
export async function translate(text: string, from: Language, to: Language): Promise<string | null> {
  const T = api();
  if (!T) return null;
  const key = `${from}>${to}`;
  if (!translators.has(key)) {
    translators.set(key, (async () => {
      if (await T.availability({ sourceLanguage: from, targetLanguage: to }) === "unavailable") throw new Error("unavailable");
      return T.create({ sourceLanguage: from, targetLanguage: to });
    })());
  }
  try {
    // The first use can download the language model, so allow a while.
    return await within(60_000, (async () => (await translators.get(key)!).translate(text))());
  } catch {
    translators.delete(key);
    return null;
  }
}
