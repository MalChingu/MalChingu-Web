import { useEffect, useRef, useState } from "react";
import { PARTS_OF_SPEECH, displayLabel, posPlural, type DisplayMode, type PartOfSpeech } from "../core/models";
import { levelLabel } from "../core/progress";
import { BUILT_IN } from "../core/wordBank";
import { Icon } from "../components/Icon";
import { Button, Card, Page, SectionTitle, Segmented, Toggle, copyText } from "../components/ui";
import { avatarSrc, squareJPEGBase64 } from "../lib/avatar";
import { initials } from "../lib/settings";
import { speak, useKoreanVoice } from "../lib/speech";
import { useAppearance, type Appearance } from "../lib/theme";
import { useStore } from "../lib/store";

export function Profile() {
  const store = useStore();
  const { settings } = store;
  const [name, setName] = useState(settings.profile.name);
  const [copied, setCopied] = useState(false);
  const [working, setWorking] = useState(false);
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

  return (
    <Page title="Profile" narrow>
      <Card padding={22}>
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
          <span className="level-tag"><Icon name="cap" size={16} /> {levelLabel[store.level]}</span>
          {store.error && <p className="error small" role="alert">{store.error}</p>}
        </div>
      </Card>

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
            <Button icon="refresh" full disabled={working} onClick={() => {
              if (confirm("Create a new link? The current link stops working and you'll need to update the connector in Claude.")) run(store.createConnectorLink);
            }}>Create a New Link</Button>
            <Button kind="danger" icon="x" full disabled={working} onClick={() => run(store.revokeConnectorLink)}>Turn Off Connector</Button>
          </div>
        ) : (
          <div className="stack">
            {store.data.hasConnectorToken && (
              <p className="small muted">A connector link is already set up, but it was created on another device, so it can't be shown here. Create a new link to see one here (the old link then stops working).</p>
            )}
            <Button kind="prominent" icon="link" full disabled={working} onClick={() => run(store.createConnectorLink)}>
              {store.data.hasConnectorToken ? "Create a New Link" : "Create Connector Link"}
            </Button>
            {store.data.hasConnectorToken && <Button kind="danger" icon="x" full disabled={working} onClick={() => run(store.revokeConnectorLink)}>Turn Off Connector</Button>}
          </div>
        )}
        <p className="small muted">In Claude, open Settings → Connectors → Add custom connector, name it Malchingu and paste this link. Then share your notes, PDFs or screenshots in a chat and ask for a study guide or to add words. Treat the link like a password: anyone who has it can add to your Malchingu.</p>
      </Card>

      <Card>
        <SectionTitle>About</SectionTitle>
        <div className="row toggle-row"><span>Created By</span><span className="muted">RezPoint Inc.</span></div>
        <div className="row toggle-row"><span>Built-In Words</span><span className="muted">{BUILT_IN.length}</span></div>
        <div className="row toggle-row"><span>My Words</span><span className="muted">{store.myWords.length}</span></div>
      </Card>

      <button type="button" className="button sign-out full large" onClick={() => {
        if (confirm("Sign out? Your words, stats and guides stay in your account and come back when you sign in again.")) store.signOut();
      }}>Sign Out</button>
    </Page>
  );
}
