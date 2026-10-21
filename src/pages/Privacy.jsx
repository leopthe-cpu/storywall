import { Link } from 'react-router-dom';
import LegalPage, { Section, List } from '@/components/legal/LegalPage';
import { CONTACT_EMAIL, MIN_AGE, OPERATOR, OPERATOR_PLACE } from '@/lib/legal';

// Privacy Policy at /privacy (docs/legal-and-privacy-plan.md, Steps 2 and 4).
// Every statement here must match what the app and its providers really do
// (checked against the code on 2026-10-21): if you add a provider, a kind of
// data, tracking or e-mails, update this page and LEGAL_VERSION. A draft for
// the lawyer's review, not legal advice.

const mail = <a href={`mailto:${CONTACT_EMAIL}`} className="underline">{CONTACT_EMAIL}</a>;

export default function Privacy() {
  return (
    <LegalPage
      title="Privacy Policy"
      other={{ to: '/terms', label: 'Terms of Service' }}
      summary={(
        <>
          <p>We collect what you give us to build your wall, plus the little we need to keep Storywall running and safe.</p>
          <p>No ads, no analytics trackers, and we never sell your data or use it to train AI.</p>
          <p>Your wall and published stories are public; drafts and Generate notes are private.</p>
          <p>Download your data or delete your account any time in Settings → Privacy.</p>
        </>
      )}
    >
      <Section title="1. Who is responsible for your data">
        <p>
          Storywall is run by {OPERATOR}, {OPERATOR_PLACE}, who decides how your personal information is used and is
          responsible for it (the &quot;controller&quot;). {OPERATOR} is also the person accountable for privacy at Storywall.
          Contact: {mail}.
        </p>
      </Section>

      <Section title="2. What we collect">
        <p><strong>What you give us:</strong></p>
        <List items={[
          'Account: your email address and password (stored only in scrambled, "hashed" form), and the date you confirmed you are 16 or older.',
          'Profile: your username, name, headline, bio, location, profile picture, skills, links, and whether your wall is private.',
          'Stories: the cards you create (text, pictures, videos, audio), titles, skill tags, drafts, and the pictures you upload to your media library.',
          'Generate: the notes and photos you give Generate, the story it writes, and the pictures it makes.',
        ]} />
        <p><strong>What we collect automatically:</strong></p>
        <List items={[
          'Your IP address, used for a short time to stop abuse (such as too many requests from one place). These records are cleared within about a day.',
          'How many times you used AI features each day, to apply daily limits.',
          'Technical logs kept by our hosting providers (such as IP address, browser type, time and the page or service requested), used to keep Storywall running and secure.',
        ]} />
        <p>
          We don&apos;t use advertising, analytics or tracking tools, and we don&apos;t buy data about you from anyone else.
        </p>
      </Section>

      <Section title="3. How we use it, and why">
        <List items={[
          'To run your account and show your wall and stories: needed to provide Storywall to you (our agreement with you).',
          'To run the AI features you choose to use, such as Generate and skill suggestions: needed to provide what you asked for.',
          'To send you emails about your account, such as sign-in and password codes, and a note when a story you generated is ready: needed to provide Storywall. We don\'t send marketing emails.',
          'To keep Storywall secure and stop abuse, fraud and spam: our legitimate interest in a safe service.',
          'To comply with the law and respond to legal requests: our legal obligations.',
        ]} />
        <p>We don&apos;t make decisions about you by automated means that have legal or similarly significant effects.</p>
      </Section>

      <Section title="4. What others can see">
        <p>
          Your wall (storywall.io/your-username), your profile and your published stories are public unless you make
          your wall private in Settings: anyone with the link can see them, and search engines may show them. Drafts
          and the notes you type into Generate are visible only to you. Only publish what you are happy for anyone to
          see, especially anything sensitive such as health, religion or family details.
        </p>
      </Section>

      <Section title="5. AI processing">
        <p>
          When you use Generate or skill suggestions, the text and photos you give these features are sent to
          OpenRouter, a service that passes them to the company running the AI model: today Anthropic&apos;s Claude models
          for text and Alibaba&apos;s Qwen model for pictures. We may change models over time.
        </p>
        <List items={[
          'We don\'t use your content to train AI models.',
          'For text, we tell OpenRouter to use only providers that don\'t store or train on the data they receive. For pictures, our account settings ask the same, but we rely on those providers\' own policies.',
          'OpenRouter deletes what it receives soon after answering, and doesn\'t keep logs of your requests on our account.',
        ]} />
      </Section>

      <Section title="6. Who we share it with">
        <p>
          We don&apos;t sell or rent your personal information, and we don&apos;t share it for advertising. We share it only
          with service providers that help us run Storywall, under contracts that limit how they may use it:
        </p>
        <List items={[
          'Supabase: database, file storage, sign-in and server functions.',
          'Railway: hosts the Storywall website.',
          'Cloudflare: domain name service (directs storywall.io to our website).',
          'Resend: sends our emails.',
          'OpenRouter and the AI model providers it uses (see section 5).',
          'Base44: hosted the previous version of Storywall and still holds a copy of data created there before October 15, 2026, until we close that service and have the copy deleted.',
        ]} />
        <p>
          We may also share information if the law requires it, to protect people&apos;s safety or our rights, or as part
          of a sale or reorganisation of Storywall, in which case this policy keeps applying to your data.
        </p>
      </Section>

      <Section title="7. Where your data is stored">
        <p>
          Our providers store and process data in Canada and the United States, and some may process it in other
          countries. When data leaves your country, we rely on our providers&apos; data protection agreements, including
          the European Commission&apos;s standard contractual clauses where they apply, to keep it protected.
        </p>
      </Section>

      <Section title="8. How long we keep it">
        <List items={[
          'Your account, profile, stories, drafts and notes: until you delete them or your account.',
          'When you delete your account, we delete your profile, stories, drafts, notes, files and sign-in details right away. Copies in our providers\' backups and logs are removed as those expire.',
          'Abuse-prevention records with your IP address: about a day.',
          'We may keep information longer if the law requires it, or to deal with a dispute or abuse.',
        ]} />
      </Section>

      <Section title="9. Your rights">
        <p>Depending on where you live, you can:</p>
        <List items={[
          'see the personal information we hold about you, and get a copy of it;',
          'correct it;',
          'delete it;',
          'download it in a machine-readable format;',
          'object to or ask us to limit some uses of it;',
          'withdraw any consent you gave, without affecting what we did before.',
        ]} />
        <p>
          You can do most of this yourself: edit your profile on your wall, and use Settings → Privacy to download your
          data or delete your account. For anything else, email {mail}. We answer within 30 days and may need to confirm
          it&apos;s you first. We won&apos;t treat you differently for using your rights.
        </p>
        <p>
          You can also complain to a privacy regulator, for example the Office of the Privacy Commissioner of Canada,
          the Commission d&apos;accès à l&apos;information du Québec, your country&apos;s data protection authority in the
          EU, or the UK Information Commissioner&apos;s Office. We&apos;d appreciate the chance to fix things first.
        </p>
      </Section>

      <Section title="10. Children">
        <p>
          Storywall is not for anyone under {MIN_AGE}, and we don&apos;t knowingly collect information from them. If you
          think someone under {MIN_AGE} has an account, email {mail} and we will delete it.
        </p>
      </Section>

      <Section title="11. Cookies and storage on your device">
        <p>
          We don&apos;t use advertising or analytics cookies. Storywall stores a few things in your browser that it needs
          to work: your sign-in session, and small conveniences such as colour themes you made and the username you
          picked while signing up. Clearing your browser&apos;s site data removes them and signs you out.
        </p>
      </Section>

      <Section title="12. Security">
        <p>
          Connections to Storywall are encrypted (HTTPS). Passwords are stored only in hashed form. Access rules in our
          database let each person see only what they are allowed to, and private files are shared only through
          short-lived links. No system is perfectly secure; if a breach puts your information at risk, we will tell you
          and the regulators as the law requires.
        </p>
      </Section>

      <Section title="13. Changes to this policy">
        <p>
          We will update this policy when Storywall changes. For important changes, we will tell you in the app or by
          email before they take effect. The date at the top shows the latest version.
        </p>
      </Section>

      <Section title="14. Contact">
        <p>
          Questions, requests or complaints about your privacy: {mail}, or write to {OPERATOR}, {OPERATOR_PLACE}.
          See also our <Link to="/terms" className="underline">Terms of Service</Link>.
        </p>
      </Section>
    </LegalPage>
  );
}
