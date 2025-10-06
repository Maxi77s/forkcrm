"use client"

import { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
const DEFAULT_PAGE_SIZE = 10
const PAGE_STEP = 10

const safeStr = (v: any) => (v === null || v === undefined ? "" : String(v))
const safeLower = (v: any) => safeStr(v).toLowerCase()

// ——— Nombre visible (prioriza lo que venga del back/hook) ———
function deriveDisplayName(chat: any): string {
  // 1) Campos estándar que solemos llenar desde el hook/backend
  const direct =
    chat.clientName ??
    chat.name ??
    chat.displayName ??
    chat.customerName ??
    chat.client_name ??
    chat.customer_name

  if (direct && String(direct).trim().length > 0) return String(direct).trim()

  // 2) Campos anidados comunes por si el DTO viene más “rico”
  const nested =
    chat.client?.name ??
    chat.user?.name ??
    chat.customer?.name ??
    chat.metadata?.clientName ??
    chat.meta?.clientName ??
    chat.profile?.name

  if (nested && String(nested).trim().length > 0) return String(nested).trim()

  // 3) Fallback por teléfono
  const phone: string | undefined = chat.phone ?? chat.client?.phone ?? chat.user?.phone
  const digits = onlyDigits(phone ?? "")
  if (digits) return `+${digits}`

  // 4) Fallback final por ID corto
  const short = safeStr(chat.clientId || chat.chatId || "").slice(0, 8) || "—"
  return `Cliente ${short}...`
}

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map(p => p[0]?.toUpperCase() ?? "").join("") || "U"
}

// helper para reutilizar también en el header del panel derecho
const isEcommerceChat = (chat: ChatPreview) => {
  const p = (chat as any).phone as string | undefined
  const id = safeLower((chat as any).chatId || "")
  const cid = safeLower((chat as any).clientId || "")
  return !p || id.startsWith("ecom:") || cid.startsWith("ecom:")
}

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
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState<number>(DEFAULT_PAGE_SIZE)

  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const scrollAreaRootRef = useRef<HTMLDivElement | null>(null)
  const scrollViewportRef = useRef<HTMLDivElement | null>(null)

  // skeleton solo en el primer load
  const hadDataRef = useRef(false)
  useEffect(() => { if (chats?.length > 0) hadDataRef.current = true }, [chats])
  const showSkeleton = isLoading && !hadDataRef.current

  // localizar viewport real del ScrollArea
  useEffect(() => {
    if (!scrollAreaRootRef.current) return
    const vp = scrollAreaRootRef.current.querySelector<HTMLDivElement>("[data-radix-scroll-area-viewport]")
    if (vp) scrollViewportRef.current = vp
  }, [])

  // filtrar sobre TODOS los chats
  useEffect(() => {
    const term = safeLower(searchTerm).trim()
    const phoneDigits = onlyDigits(phoneTerm.trim())

    const filtered = (chats ?? []).filter((chat: any) => {
      const displayName = safeLower(deriveDisplayName(chat))
      const byText =
        !term ||
        displayName.includes(term) ||
        safeLower(chat.clientId).includes(term) ||
        safeLower(chat.lastMessage).includes(term)

      const chatPhone: string = chat.phone ?? ""
      const chatPhoneDigits = onlyDigits(chatPhone)
      const byPhone = !phoneDigits || chatPhoneDigits.includes(phoneDigits)

      return byText && byPhone
    })

    const sameSize = filtered.length === filteredChats.length
    const sameKeys =
      sameSize &&
      filtered.every((c, i) =>
        (c as any).chatId === (filteredChats[i] as any)?.chatId &&
        (c as any).lastMessageTime === (filteredChats[i] as any)?.lastMessageTime &&
        (c as any).unreadCount === (filteredChats[i] as any)?.unreadCount
      )

    if (!sameKeys) setFilteredChats(filtered)
    if (expandedId && !filtered.some((c: any) => c.chatId === expandedId)) setExpandedId(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chats, searchTerm, phoneTerm])

  // reset paginación solo al cambiar filtros
  useEffect(() => { setVisibleCount(DEFAULT_PAGE_SIZE) }, [searchTerm, phoneTerm])

  const displayedChats = useMemo(
    () => filteredChats.slice(0, Math.min(visibleCount, filteredChats.length)),
    [filteredChats, visibleCount]
  )

  // estabilizar scroll en prepend
  const prevListRef = useRef<ChatPreview[]>(displayedChats)
  const prevScrollHRef = useRef<number>(0)
  useLayoutEffect(() => {
    const vp = scrollViewportRef.current
    if (vp) prevScrollHRef.current = vp.scrollHeight
  }, [displayedChats])
  useLayoutEffect(() => {
    const vp = scrollViewportRef.current
    if (!vp) return
    const prevFirst = (prevListRef.current[0] as any)?.chatId
    const currFirst = (displayedChats[0] as any)?.chatId
    const prevFirstStillInside = prevFirst && (displayedChats as any[]).some(c => c.chatId === prevFirst)
    const isPrepend = prevFirst && currFirst && prevFirst !== currFirst && prevFirstStillInside
    if (isPrepend) {
      const prevBehavior = vp.style.scrollBehavior
      vp.style.scrollBehavior = "auto"
      const delta = vp.scrollHeight - prevScrollHRef.current
      if (delta > 0) vp.scrollTop += delta
      vp.style.scrollBehavior = prevBehavior || ""
    }
    prevListRef.current = displayedChats
  }, [displayedChats])

  // auto-scroll solo cuando cambia la selección
  useEffect(() => {
    if (!selectedChatId) return
    const el = itemRefs.current[selectedChatId]
    if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }, [selectedChatId])

  const setItemRef = useCallback((chatId: string) => (el: HTMLDivElement | null) => {
    itemRefs.current[chatId] = el
  }, [])

  const formatTime = (date?: Date | string) => {
    if (!date) return ""
    const d = new Date(date)
    if (isNaN(d.getTime())) return ""
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
      case "FINISHED":
      case "COMPLETED": return "bg-gray-400"
      case "CANCELLED": return "bg-red-400"
      case "IN_QUEUE": return "bg-blue-400"
      case "TIMEOUT_FALLBACK": return "bg-purple-400"
      default: return "bg-gray-300"
    }
  }
  const getStatusText = (status: string) => {
    switch (status) {
      case "ACTIVE": return "Activo"
      case "WAITING": return "Esperando"
      case "FINISHED":
      case "COMPLETED": return "Finalizado"
      case "CANCELLED": return "Cancelado"
      case "IN_QUEUE": return "En cola"
      case "TIMEOUT_FALLBACK": return "Fallback IA"
      default: return "Desconocido"
    }
  }

  const listHeightClass = "h-[calc(100dvh-200px)]"
  const toggleExpand = (id: string) => setExpandedId(prev => (prev === id ? null : id))
  const openWA = (phone?: string) => { const d = onlyDigits(phone ?? ""); if (d) window.open(`https://wa.me/${d}`, "_blank", "noopener,noreferrer") }
  const callTel = (phone?: string) => { const d = onlyDigits(phone ?? ""); if (d) window.location.href = `tel:+${d}` }

  const canLoadMore = visibleCount < filteredChats.length
  const handleLoadMore = () => setVisibleCount(prev => Math.min(prev + PAGE_STEP, filteredChats.length))

  return (
    <Card className="h-full flex flex-col border-0 rounded-none bg-white shadow-sm overflow-hidden">
      <CardHeader className="pb-4 border-b bg-gradient-to-r from-white to-slate-50 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold flex items-center text-gray-800">
            <MessageSquare className="h-6 w-6 mr-3 text-sky-500" />
            Chats ({chats.length})
          </CardTitle>
          {onNewChat && (
            <Button size="sm" onClick={onNewChat} className="bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 shadow-md">
              Nuevo Chat
            </Button>
          )}
        </div>

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

      <CardContent className="p-0 relative">
        {isLoading && hadDataRef.current && (
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-500 via-blue-400 to-sky-500 animate-pulse opacity-70" />
        )}

        <div ref={scrollAreaRootRef}>
          <ScrollArea className={cn("w-full", listHeightClass)}>
            {showSkeleton ? (
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
              <>
                <div className="divide-y divide-gray-100">
                  {displayedChats.map((chat: any) => {
                    const isExpanded = expandedId === chat.chatId
                    const phone = chat.phone as string | undefined
                    const ecommerce = isEcommerceChat(chat)

                    const displayName = deriveDisplayName(chat)
                    const initials = initialsFromName(displayName)

                    const lastMessage = safeStr(chat.lastMessage)
                    const showBotIcon =
                      /(^hola\b)|(^¡hola\b)|bienvenido|asistente|bot/i.test(lastMessage || "")

                    return (
                      <div
                        key={chat.chatId}
                        ref={setItemRef(chat.chatId)}
                        onDoubleClick={() => toggleExpand(chat.chatId)}
                        className={cn(
                          "group relative transition-colors duration-200",
                          isExpanded ? "bg-white" : "hover:bg-gradient-to-r hover:from-slate-50 hover:to-blue-50"
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
                          <div className="relative mr-4 mt-0.5 shrink-0">
                            <Avatar className={cn("h-14 w-14 shadow-sm", selectedChatId === chat.chatId && "ring-2 ring-sky-200")}>
                              {chat.avatar ? (
                                <AvatarImage src={chat.avatar} alt={displayName} />
                              ) : null}
                              <AvatarFallback className="bg-gradient-to-r from-blue-100 to-blue-200 text-blue-700 font-semibold">
                                {initials || <User className="h-6 w-6" />}
                              </AvatarFallback>
                            </Avatar>
                            {chat.isOnline && (
                              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 border-2 border-white rounded-full shadow-sm" />
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="flex min-w-0 flex-1 items-center gap-2">
                                <h4 className="font-bold text-gray-800 truncate text-lg">{displayName}</h4>
                                {ecommerce && (
                                  <Badge className="shrink-0 bg-green-100 text-green-700 border border-green-200">
                                    E-commerce
                                  </Badge>
                                )}
                              </div>

                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 opacity-70 hover:opacity-100 shrink-0"
                                onClick={(e) => { e.stopPropagation(); toggleExpand(chat.chatId) }}
                                title={isExpanded ? "Contraer" : "Expandir"}
                              >
                                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </Button>
                            </div>

                            {/* Teléfono + estado */}
                            <div className="flex items-center justify-between mt-0.5">
                              <div className="flex items-center gap-2">
                                {phone && <span className="text-xs text-gray-500 font-mono">+{onlyDigits(phone)}</span>}
                                <div className="flex items-center gap-1">
                                  <div className={cn("w-2 h-2 rounded-full shadow-sm", getStatusColor(chat.status))} />
                                  <span className="text-xs text-gray-500">{getStatusText(chat.status)}</span>
                                </div>
                              </div>
                              <span className="text-xs text-gray-500 font-medium">
                                {formatTime(chat.lastMessageTime)}
                              </span>
                            </div>

                            {/* Mensaje */}
                            <div className={cn("mt-1 text-sm text-gray-700", isExpanded ? "whitespace-normal break-words" : "truncate max-w-[260px]")}>
                              {showBotIcon && <Bot className="inline h-3 w-3 mr-1 text-purple-500" />}
                              {lastMessage || "—"}
                            </div>

                            {/* ID + unread */}
                            <div className="mt-2">
                              <span className="text-xs text-gray-400 font-mono bg-gray-100 px-2 py-1 rounded-full">
                                {isExpanded ? `ID: ${chat.chatId}` : `ID: ${safeStr(chat.chatId).slice(0, 8) || "—"}...`}
                              </span>
                              {chat.unreadCount > 0 && (
                                <Badge className="ml-2 bg-gradient-to-r from-sky-500 to-sky-600 text-white text-xs min-w-[24px] h-5 rounded-full">
                                  {chat.unreadCount > 99 ? "99+" : chat.unreadCount}
                                </Badge>
                              )}
                            </div>

                            {/* Acciones extra (solo si hay teléfono) */}
                            {isExpanded && (
                              <div className="mt-3 flex items-center gap-2">
                                {phone && (
                                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); openWA(phone) }}>
                                    <MessageSquareText className="h-4 w-4" />
                                    <span className="ml-1 text-xs">WhatsApp</span>
                                  </Button>
                                )}
                                {phone && (
                                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); callTel(phone) }}>
                                    <Phone className="h-4 w-4" />
                                    <span className="ml-1 text-xs">Llamar</span>
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Footer paginación */}
                <div className="p-4 flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    Mostrando <span className="font-semibold">{displayedChats.length}</span> de{" "}
                    <span className="font-semibold">{filteredChats.length}</span> chats
                  </span>
                  {canLoadMore && (
                    <Button variant="outline" size="sm" onClick={handleLoadMore} className="rounded-full">
                      Más chats
                    </Button>
                  )}
                </div>
              </>
            )}
            <ScrollBar orientation="vertical" />
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  )
}

export default ChatList
