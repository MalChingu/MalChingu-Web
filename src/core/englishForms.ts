// English for a Korean word's past and present forms, from its dictionary-form meanings: "to go" → went / go, goes;
// "to be busy" → was busy / is busy. Used by flashcards that show 갔어요 and ask what it means.
// The same as Shared/EnglishForms.swift in the Swift app; both are tested with english.cases.json.

import { isCorrectAnswer } from "./answerChecker";
import type { PartOfSpeech, Word } from "./models";

export type CardForm = "dictionary" | "past" | "present";
export interface EnglishForms { past: string[]; present: string[] }

/** Irregular past tenses (and the common alternatives). */
const IRREGULAR: Record<string, string[]> = {
  be: ["was", "were"], become: ["became"], begin: ["began"], bend: ["bent"], bite: ["bit"], blow: ["blew"],
  break: ["broke"], bring: ["brought"], build: ["built"], buy: ["bought"], catch: ["caught"], choose: ["chose"],
  come: ["came"], cost: ["cost"], cut: ["cut"], dig: ["dug"], do: ["did"], draw: ["drew"], drink: ["drank"],
  drive: ["drove"], eat: ["ate"], fall: ["fell"], feed: ["fed"], feel: ["felt"], fight: ["fought"], find: ["found"],
  fly: ["flew"], forget: ["forgot"], forgive: ["forgave"], freeze: ["froze"], get: ["got"], give: ["gave"], go: ["went"],
  grow: ["grew"], hang: ["hung", "hanged"], have: ["had"], hear: ["heard"], hide: ["hid"], hit: ["hit"], hold: ["held"],
  hurt: ["hurt"], keep: ["kept"], know: ["knew"], lay: ["laid"], lead: ["led"], learn: ["learned", "learnt"],
  leave: ["left"], lend: ["lent"], let: ["let"], lie: ["lay", "lied"], light: ["lit", "lighted"], lose: ["lost"],
  make: ["made"], mean: ["meant"], meet: ["met"], pay: ["paid"], put: ["put"], quit: ["quit"], read: ["read"],
  ride: ["rode"], ring: ["rang"], rise: ["rose"], run: ["ran"], say: ["said"], see: ["saw"], sell: ["sold"],
  send: ["sent"], set: ["set"], shake: ["shook"], shoot: ["shot"], show: ["showed"], shut: ["shut"], sing: ["sang"],
  sit: ["sat"], sleep: ["slept"], speak: ["spoke"], spend: ["spent"], stand: ["stood"], steal: ["stole"],
  stick: ["stuck"], swim: ["swam"], take: ["took"], teach: ["taught"], tear: ["tore"], tell: ["told"],
  think: ["thought"], throw: ["threw"], understand: ["understood"], wake: ["woke"], wear: ["wore"], win: ["won"],
  write: ["wrote"],
};

const unique = (list: string[]) => Array.from(new Set(list));

function pastOf(verb: string): string[] {
  if (IRREGULAR[verb]) return IRREGULAR[verb];
  if (verb.length > 4 && verb.endsWith("el")) return [`${verb}ed`, `${verb}led`];   // traveled, travelled
  if (verb.endsWith("e")) return [`${verb}d`];
  if (/[^aeiou]y$/.test(verb)) return [`${verb.slice(0, -1)}ied`];
  // One vowel, then one consonant: stop → stopped (not jump, rest, open or cook).
  if (/^[^aeiou]*[aeiou][^aeiouwxy]$/.test(verb)) return [`${verb}${verb.slice(-1)}ed`];
  return [`${verb}ed`];
}

function thirdPerson(verb: string): string {
  if (verb === "have") return "has";
  if (verb === "be") return "is";
  if (/(s|sh|ch|x|z|o)$/.test(verb)) return `${verb}es`;
  if (/[^aeiou]y$/.test(verb)) return `${verb.slice(0, -1)}ies`;
  return `${verb}s`;
}

/** The past and present English for one meaning of a verb or adjective; nothing for other words. */
export function englishForms(meaning: string, pos: PartOfSpeech): EnglishForms {
  let m = meaning.toLowerCase().replace(/\([^)]*\)/g, " ").replace(/[.!?]/g, "").replace(/\s+/g, " ").trim();
  if (!m || (pos !== "verb" && pos !== "adjective")) return { past: [], present: [] };
  if (m.startsWith("to ")) m = m.slice(3);
  else if (pos === "adjective") m = m.startsWith("not ") ? `not be ${m.slice(4)}` : `be ${m}`;

  if (m === "there is" || m === "there are") return { past: ["there was", "there were"], present: ["there is", "there are"] };
  if (m === "there is not" || m === "there are not" || m === "there isn't" || m === "there aren't") {
    return {
      past: ["there was not", "there wasn't", "there were not", "there weren't"],
      present: ["there is not", "there isn't", "there are not", "there aren't"],
    };
  }

  let negative = false;
  for (const prefix of ["not ", "don't ", "do not ", "doesn't ", "does not "]) {
    if (m.startsWith(prefix)) { negative = true; m = m.slice(prefix.length); break; }
  }

  if (m === "be" || m.startsWith("be ")) {
    const rest = m.slice(2).trim();
    const with_ = (w: string) => (rest ? `${w} ${rest}` : w);
    // "many" and "few" are plural: were many, are few.
    const plural = rest === "many" || rest === "few";
    return negative
      ? {
        past: (plural ? ["were not", "weren't", "was not", "wasn't"] : ["was not", "wasn't", "were not", "weren't"]).map(with_),
        present: [...(plural ? ["are not", "aren't", "is not", "isn't", "am not"] : ["is not", "isn't", "am not", "are not", "aren't"]).map(with_),
          ...(rest ? [`not ${rest}`] : [])],
      }
      : {
        past: (plural ? ["were", "was"] : ["was", "were"]).map(with_),
        present: [...(plural ? ["are", "is", "am"] : ["is", "am", "are"]).map(with_), ...(rest ? [rest] : [])],
      };
  }

  if (negative) {
    return { past: [`did not ${m}`, `didn't ${m}`], present: [`do not ${m}`, `don't ${m}`, `does not ${m}`, `doesn't ${m}`] };
  }
  const [verb, ...others] = m.split(" ");
  const rest = others.length ? ` ${others.join(" ")}` : "";
  return { past: pastOf(verb).map((p) => p + rest), present: unique([verb + rest, thirdPerson(verb) + rest]) };
}

/** Every accepted English answer for a word shown in `form` (past or present), across all its meanings. */
export function acceptedForForm(word: Pick<Word, "meanings" | "pos">, form: "past" | "present"): string[] {
  return unique(word.meanings.flatMap((m) => englishForms(m, word.pos)[form]));
}

/** What to show as the answer: the first form of each meaning, at most three ("saw, watched, looked"). */
export function shownForForm(word: Pick<Word, "meanings" | "pos">, form: "past" | "present"): string[] {
  return unique(word.meanings.map((m) => englishForms(m, word.pos)[form][0]).filter((x): x is string => !!x)).slice(0, 3);
}

const PRONOUNS = ["i", "you", "he", "she", "it", "we", "they"];

/** Whether a typed meaning is right for the form, also with a pronoun in front ("I went"). */
export function formAnswerRight(answer: string, word: Pick<Word, "meanings" | "pos">, form: "past" | "present"): boolean {
  const accepted = acceptedForForm(word, form);
  const words = answer.trim().split(/\s+/);
  const withoutPronoun = words.length > 1 && PRONOUNS.includes(words[0].toLowerCase()) ? words.slice(1).join(" ") : answer;
  return isCorrectAnswer(answer, accepted) || isCorrectAnswer(withoutPronoun, accepted);
}

/** The forms a word can be shown in, from those chosen for the round: past and present need a verb or adjective
 *  with its tenses. */
export function formsFor(word: Pick<Word, "tenses" | "pos">, chosen: CardForm[]): CardForm[] {
  const conjugated = (word.pos === "verb" || word.pos === "adjective") && !!word.tenses;
  return chosen.filter((f) => f === "dictionary" || conjugated);
}
