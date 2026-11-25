import { useEffect, useState, type ReactNode } from "react";
import { challengeNeedsMe, duelWinner, friendLabel, isValidUsername, looksLikeEmail, normalizeUsername, orderFriends, percent,
  shortLabel, usernameCandidates, weekStatus, weekWinner, type ChallengeRow, type FriendRow, type UserSearchRow } from "../core/friends";
import { levelLabel, type Level } from "../core/progress";
import { dayString } from "../core/wordOfDay";
import { USERNAME_REFUSED, nameAllowed } from "../core/names";
import { AvatarImage } from "./Avatar";
import { initials } from "../lib/settings";
import { USERNAME_RULE, useStore } from "../lib/store";
import { Icon } from "./Icon";
import { Button, Card, ConfirmDialog, RoundButton, SectionTitle, Sheet } from "./ui";

// Profile → About → Friends: a row of friends' pictures with + at the end, a page for each friend (Accept, Challenge
// Friend, Remove Friend), adding by username or email, and choosing a username.

/** A round picture, or initials on the app's gradient; an envelope for a request sent to an email. */
export function PersonPicture({ avatar, name, size, mail }: { avatar: string | null; name: string; size: number; mail?: boolean }) {
  if (avatar) return <AvatarImage className="person-picture" avatar={avatar} size={size} />;
  const letters = initials(name.replace(/^@/, ""));
  return (
    <span className="person-picture placeholder" style={{ width: size, height: size, fontSize: size * 0.36 }} aria-hidden="true">
      {mail ? <Icon name="mail" size={size * 0.42} /> : letters || <Icon name="person" size={size * 0.42} />}
    </span>
  );
}

const isWaiting = (f: FriendRow, challenges: ChallengeRow[]) =>
  (f.status === "pending" && f.direction === "incoming") || challenges.some((c) => c.friend_id === f.user_id && challengeNeedsMe(c));

export function FriendsCard() {
  const store = useStore();
  const [openID, setOpenID] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const rows = orderFriends(store.friends);
  const open = store.friends.find((f) => f.id === openID) ?? null;

  return (
    <Card>
      <SectionTitle>Friends</SectionTitle>
      <div className="friends-row">
        <div className="friends-scroll">
          {rows.map((f) => {
            const sent = f.status === "pending" && f.direction === "outgoing";
            const waiting = isWaiting(f, store.challenges);
            return (
              <button key={f.id} type="button" className={`friend ${sent ? "sent" : ""}`} onClick={() => setOpenID(f.id)}
                aria-label={`${friendLabel(f)}${sent ? ", request sent" : f.status === "pending" ? ", wants to be your friend" : waiting ? ", challenge waiting" : ""}`}>
                <span className="friend-picture">
                  <PersonPicture avatar={f.avatar} name={f.name || f.username || ""} size={52} mail={!f.user_id || (sent && !f.username)} />
                  {waiting && <span className="friend-dot" />}
                </span>
                <span className="friend-caption">{sent ? "Sent" : shortLabel(f)}</span>
              </button>
            );
          })}
        </div>
        <button type="button" className="friend" aria-label="Add Friend" title="Add Friend"
          onClick={() => setAdding(true)}>
          <span className="friend-picture friend-add"><Icon name="plus" size={24} strokeWidth={2.4} /></span>
        </button>
      </div>
      {store.friendsError && <p className="error small" role="alert">{store.friendsError}</p>}

      {/* Hidden while a duel is played, then back with its result. */}
      {open && !store.duel && <FriendSheet friend={open} onClose={() => setOpenID(null)} />}
      {adding && <AddFriendSheet onClose={() => setAdding(false)} />}
    </Card>
  );
}

function LevelTag({ level }: { level: Level }) {
  return <span className={`level-tag level-${level}`}><Icon name="cap" size={16} className="level-icon" /> {levelLabel[level]}</span>;
}

/** A friend's page: picture, name, @username and level, then what you can do together. */
function FriendSheet({ friend, onClose }: { friend: FriendRow; onClose: () => void }) {
  const store = useStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const label = friendLabel(friend);
  const first = shortLabel(friend);
  const challenges = store.challenges.filter((c) => c.friend_id === friend.user_id);
  const openDuel = challenges.some((c) => c.kind === "duel" && !(c.my_done && c.their_done));
  const openWeek = challenges.some((c) => c.kind === "week" && (c.status === "pending" || weekStatus(c.end_day ?? "", dayString()).kind === "running"));

  const run = async (action: () => Promise<string | null>) => {
    setBusy(true);
    setError(null);
    const failed = await action();
    setBusy(false);
    if (failed) setError(failed);
    return !failed;
  };

  return (
    <Sheet title={label} onClose={onClose}>
      <div className="center stack friend-page">
        <PersonPicture avatar={friend.avatar} name={friend.name || friend.username || ""} size={96} mail={!friend.user_id} />
        {friend.name && <div className="friend-page-name">{friend.name}</div>}
        {friend.username && <div className="muted">@{friend.username}</div>}
        {!friend.username && friend.email && <div className="muted">{friend.email}</div>}
        {friend.level && <LevelTag level={friend.level} />}
      </div>

      {friend.status === "pending" && friend.direction === "incoming" && (
        <div className="stack">
          <p className="center">{first} wants to be your friend.</p>
          <div className="button-pair">
            <Button full disabled={busy} onClick={() => run(() => store.removeFriend(friend.id)).then((ok) => ok && onClose())}>Decline</Button>
            <Button kind="prominent" icon="check" full disabled={busy} onClick={() => run(() => store.acceptFriend(friend.id))}>Accept</Button>
          </div>
          <Button kind="danger" icon="block" full disabled={busy} onClick={() => setConfirmBlock(true)}>Block</Button>
        </div>
      )}

      {friend.status === "pending" && friend.direction === "outgoing" && (
        <div className="stack">
          <p className="center muted">
            {friend.user_id
              ? `Request sent. ${first} can accept it in Profile.`
              : `Request sent. It reaches them if they sign up for Korimal with this email by ${inviteExpiry(friend.created_at)}.`}
          </p>
          <Button kind="danger" icon="x" full disabled={busy} onClick={() => run(() => store.removeFriend(friend.id)).then((ok) => ok && onClose())}>
            Cancel Request
          </Button>
        </div>
      )}

      {friend.status === "accepted" && (
        <div className="stack">
          {challenges.length > 0 && (
            <div className="glass card challenges" style={{ padding: 14 }}>
              <div className="divided">
                {challenges.map((c) => <ChallengeLine key={c.id} challenge={c} first={first} busy={busy} run={run} />)}
              </div>
            </div>
          )}
          {choosing ? (
            <div className="stack challenge-options" role="group" aria-label="Challenge Friend">
              <button type="button" className="challenge-option" disabled={busy || openDuel}
                onClick={() => run(() => store.challengeFriend(friend, "duel"))}>
                <Icon name="bolt" size={22} className="accent" />
                <span className="grow">
                  <span className="strong">Flashcard Duel</span>
                  <span className="small muted">{openDuel ? "Finish your current duel first." : "10 words, the same for both of you. Start now; the higher score wins."}</span>
                </span>
              </button>
              <button type="button" className="challenge-option" disabled={busy || openWeek}
                onClick={() => run(() => store.challengeFriend(friend, "week")).then((ok) => ok && setChoosing(false))}>
                <Icon name="calendar" size={22} className="accent" />
                <span className="grow">
                  <span className="strong">7-Day Challenge</span>
                  <span className="small muted">{openWeek ? "You already have a 7-day challenge with them."
                    : `Starts when ${first} accepts. Whoever gets the most answers right out of all they answer in 7 days wins.`}</span>
                </span>
              </button>
              <Button full onClick={() => setChoosing(false)}>Cancel</Button>
            </div>
          ) : (
            <Button kind="prominent" icon="bolt" full large disabled={busy} onClick={() => setChoosing(true)}>Challenge Friend</Button>
          )}
          <Button kind="danger" icon="x" full disabled={busy} onClick={() => setConfirmRemove(true)}>Remove Friend</Button>
          <Button kind="danger" icon="block" full disabled={busy} onClick={() => setConfirmBlock(true)}>Block</Button>
        </div>
      )}

      {error && <p className="error small center" role="alert">{error}</p>}

      {confirmRemove && (
        <ConfirmDialog title={`Remove ${first}?`} confirmLabel="Remove"
          message="You'll stop seeing each other's name, picture and level, and your challenges end. You can add each other again later."
          onCancel={() => setConfirmRemove(false)}
          onConfirm={() => { setConfirmRemove(false); run(() => store.removeFriend(friend.id)).then((ok) => ok && onClose()); }} />
      )}
      {confirmBlock && friend.user_id && (
        <ConfirmDialog title={`Block ${first}?`} confirmLabel="Block"
          message="They won't be able to find you or send you requests, and your friendship and challenges end. They aren't told. You can unblock them in Profile → Settings."
          onCancel={() => setConfirmBlock(false)}
          onConfirm={() => { setConfirmBlock(false); run(() => store.blockUser(friend.user_id!)).then((ok) => ok && onClose()); }} />
      )}
    </Sheet>
  );
}

/** An invite to an email with no account lasts 7 days: the date it ends, like "Dec 2". */
const inviteExpiry = (createdAt: string) =>
  new Date(new Date(createdAt).getTime() + 7 * 86_400_000).toLocaleDateString(undefined, { month: "short", day: "numeric" });

/** "82% (41/50)", or "no answers yet". */
const weekScore = (correct: number, total: number) => {
  const p = percent(correct, total);
  return p === null ? "no answers yet" : `${p}% (${correct}/${total})`;
};

/** One challenge with a friend: where it stands and what you can do next. */
function ChallengeLine({ challenge: c, first, busy, run }: {
  challenge: ChallengeRow; first: string; busy: boolean; run: (action: () => Promise<string | null>) => Promise<boolean>;
}) {
  const store = useStore();
  const remove = (label: string) => (
    <button type="button" className="link small" disabled={busy} onClick={() => run(() => store.removeChallenge(c.id))}>{label}</button>
  );
  let status: string;
  let actions: ReactNode = null;
  if (c.kind === "duel") {
    if (!c.my_done) {
      status = c.sent ? "Your duel is ready to play." : `${first} challenged you. 10 words: the higher score wins.`;
      actions = <Button kind="prominent" icon="play" compact disabled={busy} onClick={() => store.playDuel(c)}>Play Duel</Button>;
    } else if (!c.their_done) {
      status = `You got ${c.my_score} / 10. Waiting for ${first} to play.`;
    } else {
      const winner = duelWinner(c.my_score ?? 0, c.their_score ?? 0);
      status = `You ${c.my_score} · ${first} ${c.their_score} · ${winner === "me" ? "You win!" : winner === "them" ? `${first} wins` : "It's a tie"}`;
      actions = remove("Clear");
    }
  } else if (c.status === "pending") {
    if (c.sent) {
      status = `Waiting for ${first} to accept.`;
      actions = remove("Cancel");
    } else {
      status = `${first} challenged you: whoever gets the most answers right out of all they answer in 7 days wins.`;
      actions = (
        <span className="row">
          {remove("Decline")}
          <Button kind="prominent" compact disabled={busy} onClick={() => run(() => store.acceptChallenge(c.id))}>Accept</Button>
        </span>
      );
    }
  } else {
    const week = weekStatus(c.end_day ?? "", dayString());
    const scores = `You ${weekScore(c.my_correct, c.my_total)} · ${first} ${weekScore(c.their_correct, c.their_total)}`;
    if (week.kind === "running") {
      status = `${scores} · ${week.daysLeft === 1 ? "Last day" : `${week.daysLeft} days left`}`;
    } else {
      const winner = weekWinner(c.my_correct, c.my_total, c.their_correct, c.their_total);
      status = `${scores} · ${winner === "me" ? "You win!" : winner === "them" ? `${first} wins` : "It's a tie"}`;
      actions = remove("Clear");
    }
  }
  const finished = (c.kind === "duel" && c.my_done && c.their_done)
    || (c.kind === "week" && c.status === "active" && weekStatus(c.end_day ?? "", dayString()).kind === "finished");
  return (
    <div className="challenge-line">
      <Icon name={finished ? "trophy" : c.kind === "duel" ? "bolt" : "calendar"} size={20} className="accent" />
      <span className="grow stack tiny-gap">
        <span className="strong">{c.kind === "duel" ? "Flashcard Duel" : "7-Day Challenge"}</span>
        <span className="small muted">{status}</span>
      </span>
      {actions}
    </div>
  );
}

/** + : a username or an email. Usernames search as you type (picture, @username and level); an email gets Send Request. */
function AddFriendSheet({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const [text, setText] = useState("");
  const [results, setResults] = useState<UserSearchRow[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState<{ text: string; good: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const query = text.trim();
  const email = looksLikeEmail(query);
  const handle = normalizeUsername(query);

  useEffect(() => {
    if (email || handle.length < 2) { setResults(null); setSearching(false); return; }
    let live = true;
    setSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const rows = await store.searchUsers(handle);
        if (live) setResults(rows);
      } catch (e) {
        if (live) setMessage({ text: `Couldn't search: ${(e as Error).message}`, good: false });
      } finally {
        if (live) setSearching(false);
      }
    }, 300);
    return () => { live = false; window.clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle, email]);

  const send = async (typed: string, shown: string) => {
    setBusy(true);
    setMessage(null);
    const outcome = await store.requestFriend(typed);
    setBusy(false);
    if ("error" in outcome) { setMessage({ text: outcome.error, good: false }); return; }
    setMessage(outcome.result === "friends"
      ? { text: `You're now friends with ${shown}.`, good: true }
      : email
        ? { text: `Request sent to ${shown}. If they don't use Korimal yet, it reaches them if they sign up with that email within 7 days.`, good: true }
        : { text: `Request sent to ${shown}.`, good: true });
    if (email) setText("");
  };

  const relation = (userID: string) => store.friends.find((f) => f.user_id === userID);

  return (
    <Sheet title="Add Friend" onClose={onClose}>
      <div className="stack">
        <input className="text-input sheet-input" value={text} placeholder="Username or email" aria-label="Username or email" autoFocus
          autoCapitalize="off" autoCorrect="off" spellCheck={false} inputMode="email" enterKeyHint={email ? "send" : "search"}
          onChange={(e) => { setText(e.target.value); setMessage(null); }}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            if (email) send(query, query);
            else if (results?.some((r) => r.username === handle) && !relation(results.find((r) => r.username === handle)!.user_id)) send(handle, `@${handle}`);
          }} />
        {email ? (
          <Button kind="prominent" icon="mail" full disabled={busy} onClick={() => send(query, query)}>Send Request</Button>
        ) : handle.length < 2 ? (
          <p className="small muted">Search by username, or enter your friend's email.</p>
        ) : searching && !results ? (
          <p className="small muted">Searching…</p>
        ) : results && results.length === 0 ? (
          <p className="small muted">No one has a username starting with “{handle}”. You can also add them by email.</p>
        ) : results && (
          <div className="divided search-results">
            {results.map((r) => {
              const known = relation(r.user_id);
              return (
                <div key={r.user_id} className="row search-result">
                  <PersonPicture avatar={r.avatar} name={r.name || r.username} size={44} />
                  <span className="grow stack tiny-gap">
                    <span className="strong">{r.name?.trim() || `@${r.username}`}</span>
                    <span className="small muted">{r.name?.trim() ? `@${r.username} · ` : ""}{levelLabel[r.level]}</span>
                  </span>
                  {known?.status === "accepted" ? <span className="small muted">Friends</span>
                    : known?.direction === "outgoing" ? <span className="small muted">Sent</span>
                    : known ? <Button kind="prominent" compact disabled={busy} onClick={() => store.acceptFriend(known.id)}>Accept</Button>
                    : <RoundButton icon="plus" tint="accent" size={36} label={`Add @${r.username}`} disabled={busy}
                      onClick={() => send(r.username, `@${r.username}`)} />}
                </div>
              );
            })}
          </div>
        )}
        {message && <p className={`small ${message.good ? "good" : "error"}`} role={message.good ? "status" : "alert"}>{message.text}</p>}
      </div>
    </Sheet>
  );
}

/** Profile → Settings → Blocked: the people you blocked, each with Unblock. */
export function BlockedSheet({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const unblock = async (userID: string) => {
    setBusy(userID);
    setError(null);
    const failed = await store.unblockUser(userID);
    setBusy(null);
    if (failed) setError(failed);
  };
  return (
    <Sheet title="Blocked" onClose={onClose}>
      <div className="stack">
        {store.blocks.length === 0 ? (
          <p className="muted center">You haven't blocked anyone.</p>
        ) : (
          <div className="divided">
            {store.blocks.map((b) => (
              <div key={b.user_id} className="row blocked-row">
                <PersonPicture avatar={b.avatar} name={b.name || b.username || ""} size={40} />
                <span className="grow stack tiny-gap">
                  <span className="strong">{b.name || (b.username ? `@${b.username}` : "Someone")}</span>
                  {b.name && b.username && <span className="small muted">@{b.username}</span>}
                </span>
                <Button compact disabled={busy !== null} onClick={() => unblock(b.user_id)}>Unblock</Button>
              </div>
            ))}
          </div>
        )}
        <p className="small muted">People you block can't find you or send you requests, and aren't told. Unblocking doesn't make you friends again.</p>
        {error && <p className="error small" role="alert">{error}</p>}
      </div>
    </Sheet>
  );
}

/** Choosing or changing your username, with a suggestion from your name and a live check that it's free. */
export type UsernameState = "empty" | "invalid" | "refused" | "checking" | "free" | "taken" | "unknown";

/** Checks a typed username as you type (a short pause first): free, taken, or not valid. */
export function useUsernameCheck(text: string): UsernameState {
  const store = useStore();
  const name = normalizeUsername(text);
  const [state, setState] = useState<UsernameState>("empty");
  useEffect(() => {
    if (!name) { setState("empty"); return; }
    if (!isValidUsername(name)) { setState("invalid"); return; }
    if (!nameAllowed(name)) { setState("refused"); return; }
    setState("checking");
    let live = true;
    const timer = window.setTimeout(async () => {
      const free = await store.usernameAvailable(name);
      if (live) setState(free === null ? "unknown" : free ? "free" : "taken");
    }, 250);
    return () => { live = false; window.clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);
  return state;
}

/** The first free username suggested from a name, or "" while none is found. */
export function useUsernameSuggestion(name: string, skip: boolean): string {
  const store = useStore();
  const [suggestion, setSuggestion] = useState("");
  useEffect(() => {
    if (skip) return;
    let live = true;
    (async () => {
      for (const candidate of usernameCandidates(name).filter(nameAllowed)) {
        const free = await store.usernameAvailable(candidate);
        if (!live) return;
        if (free !== false) { setSuggestion(candidate); return; }
      }
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, skip]);
  return suggestion;
}

export function UsernameStatus({ state }: { state: UsernameState }) {
  const status = {
    empty: null, checking: <span className="muted">Checking…</span>, free: <span className="good"><Icon name="check" size={14} /> Available</span>,
    taken: <span className="error">That username is taken.</span>, invalid: <span className="error">{USERNAME_RULE}</span>,
    refused: <span className="error">{USERNAME_REFUSED}</span>,
    unknown: <span className="muted">Couldn't check right now; you can still try saving.</span>,
  }[state];
  return <div className="small" role="status">{status}</div>;
}
