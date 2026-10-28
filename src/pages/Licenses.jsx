import LegalPage, { Section } from '@/components/legal/LegalPage';

// Open-source licences at /about/licenses (Oz, 2026-10-28). The HEIC photo
// converter (src/lib/heicConvert.js) bundles libheif and libde265 under the
// LGPL-3.0, which asks us to credit them and say where their source code is;
// the self-hosted fonts are SIL OFL 1.1, which asks for their copyright and
// licence to travel with them. Keep the versions here in step with
// package.json and public/fonts when either changes.

const UPDATED = 'October 28, 2026';

const ext = (href, label) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className="underline">{label}</a>
);

function Item({ name, what, license, source }) {
  return (
    <li>
      <span className="font-medium text-[#262624]">{name}</span>, {what}. Licence: {license}. {source}
    </li>
  );
}

export default function Licenses() {
  return (
    <LegalPage
      title="Open-source licences"
      updated={UPDATED}
      other={{ to: '/privacy', label: 'Privacy Policy' }}
      summary={(
        <>
          <p>Storywall is built with free, open-source software.</p>
          <p>Some of it asks to be credited and to tell you where its source code is. This page does that.</p>
        </>
      )}
    >
      <Section title="1. iPhone photo converter">
        <p>
          When you add an iPhone photo (HEIC) in a browser that can&apos;t open it, Storywall turns it into a JPEG on
          your own device with these libraries, used unchanged:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <Item
            name="heic-to 1.6.7"
            what="by hoppergee"
            license={ext('https://www.gnu.org/licenses/lgpl-3.0.html', 'GNU LGPL 3.0')}
            source={<>Source: {ext('https://github.com/hoppergee/heic-to', 'github.com/hoppergee/heic-to')}</>}
          />
          <Item
            name="libheif 1.23.7"
            what="by struktur AG"
            license={ext('https://www.gnu.org/licenses/lgpl-3.0.html', 'GNU LGPL 3.0')}
            source={<>Source: {ext('https://github.com/strukturag/libheif', 'github.com/strukturag/libheif')}</>}
          />
          <Item
            name="libde265"
            what="by struktur AG"
            license={ext('https://www.gnu.org/licenses/lgpl-3.0.html', 'GNU LGPL 3.0')}
            source={<>Source: {ext('https://github.com/strukturag/libde265', 'github.com/strukturag/libde265')}</>}
          />
        </ul>
        <p>
          They are loaded as a separate file, only when a HEIC photo is added, so they can be replaced with another
          version of the same libraries.
        </p>
      </Section>

      <Section title="2. Fonts">
        <p>Storywall serves these fonts itself. Both are under the {ext('https://openfontlicense.org', 'SIL Open Font License 1.1')}.</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <Item
            name="Fraunces"
            what="Copyright 2018 The Fraunces Project Authors"
            license={ext('/fonts/fraunces-OFL.txt', 'OFL 1.1 (licence text)')}
            source={<>Source: {ext('https://github.com/undercasetype/Fraunces', 'github.com/undercasetype/Fraunces')}</>}
          />
          <Item
            name="Micro 5"
            what="Copyright 2023 The Soft Type Project Authors"
            license={ext('/fonts/micro-5-OFL.txt', 'OFL 1.1 (licence text)')}
            source={<>Source: {ext('https://github.com/scfried/soft-type-micro', 'github.com/scfried/soft-type-micro')}</>}
          />
        </ul>
      </Section>

      <Section title="3. Everything else">
        <p>
          Storywall also uses many other open-source libraries, such as React, under permissive licences like MIT.
          Thank you to everyone who builds and shares them.
        </p>
      </Section>
    </LegalPage>
  );
}
