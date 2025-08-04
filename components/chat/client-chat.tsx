"use client"

import { useState, useEffect, useRef } from "react"
import { useSocket } from "@/hooks/use-socket"
import { useAuth } from "@/components/providers/auth-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ChatMessage } from "./chat-message"
import { TypingIndicator } from "./typing-indicator"
import { RatingDialog } from "./rating-dialog"
import { useToast } from "@/hooks/use-toast"
import { MessageCircle, Send, User, LogOut, Loader2 } from "lucide-react"

interface Message {
  id: string
  content: string
  sender: "CLIENT" | "BOT" | "OPERADOR" | "SYSTEM"
  timestamp: Date
  chatId: string
  senderName?: string
   type: "TEXT" | "IMAGE"
  imageUrl?: string
}

interface ChatState {
  id: string | null
  status: "disconnected" | "active" | "with-specialist" | "finished" | "in-queue"
  operatorName?: string
}

export function ClientChat() {
  const { user, logout } = useAuth()
  const { toast } = useToast()
  const [messages, setMessages] = useState<Message[]>([])
  const [chatState, setChatState] = useState<ChatState>({ id: null, status: "disconnected" })
  const [isTyping, setIsTyping] = useState(false)
  const [botThinking, setBotThinking] = useState(false)
  const [inputMessage, setInputMessage] = useState("")
  const [showRatingDialog, setShowRatingDialog] = useState(false)
  const [finishedChatData, setFinishedChatData] = useState<{ chatId: string; operatorId: string } | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const clientId = useRef(user?.id || `client-${Math.random().toString(36).substr(2, 9)}`)

  const { socket, isConnected } = useSocket({
    userRole: "CLIENT",
    serverUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002",
  })

  // Scroll automático al final
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Recuperar chatId desde localStorage al iniciar la app
  useEffect(() => {
    const storedChatId = localStorage.getItem("client-chat-id")
    if (storedChatId && !chatState.id) {
      console.log("🗃️ [CLIENT] Recuperando chatId desde localStorage:", storedChatId)
      setChatState({ id: storedChatId, status: "active" })
    }
  }, [])

  // Cargar historial mensajes vía REST API cuando se setea chatState.id y no hay mensajes cargados aún
  useEffect(() => {
    if (chatState.id && messages.length === 0) {
      console.log("📦 [CLIENT] Recuperando historial vía REST API para:", chatState.id)
      fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002"}/chat/${chatState.id}/messages`)
        .then((res) => res.json())
        .then((data) => {
          const historyMessages = data.map((msg: any) => ({
            id: msg.id,
            content: msg.content,
            sender: msg.sender,
            timestamp: new Date(msg.timestamp),
            chatId: msg.chatId,
            senderName:
              msg.sender === "BOT"
                ? "DepilBot"
                : msg.sender === "CLIENT"
                ? "Tú"
                : msg.sender === "OPERADOR"
                ? "Especialista"
                : "Sistema",
                type: msg.type || "TEXT", // 👈 asegurate de que esto exista
  imageUrl: msg.imageUrl || undefined,
          }))
          setMessages(historyMessages)
        })
        .catch((err) => {
          console.error("❌ [CLIENT] Error al recuperar historial:", err)
        })
    }
  }, [chatState.id, messages.length])

  // Conexión socket: registrar eventos y lógica
  useEffect(() => {
    if (!socket) return

    // Al tener chatState.id, unirnos a la sala para recibir mensajes y eventos
    if (chatState.id) {
      socket.emit("joinChat", { chatId: chatState.id })
      console.log(`🔗 [CLIENT] Uniéndome a la sala del chat ${chatState.id}`)
    }

    socket.on("chatCreated", (data) => {
      console.log("🆕 [CLIENT] Chat creado:", data)
      setChatState({ id: data.id, status: "active" })
      localStorage.setItem("client-chat-id", data.id)
      socket.emit("joinChat", { chatId: data.id })
      toast({ title: "Chat iniciado", description: "¡Tu chat con la IA ha comenzado!" })
      setMessages([]) // limpio mensajes al iniciar nuevo chat
    })

    socket.on("newMessage", (message) => {
      setMessages((prev) => [
        ...prev,
       {
      id: message.id,
      content: message.content,
      sender: message.senderType,
      timestamp: new Date(message.timestamp),
      chatId: message.chatId,
      senderName: message.senderName || "Depilbot",
      type: message.type || "TEXT", // 👈 agregá esto
      imageUrl: message.imageUrl || undefined,
    },
      ])
      setBotThinking(false)
    })

    socket.on("botThinking", () => {
      setBotThinking(true)
    })

    socket.on("specialistAssigned", (data) => {
      setChatState((prev) => ({
        ...prev,
        status: "with-specialist",
        operatorName: data.specialistId,
      }))
      setMessages((prev) => [
        ...prev,
        {
          id: `system-${Date.now()}`,
          content: "🎧 Un especialista se ha unido al chat",
          sender: "SYSTEM",
          timestamp: new Date(),
          chatId: data.chatId,
          senderName: "Sistema",
          type: "TEXT",
        },
      ])
      toast({
        title: "Especialista asignado",
        description: "Un especialista humano se ha unido a tu chat",
      })
    })

    socket.on("chatFinished", (data) => {
      setChatState((prev) => ({ ...prev, status: "finished" }))
      setFinishedChatData({ chatId: data.chatId, operatorId: data.operatorId })
      setTimeout(() => setShowRatingDialog(true), 1000)
      toast({ title: "Chat finalizado", description: "El chat ha sido finalizado." })
    })

    socket.on("ratingSubmitted", (data) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `rating-${Date.now()}`,
          content: `⭐ ${data.message} Tu calificación: ${data.rating} estrellas`,
          sender: "SYSTEM",
          timestamp: new Date(data.timestamp),
          chatId: data.chatId,
          senderName: "Sistema",
          type: "TEXT",
        },
      ])
      toast({
        title: "Calificación enviada",
        description: `Gracias por tu calificación de ${data.rating} estrellas`,
      })
    })

    socket.on("chatInQueue", (data) => {
      setChatState((prev) => ({ ...prev, status: "in-queue" }))
      setMessages((prev) => [
        ...prev,
        {
          id: `queue-${Date.now()}`,
          content: data.message,
          sender: "SYSTEM",
          timestamp: new Date(data.timestamp),
          chatId: data.chatId,
          senderName: "Sistema",
          type: "TEXT",
        },
      ])
    })

    socket.on("userTyping", (data) => {
      if (data.userId !== clientId.current) {
        setIsTyping(data.isTyping)
      }
    })

    socket.on("error", (error) => {
      console.error("❌ [CLIENT] Error:", error)
      toast({
        title: "Error",
        description: error.message || "Ha ocurrido un error",
        variant: "destructive",
      })
    })

    return () => {
      socket.off("chatCreated")
      socket.off("newMessage")
      socket.off("botThinking")
      socket.off("specialistAssigned")
      socket.off("chatFinished")
      socket.off("ratingSubmitted")
      socket.off("chatInQueue")
      socket.off("userTyping")
      socket.off("error")
    }
  }, [socket, chatState.id, toast])

  const handleCreateChat = () => {
    if (!socket || !isConnected) {
      toast({ title: "Error de conexión", description: "No se puede conectar al servidor", variant: "destructive" })
      return
    }

    setMessages([])
    setFinishedChatData(null)
    setChatState({ id: null, status: "disconnected" })
    localStorage.removeItem("client-chat-id") // limpio chat guardado

    socket.emit("createChat")
  }

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputMessage.trim() || !socket || !chatState.id || !isConnected) return

    socket.emit("sendMessage", {
      userId: clientId.current,
      chatId: chatState.id,
      content: inputMessage.trim(),
    })
    setInputMessage("")
  }

  const handleRatingSubmit = (ratingData: any) => {
    if (!socket || !finishedChatData) return
    socket.emit("rateChat", { ...ratingData, clientId: clientId.current })
    setShowRatingDialog(false)
  }

  const getStatusBadge = () => {
    switch (chatState.status) {
      case "finished":
        return <Badge variant="secondary">✅ Chat Finalizado</Badge>
      case "with-specialist":
        return <Badge variant="default">🎧 Con Especialista</Badge>
      case "active":
        return <Badge variant="default">🟢 Chat con IA</Badge>
      case "in-queue":
        return <Badge variant="outline">⏳ En Cola</Badge>
      default:
        return <Badge variant="destructive">🔴 Desconectado</Badge>
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b p-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Avatar>
            <AvatarFallback>
              <User className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="font-semibold">Chat Cliente</h1>
            <p className="text-sm text-gray-500">{user?.email}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {getStatusBadge()}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              logout()
              localStorage.removeItem("client-chat-id") // limpiar al cerrar sesión
            }}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Salir
          </Button>
        </div>
      </div>

      {/* Chat */}
      <div className="flex-1 flex flex-col">
        {!chatState.id ? (
          <div className="flex-1 flex items-center justify-center">
            <Card className="w-full max-w-md mx-4">
              <CardHeader className="text-center">
                <MessageCircle className="h-12 w-12 mx-auto mb-4 text-blue-600" />
                <CardTitle>¡Bienvenido al Chat!</CardTitle>
                <p className="text-gray-600">Inicia una conversación con nuestro asistente de IA</p>
              </CardHeader>
              <CardContent>
                <Button onClick={handleCreateChat} disabled={!isConnected} className="w-full" size="lg">
                  {!isConnected ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Conectando...
                    </>
                  ) : (
                    <>
                      <MessageCircle className="mr-2 h-4 w-4" /> Iniciar Chat
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map((message) => (
                <ChatMessage
    key={message.id}
    message={message}
    currentUserId={user?.id} // Asegurate de que esto tenga el userId correcto
  />

                ))}
                {botThinking && <TypingIndicator name="Depilbot" />}
                {isTyping && <TypingIndicator name="Especialista" />}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
            <div className="bg-white border-t p-4">
              <form onSubmit={handleSendMessage} className="flex space-x-2">
                <Input
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Escribe tu mensaje..."
                  disabled={!isConnected || chatState.status === "finished"}
                  className="flex-1"
                />
                <Button type="submit" disabled={!isConnected || !inputMessage.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </>
        )}
      </div>

      {/* Rating dialog */}
      {showRatingDialog && finishedChatData && (
        <RatingDialog
          isOpen={showRatingDialog}
          chatId={finishedChatData.chatId}
          operatorId={finishedChatData.operatorId}
          onSubmit={handleRatingSubmit}
          onClose={() => setShowRatingDialog(false)}
        />
      )}
    </div>
  )
}
