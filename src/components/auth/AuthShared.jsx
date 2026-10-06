import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';

// Shared pieces for StoryWall's own sign-in / sign-up screens (split-screen
// layout; replaces Base44's hosted login page, which can't be styled).
// Auth itself still goes through Base44 via the SDK: register → email code
// (verifyOtp) → loginViaEmailPassword.

export function authErrorMessage(err, fallback = 'Something went wrong. Try again.') {
  return (
    err?.data?.detail ||
    err?.data?.message ||
    err?.response?.data?.detail ||
    err?.response?.data?.message ||
    (typeof err?.message === 'string' && !/status code \d+/i.test(err.message) ? err.message : '') ||
    fallback
  );
}

// Full reload (not SPA navigate) so AuthContext re-reads the new session.
export function finishAuth(target) {
  window.location.assign(target);
}

// Left-column wrapper: form centred in the left half on desktop, full width on mobile.
export function AuthColumn({ children }) {
  return (
    <div className="min-h-screen md:w-1/2 flex flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link to="/" aria-label="Back to the StoryWall home page" className="inline-block"><img src="/logo-slash-ink.png" alt="StoryWall" className="h-[22px] w-auto inline-block" /></Link>
        </div>
        {children}
      </div>
    </div>
  );
}

// Full-viewport photo background used by the standalone auth screens (email
// code, already-signed-in). Same treatment on mobile and desktop — unlike
// AuthColumn's split panel, which is desktop-only.
//
// `footer`, when given, is rendered directly below `children` (a
// composer-style action bar), and the whole group is anchored toward the
// bottom of the viewport instead of being vertically centred — keeps the
// gap between the message and the bar small and consistent.
export function FullBleedAuthScreen({ children, footer }) {
  return (
    <div className="fixed inset-0 overflow-hidden bg-[#262624]">
      <img
        src="/auth/signin-bg.jpg"
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#262624]/55 via-[#262624]/45 to-[#262624]/65" />
      <div
        className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 py-16 text-center"
      >
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <Link to="/" aria-label="Back to the StoryWall home page" className="inline-block"><img src="/logo-slash-light.png" alt="StoryWall" className="h-[22px] w-auto inline-block" /></Link>
          </div>
          {children}
          {footer && <div className="mt-6">{footer}</div>}
        </div>
      </div>
    </div>
  );
}

export function AuthInput({ label, type = 'text', value, onChange, placeholder, autoComplete, autoFocus, inputMode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-[#6B6964] uppercase tracking-wider mb-2 block">{label}</span>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        inputMode={inputMode}
        className="w-full bg-[#FAF9F5] border border-[#D6D2C7] rounded-xl px-4 py-3.5 text-[#262624] text-base outline-none focus:ring-2 focus:ring-[#262624]/20 placeholder:text-[#8A877F]"
      />
    </label>
  );
}

export function AuthButton({ children, disabled, busy, busyLabel }) {
  return (
    <button
      type="submit"
      disabled={disabled || busy}
      className="w-full bg-[#262624] text-[#F4F2EC] py-4 rounded-2xl font-semibold text-base hover:bg-[#262624] active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
    >
      {busy ? busyLabel : children}
    </button>
  );
}

// Apple-style boxed OTP entry: one big, clearly-tappable slot per digit,
// instead of a plain text input. Supports typing, backspace-to-previous,
// and pasting the whole code into any slot.
export function OtpInput({ value, onChange, length = 6, autoFocus }) {
  const refs = useRef([]);
  const digits = (value || '').split('').concat(Array(length).fill('')).slice(0, length);

  const commit = (next) => onChange(next.join('').slice(0, length));

  const handleChange = (i, e) => {
    const raw = e.target.value.replace(/\D/g, '');
    if (!raw) {
      const next = digits.slice();
      next[i] = '';
      commit(next);
      return;
    }
    // Typing one digit, or pasting several into a single slot.
    const next = digits.slice();
    for (let j = 0; j < raw.length && i + j < length; j++) next[i + j] = raw[j];
    commit(next);
    const lastFilled = Math.min(i + raw.length, length - 1);
    refs.current[lastFilled]?.focus();
    refs.current[lastFilled]?.select?.();
  };

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      refs.current[i - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus();
    if (e.key === 'ArrowRight' && i < length - 1) refs.current[i + 1]?.focus();
  };

  return (
    <div className="flex justify-center gap-2 sm:gap-2.5" role="group" aria-label="Verification code">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={el => (refs.current[i] = el)}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={length}
          value={d}
          autoFocus={autoFocus && i === 0}
          onChange={e => handleChange(i, e)}
          onKeyDown={e => handleKeyDown(i, e)}
          aria-label={`Digit ${i + 1}`}
          className="w-11 h-14 sm:w-13 sm:h-16 text-center text-3xl font-semibold rounded-xl border border-[#F4F2EC]/25 bg-[#FAF9F5]/95 text-[#262624] outline-none shadow-sm focus:ring-2 focus:ring-[#F4F2EC] focus:border-[#F4F2EC]/80 transition-all"
        />
      ))}
    </div>
  );
}

// Email-code step, used after sign-up (and on sign-in if the account was
// never verified). On success, signs in with the same credentials and
// continues to `target`. Renders as its own full-bleed screen (not nested
// inside AuthColumn) so it matches the already-signed-in screen.
export function VerifyCodeForm({ email, password, target, onBack }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [resent, setResent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (code.trim().length < 4) return;
    setBusy(true);
    setError('');
    try {
      const res = await base44.auth.verifyOtp({ email, otpCode: code.trim() });
      const token = res?.access_token || res?.data?.access_token;
      if (token) base44.auth.setToken(token);
      else await base44.auth.loginViaEmailPassword(email, password);
      finishAuth(target);
    } catch (err) {
      setError(authErrorMessage(err, "That code didn't work. Check it and try again."));
      setBusy(false);
    }
  };

  const resend = async () => {
    setError('');
    try {
      await base44.auth.resendOtp(email);
      setResent(true);
    } catch (err) {
      setError(authErrorMessage(err, "Couldn't resend the code. Try again in a minute."));
    }
  };

  return (
    <FullBleedAuthScreen>
      <form onSubmit={submit} className="flex flex-col gap-6">
        <div>
          <h1 className="font-display text-[28px] leading-tight font-medium text-[#F4F2EC]">Check your email</h1>
          <p className="text-[#F4F2EC]/75 text-sm mt-1">We sent a code to <span className="text-[#F4F2EC] font-medium">{email}</span>.</p>
        </div>
        <OtpInput value={code} onChange={setCode} length={6} autoFocus />
        {error && <p className="text-red-300 text-sm">{error}</p>}
        <AuthButton disabled={code.trim().length < 4} busy={busy} busyLabel="Verifying…">Verify and continue</AuthButton>
        <div className="flex justify-between text-sm">
          <button type="button" onClick={onBack} className="text-[#F4F2EC]/70 hover:text-[#F4F2EC] transition-colors">Use a different email</button>
          <button type="button" onClick={resend} disabled={resent} className="text-[#F4F2EC] font-medium underline disabled:no-underline disabled:text-[#F4F2EC]/50">
            {resent ? 'Code sent' : 'Resend code'}
          </button>
        </div>
      </form>
    </FullBleedAuthScreen>
  );
}
