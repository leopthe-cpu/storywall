import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { ImagePanel } from '@/components/signup/SidePanel';
import { AuthColumn, AuthInput, AuthButton, VerifyCodeForm, authErrorMessage, finishAuth } from '@/components/auth/AuthShared';

// /signup — the single entry point for "Claim your wall" (homepage field,
// username pre-filled via ?username=) and the nav's "Get started" link (no
// username yet).
//
// IMPORTANT: this page must never silently reuse an already-saved session as
// if it were a fresh sign-up — "Claim your wall" / "Get started" are
// create-account actions. If this browser already has an active session
// (e.g. a dev/test session, or a shared machine someone forgot to sign out
// of), we stop and ask explicitly instead of silently dropping the visitor
// straight into that existing account. Signing IN on purpose still works
// exactly as before via the separate /signin page.
export default function SignUp() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isAuthenticated, isLoadingAuth, logout } = useAuth();
  const username = (searchParams.get('username') || '').trim().toLowerCase();
  const [signingOut, setSigningOut] = useState(false);
  const target = username ? `/onboarding?username=${encodeURIComponent(username)}` : '/onboarding';

  // Sign-up form state (StoryWall's own split-screen sign-up, replacing the
  // hosted Base44 page). Flow: email + password → email code → onboarding.
  const [stage, setStage] = useState('form'); // 'form' | 'verify'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (username) sessionStorage.setItem('claimed_username', username);
  }, [username]);

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setBusy(true);
    setError('');
    try {
      const res = await base44.auth.register({ email: email.trim(), password });
      const token = res?.access_token || res?.data?.access_token;
      if (token) { base44.auth.setToken(token); finishAuth(target); return; }
      setStage('verify');
    } catch (err) {
      setError(authErrorMessage(err, "Couldn't create your account. Try again."));
    }
    setBusy(false);
  };

  const handleContinueAsExisting = () => navigate(target, { replace: true });

  const handleSignOutAndCreate = () => {
    setSigningOut(true);
    // Clears the session, then redirects back to this same URL — landing
    // back here with isAuthenticated now false, ready for a fresh sign-up.
    logout(true);
  };

  if (isLoadingAuth) {
    return <div className="fixed inset-0 bg-[#F7F7F5]" />;
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#F7F7F5]">
        <ImagePanel caption="Every career has a better story than its résumé." />
        <AuthColumn>
          {stage === 'verify' ? (
            <VerifyCodeForm email={email.trim()} password={password} target={target} onBack={() => setStage('form')} />
          ) : (
            <form onSubmit={handleRegister} className="flex flex-col gap-5">
              <div className="text-center">
                <h1 className="text-2xl font-bold text-gray-900">{username ? 'Claim your wall' : 'Create your account'}</h1>
                <p className="text-gray-500 text-sm mt-1">
                  {username ? `Create your account to make storywall.io/${username} yours.` : 'Next, you’ll pick your username and set up your wall.'}
                </p>
              </div>
              <AuthInput label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" autoComplete="email" autoFocus />
              <AuthInput label="Password" type="password" value={password} onChange={setPassword} placeholder="Create a password" autoComplete="new-password" />
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <AuthButton disabled={!email.trim() || !password} busy={busy} busyLabel="Creating account…">Create account</AuthButton>
              <p className="text-center text-sm text-gray-400">
                Already have an account?{' '}
                <Link to="/signin" className="text-gray-900 font-medium underline">Sign in</Link>
              </p>
            </form>
          )}
        </AuthColumn>
      </div>
    );
  }

  // Already signed in — ask explicitly instead of silently reusing the session.
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#F7F7F5] px-6 text-center">
      <div className="w-full max-w-sm">
        <img src="/logo-grey.png" alt="StoryWall" className="h-[22px] w-auto inline-block mb-6" />
        <h1 className="text-xl font-bold text-gray-900">You're already signed in</h1>
        <p className="text-gray-500 text-sm mt-2">
          {user?.username ? (
            <>This browser is signed in as <span className="font-medium text-gray-700">@{user.username}</span>.</>
          ) : (
            "This browser is already signed in to a StoryWall account."
          )}
        </p>

        <div className="flex flex-col gap-3 mt-6">
          <button
            onClick={handleContinueAsExisting}
            className="w-full bg-black text-white py-4 rounded-2xl font-semibold text-base hover:bg-gray-900 active:scale-[0.98] transition-all"
          >
            Continue as {user?.username ? `@${user.username}` : 'this account'}
          </button>
          <button
            onClick={handleSignOutAndCreate}
            disabled={signingOut}
            className="w-full border border-gray-200 text-gray-700 py-4 rounded-2xl font-semibold text-base hover:bg-gray-100 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {signingOut ? 'Signing out…' : 'Sign out & create a new account'}
          </button>
        </div>

        <p className="text-center text-sm text-gray-400 mt-6">
          Meant to sign in instead?{' '}
          <Link to="/signin" className="text-gray-900 font-medium underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
