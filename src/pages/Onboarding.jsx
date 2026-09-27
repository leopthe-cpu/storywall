import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Check, X, AlertCircle } from 'lucide-react';
import LinksEditor from '@/components/profile/LinksEditor';
import ProfilePhotoEditor from '@/components/profile/ProfilePhotoEditor';
import { ProfileHeroCard, ProfileInfo } from '@/components/profile/ProfileHeader';
import { ImagePanel, PreviewPanel } from '@/components/signup/SidePanel';
import PixelSpinner from '@/components/ui/PixelSpinner';

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

function ProgressBar({ step }) {
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <div
          key={i}
          className={`h-1 flex-1 rounded-full transition-all duration-300 ${i < step ? 'bg-black' : 'bg-gray-200'}`}
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
        <button onClick={onBack} className="flex items-center gap-1 text-gray-500 hover:text-gray-900 transition-colors w-fit -ml-1">
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
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          rows={4}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black/20 resize-none"
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full border border-gray-200 rounded-xl px-4 py-3.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black/20"
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
    base44.auth.me().then(u => {
      if (!u) { navigate('/signin', { replace: true }); return; }
      // If user already has a username, they've already onboarded — send to their profile
      if (u.username) { navigate(`/${u.username}`, { replace: true }); return; }
      setCurrentUserId(u.id);
      setAuthChecked(true);
      // Pre-fill username from the claim flow (URL query or sessionStorage)
      const urlParams = new URLSearchParams(window.location.search);
      const claimed = urlParams.get('username') || sessionStorage.getItem('claimed_username') || '';
      if (claimed) {
        setForm(f => ({ ...f, username: claimed.toLowerCase() }));
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
          setUsernameError('Could not verify — please try again');
        }
      }
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [form.username]);

  if (!authChecked) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#F7F7F5]">
        <PixelSpinner size={24} color="#000" />
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
            <span className="-mb-2 text-xs text-gray-400 font-mono tracking-tight">storywall.io/{form.username}</span>
            <ProfileHeroCard profile={form} name={form.full_name.trim() || 'Your name'} aspectRatio="1/1" />
            <ProfileInfo profile={form} />
          </div>
        </PreviewPanel>
      )}

      <div className="fixed top-0 left-0 right-0 md:right-1/2 h-[100dvh] bg-[#F7F7F5] overflow-y-auto">
        <div className="px-6 pt-10 pb-32">
          <div className="w-full max-w-sm mx-auto flex flex-col gap-8">
            <ProgressBar step={step} />
            <div className="text-xs text-gray-400 font-medium">Step {step} of {TOTAL_STEPS}</div>

            <AnimatePresence mode="wait">
              <div key={step} className="flex flex-col gap-6">

                {/* Step 1: Name + Username */}
                {step === 1 && (
                  <StepWrapper canGoBack={canGoBack} onBack={() => setStep(s => s - 1)}>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">Who are you?</h2>
                      <p className="text-gray-500 text-sm mt-1">
                        This is how others will find you.
                      </p>
                    </div>
                    <Field label="Name" value={form.full_name} onChange={handleNameChange} placeholder="Alex Rivera" />
                    <div>
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Username</label>
                      <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-black/20">
                        <span className="px-3 text-gray-400 text-sm bg-gray-50 border-r border-gray-200 py-3.5 flex-shrink-0">storywall.io/</span>
                        <input
                          value={form.username}
                          onChange={e => {
                            set('username')(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''));
                            setUsernameTouched(true);
                          }}
                          placeholder="yourname"
                          maxLength={30}
                          className="flex-1 px-3 py-3.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
                        />
                        <div className="pr-3 flex-shrink-0 flex items-center">
                          {checkState === 'checking' && <PixelSpinner size={16} color="#9CA3AF" />}
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
                      <h2 className="text-2xl font-bold text-gray-900">Your story</h2>
                      <p className="text-gray-500 text-sm mt-1">Tell people what you do and who you are.</p>
                    </div>
                    <Field label="Job title / Headline" value={form.headline} onChange={set('headline')} placeholder="Product Designer at Acme" />
                    <Field label="Bio" value={form.bio} onChange={set('bio')} placeholder="A few words about your journey..." multiline />
                  </StepWrapper>
                )}

                {/* Step 3: Location */}
                {step === 3 && (
                  <StepWrapper canGoBack={canGoBack} onBack={() => setStep(s => s - 1)}>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">Where are you?</h2>
                      <p className="text-gray-500 text-sm mt-1">Your city or country.</p>
                    </div>
                    <Field label="Location" value={form.location} onChange={set('location')} placeholder="San Francisco, CA" />
                  </StepWrapper>
                )}

                {/* Step 4: Links */}
                {step === 4 && (
                  <StepWrapper canGoBack={canGoBack} onBack={() => setStep(s => s - 1)}>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">Your links</h2>
                      <p className="text-gray-500 text-sm mt-1">Add any links you want to share on your profile.</p>
                    </div>
                    <LinksEditor links={form.links} onChange={set('links')} />
                  </StepWrapper>
                )}

                {/* Step 5: Profile photo */}
                {step === 5 && (
                  <StepWrapper canGoBack={canGoBack} onBack={() => setStep(s => s - 1)}>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">Profile photo</h2>
                      <p className="text-gray-500 text-sm mt-1">Add a face to your name.</p>
                    </div>
                    <ProfilePhotoEditor
                      value={form.profile_image}
                      onChange={(url) => set('profile_image')(url)}
                      size={300}
                    />
                  </StepWrapper>
                )}

              </div>
            </AnimatePresence>

            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          </div>
        </div>
      </div>

      {/* Fixed bottom button — always visible on all steps */}
      <div className="fixed left-4 right-4 md:right-[calc(50%+1rem)] z-50" style={{ bottom: 'max(24px, env(safe-area-inset-bottom, 0px) + 16px)' }}>
        <div className="w-full max-w-sm mx-auto flex flex-col gap-3">
          {saveError ? (
            <>
              <p className="text-red-500 text-sm text-center">Something went wrong saving your profile. Please try again.</p>
              <button
                onClick={handleFinish}
                disabled={saving}
                className="w-full bg-black text-white py-4 rounded-2xl font-semibold text-base disabled:opacity-50 hover:bg-gray-900 active:scale-[0.98] transition-all"
              >
                {saving ? 'Saving...' : 'Retry'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleNext}
                disabled={saving || (step === 1 && !canContinueStep1)}
                className="w-full bg-black text-white py-4 rounded-2xl font-semibold text-base disabled:opacity-50 hover:bg-gray-900 active:scale-[0.98] transition-all"
              >
                {saving ? 'Saving...' : step === TOTAL_STEPS ? 'Take me to my profile →' : 'Continue'}
              </button>
              {isSkippable && step < TOTAL_STEPS && (
                <button onClick={handleSkip} className="text-center text-sm text-gray-400 hover:text-gray-700 transition-colors py-1">
                  Skip for now
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}