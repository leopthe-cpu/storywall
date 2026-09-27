// Swipeable story card stack — the signature visual element of the landing page.
// Three stacked cards with a floating animation on the front card.
// Matches the design from the attached HTML hero file.
export default function SwipeableCards() {
  return (
    <div className="relative flex justify-center items-center min-h-[440px]">
      <div className="relative w-[300px] h-[400px]">
        {/* Back card (rotated, faded) */}
        <div
          className="absolute inset-0 rounded-[20px] overflow-hidden bg-[#111111]"
          style={{
            transform: 'rotate(-8deg) translate(-30px,14px) scale(0.94)',
            opacity: 0.55,
            filter: 'saturate(0.8)',
            boxShadow: '0 24px 60px -20px rgba(17,17,17,0.4), 0 4px 12px rgba(17,17,17,0.1)',
          }}
        />
        {/* Middle card (slightly rotated) */}
        <div
          className="absolute inset-0 rounded-[20px] overflow-hidden bg-[#2A2724]"
          style={{
            transform: 'rotate(-4deg) translate(-15px,7px) scale(0.97)',
            opacity: 0.8,
            boxShadow: '0 24px 60px -20px rgba(17,17,17,0.4), 0 4px 12px rgba(17,17,17,0.1)',
          }}
        />
        {/* Front card (floating animation) */}
        <article
          className="absolute inset-0 rounded-[20px] overflow-hidden bg-[#111111] text-white flex flex-col"
          style={{
            transform: 'rotate(2.5deg)',
            animation: 'floaty-card 6s ease-in-out infinite',
            boxShadow: '0 24px 60px -20px rgba(17,17,17,0.4), 0 4px 12px rgba(17,17,17,0.1)',
          }}
        >
          {/* Media area */}
          <div
            className="h-[56%] relative flex items-end p-[18px]"
            style={{
              background: 'radial-gradient(140% 120% at 20% 10%, #3a3532 0%, transparent 55%), linear-gradient(135deg, #1b1917 0%, #2f2b28 100%)',
            }}
          >
            <div
              className="absolute inset-0 opacity-50"
              style={{
                mixBlendMode: 'overlay',
                backgroundImage: 'radial-gradient(rgba(255,255,255,0.14) 1px, transparent 1.4px)',
                backgroundSize: '14px 14px',
              }}
            />
            <span className="relative font-mono text-[10.5px] font-bold tracking-[0.08em] uppercase bg-white/15 backdrop-blur-sm border border-white/20 text-white px-2.5 py-1.5 rounded-full">
              Product Design
            </span>
          </div>
          {/* Body */}
          <div className="flex-1 pt-5 px-5">
            <p className="font-mono text-[10.5px] tracking-[0.12em] uppercase text-white/50 mb-2">
              Chapter 03 · The turning point
            </p>
            <h2 className="font-mono font-bold text-[19px] leading-[1.22] tracking-[-0.01em]">
              Rebuilt onboarding and cut drop-off in half
            </h2>
          </div>
          {/* Footer with page dots */}
          <div className="flex items-center gap-[7px] px-5 pt-4 pb-[18px] mt-auto">
            <span className="w-1.5 h-1.5 rounded-full bg-white/28" />
            <span className="w-5 h-1.5 rounded-[3px] bg-white" />
            <span className="w-1.5 h-1.5 rounded-full bg-white/28" />
            <span className="w-1.5 h-1.5 rounded-full bg-white/28" />
          </div>
        </article>
        {/* Swipe note */}
        <div
          className="absolute -bottom-1.5 -right-1.5 font-mono text-[11px] text-[#6B6864] bg-[#FBFAF8] border border-[#E4E1DB] px-3 py-1.5 rounded-full flex items-center gap-[7px]"
          style={{ boxShadow: '0 6px 18px -8px rgba(17,17,17,0.25)' }}
        >
          <span>swipe the story</span>
          <span style={{ animation: 'nudge-arrow 1.6s ease-in-out infinite' }}>→</span>
        </div>
      </div>
    </div>
  );
}