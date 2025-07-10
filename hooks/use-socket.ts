"use client"

import { useEffect, useState, useRef } from "react"
import { io, type Socket } from "socket.io-client"
import { useAuth } from "@/components/providers/auth-provider"

interface UseSocketProps {
  userRole: string
  serverUrl?: string
}

export const useSocket = ({ userRole, serverUrl = "http://localhost:3002" }: UseSocketProps) => {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const socketRef = useRef<Socket | null>(null)
  const { token, user } = useAuth()

  useEffect(() => {
    console.log("🔌 [SOCKET] Iniciando conexión para:", userRole)
    console.log("🔌 [SOCKET] Estado actual:", {
      hasToken: !!token,
      hasUser: !!user,
      tokenPreview: token ? token.substring(0, 20) + "..." : null,
      user: user,
      serverUrl,
    })

    // Solo conectar si tenemos token y usuario
    if (!token || !user) {
      console.warn(`⚠️ [SOCKET] No hay token o usuario para conectar socket de ${userRole}`)
      console.warn(`⚠️ [SOCKET] Token: ${!!token}, Usuario: ${!!user}`)
      return
    }

    console.log(`🔑 [SOCKET] Conectando socket para ${userRole} con:`)
    console.log(`🔑 [SOCKET] - Token: ${token.substring(0, 20)}...`)
    console.log(`🔑 [SOCKET] - Usuario: ${user.email} (${user.role})`)
    console.log(`🔑 [SOCKET] - URL: ${serverUrl}/chat`)

    const newSocket = io(`${serverUrl}/chat`, {
      auth: {
        token: token,
        userId: user.id,
        userRole: user.role,
      },
      transports: ["websocket", "polling"],
      timeout: 20000,
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    })

    console.log(`🔌 [SOCKET] Socket creado para ${userRole}:`, newSocket.id)

    newSocket.on("connect", () => {
      console.log(`✅ [SOCKET] Socket conectado para ${userRole}:`, newSocket.id)
      console.log(`✅ [SOCKET] Auth data enviado:`, {
        token: token.substring(0, 20) + "...",
        userId: user.id,
        userRole: user.role,
      })
      setIsConnected(true)
    })

    newSocket.on("disconnect", (reason) => {
      console.log(`❌ [SOCKET] Socket desconectado para ${userRole}:`, reason)
      setIsConnected(false)
    })

    newSocket.on("connect_error", (error) => {
      console.error(`🔥 [SOCKET] Error de conexión para ${userRole}:`, error)
      console.error(`🔥 [SOCKET] Error details:`, {
        // message: error.message,
        // description: error.description,
        // context: error.context,
        // type: error.type,
      })
      setIsConnected(false)
    })

    newSocket.on("reconnect", (attemptNumber) => {
      console.log(`🔄 [SOCKET] Reconectado para ${userRole} en intento:`, attemptNumber)
    })

    newSocket.on("reconnect_error", (error) => {
      console.error(`🔄❌ [SOCKET] Error de reconexión para ${userRole}:`, error)
    })

    // Interceptar emit para logging
    const originalEmit = newSocket.emit
    newSocket.emit = function (event: string, ...args: any[]) {
      console.log(`📤 [SOCKET-${userRole}] Emitiendo evento:`, event, args)
      return originalEmit.apply(this, [event, ...args])
    }

    // Interceptar on para logging
    const originalOn = newSocket.on
    newSocket.on = function (event: string, listener: (...args: any[]) => void) {
      const wrappedListener = (...args: any[]) => {
        if (event !== "connect" && event !== "disconnect") {
          console.log(`📥 [SOCKET-${userRole}] Evento recibido:`, event, args)
        }
        return listener(...args)
      }
      return originalOn.call(this, event, wrappedListener)
    }

    socketRef.current = newSocket
    setSocket(newSocket)

    return () => {
      console.log(`🔌 [SOCKET] Desconectando socket para ${userRole}`)
      newSocket.disconnect()
      socketRef.current = null
      setSocket(null)
      setIsConnected(false)
    }
  }, [userRole, serverUrl, token, user])

  return { socket, isConnected }
}
