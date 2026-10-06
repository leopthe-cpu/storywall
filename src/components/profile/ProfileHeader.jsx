import { useState, useEffect, useRef, useCallback } from 'react';
import { Globe, Link } from '@/components/icons';
import Tag from '@/components/profile/Tag';
import ImageSkeleton from '@/components/ui/ImageSkeleton';

// Profile hero card + info block, shared by the public profile page and the
// onboarding live preview so the preview is exactly what the profile renders.

export function ProfileHeroCard({ profile, name, aspectRatio = '1/1', style }) {
  // Same "derive loaded-ness from render, not an effect" approach used for
  // canvas image elements: a ref tracks the last src that actually finished
  // loading, compared directly against the current src on every render, so
  // there's no gap between a new profile_image committing to the DOM and a
  // loading flag catching up to it.
  const loadedSrcRef = useRef(null);
  const [, setLoadTick] = useState(0);
  const imgSrc = profile?.profile_image || null;
  const imgLoaded = !imgSrc || loadedSrcRef.current === imgSrc;
  const handleImgLoad = () => { loadedSrcRef.current = imgSrc; setLoadTick((t) => t + 1); };
  const handleImgError = () => { loadedSrcRef.current = imgSrc; setLoadTick((t) => t + 1); };

  return (
    <div className="relative w-full rounded-2xl overflow-hidden" style={{ aspectRatio, ...style }}>
      {imgSrc ? (
        <>
          <img
            src={imgSrc} alt={name} decoding="async"
            className="absolute inset-0 w-full h-full object-cover"
            onLoad={handleImgLoad}
            onError={handleImgError}
          />
          <ImageSkeleton loaded={imgLoaded} />
        </>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#262624] to-[#3A3935]" />
      )}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.70) 100%)' }} />
      <div className="absolute bottom-0 left-0 right-0 px-5 pb-6">
        <h1 className="text-[#F4F2EC] font-bold text-3xl leading-tight tracking-tight">{name}</h1>
        {profile?.headline && (
          <p className="text-[#F4F2EC]/70 text-sm mt-1 font-medium">{profile.headline}</p>
        )}
      </div>
    </div>
  );
}

export function ProfileInfo({ profile, visibleSkills = [], selectedTags = [], onToggleTag }) {
  const profileLinks = profile?.links || [];
  const [bioExpanded, setBioExpanded] = useState(false);
  const [bioOverflows, setBioOverflows] = useState(false);
  const [skillsExpanded, setSkillsExpanded] = useState(false);
  const bioRef = useRef(null);
  const bioMeasureRef = useRef(null);

  // Compare a hidden, in-flow (never clamped) copy against the clamped visible
  // copy. This is immune to -webkit-line-clamp scrollHeight bugs and to the
  // clone being measured in a different layout context.
  const measureBioOverflow = useCallback(() => {
    const visible = bioRef.current;
    const measure = bioMeasureRef.current;
    if (!visible || !measure) return;
    setBioOverflows(measure.offsetHeight > visible.clientHeight + 1);
  }, []);

  useEffect(() => {
    const timer = setTimeout(measureBioOverflow, 0);
    return () => clearTimeout(timer);
  }, [profile?.bio, measureBioOverflow]);

  useEffect(() => {
    const el = bioRef.current;
    if (!el) return;
    const observer = new ResizeObserver(measureBioOverflow);
    observer.observe(el);
    return () => observer.disconnect();
  }, [profile?.bio, measureBioOverflow]);

  return (
    <div>
      {profile?.bio && (
        <div className="mb-5">
          {/* Hidden in-flow copy for measurement — never clamped */}
          <div style={{ height: 0, overflow: 'hidden' }} aria-hidden="true">
            <p ref={bioMeasureRef} className="text-sm text-[#6B6964] leading-relaxed">
              {profile.bio}
            </p>
          </div>
          <p
            ref={bioRef}
            className="text-sm text-[#6B6964] leading-relaxed"
            style={bioExpanded ? {} : {
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {profile.bio}
          </p>
          {(bioExpanded || bioOverflows) && (
            <button
              onClick={() => setBioExpanded(e => !e)}
              className="text-sm text-[#8A877F] underline mt-1 text-left"
            >
              {bioExpanded ? 'less' : 'more'}
            </button>
          )}
        </div>
      )}

      {profileLinks.length > 0 && (
        <div className="flex items-center mb-4 flex-wrap gap-3">
          {profileLinks.map((link, i) => {
            // Only allow http(s) URLs in href — reject javascript:, data:, etc.
            const safe = typeof link.url === 'string' && /^https?:\/\//i.test(link.url);
            const content = (
              <>
                {link.favicon ? (
                  <img src={link.favicon} alt="" className="w-4 h-4 rounded-sm" onError={e => { e.target.style.display = 'none'; }} />
                ) : (
                  <Link size={14} />
                )}
                <span className="text-xs text-[#6B6964]">{link.label}</span>
              </>
            );
            return safe ? (
              <a
                key={i}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[#6B6964] hover:text-[#262624] transition-colors"
                title={link.label}
              >
                {content}
              </a>
            ) : (
              <span key={i} className="flex items-center gap-1.5 text-[#8A877F]" title={link.label}>
                {content}
              </span>
            );
          })}
        </div>
      )}

      {visibleSkills.length > 0 && (
        <div className="mb-4">
          <div className="flex flex-wrap gap-2">
            {(skillsExpanded ? visibleSkills : visibleSkills.slice(0, 3)).map((skill) => (
              <Tag key={skill} label={skill} selected={selectedTags.includes(skill)} onClick={() => onToggleTag?.(skill)} />
            ))}
          </div>
          {visibleSkills.length > 3 && (
            <button
              onClick={() => setSkillsExpanded(e => !e)}
              className="text-sm text-[#8A877F] underline mt-1 text-left"
            >
              {skillsExpanded ? 'less' : 'more'}
            </button>
          )}
        </div>
      )}

      {profile?.location && (
        <div className="flex items-center gap-1.5 text-[#8A877F]">
          <Globe size={13} />
          <span className="text-sm">{profile.location}</span>
        </div>
      )}
    </div>
  );
}

