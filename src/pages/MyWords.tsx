import { useState } from "react";
import { customToWord } from "../core/wordBank";
import { Icon } from "../components/Icon";
import { Button, Card, Page, RoundButton, Sheet, Steps, WordRow, copyText } from "../components/ui";
import { useStore } from "../lib/store";

/** Words and phrases the learner added through Claude. */
export function MyWords({ onBack }: { onBack: () => void }) {
  const store = useStore();
  const [help, setHelp] = useState(false);
  return (
    <Page title="My Words" actions={
      <>
        <RoundButton icon="question" tint="glass" label="How to Add Words" onClick={() => setHelp(true)} size={38} />
      </>
    }>
      <button type="button" className="back-link" onClick={onBack}><Icon name="chevron" size={14} className="flip" /> Flashcards</button>
      {store.myWords.length === 0 ? (
        <Card padding={28}>
          <div className="center stack">
            <Icon name="textBook" size={36} className="muted" />
            <h3>No Words Yet</h3>
            <p className="muted">Words are added through Claude.</p>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="divided">
            {store.myWords.map((row) => {
              const word = customToWord(row);
              return (
                <div key={row.id} className="row">
                  <WordRow word={word} progress={store.progressFor(word.id)} onClick={() => store.openWord(word)} />
                  <button type="button" className="icon-button bad" aria-label={`Delete ${row.hangul}`}
                    onClick={() => { if (confirm(`Delete ${row.hangul}?`)) store.deleteWord(row); }}>
                    <Icon name="trash" size={18} />
                  </button>
                </div>
              );
            })}
          </div>
        </Card>
      )}
      {help && <AddWordsHelp onClose={() => setHelp(false)} />}
    </Page>
  );
}

const REQUEST = "Add these words to Malchingu: 도서관, 운동하다, 맛있다";

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
          { title: "Ask Claude to Add Them", text: "In a Claude chat, write \"Add these words to Malchingu:\" followed by your words. Claude fills in the rest and can add many at once." },
          { title: "Refresh Here", text: "When Claude says they are saved, come back to this page. They show up here, in flashcards and in the word of the day." },
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
