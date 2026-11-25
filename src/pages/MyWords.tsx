import { useState } from "react";
import { customToWord, matchesSearch } from "../core/wordBank";
import { Icon } from "../components/Icon";
import { Button, Card, ConfirmDialog, Page, RoundButton, Sheet, Steps, WordRow, copyText } from "../components/ui";
import type { CustomWordRow } from "../core/models";
import { useStore } from "../lib/store";

/** Words and phrases the learner added through Claude. Delete one with its trash button,
 *  or several at once with Select. */
export function MyWords({ onBack }: { onBack: () => void }) {
  const store = useStore();
  const [help, setHelp] = useState(false);
  const [deleting, setDeleting] = useState<CustomWordRow | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmingMany, setConfirmingMany] = useState(false);
  const [query, setQuery] = useState("");
  const words = store.myWords.filter((w) => matchesSearch(w, query));
  // Anything deleted on another device meanwhile drops out of the selection.
  const chosen = words.filter((w) => selected.has(w.id)).map((w) => w.id);
  const allChosen = words.length > 0 && chosen.length === words.length;
  const stop = () => { setSelecting(false); setSelected(new Set()); };
  const toggle = (id: string) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <Page title={selecting ? (chosen.length ? `${chosen.length} Selected` : "Select Words") : "My Words"}
      back={selecting ? undefined : { label: "Back to Flashcards", onClick: onBack }} actions={selecting ? (
        <>
          <button type="button" className="button glass" onClick={() => setSelected(allChosen ? new Set() : new Set(words.map((w) => w.id)))}>
            {allChosen ? "Deselect All" : "Select All"}
          </button>
          <RoundButton icon="x" tint="glass" label="Done Selecting" onClick={stop} size={38} />
        </>
      ) : (
        <>
          {words.length > 0 && <RoundButton icon="select" tint="glass" label="Select Words" onClick={() => setSelecting(true)} size={38} />}
          <RoundButton icon="question" tint="glass" label="How to Add Words" onClick={() => setHelp(true)} size={38} />
        </>
      )}>
      {store.myWords.length > 0 && (
        <label className="search-field glass">
          <Icon name="search" size={18} className="muted" />
          <input type="search" value={query} placeholder="Search My Words" aria-label="Search My Words"
            autoCapitalize="off" autoCorrect="off" spellCheck={false} onChange={(e) => setQuery(e.target.value)} />
          {query && <button type="button" className="icon-button" aria-label="Clear Search" onClick={() => setQuery("")}><Icon name="x" size={16} /></button>}
        </label>
      )}
      {store.myWords.length > 0 && words.length === 0 ? (
        <p className="muted center">No words match “{query.trim()}”.</p>
      ) : words.length === 0 ? (
        <Card padding={28}>
          <div className="center stack">
            <Icon name="textBook" size={36} className="muted" />
            <h3>No Words Yet</h3>
            <p className="muted">Words are added through Claude.</p>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="divided" role={selecting ? "group" : undefined} aria-label={selecting ? "Words to delete" : undefined}>
            {words.map((row) => {
              const word = customToWord(row);
              const on = selected.has(row.id);
              return (
                <div key={row.id} className={`row ${selecting && on ? "picked" : ""}`}>
                  {selecting && (
                    <button type="button" className={`select-mark ${on ? "on" : ""}`} role="checkbox" aria-checked={on}
                      aria-label={`Select ${row.hangul}`} onClick={() => toggle(row.id)}>
                      <Icon name={on ? "checkCircle" : "circle"} size={22} />
                    </button>
                  )}
                  <WordRow word={word} progress={store.progressFor(word.id)}
                    onClick={() => selecting ? toggle(row.id) : store.openWord(word)} />
                  {!selecting && (
                    <button type="button" className="icon-button bad" aria-label={`Delete ${row.hangul}`}
                      onClick={() => setDeleting(row)}>
                      <Icon name="trash" size={18} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}
      {selecting && (
        <div className="selection-bar">
          <button type="button" className="button full large destructive" disabled={chosen.length === 0} onClick={() => setConfirmingMany(true)}>
            <Icon name="trash" size={18} /> {chosen.length ? `Delete ${chosen.length} ${chosen.length === 1 ? "Word" : "Words"}` : "Delete"}
          </button>
        </div>
      )}
      {help && <AddWordsHelp onClose={() => setHelp(false)} />}
      {deleting && (
        <ConfirmDialog title={`Delete ${deleting.hangul}?`} message="It's removed from My Words and flashcards on all your devices, with its progress."
          confirmLabel="Delete" onCancel={() => setDeleting(null)} onConfirm={() => { store.deleteWord(deleting); setDeleting(null); }} />
      )}
      {confirmingMany && (
        <ConfirmDialog title={chosen.length === 1 ? "Delete 1 Word?" : `Delete ${chosen.length} Words?`}
          message="They're removed from My Words and flashcards on all your devices, with their progress."
          confirmLabel="Delete" onCancel={() => setConfirmingMany(false)}
          onConfirm={() => { store.deleteWords(chosen); setConfirmingMany(false); stop(); }} />
      )}
    </Page>
  );
}

const REQUEST = "Add these words to Korimal: 도서관, 운동하다, 맛있다";

function AddWordsHelp({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const [copied, setCopied] = useState(false);
  const connected = store.data.hasConnectorToken;
  return (
    <Sheet title="How to Add Words" onClose={onClose}>
      <Card>
        <div className="section-title">Adding Words</div>
        <Steps steps={[
          { title: "Connect Claude Once", text: connected ? "Done. Your connector link is set up."
            : "Create your connector link in Profile → Claude Connector and add it in Claude." },
          { title: "Ask Claude to Add Them", text: "In a Claude chat, write \"Add these words to Korimal:\" followed by your words. Claude fills in the rest and can add many at once." },
          { title: "Refresh Here", text: "When Claude says they are saved, come back to this page. They show up here and in flashcards. Words that are already built in or saved aren't added twice." },
        ]} />
      </Card>
      <Card>
        <div className="section-title">Example Request</div>
        <p lang="ko">{REQUEST}</p>
        <Button kind="prominent" icon={copied ? "check" : "copy"} full large onClick={() => { copyText(REQUEST); setCopied(true); }}>
          {copied ? "Request Copied" : "Copy Request"}
        </Button>
        <p className="small muted">Swap in your own words. The list can be in any form: separated by commas, in brackets, one per line, or a photo of your notes.</p>
      </Card>
    </Sheet>
  );
}
