import { useState, useRef, useEffect } from 'react';
import { updateMe } from '@/api/storywallApi';
import { wallThemeVars } from '@/lib/wallTheme';
import { ProfileHeroCard, ProfileInfo } from '@/components/profile/ProfileHeader';
import ProfilePhotoEditor from './ProfilePhotoEditor';
import LinksEditor from './LinksEditor';
import BusyLabel from '@/components/ui/BusyLabel';

// Settings → Profile (Oz, 2026-10-30; replaces the Edit profile screen the
// wall's pencil used to open). On top, a miniature of the wall's header
// drawn by the wall's own components (ProfileHeroCard, ProfileInfo) in the
// wall's colours, updating as the fields below change; it's what visitors
// will see. Saved only on Save. registerGuard lets Settings ask "save your
// changes?" before leaving with unsaved edits.

const MAX_BIO = 200;
const MAX_PINS = 10;

const formFrom = (profile) => ({
  display_name: profile?.display_name || profile?.full_name || '',
  headline: profile?.headline || '',
  location: profile?.location || '',
  bio: profile?.bio || '',
  skills: profile?.skills || [],
  profile_image: profile?.profile_image || '',
  links: profile?.links || [],
});

const sectionTitle = 'font-mono text-xs font-bold uppercase tracking-wider text-[#6B6964] mx-1 mb-1.5';
const inputCls = 'w-full rounded-lg border border-[#D6D2C7] bg-[#ECE9E1] px-3 h-12 text-[15px] text-[#262624] placeholder:text-[#8A877F] focus:outline-none focus:border-[#262624]';

export default function ProfileSettings({ profile, allTags = [], onSaved, registerGuard }) {
  const [initial, setInitial] = useState(() => formFrom(profile));
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const formRef = useRef(form);
  formRef.current = form;

  const set = (key, val) => { setForm((f) => ({ ...f, [key]: val })); setMessage(''); };
  const toggleSkill = (tag) => setForm((f) => {
    if (f.skills.includes(tag)) return { ...f, skills: f.skills.filter((t) => t !== tag) };
    if (f.skills.length >= MAX_PINS) return f;
    return { ...f, skills: [...f.skills, tag] };
  });

  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  // Returns true once saved, false if it failed (the message says why).
  const save = async () => {
    const latest = formRef.current;
    setSaving(true);
    setMessage('');
    try {
      await updateMe(latest);
      setInitial(latest);
      onSaved?.(latest);
      setMessage('Saved');
      return true;
    } catch (err) {
      console.error('[ProfileSettings] save failed:', err);
      setMessage("Couldn't save. Check your connection and try again.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Settings reads these through the guard when someone leaves the screen.
  const guardRef = useRef(null);
  guardRef.current = { isDirty: () => dirty, save, discard: () => {} };
  useEffect(() => {
    registerGuard?.({
      isDirty: () => guardRef.current.isDirty(),
      save: () => guardRef.current.save(),
      discard: () => guardRef.current.discard(),
    });
    return () => registerGuard?.(null);
  }, []);

  const preview = { ...profile, ...form };
  const name = form.display_name || profile?.username || '';

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1 px-4 py-4 space-y-5">
        {/* The wall's header in miniature, in the wall's colours. */}
        <section aria-label="Preview of your wall">
          <h3 className={sectionTitle}>Preview</h3>
          <div
            className="rounded-xl border border-[#D6D2C7] bg-wall-bg p-3 pointer-events-none"
            style={wallThemeVars(profile?.wall_theme) || undefined}
          >
            <ProfileHeroCard profile={preview} name={name} />
            <div className="mt-4 px-1">
              <ProfileInfo profile={preview} visibleSkills={form.skills.filter((s) => allTags.includes(s))} />
            </div>
          </div>
        </section>

        <section>
          <h3 className={sectionTitle}>Photo</h3>
          <ProfilePhotoEditor value={form.profile_image} onChange={(url) => set('profile_image', url)} size={160} />
        </section>

        <section className="space-y-3">
          <h3 className={sectionTitle}>About you</h3>
          <Labeled label="Name">
            <input value={form.display_name} onChange={(e) => set('display_name', e.target.value)} placeholder="Your name" className={inputCls} />
          </Labeled>
          <Labeled label="Job title">
            <input value={form.headline} onChange={(e) => set('headline', e.target.value)} placeholder="e.g. Product Manager" className={inputCls} />
          </Labeled>
          <Labeled label="Location">
            <input value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="e.g. Toronto" className={inputCls} />
          </Labeled>
          <Labeled label="Bio">
            <textarea
              value={form.bio}
              onChange={(e) => set('bio', e.target.value.slice(0, MAX_BIO))}
              placeholder="What do you do, and what drives you?"
              rows={4}
              maxLength={MAX_BIO}
              className={`${inputCls} h-auto py-3 resize-none`}
            />
            <p className={`text-xs text-right mt-1 ${form.bio.length >= 191 ? 'text-red-700' : form.bio.length >= 160 ? 'text-amber-700' : 'text-[#6B6964]'}`}>
              {form.bio.length}/{MAX_BIO}
            </p>
          </Labeled>
        </section>

        <section>
          <h3 className={sectionTitle}>Links</h3>
          <LinksEditor links={form.links} onChange={(v) => set('links', v)} />
        </section>

        <section>
          <h3 className={sectionTitle}>Pinned skills</h3>
          <p className="text-[13px] text-[#6B6964] mx-1 mb-2">Pick up to {MAX_PINS} skills from your stories to show on your wall.</p>
          {allTags.length === 0 ? (
            <p className="text-[13px] text-[#6B6964] mx-1">Publish stories to start collecting skills.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {allTags.map((tag) => {
                const pinned = form.skills.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleSkill(tag)}
                    aria-pressed={pinned}
                    className={`text-[13px] px-3 py-1.5 rounded-full border transition-colors ${pinned ? 'bg-[#262624] text-[#F4F2EC] border-[#262624]' : 'bg-[#F4F2EC] text-[#262624] border-[#D6D2C7]'}`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <div className="sticky bottom-0 bg-[#FAF9F5] border-t border-[#D6D2C7] px-4 pt-3 pb-4">
        {message && <p className="text-[13px] text-[#6B6964] mb-2">{message}</p>}
        <button
          type="button"
          onClick={save}
          disabled={saving || !dirty}
          className="w-full h-12 rounded-lg bg-[#262624] text-[15px] font-medium text-[#F4F2EC] disabled:opacity-40"
        >
          <BusyLabel busy={saving} label="Saving…" tone="light" size={12}>Save</BusyLabel>
        </button>
      </div>
    </div>
  );
}

function Labeled({ label, children }) {
  return (
    <label className="block">
      <span className="block text-[13px] text-[#6B6964] mx-1 mb-1">{label}</span>
      {children}
    </label>
  );
}
