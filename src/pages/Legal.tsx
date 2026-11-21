import { useEffect, type ReactNode } from "react";
import { Copyright } from "../components/ui";

// The Privacy Policy (/privacy) and Terms of Service (/terms), on Malchingu's own site and in its design. They open
// without signing in, and follow the Appearance setting (or the system's light or dark mode).

export type LegalKind = "privacy" | "terms";

export function legalKind(pathname: string): LegalKind | null {
  const path = pathname.replace(/\/+$/, "");
  return path === "/privacy" ? "privacy" : path === "/terms" ? "terms" : null;
}

const TITLE: Record<LegalKind, string> = { privacy: "Privacy Policy", terms: "Terms of Service" };
const UPDATED = "Nov 20, 2026";
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
        Malchingu (말친구, "talking buddy") is a Korean study app made by RezPoint Inc. ("we", "our") for the web, iPhone,
        iPad, Mac and Android. This policy explains what Malchingu stores about you, why, and the choices you have.
        Malchingu has no ads and does not sell or rent your information.
      </p>
      <Section title="Information We Collect">
        <p>When you use Malchingu, we store:</p>
        <ul>
          <li>Your account: you sign in with Apple or Google. We receive an account identifier and the email address the provider shares, which may be a private relay address, and your name if you choose to share it.</li>
          <li>Your profile: the display name, profile picture and title you choose in the app.</li>
          <li>Your study data: the words you add, your progress on each word, quiz and flashcard answers, daily study totals and streaks, the word of the day quiz, study guides and their tasks, your notes and the translations you save.</li>
          <li>Your settings, such as appearance, flashcard setup and notification times.</li>
        </ul>
        <p>Malchingu does not request your contacts, location or phone number, and does not use advertising trackers.</p>
      </Section>
      <Section title="The Claude Connector">
        <p>
          You can connect Malchingu to Claude, an AI assistant made by Anthropic, so Claude can write study guides and add
          words for you. The app creates a personal connector link for your account; we store only a one-way hash of its
          key. When you ask Claude to use Malchingu, Claude can read your study progress, guides and notes on guides and
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
          <li>When you tap the microphone, what you say is turned into text by your device's or browser's speech recogniser (from Apple, Google or your browser's maker), which may process the audio on their servers under their own policies. Malchingu receives only the text and does not store recordings.</li>
        </ul>
      </Section>
      <Section title="How We Use Information">
        <ul>
          <li>To create your account and sign you in</li>
          <li>To save your study data and keep it in sync across your devices</li>
          <li>To show your progress, streaks, level and achievements, and to pick the words you need to practise</li>
          <li>To send the reminders you turn on, which are scheduled on your device</li>
          <li>To run the Claude connector when you use it</li>
          <li>To keep the service working and secure</li>
        </ul>
      </Section>
      <Section title="Third-Party Services">
        <ul>
          <li>Supabase stores your account and study data and runs the Claude connector.</li>
          <li>Apple and Google provide sign-in, and on their devices the voice, translation and speech features described above.</li>
          <li>Anthropic provides Claude, only if you connect it.</li>
          <li>Vercel hosts this website and the web app and counts anonymous page views with Vercel Web Analytics, which uses no cookies and does not identify you.</li>
        </ul>
      </Section>
      <Section title="Data Sharing">
        <p>We do not sell, rent or share your information with advertisers. We share it only with the services above, as needed to run Malchingu, or when the law requires it.</p>
      </Section>
      <Section title="Data Storage and Security">
        <p>
          Your data is sent over encrypted connections and stored by Supabase. Each account can read and change only its
          own data. The apps also keep a copy on your device so they work offline, and the home-screen widgets read your
          words from that copy.
        </p>
      </Section>
      <Section title="Data Retention and Deletion">
        <p>We keep your data while your account exists. You can delete your words, study guides and notes in the app at any time.</p>
        <p>
          To delete your account and all of its data, open Profile, then Settings, then Delete Account in the iPhone, iPad
          or Mac app. This removes your account, words, progress, guides, notes, translations and connector link from our
          servers. If you use only the web or Android app, email us at the address below and we will delete your account
          within 30 days. Signing out removes your study data from that device.
        </p>
      </Section>
      <Section title="Your Choices">
        <ul>
          <li>Edit or remove your name and profile picture in Profile.</li>
          <li>Turn notifications, the Claude connector and the microphone on or off.</li>
          <li>Ask us for a copy of your data or to correct it by email.</li>
        </ul>
      </Section>
      <Section title="Children's Privacy">
        <p>Malchingu is not directed to children under 13, and we do not knowingly collect information from them. If you believe a child has given us information, contact us and we will delete it.</p>
      </Section>
      <Section title="Changes to This Policy">
        <p>We may update this policy as Malchingu changes. We will change the date above, and for significant changes we will let you know in the app.</p>
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
        These terms are an agreement between you and RezPoint Inc. ("we", "our") for your use of Malchingu, our Korean
        study app for the web, iPhone, iPad, Mac and Android ("the app"). Please read them together with the{" "}
        <a href="/privacy">Malchingu Privacy Policy</a>.
      </p>
      <Section title="Acceptance of These Terms">
        <p>By creating an account or using Malchingu, you agree to these terms. If you do not agree, please do not use the app.</p>
      </Section>
      <Section title="The Service">
        <p>
          Malchingu helps you study Korean with a word of the day, quizzes, flashcards, study guides, notes and home-screen
          widgets. It is a study aid: it does not replace a teacher, and we do not promise any particular learning result.
        </p>
      </Section>
      <Section title="Your Account">
        <ul>
          <li>You sign in with Apple or Google, and you are responsible for the security of that account.</li>
          <li>You must be at least 13 years old, or the minimum age to use online services where you live.</li>
          <li>Keep your Claude connector link private: anyone who has it can add to your Malchingu account. You can turn it off and create a new one in Profile.</li>
        </ul>
      </Section>
      <Section title="Your Content">
        <p>
          The words, notes, study guides and other content you add stay yours. You give us permission to store, process
          and show that content only as needed to run Malchingu for you, such as syncing it across your devices. Please
          add only content you have the right to use.
        </p>
      </Section>
      <Section title="The Claude Connector and AI-Generated Content">
        <p>
          Malchingu can connect to Claude, an AI assistant provided by Anthropic. Study guides, explanations, translations
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
        </ul>
      </Section>
      <Section title="Third-Party Services">
        <p>Malchingu relies on services from others, including Apple, Google, Supabase, Vercel and Anthropic. Their own terms apply to your use of them, and we are not responsible for them.</p>
      </Section>
      <Section title="Availability and Changes">
        <p>
          We work to keep Malchingu available, but it may sometimes be unavailable, and we may change, add or remove
          features. Malchingu is currently free; if we ever add paid features, we will tell you before you are charged.
        </p>
      </Section>
      <Section title="Ending Your Use and Deleting Your Account">
        <p>
          You can stop using Malchingu at any time. To delete your account and its data, use Delete Account in Profile,
          then Settings, in the iPhone, iPad or Mac app, or email us. We may suspend or close accounts that break these
          terms or put the service or other people at risk.
        </p>
      </Section>
      <Section title="Disclaimers">
        <p>
          Malchingu is provided "as is" and "as available". To the extent the law allows, we make no warranties that it
          will be error-free, uninterrupted or that its content, including built-in and AI-generated content, is accurate
          or complete.
        </p>
      </Section>
      <Section title="Limitation of Liability">
        <p>
          To the extent the law allows, RezPoint Inc. is not liable for indirect, incidental, special or consequential
          damages, or for any loss of data or study progress, arising from your use of Malchingu. Nothing in these terms
          limits rights you have under consumer protection law that cannot be limited.
        </p>
      </Section>
      <Section title="Governing Law">
        <p>These terms are governed by the laws of the Province of Ontario and the federal laws of Canada that apply there, without regard to conflict-of-law rules.</p>
      </Section>
      <Section title="Changes to These Terms">
        <p>We may update these terms. We will change the date above, and for significant changes we will let you know in the app. If you keep using Malchingu after a change, you accept the updated terms.</p>
      </Section>
      <Section title="Contact">
        <Contact lead="For questions about these terms, email:" />
      </Section>
    </>
  );
}

/** One of the two documents, with Malchingu's header and footer. */
export function Legal({ kind }: { kind: LegalKind }) {
  useEffect(() => { document.title = `Malchingu | ${TITLE[kind]}`; }, [kind]);
  const other: LegalKind = kind === "privacy" ? "terms" : "privacy";
  return (
    <div className="app-background legal">
      <header className="legal-bar">
        <span className="legal-brand"><img src="/icon-192.png" alt="" width={32} height={32} /> Malchingu</span>
        <a className="legal-switch" href={`/${other}`}>{TITLE[other]}</a>
      </header>
      <main className="glass card legal-card">
        <h1>Malchingu {TITLE[kind]}</h1>
        <p className="legal-updated">Last Updated: {UPDATED}</p>
        <div className="legal-body">{kind === "privacy" ? <Privacy /> : <Terms />}</div>
      </main>
      <footer className="legal-footer">
        <Copyright />
        <a href="/privacy">Privacy Policy</a>
        <a href="/terms">Terms of Service</a>
      </footer>
    </div>
  );
}
