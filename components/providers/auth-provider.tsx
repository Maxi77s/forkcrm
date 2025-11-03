// src/components/providers/auth-provider.tsx
"use client";

import type React from "react";
import { createContext, useContext, useState, useEffect } from "react";

import {
  setOperatorState,
  createOperatorDirect,
} from "@/components/helpers/helper.assign";

import {
  getHttpBase,
  getAuthLoginPath,
  getAuthRegisterPath,
  getAuthRefreshPath,
} from "@/lib/env.client";

/* ================= Tipos ================= */
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
  register: (
    name: string,
    dni: number,
    password: string,
    role: string,
    email?: string
  ) => Promise<void>;
  logout: () => void;
  isTokenValid: () => boolean;
  refreshToken: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined
);

/* ================= Utils ================= */
function isTokenExpired(token?: string | null): boolean {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split(".")[1] || ""));
    const exp = Number(payload?.exp);
    if (!Number.isFinite(exp)) return false; // si no hay exp, no lo tratamos como expirado
    return exp < Date.now() / 1000;
  } catch {
    return false; // tolerante si no es JWT clásico
  }
}

function normalizeRole(raw?: string): AppRole {
  const r = (raw || "").toUpperCase().trim();
  if (r.includes("ADMIN")) return "ADMIN";
  if (r.includes("OPER")) return "OPERADOR";
  return "CLIENT";
}

async function readJsonSafe(res: Response) {
  const txt = await res.text().catch(() => "");
  try {
    return txt ? JSON.parse(txt) : {};
  } catch {
    return {};
  }
}

function extractUserLike(data: any) {
  return (
    data?.user ??
    data?.operator ??
    data?.data?.user ??
    data?.data?.operator ??
    data?.profile ??
    null
  );
}

function extractToken(data: any) {
  return (
    data?.access_token ??
    data?.token ??
    data?.jwt ??
    data?.accessToken ??
    data?.data?.access_token ??
    data?.data?.token ??
    data?.data?.jwt ??
    null
  );
}

/** Si seteás 1 en env, fuerza asegurar operador tras login aunque el rol no sea OPERADOR */
const FORCE_OPERATOR_ENSURE =
  (process.env.NEXT_PUBLIC_FORCE_OPERATOR_ENSURE ?? "0") === "1";

/* =============== Provider =============== */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /* ---------- storage helpers (alineados a helper.assign.ts) ---------- */
  const clearAuth = () => {
    setUser(null);
    setToken(null);
    try {
      (["CLIENT", "OPERADOR", "ADMIN"] as AppRole[]).forEach((r) => {
        localStorage.removeItem(`authToken-${r}`);
        localStorage.removeItem(`user-${r}`);
      });
      localStorage.removeItem("token");
      localStorage.removeItem("AUTH_TOKEN");
      localStorage.removeItem("jwt");
      localStorage.removeItem("auth");
      localStorage.removeItem("user");
      localStorage.removeItem("userId");

      // 🚫 Importante: NO borrar operatorId ni user-OPERADOR
      // localStorage.removeItem("operatorId");
      // localStorage.removeItem("user-OPERADOR");
    } catch {}
  };

  const storeAuth = (u: User, tok: string, rawResp?: any) => {
    setUser(u);
    setToken(tok);

    // Claves que leen tus helpers
    localStorage.setItem(`authToken-${u.role}`, tok);
    localStorage.setItem(`user-${u.role}`, JSON.stringify(u));

    localStorage.setItem("token", tok);
    localStorage.setItem("AUTH_TOKEN", tok);
    localStorage.setItem("jwt", tok);
    localStorage.setItem("user", JSON.stringify(u));
    localStorage.setItem("userId", u.id);

    // Objeto "auth" de compatibilidad
    const operatorId =
      String(
        rawResp?.operatorId ??
          rawResp?.operator?.id ??
          rawResp?.operator?._id ??
          u?.id
      ) || undefined;

    const authObj: Record<string, any> = {
      token: tok,
      accessToken: tok,
      jwt: tok,
      user: {
        id: u.id,
        dni: u.dni,
        role: u.role,
        name: u.name,
        email: u.email,
      },
      operatorId,
      operator: rawResp?.operator ?? undefined,
    };
    localStorage.setItem("auth", JSON.stringify(authObj));

    if (u.role === "OPERADOR") {
      localStorage.setItem("operatorId", operatorId || u.id);
      localStorage.setItem(
        "user-OPERADOR",
        JSON.stringify({ id: operatorId || u.id, role: "OPERADOR" })
      );
    }
  };

  const isTokenValid = () => !isTokenExpired(token);

  const refreshToken = async () => {
    if (!user || !token) return;
    try {
      const url = `${getHttpBase()}${getAuthRefreshPath()}`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        mode: "cors",
      });
      if (!res.ok) throw new Error("Token refresh failed");
      const data = await readJsonSafe(res);
      const newToken = extractToken(data);
      if (!newToken) throw new Error("No token on refresh");
      storeAuth(user, newToken, data);
    } catch {
      clearAuth();
    }
  };

  useEffect(() => {
    // Rehidratar desde el storage si hay sesión válida
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

  /* ---------- Asegurar operador tras login/register (idempotente) ---------- */
  const ensureAndBootOperator = async (
    name: string | undefined,
    dni: number,
    password: string,
    role?: string,
    email?: string
  ) => {
    try {
      // 0) Si ya tenemos operatorId, no creamos de nuevo
      const existingId = localStorage.getItem("operatorId");
      if (existingId) {
        await setOperatorState(existingId, "AVAILABLE").catch(() => {});
        console.log("[AUTH] Operator AVAILABLE (from local):", existingId);
        return;
      }

      // 1) Intentamos crear en /operators (o fallback interno del helper)
      let createdId = "";
      try {
        const res = await createOperatorDirect({
          name: name || "Operador",
          dni,
          password: password || "Temporal-123",
          email: email || "",
          role: "OPERADOR",
        });
        createdId = String(res?.id || dni);
      } catch (e: any) {
        const msg = String(e?.message || e || "").toLowerCase();
        // 2) Si ya existe (409 / duplicate), lo tomamos como OK
        if (msg.includes("409") || msg.includes("ya existe") || msg.includes("duplicate")) {
          createdId = String(dni); // usamos DNI como id lógico si el back no devuelve otro
          console.warn("[AUTH] Operador ya existía; usando dni como id:", createdId);
        } else {
          throw e;
        }
      }

      // 3) Persistimos y lo dejamos AVAILABLE
      if (createdId) {
        localStorage.setItem("operatorId", createdId);
        localStorage.setItem(
          "user-OPERADOR",
          JSON.stringify({ id: createdId, role: "OPERADOR" })
        );
        await setOperatorState(createdId, "AVAILABLE").catch(() => {});
        console.log("[AUTH] Operator OK y AVAILABLE:", createdId);
      }
    } catch (e: any) {
      console.error("[AUTH] ensureAndBootOperator falló:", e?.message || e);
    }
  };

  /* ---------- Login ---------- */
  const login = async (dni: number, password: string) => {
    const url = `${getHttpBase()}${getAuthLoginPath()}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      mode: "cors",
      body: JSON.stringify({ dni: Number(dni), password }),
    });

    if (!response.ok) {
      const e = await readJsonSafe(response);
      throw new Error(
        (Array.isArray(e?.message) ? e.message.join(", ") : e?.message) ||
          `HTTP ${response.status}`
      );
    }

    const data = await readJsonSafe(response);
    const tok = extractToken(data);
    if (!tok) throw new Error("No se recibió token");

    const rawUser = extractUserLike(data) || {};
    const userData: User = {
      id: String(rawUser?.id ?? rawUser?._id ?? rawUser?.uid ?? dni),
      name: rawUser?.name,
      dni: Number(rawUser?.dni ?? dni),
      role: normalizeRole(rawUser?.role),
      email: rawUser?.email,
    };

    // Importante: NO borres operatorId en este clearAuth (ver implementación)
    clearAuth();
    storeAuth(userData, tok, data);

    // Boot de operador sólo si corresponde
    if (userData.role === "OPERADOR" || FORCE_OPERATOR_ENSURE) {
      await ensureAndBootOperator(
        userData.name,
        userData.dni,
        password,
        userData.role,
        userData.email
      );
    }
  };

  /* ---------- Register ---------- */
  const register = async (
    name: string,
    dni: number,
    password: string,
    role: string,
    email?: string
  ) => {
    const url = `${getHttpBase()}${getAuthRegisterPath()}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      mode: "cors",
      body: JSON.stringify({ name, dni: Number(dni), password, role, email }),
    });

    if (!res.ok) {
      const e = await readJsonSafe(res);
      const msg = Array.isArray(e?.message)
        ? e.message.join(", ")
        : e?.message || "Error en el registro";
      throw new Error(msg);
    }

    const data = await readJsonSafe(res);
    const tok = extractToken(data);
    const rawUser = extractUserLike(data);

    // Si /auth/register no devuelve token, hacemos login y seguimos flujo normal
    if (!tok) {
      await login(dni, password);
      return;
    }

    const userData: User = {
      id: String(rawUser?.id ?? rawUser?._id ?? dni),
      name: rawUser?.name ?? name,
      dni: Number(rawUser?.dni ?? dni),
      role: normalizeRole(rawUser?.role ?? role),
      email: rawUser?.email ?? email,
    };

    clearAuth();
    storeAuth(userData, tok, data);

    if (userData.role === "OPERADOR" || FORCE_OPERATOR_ENSURE) {
      await ensureAndBootOperator(
        userData.name,
        userData.dni,
        password,
        userData.role,
        userData.email
      );
    }
  };

  /* ---------- Logout ---------- */
  const logout = () => {
    try {
      localStorage.removeItem("client-chat-id");
    } catch {}
    clearAuth();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        register,
        logout,
        isTokenValid,
        refreshToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/* Hook */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
