import { useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { ImagePanel } from '@/components/signup/SidePanel';
import { AuthColumn, AuthInput, AuthButton, OtpInput, authErrorMessage, finishAuth } from '@/components/auth/AuthShared';
import { requestPasswordReset, verifyPasswordResetCode, setNewPassword } from '@/api/storywallApi';
import useDocumentTitle from '@/lib/useDocumentTitle';

// /signin/reset — "Forgot password?" by email code (replaces Base44's hosted
// reset page; code instead of a link, approved by Oz). Two-part path so it
// can never clash with a wall at /<username>.
// Flow: email → 6-digit code + new password → signed in → back to `from`.
export default function ResetPassword() {
  useDocumentTitle('Reset Password | storywall');
  const location = useLocation();
  const from = location.state?.from || '/onboarding';

  const [stage, setStage] = useState('email'); // 'email' | 'code'
  const [email, setEmail] = useState(location.state?.email || '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  // Once the code is accepted the user holds a recovery session; if only
  // the new password is refused (too short, same as before), retrying must
  // not ask Supabase to check the already-used code again.
  const [codeAccepted, setCodeAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [resent, setResent] = useState(false);

  const sendCode = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setError('');
    try {
      await requestPasswordReset(email.trim());
      setStage('code');
    } catch (err) {
      setError(authErrorMessage(err, "Couldn't send the code. Try again."));
    }
    setBusy(false);
  };

  const resend = async () => {
    setError('');
    try {
      await requestPasswordReset(email.trim());
      setResent(true);
    } catch (err) {
      setError(authErrorMessage(err, "Couldn't resend the code. Try again in a minute."));
    }
  };

  const saveNewPassword = async (e) => {
    e.preventDefault();
    if (code.length < 6 || !password) return;
    setBusy(true);
    setError('');
    try {
      if (!codeAccepted) {
        await verifyPasswordResetCode(email.trim(), code);
        setCodeAccepted(true);
      }
      await setNewPassword(password);
      finishAuth(from);
      return;
    } catch (err) {
      setError(authErrorMessage(err, "Couldn't change your password. Try again."));
    }
    setBusy(false);
  };

  return (
    <div className="min-h-screen bg-[#F4F2EC]">
      <ImagePanel caption="Your wall is waiting." />
      <AuthColumn>
        {stage === 'email' ? (
          <form onSubmit={sendCode} className="flex flex-col gap-5">
            <div className="text-center">
              <h1 className="font-display text-[28px] leading-tight font-medium text-[#262624]">Reset your password</h1>
              <p className="text-[#6B6964] text-sm mt-1">We'll email you a code to choose a new one.</p>
            </div>
            <AuthInput label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" autoComplete="email" autoFocus />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <AuthButton disabled={!email.trim()} busy={busy} busyLabel="Sending…">Send code</AuthButton>
            <div className="text-center text-sm">
              <Link to="/signin" state={{ from }} className="text-[#6B6964] hover:text-[#262624]">Back to sign in</Link>
            </div>
          </form>
        ) : (
          <form onSubmit={saveNewPassword} className="flex flex-col gap-5">
            <div className="text-center">
              <h1 className="font-display text-[28px] leading-tight font-medium text-[#262624]">Check your email</h1>
              <p className="text-[#6B6964] text-sm mt-1">
                If there's an account for <span className="text-[#262624] font-medium">{email.trim()}</span>, we sent it a code.
              </p>
            </div>
            {!codeAccepted && <OtpInput value={code} onChange={setCode} length={6} autoFocus light />}
            <AuthInput label="New password" type="password" value={password} onChange={setPassword} placeholder="Choose a new password" autoComplete="new-password" />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <AuthButton disabled={code.length < 6 || !password} busy={busy} busyLabel="Saving…">Save new password</AuthButton>
            <div className="flex justify-between text-sm">
              <button type="button" onClick={() => { setStage('email'); setCode(''); setError(''); setResent(false); setCodeAccepted(false); }} className="text-[#6B6964] hover:text-[#262624]">Use a different email</button>
              {!codeAccepted && (
                <button type="button" onClick={resend} disabled={resent} className="text-[#262624] font-medium underline disabled:no-underline disabled:text-[#8A877F]">
                  {resent ? 'Code sent' : 'Resend code'}
                </button>
              )}
            </div>
          </form>
        )}
      </AuthColumn>
    </div>
  );
}
