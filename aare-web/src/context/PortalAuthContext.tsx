"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import {
  clearPortalToken,
  portalGetMe,
  portalLogin,
  portalMeFromAuth,
  portalRegister,
  setPortalToken,
  type PortalMe,
  PORTAL_TOKEN_KEY,
} from "@/lib/portal";

type PortalAuthContextValue = {
  me: PortalMe | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: {
    email: string;
    password: string;
    fullName: string;
    phone: string;
    phoneCountry: string;
    countryOfResidency: string;
  }) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
};

const PortalAuthContext = createContext<PortalAuthContextValue | null>(null);

export function PortalAuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<PortalMe | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const token = typeof window !== "undefined" ? localStorage.getItem(PORTAL_TOKEN_KEY) : null;
    if (!token) {
      setMe(null);
      setLoading(false);
      return;
    }
    try {
      setMe(await portalGetMe());
    } catch {
      clearPortalToken();
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await portalLogin(email, password);
    setPortalToken(res.token);
    setMe(portalMeFromAuth(res));
  }, []);

  const register = useCallback(
    async (payload: {
      email: string;
      password: string;
      fullName: string;
      phone: string;
      phoneCountry: string;
      countryOfResidency: string;
    }) => {
      const res = await portalRegister(payload);
      setPortalToken(res.token);
      setMe(portalMeFromAuth(res));
    },
    []
  );

  const logout = useCallback(() => {
    clearPortalToken();
    setMe(null);
  }, []);

  return (
    <PortalAuthContext.Provider value={{ me, loading, login, register, logout, refresh }}>
      {children}
    </PortalAuthContext.Provider>
  );
}

export function usePortalAuth() {
  const ctx = useContext(PortalAuthContext);
  if (!ctx) throw new Error("usePortalAuth must be used within PortalAuthProvider");
  return ctx;
}
