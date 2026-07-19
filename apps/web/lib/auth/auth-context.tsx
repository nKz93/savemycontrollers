"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { AuthenticatedUserDto } from "@smc/api-client";
import { api, resetCsrfToken } from "../api/browser-client.js";

interface AuthContextValue {
  user: AuthenticatedUserDto | null;
  loading: boolean;
  /** Recharge le profil depuis l'API (ex. apres connexion/inscription). */
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * L'etat de connexion n'est JAMAIS lu depuis un cookie cote client (les
 * cookies de session sont HttpOnly, invisibles en JavaScript par
 * conception — voir ADR-019). La seule source de verite est un appel
 * reel a GET /profile : s'il reussit, l'utilisateur est connecte ; une
 * reponse 401 signifie qu'il ne l'est pas.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthenticatedUserDto | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await api.GET("/profile");
      setUser(error ? null : (data as AuthenticatedUserDto));
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    await api.POST("/auth/logout");
    resetCsrfToken();
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, loading, refresh, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit etre utilise a l'interieur de <AuthProvider>.");
  return ctx;
}
