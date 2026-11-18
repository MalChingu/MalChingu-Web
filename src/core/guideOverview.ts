// A study guide's overview as short points to show as bullets. Port of Shared/GuideOverview.swift.
// Claude is asked to write one point per line; older guides have a paragraph, which is split into sentences.

export function overviewPoints(text: string): string[] {
  const lines = text.split(/\r?\n/).map(stripBullet).filter((l) => l.length > 0);
  if (lines.length > 1) return lines;
  return lines.length ? sentences(lines[0]) : [];
}

function stripBullet(line: string): string {
  let s = line.trim();
  for (const marker of ["- ", "• ", "* ", "– "]) if (s.startsWith(marker)) s = s.slice(marker.length);
  return s.trim();
}

/** Splits after ". ", "! " or "? " when the next sentence starts with a capital letter or digit. */
function sentences(text: string): string[] {
  const result: string[] = [];
  let current = "";
  const chars = Array.from(text);
  chars.forEach((ch, i) => {
    current += ch;
    if (".!?".includes(ch) && chars[i + 1] === " " && i + 2 < chars.length && /[\p{Lu}\p{N}]/u.test(chars[i + 2])) {
      result.push(current.trim());
      current = "";
    }
  });
  if (current.trim()) result.push(current.trim());
  return result;
}
