import { createContext, useContext, useEffect, useState } from 'react';
import { getSession, onAuthStateChange } from '../services/authService';

const AuthContext = createContext({
  user: null,
  session: null,
  loading: true,
  signOut: () => {},
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    const initAuth = async () => {
      try {
        const { session: initialSession } = await getSession();
        setSession(initialSession);
        setUser(initialSession?.user ?? null);
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // Listen for auth changes
    const { data: authListener } = onAuthStateChange((event, session) => {
      console.log('Auth event:', event);
      // Token refresh on tab focus must not replace `user` — that retriggers plan hydration
      // and flashes the full-page loader even though the account did not change.
      if (event === 'TOKEN_REFRESHED') {
        setSession(session);
        setLoading(false);
        return;
      }
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const value = {
    user,
    session,
    loading,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
