import React, { createContext, useState, useContext, useEffect } from 'react';
import { getMe, signOut } from '@/api/storywallApi';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [timedOut, setTimedOut] = useState(false);

  const checkAppState = async () => {
    setTimedOut(false);
    setIsLoadingAuth(true);
    let done = false;
    const t = setTimeout(() => { if (!done) { setTimedOut(true); setIsLoadingAuth(false); } }, 10000);
    try {
      const currentUser = await getMe();
      done = true; clearTimeout(t);
      setUser(currentUser);
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
    } catch (error) {
      done = true; clearTimeout(t);
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      // Surface "user not registered" so the UI can show the right screen;
      // any other error (no token / unauthenticated) just means anonymous.
      if (error?.status === 403 && error?.data?.extra_data?.reason === 'user_not_registered') {
        setAuthError({ type: 'user_not_registered', message: 'User not registered for this app' });
      }
    }
  };

  useEffect(() => {
    checkAppState();
  }, []);

  // Like Base44's logout, always ends with a full page load of the current
  // URL, so every screen re-reads the (now signed-out) session.
  const logout = async () => {
    setUser(null);
    setIsAuthenticated(false);
    await signOut().catch((e) => console.error('Sign-out failed', e));
    window.location.assign(window.location.href);
  };

  // Base44 sent people to its hosted login page; ours is /signin.
  const navigateToLogin = () => {
    window.location.assign('/signin');
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      authError,
      timedOut,
      logout,
      navigateToLogin,
      checkAppState
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};