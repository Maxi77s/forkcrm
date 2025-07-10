"use client"

import type React from "react"

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
  const [chatState, setChatState] = useState<ChatState>({
    id: null,
    status: "disconnected",
  })
  const [isTyping, setIsTyping] = useState(false)
  const [botThinking, setBotThinking] = useState(false)
  const [inputMessage, setInputMessage] = useState("")
  const [showRatingDialog, setShowRatingDialog] = useState(false)
  const [finishedChatData, setFinishedChatData] = useState<{
    chatId: string
    operatorId: string
  } | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const clientId = useRef(user?.id || `client-${Math.random().toString(36).substr(2, 9)}`)

  const { socket, isConnected } = useSocket({
    userRole: "CLIENT",
    serverUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002",
  })

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (!socket) return

    // Eventos del socket
    socket.on("chatCreated", (data) => {
      console.log("🆕 [CLIENT] Chat creado:", data)
      setChatState({ id: data.id, status: "active" })
      socket.emit("joinChat", { chatId: data.id })
      toast({
        title: "Chat iniciado",
        description: "¡Tu chat con la IA ha comenzado!",
      })
    })

    socket.on("joinedChat", (data) => {
      console.log("✅ [CLIENT] Unido al chat:", data)
    })

    socket.on("newMessage", (message) => {
      console.log("💬 [CLIENT] Nuevo mensaje:", message)
      setMessages((prev) => [
        ...prev,
        {
          id: message.id,
          content: message.content,
          sender: message.senderType,
          timestamp: new Date(message.timestamp),
          chatId: message.chatId,
        senderName: message.senderName || (message.senderType === "BOT"
  ? "IA Assistant"
  : message.senderType === "CLIENT"
  ? "Tú"
  : `Especialista ${message.userId}`),
        },
      ])
      setBotThinking(false)
    })

    socket.on("botThinking", (data) => {
      console.log("🤖 [CLIENT] Bot pensando:", data)
      setBotThinking(true)
    })

    socket.on("chatHistory", (data) => {
      console.log("📚 [CLIENT] Historial recibido:", data)
      const historyMessages = data.messages.map((msg: any) => ({
        id: msg.id,
        content: msg.content,
        sender: msg.sender,
        timestamp: new Date(msg.timestamp),
        chatId: msg.chatId,
        senderName: msg.senderName,
      }))
      setMessages(historyMessages)
    })

    socket.on("specialistAssigned", (data) => {
      console.log("🎧 [CLIENT] Especialista asignado:", data)
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
        },
      ])
      toast({
        title: "Especialista asignado",
        description: "Un especialista humano se ha unido a tu chat",
      })
    })

    socket.on("chatFinished", (data) => {
      console.log("✅ [CLIENT] Chat finalizado:", data)
      setChatState((prev) => ({ ...prev, status: "finished" }))
      setFinishedChatData({
        chatId: data.chatId,
        operatorId: data.operatorId,
      })
      setTimeout(() => {
        setShowRatingDialog(true)
      }, 1000)
      toast({
        title: "Chat finalizado",
        description: "El chat ha sido finalizado. ¡Gracias por contactarnos!",
      })
    })

    socket.on("ratingSubmitted", (data) => {
      console.log("⭐ [CLIENT] Calificación enviada:", data)
      setMessages((prev) => [
        ...prev,
        {
          id: `rating-${Date.now()}`,
          content: `⭐ ${data.message} Tu calificación: ${data.rating} estrellas`,
          sender: "SYSTEM",
          timestamp: new Date(data.timestamp),
          chatId: data.chatId,
          senderName: "Sistema",
        },
      ])
      toast({
        title: "Calificación enviada",
        description: `Gracias por tu calificación de ${data.rating} estrellas`,
      })
    })

    socket.on("chatInQueue", (data) => {
      console.log("⏳ [CLIENT] Chat en cola:", data)
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
        },
      ])
    })

    socket.on("userTyping", (data) => {
      console.log("⌨️ [CLIENT] Usuario escribiendo:", data)
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
      socket.off("joinedChat")
      socket.off("newMessage")
      socket.off("botThinking")
      socket.off("chatHistory")
      socket.off("specialistAssigned")
      socket.off("chatFinished")
      socket.off("ratingSubmitted")
      socket.off("chatInQueue")
      socket.off("userTyping")
      socket.off("error")
    }
  }, [socket, toast])

  const handleCreateChat = () => {
    if (!socket || !isConnected) {
      toast({
        title: "Error de conexión",
        description: "No se puede conectar al servidor",
        variant: "destructive",
      })
      return
    }

    // Reset estados para nuevo chat
    setMessages([])
    setFinishedChatData(null)
    setChatState({ id: null, status: "disconnected" })

    console.log("🚀 [CLIENT] Creando nuevo chat...")
    socket.emit("createChat")
  }

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()

    if (!inputMessage.trim() || !socket || !chatState.id || !isConnected) {
      return
    }

    if (chatState.status === "finished") {
      toast({
        title: "Chat finalizado",
        description: "Este chat ha sido finalizado. Crea un nuevo chat para continuar.",
        variant: "destructive",
      })
      return
    }

    console.log("📤 [CLIENT] Enviando mensaje:", inputMessage)
    socket.emit("sendMessage", {
      userId: clientId.current,
      chatId: chatState.id,
      content: inputMessage,
    })

    setInputMessage("")
  }

  const handleRatingSubmit = (ratingData: any) => {
    if (!socket || !finishedChatData) return

    const fullRatingData = {
      ...ratingData,
      clientId: clientId.current,
    }

    console.log("⭐ [CLIENT] Enviando calificación:", fullRatingData)
    socket.emit("rateChat", fullRatingData)
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
          <Button variant="outline" size="sm" onClick={logout}>
            <LogOut className="h-4 w-4 mr-2" />
            Salir
          </Button>
        </div>
      </div>

      {/* Connection Status */}
      <div className="bg-white border-b px-4 py-2">
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`} />
          <span className="text-sm text-gray-600">{isConnected ? "Conectado" : "Desconectado"}</span>
          {chatState.operatorName && (
            <span className="text-sm text-blue-600">• Especialista: {chatState.operatorName}</span>
          )}
        </div>
      </div>

      {/* Chat Area */}
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
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Conectando...
                    </>
                  ) : (
                    <>
                      <MessageCircle className="mr-2 h-4 w-4" />
                      Iniciar Chat
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <>
            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map((message) => (
                  <ChatMessage key={message.id} message={message} isOwn={message.sender === "CLIENT"} />
                ))}
                {botThinking && <TypingIndicator name="IA Assistant" />}
                {isTyping && <TypingIndicator name="Especialista" />}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="bg-white border-t p-4">
              <form onSubmit={handleSendMessage} className="flex space-x-2">
                <Input
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder={
                    chatState.status === "finished"
                      ? "Chat finalizado - Crea un nuevo chat para continuar"
                      : "Escribe tu mensaje... (prueba: 'quiero hablar con un humano')"
                  }
                  disabled={!isConnected || chatState.status === "finished"}
                  className="flex-1"
                />
                <Button
                  type="submit"
                  disabled={!isConnected || chatState.status === "finished" || !inputMessage.trim()}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>

              {chatState.status === "finished" && (
                <div className="mt-2 flex justify-center">
                  <Button variant="outline" onClick={handleCreateChat}>
                    💬 Nuevo Chat
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Rating Dialog */}
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
