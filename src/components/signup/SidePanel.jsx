import { useState } from 'react';

// Right-hand panel for the split-screen sign-up / onboarding layout.
// Desktop only (hidden below md) — mobile keeps the single-column form.
// Positioned fixed over the right half of the viewport; pages reserve that
// space with md:right-1/2 on their own content.
export function SidePanelFrame({ children, blend = false }) {
  return (
    <div className={`hidden md:flex fixed top-0 right-0 bottom-0 w-1/2 z-10 ${blend ? 'bg-[#F4F2EC]' : 'p-6 lg:p-8'}`} aria-hidden="true">
      <div className={`relative w-full h-full overflow-hidden ${blend ? '' : 'rounded-3xl'}`}>
        {children}
      </div>
    </div>
  );
}

// Caption with a 16:9 rounded photo below it, on the same blended grid
// background as the profile preview. If the image is missing or fails to
// load, only the caption shows (images live in /public/signup/).
export const DEFAULT_PANEL_IMAGE = '/signup/workspace.jpg';

export function ImagePanel({ src = DEFAULT_PANEL_IMAGE, caption }) {
  const [failed, setFailed] = useState(false);
  return (
    <PreviewPanel caption={caption}>
      {!failed && (
        <img
          key={src}
          src={src}
          alt=""
          decoding="async"
          onError={() => setFailed(true)}
          className="w-full max-w-[560px] aspect-video object-cover rounded-2xl"
        />
      )}
    </PreviewPanel>
  );
}

// Grid background that blends into the page (same #F4F2EC base, grid and
// fade as the public profile) — no visible panel edge or divider. Used for
// the live profile preview.
export function PreviewPanel({ caption, children }) {
  return (
    <SidePanelFrame blend>
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: 'linear-gradient(#E6E0D2 1px, transparent 1px), linear-gradient(90deg, #E6E0D2 1px, transparent 1px)',
          backgroundSize: '38px 38px',
          backgroundPosition: 'center top',
        }}
      />
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 25%, #F4F2EC 75%)' }} />
      <div className="relative h-full overflow-y-auto flex flex-col items-center justify-center gap-6 px-8 py-10">
        <p className="text-[#262624] font-display font-medium text-[32px] leading-[1.15] text-center max-w-[20ch]">
          {caption}
        </p>
        {children}
      </div>
    </SidePanelFrame>
  );
}

// Warm the browser cache for the next screen's image so it doesn't pop in.
export function preloadImage(src) {
  const img = new Image();
  img.src = src;
}
