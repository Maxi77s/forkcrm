"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { io, type Socket } from "socket.io-client"
import { useAuth } from "./auth-provider"

interface SocketContextType {
  socket: Socket | null
  isConnected: boolean
}

const SocketContext = createContext<SocketContextType | undefined>(undefined)

function getApiUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"
}

export function SocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const { token, user } = useAuth()

  useEffect(() => {
    if (!token || !user) {
      if (socket) {
        console.log("🔌 Desconectando socket - no hay token/usuario")
        socket.disconnect()
        setSocket(null)
        setIsConnected(false)
      }
      return
    }

    const apiUrl = getApiUrl()
    const socketUrl = `${apiUrl}/chat`

    console.log("🔌 Conectando socket a:", socketUrl)
    console.log("🔑 Con token:", token ? "✅" : "❌")
    console.log("👤 Usuario:", user?.email, user?.role)

    const newSocket = io(socketUrl, {
      auth: {
        token: token,
      },
      transports: ["websocket", "polling"],
      timeout: 20000,
      forceNew: true,
    })

    newSocket.on("connect", () => {
      console.log("✅ Socket conectado:", newSocket.id)
      setIsConnected(true)
    })

    newSocket.on("disconnect", (reason) => {
      console.log("❌ Socket desconectado:", reason)
      setIsConnected(false)
    })

    newSocket.on("connect_error", (error) => {
      console.error("❌ Error de conexión socket:", error)
      setIsConnected(false)
    })

    setSocket(newSocket)

    return () => {
      console.log("🔌 Limpiando socket...")
      newSocket.disconnect()
      setSocket(null)
      setIsConnected(false)
    }
  }, [token, user])

  return <SocketContext.Provider value={{ socket, isConnected }}>{children}</SocketContext.Provider>
}

export function useSocket() {
  const context = useContext(SocketContext)
  if (context === undefined) {
    throw new Error("useSocket must be used within a SocketProvider")
  }
  return context
}
