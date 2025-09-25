"use client"

import type React from "react"
import { useState, useRef, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ChatMessage } from "./chat-message"
import {
  Send,
  Paperclip,
  Smile,
  Phone,
  Video,
  CheckCircle,
  Clock,
  User,
  Bot,
  MessageSquareText,
} from "lucide-react"
import type {
  Message as ChatMsgFromTypes,
  ChatInfo,
  ChatOption,
} from "@/types/chats"

/** Tipo local compatible con ChatMessage (sin "OPTIONS") */
type DisplayMessage = Omit<ChatMsgFromTypes, "type"> & { type: "TEXT" | "IMAGE" }

interface ChatInterfaceProps {
  chatInfo: ChatInfo | null
  messages: ChatMsgFromTypes[] // puede venir con "TEXT" | "IMAGE" | "OPTIONS"
  isTyping: boolean
  onSendMessage: (message: string) => void
  onFinishChat: () => void
  onStartTyping?: () => void
  onStopTyping?: () => void
  onTransferChat?: () => void
  isConnected: boolean
}

export function ChatInterface({
  chatInfo,
  messages,
  isTyping,
  onSendMessage,
  onFinishChat,
  onStartTyping,
  onStopTyping,
  onTransferChat,
  isConnected,
}: ChatInterfaceProps) {
  const [inputMessage, setInputMessage] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Normalizar mensajes para ChatMessage
  const displayMessages: DisplayMessage[] = useMemo(
    () =>
      messages
        .filter((m) => m.type !== "OPTIONS")
        .map((m) => ({ ...(m as any), type: m.type as "TEXT" | "IMAGE" })),
    [messages],
  )

  const lastClientMessage = useMemo(
    () =>
      [...displayMessages]
        .reverse()
        .find((m) => m.sender === "CLIENT" && m.type === "TEXT"),
    [displayMessages],
  )

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInputMessage(value)
    if (value && onStartTyping) onStartTyping()
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => {
      if (onStopTyping) onStopTyping()
    }, 1000)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (inputMessage.trim() && isConnected) {
      onSendMessage(inputMessage.trim())
      setInputMessage("")
      if (onStopTyping) onStopTyping()
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    }
  }

  const handleQuickReply = (text: string) => onSendMessage(text)

  const formatLastSeen = (date?: Date) => {
    if (!date) return "Nunca visto"
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / (1000 * 60))
    if (minutes < 1) return "Activo ahora"
    if (minutes < 60) return `Visto hace ${minutes}m`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `Visto hace ${hours}h`
    const days = Math.floor(hours / 24)
    return `Visto hace ${days}d`
  }

  if (!chatInfo) {
    return (
      <Card className="h-full flex items-center justify-center border-0 rounded-none bg-gradient-to-br from-slate-50 to-slate-100">
        <CardContent className="text-center">
          <div className="bg-white rounded-full p-6 shadow-lg mb-6">
            <Clock className="h-16 w-16 mx-auto text-sky-500" />
          </div>
          <h3 className="text-2xl font-bold text-gray-800 mb-2">
            Selecciona un chat
          </h3>
          <p className="text-gray-600 max-w-md">
            Elige una conversación de la lista para comenzar a chatear con el
            cliente
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full flex flex-col border-0 rounded-none bg-white">
      {/* ======= CABECERA estilo mock ======= */}
      <CardHeader className="border-b bg-[#0f172a] text-white pb-5">
        <div className="flex items-start gap-4">
          {/* Col: Avatar + nombre */}
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 ring-2 ring-white/20">
              <AvatarFallback className="bg-slate-200 text-slate-700">
                <User className="h-5 w-5" />
              </AvatarFallback>
            </Avatar>
            <div className="leading-tight">
              <p className="font-semibold">{chatInfo.clientName ?? "Cliente"}</p>
              <p className="text-xs text-slate-300">
                {formatLastSeen(chatInfo.lastSeen)}
              </p>
            </div>
          </div>

          {/* Píldora origen WhatsApp */}
          <div className="ml-auto">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-md text-xs font-semibold bg-emerald-600/20 text-emerald-300 border border-emerald-500/30">
              <MessageSquareText className="h-3.5 w-3.5" />
              WHATSAPP INBOUND
            </span>
          </div>
        </div>

        {/* Panel de conversación tipo “tarjeta” */}
        <div className="mt-4 rounded-xl border border-white/15 bg-white/5 p-4">
          <div className="flex items-center justify-between">
            <p className="font-semibold">
              {chatInfo.clientName ?? "Santiago"}:
            </p>
            <Avatar className="h-7 w-7 ring-2 ring-white/20">
              <AvatarFallback className="bg-slate-200 text-slate-700">
                <Bot className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
          </div>

          <p className="mt-1 text-sm text-slate-200">
            NRO. de contacto <span className="font-mono">—</span>
          </p>

          {/* Burbuja del último mensaje del cliente (si existe) */}
          {lastClientMessage?.content && (
            <div className="mt-3">
              <div className="inline-block max-w-[640px] rounded-lg bg-white/10 px-3 py-2 text-sm text-slate-100">
                {lastClientMessage.content}
              </div>
            </div>
          )}

          {/* Pregunta + botones rápidos */}
          <div className="mt-3">
            <div className="text-xs text-slate-300 mb-2">
              ¿En qué sede te deseas atender?
            </div>
            <div className="flex flex-wrap gap-2">
              {["Mega plaza", "Surco", "Otro"].map((label) => (
                <Button
                  key={label}
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={() => handleQuickReply(label)}
                  className="rounded-md border-white/20 bg-white/5 text-slate-100 hover:bg-white/10 hover:text-white"
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Acciones de cabecera (derecha abajo) */}
        <div className="mt-4 flex items-center gap-2">
          <Button size="sm" variant="secondary" className="bg-white/10 text-white hover:bg-white/20">
            <Phone className="h-4 w-4 mr-2" />
            Llamar
          </Button>
          <Button size="sm" variant="secondary" className="bg-white/10 text-white hover:bg-white/20">
            <Video className="h-4 w-4 mr-2" />
            Video
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onFinishChat}
            className="ml-auto text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/10 bg-transparent"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Finalizar
          </Button>
        </div>
      </CardHeader>

      {/* ======= MENSAJES ======= */}
      <ScrollArea className="flex-1 bg-gradient-to-b from-slate-50/50 to-white">
        <div className="p-6 space-y-1">
          {displayMessages.length === 0 && (
            <div className="text-center py-12">
              <div className="bg-white rounded-full p-4 shadow-lg mb-4 inline-block">
                <Bot className="h-8 w-8 text-purple-500" />
              </div>
              <h4 className="text-lg font-semibold text-gray-700 mb-2">
                ¡Conversación iniciada!
              </h4>
              <p className="text-gray-500">Los mensajes aparecerán aquí</p>
            </div>
          )}

          {displayMessages.map((message) => (
            <ChatMessage key={message.id} message={message} currentUserId="OPERADOR" />
          ))}

          {isTyping && (
            <div className="flex justify-start mb-4">
              <div className="bg-gradient-to-r from-gray-100 to-gray-200 rounded-2xl px-4 py-3 max-w-xs shadow-sm">
                <div className="flex items-center space-x-2">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 rounded-full animate-bounce bg-gray-400" />
                    <div className="w-2 h-2 rounded-full animate-bounce bg-gray-400" style={{ animationDelay: "150ms" }} />
                    <div className="w-2 h-2 rounded-full animate-bounce bg-gray-400" style={{ animationDelay: "300ms" }} />
                  </div>
                  <span className="text-xs text-gray-500 font-medium">
                    Escribiendo...
                  </span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* ======= INPUT ======= */}
      <div className="border-t bg-white p-4">
        <form onSubmit={handleSubmit} className="flex items-center space-x-3">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            disabled={!isConnected}
            className="hover:bg-slate-100"
          >
            <Paperclip className="h-5 w-5" />
          </Button>

          <div className="flex-1 relative">
            <Input
              value={inputMessage}
              onChange={handleInputChange}
              placeholder={isConnected ? "Escribe un mensaje..." : "Desconectado..."}
              disabled={!isConnected || chatInfo?.status !== "ACTIVE"}
              className="pr-12 h-12 border-gray-300 focus:border-sky-500 focus:ring-sky-500 rounded-full shadow-sm"
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              disabled={!isConnected}
              className="absolute right-1 top-1 hover:bg-slate-100 rounded-full"
            >
              <Smile className="h-5 w-5" />
            </Button>
          </div>

          <Button
            type="submit"
            size="icon"
            disabled={!isConnected || !inputMessage.trim() || chatInfo?.status !== "ACTIVE"}
            className="bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 shadow-md h-12 w-12 rounded-full"
          >
            <Send className="h-5 w-5" />
          </Button>
        </form>
      </div>
    </Card>
  )
}
