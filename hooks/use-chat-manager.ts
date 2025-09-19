// "use client"

// import { useState, useEffect, useCallback } from "react"
// import { useSocket } from "@/hooks/use-socket"
// import { useAuth } from "@/components/providers/auth-provider"
// import { useToast } from "@/hooks/use-toast"

// interface Message {
//   id: string
//   content: string
//   sender: "CLIENT" | "BOT" | "OPERADOR" | "SYSTEM"
//   timestamp: Date
//   chatId: string
//   senderName?: string
//   type: "TEXT" | "IMAGE"
//   imageUrl?: string
// }

// interface ChatPreview {
//   chatId: string
//   clientId: string
//   clientName?: string
//   lastMessage: string
//   lastMessageTime: Date
//   unreadCount: number
//   status: "ACTIVE" | "FINISHED" | "WAITING"
//   isOnline: boolean
//   avatar?: string
// }

// interface ConnectedClient {
//   userId: string
//   connectedAt: Date
//   currentChatId?: string
// }

// export function useChatManager() {
//   const { user } = useAuth()
//   const { toast } = useToast()

//   // Estados
//   const [chats, setChats] = useState<ChatPreview[]>([])
//   const [messages, setMessages] = useState<Message[]>([])
//   const [connectedClients, setConnectedClients] = useState<ConnectedClient[]>([])
//   const [isTyping, setIsTyping] = useState(false)
//   const [typingChatId, setTypingChatId] = useState<string | null>(null)
//   const [isLoading, setIsLoading] = useState(true)

//   // Socket connection
//   const { socket, isConnected } = useSocket({
//     userRole: "OPERADOR",
//     serverUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002",
//   })

//   // Función para obtener el nombre del remitente
//   const getSenderName = useCallback((senderType: string, userId: string): string => {
//     switch (senderType) {
//       case "BOT":
//         return "DepilBot"
//       case "CLIENT":
//         return `Cliente ${userId.substring(0, 8)}...`
//       case "OPERADOR":
//         return "Tú"
//       case "SYSTEM":
//         return "Sistema"
//       default:
//         return userId
//     }
//   }, [])

//   // Función para actualizar o agregar chat
//   const updateOrAddChat = useCallback(
//     (chatData: any, lastMessage?: string, incrementUnread = false) => {
//       setChats((prev) => {
//         const existingIndex = prev.findIndex((chat) => chat.chatId === chatData.chatId)

//         const chatPreview: ChatPreview = {
//           chatId: chatData.chatId,
//           clientId: chatData.clientId,
//           clientName: chatData.clientName,
//           lastMessage: lastMessage || chatData.lastMessage || "Chat iniciado",
//           lastMessageTime: new Date(),
//           unreadCount: incrementUnread ? (existingIndex >= 0 ? prev[existingIndex].unreadCount + 1 : 1) : 0,
//           status: chatData.status || "ACTIVE",
//           isOnline: connectedClients.some((client) => client.userId === chatData.clientId),
//         }

//         if (existingIndex >= 0) {
//           // Actualizar chat existente
//           const updated = [...prev]
//           updated[existingIndex] = {
//             ...updated[existingIndex],
//             ...chatPreview,
//             unreadCount: incrementUnread ? updated[existingIndex].unreadCount + 1 : updated[existingIndex].unreadCount,
//           }
//           return updated
//         } else {
//           // Agregar nuevo chat
//           return [chatPreview, ...prev]
//         }
//       })
//     },
//     [connectedClients],
//   )

//   // Configurar event listeners del socket
//   useEffect(() => {
//     if (!socket) return

//     console.log("🔌 [CHAT-MANAGER] Configurando event listeners...")

//     // Dashboard inicial del operador
//     socket.on("operatorDashboard", (data) => {
//       console.log("📊 [CHAT-MANAGER] Dashboard recibido:", data)

//       if (data.connectedClients) {
//         setConnectedClients(data.connectedClients)
//       }

//       if (data.assignedChats) {
//         // Convertir chats asignados a ChatPreview
//         const chatPreviews: ChatPreview[] = data.assignedChats.map((chatId: string) => ({
//           chatId,
//           clientId: `client-${chatId.substring(0, 8)}`,
//           lastMessage: "Chat asignado",
//           lastMessageTime: new Date(),
//           unreadCount: 0,
//           status: "ACTIVE" as const,
//           isOnline: false,
//         }))

//         setChats(chatPreviews)
//       }

//       setIsLoading(false)
//     })

//     // Actualización de usuarios conectados
//     socket.on("connectedUsersUpdate", (data) => {
//       console.log("👥 [CHAT-MANAGER] Usuarios conectados actualizados:", data)

//       if (data.clients) {
//         setConnectedClients(data.clients)

//         // Actualizar estado online de los chats
//         setChats((prev) =>
//           prev.map((chat) => ({
//             ...chat,
//             isOnline: data.clients.some((client: ConnectedClient) => client.userId === chat.clientId),
//           })),
//         )
//       }
//     })

//     // Chat auto-asignado
//     socket.on("chatAutoAssigned", (data) => {
//       console.log("🚨 [CHAT-MANAGER] Chat auto-asignado:", data)

//       updateOrAddChat(
//         {
//           chatId: data.chatId,
//           clientId: data.clientId,
//           status: "ACTIVE",
//         },
//         "Chat asignado automáticamente",
//       )

//       // Agregar historial si viene
//       if (data.history && data.history.length > 0) {
//         const historyMessages: Message[] = data.history.map((msg: any) => ({
//           id: msg.id,
//           content: msg.content,
//           sender: msg.sender,
//           timestamp: new Date(msg.timestamp),
//           chatId: msg.chatId,
//           senderName: getSenderName(msg.sender, msg.userId || msg.senderName),
//           type: msg.type || "TEXT",
//           imageUrl: msg.imageUrl,
//         }))

//         setMessages((prev) => {
//           const filtered = prev.filter((m) => m.chatId !== data.chatId)
//           return [...filtered, ...historyMessages]
//         })
//       }

//       toast({
//         title: "Nuevo chat asignado",
//         description: `Cliente ${data.clientId.substring(0, 8)}... necesita ayuda`,
//       })
//     })

//     // Nuevo mensaje
//     socket.on("newMessage", (message) => {
//       console.log("💬 [CHAT-MANAGER] Nuevo mensaje:", message)

//       const newMessage: Message = {
//         id: message.id,
//         content: message.content,
//         sender: message.senderType,
//         timestamp: new Date(message.timestamp),
//         chatId: message.chatId,
//         senderName: getSenderName(message.senderType, message.userId),
//         type: message.type || "TEXT",
//         imageUrl: message.imageUrl,
//       }

//       // Agregar mensaje
//       setMessages((prev) => {
//         const exists = prev.some((m) => m.id === message.id)
//         if (exists) return prev
//         return [...prev, newMessage]
//       })

//       // Actualizar último mensaje en el chat
//       setChats((prev) =>
//         prev.map((chat) => {
//           if (chat.chatId === message.chatId) {
//             return {
//               ...chat,
//               lastMessage: message.content,
//               lastMessageTime: new Date(message.timestamp),
//               unreadCount: message.senderType === "CLIENT" ? chat.unreadCount + 1 : chat.unreadCount,
//             }
//           }
//           return chat
//         }),
//       )

//       // Notificación si es mensaje de cliente
//       if (message.senderType === "CLIENT") {
//         toast({
//           title: "Nuevo mensaje",
//           description: `${getSenderName(message.senderType, message.userId)}: ${message.content.substring(0, 50)}...`,
//         })
//       }
//     })

//     // Historial del chat
//     socket.on("chatHistory", (data) => {
//       console.log("📚 [CHAT-MANAGER] Historial recibido:", data)

//       const historyMessages: Message[] = data.messages.map((msg: any) => ({
//         id: msg.id,
//         content: msg.content,
//         sender: msg.sender,
//         timestamp: new Date(msg.timestamp),
//         chatId: msg.chatId,
//         senderName: getSenderName(msg.sender, msg.userId || msg.senderName),
//         type: msg.type || "TEXT",
//         imageUrl: msg.imageUrl,
//       }))

//       // Reemplazar mensajes del chat específico
//       setMessages((prev) => {
//         const otherMessages = prev.filter((m) => m.chatId !== data.chatId)
//         return [...otherMessages, ...historyMessages]
//       })
//     })

//     // Usuario escribiendo
//     socket.on("userTyping", (data) => {
//       console.log("⌨️ [CHAT-MANAGER] Usuario escribiendo:", data)

//       if (data.userId !== user?.id) {
//         setIsTyping(data.isTyping)
//         setTypingChatId(data.chatId)

//         if (data.isTyping) {
//           // Auto-clear typing después de 3 segundos
//           setTimeout(() => {
//             setIsTyping(false)
//             setTypingChatId(null)
//           }, 3000)
//         }
//       }
//     })

//     // Chat finalizado
//     socket.on("chatFinished", (data) => {
//       console.log("✅ [CHAT-MANAGER] Chat finalizado:", data)

//       setChats((prev) =>
//         prev.map((chat) => {
//           if (chat.chatId === data.chatId) {
//             return {
//               ...chat,
//               status: "FINISHED" as const,
//               lastMessage: "Chat finalizado",
//               lastMessageTime: new Date(),
//             }
//           }
//           return chat
//         }),
//       )

//       toast({
//         title: "Chat finalizado",
//         description: "El chat ha sido finalizado exitosamente",
//       })
//     })

//     // Chat calificado
//     socket.on("chatRated", (data) => {
//       console.log("⭐ [CHAT-MANAGER] Chat calificado:", data)

//       toast({
//         title: "Nueva calificación",
//         description: `Recibiste ${data.rating} estrellas`,
//       })
//     })

//     // Errores
//     socket.on("error", (error) => {
//       console.error("❌ [CHAT-MANAGER] Error:", error)
//       toast({
//         title: "Error",
//         description: error.message || "Ha ocurrido un error",
//         variant: "destructive",
//       })
//     })

//     // Solicitar dashboard inicial
//     socket.emit("getStats")

//     return () => {
//       console.log("🧹 [CHAT-MANAGER] Limpiando event listeners...")
//       socket.off("operatorDashboard")
//       socket.off("connectedUsersUpdate")
//       socket.off("chatAutoAssigned")
//       socket.off("newMessage")
//       socket.off("chatHistory")
//       socket.off("userTyping")
//       socket.off("chatFinished")
//       socket.off("chatRated")
//       socket.off("error")
//     }
//   }, [socket, user?.id, getSenderName, updateOrAddChat, toast])

//   // Funciones para interactuar con el chat
//   const joinChat = useCallback(
//     (chatId: string) => {
//       if (!socket) return

//       console.log("🚀 [CHAT-MANAGER] Uniéndose al chat:", chatId)
//       socket.emit("joinChat", { chatId })

//       // Marcar como leído
//       setChats((prev) => prev.map((chat) => (chat.chatId === chatId ? { ...chat, unreadCount: 0 } : chat)))
//     },
//     [socket],
//   )

//   const sendMessage = useCallback(
//     (chatId: string, content: string) => {
//       if (!socket || !user?.id) return

//       console.log("📤 [CHAT-MANAGER] Enviando mensaje:", { chatId, content })
//       socket.emit("sendMessage", {
//         userId: user.id,
//         chatId,
//         content,
//       })
//     },
//     [socket, user?.id],
//   )

//   const finishChat = useCallback(
//     (chatId: string, reason = "Chat finalizado por el operador") => {
//       if (!socket) return

//       console.log("🏁 [CHAT-MANAGER] Finalizando chat:", chatId)
//       socket.emit("finishChat", {
//         chatId,
//         reason,
//       })
//     },
//     [socket],
//   )

//   const startTyping = useCallback(
//     (chatId: string) => {
//       if (!socket) return
//       socket.emit("typingStart", { chatId })
//     },
//     [socket],
//   )

//   const stopTyping = useCallback(
//     (chatId: string) => {
//       if (!socket) return
//       socket.emit("typingStop", { chatId })
//     },
//     [socket],
//   )

//   return {
//     // Estados
//     chats,
//     messages,
//     connectedClients,
//     isTyping: isTyping && typingChatId,
//     typingChatId,
//     isLoading,
//     isConnected,

//     // Funciones
//     joinChat,
//     sendMessage,
//     finishChat,
//     startTyping,
//     stopTyping,

//     // Utilidades
//     getSenderName,
//   }
// }




"use client"

import { useState, useEffect, useCallback } from "react"
import { useSocket } from "@/hooks/use-socket"
import { useAuth } from "@/components/providers/auth-provider"
import { useToast } from "@/hooks/use-toast"
import type { Message, ChatPreview, ConnectedClient } from "@/types/chats"

export function useChatManager() {
  const { user } = useAuth()
  const { toast } = useToast()

  // Estados
  const [chats, setChats] = useState<ChatPreview[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [connectedClients, setConnectedClients] = useState<ConnectedClient[]>([])
  const [isTyping, setIsTyping] = useState(false)
  const [typingChatId, setTypingChatId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Socket connection
  const { socket, isConnected } = useSocket({
    userRole: "OPERADOR",
    serverUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002",
  })

  // Función para obtener el nombre del remitente
  const getSenderName = useCallback((senderType: string, userId: string): string => {
    switch (senderType) {
      case "BOT":
        return "DepilBot"
      case "CLIENT":
        return `Cliente ${userId.substring(0, 8)}...`
      case "OPERADOR":
        return "Tú"
      case "SYSTEM":
        return "Sistema"
      default:
        return userId
    }
  }, [])

  // Función para actualizar o agregar chat
  const updateOrAddChat = useCallback(
    (chatData: any, lastMessage?: string, incrementUnread = false) => {
      setChats((prev) => {
        const existingIndex = prev.findIndex((chat) => chat.chatId === chatData.chatId)

        const chatPreview: ChatPreview = {
          chatId: chatData.chatId,
          clientId: chatData.clientId,
          clientName: chatData.clientName,
          lastMessage: lastMessage || chatData.lastMessage || "Chat iniciado",
          lastMessageTime: new Date(),
          unreadCount: incrementUnread ? (existingIndex >= 0 ? prev[existingIndex].unreadCount + 1 : 1) : 0,
          status: chatData.status || "ACTIVE",
          isOnline: connectedClients.some((client) => client.userId === chatData.clientId),
        }

        if (existingIndex >= 0) {
          // Actualizar chat existente
          const updated = [...prev]
          updated[existingIndex] = {
            ...updated[existingIndex],
            ...chatPreview,
            unreadCount: incrementUnread ? updated[existingIndex].unreadCount + 1 : updated[existingIndex].unreadCount,
          }
          return updated
        } else {
          // Agregar nuevo chat
          return [chatPreview, ...prev]
        }
      })
    },
    [connectedClients],
  )

  // Configurar event listeners del socket
  useEffect(() => {
    if (!socket) return

    console.log("🔌 [CHAT-MANAGER] Configurando event listeners...")

    // Dashboard inicial del operador
    socket.on("operatorDashboard", (data) => {
      console.log("📊 [CHAT-MANAGER] Dashboard recibido:", data)

      if (data.connectedClients) {
        setConnectedClients(data.connectedClients)
      }

      if (data.assignedChats) {
        // Convertir chats asignados a ChatPreview
        const chatPreviews: ChatPreview[] = data.assignedChats.map((chatId: string) => ({
          chatId,
          clientId: `client-${chatId.substring(0, 8)}`,
          lastMessage: "Chat asignado",
          lastMessageTime: new Date(),
          unreadCount: 0,
          status: "ACTIVE" as const,
          isOnline: false,
        }))

        setChats(chatPreviews)
      }

      setIsLoading(false)
    })

    // Actualización de usuarios conectados
    socket.on("connectedUsersUpdate", (data) => {
      console.log("👥 [CHAT-MANAGER] Usuarios conectados actualizados:", data)

      if (data.clients) {
        setConnectedClients(data.clients)

        // Actualizar estado online de los chats
        setChats((prev) =>
          prev.map((chat) => ({
            ...chat,
            isOnline: data.clients.some((client: ConnectedClient) => client.userId === chat.clientId),
          })),
        )
      }
    })

    // Chat auto-asignado
    socket.on("chatAutoAssigned", (data) => {
      console.log("🚨 [CHAT-MANAGER] Chat auto-asignado:", data)

      updateOrAddChat(
        {
          chatId: data.chatId,
          clientId: data.clientId,
          status: "ACTIVE",
        },
        "Chat asignado automáticamente",
      )

      // Agregar historial si viene
      if (data.history && data.history.length > 0) {
        const historyMessages: Message[] = data.history.map((msg: any) => ({
          id: msg.id,
          content: msg.content,
          sender: msg.sender,
          timestamp: new Date(msg.timestamp),
          chatId: msg.chatId,
          senderName: getSenderName(msg.sender, msg.userId || msg.senderName),
          type: msg.type || "TEXT",
          imageUrl: msg.imageUrl,
          options: msg.options, // 🆕 Agregar opciones si vienen
        }))

        setMessages((prev) => {
          const filtered = prev.filter((m) => m.chatId !== data.chatId)
          return [...filtered, ...historyMessages]
        })
      }

      toast({
        title: "Nuevo chat asignado",
        description: `Cliente ${data.clientId.substring(0, 8)}... necesita ayuda`,
      })
    })

    // Nuevo mensaje
    socket.on("newMessage", (message) => {
      console.log("💬 [CHAT-MANAGER] Nuevo mensaje:", message)

      const newMessage: Message = {
        id: message.id,
        content: message.content,
        sender: message.senderType,
        timestamp: new Date(message.timestamp),
        chatId: message.chatId,
        senderName: getSenderName(message.senderType, message.userId),
        type: message.type || "TEXT",
        imageUrl: message.imageUrl,
        options: message.options, // 🆕 Agregar opciones del bot
      }

      // Agregar mensaje
      setMessages((prev) => {
        const exists = prev.some((m) => m.id === message.id)
        if (exists) return prev
        return [...prev, newMessage]
      })

      // Actualizar último mensaje en el chat
      setChats((prev) =>
        prev.map((chat) => {
          if (chat.chatId === message.chatId) {
            return {
              ...chat,
              lastMessage: message.content,
              lastMessageTime: new Date(message.timestamp),
              unreadCount: message.senderType === "CLIENT" ? chat.unreadCount + 1 : chat.unreadCount,
            }
          }
          return chat
        }),
      )

      // Notificación si es mensaje de cliente
      if (message.senderType === "CLIENT") {
        toast({
          title: "Nuevo mensaje",
          description: `${getSenderName(message.senderType, message.userId)}: ${message.content.substring(0, 50)}...`,
        })
      }
    })

    // Historial del chat
    socket.on("chatHistory", (data) => {
      console.log("📚 [CHAT-MANAGER] Historial recibido:", data)

      const historyMessages: Message[] = data.messages.map((msg: any) => ({
        id: msg.id,
        content: msg.content,
        sender: msg.sender,
        timestamp: new Date(msg.timestamp),
        chatId: msg.chatId,
        senderName: getSenderName(msg.sender, msg.userId || msg.senderName),
        type: msg.type || "TEXT",
        imageUrl: msg.imageUrl,
        options: msg.options, // 🆕 Agregar opciones
      }))

      // Reemplazar mensajes del chat específico
      setMessages((prev) => {
        const otherMessages = prev.filter((m) => m.chatId !== data.chatId)
        return [...otherMessages, ...historyMessages]
      })
    })

    // Usuario escribiendo
    socket.on("userTyping", (data) => {
      console.log("⌨️ [CHAT-MANAGER] Usuario escribiendo:", data)

      if (data.userId !== user?.id) {
        setIsTyping(data.isTyping)
        setTypingChatId(data.chatId)

        if (data.isTyping) {
          // Auto-clear typing después de 3 segundos
          setTimeout(() => {
            setIsTyping(false)
            setTypingChatId(null)
          }, 3000)
        }
      }
    })

    // Chat finalizado
    socket.on("chatFinished", (data) => {
      console.log("✅ [CHAT-MANAGER] Chat finalizado:", data)

      setChats((prev) =>
        prev.map((chat) => {
          if (chat.chatId === data.chatId) {
            return {
              ...chat,
              status: "FINISHED" as const,
              lastMessage: "Chat finalizado",
              lastMessageTime: new Date(),
            }
          }
          return chat
        }),
      )

      toast({
        title: "Chat finalizado",
        description: "El chat ha sido finalizado exitosamente",
      })
    })

    // Chat calificado
    socket.on("chatRated", (data) => {
      console.log("⭐ [CHAT-MANAGER] Chat calificado:", data)

      toast({
        title: "Nueva calificación",
        description: `Recibiste ${data.rating} estrellas`,
      })
    })

    // Errores
    socket.on("error", (error) => {
      console.error("❌ [CHAT-MANAGER] Error:", error)
      toast({
        title: "Error",
        description: error.message || "Ha ocurrido un error",
        variant: "destructive",
      })
    })

    // Solicitar dashboard inicial
    socket.emit("getStats")

    return () => {
      console.log("🧹 [CHAT-MANAGER] Limpiando event listeners...")
      socket.off("operatorDashboard")
      socket.off("connectedUsersUpdate")
      socket.off("chatAutoAssigned")
      socket.off("newMessage")
      socket.off("chatHistory")
      socket.off("userTyping")
      socket.off("chatFinished")
      socket.off("chatRated")
      socket.off("error")
    }
  }, [socket, user?.id, getSenderName, updateOrAddChat, toast])

  // Funciones para interactuar con el chat
  const joinChat = useCallback(
    (chatId: string) => {
      if (!socket) return

      console.log("🚀 [CHAT-MANAGER] Uniéndose al chat:", chatId)
      socket.emit("joinChat", { chatId })

      // Marcar como leído
      setChats((prev) => prev.map((chat) => (chat.chatId === chatId ? { ...chat, unreadCount: 0 } : chat)))
    },
    [socket],
  )

  const sendMessage = useCallback(
    (chatId: string, content: string) => {
      if (!socket || !user?.id) return

      console.log("📤 [CHAT-MANAGER] Enviando mensaje:", { chatId, content })
      socket.emit("sendMessage", {
        userId: user.id,
        chatId,
        content,
      })
    },
    [socket, user?.id],
  )

  const finishChat = useCallback(
    (chatId: string, reason = "Chat finalizado por el operador") => {
      if (!socket) return

      console.log("🏁 [CHAT-MANAGER] Finalizando chat:", chatId)
      socket.emit("finishChat", {
        chatId,
        reason,
      })
    },
    [socket],
  )

  const startTyping = useCallback(
    (chatId: string) => {
      if (!socket) return
      socket.emit("typingStart", { chatId })
    },
    [socket],
  )

  const stopTyping = useCallback(
    (chatId: string) => {
      if (!socket) return
      socket.emit("typingStop", { chatId })
    },
    [socket],
  )

  // Funciones para actualizar el chat
  const markChatAsRead = useCallback((chatId: string) => {
    setChats((prev) => prev.map((chat) => (chat.chatId === chatId ? { ...chat, unreadCount: 0 } : chat)))
  }, [])

  const updateChatStatus = useCallback((chatId: string, status: "ACTIVE" | "FINISHED" | "WAITING") => {
    setChats((prev) => prev.map((chat) => (chat.chatId === chatId ? { ...chat, status } : chat)))
  }, [])

  return {
    // Estados
    chats,
    messages,
    connectedClients,
    isTyping: isTyping && typingChatId,
    typingChatId,
    isLoading,
    isConnected,

    // Funciones
    joinChat,
    sendMessage,
    finishChat,
    startTyping,
    stopTyping,
    markChatAsRead,
    updateChatStatus,

    // Utilidades
    getSenderName,
  }
}
