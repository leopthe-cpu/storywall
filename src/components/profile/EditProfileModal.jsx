import { useState, useRef } from 'react';
import { X } from '@/components/icons';
import { base44 } from '@/api/base44Client';
import ProfilePhotoEditor from './ProfilePhotoEditor';
import LinksEditor from './LinksEditor';

export default function EditProfileModal({ profile, allTags, onClose, onSaved }) {
  const [form, setForm] = useState({
    display_name: profile?.display_name || profile?.full_name || '',
    headline: profile?.headline || '',
    location: profile?.location || '',
    bio: profile?.bio || '',
    skills: profile?.skills || [],
    profile_image: profile?.profile_image || '',
    links: profile?.links || [],
  });
  const [saving, setSaving] = useState(false);
  const formRef = useRef(form);

  const set = (key, val) => setForm(f => {
    const next = { ...f, [key]: val };
    formRef.current = next;
    return next;
  });

  const MAX_PINS = 10;
  const toggleSkill = (tag) => {
    setForm(f => {
      if (f.skills.includes(tag)) {
        const next = { ...f, skills: f.skills.filter(t => t !== tag) };
        formRef.current = next;
        return next;
      }
      if (f.skills.length >= MAX_PINS) return f;
      const next = { ...f, skills: [...f.skills, tag] };
      formRef.current = next;
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const latest = formRef.current;
      console.log('[EditProfileModal] Saving profile:', latest);
      const result = await base44.auth.updateMe(latest);
      console.log('[EditProfileModal] Save result:', result);
      onSaved(latest);
      onClose();
    } catch (err) {
      console.error('[EditProfileModal] Save failed:', err);
      alert('Failed to save: ' + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#F7F7F5]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 text-base">Edit Profile</h2>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">

          {/* Profile photo */}
          <ProfilePhotoEditor
            value={form.profile_image}
            onChange={(url) => set('profile_image', url)}
            size={200}
          />

          {/* Basic info */}
          <Section label="Full Name">
            <Field value={form.display_name} onChange={v => set('display_name', v)} placeholder="Your name" />
          </Section>
          <Section label="Job Title">
            <Field value={form.headline} onChange={v => set('headline', v)} placeholder="e.g. Product Manager" />
          </Section>
          <Section label="Location">
            <Field value={form.location} onChange={v => set('location', v)} placeholder="e.g. Barcelona" />
          </Section>
          <Section label="Bio">
            <textarea
              value={form.bio}
              onChange={e => set('bio', e.target.value.slice(0, 200))}
              placeholder="Write a short bio — what do you do and what drives you?"
              rows={4}
              maxLength={200}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black/20 resize-none"
            />
            <p className={`text-xs text-right mt-1 ${
              form.bio.length >= 191 ? 'text-red-500' :
              form.bio.length >= 160 ? 'text-amber-500' :
              'text-gray-400'
            }`}>
              {form.bio.length}/200
            </p>
          </Section>

          {/* Links */}
          <Section label="Links">
            <LinksEditor links={form.links} onChange={v => set('links', v)} />
          </Section>

          {/* Skills / tags */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Pinned Skills</p>
            <p className="text-xs text-gray-400 mb-3">Select which skills you would like to pin to your profile.</p>
            {allTags.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Publish stories to start collecting skill tags</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {allTags.map(tag => {
                  const pinned = form.skills.includes(tag);
                  return (
                    <button
                      key={tag}
                      onClick={() => toggleSkill(tag)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                        pinned ? 'bg-black text-white border-black' : 'bg-white text-gray-600 border-gray-200'
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Save */}
        <div className="px-5 pb-8 pt-4 border-t border-gray-100">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-black text-white py-4 rounded-2xl font-semibold text-base disabled:opacity-50 hover:bg-gray-900 active:scale-[0.98] transition-all"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
  );
}

function Section({ label, children }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{label}</p>
      {children}
    </div>
  );
}

function Field({ value, onChange, placeholder }) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black/20"
    />
  );
}