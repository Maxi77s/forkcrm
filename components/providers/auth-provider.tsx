"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"

interface User {
  id: string
  email: string
  role: "CLIENT" | "OPERADOR" | "ADMIN"
}

interface AuthContextType {
  user: User | null
  token: string | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, role: string) => Promise<void>
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
    console.log("🕐 [AUTH] Verificando expiración token:", {
      exp: payload.exp,
      now: now,
      expired: payload.exp < now,
      timeLeft: payload.exp - now,
    })
    return payload.exp < now
  } catch (error) {
    console.error("❌ [AUTH] Error checking token expiration:", error)
    return true
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const clearAuth = () => {
    console.log("🧹 [AUTH] Limpiando autenticación...")
    setUser(null)
    setToken(null)
    // Limpiar todos los tokens guardados
    localStorage.removeItem("authToken-CLIENT")
    localStorage.removeItem("authToken-OPERADOR")
    localStorage.removeItem("user-CLIENT")
    localStorage.removeItem("user-OPERADOR")
    localStorage.removeItem("token")
    localStorage.removeItem("user")
  }

  const isTokenValid = (): boolean => {
    if (!token) {
      console.log("⚠️ [AUTH] No hay token para validar")
      return false
    }
    const valid = !isTokenExpired(token)
    console.log("🔍 [AUTH] Token válido:", valid)
    return valid
  }

  const refreshToken = async () => {
    if (!user) {
      console.log("⚠️ [AUTH] No hay usuario para refrescar token")
      return
    }

    try {
      console.log("🔄 [AUTH] Intentando refrescar token...")
      // Intentar renovar el token usando el email del usuario
      const response = await fetch(`${getApiUrl()}/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error("Token refresh failed")
      }

      const data = await response.json()
      console.log("✅ [AUTH] Token refrescado:", data)
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
    console.log("🚀 [AUTH] Inicializando AuthProvider...")
    // Verificar si hay token guardado al cargar
    const savedTokenClient = localStorage.getItem("authToken-CLIENT")
    const savedTokenOperator = localStorage.getItem("authToken-OPERADOR")
    const savedUserClient = localStorage.getItem("user-CLIENT")
    const savedUserOperator = localStorage.getItem("user-OPERADOR")

    console.log("📦 [AUTH] Tokens guardados:", {
      clientToken: savedTokenClient ? savedTokenClient.substring(0, 20) + "..." : null,
      operatorToken: savedTokenOperator ? savedTokenOperator.substring(0, 20) + "..." : null,
      clientUser: savedUserClient,
      operatorUser: savedUserOperator,
    })

    let tokenToUse = null
    let userToUse = null

    // Priorizar CLIENT primero, luego OPERADOR
    if (savedTokenClient && savedUserClient) {
      try {
        const userData = JSON.parse(savedUserClient)
        console.log("👤 [AUTH] Datos usuario CLIENT:", userData)
        if (userData && userData.id && userData.email && userData.role) {
          if (!isTokenExpired(savedTokenClient)) {
            tokenToUse = savedTokenClient
            userToUse = userData
            console.log("✅ [AUTH] Usando token CLIENT válido")
          } else {
            console.warn("⚠️ [AUTH] Token CLIENT expirado, removiendo...")
            localStorage.removeItem("authToken-CLIENT")
            localStorage.removeItem("user-CLIENT")
          }
        }
      } catch (error) {
        console.error("❌ [AUTH] Error parsing CLIENT user data:", error)
        localStorage.removeItem("authToken-CLIENT")
        localStorage.removeItem("user-CLIENT")
      }
    }

    if (!tokenToUse && savedTokenOperator && savedUserOperator) {
      try {
        const userData = JSON.parse(savedUserOperator)
        console.log("👤 [AUTH] Datos usuario OPERADOR:", userData)
        if (userData && userData.id && userData.email && userData.role) {
          if (!isTokenExpired(savedTokenOperator)) {
            tokenToUse = savedTokenOperator
            userToUse = userData
            console.log("✅ [AUTH] Usando token OPERADOR válido")
          } else {
            console.warn("⚠️ [AUTH] Token OPERADOR expirado, removiendo...")
            localStorage.removeItem("authToken-OPERADOR")
            localStorage.removeItem("user-OPERADOR")
          }
        }
      } catch (error) {
        console.error("❌ [AUTH] Error parsing OPERADOR user data:", error)
        localStorage.removeItem("authToken-OPERADOR")
        localStorage.removeItem("user-OPERADOR")
      }
    }

    if (tokenToUse && userToUse) {
      console.log("🎯 [AUTH] Estableciendo usuario y token:", {
        user: userToUse,
        token: tokenToUse.substring(0, 20) + "...",
      })
      setToken(tokenToUse)
      setUser(userToUse)
      // También guardar como token genérico para compatibilidad
      localStorage.setItem("token", tokenToUse)
      localStorage.setItem("user", JSON.stringify(userToUse))
    } else {
      console.log("⚠️ [AUTH] No se encontró token válido")
    }

    setIsLoading(false)
    console.log("✅ [AUTH] AuthProvider inicializado")
  }, [])

  const login = async (email: string, password: string) => {
    try {
      console.log("🔐 [AUTH] Intentando login con:", { email, password: "***" })
      console.log("🌐 [AUTH] API URL:", getApiUrl())

      const response = await fetch(`${getApiUrl()}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      })

      console.log("📡 [AUTH] Respuesta del servidor:", {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error("❌ [AUTH] Error en respuesta:", errorData)
        throw new Error(errorData.message || "Error en el login")
      }

      const data = await response.json()
      console.log("✅ [AUTH] Login exitoso - Datos completos:", data)

      // Verificar qué campo contiene el token
      const accessToken = data.access_token || data.token
      console.log("🔑 [AUTH] Token extraído:", {
        access_token: data.access_token,
        token: data.token,
        finalToken: accessToken,
      })

      if (!accessToken) {
        console.error("❌ [AUTH] No se encontró token en la respuesta")
        throw new Error("No se recibió token de autenticación")
      }

      console.log("👤 [AUTH] Datos del usuario:", data.user)

      const userData: User = {
        id: data.user.id,
        email: data.user.email,
        role: data.user.role.toUpperCase() as "CLIENT" | "OPERADOR" | "ADMIN",
      }

      console.log("🎯 [AUTH] Usuario procesado:", userData)

      // Limpiar tokens anteriores
      clearAuth()

      // Establecer el nuevo usuario y token
      console.log("💾 [AUTH] Guardando usuario y token...")
      setUser(userData)
      setToken(accessToken)

      // Guardar en localStorage según el rol
      localStorage.setItem(`authToken-${userData.role}`, accessToken)
      localStorage.setItem(`user-${userData.role}`, JSON.stringify(userData))

      // También guardar como genérico para compatibilidad
      localStorage.setItem("token", accessToken)
      localStorage.setItem("user", JSON.stringify(userData))

      console.log(`🎫 [AUTH] Token guardado para ${userData.role}:`, accessToken.substring(0, 20) + "...")
      console.log("✅ [AUTH] Login completado exitosamente")
    } catch (error) {
      console.error("❌ [AUTH] Login error:", error)
      throw error
    }
  }

  const register = async (email: string, password: string, role: string) => {
    try {
      console.log("📝 [AUTH] Intentando registro con:", { email, role })
      console.log("🌐 [AUTH] API URL:", getApiUrl())

      const response = await fetch(`${getApiUrl()}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password, role }),
      })

      console.log("📡 [AUTH] Respuesta del servidor:", {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error("❌ [AUTH] Error en respuesta:", errorData)
        throw new Error(errorData.message || "Error en el registro")
      }

      const data = await response.json()
      console.log("✅ [AUTH] Registro exitoso - Datos completos:", data)

      // Verificar qué campo contiene el token
      const accessToken = data.access_token || data.token
      console.log("🔑 [AUTH] Token extraído:", {
        access_token: data.access_token,
        token: data.token,
        finalToken: accessToken,
      })

      if (!accessToken) {
        console.error("❌ [AUTH] No se encontró token en la respuesta")
        throw new Error("No se recibió token de autenticación")
      }

      const userData: User = {
        id: data.user.id,
        email: data.user.email,
        role: data.user.role.toUpperCase() as "CLIENT" | "OPERADOR" | "ADMIN",
      }

      console.log("🎯 [AUTH] Usuario procesado:", userData)

      // Limpiar tokens anteriores
      clearAuth()

      // Establecer el nuevo usuario y token
      console.log("💾 [AUTH] Guardando usuario y token...")
      setUser(userData)
      setToken(accessToken)

      // Guardar en localStorage según el rol
      localStorage.setItem(`authToken-${userData.role}`, accessToken)
      localStorage.setItem(`user-${userData.role}`, JSON.stringify(userData))

      // También guardar como genérico para compatibilidad
      localStorage.setItem("token", accessToken)
      localStorage.setItem("user", JSON.stringify(userData))

      console.log(`🎫 [AUTH] Token guardado para ${userData.role}:`, accessToken.substring(0, 20) + "...")
      console.log("✅ [AUTH] Registro completado exitosamente")
    } catch (error) {
      console.error("❌ [AUTH] Register error:", error)
      throw error
    }
  }

  const logout = () => {
    console.log("👋 [AUTH] Cerrando sesión...")
    clearAuth()
  }

  // Log del estado actual para debugging
  useEffect(() => {
    console.log("📊 [AUTH] Estado actual:", {
      user: user,
      hasToken: !!token,
      tokenPreview: token ? token.substring(0, 20) + "..." : null,
      isLoading,
    })
  }, [user, token, isLoading])

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
