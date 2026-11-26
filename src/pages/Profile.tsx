import { isPhotoAvatar, pickAvatarPreset } from "../core/avatars";
import { useState } from "react";
import { displayLabel, type DisplayMode } from "../core/models";
import { ACHIEVEMENTS, shownTitle } from "../core/achievements";
import { levelLabel } from "../core/progress";
import { BUILT_IN } from "../core/wordBank";
import { Icon } from "../components/Icon";
import { BlockedSheet, FriendsCard } from "../components/Friends";
import { AvatarImage, AvatarPicker } from "../components/Avatar";
import { PlanCard } from "../components/Plan";
import { Button, Card, ConfirmDialog, Logo, Page, RoundButton, SectionTitle, Segmented, Sheet, copyText } from "../components/ui";
import { initials } from "../lib/settings";
import { NAME_REFUSED, nameAllowed } from "../core/names";
import { speak, useKoreanVoice } from "../lib/speech";
import { useStore } from "../lib/store";

/** The policy pages (on this site) and RezPoint's. */
const LINKS = {
  privacy: "/privacy",
  terms: "/terms",
  rezpoint: "https://rezpoint.xyz/",
};

export function Profile() {
  const store = useStore();
  const { settings } = store;
  const [editing, setEditing] = useState(false);
  const [sheet, setSheet] = useState<"blocked" | "delete" | null>(null);
  const [copied, setCopied] = useState(false);
  const [working, setWorking] = useState(false);
  const [confirming, setConfirming] = useState<"turnOff" | "signOut" | null>(null);
  // About (you, the app, Sign Out) or Settings (the app's and the account's settings).
  const [part, setPart] = useState<"about" | "settings">("about");
  const voice = useKoreanVoice();


  const run = async (action: () => Promise<void>) => { setWorking(true); setCopied(false); await action(); setWorking(false); };

  const earnedIDs = new Set(store.earned.map((a) => a.id));
  const title = shownTitle(settings.profile.title, store.earned);
  const turnOff = <Button kind="danger" icon="x" full disabled={working} onClick={() => setConfirming("turnOff")}>Turn Off Connector</Button>;

  return (
    <Page title="Profile">
      <Segmented label="Profile" value={part} onChange={setPart}
        options={[{ value: "about", label: "About" }, { value: "settings", label: "Settings" }]} />

      {part === "about" ? (
        <>
        {/* The card's border takes the colour of the level badge. */}
        <div className={`glass card profile-card level-${store.level}`} style={{ padding: 22 }}>
          <span className="profile-edit">
            <RoundButton icon="pencil" tint="glass" label="Edit Profile" size={38} onClick={() => setEditing(true)} />
          </span>
          <div className="center stack">
            {/* The picture opens Edit Profile too. */}
            <button type="button" className="avatar-button" aria-label="Change profile picture" onClick={() => setEditing(true)}>
              {settings.profile.avatar
                ? <AvatarImage className="avatar" avatar={settings.profile.avatar} size={96} />
                : <span className="avatar placeholder">{initials(settings.profile.name) || <Icon name="person" size={40} />}</span>}
            </button>
            <h2 className="profile-name">{settings.profile.name || "Your Name"}</h2>
            {store.username && <span className="profile-username muted">@{store.username}</span>}
            {title && <span className="profile-title muted">{title.title}</span>}
            <span className={`level-tag level-${store.level}`}><Icon name="cap" size={16} className="level-icon" /> {levelLabel[store.level]}</span>
            {store.error && <p className="error small" role="alert">{store.error}</p>}
          </div>
        </div>

        {/* Hidden until achievements exist (see core/achievements). */}
        {ACHIEVEMENTS.length > 0 && (
          <Card>
            <SectionTitle>Achievements</SectionTitle>
            {store.earned.length > 0 && <p className="small muted">Tap an earned title to show it under your name.</p>}
            <div className="divided">
              {ACHIEVEMENTS.map((a) => {
                const done = earnedIDs.has(a.id);
                const chosen = title?.id === a.id;
                const body = (
                  <>
                    <Icon name={done ? "award" : "lock"} size={22} className={done ? "accent" : "muted"} />
                    <span className="achievement-text"><span className="strong">{a.title}</span><span className="small muted">{a.detail}</span></span>
                    {chosen && <Icon name="check" size={18} className="accent" />}
                  </>
                );
                return done ? (
                  <button key={a.id} type="button" className="achievement earned" aria-pressed={chosen}
                    onClick={() => store.updateSettings({ profile: { ...settings.profile, title: chosen ? null : a.id } })}>{body}</button>
                ) : (
                  <div key={a.id} className="achievement" aria-label={`${a.title}, not earned yet`}>{body}</div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Phones have no sidebar, so the plan shows here (wide screens show it at the bottom of the sidebar). */}
        <PlanCard className="plan-profile" />

        <FriendsCard />

        <Card>
          <SectionTitle>About the App</SectionTitle>
          <div className="about-app">
            <Logo size={80} blink="hover" className="about-logo" />
            <div className="about-name">Korimal</div>
            <div className="small muted">Version {__APP_VERSION__}</div>
          </div>
          <div className="row toggle-row"><span>Built-In Words</span><span className="muted">{BUILT_IN.length}</span></div>
          <div className="row toggle-row"><span>My Words</span><span className="muted">{store.myWords.length}</span></div>
        </Card>

        <Card>
          <SectionTitle>Credits</SectionTitle>
          <div className="row toggle-row">
            <span>Design &amp; Development</span>
            <a className="accent strong" href={LINKS.rezpoint} target="_blank" rel="noopener noreferrer">RezPoint Inc.</a>
          </div>
        </Card>

        <Card>
          <SectionTitle>Documentation</SectionTitle>
          <div className="divided">
            <a className="row toggle-row doc-link" href={LINKS.privacy} target="_blank" rel="noopener noreferrer">
              <span>Privacy Policy</span><Icon name="external" size={16} className="muted" />
            </a>
            <a className="row toggle-row doc-link" href={LINKS.terms} target="_blank" rel="noopener noreferrer">
              <span>Terms of Service</span><Icon name="external" size={16} className="muted" />
            </a>
          </div>
        </Card>

        <button type="button" className="button sign-out full" onClick={() => setConfirming("signOut")}>Sign Out</button>
        </>
      ) : (
        <>
        <Card>
          <SectionTitle>Word of the Day</SectionTitle>
          <div className="small muted">Show Word In</div>
          <Segmented label="Show Word In" value={settings.display} onChange={(display) => store.updateSettings({ display })}
            options={(["korean", "romanization", "both"] as DisplayMode[]).map((m) => ({ value: m, label: displayLabel[m] }))} />
          <p className="small muted">Everyone gets the same built-in word each day.</p>
        </Card>

        <Card>
          <SectionTitle>Korean Voice</SectionTitle>
          <div className="row toggle-row"><span>Listening</span><span className="muted">{voice ? "On" : "Off"}</span></div>
          {voice ? (
            <>
              <div className="row toggle-row"><span>Voice</span><span className="muted">{voice.name}</span></div>
              <Button icon="speaker" full onClick={() => speak("안녕하세요. 만나서 반갑습니다.")}>Play Sample</Button>
            </>
          ) : (
            <p className="small muted">This browser has no Korean voice, so listening is off. Safari and Chrome on most devices include one; on a computer you can add a Korean voice in the system's speech or language settings.</p>
          )}
        </Card>

        <Card>
          <SectionTitle>Claude Connector</SectionTitle>
          {store.connectorURL ? (
            <div className="stack">
              <code className="connector-url">{store.connectorURL}</code>
              <Button kind="prominent" icon={copied ? "check" : "copy"} full onClick={() => { copyText(store.connectorURL!); setCopied(true); }}>
                {copied ? "Copied" : "Copy Connector Link"}
              </Button>
              {turnOff}
            </div>
          ) : store.data.hasConnectorToken ? (
            <div className="stack">
              <p className="small muted">A connector link is active, but it was made on another device before links were shared, so it can't be shown here. Turn it off, then create a new one to see it on every device.</p>
              {turnOff}
            </div>
          ) : (
            <Button kind="prominent" icon="link" full disabled={working} onClick={() => run(store.createConnectorLink)}>Create Connector Link</Button>
          )}
          <p className="small muted">In Claude, open Settings → Connectors → Add custom connector, name it Korimal and paste this link. Then share your notes, PDFs or screenshots in a chat and ask for a study guide or to add words. Treat the link like a password: anyone who has it can add to your Malchingu.</p>
        </Card>

        <Card>
          <SectionTitle>Account</SectionTitle>
          <button type="button" className="plain-row" onClick={() => setSheet("blocked")}>
            <Icon name="block" size={20} className="accent" />
            <span className="grow">Blocked</span>
            <span className="muted">{store.blocks.length}</span>
            <Icon name="chevron" size={16} className="muted" />
          </button>
          <button type="button" className="button delete-account full" onClick={() => setSheet("delete")}>Delete Account</button>
          <p className="small muted">Removes your account and all of your Korimal data from our servers.</p>
        </Card>
        </>
      )}

      {sheet === "blocked" && <BlockedSheet onClose={() => setSheet(null)} />}
      {sheet === "delete" && <DeleteAccountSheet onClose={() => setSheet(null)} />}

      {editing && <EditProfileSheet onClose={() => setEditing(false)} />}
      {confirming === "turnOff" && (
        <ConfirmDialog title="Turn Off the Connector?" message="The link stops working in Claude. You can create a new link afterwards and add it to Claude again."
          confirmLabel="Turn Off" onCancel={() => setConfirming(null)}
          onConfirm={() => { setConfirming(null); run(store.revokeConnectorLink); }} />
      )}
      {confirming === "signOut" && (
        <ConfirmDialog title="Sign Out?" message="Your words, stats and guides stay in your account and come back when you sign in again."
          confirmLabel="Sign Out" onCancel={() => setConfirming(null)} onConfirm={() => { setConfirming(null); store.signOut(); }} />
      )}
    </Page>
  );
}

/** Delete Account: "delete my account" has to be typed before the button works. Deletes everything on every device. */
function DeleteAccountSheet({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmed = typed.trim().toLowerCase() === DELETE_PHRASE;
  const remove = async () => {
    if (!confirmed || deleting) return;
    setDeleting(true);
    setError(null);
    const failed = await store.deleteAccount();
    setDeleting(false);
    if (failed) setError(failed);
  };
  return (
    <Sheet title="Delete Your Account?" onClose={onClose}>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); remove(); }}>
        <p className="error strong">This can't be undone</p>
        <p className="muted">This deletes your account and everything in it: your words, progress, study guides, notes, saved translations, connector link, username, friends and challenges, on every device.</p>
        <label className="stack tiny-gap">
          <span>Type <strong>{DELETE_PHRASE}</strong> to continue.</span>
          <input className="text-input sheet-input" value={typed} placeholder={DELETE_PHRASE} aria-label="Type delete my account"
            autoCapitalize="off" autoCorrect="off" spellCheck={false} autoFocus onChange={(e) => setTyped(e.target.value)} />
        </label>
        <Button type="submit" kind="destructive" full large disabled={!confirmed || deleting}>{deleting ? "Deleting…" : "Delete Account"}</Button>
        {error && <p className="error small" role="alert">{error}</p>}
      </form>
    </Sheet>
  );
}

const DELETE_PHRASE = "delete my account";

/** Edit Profile (the pencil, or tapping the picture): your name and picture (a preset, or a photo with Pro). */
function EditProfileSheet({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const profile = store.settings.profile;
  const [name, setName] = useState(profile.name);
  // A free account can't keep an uploaded photo (say, after Pro ended): it starts from a preset instead.
  const [avatar, setAvatar] = useState(() =>
    store.plan === "free" && isPhotoAvatar(profile.avatar) ? pickAvatarPreset() : profile.avatar);
  const changed = name.trim() !== profile.name || avatar !== profile.avatar;
  const allowed = nameAllowed(name);
  const canSave = name.trim().length > 0 && allowed && changed;
  const save = () => {
    if (!canSave) return;
    store.updateSettings({ profile: { ...profile, name: name.trim(), avatar } });
    onClose();
  };
  return (
    <Sheet title="Edit Profile" onClose={onClose}>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <div className="onboarding-avatar">
          {avatar ? <AvatarImage className="avatar" avatar={avatar} size={96} />
            : <span className="avatar placeholder">{initials(name) || <Icon name="person" size={40} />}</span>}
        </div>
        <AvatarPicker value={avatar} onChange={setAvatar} canUpload={store.plan === "pro"} />
        <input className="text-input sheet-input" value={name} aria-label="Your name" placeholder="Your Name" maxLength={80}
          onChange={(e) => setName(e.target.value)} />
        {!allowed && <p className="small error" role="alert">{NAME_REFUSED}</p>}
        <Button type="submit" kind="prominent" full large disabled={!canSave}>Save</Button>
      </form>
    </Sheet>
  );
}
