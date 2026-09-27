import { useState } from 'react';
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
          <img src="/logo-grey.png" alt="StoryWall" className="h-[22px] w-auto inline-block" />
        </div>
        {children}
      </div>
    </div>
  );
}

export function AuthInput({ label, type = 'text', value, onChange, placeholder, autoComplete, autoFocus, inputMode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">{label}</span>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        inputMode={inputMode}
        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3.5 text-gray-900 text-base outline-none focus:ring-2 focus:ring-black/20 placeholder:text-gray-400"
      />
    </label>
  );
}

export function AuthButton({ children, disabled, busy, busyLabel }) {
  return (
    <button
      type="submit"
      disabled={disabled || busy}
      className="w-full bg-black text-white py-4 rounded-2xl font-semibold text-base hover:bg-gray-900 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
    >
      {busy ? busyLabel : children}
    </button>
  );
}

// Email-code step, used after sign-up (and on sign-in if the account was
// never verified). On success, signs in with the same credentials and
// continues to `target`.
export function VerifyCodeForm({ email, password, target, onBack }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [resent, setResent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
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
    <form onSubmit={submit} className="flex flex-col gap-5">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">Check your email</h1>
        <p className="text-gray-500 text-sm mt-1">We sent a code to <span className="text-gray-700 font-medium">{email}</span>.</p>
      </div>
      <AuthInput label="Code" value={code} onChange={setCode} placeholder="Enter the code" autoComplete="one-time-code" inputMode="numeric" autoFocus />
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <AuthButton disabled={!code.trim()} busy={busy} busyLabel="Verifying…">Verify and continue</AuthButton>
      <div className="flex justify-between text-sm">
        <button type="button" onClick={onBack} className="text-gray-500 hover:text-gray-900">Use a different email</button>
        <button type="button" onClick={resend} disabled={resent} className="text-gray-900 font-medium underline disabled:no-underline disabled:text-gray-400">
          {resent ? 'Code sent' : 'Resend code'}
        </button>
      </div>
    </form>
  );
}
