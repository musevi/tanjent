import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getMe, UserOut } from '../api/auth';

interface AuthContextValue {
  user: UserOut | null;
  token: string | null;
  isLoading: boolean;
  setToken: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(
    () => localStorage.getItem('token')
  );
  const [user, setUser] = useState<UserOut | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const setToken = (t: string) => {
    localStorage.setItem('token', t);
    setTokenState(t);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setTokenState(null);
    setUser(null);
  };

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }
    getMe()
      .then((r) => setUser(r.data))
      .catch(() => logout())
      .finally(() => setIsLoading(false));
  }, [token]);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, setToken, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
