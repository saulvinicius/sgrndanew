import React, { createContext, useCallback, useContext, useState } from 'react';
import { apiRequest, setOwnerToken } from '../lib/api.ts';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'superadmin';
}

export interface AuthBusiness {
  id: string;
  name: string;
  slug: string;
  segment: string;
  phone: string;
  address: string;
  logo_url: string;
  description: string;
  timezone: string;
  status: 'onboarding' | 'active' | 'suspended' | 'deleted';
  min_advance_minutes: number;
  max_future_days: number;
}

interface AuthContextValue {
  user: AuthUser | null;
  business: AuthBusiness | null;
  setSession: (token: string, user: AuthUser, business: AuthBusiness | null) => void;
  updateBusiness: (business: AuthBusiness) => void;
  refreshMe: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [business, setBusiness] = useState<AuthBusiness | null>(null);

  const setSession = useCallback(
    (token: string, nextUser: AuthUser, nextBusiness: AuthBusiness | null) => {
      setOwnerToken(token);
      setUser(nextUser);
      setBusiness(nextBusiness);
    },
    [],
  );

  const updateBusiness = useCallback((nextBusiness: AuthBusiness) => {
    setBusiness(nextBusiness);
  }, []);

  const refreshMe = useCallback(async () => {
    const res = await apiRequest<{ user: AuthUser; business: AuthBusiness | null }>('/api/auth/me');
    setUser(res.user);
    setBusiness(res.business);
  }, []);

  const logout = useCallback(() => {
    setOwnerToken(null);
    setUser(null);
    setBusiness(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, business, setSession, updateBusiness, refreshMe, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
