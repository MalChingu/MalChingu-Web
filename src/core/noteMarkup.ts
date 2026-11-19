// A guide day's notes (written by Claude in simple Markdown) as blocks to show nicely.
// The same rules as Shared/NoteMarkup.swift and Android's core/NoteMarkup.kt; the three share their tests.
//
// Blocks: "## Heading", a line that is only **bold** (a heading too), "- " / "• " / "* " bullets,
// "1. " numbered items and paragraphs (one per line). Inside a block: **bold** for the key Korean
// forms, [한글] for a pronunciation (only when the brackets hold Hangul) and `code`, shown as plain text.

export type NoteSpan = { kind: "text" | "bold" | "pron"; text: string };
export type NoteBlock = { kind: "heading" | "bullet" | "numbered" | "paragraph"; number?: number; spans: NoteSpan[] };

const HANGUL = /[ᄀ-ᇿ㄰-㆏ꥠ-꥿가-힯ힰ-퟿]/;

export function noteBlocks(text: string): NoteBlock[] {
  const blocks: NoteBlock[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^#{1,6}\s+(.+)$/)) || (m = line.match(/^\*\*([^*]+)\*\*:?$/))) {
      blocks.push({ kind: "heading", spans: noteSpans(withoutColon(m[1])) });
    } else if ((m = line.match(/^[-•*–]\s+(.+)$/))) {
      blocks.push({ kind: "bullet", spans: noteSpans(m[1]) });
    } else if ((m = line.match(/^(\d{1,3})[.)]\s+(.+)$/))) {
      blocks.push({ kind: "numbered", number: Number(m[1]), spans: noteSpans(m[2]) });
    } else {
      blocks.push({ kind: "paragraph", spans: noteSpans(line) });
    }
  }
  return blocks;
}

function withoutColon(text: string): string {
  return text.trim().replace(/[:：]$/, "").trim();
}

export function noteSpans(text: string): NoteSpan[] {
  const spans: NoteSpan[] = [];
  const add = (kind: NoteSpan["kind"], piece: string) => {
    if (!piece) return;
    const last = spans[spans.length - 1];
    if (kind === "text" && last?.kind === "text") last.text += piece;
    else spans.push({ kind, text: piece });
  };
  let i = 0;
  while (i < text.length) {
    if (text.startsWith("**", i)) {
      const end = text.indexOf("**", i + 2);
      if (end > i + 2) { add("bold", text.slice(i + 2, end)); i = end + 2; continue; }
      add("text", "**"); i += 2; continue;
    }
    if (text[i] === "[") {
      const end = text.indexOf("]", i + 1);
      const inner = end > i + 1 ? text.slice(i + 1, end) : "";
      if (inner && HANGUL.test(inner) && !inner.includes("[")) { add("pron", inner); i = end + 1; continue; }
    }
    if (text[i] === "`") {
      const end = text.indexOf("`", i + 1);
      if (end > i + 1) { add("text", text.slice(i + 1, end)); i = end + 1; continue; }
    }
    add("text", text[i]); i++;
  }
  return spans;
}
