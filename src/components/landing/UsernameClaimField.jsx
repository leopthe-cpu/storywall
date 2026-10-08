import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { validateUsernameFormat, isReservedUsername } from '@/lib/usernameValidation';

// Username claim field with live green/red availability feedback.
// Debounces ~400ms, validates format + reserved words client-side,
// then checks the database via the checkUsername backend function.
// Calls onClaim(username) when the "Claim your wall" button is pressed.
export default function UsernameClaimField({ onClaim, autoFocus = false, buttonLabel = 'Claim your wall', claimingLabel = 'Taking you to sign up…', initialValue = '' }) {
  const [value, setValue] = useState(initialValue);
  // 'idle' | 'checking' | 'available' | 'taken'
  const [state, setState] = useState('idle');
  const [reason, setReason] = useState('');
  const [claiming, setClaiming] = useState(false);
  const timerRef = useRef(null);
  // Long usernames: once the typed name no longer fits next to the
  // "storywall.io/" prefix, the prefix is dropped so the whole name stays
  // visible. It only comes back when the field is emptied (re-showing it
  // as soon as the name fits again would flicker, since dropping the prefix
  // is what made it fit).
  const inputRef = useRef(null);
  const [hidePrefix, setHidePrefix] = useState(false);
  useEffect(() => {
    if (!value) { setHidePrefix(false); return; }
    const el = inputRef.current;
    if (!hidePrefix && el && el.scrollWidth > el.clientWidth) setHidePrefix(true);
  }, [value, hidePrefix]);

  // If the user hits Back from the sign-up page, the browser can restore this
  // page from its back/forward cache with the button still frozen on the
  // "Taking you to sign up…" label. Reset it when that happens.
  useEffect(() => {
    const onShow = (e) => { if (e.persisted) setClaiming(false); };
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
  }, []);

  useEffect(() => {
    const v = value.trim().toLowerCase();
    if (!v) {
      setState('idle');
      setReason('');
      return;
    }

    // Client-side format check (instant)
    const formatError = validateUsernameFormat(v);
    if (formatError) {
      setState('taken');
      setReason(formatError);
      return;
    }

    // Reserved words check (instant)
    if (isReservedUsername(v)) {
      setState('taken');
      setReason('That name is reserved');
      return;
    }

    // Database check (debounced)
    setState('checking');
    setReason('Checking…');
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        const res = await base44.functions.invoke('checkUsername', { username: v });
        if (res.data?.available) {
          setState('available');
          setReason(`storywall.io/${v} is available`);
        } else {
          setState('taken');
          setReason(res.data?.reason || `storywall.io/${v} is taken`);
        }
      } catch {
        setState('taken');
        setReason('Could not verify. Try again.');
      }
    }, 400);

    return () => clearTimeout(timerRef.current);
  }, [value]);

  const handleClaim = () => {
    if (state !== 'available') return;
    setClaiming(true);
    onClaim(value.trim().toLowerCase());
  };

  // One rounded field with the button inside it (input left, button inset
  // on the right). Colours unchanged; the border/glow still shows the
  // availability state.
  const fieldClass = `flex items-center gap-1 sm:gap-2 bg-[#FAF9F5] border-[1.5px] rounded-[12px] pl-2.5 sm:pl-3 pr-1.5 py-1.5 transition-all ${
    state === 'available' ? 'border-[#1f9d55] shadow-[0_0_0_3px_rgba(31,157,85,0.12)]' :
    state === 'taken' ? 'border-[#d64545] shadow-[0_0_0_3px_rgba(214,69,69,0.12)]' :
    'border-[#D6D2C7] focus-within:border-[#262624] focus-within:shadow-[0_0_0_3px_rgba(17,17,17,0.08)]'
  }`;

  const statusClass = `font-mono text-xs min-h-[1.2em] mt-2 ${
    state === 'available' ? 'text-[#1f9d55]' :
    state === 'taken' ? 'text-[#d64545]' :
    'text-[#6B6964]'
  }`;

  return (
    <div>
      <label className={fieldClass + ' max-w-[440px]'}>
        <span className="flex-1 min-w-0 flex items-center font-mono">
          {!hidePrefix && <span className="text-[13px] sm:text-sm text-[#6B6964] whitespace-nowrap">storywall.io/</span>}
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={e => setValue(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
            onKeyDown={e => e.key === 'Enter' && handleClaim()}
            placeholder="yourname"
            autoComplete="off"
            spellCheck="false"
            autoFocus={autoFocus}
            aria-label="Username"
            className="border-0 outline-none font-mono text-[13px] sm:text-sm text-[#262624] py-2 px-0.5 sm:px-1 w-full min-w-0 bg-transparent placeholder:text-[#8A877F]"
          />
        </span>
        <button
          type="button"
          onClick={handleClaim}
          disabled={state !== 'available' || claiming}
          className="flex-shrink-0 font-inter font-semibold text-[13px] sm:text-sm bg-[#262624] text-[#F4F2EC] border-0 rounded-[8px] px-3 sm:px-4 py-2.5 cursor-pointer whitespace-nowrap transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {claiming ? claimingLabel : buttonLabel}
        </button>
      </label>
      <p className={statusClass} aria-live="polite">
        {state === 'available' ? <span className="font-bold mr-1">✓</span> :
         state === 'taken' ? <span className="font-bold mr-1">✕</span> :
         state === 'checking' ? <span className="mr-1">⋯</span> : null}
        {reason || '\u00A0'}
      </p>
    </div>
  );
}