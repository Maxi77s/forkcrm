"use client"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Bot, User, Headphones, Settings } from "lucide-react"

interface Message {
  id: string
  content: string
  sender: "CLIENT" | "BOT" | "OPERADOR" | "SYSTEM"
  timestamp: Date
chatId?: string
  senderName?: string
}

interface ChatMessageProps {
  message: Message
  isOwn?: boolean
  currentUserId?: string
}

export function ChatMessage({ message, isOwn = false, currentUserId }: ChatMessageProps) {
  const getSenderIcon = () => {
    switch (message.sender) {
      case "BOT":
        return <Bot className="h-4 w-4" />
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
        return "bg-blue-500"
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
    if (message.sender === "SYSTEM") {
      return "bg-gray-100 text-gray-700 text-center text-sm italic"
    }
    return isOwn ? "bg-blue-500 text-white ml-auto" : "bg-white border text-gray-900"
  }

  return (
    <div className={`flex ${getMessageAlignment()} mb-4`}>
      <div
        className={`flex items-start space-x-3 max-w-xs lg:max-w-md ${isOwn ? "flex-row-reverse space-x-reverse" : ""}`}
      >
        {!isOwn && message.sender !== "SYSTEM" && (
          <Avatar className="w-8 h-8">
            <AvatarFallback className={getSenderColor()}>{getSenderIcon()}</AvatarFallback>
          </Avatar>
        )}

        <div className={`flex flex-col ${isOwn ? "items-end" : "items-start"}`}>
          {!isOwn && message.sender !== "SYSTEM" && (
            <div className="flex items-center space-x-2 mb-1">
              <span className="text-xs font-medium text-gray-600">{message.senderName || message.sender}</span>
              <Badge variant="outline" className="text-xs">
                {message.sender}
              </Badge>
            </div>
          )}

          <div className={`rounded-lg px-4 py-2 ${getMessageStyle()}`}>
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          </div>

          <span className="text-xs text-gray-500 mt-1">{message.timestamp.toLocaleTimeString()}</span>
        </div>

        {isOwn && (
          <Avatar className="w-8 h-8">
            <AvatarFallback className="bg-blue-500">
              <User className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
        )}
      </div>
    </div>
  )
}
