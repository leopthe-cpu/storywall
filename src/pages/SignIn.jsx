import { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { ImagePanel } from '@/components/signup/SidePanel';
import { AuthColumn, AuthInput, AuthButton, VerifyCodeForm, authErrorMessage, finishAuth } from '@/components/auth/AuthShared';
import useDocumentTitle from '@/lib/useDocumentTitle';

// Sign-in page at /signin — StoryWall's own split-screen sign-in (replaces
// Base44's hosted login page). After login, the user is returned to the
// `from` path (passed via navigation state by RequireAuth), else /onboarding
// (which forwards already-onboarded users to their profile).
export default function SignIn() {
  useDocumentTitle('Sign In | storywall');
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const from = location.state?.from || '/onboarding';

  const [stage, setStage] = useState('form'); // 'form' | 'verify'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Already signed in — nothing to do here.
  useEffect(() => {
    if (!isLoadingAuth && isAuthenticated) navigate(from, { replace: true });
  }, [isLoadingAuth, isAuthenticated, from, navigate]);

  const handleSignIn = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setBusy(true);
    setError('');
    try {
      await base44.auth.loginViaEmailPassword(email.trim(), password);
      finishAuth(from);
      return;
    } catch (err) {
      const msg = authErrorMessage(err, "Couldn't sign you in. Try again.");
      // Account exists but its email was never confirmed — send a fresh code.
      if (/verif|confirm/i.test(msg)) {
        try { await base44.auth.resendOtp(email.trim()); } catch { /* shown on the code screen via resend */ }
        setStage('verify');
      } else {
        setError(msg);
      }
    }
    setBusy(false);
  };

  // Password reset still uses Base44's hosted flow.
  const handleForgot = () => base44.auth.redirectToLogin(window.location.origin + from);

  if (isLoadingAuth || isAuthenticated) {
    return <div className="fixed inset-0 bg-[#F4F2EC]" />;
  }

  // The email-code step renders itself as a standalone full-bleed screen,
  // so it's returned outside the split-screen form layout below.
  if (stage === 'verify') {
    return <VerifyCodeForm email={email.trim()} password={password} target={from} onBack={() => setStage('form')} />;
  }

  return (
    <div className="min-h-screen bg-[#F4F2EC]">
      <ImagePanel caption="Your wall is waiting." />
      <AuthColumn>
        <form onSubmit={handleSignIn} className="flex flex-col gap-5">
          <div className="text-center">
            <h1 className="font-display text-[28px] leading-tight font-medium text-[#262624]">Welcome back</h1>
            <p className="text-[#6B6964] text-sm mt-1">Sign in to your wall.</p>
          </div>
          <AuthInput label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" autoComplete="email" autoFocus />
          <AuthInput label="Password" type="password" value={password} onChange={setPassword} placeholder="Your password" autoComplete="current-password" />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <AuthButton disabled={!email.trim() || !password} busy={busy} busyLabel="Signing in…">Sign in</AuthButton>
          <div className="flex justify-between text-sm">
            <button type="button" onClick={handleForgot} className="text-[#6B6964] hover:text-[#262624]">Forgot password?</button>
            <span className="text-[#8A877F]">
              New here? <Link to="/signup" className="text-[#262624] font-medium underline">Sign up</Link>
            </span>
          </div>
        </form>
      </AuthColumn>
    </div>
  );
}
