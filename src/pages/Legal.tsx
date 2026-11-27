import { useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { Button, Copyright } from "../components/ui";
import { supabase } from "../lib/supabase";
import { ProviderButtons } from "./SignIn";

// The Privacy Policy (/privacy), Terms of Service (/terms) and the Delete Account page (/delete-account, the link
// Google Play asks for), on Korimal's own site and in its design. They open without signing in.

export type LegalKind = "privacy" | "terms" | "delete-account";

export function legalKind(pathname: string): LegalKind | null {
  const path = pathname.replace(/\/+$/, "");
  return path === "/privacy" ? "privacy" : path === "/terms" ? "terms" : path === "/delete-account" ? "delete-account" : null;
}

const TITLE: Record<LegalKind, string> = { privacy: "Privacy Policy", terms: "Terms of Service", "delete-account": "Delete Your Account" };
const LINK: Record<LegalKind, string> = { privacy: "Privacy Policy", terms: "Terms of Service", "delete-account": "Delete Account" };
const HEADING: Record<LegalKind, string> = {
  privacy: "Korimal Privacy Policy", terms: "Korimal Terms of Service", "delete-account": "Delete Your Korimal Account",
};
/** Signing in from the Delete Account page comes back to it (see main.tsx, if sign-in lands on the home page). */
export const AFTER_SIGN_IN_KEY = "korimal.afterSignIn";
const DELETE_PHRASE = "delete my account";
const UPDATED = "Nov 27, 2026";
const CONTACT = "atinderpaulk@rezpoint.xyz";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="legal-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

const External = ({ href, children }: { href: string; children: ReactNode }) =>
  <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;

const Contact = ({ lead }: { lead: string }) => (
  <p>{lead} <a href={`mailto:${CONTACT}`}>{CONTACT}</a></p>
);

function Privacy() {
  return (
    <>
      <p>
        Korimal (코리말, formerly Malchingu) is a Korean study app made by RezPoint Inc. ("we", "our") for the web, iPhone,
        iPad, Mac and Android. This policy explains what Korimal stores about you, why, and the choices you have.
        Korimal has no ads and does not sell or rent your information.
      </p>
      <Section title="Information We Collect">
        <p>When you use Korimal, we store:</p>
        <ul>
          <li>Your account: you sign in with Apple or Google. We receive an account identifier and the email address the provider shares, which may be a private relay address, and your name if you choose to share it.</li>
          <li>Your profile: the display name, title and username you choose, and your profile picture: one of Korimal's pictures or, on Korimal Pro, a photo you upload (kept as a small 128-pixel image).</li>
          <li>Your plan: whether your account is free or Korimal Pro.</li>
          <li>Your study data: the words you add, your progress on each word, quiz and flashcard answers, daily study totals and streaks, the word of the day quiz, study guides and their tasks, your notes and the translations you save.</li>
          <li>Your settings, such as your flashcard setup and notification times.</li>
          <li>Your friends: the friend requests you send and receive, your friendships, the people you block, and the challenges you play with friends and their results.</li>
          <li>Notification tokens: if you allow notifications in the iPhone, iPad, Mac or Android app, a token for that device, so we can tell you about friend requests, challenges and duel results.</li>
        </ul>
        <p>Korimal does not request your contacts, location or phone number, and does not use advertising trackers.</p>
      </Section>
      <Section title="Friends and Challenges">
        <p>Friends are optional. If you use them, here is what other people can see:</p>
        <ul>
          <li>Anyone signed in to Korimal can search for your username and see it with your profile picture and level. They cannot see your name or email address this way.</li>
          <li>Your friends, and people you send a friend request to, also see your display name.</li>
          <li>Nobody is shown your email address. Friends are added by username only.</li>
          <li>In a Flashcard Duel, you and your friend see each other's score once you have both played. In a 7-Day Challenge, you each see how many answers the other got right, and how many they answered, during those 7 days. Friends do not see your words, notes, guides or other study data.</li>
        </ul>
        <ul>
          <li>Your username is set once and can't be changed. Names and usernames that use offensive words can't be saved.</li>
          <li>You can remove a friend, or decline a request or challenge, at any time. Removing a friend ends your challenges with them.</li>
          <li>You can block anyone from their page. Blocking ends your friendship, requests and challenges with them, and neither of you can find or add the other. They aren't told. You can unblock people in Profile, then Settings, then Blocked.</li>
        </ul>
      </Section>
      <Section title="The Claude Connector">
        <p>
          You can connect Korimal to Claude, an AI assistant made by Anthropic, so Claude can write study guides and add
          words for you. The app creates a personal connector link for your account; we store only a one-way hash of its
          key. When you ask Claude to use Korimal, Claude can read your study progress, guides and notes on guides and
          save guides and words to your account, only through that link.
        </p>
        <p>
          Anything you share in a Claude chat, such as your tutor's notes or screenshots, is handled by Anthropic under{" "}
          <External href="https://www.anthropic.com/legal/privacy">Anthropic's Privacy Policy</External>. You can turn the
          connector off at any time in Profile, which stops the link from working.
        </p>
      </Section>
      <Section title="Speech, Voice and Translation">
        <ul>
          <li>Listen uses the Korean voice on your device. The text is not sent to us.</li>
          <li>Translating Korean in the notes uses translators that run on your device: Apple Translation, Google ML Kit on Android, or your browser's built-in translator. ML Kit may download its Korean language model once.</li>
          <li>When you tap the microphone, what you say is turned into text by your device's or browser's speech recogniser (from Apple, Google or your browser's maker), which may process the audio on their servers under their own policies. Korimal receives only the text and does not store recordings.</li>
        </ul>
      </Section>
      <Section title="How We Use Information">
        <ul>
          <li>To create your account and sign you in</li>
          <li>To save your study data and keep it in sync across your devices</li>
          <li>To show your progress, streaks, level and achievements, and to pick the words you need to practise</li>
          <li>To send the reminders you turn on, which are scheduled on your device</li>
          <li>To send notifications about friend requests, challenges and duel results, if you allow them</li>
          <li>To run the Claude connector when you use it</li>
          <li>To keep the service working and secure</li>
        </ul>
      </Section>
      <Section title="Third-Party Services">
        <ul>
          <li>Supabase stores your account and study data and runs the Claude connector.</li>
          <li>Apple and Google provide sign-in, and on their devices the voice, translation and speech features described above. Apple Push Notification service and Google's Firebase Cloud Messaging deliver notifications to your device; they receive the device token and the notification's text.</li>
          <li>Anthropic provides Claude, only if you connect it.</li>
          <li>Vercel hosts this website and the web app and counts anonymous page views with Vercel Web Analytics, which uses no cookies and does not identify you.</li>
          <li>Google Fonts provides the website's font, so your browser contacts Google when the web app loads, which shares your IP address with Google.</li>
        </ul>
      </Section>
      <Section title="Data Sharing">
        <p>We do not sell, rent or share your information with advertisers. We share it only with the services above, as needed to run Korimal, with your friends as described in Friends and Challenges, or when the law requires it.</p>
      </Section>
      <Section title="Data Storage and Security">
        <p>
          Your data is sent over encrypted connections and stored by Supabase in the United States, so if you live
          elsewhere it is stored and processed there. Each account can read and change only its
          own data, apart from what it shares with friends as described above. The apps also keep a copy on your device so they work offline, and the home-screen widgets read your
          words from that copy.
        </p>
      </Section>
      <Section title="Data Retention and Deletion">
        <p>We keep your data while your account exists. You can delete your words, study guides and notes in the app at any time.</p>
        <p>
          To delete your account and all of its data, open Profile, then Settings, then Delete Account in any Korimal app
          or on the web, or go to <a href="/delete-account">korimal.com/delete-account</a>. This removes your account,
          words, progress, guides, notes, translations and connector link from
          our servers straight away, along with your username, friendships, blocks, challenges and notification tokens. If you can't sign in,
          email us at the address below and we will delete your account within 30 days. Signing out removes your study
          data from that device and stops its notifications.
        </p>
      </Section>
      <Section title="Your Choices">
        <ul>
          <li>Edit your name and profile picture in Profile.</li>
          <li>Remove or block people, unblock them in Settings, and accept or decline friend requests and challenges.</li>
          <li>Turn notifications, the Claude connector and the microphone on or off.</li>
          <li>Delete your account in Settings.</li>
          <li>Ask us for a copy of your data or to correct it by email.</li>
        </ul>
      </Section>
      <Section title="Children's Privacy">
        <p>Korimal is not directed to children under 13, and we do not knowingly collect information from them. If you believe a child has given us information, contact us and we will delete it.</p>
      </Section>
      <Section title="Changes to This Policy">
        <p>We may update this policy as Korimal changes. We will change the date above, and for significant changes we will let you know in the app.</p>
      </Section>
      <Section title="Contact">
        <Contact lead="For privacy questions or requests, email:" />
      </Section>
    </>
  );
}

function Terms() {
  return (
    <>
      <p>
        These terms are an agreement between you and RezPoint Inc. ("we", "our") for your use of Korimal, our Korean
        study app for the web, iPhone, iPad, Mac and Android ("the app"). Please read them together with the{" "}
        <a href="/privacy">Korimal Privacy Policy</a>.
      </p>
      <Section title="Acceptance of These Terms">
        <p>By creating an account or using Korimal, you agree to these terms. If you do not agree, please do not use the app.</p>
      </Section>
      <Section title="The Service">
        <p>
          Korimal helps you study Korean with a word of the day, quizzes, flashcards, study guides, notes and home-screen
          widgets. It is a study aid: it does not replace a teacher, and we do not promise any particular learning result.
        </p>
      </Section>
      <Section title="Your Account">
        <ul>
          <li>You sign in with Apple or Google, and you are responsible for the security of that account.</li>
          <li>You must be at least 13 years old, or the minimum age to use online services where you live.</li>
          <li>Keep your Claude connector link private: anyone who has it can add to your Korimal account. You can turn it off and create a new one in Profile.</li>
        </ul>
      </Section>
      <Section title="Your Content">
        <p>
          The words, notes, study guides and other content you add stay yours. Your username, profile picture, name and
          level are shown to other people as described in the Privacy Policy, and your challenge results to the friend you
          play with. You give us permission to store, process
          and show that content only as needed to run Korimal for you, such as syncing it across your devices. Please
          add only content you have the right to use.
        </p>
      </Section>
      <Section title="The Claude Connector and AI-Generated Content">
        <p>
          Korimal can connect to Claude, an AI assistant provided by Anthropic. Study guides, explanations, translations
          and words written by Claude are generated automatically and can contain mistakes, so check anything important
          with a teacher or another trusted source. Your use of Claude is also governed by{" "}
          <External href="https://www.anthropic.com/legal/consumer-terms">Anthropic's terms</External>.
        </p>
      </Section>
      <Section title="Acceptable Use">
        <p>You agree not to:</p>
        <ul>
          <li>Break the law or anyone else's rights while using the app</li>
          <li>Try to access another person's account or data</li>
          <li>Interfere with, overload or try to break the service, including through the connector</li>
          <li>Copy, resell or redistribute the app or its built-in word list</li>
          <li>Choose a name, username or profile photo that impersonates someone or is offensive, or use friend requests and challenges to harass anyone. Korimal refuses names and usernames with offensive words, and we may remove ones that break these terms.</li>
        </ul>
      </Section>
      <Section title="Third-Party Services">
        <p>Korimal relies on services from others, including Apple, Google, Supabase, Vercel and Anthropic. Their own terms apply to your use of them, and we are not responsible for them.</p>
      </Section>
      <Section title="Availability and Changes">
        <p>
          We work to keep Korimal available, but it may sometimes be unavailable, and we may change, add or remove
          features. Korimal is free to use. Korimal Pro is coming soon and isn't for sale yet; before you can buy it, we
          will show its price and terms, and you will never be charged without agreeing to them.
        </p>
      </Section>
      <Section title="Ending Your Use and Deleting Your Account">
        <p>
          You can stop using Korimal at any time. To delete your account and its data, use Delete Account in Profile,
          then Settings, in any Korimal app or on the web, or email us if you can't sign in. You can block anyone who
          bothers you. We may suspend or close accounts that break these terms or put the service or other people at
          risk.
        </p>
      </Section>
      <Section title="Disclaimers">
        <p>
          Korimal is provided "as is" and "as available". To the extent the law allows, we make no warranties that it
          will be error-free, uninterrupted or that its content, including built-in and AI-generated content, is accurate
          or complete.
        </p>
      </Section>
      <Section title="Limitation of Liability">
        <p>
          To the extent the law allows, RezPoint Inc. is not liable for indirect, incidental, special or consequential
          damages, or for any loss of data or study progress, arising from your use of Korimal. Nothing in these terms
          limits rights you have under consumer protection law that cannot be limited.
        </p>
      </Section>
      <Section title="Governing Law">
        <p>These terms are governed by the laws of the Province of Ontario and the federal laws of Canada that apply there, without regard to conflict-of-law rules.</p>
      </Section>
      <Section title="Changes to These Terms">
        <p>We may update these terms. We will change the date above, and for significant changes we will let you know in the app. If you keep using Korimal after a change, you accept the updated terms.</p>
      </Section>
      <Section title="Contact">
        <Contact lead="For questions about these terms, email:" />
      </Section>
    </>
  );
}

/** Deleting your account without the app (Google Play asks every app with accounts for a page like this): the steps
 *  in the app, and here on the web, signed in with Apple or Google, the same typed confirmation as in Profile. */
function DeleteAccount() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);
  const signIn = async (provider: "apple" | "google") => {
    try { localStorage.setItem(AFTER_SIGN_IN_KEY, "/delete-account"); } catch { /* still signs in */ }
    const { error } = await supabase.auth.signInWithOAuth({
      provider, options: { redirectTo: `${window.location.origin}/delete-account`, ...(provider === "apple" ? { scopes: "name email" } : {}) },
    });
    if (error) setError(`Sign-in failed: ${error.message}`);
  };
  const confirmed = typed.trim().toLowerCase() === DELETE_PHRASE;
  const remove = async () => {
    if (!confirmed || deleting || !session) return;
    setDeleting(true);
    setError(null);
    const userID = session.user.id;
    const { data: result, error } = await supabase.functions.invoke("delete-account", { method: "POST" });
    if (error || !(result as { deleted?: boolean } | null)?.deleted) {
      let message = "Your account couldn't be deleted. Please try again, or email us.";
      try { message = (await (error as { context?: Response })?.context?.json())?.error ?? message; } catch { /* keep the default */ }
      setError(message);
      setDeleting(false);
      return;
    }
    try { localStorage.removeItem(`malchingu.connectorKey.${userID}`); } catch { /* nothing to clear */ }
    await supabase.auth.signOut({ scope: "local" });
    setDeleting(false);
    setDeleted(true);
  };
  return (
    <>
      <p>
        This page is for deleting your account in Korimal (코리말), the Korean study app made by RezPoint Inc., on the web,
        iPhone, iPad, Mac and Android. Deleting your account removes it and all of its data for good, on every device.
      </p>
      <Section title="In the App">
        <ol className="legal-steps">
          <li>Open <strong>Profile</strong>, then <strong>Settings</strong>.</li>
          <li>Under <strong>Account</strong>, tap <strong>Delete Account</strong>.</li>
          <li>Type <strong>{DELETE_PHRASE}</strong> and tap <strong>Delete Account</strong>.</li>
        </ol>
      </Section>
      <Section title="Here on the Web">
        {deleted ? (
          <p className="strong" role="status">Your Korimal account and all of its data have been deleted.</p>
        ) : session === undefined ? null : session ? (
          <form className="stack delete-account-form" onSubmit={(e) => { e.preventDefault(); remove(); }}>
            <p>Signed in{session.user.email ? <> as <strong>{session.user.email}</strong></> : null}. This can't be undone.</p>
            <label className="stack tiny-gap">
              <span>Type <strong>{DELETE_PHRASE}</strong> to continue.</span>
              <input className="text-input" value={typed} placeholder={DELETE_PHRASE} aria-label="Type delete my account"
                autoCapitalize="off" autoCorrect="off" spellCheck={false} onChange={(e) => setTyped(e.target.value)} />
            </label>
            <Button type="submit" kind="destructive" full disabled={!confirmed || deleting}>{deleting ? "Deleting…" : "Delete My Account"}</Button>
          </form>
        ) : (
          <div className="stack delete-account-form">
            <p>Sign in with the account you use in Korimal, then confirm here.</p>
            <div className="provider-row">
              <ProviderButtons onApple={() => signIn("apple")} onGoogle={() => signIn("google")} />
            </div>
          </div>
        )}
        {error && <p className="error small" role="alert">{error}</p>}
      </Section>
      <Section title="Can't Sign In?">
        <Contact lead="Email us from the address your account uses, and we will delete it within 30 days:" />
      </Section>
      <Section title="What's Deleted">
        <ul>
          <li>Your account and its Apple or Google sign-in, your name, username and profile picture.</li>
          <li>Your words, progress, stats, quiz answers, study guides and their tasks, notes and saved translations.</li>
          <li>Your Claude connector link, friends, friend requests, blocks and challenges.</li>
        </ul>
        <p>They are removed from our servers straight away. Nothing linked to your account is kept.</p>
      </Section>
    </>
  );
}

/** One of the documents, with Korimal's header and footer. */
export function Legal({ kind }: { kind: LegalKind }) {
  useEffect(() => { document.title = `Korimal | ${TITLE[kind]}`; }, [kind]);
  // At the top: the other pages, Delete Account always among them (the link Google Play asks for).
  const others = (["privacy", "terms", "delete-account"] as LegalKind[]).filter((k) => k !== kind);
  return (
    <div className="app-background legal">
      <header className="legal-bar">
        <span className="legal-brand"><img src="/icon-192.png" alt="" width={32} height={32} /> Korimal</span>
        <nav className="legal-links" aria-label="Korimal pages">
          {others.map((k) => <a key={k} className="legal-switch" href={`/${k}`}>{LINK[k]}</a>)}
        </nav>
      </header>
      <main className="glass card legal-card">
        <h1>{HEADING[kind]}</h1>
        <p className="legal-updated">Last Updated: {UPDATED}</p>
        <div className="legal-body">{kind === "privacy" ? <Privacy /> : kind === "terms" ? <Terms /> : <DeleteAccount />}</div>
      </main>
      <footer className="legal-footer">
        <Copyright />
      </footer>
    </div>
  );
}
