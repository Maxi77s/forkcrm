"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"

interface User {
  id: string
  name?: string
  dni: number
  role: "CLIENT" | "OPERADOR" | "ADMIN"
}
interface RegisterBody {
  name: string;
  dni: number;
  password: string;
  role: string;
 
}

interface AuthContextType {
  user: User | null
  token: string | null
  isLoading: boolean
  login: (dni: number, password: string) => Promise<void>
  register: (name: string,dni: number, password: string, role: string) => Promise<void>
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
  } catch (error) {
    console.error("❌ [AUTH] expired token", error)
    return true
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const clearAuth = () => {
    setUser(null)
    setToken(null)
    localStorage.removeItem("authToken-CLIENT")
    localStorage.removeItem("authToken-OPERADOR")
    localStorage.removeItem("user-CLIENT")
    localStorage.removeItem("user-OPERADOR")
    localStorage.removeItem("token")
    localStorage.removeItem("user")
  }

  const isTokenValid = (): boolean => {
    if (!token) return false
    return !isTokenExpired(token)
  }

  const refreshToken = async () => {
    if (!user) return

    try {
      const response = await fetch(`${getApiUrl()}/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) throw new Error("Token refresh failed")

      const data = await response.json()
      const newToken = data.access_token || data.token
      setToken(newToken)
      localStorage.setItem(`authToken-${user.role}`, newToken)
      localStorage.setItem("token", newToken)
    } catch (error) {
      console.error("❌ [AUTH] Token refresh failed:", error)
      clearAuth()
    }
  }

  useEffect(() => {
    const savedTokenClient = localStorage.getItem("authToken-CLIENT")
    const savedTokenOperator = localStorage.getItem("authToken-OPERADOR")
    const savedUserClient = localStorage.getItem("user-CLIENT")
    const savedUserOperator = localStorage.getItem("user-OPERADOR")

    let tokenToUse = null
    let userToUse = null

    if (savedTokenClient && savedUserClient) {
      try {
        const userData = JSON.parse(savedUserClient)
        if (!isTokenExpired(savedTokenClient)) {
          tokenToUse = savedTokenClient
          userToUse = userData
        }
      } catch {
        localStorage.removeItem("authToken-CLIENT")
        localStorage.removeItem("user-CLIENT")
      }
    }

    if (!tokenToUse && savedTokenOperator && savedUserOperator) {
      try {
        const userData = JSON.parse(savedUserOperator)
        if (!isTokenExpired(savedTokenOperator)) {
          tokenToUse = savedTokenOperator
          userToUse = userData
        }
      } catch {
        localStorage.removeItem("authToken-OPERADOR")
        localStorage.removeItem("user-OPERADOR")
      }
    }

    if (tokenToUse && userToUse) {
      setToken(tokenToUse)
      setUser(userToUse)
      localStorage.setItem("token", tokenToUse)
      localStorage.setItem("user", JSON.stringify(userToUse))
    }

    setIsLoading(false)
  }, [])

const login = async (dni: number, password: string) => {
  console.log("🔐 [AUTH] Intentando login con:", { dni, passwordLength: password.length })

  const response = await fetch(`${getApiUrl()}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dni, password }),
  })

  console.log("📤 [AUTH] Response status:", response.status)

  if (!response.ok) {
    let errorData
    try {
      errorData = await response.json()
    } catch (err) {
      console.error("❌ [AUTH] Error parseando JSON de error:", err)
    }
    console.error("❌ [AUTH] Login falló:", errorData || "Unknown error")
    throw new Error(errorData?.message || "Error en el login")
  }

  const data = await response.json()
  console.log("✅ [AUTH] Login exitoso, datos recibidos:", data)

  const accessToken = data.access_token || data.token
  if (!accessToken) {
    console.error("❌ [AUTH] No se recibió token")
    throw new Error("No se recibió token")
  }

  const userData: User = {
    id: data.user.id,
    name: data.user.name,
    dni: data.user.dni,
    role: data.user.role.toUpperCase() as User["role"],
  }

  clearAuth()
  setUser(userData)
  setToken(accessToken)

  localStorage.setItem(`authToken-${userData.role}`, accessToken)
  localStorage.setItem(`user-${userData.role}`, JSON.stringify(userData))
  localStorage.setItem("token", accessToken)
  localStorage.setItem("user", JSON.stringify(userData))

  console.log("🎫 [AUTH] Token y usuario guardados correctamente")
}


  const register = async (name: string, dni: number, password: string, role: string) => {
    const endpoint = role === "OPERADOR" ? "/operators" : "/auth/register"

    const body: RegisterBody = {
      name,
  dni,
  password,
  role,
};



    const response = await fetch(`${getApiUrl()}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.message || "Error en el registro")
    }

    const data = await response.json()
    const accessToken = data.access_token || data.token
    if (!accessToken) throw new Error("No se recibió token")

    const userData: User = {
      id: data.user.id,
      name: data.user.name,
      dni: data.user.dni,
      role: data.user.role.toUpperCase() as User["role"],
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
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}













