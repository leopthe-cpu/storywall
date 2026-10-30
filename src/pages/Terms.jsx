import { Link } from 'react-router-dom';
import LegalPage, { Section, List } from '@/components/legal/LegalPage';
import { CONTACT_EMAIL, MIN_AGE, OPERATOR, OPERATOR_PLACE } from '@/lib/legal';

// Terms of Service at /terms (docs/legal-and-privacy-plan.md, Step 4).
// Written from the research in Oz's Drive and from what the app actually
// does today. A draft for the lawyer's review, not legal advice: change it
// only on purpose, and bump LEGAL_VERSION (src/lib/legal.js) when you do.

const mail = <a href={`mailto:${CONTACT_EMAIL}`} className="underline">{CONTACT_EMAIL}</a>;

export default function Terms() {
  return (
    <LegalPage
      title="Terms of Service"
      other={{ to: '/privacy', label: 'Privacy Policy' }}
      summary={(
        <>
          <p>Your stories stay yours. You let us host and show them so Storywall can work.</p>
          <p>You must be {MIN_AGE} or older. Be truthful, and only post what you have the right to post.</p>
          <p>AI features can get things wrong: check what they make before you publish it.</p>
          <p>You can download your data or delete your account at any time in Settings.</p>
        </>
      )}
    >
      <Section title="1. Who we are">
        <p>
          Storywall (storywall.io) is run by {OPERATOR}, {OPERATOR_PLACE} (&quot;Storywall&quot;, &quot;we&quot;, &quot;us&quot;).
          These Terms are an agreement between you and us about your use of Storywall. By creating an account or using
          Storywall, you agree to them. If you don&apos;t agree, please don&apos;t use Storywall.
        </p>
        <p>Questions about these Terms: {mail}.</p>
      </Section>

      <Section title="2. Who can use Storywall">
        <List items={[
          `You must be ${MIN_AGE} or older. If we learn that an account belongs to someone younger, we will delete it.`,
          'One person per account. Keep your password safe, and tell us if you think someone else is using your account.',
          'Give accurate information about yourself, and don\'t pretend to be someone else.',
          'Usernames are first come, first served. We may take back a username that impersonates someone, infringes a trademark, or is held without being used, and some names are reserved for Storywall itself.',
        ]} />
      </Section>

      <Section title="3. Your content">
        <p>
          You keep ownership of everything you create on Storywall: your stories, cards, text, pictures, videos, audio
          and profile (&quot;your content&quot;).
        </p>
        <p>
          So that we can run Storywall, you give us a worldwide, non-exclusive, royalty-free licence to host, store,
          copy, resize, format and display your content, and to let our service providers do the same on our behalf.
          We use this licence only to operate, show and improve Storywall, for example to show your public wall to
          visitors, make thumbnails and link previews, and lay out your cards. We may reformat your content, but we
          won&apos;t change its meaning.
        </p>
        <p>
          The licence ends when you delete the content or your account, except for copies other people already
          downloaded or shared, copies we must keep by law, and backup copies that are removed as our backups expire.
        </p>
        <p>We don&apos;t sell your content, and we don&apos;t use it to train AI models.</p>
      </Section>

      <Section title="4. Public and private">
        <p>
          Your wall at storywall.io/your-username and your published stories are public by default: anyone with the
          link can see them, search engines may show them, and people can copy what they see. Drafts and the notes you
          type into Generate are private. You can make your whole wall private in Settings. Think before you publish
          anything personal, such as health, family or financial details: what you publish is public by your choice.
        </p>
      </Section>

      <Section title="5. AI features">
        <p>
          Some features use artificial intelligence: Generate turns your notes and photos into a story and can make
          pictures, and the publish step suggests skill tags. To do this, we send the text and photos you give these
          features to AI providers (see the <Link to="/privacy" className="underline">Privacy Policy</Link>).
        </p>
        <List items={[
          'AI output can be wrong, incomplete or unlike what you meant. Review it before you publish: you are responsible for what you publish, including anything the AI made.',
          'Generate is built to keep your own words, but pictures it makes are AI-generated, not photos of real events. Don\'t present them as real.',
          'Don\'t use AI features to make fake credentials, misleading claims, or pictures of real people.',
          'As far as we are able to, you own what the AI makes for you. In some countries, AI output may not be protected by copyright.',
          'We may limit how often AI features can be used, to keep costs and abuse in check.',
        ]} />
      </Section>

      <Section title="6. What you must not do">
        <List items={[
          'Post anything false or misleading about your work, education or achievements.',
          'Post content you don\'t have the right to share: other people\'s photos or work, or an employer\'s or client\'s confidential information.',
          'Harass, threaten, bully or discriminate against anyone, or post hateful, sexual or violent content.',
          'Post anything illegal, or share someone else\'s personal information without their permission.',
          'Spam, run scams, or use Storywall for fake job offers or recruiting fraud.',
          'Scrape, crawl or collect content or profiles in bulk, or use Storywall content to train AI models, without our written permission.',
          'Break, overload or get around the security of Storywall, or upload malware.',
        ]} />
      </Section>

      <Section title="7. Reporting content and copyright">
        <p>
          If you think something on Storywall breaks these Terms or infringes your rights (for example your copyright),
          email {mail} with a link to it, what the problem is, and how to reach you. For copyright, also say which work
          you own and confirm that the information is accurate. We will review it, may remove the content, and will
          tell the person who posted it, who can reply if they think we got it wrong. We close the accounts of people
          who repeatedly infringe others&apos; rights.
        </p>
      </Section>

      <Section title="8. Premium features">
        <p>
          Some features, like Generate, are available only to accounts we give access to. Access is free today and is
          granted, changed or removed at our discretion. If we ever charge for features, we will tell you the price and
          terms first, and nothing will be charged without your agreement.
        </p>
      </Section>

      <Section title="9. Leaving, suspension and closure">
        <List items={[
          'You can delete your account at any time in Settings → Account. This deletes your profile, stories, drafts, notes and files. You can download your data first.',
          'We may remove content or suspend or close an account that breaks these Terms or the law, or that puts others at risk. Where we reasonably can, we will tell you why and give you a chance to reply.',
          'If we ever shut Storywall down, we will give you reasonable notice and time to download your data.',
        ]} />
      </Section>

      <Section title="10. No guarantees">
        <p>
          Storywall is provided &quot;as is&quot; and &quot;as available&quot;. We work to keep it running and your content safe,
          but we can&apos;t promise it will always be available, error-free, or that content will never be lost, so keep
          your own copies of anything important. We don&apos;t check or vouch for what users say about themselves, and
          we aren&apos;t a recruiter or employment agency: hiring decisions are up to the people who make them.
        </p>
      </Section>

      <Section title="11. Limit of liability">
        <p>
          To the extent the law allows, we are not liable for indirect or consequential losses (such as lost profits,
          lost opportunities or lost data), and our total liability to you for any claim about Storywall is limited to
          100 Canadian dollars. Nothing in these Terms limits liability that can&apos;t be limited by law, or takes away
          rights you have as a consumer where you live.
        </p>
      </Section>

      <Section title="12. If your content causes a claim">
        <p>
          If someone makes a claim against us because of content you posted or the way you used Storywall in breach of
          these Terms, you agree to cover our reasonable costs of dealing with it, to the extent the law allows.
        </p>
      </Section>

      <Section title="13. Changes to these Terms">
        <p>
          We may update these Terms as Storywall changes. For important changes we will tell you in the app or by email
          before they take effect. Changes don&apos;t apply to the past. If you keep using Storywall after a change
          takes effect, the new Terms apply; if you don&apos;t agree, you can delete your account.
        </p>
      </Section>

      <Section title="14. Law and disputes">
        <p>
          These Terms are governed by the laws of the Province of Ontario and the federal laws of Canada that apply
          there. Disputes go to the courts of Ontario. If you live elsewhere, you keep any protections and any right to
          go to your local courts that the law where you live gives you as a consumer.
        </p>
      </Section>

      <Section title="15. Other things">
        <List items={[
          'If part of these Terms can\'t be enforced, the rest still applies.',
          'If we don\'t enforce a part of these Terms right away, we can still enforce it later.',
          'We may transfer these Terms to a company that takes over Storywall; we will tell you if that happens. You can\'t transfer your account.',
          'If you send us ideas or feedback, we may use them freely.',
          'These Terms and the Privacy Policy are the whole agreement between you and us about Storywall.',
        ]} />
      </Section>
    </LegalPage>
  );
}
