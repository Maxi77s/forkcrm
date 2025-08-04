"use client"

import type React from "react"

import { useRef, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ChatMessage } from "../chat/chat-message"
import { Send, Paperclip, Smile, CheckCircle, Clock } from "lucide-react"

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

interface ChatPanelProps {
  chatId: string | null
  clientId: string | null
  messages: Message[]
  isTyping: boolean
  onSendMessage: (e: React.FormEvent) => void
  inputMessage: string
  setInputMessage: (value: string) => void
  onFinishChat: (chatId: string) => void
  isConnected: boolean
}

export function ChatPanel({
  chatId,
  clientId,
  messages,
  isTyping,
  onSendMessage,
  inputMessage,
  setInputMessage,
  onFinishChat,
  isConnected,
}: ChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  if (!chatId) {
    return (
      <Card className="flex-1 flex flex-col">
        <CardContent className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <Clock className="h-16 w-16 mx-auto mb-4 text-sky-500 opacity-50" />
            <h3 className="text-xl font-medium mb-2">Esperando Asignaciones</h3>
            <p className="text-muted-foreground max-w-md">
              Los chats se asignarán automáticamente cuando los clientes soliciten soporte humano
            </p>
            <div className="flex items-center justify-center space-x-2 mt-6">
              <div className="w-2 h-2 bg-sky-500 rounded-full animate-pulse" />
              <span className="text-sm text-muted-foreground">Esperando...</span>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="flex-1 flex flex-col">
      <CardHeader className="border-b pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Avatar className="h-10 w-10 mr-3">
              <AvatarFallback className="bg-sky-100 text-sky-600">
                {clientId?.substring(0, 2).toUpperCase() || "C"}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-base font-medium">Chat con Cliente {clientId?.substring(0, 8)}...</CardTitle>
              <div className="flex items-center mt-1">
                <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                  Activo
                </Badge>
                <span className="text-xs text-muted-foreground ml-2">ID: {chatId.substring(0, 8)}...</span>
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-green-200 text-green-700 hover:bg-green-50 bg-transparent"
            onClick={() => onFinishChat(chatId)}
            disabled={!isConnected}
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Finalizar Chat
          </Button>
        </div>
      </CardHeader>
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages
            .filter((m) => m.chatId === chatId)
            .map((message) => (
              <ChatMessage
                key={message.id}
                message={{
                  ...message,
                  type: message.type || "TEXT",
                }}
                currentUserId={"OPERADOR"}
              />
            ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-lg px-3 py-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                  <div
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: "150ms" }}
                  />
                  <div
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: "300ms" }}
                  />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>
      <div className="border-t p-4">
        <form onSubmit={onSendMessage} className="flex items-center space-x-2">
          <Button type="button" size="icon" variant="ghost" className="shrink-0" disabled={!isConnected}>
            <Paperclip className="h-5 w-5" />
          </Button>
          <Input
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Escribe un mensaje..."
            disabled={!isConnected}
            className="flex-1"
          />
          <Button type="button" size="icon" variant="ghost" className="shrink-0" disabled={!isConnected}>
            <Smile className="h-5 w-5" />
          </Button>
          <Button
            type="submit"
            size="icon"
            disabled={!isConnected || !inputMessage.trim()}
            className="bg-sky-500 hover:bg-sky-600 shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </Card>
  )
}
