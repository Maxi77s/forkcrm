"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Search, MessageSquare, User, Bot, Phone, ChevronDown, ChevronUp, MessageSquareText } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ChatPreview } from "@/types/chats"

interface ChatListProps {
  chats: ChatPreview[]
  selectedChatId: string | null
  onChatSelect: (chatId: string) => void
  onNewChat?: () => void
  isLoading?: boolean
  page?: number
  limit?: number
  items?: number
}

const onlyDigits = (s: string) => s.replace(/[^\d]/g, "")

export function ChatList({
  chats,
  selectedChatId,
  onChatSelect,
  onNewChat,
  isLoading = false,
}: ChatListProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [phoneTerm, setPhoneTerm] = useState("")
  const [filteredChats, setFilteredChats] = useState<ChatPreview[]>(chats)
  const [expandedId, setExpandedId] = useState<string | null>(null)   // ✅ fila expandida

  // refs por item para auto-scroll al seleccionado
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    const term = searchTerm.toLowerCase().trim()
    const phoneDigits = onlyDigits(phoneTerm.trim())

    const filtered = chats.filter((chat) => {
      const name = ((chat as any).clientName ?? (chat as any).name ?? "").toLowerCase()
      const byText =
        !term ||
        name.includes(term) ||
        chat.clientId.toLowerCase().includes(term) ||
        chat.lastMessage.toLowerCase().includes(term)

      const chatPhone: string = (chat as any).phone ?? ""
      const chatPhoneDigits = onlyDigits(chatPhone)
      const byPhone = !phoneDigits || chatPhoneDigits.includes(phoneDigits)

      return byText && byPhone
    })

    setFilteredChats(filtered)

    // si la expandida fue filtrada, cerrarla
    if (expandedId && !filtered.some(c => c.chatId === expandedId)) {
      setExpandedId(null)
    }
  }, [chats, searchTerm, phoneTerm, expandedId])

  useEffect(() => {
    if (!selectedChatId) return
    const el = itemRefs.current[selectedChatId]
    if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }, [selectedChatId, filteredChats])

  const setItemRef = useCallback((chatId: string) => (el: HTMLDivElement | null) => {
    itemRefs.current[chatId] = el
  }, [])

  const formatTime = (date?: Date) => {
    if (!date || isNaN(new Date(date).getTime())) return ""
    const d = new Date(date)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    if (days === 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    if (days === 1) return "Ayer"
    if (days < 7) return d.toLocaleDateString([], { weekday: "short" })
    return d.toLocaleDateString([], { day: "2-digit", month: "2-digit" })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE": return "bg-green-500"
      case "WAITING": return "bg-amber-500"
      case "FINISHED": return "bg-gray-400"
      default: return "bg-gray-400"
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case "ACTIVE": return "Activo"
      case "WAITING": return "Esperando"
      case "FINISHED": return "Finalizado"
      default: return "Desconocido"
    }
  }

  const listHeightClass = "h-[calc(100dvh-200px)]"

  const toggleExpand = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id))
  }

  const openWA = (phone?: string) => {
    const d = onlyDigits(phone ?? "")
    if (d) window.open(`https://wa.me/${d}`, "_blank", "noopener,noreferrer")
  }

  const callTel = (phone?: string) => {
    const d = onlyDigits(phone ?? "")
    if (d) window.location.href = `tel:+${d}`
  }

  return (
    <Card className="h-full flex flex-col border-0 rounded-none bg-white shadow-sm overflow-hidden">
      <CardHeader className="pb-4 border-b bg-gradient-to-r from-white to-slate-50 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold flex items-center text-gray-800">
            <MessageSquare className="h-6 w-6 mr-3 text-sky-500" />
            Chats ({chats.length})
          </CardTitle>
          {onNewChat && (
            <Button
              size="sm"
              onClick={onNewChat}
              className="bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 shadow-md"
            >
              Nuevo Chat
            </Button>
          )}
        </div>

        {/* Filtros */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar por nombre, ID o mensaje…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 border-gray-300 focus:border-sky-500 focus:ring-sky-500 rounded-full shadow-sm"
            />
          </div>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Teléfono (ej. +549351...)"
              inputMode="tel"
              value={phoneTerm}
              onChange={(e) => setPhoneTerm(e.target.value)}
              className="pl-10 border-gray-300 focus:border-sky-500 focus:ring-sky-500 rounded-full shadow-sm"
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <ScrollArea className={cn("w-full", listHeightClass)}>
          {isLoading ? (
            <div className="p-4 space-y-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center space-x-4 p-4 animate-pulse">
                  <div className="w-12 h-12 bg-gray-200 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredChats.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-96 text-center p-6">
              <div className="bg-slate-100 rounded-full p-6 mb-6">
                <MessageSquare className="h-16 w-16 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">
                {searchTerm || phoneTerm ? "No se encontraron chats" : "No hay chats disponibles"}
              </h3>
              <p className="text-gray-500 max-w-sm">
                {searchTerm || phoneTerm
                  ? "Probá con otros términos o quita filtros"
                  : "Los chats aparecerán aquí cuando los clientes inicien conversaciones"}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredChats.map((chat) => {
                const isExpanded = expandedId === chat.chatId
                const phone = (chat as any).phone as string | undefined

                return (
                  <div
                    key={chat.chatId}
                    ref={setItemRef(chat.chatId)}
                    onDoubleClick={() => toggleExpand(chat.chatId)}   // ✅ doble click expande
                    className={cn(
                      "group relative transition-colors duration-200",
                      isExpanded
                        ? "bg-white"
                        : "hover:bg-gradient-to-r hover:from-slate-50 hover:to-blue-50"
                    )}
                  >
                    <div
                      className={cn(
                        "flex items-start p-4 cursor-pointer",
                        selectedChatId === chat.chatId && "bg-gradient-to-r from-sky-50 to-blue-50 border-r-4 border-sky-500 shadow-sm"
                      )}
                      onClick={() => onChatSelect(chat.chatId)}
                    >
                      {/* Avatar */}
                      <div className="relative mr-4 mt-0.5">
                        <Avatar className={cn("h-14 w-14 shadow-sm", selectedChatId === chat.chatId && "ring-2 ring-sky-200")}>
                          <AvatarFallback className="bg-gradient-to-r from-blue-100 to-blue-200 text-blue-700 font-semibold">
                            <User className="h-6 w-6" />
                          </AvatarFallback>
                        </Avatar>
                        {chat.isOnline && (
                          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 border-2 border-white rounded-full shadow-sm" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-gray-800 truncate text-lg">
                            {(chat as any).clientName ? (chat as any).clientName : `Cliente ${chat.clientId.substring(0, 8)}...`}
                          </h4>

                          {/* Botón expandir */}
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 opacity-70 hover:opacity-100"
                            onClick={(e) => { e.stopPropagation(); toggleExpand(chat.chatId) }}
                            title={isExpanded ? "Contraer" : "Expandir"}
                          >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                        </div>

                        {/* Teléfono (si existe) y hora */}
                        <div className="flex items-center justify-between mt-0.5">
                          <div className="flex items-center gap-2">
                            {phone && <span className="text-xs text-gray-500 font-mono">+{onlyDigits(phone)}</span>}
                            <div className="flex items-center gap-1">
                              <div className={cn("w-2 h-2 rounded-full shadow-sm", getStatusColor((chat as any).status))} />
                              <span className="text-xs text-gray-500">{getStatusText((chat as any).status)}</span>
                            </div>
                          </div>
                          <span className="text-xs text-gray-500 font-medium">
                            {formatTime((chat as any).lastMessageTime)}
                          </span>
                        </div>

                        {/* Mensaje (truncado o completo según expandido) */}
                        <div className={cn("mt-1 text-sm text-gray-700", isExpanded ? "whitespace-normal break-words" : "truncate max-w-[220px]")}>
                          {chat.lastMessage.includes("¡Hola") && <Bot className="inline h-3 w-3 mr-1 text-purple-500" />}
                          {chat.lastMessage}
                        </div>

                        {/* ID */}
                        <div className="mt-2">
                          <span className="text-xs text-gray-400 font-mono bg-gray-100 px-2 py-1 rounded-full">
                            {isExpanded ? `ID: ${chat.chatId}` : `ID: ${chat.chatId.substring(0, 8)}...`}
                          </span>
                          {chat.unreadCount > 0 && (
                            <Badge className="ml-2 bg-gradient-to-r from-sky-500 to-sky-600 text-white text-xs min-w-[24px] h-5 rounded-full">
                              {chat.unreadCount > 99 ? "99+" : chat.unreadCount}
                            </Badge>
                          )}
                        </div>

                        {/* Controles extra cuando está expandido */}
                        {isExpanded && (
                          <div className="mt-3 flex items-center gap-2">
                            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); openWA(phone) }}>
                              <MessageSquareText className="h-4 w-4" />
                              <span className="ml-1 text-xs">WhatsApp</span>
                            </Button>
                            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); callTel(phone) }}>
                              <Phone className="h-4 w-4" />
                              <span className="ml-1 text-xs">Llamar</span>
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          <ScrollBar orientation="vertical" />
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

export default ChatList
