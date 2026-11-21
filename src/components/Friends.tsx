import { useEffect, useRef, useState, type ReactNode } from "react";
import { challengeNeedsMe, duelWinner, friendLabel, isValidUsername, looksLikeEmail, normalizeUsername, orderFriends, percent,
  shortLabel, usernameCandidates, weekStatus, weekWinner, type ChallengeRow, type FriendRow, type UserSearchRow } from "../core/friends";
import { levelLabel, type Level } from "../core/progress";
import { dayString } from "../core/wordOfDay";
import { avatarSrc } from "../lib/avatar";
import { initials } from "../lib/settings";
import { USERNAME_RULE, useStore } from "../lib/store";
import { Icon } from "./Icon";
import { Button, Card, ConfirmDialog, SectionTitle, Sheet } from "./ui";

// Profile → About → Friends: a row of friends' pictures with + at the end, a page for each friend (Accept, Challenge
// Friend, Remove Friend), adding by username or email, and choosing a username.

/** A round picture, or initials on the app's gradient; an envelope for a request sent to an email. */
export function PersonPicture({ avatar, name, size, mail }: { avatar: string | null; name: string; size: number; mail?: boolean }) {
  if (avatar) return <img className="person-picture" src={avatarSrc(avatar)} alt="" width={size} height={size} style={{ width: size, height: size }} />;
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
  const [sheet, setSheet] = useState<"add" | "username" | "usernameThenAdd" | null>(null);
  const rows = orderFriends(store.friends);
  const open = store.friends.find((f) => f.id === openID) ?? null;

  // Ask once for a username (Not Now counts); after that, only when + is tapped without one.
  const asked = useRef(false);
  useEffect(() => {
    if (asked.current || !store.loaded || store.username !== null || store.settings.usernameAsked) return;
    asked.current = true;
    setSheet("username");
  }, [store.loaded, store.username, store.settings.usernameAsked]);

  const closeUsername = () => {
    if (!store.settings.usernameAsked) store.updateSettings({ usernameAsked: true });
    setSheet(sheet === "usernameThenAdd" ? "add" : null);
  };

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
          {store.friendsLoaded && rows.length === 0 && <span className="small muted friends-empty">Add friends with +</span>}
        </div>
        <button type="button" className="friend" aria-label="Add Friend" title="Add Friend"
          onClick={() => setSheet(store.username ? "add" : "usernameThenAdd")}>
          <span className="friend-picture friend-add"><Icon name="plus" size={24} strokeWidth={2.4} /></span>
          <span className="friend-caption">Add</span>
        </button>
      </div>
      {store.friendsError && <p className="error small" role="alert">{store.friendsError}</p>}

      {/* Hidden while a duel is played, then back with its result. */}
      {open && !store.duel && <FriendSheet friend={open} onClose={() => setOpenID(null)} />}
      {sheet === "add" && <AddFriendSheet onClose={() => setSheet(null)} />}
      {(sheet === "username" || sheet === "usernameThenAdd") && <UsernameSheet onClose={closeUsername} />}
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
        </div>
      )}

      {friend.status === "pending" && friend.direction === "outgoing" && (
        <div className="stack">
          <p className="center muted">
            {friend.user_id
              ? `Request sent. ${first} can accept it in Profile.`
              : "Request sent. It reaches them when they sign in to Malchingu with this email."}
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
        </div>
      )}

      {error && <p className="error small center" role="alert">{error}</p>}

      {confirmRemove && (
        <ConfirmDialog title={`Remove ${first}?`} confirmLabel="Remove"
          message="You'll stop seeing each other's name, picture and level, and your challenges end. You can add each other again later."
          onCancel={() => setConfirmRemove(false)}
          onConfirm={() => { setConfirmRemove(false); run(() => store.removeFriend(friend.id)).then((ok) => ok && onClose()); }} />
      )}
    </Sheet>
  );
}

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
        ? { text: `Request sent to ${shown}. If they don't use Malchingu yet, it reaches them when they sign up with that email.`, good: true }
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
                  <PersonPicture avatar={r.avatar} name={r.username} size={44} />
                  <span className="grow stack tiny-gap">
                    <span className="strong">@{r.username}</span>
                    <span className="small muted">{levelLabel[r.level]}</span>
                  </span>
                  {known?.status === "accepted" ? <span className="small muted">Friends</span>
                    : known?.direction === "outgoing" ? <span className="small muted">Sent</span>
                    : known ? <Button kind="prominent" compact disabled={busy} onClick={() => store.acceptFriend(known.id)}>Accept</Button>
                    : <Button kind="prominent" icon="plus" compact disabled={busy} onClick={() => send(r.username, `@${r.username}`)}>Add</Button>}
                </div>
              );
            })}
          </div>
        )}
        {message && <p className={`small ${message.good ? "good" : "error"}`} role={message.good ? "status" : "alert"}>{message.text}</p>}
        <p className="small muted">They'll see your request in Profile and can accept or decline it. Friends see each other's name, picture and level.</p>
      </div>
    </Sheet>
  );
}

/** Choosing or changing your username, with a suggestion from your name and a live check that it's free. */
export function UsernameSheet({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const current = store.username ?? null;
  const [text, setText] = useState(current ?? "");
  const [state, setState] = useState<"empty" | "invalid" | "checking" | "free" | "taken" | "unknown" | "current">("empty");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const typed = useRef(false);
  const name = normalizeUsername(text);

  // Without a username yet, fill in the first free suggestion (unless you've started typing).
  useEffect(() => {
    if (current) return;
    let live = true;
    (async () => {
      for (const candidate of usernameCandidates(store.settings.profile.name)) {
        const free = await store.usernameAvailable(candidate);
        if (!live || typed.current) return;
        if (free !== false) { setText(candidate); return; }
      }
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!name) { setState("empty"); return; }
    if (!isValidUsername(name)) { setState("invalid"); return; }
    if (name === current) { setState("current"); return; }
    setState("checking");
    let live = true;
    const timer = window.setTimeout(async () => {
      const free = await store.usernameAvailable(name);
      if (live) setState(free === null ? "unknown" : free ? "free" : "taken");
    }, 250);
    return () => { live = false; window.clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, current]);

  const save = async () => {
    if (state === "current") { onClose(); return; }
    setSaving(true);
    setError(null);
    const failed = await store.setUsername(name);
    setSaving(false);
    if (failed) setError(failed); else onClose();
  };

  const status = {
    empty: null, checking: <span className="muted">Checking…</span>, free: <span className="good"><Icon name="check" size={14} /> Available</span>,
    taken: <span className="error">That username is taken.</span>, invalid: <span className="error">{USERNAME_RULE}</span>,
    unknown: <span className="muted">Couldn't check right now; you can still try saving.</span>,
    current: <span className="muted">This is your username.</span>,
  }[state];

  return (
    <Sheet title={current ? "Change Username" : "Choose a Username"} onClose={onClose}>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); if (state === "free" || state === "unknown" || state === "current") save(); }}>
        <p className="muted">Friends find you by your username. Anyone signed in to Malchingu can find your username, picture and level; only friends see your name.</p>
        <label className="username-field">
          <span className="muted" aria-hidden="true">@</span>
          <input value={text} aria-label="Username" autoFocus maxLength={21} autoCapitalize="off" autoCorrect="off" spellCheck={false}
            placeholder="username" onChange={(e) => { typed.current = true; setText(e.target.value); setError(null); }} />
        </label>
        <div className="small" role="status">{status}</div>
        {error && <p className="error small" role="alert">{error}</p>}
        <Button type="submit" kind="prominent" full large disabled={saving || !(state === "free" || state === "unknown" || state === "current")}>Save</Button>
        <Button full onClick={onClose}>{current ? "Cancel" : "Not Now"}</Button>
        {!current && <p className="small muted center">You can choose one later in Settings.</p>}
      </form>
    </Sheet>
  );
}
