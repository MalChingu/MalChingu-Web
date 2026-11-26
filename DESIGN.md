# Korimal Design Guide

The one reference for how Korimal looks on the web, Android and iPhone/iPad/Mac. Read it before any UI change, and
update it when the design changes. It's identical in all three repos (`malchingu-web`, `malchingu-android`,
`malchingu-swift`); change all three copies together.

## 1. Principles

- **One app, three platforms.** Every feature ships on all three with the same words, order and colours.
- **The web and Android share one look:** a soft gradient wash, frosted white "glass" cards and capsule buttons.
  Android copies the web rather than Material's defaults. Don't use Material colour roles (`secondary`,
  `secondaryContainer`, `tertiary`) or tonal or elevated buttons unless this guide names them.
- **iPhone, iPad and Mac follow Apple:** Liquid Glass (`.glassEffect`, `.buttonStyle(.glass)` /
  `.glassProminent`), system fonts, SF Symbols, native forms, sheets and popovers. Keep the same content, order and
  colours as the others, but let Apple's controls look like Apple's.
- **Light only.** There is no dark mode on any platform.
- **Title Case** for titles, buttons, tabs and menu items ("Usage and Tenses", "Sign in with a Different Account").
  Sentences end with a full stop.
- **Quiet chrome.** Nothing is pinned over the content except the tab bar. On the web and Android, page titles scroll
  away with the page.

## 2. Colour

### Tokens

| Token | Hex | Web | Android | Apple | Use |
|---|---|---|---|---|---|
| Base | `#F4F3FB` | `--base` | `colors.base` | system background | Page background under the wash |
| Text | `#15132B` | `--text` | `onSurface` | `.primary` | Body text |
| Text 2 | `#15132B` 60% | `--text-2` | `onSurfaceVariant` (`#55526B`) | `.secondary` | Secondary text, section labels, placeholders |
| Accent | `#5B4FE9` (fill), `#4338CA` (text) | `--accent-fill`, `--accent` | `primary` | the AccentColor asset (`#5B4FE9`, never system blue) and `Color.brand`; no app-wide `.tint`, which turns neutral `.glass` buttons purple | The main action, links, chosen tab, focus |
| Accent soft | `#5B4FE9` 16% | `--accent-soft` | `primary` 16% | `.tint.opacity(0.16)` | Round + / requests buttons, chosen tab background |
| Green | `#15803D` | `--green`, `--green-fill` | `colors.green`, `colors.greenFill` | `.green` | **Right only** (see rules) |
| Red | `#C62828` | `--red`, `--red-fill` | `colors.red`, `colors.redFill` | `.red` | Wrong, destructive, cancel or decline marks |
| Yellow (text) | `#A16207` | `--yellow` | `colors.yellow` | `QuizResultBanner.unknownText` | Didn't Know text and icon |
| Yellow (fill) | `#EAB308` | `--warning-fill` | `UNKNOWN_YELLOW` | `.yellow` | "I don't know" button, Didn't Know bars, a full limit card's outline |
| Orange | `#B45309` | `--orange` | `colors.orange` | `.orange` | Advanced level, hint bulb |
| Teal | `#0F766E` | `--teal` | `colors.teal` | `.teal` | Upper Beginner level **only** |
| Purple | `#7E22CE` | `--purple` | `colors.purple` | `.purple` | Intermediate level |
| Glass | white 62% with backdrop blur and 170% saturation (web) / white 50% with no blur (Android, the same look), 75–80% edge | `--glass`, `--glass-border` | `colors.card`, `colors.cardBorder` | `.glassEffect` | Cards. Tinted by the wash, never solid white |
| Field | `#FFFFFF`, solid (nothing shows through, so it is exactly white on every platform) | `--field` | `colors.field` | `Color.field` | Every answer box (Today's quiz, flashcards, Past Form) and every hint (Today's and a flashcard's), text fields, segmented tracks. One white everywhere: never grey, never tinted blue or purple |
| Glass strong | white 82%, 75% edge | `--glass-strong` | `GlassButton` | `.glass` | Neutral buttons, round neutral buttons |
| Wash | `#5B4FE9` 28% → `#22B8C7` 17% → `#EC4899` 14% (135°) | `--wash` | `colors.wash` | `AppBackground` | Behind every page |
| Pro gradient | `#5B4FE9` → `#22B8C7` | `--brand-gradient` | `proGradient` | `ProBadge.gradient` | Pro badge and label, initials placeholder |

Levels: Beginner green, Upper Beginner teal, Intermediate purple, Advanced orange. A level badge is its colour at
16–18% behind a graduation cap in the full colour.

### Rules

- **Green means "right"** and nothing else:
  - the outlined ✓ marks (a quiz's Correct!, Pro feature checks, a friend request's accept);
  - the round green ✓ buttons that submit an answer or save (Check answer, Submit answer, Save Note).
  - **Never a full-width or text button, and never a tinted button background.** That is how the green "Usage and
    Tenses" button happened.
- **Red is for wrong, destructive or "no":**
  - Incorrect and ✕ marks;
  - Sign Out (filled);
  - Delete Account, Block, Remove Friend, Cancel Request and Turn Off Connector (red outline);
  - decline and cancel ✕ marks.
- **Purple (accent) is for the one main action on a screen** (Continue, Accept, Challenge Friend, Get the Korean
  Voice), links, and anything chosen or focused.
- **Teal and the other level colours are for levels only.** Don't reuse them for buttons, cards or states.
- On Android, Material's `secondary`, `secondaryContainer` and `tertiary` roles (teal and pink) are not part of the
  design. Don't use components that default to them (`FilledTonalButton`, `ElevatedButton`, tonal chips).

## 3. Type

- **Web:** Montserrat (400–800) for text. The system's rounded face (`--font-display`) for big numbers and Hangul
  headlines. Hangul falls back to Apple SD Gothic Neo or Noto Sans KR.
- **Android:** the system face (Roboto), with Material 3's type scale and the weights in `Theme.kt`.
- **Apple:** SF and SF Rounded (`design: .rounded`) for big numbers.

| Role | Web | Android | Apple |
|---|---|---|---|
| Page title | 2rem / 800 (2.6rem wide) | `headlineLarge` Bold | large navigation title |
| Centered page title (guides) | 1.1rem / 700 | `titleLarge` Bold | `.headline` |
| Card title / H2 | 1.4rem / 800 | `titleLarge` SemiBold | `.title3.bold()` |
| Answer / meaning line | 1.45rem / 650 | `headlineSmall` | `.title2.weight(.semibold)` |
| Body | 16px / 400 | `bodyLarge` | `.body` |
| Button | 16px / 600 (large 1.05rem) | `GlassButton` 16sp SemiBold (large 17sp) | `.headline` |
| Small / caption | 0.85rem | `bodySmall` | `Font.small` (`.footnote`; 13pt on the Mac, whose footnote is 10pt) |
| Section label | 0.75rem / 600, uppercase, +0.05em, Text 2 | `SectionLabel` (`labelMedium`, uppercase) | `Section` header, `.textCase(nil)` |

## 4. Buttons

Every button is a capsule (fully rounded). A screen has at most one prominent button.

| Kind | Looks | Use | Web | Android | Apple |
|---|---|---|---|---|---|
| Prominent | Accent fill, white text | The one main action | `Button kind="prominent"` | `Button` (primary) | `.glassProminent` |
| Glass (neutral) | White 82% glass, thin white edge, soft shadow, dark text | Everything else: Usage and Tenses, Decline, Cancel, Play Sample, Copy Request, Open Guide, Practice All Vocabulary | `Button` (default `glass`) | `GlassButton` | `.glass` |
| Danger | Red text, red 1.5px outline, no fill | Delete Account, Block, Remove Friend, Cancel Request, Turn Off Connector | `kind="danger"`, `.delete-account` | `OutlinedRedButton` | red outlined capsule |
| Destructive | Red fill, white text | Sign Out, confirming a delete | `kind="destructive"`, `.sign-out` | `Button` with `colors.redFill` | `.borderedProminent` + `.red` / `role: .destructive` |
| Compact | 36px tall, 16px sides, no shadow | In a row next to text (Unblock, Play Duel) | `compact` | `GlassButton(compact = true)` | `.controlSize(.small)` |
| Large | 52px tall | Full-width actions under a card's content | `large full` | `GlassButton(large = true)`, 52dp min | `.controlSize(.large)` |
| Round icon | 36–60px circle, white icon | Red ✕ / green ✓ answer buttons, accent →, glass for neutral page actions (+, ?, ⋯, Back, the top bar's ✕): white glass with a dark icon, never tinted | `RoundButton` | `RoundIconButton` + `RoundTint` | circle `.glass` / `roundButton` |
| Quick mark | Outlined ✓ / ✕ circle icon, no fill, 40px target | Accept / decline / cancel beside a row's arrow; ✓ before ✕, and every ✕ in one column | `QuickButton` | `QuickButton` (Friends.kt) | `quickButton` |
| Text link | Accent text, no box | Secondary navigation (Sign in with a Different Account, RezPoint Inc.) | `.link`, `<a>` | `TextButton` | `.buttonStyle(.plain)` + `.tint` |
| Upgrade / checkout | Prominent with ⚡; **faded (60%) and inert until checkout exists** | Upgrade to Pro | `UpgradeButton` (`.soon`) | `CheckoutButton`, `UpgradeButton` | `CheckoutButton`, `UpgradeButton` |
| Provider | Google: white, `#747775` edge, dark text. Apple: black, white text | Sign-in only | `.google-button`, `.apple-button` | sign-in screen | `SignInWithAppleButton`, Google capsule |

Heights: default 44px/dp, large 52, compact 36. Icons in buttons are 18px/dp, with an 8px gap before the label.

## 5. Cards, sheets and popups

- **Card:** glass, radius 26px (web, Apple) / 28dp (Android `GlassCard`), padding 18–20, 12 between rows, full
  width. A section label goes at the top when the card has a heading. White things in a card (glass buttons, fields)
  must stand out from it; if a card looks solid white, it's too opaque.
- **Empty states:** centred text in a card ("No Words Yet", "No notes yet"), never left-aligned.
- **Rows in a card:** at least 44 tall, dividers in `--divider` (Text at 9%). A row that opens something ends in a
  muted ›.
- **Page layout:** 16px/dp side gutter, 16 between cards, content up to 720 wide (760 on the web's main column; Mac
  1120 / form 820).
- **Sheets:** one at a time; never open a sheet from a sheet. Anything that lists things to open becomes its own page
  (Friend Requests) so the item opens as the only sheet. A sheet has a header with ✕ on the left and a centered title.
- **Upgrade to Pro popup (web, Mac):**
  - what Pro adds (outlined green ✓ per line) first, then **Coming Soon centered at the bottom** (where the price
    will go);
  - a popup you click open (a locked Create Guide length, the Pro photo tile) also gets the compact faded Upgrade to
    Pro button;
  - a popup that shows on hover (the sidebar's Upgrade to Pro, the Pro badge) has no button, because it closes when
    the pointer leaves.
- **Upgrade sheet (iPhone, Android):** the same order: features, Coming Soon, then the button.

## 6. Controls

- **Segmented control:** a field-coloured capsule track. The chosen segment is inverted (Text fill, Base text).
  Three or more choices that don't fit a phone become a select ("Show Word In").
- **Select:** one shared style per platform. Web: the global `select` rule (`--select-pad`, see `CLAUDE.md`);
  Android: `SelectRow`; Apple: menu `Picker`.
- **Switch rows:** the label wraps rather than running up to the switch (24dp gap on Android).
- **Text fields:** capsule, the Field colour, no outline until focused (then the accent at 16%; red for a wrong
  answer), no autocorrect for answers and usernames, and the placeholder in Text 2 (set it: Safari's own placeholder
  grey is much lighter, which makes the white box look faded). Apple's placeholder can't be restyled (pale on iPhone,
  black on the Mac), so answer boxes draw their own (`answerPlaceholder`). Never Material's grey outline or a
  `surface` fill.
- **Answer boxes** (Today's quiz, a word's quiz, flashcards, Past Form) are one size everywhere: 44px tall with 1.1rem
  text on the web, `titleMedium` on Android, `.title3` at 44pt on Apple. A flashcard's is centred; it isn't bigger.
- **The keyboard:** on phones and tablets (Android, iPhone, iPad, the web on a touch screen) nothing focuses an answer
  box on its own, so the on-screen keyboard only comes up when the box is tapped. With a mouse and keyboard (the web on
  a computer, the Mac) a flashcard's box is ready to type in.
- **A button waiting for input** (the ✓ before anything is typed) is faded to 45%, keeping its colour and icon. Never
  invisible: on the Mac a disabled `.glassProminent` loses its tint, so Apple fades it with `.opacity` instead of
  `.disabled`, and the action ignores an empty answer.

## 7. Icons and marks

- Outlined circle marks show a result:
  - ✓ green: Correct!, right;
  - ✕ red: Incorrect, wrong, decline or cancel;
  - ? yellow: Didn't Know.
- A quiz result is two lines: line 1 is the mark and the status (Correct! / Didn't Know / Incorrect) with the
  practice mic on the right; line 2 is the answer. Never "The answer is …".
- Red dot (13px with a 2px card-coloured ring) means something is waiting. A red count capsule shows how many
  (Friend Requests).
- Web icons: `components/Icon.tsx` (2px strokes, round caps). Android: Material Rounded (filled) and Outlined (marks).
  Apple: SF Symbols, plain and `.circle` variants for marks.

## 8. Page headers

- **Web:** `Page` header (`.page-header`): Back on the left, round actions on the right, a 2rem title. It scrolls with
  the page.
- **Android:** `Page` (`ui/Page.kt`): the same. The header is the list's first item and scrolls away; nothing is
  pinned. Behind the status bar is a strip of the page's own background (`washBackground()`, lined up with the
  window), so it can't be seen and scrolled cards disappear under the clock. Never a lighter or white band.
- **Apple:** the system large title, which collapses into the navigation bar. The Mac draws `MacPageBar`.
- **Free accounts:** Upgrade to Pro, compact and centered right under the title, only on pages with a Pro limit (Study
  Guides, My Words). Not on My Notes.

## 9. Words

- **Statuses:** Correct!, Correct after N misses., Incorrect, Didn't Know.
- **Plan words:** Upgrade to Pro, Coming Soon, Pro.
- **Friends:** Incoming Friend Request, Sent Friend Request, Friend Requests (Incoming / Sent), Add Friend
  (usernames only).
