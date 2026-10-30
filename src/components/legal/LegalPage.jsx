import { Link } from 'react-router-dom';
import useDocumentTitle from '@/lib/useDocumentTitle';
import { LEGAL_UPDATED } from '@/lib/legal';
import GridBackdrop from '@/components/ui/GridBackdrop';

// Shared layout for the Terms, the Privacy Policy and the licences: the
// paper background with the site's grid (like walls and the home page), the
// logo back to the home page, a plain-language summary box on top, then the
// numbered sections. Kept as plain, readable text: these pages are read
// on phones, so no tables or columns.

export function Section({ title, children }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-[22px] leading-snug font-medium text-[#262624]">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-[#3D3B37]">{children}</div>
    </section>
  );
}

export function List({ items }) {
  return (
    <ul className="list-disc pl-5 space-y-1.5">
      {items.map((item, i) => <li key={i}>{item}</li>)}
    </ul>
  );
}

export default function LegalPage({ title, summary, children, other, updated = LEGAL_UPDATED }) {
  useDocumentTitle(`${title} | storywall`);
  return (
    <div className="relative min-h-screen bg-[#F4F2EC]">
      <GridBackdrop />
      <div className="relative mx-auto max-w-2xl px-5 sm:px-8 py-8 sm:py-12">
        <Link to="/" aria-label="Back to the Storywall home page" className="inline-block">
          <img src="/logo-slash-ink.png" alt="Storywall" className="h-[20px] w-auto" />
        </Link>
        <h1 className="mt-10 font-display text-[34px] leading-tight font-medium text-[#262624]">{title}</h1>
        <p className="mt-2 text-sm text-[#8A877F]">Last updated: {updated}</p>
        <div className="mt-6 rounded-2xl bg-[#FAF9F5] border border-[#E6E0D2] p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#6B6964]">In short</p>
          <div className="mt-2 space-y-2 text-[15px] leading-relaxed text-[#262624]">{summary}</div>
        </div>
        {children}
        <p className="mt-12 pt-6 border-t border-[#E6E0D2] text-sm text-[#6B6964]">
          See also: <Link to={other.to} className="underline text-[#262624]">{other.label}</Link>
        </p>
      </div>
    </div>
  );
}
