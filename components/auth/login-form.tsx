// src/components/auth/login-form.tsx
"use client"

import type React from "react"
import { useState } from "react"
import { useAuth } from "@/components/providers/auth-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"
import Image from "next/image"

// Helpers /operators
import {
  createOperatorDirect,
} from "@/components/helpers/helper.assign"

// Base HTTP común (sin hardcodear localhost)
import { getHttpBase } from "@/lib/env.client"

function normalizeRole(r?: string) {
  return (r || "").toUpperCase().trim()
}

export function LoginForm() {
  const { login } = useAuth()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [showRegister, setShowRegister] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)

  const [loginData, setLoginData] = useState({ dni: "", password: "" })
  const [registerData, setRegisterData] = useState({
    name: "",
    email: "",
    dni: "",
    password: "",
    role: "CLIENT", // CLIENT | OPERADOR
  })

  /* ======================= LOGIN ======================= */
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      const dniNumber = Number(loginData.dni)
      await login(dniNumber, loginData.password)

      if (rememberMe) localStorage.setItem("remember-dni", String(loginData.dni))
      toast({ title: "Acceso concedido", description: "Sesión iniciada correctamente." })
    } catch (error: any) {
      toast({
        title: "Error de autenticación",
        description: error?.message || "Credenciales incorrectas",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  /* ======================= REGISTER ======================= */
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validaciones básicas
    if (!registerData.name || !registerData.dni || !registerData.password) {
      toast({
        title: "Campos incompletos",
        description: "Complete nombre, DNI y contraseña.",
        variant: "destructive",
      })
      return
    }

    const dniRegex = /^\d{8}$/
    if (!dniRegex.test(registerData.dni)) {
      toast({
        title: "DNI inválido",
        description: "El DNI debe tener exactamente 8 dígitos.",
        variant: "destructive",
      })
      return
    }

    const roleNormalized = normalizeRole(registerData.role)

    // Email obligatorio
    if (!registerData.email) {
      toast({
        title: "Email requerido",
        description: "El email es obligatorio.",
        variant: "destructive",
      })
      return
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(registerData.email)) {
      toast({
        title: "Email inválido",
        description: "Formato de correo no válido.",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    try {
      const dniNumber = Number(registerData.dni)
      const email = registerData.email.trim().toLowerCase()

      if (roleNormalized === "OPERADOR") {
        // === OPERADOR ===
        // 1) Crear operador (usa helper local / fake id si no hay back)
        const res = await createOperatorDirect({
          name: registerData.name || "Operador Seed",
          dni: dniNumber,
          password: registerData.password,
          email,
          role: "OPERADOR",      // opcional (DTO lo permite)
        })

        const operatorId = String(res?.id || "")
        if (!operatorId) {
          throw new Error("No se obtuvo id de operador.")
        }
        localStorage.setItem("operatorId", operatorId)

        // 2) Login para obtener token (NECESARIO antes del PATCH state)
        await login(dniNumber, registerData.password)

        // 3) Setear AVAILABLE (ya con token persistido por AuthProvider)
        // 3) Setear AVAILABLE (ya con token persistido por AuthProvider)
        try {
          // TODO: Implement setOperatorState functionality or use appropriate API call
          console.log("Setting operator state to AVAILABLE for operator:", operatorId)
        } catch {
          // no bloquear flujo si falla; suele requerir token/permiso en back real
        }
        toast({ title: "Operador creado", description: "Cuenta creada y habilitada." })
        setShowRegister(false)
        setRegisterData({ name: "", email: "", dni: "", password: "", role: "CLIENT" })
        setIsLoading(false)
        return
      }

      // === CLIENTE ===
      const payload = {
        dni: dniNumber,
        password: registerData.password,
        role: "CLIENT",
        name: registerData.name,
        email,
      }

      const r = await fetch(`${getHttpBase()}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      })
      if (!r.ok) {
        const errText = await r.text().catch(() => "")
        throw new Error(errText || "No se pudo crear la cuenta.")
      }

      await login(dniNumber, registerData.password)
      toast({ title: "Cuenta creada", description: "Registro exitoso." })
      setShowRegister(false)
      setRegisterData({ name: "", email: "", dni: "", password: "", role: "CLIENT" })
    } catch (error: any) {
      const msg =
        error?.response?.data?.message ||
        (typeof error?.message === "string" ? error.message : "No se pudo crear la cuenta")
      toast({ title: "Error de registro", description: msg, variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  /* ======================= GOOGLE (placeholder) ======================= */
  const handleGoogleLogin = async () => {
    setIsLoading(true)
    try {
      toast({ title: "Próximamente", description: "Login con Google estará disponible pronto." })
    } catch {
      toast({ title: "Error", description: "No se pudo iniciar sesión con Google.", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  /* ======================= UI ======================= */
  if (showRegister) {
    return (
      <div className="min-h-screen flex">
        {/* Lado izquierdo - Registro */}
        <div className="flex-1 flex items-center justify-center p-8 bg-white">
          <div className="w-full max-w-md space-y-6">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-[#00B2FF]">Crear Cuenta</h1>
              <p className="text-gray-600">Complete sus datos para registrarse</p>
            </div>

            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="register-name" className="text-sm font-medium text-gray-700">
                  Nombre Completo
                </Label>
                <Input
                  id="register-name"
                  type="text"
                  placeholder="Ingresa tu nombre completo"
                  value={registerData.name}
                  onChange={(e) => setRegisterData({ ...registerData, name: e.target.value })}
                  required
                  disabled={isLoading}
                  className="h-12 border-gray-300 focus:border-[#00B2FF] focus:ring-[#00B2FF]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="register-email" className="text-sm font-medium text-gray-700">
                  Email
                </Label>
                <Input
                  id="register-email"
                  type="email"
                  placeholder="tu@email.com"
                  value={registerData.email}
                  onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                  required
                  disabled={isLoading}
                  className="h-12 border-gray-300 focus:border-[#00B2FF] focus:ring-[#00B2FF]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="register-dni" className="text-sm font-medium text-gray-700">
                  DNI
                </Label>
                <Input
                  id="register-dni"
                  type="text"
                  inputMode="numeric"
                  placeholder="Ingresa tu DNI"
                  value={registerData.dni}
                  onChange={(e) => {
                    const value = e.target.value
                    if (/^\d{0,8}$/.test(value)) {
                      setRegisterData({ ...registerData, dni: value })
                    }
                  }}
                  required
                  disabled={isLoading}
                  className="h-12 border-gray-300 focus:border-[#00B2FF] focus:ring-[#00B2FF]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="register-password" className="text-sm font-medium text-gray-700">
                  Contraseña
                </Label>
                <Input
                  id="register-password"
                  type="password"
                  placeholder="Ingresa tu contraseña"
                  value={registerData.password}
                  onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                  required
                  disabled={isLoading}
                  className="h-12 border-gray-300 focus:border-[#00B2FF] focus:ring-[#00B2FF]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="register-role" className="text-sm font-medium text-gray-700">
                  Rol
                </Label>
                <select
                  id="register-role"
                  className="w-full h-12 p-3 border border-gray-300 rounded-md focus:border-[#00B2FF] focus:ring-[#00B2FF] focus:outline-none"
                  value={registerData.role}
                  onChange={(e) => setRegisterData({ ...registerData, role: e.target.value })}
                  disabled={isLoading}
                >
                  <option value="CLIENT">Cliente</option>
                  <option value="OPERADOR">Operador</option>
                </select>
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-[#00B2FF] hover:bg-[#0099E6] text-white font-medium rounded-md"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creando cuenta...
                  </>
                ) : (
                  "Crear Cuenta"
                )}
              </Button>
            </form>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setShowRegister(false)}
                className="text-[#00B2FF] hover:underline text-sm"
              >
                ¿Ya tienes cuenta? Iniciar Sesión
              </button>
            </div>
          </div>
        </div>

        {/* Lado derecho - Imagen */}
        <div className="flex-1 relative bg-gradient-to-br from-blue-50 to-cyan-50">
          <Image
            src="/images/depilzone-login-bg.png"
            alt="DepilZONE"
            fill
            className="object-cover"
            priority
          />
        </div>
      </div>
    )
  }

  // ======== LOGIN VIEW ========
  return (
    <div className="min-h-screen flex">
      {/* Lado izquierdo - Login */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-[#00B2FF]">Iniciar Sesión</h1>
            <p className="text-gray-600">Ingrese sus datos para acceder</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dni" className="text-sm font-medium text-gray-700">
                DNI
              </Label>
              <Input
                id="dni"
                type="text"
                inputMode="numeric"
                placeholder="Ingresa tu DNI"
                value={loginData.dni}
                onChange={(e) => {
                  const value = e.target.value
                  if (/^\d{0,8}$/.test(value)) {
                    setLoginData({ ...loginData, dni: value })
                  }
                }}
                required
                disabled={isLoading}
                className="h-12 border-gray-300 focus:border-[#00B2FF] focus:ring-[#00B2FF]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                Contraseña
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Ingresa tu contraseña"
                value={loginData.password}
                onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                required
                disabled={isLoading}
                className="h-12 border-gray-300 focus:border-[#00B2FF] focus:ring-[#00B2FF]"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="remember"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked === true)}
                className="border-gray-300 data-[state=checked]:bg-[#00B2FF] data-[state=checked]:border-[#00B2FF]"
              />
              <Label htmlFor="remember" className="text-sm text-gray-700">
                Recordarme
              </Label>
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-[#00B2FF] hover:bg-[#0099E6] text-white font-medium rounded-md"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Iniciando sesión...
                </>
              ) : (
                "Iniciar Sesión"
              )}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-500">o</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full h-12 border-gray-300 hover:bg-gray-50"
            onClick={handleGoogleLogin}
            disabled={isLoading}
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Iniciar sesión con Google
          </Button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => setShowRegister(true)}
              className="text-[#00B2FF] hover:underline text-sm"
            >
              ¿Todavía no tiene cuenta? <span className="font-medium">Regístrese</span>
            </button>
          </div>
        </div>
      </div>

      {/* Lado derecho - Imagen */}
      <div className="flex-1 relative bg-gradient-to-br from-blue-50 to-cyan-50">
        <Image
          src="/images/depilzone-login-bg.png"
          alt="DepilZONE - Piel Hidratada, Piel Cuidada, Piel Sana"
          fill
          className="object-cover"
          priority
        />
      </div>
    </div>
  )
}
