// Small stroke icons (24×24), drawn to match the SF Symbols used in the app.
const PATHS: Record<string, string> = {
  sun: "M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
  cards: "M8 4h11a1 1 0 0 1 1 1v12M4 7h11a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z",
  book: "M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5zM4 21a2 2 0 0 1 2-2h13v2H6a2 2 0 0 1-2-2",
  chart: "M4 20V10M10 20V4M16 20v-8M22 20H2",
  person: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
  speaker: "M11 5 6 9H3v6h3l5 4V5zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13",
  x: "M18 6 6 18M6 6l12 12",
  block: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM5.6 5.6l12.8 12.8",
  check: "M20 6 9 17l-5-5",
  arrowRight: "M5 12h14M13 6l6 6-6 6",
  flag: "M5 21V4M5 4h11l-2 4 2 4H5",
  bulb: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z",
  star: "M12 2.8l2.85 5.95 6.55.85-4.8 4.55 1.2 6.5L12 17.5l-5.8 3.15 1.2-6.5-4.8-4.55 6.55-.85z",
  flame: "M12 22c4 0 7-2.7 7-7 0-3.5-2.3-6-4-7.5.2 2.3-.8 4-2.5 4.5C13 9 11.5 5 8.5 2 8.8 6 5 8.6 5 15c0 4.3 3 7 7 7z",
  seal: "M12 2l2.4 1.8 3-.2.9 2.9 2.5 1.7-1 2.8 1 2.8-2.5 1.7-.9 2.9-3-.2L12 22l-2.4-1.8-3 .2-.9-2.9-2.5-1.7 1-2.8-1-2.8 2.5-1.7.9-2.9 3 .2L12 2zM8.5 12l2.5 2.5 4.5-5",
  scope: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z",
  plus: "M12 5v14M5 12h14",
  notes: "M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h5",
  question: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.01",
  trash: "M4 7h16M10 11v6M14 11v6M5 7l1 13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1l1-13M9 7V4h6v3",
  copy: "M9 9h11v11H9zM5 15H4V4h11v1",
  link: "M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1",
  external: "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
  camera: "M4 8h3l2-3h6l2 3h3v11H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z",
  cap: "M2 9l10-5 10 5-10 5L2 9zM6 11v5c3 2.5 9 2.5 12 0v-5M22 9v6",
  chevron: "M9 6l6 6-6 6",
  refresh: "M20 11a8 8 0 0 0-14.9-3M4 4v4h4M4 13a8 8 0 0 0 14.9 3M20 20v-4h-4",
  play: "M7 4l13 8-13 8z",
  textBook: "M4 4h12a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4V4zM8 9h8M8 13h6",
  target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  circle: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z",
  checkCircle: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12l3 3 5-6",
  xCircle: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9 9l6 6M15 9l-6 6",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  minus: "M5 12h14",
  chevronLeft: "M15 6l-6 6 6 6",
  calendar: "M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7zM4 10h16M8 3v4M16 3v4",
  keyboard: "M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7zM7 9.5h.01M11 9.5h.01M15 9.5h.01M17.5 9.5h.01M7 12.5h.01M11 12.5h.01M15 12.5h.01M8 15.5h8",
  award: "M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM8.5 14l-1.5 8 5-3 5 3-1.5-8",
  lock: "M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4",
  select: "M4 6l1.5 1.5L8 5M4 12l1.5 1.5L8 11M4 18l1.5 1.5L8 17M11 6.5h9M11 12.5h9M11 18.5h9",
  mic: "M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3",
  pencil: "M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4",
  swap: "M7 7h13M16 3l4 4-4 4M17 17H4M8 13l-4 4 4 4",
  bookmark: "M6 3h12v18l-6-4-6 4z",
  mail: "M3 6h18v12H3zM3 7l9 6 9-6",
  menu: "M4 6h16M4 12h16M4 18h16",
  questionMark: "M8.5 8.5a3.5 3.5 0 1 1 5.2 3.1c-1 .6-1.7 1.4-1.7 2.6v.3M12 19h.01",
  bolt: "M13 2 4 14h7l-1 8 9-12h-7l1-8z",
  trophy: "M8 4h8v5a4 4 0 0 1-8 0V4zM8 6H5v1a3 3 0 0 0 3 3M16 6h3v1a3 3 0 0 1-3 3M12 13v4M8 21h8M9 17h6v4",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4",
  textSize: "M3 7V5h11v2M8.5 5v14M6.5 19h4M14 12v-1.5h7V12M17.5 10.5V19M16 19h3",
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, strokeWidth = 2, className }: {
  name: IconName; size?: number; strokeWidth?: number; className?: string;
}) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}
