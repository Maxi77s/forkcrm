"use client"

import { useAuth } from "@/components/providers/auth-provider"
import { LoginForm } from "@/components/auth/login-form"
import { ClientChat } from "@/components/chat/client-chat"
import { OperatorDashboard } from "@/components/operator/operator-dashboard"
import { Loader2 } from "lucide-react"

export default function Home() {
  const { user, isLoading } = useAuth()

  console.log("🏠 [HOME] Renderizando página principal:", {
    user,
    isLoading,
    hasUser: !!user,
  })

  if (isLoading) {
    console.log("⏳ [HOME] Cargando...")
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Cargando...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    console.log("🏠 [HOME] No hay usuario, mostrando LoginForm")
    return <LoginForm />
  }

  console.log("🏠 [HOME] Usuario autenticado, rol:", user.role)

  if (user.role === "CLIENT") {
    console.log("🏠 [HOME] Renderizando ClientChat")
    return <ClientChat />
  }

  if (user.role === "OPERADOR") {
    console.log("🏠 [HOME] Renderizando OperatorDashboard")
    return <OperatorDashboard />
  }

  console.log("🏠 [HOME] Rol no reconocido:", user.role)
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Rol no reconocido</h1>
        <p>Tu rol "{user.role}" no está configurado en el sistema.</p>
      </div>
    </div>
  )
}
