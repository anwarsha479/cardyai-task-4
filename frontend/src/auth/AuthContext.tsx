import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, onUnauthorized, setAuthToken } from '../api/client';
import type { LoginResponse, UserView } from '../api/types';

const TOKEN_KEY = 'library-lending.token';

interface AuthState {
  user: UserView | null;
  loading: boolean;
  login(email: string, password: string): Promise<void>;
  logout(): void;
}

const AuthContext = createContext<AuthState | null>(null);

function readStoredToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function storeToken(token: string | null): void {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage unavailable (private mode): the session simply lasts until the tab is reloaded.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserView | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    storeToken(null);
    setAuthToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    onUnauthorized(logout);
    const saved = readStoredToken();
    if (!saved) {
      setLoading(false);
      return;
    }
    setAuthToken(saved);
    api<UserView>('/auth/me')
      .then(setUser)
      .catch(logout)
      .finally(() => setLoading(false));
  }, [logout]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await api<LoginResponse>('/auth/login', { method: 'POST', body: { email, password } });
    storeToken(result.accessToken);
    setAuthToken(result.accessToken);
    setUser(result.user);
  }, []);

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
