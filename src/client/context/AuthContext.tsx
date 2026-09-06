// Authentication & User State Context

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '../../types/index.js';
import { api, getStoredToken } from '../services/api.js';

interface AuthContextType {
  user: User | null;
  quota: { canCreate: boolean; used: number; limit: number; plan: string } | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string, agencyName?: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  updateProfile: (data: { fullName?: string; agencyName?: string; agencyLogo?: string; accentColor?: string }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [quota, setQuota] = useState<{ canCreate: boolean; used: number; limit: number; plan: string } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshUser = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      setQuota(null);
      setLoading(false);
      return;
    }

    try {
      const res = await api.getMe();
      setUser(res.user);
      setQuota(res.quota);
    } catch (err) {
      console.error('Failed to load user session:', err);
      api.logout();
      setUser(null);
      setQuota(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    const res = await api.login({ email, password });
    setUser(res.user);
    await refreshUser();
  };

  const register = async (email: string, password: string, fullName: string, agencyName?: string) => {
    const res = await api.register({ email, password, fullName, agencyName });
    setUser(res.user);
    await refreshUser();
  };

  const logout = () => {
    // Revoke the server-side session before clearing local state; the token is
    // invalidated server-side even if the local clear is interrupted.
    api.revokeSession().finally(() => {
      api.logout();
      setUser(null);
      setQuota(null);
    });
  };

  const updateProfile = async (data: { fullName?: string; agencyName?: string; agencyLogo?: string; accentColor?: string }) => {
    const res = await api.updateProfile(data);
    setUser(res.user);
    await refreshUser();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        quota,
        loading,
        login,
        register,
        logout,
        refreshUser,
        updateProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
