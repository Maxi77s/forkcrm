"use client"

import { useEffect } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { User, Headphones, Settings } from "lucide-react"

interface Message {
  id: string;
  content?: string;
  sender: "CLIENT" | "BOT" | "OPERADOR" | "SYSTEM";
  timestamp: Date;
  chatId?: string;
  senderName?: string;
  type: "TEXT" | "IMAGE";
  imageUrl?: string;
  userId?: string;
}

interface ChatMessageProps {
  message: Message
  currentUserId: string | undefined
  /** URL del avatar del cliente (mismo que se muestra en el título/lista del chat) */
  clientAvatarUrl?: string
}

export function ChatMessage({ message, currentUserId, clientAvatarUrl }: ChatMessageProps) {
  // ↔️ POSICIONES: Operador (izq), Cliente (der)
  const isOwn =
    message.sender === "CLIENT" ||
    (currentUserId && message.userId === currentUserId)

  // ⛳️ Anclar cuando llega mensaje del cliente
  useEffect(() => {
    if (message.sender === "CLIENT") {
      requestAnimationFrame(() => {
        document
          .getElementById("chat-bottom-anchor")
          ?.scrollIntoView({ behavior: "smooth", block: "end" })
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message.id])

  const getSenderIcon = () => {
    switch (message.sender) {
      case "BOT":
        return <AvatarImage src="/bot-icon.png" alt="Bot" className="object-cover" />
      case "CLIENT":
        return <User className="h-4 w-4" />
      case "OPERADOR":
        return <Headphones className="h-4 w-4" />
      case "SYSTEM":
        return <Settings className="h-4 w-4" />
      default:
        return <User className="h-4 w-4" />
    }
  }

  const getSenderColor = () => {
    switch (message.sender) {
      case "BOT":
        return "bg-emerald-500"
      case "CLIENT":
        return "bg-green-500"
      case "OPERADOR":
        return "bg-purple-500"
      case "SYSTEM":
        return "bg-gray-500"
      default:
        return "bg-gray-500"
    }
  }

  const getMessageAlignment = () => {
    if (message.sender === "SYSTEM") return "justify-center"
    return isOwn ? "justify-end" : "justify-start"
  }

  const getMessageStyle = () => {
    switch (message.sender) {
      case "BOT":
        return "bg-emerald-100 text-emerald-900 border border-emerald-300"
      case "CLIENT":
        return "bg-green-100 text-green-900 border border-green-300"
      case "OPERADOR":
        return "bg-purple-100 text-purple-900 border border-purple-300"
      case "SYSTEM":
        return "bg-gray-100 text-gray-700 text-center text-sm italic"
      default:
        return "bg-white text-gray-900 border"
    }
  }

  const timeStr = message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

  return (
    <div className={`flex ${getMessageAlignment()} mb-4`}>
      <div
        className={`flex items-start space-x-3 max-w-xs lg:max-w-md ${
          isOwn ? "flex-row-reverse space-x-reverse" : ""
        }`}
      >
        {/* avatar del otro lado (solo se muestra cuando el mensaje NO es del cliente) */}
        {!isOwn && message.sender !== "SYSTEM" && (
          <Avatar className="w-8 h-8">
            {message.sender === "BOT" ? (
              <AvatarImage src="/bot-icon.png" alt="Bot" />
            ) : (
              <AvatarFallback className={getSenderColor()}>
                {getSenderIcon()}
              </AvatarFallback>
            )}
          </Avatar>
        )}

        <div className={`flex flex-col ${isOwn ? "items-end" : "items-start"}`}>
          {/* encabezado (nombre + badge) solo para el lado izquierdo como lo tenías */}
          {!isOwn && message.sender !== "SYSTEM" && (
            <div className="flex items-center space-x-2 mb-1">
              <span className="text-xs font-medium text-gray-600">
                {message.senderName || message.sender}
              </span>
              <Badge
                variant="outline"
                className={`text-xs ${
                  message.sender === "BOT" ? "border-emerald-500 text-emerald-700" : ""
                }`}
              >
                {message.sender}
              </Badge>
            </div>
          )}

          <div className={`rounded-lg px-4 py-2 ${getMessageStyle()}`}>
            {message.content && (
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            )}
            {message.type === "IMAGE" && message.imageUrl && (
              <img
                src={message.imageUrl}
                alt="Imagen enviada"
                className="max-w-full rounded-md mt-2 border"
                onLoad={() => {
                  if (message.sender === "CLIENT") {
                    document
                      .getElementById("chat-bottom-anchor")
                      ?.scrollIntoView({ behavior: "smooth", block: "end" })
                  }
                }}
              />
            )}
          </div>

          <span className="text-xs text-gray-500 mt-1">{timeStr}</span>
        </div>

        {/* avatar del CLIENTE (derecha) usando la misma imagen del título/lista */}
        {isOwn && (
          <Avatar className="w-8 h-8">
            {clientAvatarUrl ? (
              <AvatarImage
                src={clientAvatarUrl}
                alt={message.senderName || "Cliente"}
              />
            ) : (
              <AvatarFallback className="bg-blue-500">
                <User className="h-4 w-4" />
              </AvatarFallback>
            )}
          </Avatar>
        )}
      </div>
    </div>
  )
}
