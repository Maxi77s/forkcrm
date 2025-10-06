// src/components/providers/auth-provider.tsx
"use client";

import type React from "react";
import { createContext, useContext, useState, useEffect } from "react";
import {
  API_BASE,                 // misma base que usan los helpers
  ensureOperatorForUser,    // POST /operators (sin fallback)
  setOperatorState,         // PATCH /operators/:id/state
} from "@/components/helpers/helper.assign";

type AppRole = "CLIENT" | "OPERADOR" | "ADMIN";

interface User {
  id: string;
  name?: string;
  dni: number;
  role: AppRole;
  email?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (dni: number, password: string) => Promise<void>;
  register: (name: string, dni: number, password: string, role: string) => Promise<void>;
  logout: () => void;
  isTokenValid: () => boolean;
  refreshToken: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

/* ================= utils ================= */
function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.exp < Date.now() / 1000;
  } catch {
    return true;
  }
}

function normalizeRole(raw?: string): AppRole {
  const r = (raw || "").toUpperCase().trim();
  if (r.includes("ADMIN")) return "ADMIN";
  if (r.includes("OPER")) return "OPERADOR";
  return "CLIENT";
}

async function readJsonSafe(res: Response) {
  const txt = await res.text();
  try {
    return txt ? JSON.parse(txt) : {};
  } catch {
    return {};
  }
}

function extractUserLike(data: any) {
  return data?.user ?? data?.operator ?? data?.data?.user ?? data?.data?.operator ?? null;
}

function extractToken(data: any) {
  return data?.access_token ?? data?.token ?? data?.data?.access_token ?? data?.data?.token;
}

/** Por defecto NO forzar: solo crear operador si el rol es OPERADOR.
 *  Si querés forzar, poné NEXT_PUBLIC_FORCE_OPERATOR_ENSURE=1 en .env.local
 */
const FORCE_OPERATOR_ENSURE =
  (process.env.NEXT_PUBLIC_FORCE_OPERATOR_ENSURE ?? "0") === "1";

/* =============== provider =============== */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearAuth = () => {
    setUser(null);
    setToken(null);
    (["CLIENT", "OPERADOR", "ADMIN"] as AppRole[]).forEach((r) => {
      localStorage.removeItem(`authToken-${r}`);
      localStorage.removeItem(`user-${r}`);
    });
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("userId");
    localStorage.removeItem("operatorId");
  };

  const storeAuth = (u: User, tok: string) => {
    setUser(u);
    setToken(tok);
    localStorage.setItem(`authToken-${u.role}`, tok);
    localStorage.setItem(`user-${u.role}`, JSON.stringify(u));
    localStorage.setItem("token", tok);
    localStorage.setItem("user", JSON.stringify(u));
    localStorage.setItem("userId", u.id);
  };

  const isTokenValid = () => !!token && !isTokenExpired(token!);

  const refreshToken = async () => {
    if (!user || !token) return;
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Token refresh failed");
      const data = await readJsonSafe(res);
      const newToken = extractToken(data);
      if (!newToken) throw new Error("No token on refresh");
      storeAuth(user, newToken);
    } catch {
      clearAuth();
    }
  };

  useEffect(() => {
    const tryLoad = (role: AppRole) => {
      const tok = localStorage.getItem(`authToken-${role}`);
      const usr = localStorage.getItem(`user-${role}`);
      if (!tok || !usr) return false;
      try {
        const u: User = JSON.parse(usr);
        u.role = normalizeRole(u.role);
        if (!isTokenExpired(tok)) {
          storeAuth(u, tok);
          return true;
        }
      } catch {}
      return false;
    };
    if (!tryLoad("CLIENT")) if (!tryLoad("OPERADOR")) tryLoad("ADMIN");
    setIsLoading(false);
  }, []);

  /** Crea/asegura el operador en /operators y lo deja AVAILABLE (sin fallback) */
  const ensureAndBootOperator = async (
    name: string | undefined,
    dni: number,
    password: string,
    role?: string
  ) => {
    try {
      // Evitar duplicado si ya lo hicimos antes en el mismo flujo
      if (localStorage.getItem("operatorId")) return;

      const operatorId = await ensureOperatorForUser({
        name: name || "Operador Seed",
        dni,
        password: password || "Temporal-123",
        role: role || "OPERADOR",
        isAvailable: true,
      });

      localStorage.setItem("operatorId", operatorId);
      await setOperatorState(operatorId, "AVAILABLE").catch(() => {});
      console.log("[AUTH] Operator creado en /operators y puesto AVAILABLE:", operatorId);
    } catch (e: any) {
      console.error("[AUTH] ensureAndBootOperator falló:", e?.message || e);
      // Sin fallback: si rompe, preferimos visibilidad en consola.
    }
  };

  const login = async (dni: number, password: string) => {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dni, password }),
    });

    if (!response.ok) {
      const e = await readJsonSafe(response);
      throw new Error(e?.message || "Error en el login");
    }

    const data = await readJsonSafe(response);
    const tok = extractToken(data);
    if (!tok) throw new Error("No se recibió token");

    const rawUser = extractUserLike(data);
    const userData: User = {
      id: String(rawUser?.id ?? rawUser?._id ?? rawUser?.uid ?? dni),
      name: rawUser?.name,
      dni: Number(rawUser?.dni ?? dni),
      role: normalizeRole(rawUser?.role),
      email: rawUser?.email,
    };

    clearAuth();
    storeAuth(userData, tok);

    // Solo asegurar operador si es OPERADOR (o si se fuerza por flag)
    if (userData.role === "OPERADOR" || FORCE_OPERATOR_ENSURE) {
      await ensureAndBootOperator(userData.name, userData.dni, password, userData.role);
    }
  };

  const register = async (name: string, dni: number, password: string, role: string) => {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, dni, password, role }),
    });

    if (!res.ok) {
      const e = await readJsonSafe(res);
      const msg = Array.isArray(e?.message) ? e.message.join(", ") : e?.message || "Error en el registro";
      throw new Error(msg);
    }

    const data = await readJsonSafe(res);
    const tok = extractToken(data);
    const rawUser = extractUserLike(data);

    // Si /auth/register no devuelve token, hacemos login y seguimos flujo normal.
    if (!tok) {
      await login(dni, password);
      return;
    }

    const userData: User = {
      id: String(rawUser?.id ?? rawUser?._id ?? dni),
      name: rawUser?.name ?? name,
      dni: Number(rawUser?.dni ?? dni),
      role: normalizeRole(rawUser?.role ?? role),
      email: rawUser?.email,
    };

    clearAuth();
    storeAuth(userData, tok);

    if (userData.role === "OPERADOR" || FORCE_OPERATOR_ENSURE) {
      await ensureAndBootOperator(userData.name, userData.dni, password, userData.role);
    }
  };

  const logout = () => {
    localStorage.removeItem("client-chat-id");
    clearAuth();
  };

  return (
    <AuthContext.Provider
      value={{ user, token, isLoading, login, register, logout, isTokenValid, refreshToken }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
