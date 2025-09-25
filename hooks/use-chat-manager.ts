// src/hooks/use-chat-manager.ts
"use client"

import { useEffect, useState } from "react"
import { useSocket } from "@/hooks/use-socket"
import { useAuth } from "@/components/providers/auth-provider"

type ChatStatus = "ACTIVE" | "WAITING" | "FINISHED"

export interface ChatItem {
  chatId: string
  clientId: string
  clientName?: string
  status: ChatStatus
  isOnline: boolean
  lastMessageTime: Date
  lastMessagePreview?: string
}

export interface ChatMessage {
  id: string
  chatId: string
  sender: "CLIENT" | "BOT" | "OPERADOR" | "SYSTEM"
  content: string
  type: "TEXT" | "IMAGE"
  imageUrl?: string
  timestamp: Date
}

/** ========= MODO MOCK (forzado) =========
 *  Deja todo hardcodeado para probar estilos y flujo.
 *  Para volver al back real, pon useMock = (process.env.NEXT_PUBLIC_CHAT_MOCK === "1")
 */
const useMock = true

const now = new Date()
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000)

// ------- CHATS MOCKEADOS -------
const MOCK_CHATS: ChatItem[] = [
  {
    chatId: "c-1001",
    clientId: "u-aaa111",
    clientName: "Carla Benítez",
    status: "ACTIVE",
    isOnline: true,
    lastMessageTime: minutesAgo(2),
    lastMessagePreview: "¿Tienen turno para mañana?",
  },
  {
    chatId: "c-1002",
    clientId: "u-bbb222",
    clientName: "Lucas Romero",
    status: "WAITING",
    isOnline: false,
    lastMessageTime: minutesAgo(42),
    lastMessagePreview: "Quiero ver precios",
  },
  {
    chatId: "c-1003",
    clientId: "u-ccc333",
    clientName: "María López",
    status: "ACTIVE",
    isOnline: true,
    lastMessageTime: minutesAgo(5),
    lastMessagePreview: "Gracias!",
  },
  {
    chatId: "c-1004",
    clientId: "u-ddd444",
    clientName: "Julián Vega",
    status: "FINISHED",
    isOnline: false,
    lastMessageTime: minutesAgo(120),
    lastMessagePreview: "Nos vemos 👍",
  },
  {
    chatId: "c-1005",
    clientId: "u-eee555",
    clientName: "Paula Fernández",
    status: "ACTIVE",
    isOnline: true,
    lastMessageTime: minutesAgo(12),
    lastMessagePreview: "¿Hay promo 2x1?",
  },
  {
    chatId: "c-1006",
    clientId: "u-fff666",
    clientName: "Sofía Rivas",
    status: "WAITING",
    isOnline: true,
    lastMessageTime: minutesAgo(30),
    lastMessagePreview: "¿Me pasás el catálogo?",
  },
  {
    chatId: "c-1007",
    clientId: "u-ggg777",
    clientName: "Tomás Quiroga",
    status: "ACTIVE",
    isOnline: false,
    lastMessageTime: minutesAgo(9),
    lastMessagePreview: "Envío una foto",
  },
  {
    chatId: "c-1008",
    clientId: "u-hhh888",
    clientName: "Luz Martínez",
    status: "FINISHED",
    isOnline: false,
    lastMessageTime: minutesAgo(300),
    lastMessagePreview: "Muchas gracias por la atención",
  },
]

// ------- MENSAJES MOCKEADOS -------
const MOCK_MESSAGES: ChatMessage[] = [
  // c-1001 Carla
  { id: "m-1001-1", chatId: "c-1001", sender: "BOT", content: "¡Hola! Soy tu asistente 🤖", type: "TEXT", timestamp: minutesAgo(25) },
  { id: "m-1001-2", chatId: "c-1001", sender: "CLIENT", content: "¿Tienen turno para mañana?", type: "TEXT", timestamp: minutesAgo(2) },

  // c-1002 Lucas (WAITING)
  { id: "m-1002-1", chatId: "c-1002", sender: "CLIENT", content: "Quiero ver precios", type: "TEXT", timestamp: minutesAgo(42) },

  // c-1003 María
  { id: "m-1003-1", chatId: "c-1003", sender: "CLIENT", content: "Hola! Me pasás info de depilación?", type: "TEXT", timestamp: minutesAgo(14) },
  { id: "m-1003-2", chatId: "c-1003", sender: "OPERADOR", content: "¡Claro! ¿Zona a depilar y disponibilidad?", type: "TEXT", timestamp: minutesAgo(8) },
  { id: "m-1003-3", chatId: "c-1003", sender: "CLIENT", content: "Piernas y axilas. Mañana a la tarde.", type: "TEXT", timestamp: minutesAgo(6) },
  { id: "m-1003-4", chatId: "c-1003", sender: "OPERADOR", content: "Perfecto. Te reservo 16:30?", type: "TEXT", timestamp: minutesAgo(5) },
  { id: "m-1003-5", chatId: "c-1003", sender: "CLIENT", content: "Gracias!", type: "TEXT", timestamp: minutesAgo(5) },

  // c-1004 Julián (FINISHED)
  { id: "m-1004-1", chatId: "c-1004", sender: "OPERADOR", content: "¿Puedo ayudarte con algo más?", type: "TEXT", timestamp: minutesAgo(121) },
  { id: "m-1004-2", chatId: "c-1004", sender: "CLIENT", content: "Nos vemos 👍", type: "TEXT", timestamp: minutesAgo(120) },
  { id: "m-1004-3", chatId: "c-1004", sender: "SYSTEM", content: "La conversación se finalizó. ¡Gracias por escribirnos!", type: "TEXT", timestamp: minutesAgo(119) },

  // c-1005 Paula
  { id: "m-1005-1", chatId: "c-1005", sender: "CLIENT", content: "¿Hay promo 2x1?", type: "TEXT", timestamp: minutesAgo(12) },

  // c-1006 Sofía (WAITING)
  { id: "m-1006-1", chatId: "c-1006", sender: "CLIENT", content: "¿Me pasás el catálogo?", type: "TEXT", timestamp: minutesAgo(30) },

  // c-1007 Tomás
  { id: "m-1007-1", chatId: "c-1007", sender: "CLIENT", content: "Envío una foto", type: "TEXT", timestamp: minutesAgo(9) },
  { id: "m-1007-2", chatId: "c-1007", sender: "CLIENT", content: "", type: "IMAGE", imageUrl: "https://images.unsplash.com/photo-1520975922284-3b27c7c4f853?w=1200&q=80", timestamp: minutesAgo(9) },

  // c-1008 Luz (FINISHED)
  { id: "m-1008-1", chatId: "c-1008", sender: "CLIENT", content: "Muchas gracias por la atención", type: "TEXT", timestamp: minutesAgo(300) },
]

/** ===== helpers ===== */
function upsertChat(list: ChatItem[], incoming: ChatItem): ChatItem[] {
  const i = list.findIndex((c) => c.chatId === incoming.chatId)
  if (i === -1) {
    return [incoming, ...list].sort((a, b) => b.lastMessageTime.getTime() - a.lastMessageTime.getTime())
  }
  const updated = [...list]
  updated[i] = { ...updated[i], ...incoming }
  return updated.sort((a, b) => b.lastMessageTime.getTime() - a.lastMessageTime.getTime())
}

export function useChatManager() {
  const [chats, setChats] = useState<ChatItem[]>(useMock ? MOCK_CHATS : [])
  const [messages, setMessages] = useState<ChatMessage[]>(useMock ? MOCK_MESSAGES : [])
  const [isTyping, setIsTyping] = useState(false)
  const [typingChatId, setTypingChatId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(useMock ? false : true)

  // aunque no lo uses en mock, mantenemos las firmas
  const apiBase = process.env.NEXT_PUBLIC_WS_URL?.replace(/\/$/, "") || "http://localhost:3002"
  const { token } = useAuth()
  const { socket, isConnected } = useSocket({
    // en mock no se usará, pero dejamos la misma interfaz
    serverUrl: apiBase,
    requireToken: true,
  })

  /** Cargar lista desde back si NO es mock */
  useEffect(() => {
    if (useMock) return
    ;(async () => {
      try {
        setIsLoading(true)
        const res = await fetch(`${apiBase}/chats`, {
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        })
        if (!res.ok) throw new Error(`GET /chats ${res.status}`)
        const data = await res.json()
        const mapped: ChatItem[] = (data || []).map((c: any) => ({
          chatId: c.id,
          clientId: c.userId,
          clientName: c.clientName,
          status: c.status === "CLOSED" ? "FINISHED" : (c.status as "ACTIVE" | "WAITING"),
          isOnline: true,
          lastMessageTime: new Date(c.updatedAt ?? c.createdAt ?? Date.now()),
          lastMessagePreview: c.lastMessage?.content ?? "",
        }))
        setChats(mapped)
      } catch (e) {
        console.error("Error cargando /chats", e)
      } finally {
        setIsLoading(false)
      }
    })()
  }, [apiBase, token])

  /** Suscripciones WS si NO es mock */
  useEffect(() => {
    if (useMock || !socket) return

    const onChatCreated = (payload: any) => {
      const item: ChatItem = {
        chatId: payload.id,
        clientId: payload.userId,
        clientName: payload.clientName,
        status: payload.status === "CLOSED" ? "FINISHED" : (payload.status as ChatStatus),
        isOnline: true,
        lastMessageTime: new Date(payload.updatedAt ?? payload.createdAt ?? Date.now()),
        lastMessagePreview: payload.firstMessage?.content ?? "Nuevo chat",
      }
      setChats((prev) => upsertChat(prev, item))
    }

    const onOperatorAssigned = (payload: any) => {
      setChats((prev) =>
        upsertChat(prev, {
          ...(prev.find((c) => c.chatId === payload.chatId) ?? {
            chatId: payload.chatId,
            clientId: payload.userId ?? "unknown",
            clientName: payload.clientName,
            status: "ACTIVE",
            isOnline: true,
            lastMessageTime: new Date(),
            lastMessagePreview: "",
          }),
          status: "ACTIVE",
        }),
      )
    }

    const onNewMessage = (p: any) => {
      const msg: ChatMessage = {
        id: p.id ?? `m-${Date.now()}`,
        chatId: p.chatId,
        sender: p.sender === "OPERATOR" ? "OPERADOR" : p.sender,
        content: p.content,
        type: "TEXT",
        timestamp: new Date(p.createdAt ?? Date.now()),
      }
      setMessages((prev) => [...prev, msg])
      setChats((prev) =>
        upsertChat(prev, {
          ...(prev.find((c) => c.chatId === p.chatId) ?? {
            chatId: p.chatId,
            clientId: p.userId ?? "unknown",
            clientName: p.clientName,
            status: "ACTIVE",
            isOnline: true,
            lastMessageTime: msg.timestamp,
            lastMessagePreview: msg.content,
          }),
          lastMessageTime: msg.timestamp,
          lastMessagePreview: msg.content,
        }),
      )
    }

    const onChatStatusChanged = (p: any) => {
      setChats((prev) =>
        prev.map((c) =>
          c.chatId === p.chatId
            ? { ...c, status: p.status === "CLOSED" ? "FINISHED" : (p.status as ChatStatus) }
            : c,
        ),
      )
    }

    const onTypingStart = (p: any) => {
      setTypingChatId(p.chatId)
      setIsTyping(true)
    }
    const onTypingStop = () => {
      setTypingChatId(null)
      setIsTyping(false)
    }

    socket.on("chatCreated", onChatCreated)
    socket.on("operatorAssigned", onOperatorAssigned)
    socket.on("newMessage", onNewMessage)
    socket.on("chatStatusChanged", onChatStatusChanged)
    socket.on("chatFinished", onChatStatusChanged)
    socket.on("typingStart", onTypingStart)
    socket.on("typingStop", onTypingStop)

    return () => {
      socket.off("chatCreated", onChatCreated)
      socket.off("operatorAssigned", onOperatorAssigned)
      socket.off("newMessage", onNewMessage)
      socket.off("chatStatusChanged", onChatStatusChanged)
      socket.off("chatFinished", onChatStatusChanged)
      socket.off("typingStart", onTypingStart)
      socket.off("typingStop", onTypingStop)
    }
  }, [socket])

  /** API para la página */
  const joinChat = (chatId: string) => {
    setTypingChatId(null)
    setIsTyping(false)
    if (!useMock) socket?.emit("joinChat", { chatId })
  }

  const sendMessage = (chatId: string, content: string) => {
    const out: ChatMessage = {
      id: `tmp-${Date.now()}`,
      chatId,
      sender: "OPERADOR",
      content,
      type: "TEXT",
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, out])
    setChats((prev) =>
      upsertChat(prev, {
        ...(prev.find((c) => c.chatId === chatId)!),
        lastMessagePreview: content,
        lastMessageTime: out.timestamp,
      }),
    )
    if (!useMock) socket?.emit("sendMessage", { chatId, content })
  }

  const finishChat = (chatId: string) => {
    if (useMock) {
      // feedback visual inmediato en mock
      setMessages((prev) => [
        ...prev,
        {
          id: `sys-${Date.now()}`,
          chatId,
          sender: "SYSTEM",
          content: "La conversación se finalizó. ¡Gracias por escribirnos!",
          type: "TEXT",
          timestamp: new Date(),
        },
      ])
      setChats((prev) =>
        prev.map((c) => (c.chatId === chatId ? { ...c, status: "FINISHED", isOnline: false } : c)),
      )
      return
    }
    socket?.emit("finishChat", { chatId })
  }

  return {
    chats,
    messages,
    isTyping,
    typingChatId,
    isLoading,
    isConnected: true, // en mock lo damos por conectado
    joinChat,
    sendMessage,
    finishChat,
  }
}
