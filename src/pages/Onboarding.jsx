import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Check, X, AlertCircle } from '@/components/icons';
import LinksEditor from '@/components/profile/LinksEditor';
import ProfilePhotoEditor from '@/components/profile/ProfilePhotoEditor';
import { ProfileHeroCard, ProfileInfo } from '@/components/profile/ProfileHeader';
import { ImagePanel, PreviewPanel } from '@/components/signup/SidePanel';
import PixelSpinner from '@/components/ui/PixelSpinner';
import useDocumentTitle from '@/lib/useDocumentTitle';

// Desktop side-panel caption per step. Step 1 shows a photo; steps 2–5 show a
// live preview of the profile being built.
const STEP_CAPTIONS = {
  1: 'This is the name people will remember.',
  2: 'The title is where it starts. Not where it ends.',
  3: 'Every story happens somewhere.',
  4: 'Point people to the rest of your work.',
  5: 'Last thing: the face behind the stories.',
};

const TOTAL_STEPS = 5;

// Onboarding progress is kept in this browser (per user) until the profile is
// saved, so leaving midway (e.g. via the logo), refreshing, or closing the tab
// doesn't lose what was entered. Cleared once the profile is saved.
const draftKey = (userId) => `sw_onboarding_draft_v1:${userId}`;
const readDraft = (userId) => { try { return JSON.parse(localStorage.getItem(draftKey(userId)) || 'null'); } catch { return null; } };
const writeDraft = (userId, data) => { try { localStorage.setItem(draftKey(userId), JSON.stringify(data)); } catch { /* storage unavailable */ } };
const clearDraft = (userId) => { try { localStorage.removeItem(draftKey(userId)); } catch { /* ignore */ } };

// Server copy of the draft (private table, owner-only) so a user can resume on
// any device. Every call is non-blocking: if it fails, the browser copy still works.
const withTimeout = (promise, ms) => Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);
async function loadServerDraft(userId) {
  try {
    const rows = await withTimeout(base44.entities.OnboardingDraft.filter({ user_id: userId }), 3000);
    if (!rows?.length) return null;
    const row = [...rows].sort((a, b) => new Date(b.updated_date || 0) - new Date(a.updated_date || 0))[0];
    const d = JSON.parse(row.data || 'null');
    return d ? { ...d, _rowId: row.id } : null;
  } catch { return null; }
}
async function saveServerDraft(userId, rowIdRef, payload) {
  try {
    const body = { user_id: userId, step: payload.step, data: JSON.stringify(payload) };
    if (!rowIdRef.current) {
      const rows = await base44.entities.OnboardingDraft.filter({ user_id: userId });
      if (rows?.length) rowIdRef.current = rows[0].id;
    }
    if (rowIdRef.current) await base44.entities.OnboardingDraft.update(rowIdRef.current, body);
    else { const created = await base44.entities.OnboardingDraft.create(body); rowIdRef.current = created?.id || null; }
  } catch { /* non-blocking */ }
}
async function deleteServerDraft(userId) {
  try {
    const rows = await base44.entities.OnboardingDraft.filter({ user_id: userId });
    for (const r of rows || []) await base44.entities.OnboardingDraft.delete(r.id);
  } catch { /* non-blocking */ }
}

function ProgressBar({ step }) {
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <div
          key={i}
          className={`h-1 flex-1 rounded-full transition-all duration-300 ${i < step ? 'bg-[#262624]' : 'bg-[#E6E0D2]'}`}
        />
      ))}
    </div>
  );
}

function StepWrapper({ children, onBack, canGoBack }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.22 }}
      className="flex flex-col gap-6"
    >
      {canGoBack && (
        <button onClick={onBack} className="flex items-center gap-1 text-[#6B6964] hover:text-[#262624] transition-colors w-fit -ml-1">
          <ChevronLeft size={18} />
          <span className="text-sm">Back</span>
        </button>
      )}
      {children}
    </motion.div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text', multiline = false }) {
  return (
    <div>
      <label className="text-xs font-semibold text-[#6B6964] uppercase tracking-wider mb-2 block">{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          rows={4}
          className="w-full border border-[#D6D2C7] rounded-xl px-4 py-3 text-sm text-[#262624] placeholder:text-[#8A877F] focus:outline-none focus:ring-2 focus:ring-[#262624]/20 resize-none"
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full border border-[#D6D2C7] rounded-xl px-4 py-3.5 text-sm text-[#262624] placeholder:text-[#8A877F] focus:outline-none focus:ring-2 focus:ring-[#262624]/20"
        />
      )}
    </div>
  );
}

// Derive a username suggestion from a display name:
// "Leo Thé" → "leo_the" (diacritics folded, lowercased, non-alnum/_ → _, trimmed).
function suggestUsername(name) {
  return name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);
}

export default function Onboarding() {
  useDocumentTitle('Get Started | storywall');
  const navigate = useNavigate();
  const { checkAppState } = useAuth();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [usernameError, setUsernameError] = useState('');
  // idle | checking | available | taken | error
  const [checkState, setCheckState] = useState('idle');
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [saveError, setSaveError] = useState(false);
  // True while the profile-photo cropper is open (photo uploaded but not yet saved/discarded)
  const [photoEditing, setPhotoEditing] = useState(false);
  const finishedRef = useRef(false); // set once the profile is saved, so the draft isn't re-written
  const serverRowId = useRef(null);      // id of this user's server-side draft row, once known
  const serverTimer = useRef(null);      // debounce timer for the server save
  const lastServerJson = useRef('');     // last content saved to the server (skip identical saves)
  const [currentUserId, setCurrentUserId] = useState(null);

  const [form, setForm] = useState({
    full_name: '',
    username: '',
    headline: '',
    bio: '',
    location: '',
    links: [],
    profile_image: '',
  });

  useEffect(() => {
    base44.auth.me().then(async u => {
      if (!u) { navigate('/signin', { replace: true }); return; }
      // If user already has a username, they've already onboarded — send to their profile
      if (u.username) { navigate(`/${u.username}`, { replace: true }); return; }
      // Look for saved progress on the server too (resume on another device), before showing the form
      const serverDraft = await loadServerDraft(u.id);
      if (serverDraft?._rowId) serverRowId.current = serverDraft._rowId;
      setCurrentUserId(u.id);
      setAuthChecked(true);
      // Restore progress from an earlier visit (left via the logo, refreshed, closed the tab)
      const localDraft = readDraft(u.id);
      const draft = serverDraft && (!localDraft || (serverDraft.savedAt || 0) > (localDraft.savedAt || 0)) ? serverDraft : localDraft;
      if (draft?.form) {
        lastServerJson.current = JSON.stringify({ form: draft.form, step: draft.step });
        setForm(f => ({ ...f, ...draft.form }));
        if (draft.usernameTouched) setUsernameTouched(true);
        if (draft.step > 1 && draft.step <= TOTAL_STEPS) setStep(draft.step);
      }
      // Pre-fill username from the claim flow (URL query or sessionStorage).
      // A username claimed just now wins over the saved one and starts at step 1
      // (so it gets confirmed); the same one as in the draft leaves progress as is.
      const urlParams = new URLSearchParams(window.location.search);
      const claimed = (urlParams.get('username') || sessionStorage.getItem('claimed_username') || '').toLowerCase();
      if (claimed) {
        if (claimed !== draft?.form?.username) {
          setForm(f => ({ ...f, username: claimed }));
          setStep(1);
        }
        setUsernameTouched(true);
        sessionStorage.removeItem('claimed_username');
      }
    }).catch(() => navigate('/signin', { replace: true }));
  }, [navigate]);

  // Lock body scroll only while onboarding is active; restore on unmount.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    return () => {
      document.body.style.overflow = prev;
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, []);

  // Real-time username availability check (debounced 400ms).
  // Calls a backend function with service-role access to bypass User RLS.
  // Retries once before showing an error.
  useEffect(() => {
    const val = form.username;
    if (!val || val.length < 2 || !/^[a-z0-9_-]+$/.test(val)) {
      setCheckState('idle');
      setUsernameError('');
      return;
    }
    setCheckState('checking');
    let cancelled = false;
    const t = setTimeout(async () => {
      for (let attempt = 0; attempt < 2; attempt++) {
        if (cancelled) return;
        try {
          const res = await base44.functions.invoke('checkUsername', { username: val, excludeUserId: currentUserId });
          if (cancelled) return;
          if (res.data?.available) {
            setCheckState('available');
            setUsernameError('');
          } else {
            setCheckState('taken');
            setUsernameError('This username is taken');
          }
          return;
        } catch {
          if (attempt < 1) continue; // retry once
          if (cancelled) return;
          setCheckState('error');
          setUsernameError('Could not verify. Please try again.');
        }
      }
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [form.username]);

  // Keep progress in this browser until the profile is saved.
  useEffect(() => {
    if (!authChecked || !currentUserId || finishedRef.current) return;
    const started = step > 1 || form.full_name || form.headline || form.bio || form.location || form.profile_image || form.links.length > 0;
    if (!started) return;
    const payload = { form, step, usernameTouched, savedAt: Date.now() };
    writeDraft(currentUserId, payload);
    // Server copy, debounced. Not cleared on unmount, so a last edit still saves if they leave right away.
    const json = JSON.stringify({ form, step });
    if (json === lastServerJson.current) return;
    clearTimeout(serverTimer.current);
    serverTimer.current = setTimeout(() => {
      if (finishedRef.current) return;
      lastServerJson.current = json;
      saveServerDraft(currentUserId, serverRowId, payload);
    }, 900);
  }, [authChecked, currentUserId, form, step, usernameTouched]);

  // A restored draft can sit on a later step with a username someone else has
  // since taken — send them back to step 1 to choose another.
  useEffect(() => {
    if (step > 1 && checkState === 'taken') setStep(1);
  }, [step, checkState]);

  if (!authChecked) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#F4F2EC]">
        <PixelSpinner size={24} />
      </div>
    );
  }

  const set = (key) => (val) => setForm(f => ({ ...f, [key]: val }));

  const validateUsername = (val) => {
    if (!val) return 'A username is required to create your profile';
    if (!/^[a-z0-9_-]+$/.test(val)) return 'Letters, numbers, - and _ only';
    if (val.length < 3) return 'At least 3 characters';
    if (val.length > 30) return 'At most 30 characters';
    if (/^-|-$/.test(val)) return "Can't start or end with a hyphen";
    return '';
  };

  const handleNameChange = (val) => {
    set('full_name')(val);
    if (!usernameTouched) set('username')(suggestUsername(val));
  };

  const handleNext = async () => {
    setError('');
    if (step === 1) {
      if (!form.full_name.trim()) { setError('Please enter your name'); return; }
      const uErr = validateUsername(form.username);
      if (uErr) { setUsernameError(uErr); return; }
      // Never proceed with an unverified username.
      if (checkState !== 'available') return;
    }
    if (step < TOTAL_STEPS) {
      setStep(s => s + 1);
    } else {
      await handleFinish();
    }
  };

  const handleFinish = async () => {
    setSaving(true);
    setError('');
    setSaveError(false);
    // full_name is a built-in that can't be overridden via updateMe;
    // write display_name instead — the profile reads display_name first.
    const payload = { ...form, display_name: form.full_name };
    delete payload.full_name;
    Object.keys(payload).forEach(k => {
      const v = payload[k];
      if (v === '' || (Array.isArray(v) && v.length === 0)) delete payload[k];
    });
    try {
      await base44.auth.updateMe(payload);
    } catch (e) {
      setSaving(false);
      setError(e?.message || 'Something went wrong. Please try again.');
      return;
    }
    // Force re-fetch of current user so RequireAuth sees the new username
    // before any route re-evaluation — prevents redirect-back-to-onboarding.
    try {
      const updatedUser = await base44.auth.me();
      if (updatedUser?.username) {
        // Brief delay to let the database propagate the username write before
        // the profile page queries it (avoids a "not_found" race on first load).
        await new Promise(r => setTimeout(r, 300));
        // Refresh AuthContext so any component reading from context sees
        // the updated user with the username set.
        finishedRef.current = true;
        clearTimeout(serverTimer.current);
        clearDraft(currentUserId);
        deleteServerDraft(currentUserId);
        checkAppState();
        navigate(`/${updatedUser.username}`);
        return;
      }
    } catch {
      // fall through to error
    }
    setSaving(false);
    setError('Failed to save profile. Please try again.');
  };

  const handleSkip = () => {
    if (step < TOTAL_STEPS) setStep(s => s + 1);
    else handleFinish();
  };

  const isSkippable = step >= 2;
  const canGoBack = step > 1;

  const usernameValid = form.username.length >= 3 && form.username.length <= 30 && /^[a-z0-9_-]+$/.test(form.username) && !/^-|-$/.test(form.username);
  const canContinueStep1 = !!form.full_name.trim() && usernameValid && checkState === 'available';


  const actionBar = (
    <div className="w-full max-w-sm mx-auto flex flex-col gap-3">
          {saveError ? (
            <>
              <p className="text-red-500 text-sm text-center">Something went wrong saving your profile. Please try again.</p>
              <button
                onClick={handleFinish}
                disabled={saving}
                className="w-full bg-[#262624] text-[#F4F2EC] py-4 rounded-2xl font-semibold text-base disabled:opacity-50 hover:bg-[#30302E] active:scale-[0.98] transition-all"
              >
                {saving ? 'Saving...' : 'Retry'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleNext}
                disabled={saving || (step === 1 && !canContinueStep1) || (step === TOTAL_STEPS && photoEditing)}
                className="w-full bg-[#262624] text-[#F4F2EC] py-4 rounded-2xl font-semibold text-base disabled:opacity-50 hover:bg-[#30302E] active:scale-[0.98] transition-all"
              >
                {saving ? 'Saving...' : step === TOTAL_STEPS ? 'Take me to my profile →' : 'Continue'}
              </button>
              {isSkippable && step < TOTAL_STEPS && (
                <button onClick={handleSkip} className="text-center text-sm text-[#8A877F] hover:text-[#3A3935] transition-colors py-1">
                  Skip for now
                </button>
              )}
            </>
          )}
    </div>
  );

  return (
    <>
      {/* Scrollable content area */}
      {/* Desktop side panel: photo on step 1, live profile preview on 2–5 */}
      {step === 1 ? (
        <ImagePanel caption={STEP_CAPTIONS[1]} />
      ) : (
        <PreviewPanel caption={STEP_CAPTIONS[step]}>
          <div className="w-full flex flex-col gap-5" style={{ maxWidth: 340 }}>
            {/* Same placement/style as the live profile's top bar */}
            <span className="-mb-2 text-xs text-[#8A877F] font-mono tracking-tight">storywall.io/{form.username}</span>
            <ProfileHeroCard profile={form} name={form.full_name.trim() || 'Your name'} aspectRatio="1/1" />
            <ProfileInfo profile={form} />
          </div>
        </PreviewPanel>
      )}

      <div className="fixed top-0 left-0 right-0 md:right-1/2 h-[100dvh] bg-[#F4F2EC] overflow-y-auto">
        {/* Logo: back to the home page at any step (progress is kept, see draft helpers) */}
        <Link to="/" aria-label="Back to the StoryWall home page" className="absolute top-6 left-6 md:top-8 md:left-10 z-10">
          <img src="/logo-slash-ink.png" alt="StoryWall" className="h-[20px] w-auto" />
        </Link>
        <div className="px-6 pt-[4.5rem] pb-32 md:pt-20 md:pb-0 md:min-h-full md:flex md:flex-col">
          <div className="w-full max-w-sm mx-auto flex flex-col gap-8 md:flex-1">
            <div className="flex flex-col gap-8">
              <ProgressBar step={step} />
              <div className="text-xs text-[#8A877F] font-medium">Step {step} of {TOTAL_STEPS}</div>
            </div>

            {/* Desktop: the form and Continue are centred in the remaining height (progress bar stays a little higher) */}
            <div className="flex flex-col gap-8 md:flex-1 md:justify-center md:pb-28">
            <AnimatePresence mode="wait">
              <div key={step} className="flex flex-col gap-6">

                {/* Step 1: Name + Username */}
                {step === 1 && (
                  <StepWrapper canGoBack={canGoBack} onBack={() => setStep(s => s - 1)}>
                    <div>
                      <h2 className="font-display text-[28px] leading-tight font-medium text-[#262624]">Who are you?</h2>
                      <p className="text-[#6B6964] text-sm mt-1">
                        This is how others will find you.
                      </p>
                    </div>
                    <Field label="Name" value={form.full_name} onChange={handleNameChange} placeholder="Alex Rivera" />
                    <div>
                      <label className="text-xs font-semibold text-[#6B6964] uppercase tracking-wider mb-2 block">Username</label>
                      <div className="flex items-center border border-[#D6D2C7] rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-[#262624]/20">
                        <span className="px-3 text-[#8A877F] text-sm bg-[#FAF9F5] border-r border-[#D6D2C7] py-3.5 flex-shrink-0">storywall.io/</span>
                        <input
                          value={form.username}
                          onChange={e => {
                            set('username')(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''));
                            setUsernameTouched(true);
                          }}
                          placeholder="yourname"
                          maxLength={30}
                          className="flex-1 px-3 py-3.5 text-sm text-[#262624] placeholder:text-[#8A877F] focus:outline-none"
                        />
                        <div className="pr-3 flex-shrink-0 flex items-center">
                          {checkState === 'checking' && <PixelSpinner size={16} />}
                          {checkState === 'available' && <Check size={16} className="text-green-500" />}
                          {checkState === 'taken' && <X size={16} className="text-red-500" />}
                          {checkState === 'error' && <AlertCircle size={16} className="text-red-500" />}
                        </div>
                      </div>
                      {usernameError && <p className="text-red-500 text-xs mt-1.5">{usernameError}</p>}
                    </div>
                  </StepWrapper>
                )}

                {/* Step 2: Headline + Bio */}
                {step === 2 && (
                  <StepWrapper canGoBack={canGoBack} onBack={() => setStep(s => s - 1)}>
                    <div>
                      <h2 className="font-display text-[28px] leading-tight font-medium text-[#262624]">Your story</h2>
                      <p className="text-[#6B6964] text-sm mt-1">Tell people what you do and who you are.</p>
                    </div>
                    <Field label="Job title / Headline" value={form.headline} onChange={set('headline')} placeholder="Product Designer at Acme" />
                    <Field label="Bio" value={form.bio} onChange={set('bio')} placeholder="A few words about your journey..." multiline />
                  </StepWrapper>
                )}

                {/* Step 3: Location */}
                {step === 3 && (
                  <StepWrapper canGoBack={canGoBack} onBack={() => setStep(s => s - 1)}>
                    <div>
                      <h2 className="font-display text-[28px] leading-tight font-medium text-[#262624]">Where are you?</h2>
                      <p className="text-[#6B6964] text-sm mt-1">Your city or country.</p>
                    </div>
                    <Field label="Location" value={form.location} onChange={set('location')} placeholder="San Francisco, CA" />
                  </StepWrapper>
                )}

                {/* Step 4: Links */}
                {step === 4 && (
                  <StepWrapper canGoBack={canGoBack} onBack={() => setStep(s => s - 1)}>
                    <div>
                      <h2 className="font-display text-[28px] leading-tight font-medium text-[#262624]">Your links</h2>
                      <p className="text-[#6B6964] text-sm mt-1">Add any links you want to share on your profile.</p>
                    </div>
                    <LinksEditor links={form.links} onChange={set('links')} />
                  </StepWrapper>
                )}

                {/* Step 5: Profile photo */}
                {step === 5 && (
                  <StepWrapper canGoBack={canGoBack} onBack={() => setStep(s => s - 1)}>
                    <div>
                      <h2 className="font-display text-[28px] leading-tight font-medium text-[#262624]">Profile photo</h2>
                      <p className="text-[#6B6964] text-sm mt-1">Add a face to your name.</p>
                    </div>
                    <ProfilePhotoEditor
                      value={form.profile_image}
                      onChange={(url) => set('profile_image')(url)}
                      onEditingChange={setPhotoEditing}
                      size={300}
                    />
                  </StepWrapper>
                )}

              </div>
            </AnimatePresence>

            {error && <p className="text-red-500 text-sm text-center">{error}</p>}

            <div className="hidden md:block">{actionBar}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile: button pinned to the bottom. Desktop (md+): the same actions render in-flow under the form instead (see actionBar). */}
      <div className="md:hidden fixed left-4 right-4 z-50" style={{ bottom: 'max(24px, env(safe-area-inset-bottom, 0px) + 16px)' }}>
        {actionBar}
      </div>
    </>
  );
}