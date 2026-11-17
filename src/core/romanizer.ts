// Hangul -> Revised Romanization, following pronunciation within each word.
// A line-for-line port of Shared/Romanizer.swift in the Swift app; the golden
// tests check that both give identical output.

const INITIALS = Array.from("ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ");
const VOWELS = ["a", "ae", "ya", "yae", "eo", "e", "yeo", "ye", "o", "wa", "wae", "oe",
  "yo", "u", "wo", "we", "wi", "yu", "eu", "ui", "i"];
const FINALS = ["", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ", "ㄻ", "ㄼ", "ㄽ", "ㄾ",
  "ㄿ", "ㅀ", "ㅁ", "ㅂ", "ㅄ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
const COMPOUND: Record<string, [string, string]> = {
  "ㄳ": ["ㄱ", "ㅅ"], "ㄵ": ["ㄴ", "ㅈ"], "ㄶ": ["ㄴ", "ㅎ"], "ㄺ": ["ㄹ", "ㄱ"], "ㄻ": ["ㄹ", "ㅁ"],
  "ㄼ": ["ㄹ", "ㅂ"], "ㄽ": ["ㄹ", "ㅅ"], "ㄾ": ["ㄹ", "ㅌ"], "ㄿ": ["ㄹ", "ㅍ"], "ㅀ": ["ㄹ", "ㅎ"],
  "ㅄ": ["ㅂ", "ㅅ"],
};
const ONSET_ROMAN: Record<string, string> = {
  "ㄱ": "g", "ㄲ": "kk", "ㄴ": "n", "ㄷ": "d", "ㄸ": "tt", "ㄹ": "r", "ㅁ": "m", "ㅂ": "b", "ㅃ": "pp",
  "ㅅ": "s", "ㅆ": "ss", "ㅇ": "", "ㅈ": "j", "ㅉ": "jj", "ㅊ": "ch", "ㅋ": "k", "ㅌ": "t", "ㅍ": "p", "ㅎ": "h",
};
const CODA_SOUND: Record<string, string> = {
  "ㄱ": "k", "ㄲ": "k", "ㅋ": "k", "ㄴ": "n", "ㄷ": "t", "ㅅ": "t", "ㅆ": "t", "ㅈ": "t", "ㅊ": "t",
  "ㅌ": "t", "ㅎ": "t", "ㄹ": "l", "ㅁ": "m", "ㅂ": "p", "ㅍ": "p", "ㅇ": "ng",
};
const COMPOUND_SOUND: Record<string, string> = {
  "ㄳ": "k", "ㄵ": "n", "ㄶ": "n", "ㄺ": "k", "ㄻ": "m", "ㄼ": "l", "ㄽ": "l", "ㄾ": "l", "ㄿ": "p",
  "ㅀ": "l", "ㅄ": "p",
};
/** Compounds pronounced as if the first part ended in ㄷ: 맛없다 -> [마덥따]. */
const RESPELLINGS: [string, string][] = [["맛없", "마덦"], ["멋없", "머덦"]];

interface Syllable { initial: string; vowel: number; final: string }

const isHangulCode = (code: number) => code >= 0xac00 && code <= 0xd7a3;

export function containsHangul(text: string): boolean {
  for (const ch of text) if (isHangulCode(ch.codePointAt(0)!)) return true;
  return false;
}

export function romanize(original: string): string {
  let text = original;
  for (const [written, spoken] of RESPELLINGS) text = text.split(written).join(spoken);
  let output = "";
  let run: Syllable[] = [];
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    if (isHangulCode(code)) {
      const index = code - 0xac00;
      run.push({ initial: INITIALS[Math.floor(index / 588)], vowel: Math.floor((index % 588) / 28), final: FINALS[index % 28] });
    } else {
      if (run.length) { output += romanizeRun(run); run = []; }
      output += ch;
    }
  }
  if (run.length) output += romanizeRun(run);
  return output;
}

function romanizeRun(input: Syllable[]): string {
  const syllables = input.map((s) => ({ ...s }));
  const codas: string[] = syllables.map(() => "");
  const onsets: (string | null)[] = syllables.map(() => null);

  for (let i = 0; i < syllables.length; i++) {
    const final = syllables[i].final;
    if (!final) continue;
    const pair = COMPOUND[final];
    const last = pair ? pair[1] : final;
    const next = i + 1 < syllables.length ? syllables[i + 1].initial : null;
    const sound = COMPOUND_SOUND[final] ?? CODA_SOUND[last] ?? "";

    if (next === null) { codas[i] = sound; continue; }

    // Liaison: the final consonant moves onto a following vowel.
    if (next === "ㅇ" && final !== "ㅇ") {
      let moving: string | null = last;
      let staying: string | null = pair ? pair[0] : null;
      if (last === "ㅎ") { moving = staying; staying = null; }
      const vowel = VOWELS[syllables[i + 1].vowel];
      if (moving === "ㄷ" && vowel === "i") moving = "ㅈ";
      if (moving === "ㅌ" && (vowel === "i" || vowel === "yeo")) moving = "ㅊ";
      if (moving !== null) syllables[i + 1].initial = moving;
      if (staying !== null) codas[i] = CODA_SOUND[staying] ?? "";
      continue;
    }

    // Final ㅎ (ㅎ, ㄶ, ㅀ) colours what follows.
    if (last === "ㅎ") {
      const base = pair ? CODA_SOUND[pair[0]] ?? "" : "";
      switch (next) {
        case "ㄱ": codas[i] = base; onsets[i + 1] = "k"; break;
        case "ㄷ": codas[i] = base; onsets[i + 1] = "t"; break;
        case "ㅈ": codas[i] = base; onsets[i + 1] = "ch"; break;
        case "ㅅ": codas[i] = base; break;
        case "ㄴ":
          codas[i] = base === "" ? "n" : base;
          if (base === "l") onsets[i + 1] = "l";
          break;
        default: codas[i] = base === "" ? "t" : base;
      }
      continue;
    }

    // A stop followed by ㅎ becomes aspirated: 축하 -> chuka, 못해 -> motae.
    const lastSound = CODA_SOUND[last] ?? "";
    if (next === "ㅎ" && (lastSound === "k" || lastSound === "t" || lastSound === "p")) {
      codas[i] = pair ? CODA_SOUND[pair[0]] ?? "" : "";
      onsets[i + 1] = last === "ㅈ" ? "ch" : lastSound;
      continue;
    }

    let coda = sound;
    if (final === "ㄺ" && next === "ㄱ") coda = "l";

    if (next === "ㄴ" || next === "ㅁ") {
      if (coda === "k") coda = "ng";
      if (coda === "t") coda = "n";
      if (coda === "p") coda = "m";
      if (coda === "l" && next === "ㄴ") onsets[i + 1] = "l";
    } else if (next === "ㄹ") {
      switch (coda) {
        case "k": coda = "ng"; onsets[i + 1] = "n"; break;
        case "t": coda = "n"; onsets[i + 1] = "n"; break;
        case "p": coda = "m"; onsets[i + 1] = "n"; break;
        case "m": case "ng": onsets[i + 1] = "n"; break;
        case "n": coda = "l"; onsets[i + 1] = "l"; break;
        case "l": onsets[i + 1] = "l"; break;
      }
    }
    codas[i] = coda;
  }

  let result = "";
  syllables.forEach((s, i) => {
    result += onsets[i] ?? ONSET_ROMAN[s.initial] ?? "";
    result += VOWELS[s.vowel];
    result += codas[i];
  });
  return result;
}

export const displayRomanization = (w: { romanization: string; hangul: string }) =>
  w.romanization || romanize(w.hangul);
