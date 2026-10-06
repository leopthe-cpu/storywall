import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import PageNotFound from './lib/PageNotFound';
import LoadingTimeout from '@/components/LoadingTimeout';
import PublicProfile from '@/pages/PublicProfile.jsx';
import StoryCreator from '@/pages/StoryCreator';
import PromptTest from '@/pages/PromptTest';
import Landing from '@/pages/Landing';
import SignIn from '@/pages/SignIn';
import Verify from '@/pages/Verify';
import Onboarding from '@/pages/Onboarding';
import SignUp from '@/pages/SignUp';
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import ErrorBoundary from '@/components/ErrorBoundary';
import PixelSpinner from '@/components/ui/PixelSpinner';

// Protects routes that require a fully onboarded (username set) user
function RequireAuth({ element }) {
  const location = useLocation();
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let done = false;
    const t = setTimeout(() => { if (!done) setStatus('timeout'); }, 10000);
    base44.auth.me()
      .then(user => {
        done = true; clearTimeout(t);
        if (!user) { setStatus('unauthed'); return; }
        if (!user.username) { setStatus('needs_onboarding'); return; }
        setStatus('ok');
      })
      .catch(() => { done = true; clearTimeout(t); setStatus('unauthed'); });
    return () => clearTimeout(t);
  }, []);

  if (status === 'loading') {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white">
        <PixelSpinner size={24} />
      </div>
    );
  }
  if (status === 'timeout') return <LoadingTimeout />;
  if (status === 'unauthed') return <Navigate to="/signin" state={{ from: location.pathname }} replace />;
  if (status === 'needs_onboarding') return <Navigate to="/onboarding" replace />;
  return element;
}

const AuthenticatedApp = () => {
  const { isLoadingAuth, authError, timedOut, checkAppState } = useAuth();

  if (timedOut) {
    return <LoadingTimeout onRetry={checkAppState} />;
  }

  if (authError?.type === 'user_not_registered') return <UserNotRegisteredError />;

  return (
    <Routes>
      {/* Entry / auth */}
      <Route path="/" element={<Landing />} />
      <Route path="/signin" element={<SignIn />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/verify" element={<Verify />} />

      {/* Onboarding */}
      <Route path="/onboarding" element={<Onboarding />} />

      {/* Creator — fully onboarded users only */}
      <Route path="/create" element={<RequireAuth element={<StoryCreator />} />} />

      {/* Prompt Test — admin only (page itself checks role) */}
      <Route path="/prompt-test" element={<RequireAuth element={<PromptTest />} />} />

      {/* Public profiles */}
      <Route path="/:username" element={<PublicProfile />} />

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <ErrorBoundary>
          <Router>
            <AuthenticatedApp />
          </Router>
          <Toaster />
        </ErrorBoundary>
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;