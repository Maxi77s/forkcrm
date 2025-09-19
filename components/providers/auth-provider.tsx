"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"

type AppRole = "CLIENT" | "OPERADOR" | "ADMIN"

interface User {
  id: string
  name?: string
  email?: string
  role: AppRole
}

interface AuthContextType {
  user: User | null
  token: string | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (dni: number, password: string, role: AppRole, name?: string) => Promise<void>
  logout: () => void
  isTokenValid: () => boolean
  refreshToken: () => Promise<void>
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)

function getApiUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"
}

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]))
    const now = Date.now() / 1000
    return payload.exp < now
  } catch {
    return true
  }
}

function normalizeRole(raw?: string): AppRole {
  const r = (raw || "").toUpperCase().trim()
  if (r === "ADMIN") return "ADMIN"
  if (r.includes("OPER")) return "OPERADOR"
  return "CLIENT"
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const clearAuth = () => {
    setUser(null)
    setToken(null)
    ;(["CLIENT","OPERADOR","ADMIN"] as AppRole[]).forEach(r => {
      localStorage.removeItem(`authToken-${r}`)
      localStorage.removeItem(`user-${r}`)
    })
    localStorage.removeItem("token")
    localStorage.removeItem("user")
  }

  const isTokenValid = (): boolean => !!token && !isTokenExpired(token)

  const refreshToken = async () => {
    if (!user) return
    try {
      const res = await fetch(`${getApiUrl()}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error("Token refresh failed")
      const data = await res.json()
      const newToken = data.access_token || data.token
      setToken(newToken)
      localStorage.setItem(`authToken-${user.role}`, newToken)
      localStorage.setItem("token", newToken)
    } catch {
      clearAuth()
    }
  }

  useEffect(() => {
    const tryLoad = (role: AppRole) => {
      const tok = localStorage.getItem(`authToken-${role}`)
      const usr = localStorage.getItem(`user-${role}`)
      if (!tok || !usr) return false
      try {
        const u: User = JSON.parse(usr)
        u.role = normalizeRole(u.role)
        if (!isTokenExpired(tok)) {
          setToken(tok)
          setUser(u)
          localStorage.setItem("token", tok)
          localStorage.setItem("user", JSON.stringify(u))
          return true
        }
      } catch {}
      return false
    }
    if (!tryLoad("CLIENT")) if (!tryLoad("OPERADOR")) tryLoad("ADMIN")
    setIsLoading(false)
  }, [])

  const login = async (email: string, password: string) => {
    const res = await fetch(`${getApiUrl()}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) {
      let message = "Error en el login"
      try {
        const e = await res.json()
        message = Array.isArray(e?.message) ? e.message.join(", ") : (e?.message || message)
      } catch {}
      throw new Error(message)
    }
    const data = await res.json()
    const accessToken = data.access_token || data.token
    if (!accessToken) throw new Error("No se recibió token")

    const role = normalizeRole(data?.user?.role)
    const userData: User = {
      id: data?.user?.id ?? "unknown",
      email: data?.user?.email ?? email,
      role,
      name: data?.user?.name,
    }

    clearAuth()
    setUser(userData)
    setToken(accessToken)
    localStorage.setItem(`authToken-${userData.role}`, accessToken)
    localStorage.setItem(`user-${userData.role}`, JSON.stringify(userData))
    localStorage.setItem("token", accessToken)
    localStorage.setItem("user", JSON.stringify(userData))
  }

  // Registro: SOLO { dni, password, role, name? } como exige tu DTO
  const register = async (dni: number, password: string, role: AppRole, name?: string) => {
    const body: any = { dni, password, role }
    if (name && name.trim()) body.name = name.trim()

    const res = await fetch(`${getApiUrl()}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      let message = "Error en el registro"
      try {
        const e = await res.json()
        message = Array.isArray(e?.message) ? e.message.join(", ") : (e?.message || message)
      } catch {}
      throw new Error(message)
    }

    const data = await res.json()
    const accessToken = data.access_token || data.token
    if (!accessToken) throw new Error("No se recibió token")

    const roleResp = normalizeRole(data?.user?.role || role)
    const userData: User = {
      id: data?.user?.id ?? "unknown",
      email: data?.user?.email, // el back podría setearlo luego
      role: roleResp,
      name: data?.user?.name ?? name,
    }

    clearAuth()
    setUser(userData)
    setToken(accessToken)
    localStorage.setItem(`authToken-${userData.role}`, accessToken)
    localStorage.setItem(`user-${userData.role}`, JSON.stringify(userData))
    localStorage.setItem("token", accessToken)
    localStorage.setItem("user", JSON.stringify(userData))
  }

  const logout = () => {
    localStorage.removeItem("client-chat-id")
    clearAuth()
  }

  return (
    <AuthContext.Provider
      value={{ user, token, isLoading, login, register, logout, isTokenValid, refreshToken }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider")
  return ctx
}
