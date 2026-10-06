import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { ImagePanel } from '@/components/signup/SidePanel';
import { AuthColumn, AuthInput, AuthButton, VerifyCodeForm, FullBleedAuthScreen, authErrorMessage, finishAuth } from '@/components/auth/AuthShared';
import { LogOut } from 'lucide-react';
import useDocumentTitle from '@/lib/useDocumentTitle';

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
  useDocumentTitle('Sign Up | storywall');
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
    return <div className="fixed inset-0 bg-[#F4F2EC]" />;
  }

  if (!isAuthenticated) {
    // The email-code step renders itself as a standalone full-bleed screen,
    // so it's returned outside the split-screen form layout below.
    if (stage === 'verify') {
      return <VerifyCodeForm email={email.trim()} password={password} target={target} onBack={() => setStage('form')} />;
    }
    return (
      <div className="min-h-screen bg-[#F4F2EC]">
        <ImagePanel caption="The space for your career stories." />
        <AuthColumn>
          <form onSubmit={handleRegister} className="flex flex-col gap-5">
            <div className="text-center">
              <h1 className="font-display text-[28px] leading-tight font-medium text-[#262624]">{username ? 'Claim your wall' : 'Create your account'}</h1>
              <p className="text-[#6B6964] text-sm mt-1">
                {username ? `Create your account to make storywall.io/${username} yours.` : 'Next, you’ll pick your username and set up your wall.'}
              </p>
            </div>
            <AuthInput label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" autoComplete="email" autoFocus />
            <AuthInput label="Password" type="password" value={password} onChange={setPassword} placeholder="Create a password" autoComplete="new-password" />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <AuthButton disabled={!email.trim() || !password} busy={busy} busyLabel="Creating account…">Create account</AuthButton>
            <p className="text-center text-sm text-[#8A877F]">
              Already have an account?{' '}
              <Link to="/signin" className="text-[#262624] font-medium underline">Sign in</Link>
            </p>
          </form>
        </AuthColumn>
      </div>
    );
  }

  // Already signed in — ask explicitly instead of silently reusing the
  // session. Full-bleed photo background (same image as the email-code
  // screen), message centred on the image, and a composer-style action bar
  // anchored to the bottom of the screen, floating over it.
  return (
    <FullBleedAuthScreen
      footer={
        <>
          <div className="flex items-center gap-2 bg-[#FAF9F5]/95 backdrop-blur rounded-2xl p-2 shadow-2xl">
            <button
              onClick={handleSignOutAndCreate}
              disabled={signingOut}
              title="Sign out & create a new account"
              aria-label="Sign out & create a new account"
              className="group/logout shrink-0 h-12 w-12 hover:w-32 rounded-xl flex items-center justify-start gap-2 px-3.5 text-[#6B6964] hover:bg-[#ECE9E1] hover:text-[#262624] active:scale-[0.96] transition-all duration-300 ease-out disabled:opacity-40 overflow-hidden"
            >
              <LogOut className="w-5 h-5 shrink-0" strokeWidth={2} />
              <span className="max-w-0 group-hover/logout:max-w-[4.5rem] overflow-hidden whitespace-nowrap text-sm font-semibold transition-all duration-300 ease-out">
                Log out
              </span>
            </button>
            <button
              onClick={handleContinueAsExisting}
              className="flex-1 min-w-0 h-12 px-4 bg-[#262624] text-[#F4F2EC] rounded-xl font-semibold text-base hover:bg-[#262624] active:scale-[0.98] transition-all whitespace-nowrap overflow-hidden text-ellipsis"
            >
              Continue as {user?.username ? `@${user.username}` : 'this account'}
            </button>
          </div>
          <p className="text-center text-sm text-[#F4F2EC]/70 mt-4">
            {signingOut ? (
              'Signing out…'
            ) : (
              <>
                Meant to sign in instead?{' '}
                <Link to="/signin" className="text-[#F4F2EC] font-medium underline">Sign in</Link>
              </>
            )}
          </p>
        </>
      }
    >
      <div>
        <h1 className="font-display text-[26px] leading-tight font-medium text-[#F4F2EC]">You're already signed in</h1>
        <p className="text-[#F4F2EC]/75 text-sm mt-2">
          {user?.username ? (
            <>This browser is signed in as <span className="font-medium text-[#F4F2EC]">@{user.username}</span>.</>
          ) : (
            "This browser is already signed in to a StoryWall account."
          )}
        </p>
      </div>
    </FullBleedAuthScreen>
  );
}
