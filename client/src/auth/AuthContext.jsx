import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('renttrack_token'));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    api
      .whoami(token)
      .then(setUser)
      .catch(() => {
        setToken(null);
        localStorage.removeItem('renttrack_token');
      })
      .finally(() => setLoading(false));
  }, [token]);

  function loginLandlord(tokenValue, userValue) {
    localStorage.setItem('renttrack_token', tokenValue);
    setToken(tokenValue);
    setUser(userValue);
  }

  function loginTenant(tokenValue, tenantValue) {
    localStorage.setItem('renttrack_token', tokenValue);
    setToken(tokenValue);
    setUser(tenantValue);
  }

  function logout() {
    localStorage.removeItem('renttrack_token');
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ token, user, loading, loginLandlord, loginTenant, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
