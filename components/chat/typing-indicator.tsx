"use client"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Bot, User, Headphones } from "lucide-react"

interface TypingIndicatorProps {
  name?: string
  type?: "bot" | "user" | "operator"
}

export function TypingIndicator({ name = "Usuario", type = "user" }: TypingIndicatorProps) {
  const getIcon = () => {
    switch (type) {
      case "bot":
        return <Bot className="h-4 w-4" />
      case "operator":
        return <Headphones className="h-4 w-4" />
      default:
        return <User className="h-4 w-4" />
    }
  }

  const getColor = () => {
    switch (type) {
      case "bot":
        return "bg-blue-500"
      case "operator":
        return "bg-purple-500"
      default:
        return "bg-green-500"
    }
  }

  return (
    <div className="flex items-start space-x-3 mb-4">
      <Avatar className="w-8 h-8">
        <AvatarFallback className={getColor()}>{getIcon()}</AvatarFallback>
      </Avatar>

      <div className="flex flex-col">
        <span className="text-xs font-medium text-gray-600 mb-1">{name}</span>
        <div className="bg-gray-100 rounded-lg px-4 py-2">
          <div className="flex space-x-1">
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
        </div>
      </div>
    </div>
  )
}
