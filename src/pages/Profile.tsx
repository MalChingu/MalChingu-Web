import { useEffect, useRef, useState } from "react";
import { PARTS_OF_SPEECH, displayLabel, posPlural, type DisplayMode, type PartOfSpeech } from "../core/models";
import { ACHIEVEMENTS, shownTitle } from "../core/achievements";
import { levelLabel } from "../core/progress";
import { BUILT_IN } from "../core/wordBank";
import { Icon } from "../components/Icon";
import { Button, Card, ConfirmDialog, Logo, Page, SectionTitle, Segmented, Toggle, copyText } from "../components/ui";
import { avatarSrc, squareJPEGBase64 } from "../lib/avatar";
import { initials } from "../lib/settings";
import { speak, useKoreanVoice } from "../lib/speech";
import { useAppearance, type Appearance } from "../lib/theme";
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
  const [name, setName] = useState(settings.profile.name);
  const [copied, setCopied] = useState(false);
  const [working, setWorking] = useState(false);
  const [confirming, setConfirming] = useState<"turnOff" | "signOut" | null>(null);
  // About (you, the app, Sign Out) or Settings (the app's and the account's settings).
  const [part, setPart] = useState<"about" | "settings">("about");
  const file = useRef<HTMLInputElement>(null);
  const voice = useKoreanVoice();
  const [appearance, setAppearance] = useAppearance();

  useEffect(() => setName(settings.profile.name), [settings.profile.name]);

  const saveName = () => {
    if (name.trim() !== settings.profile.name) store.updateSettings({ profile: { ...settings.profile, name: name.trim() } });
  };

  const setType = (pos: PartOfSpeech, on: boolean) => {
    const current = new Set(settings.wordTypes.length ? settings.wordTypes : PARTS_OF_SPEECH);
    if (on) current.add(pos); else current.delete(pos);
    if (current.size === 0) return;   // keep at least one on; "all on" is stored as empty
    store.updateSettings({ wordTypes: current.size === PARTS_OF_SPEECH.length ? [] : PARTS_OF_SPEECH.filter((p) => current.has(p)) });
  };

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
          <div className="center stack">
            <button type="button" className="avatar-button" aria-label="Change profile picture" onClick={() => file.current?.click()}>
              {settings.profile.avatar
                ? <img className="avatar" src={avatarSrc(settings.profile.avatar)} alt="" />
                : <span className="avatar placeholder">{initials(settings.profile.name) || <Icon name="person" size={40} />}</span>}
              <span className="avatar-camera"><Icon name="camera" size={16} /></span>
            </button>
            <input ref={file} type="file" accept="image/*" hidden onChange={async (e) => {
              const picked = e.target.files?.[0];
              e.target.value = "";
              if (!picked) return;
              try { store.updateSettings({ profile: { ...settings.profile, avatar: await squareJPEGBase64(picked) } }); }
              catch { store.setError("Couldn't read that picture."); }
            }} />
            {settings.profile.avatar && (
              <button type="button" className="link small" onClick={() => store.updateSettings({ profile: { ...settings.profile, avatar: null } })}>
                Remove Picture
              </button>
            )}
            <input className="name-input" value={name} placeholder="Your Name" aria-label="Your name"
              onChange={(e) => setName(e.target.value)} onBlur={saveName}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
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

        <Card>
          <SectionTitle>About the App</SectionTitle>
          <div className="about-app">
            <Logo size={80} blink="hover" className="about-logo" />
            <div className="about-name">Malchingu</div>
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

        <button type="button" className="button sign-out full large" onClick={() => setConfirming("signOut")}>Sign Out</button>
        </>
      ) : (
        <>
        <Card>
          <SectionTitle>Appearance</SectionTitle>
          <Segmented label="Appearance" value={appearance} onChange={setAppearance}
            options={(["system", "light", "dark"] as Appearance[]).map((o) => ({ value: o, label: o[0].toUpperCase() + o.slice(1) }))} />
        </Card>

        <Card>
          <SectionTitle>Word of the Day</SectionTitle>
          <div className="small muted">Show Word In</div>
          <Segmented label="Show Word In" value={settings.display} onChange={(display) => store.updateSettings({ display })}
            options={(["korean", "romanization", "both"] as DisplayMode[]).map((m) => ({ value: m, label: displayLabel[m] }))} />
          {PARTS_OF_SPEECH.map((pos) => (
            <Toggle key={pos} label={posPlural(pos)} checked={settings.wordTypes.length === 0 || settings.wordTypes.includes(pos)}
              onChange={(on) => setType(pos, on)} />
          ))}
          <Toggle label="Include My Words" checked={settings.includeMyWords} onChange={(on) => store.updateSettings({ includeMyWords: on })} />
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
          <p className="small muted">In Claude, open Settings → Connectors → Add custom connector, name it Malchingu and paste this link. Then share your notes, PDFs or screenshots in a chat and ask for a study guide or to add words. Treat the link like a password: anyone who has it can add to your Malchingu.</p>
        </Card>
        </>
      )}

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
