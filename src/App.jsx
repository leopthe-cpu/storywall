import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import PageNotFound from './lib/PageNotFound';
import LoadingTimeout from '@/components/LoadingTimeout';
import PublicProfile from '@/pages/PublicProfile.jsx';
import Landing from '@/pages/Landing';
import SignIn from '@/pages/SignIn';
import Verify from '@/pages/Verify';
import SignUp from '@/pages/SignUp';
import ResetPassword from '@/pages/ResetPassword';
import Terms from '@/pages/Terms';
import Privacy from '@/pages/Privacy';
import Licenses from '@/pages/Licenses';
import { useState, useEffect, lazy, Suspense } from 'react';
import { getMe } from '@/api/storywallApi';
import ErrorBoundary from '@/components/ErrorBoundary';
import PageLoader from '@/components/ui/PageLoader';
import GenerationWatcher from '@/components/GenerationWatcher';

// Card lab: development-only page for checking generated card layouts. The
// import is behind import.meta.env.DEV, so it isn't part of production builds.
const CardLab = import.meta.env.DEV ? lazy(() => import('@/pages/CardLab')) : null;

// Pages loaded only when opened (performance plan §C): the builder with its
// editor, AI and export code is most of the app, and visitors to the landing
// page or a wall never need it. Each becomes its own file, fetched on first
// visit; PageLoader shows while it loads (blank for the first 0.4 s).
const StoryCreator = lazy(() => import('@/pages/StoryCreator'));
const PromptTest = lazy(() => import('@/pages/PromptTest'));
const Onboarding = lazy(() => import('@/pages/Onboarding'));
const page = (element) => <Suspense fallback={<PageLoader />}>{element}</Suspense>;

// Protects routes that require a fully onboarded (username set) user
function RequireAuth({ element }) {
  const location = useLocation();
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    getMe()
      .then(user => {
        if (!user) { setStatus('unauthed'); return; }
        if (!user.username) { setStatus('needs_onboarding'); return; }
        setStatus('ok');
      })
      .catch(() => setStatus('unauthed'));
  }, []);

  // PageLoader shows its own "Taking a while…" + Retry after 10 s.
  if (status === 'loading') return <PageLoader />;
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
      <Route path="/signin/reset" element={<ResetPassword />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/verify" element={<Verify />} />
      {/* 'terms' and 'privacy' are reserved usernames, so these can't hide a wall. */}
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />
      {/* Under /about, a reserved username, so it can never clash with a wall. */}
      <Route path="/about/licenses" element={<Licenses />} />

      {/* Onboarding */}
      <Route path="/onboarding" element={page(<Onboarding />)} />

      {/* Creator — fully onboarded users only */}
      <Route path="/create" element={<RequireAuth element={page(<StoryCreator />)} />} />

      {/* Prompt Test — admin only (page itself checks role) */}
      <Route path="/prompt-test" element={<RequireAuth element={page(<PromptTest />)} />} />

      {CardLab && <Route path="/dev/card-lab" element={<Suspense fallback={null}><CardLab /></Suspense>} />}

      {/* Public profiles */}
      <Route path="/:username" element={<PublicProfile />} />
      {/* A story's share link (decision 53): the wall, opened on that story */}
      <Route path="/:username/:storyId" element={<PublicProfile />} />

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
            {/* Inside the router: its toast's Open button navigates. */}
            <GenerationWatcher />
          </Router>
          <Toaster />
        </ErrorBoundary>
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;