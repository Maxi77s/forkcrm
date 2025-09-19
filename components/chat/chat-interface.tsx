// "use client"

// import type React from "react"

// import { useState, useRef, useEffect } from "react"
// import { Card, CardContent, CardHeader } from "@/components/ui/card"
// import { Button } from "@/components/ui/button"
// import { Input } from "@/components/ui/input"
// import { ScrollArea } from "@/components/ui/scroll-area"
// import { Avatar, AvatarFallback } from "@/components/ui/avatar"
// import { Badge } from "@/components/ui/badge"
// import { ChatMessage } from "./chat-message"
// import { Send, Paperclip, Smile, Phone, Video, CheckCircle, Clock, User } from "lucide-react"

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

// interface ChatInfo {
//   chatId: string
//   clientId: string
//   clientName?: string
//   status: "ACTIVE" | "FINISHED" | "WAITING"
//   isOnline: boolean
//   lastSeen?: Date
//   startedAt: Date
// }

// interface ChatInterfaceProps {
//   chatInfo: ChatInfo | null
//   messages: Message[]
//   isTyping: boolean
//   onSendMessage: (message: string) => void
//   onFinishChat: () => void
//   onStartTyping?: () => void
//   onStopTyping?: () => void
//   onTransferChat?: () => void
//   isConnected: boolean
// }

// export function ChatInterface({
//   chatInfo,
//   messages,
//   isTyping,
//   onSendMessage,
//   onFinishChat,
//   onStartTyping,
//   onStopTyping,
//   onTransferChat,
//   isConnected,
// }: ChatInterfaceProps) {
//   const [inputMessage, setInputMessage] = useState("")
//   const messagesEndRef = useRef<HTMLDivElement>(null)
//   const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

//   useEffect(() => {
//     messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
//   }, [messages])

//   // Manejar typing indicators
//   const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     const value = e.target.value
//     setInputMessage(value)

//     // Iniciar typing
//     if (value && onStartTyping) {
//       onStartTyping()
//     }

//     // Limpiar timeout anterior
//     if (typingTimeoutRef.current) {
//       clearTimeout(typingTimeoutRef.current)
//     }

//     // Parar typing después de 1 segundo de inactividad
//     typingTimeoutRef.current = setTimeout(() => {
//       if (onStopTyping) {
//         onStopTyping()
//       }
//     }, 1000)
//   }

//   const handleSubmit = (e: React.FormEvent) => {
//     e.preventDefault()
//     if (inputMessage.trim() && isConnected) {
//       onSendMessage(inputMessage.trim())
//       setInputMessage("")

//       // Parar typing al enviar mensaje
//       if (onStopTyping) {
//         onStopTyping()
//       }

//       if (typingTimeoutRef.current) {
//         clearTimeout(typingTimeoutRef.current)
//       }
//     }
//   }

//   const formatLastSeen = (date?: Date) => {
//     if (!date) return "Nunca visto"

//     const now = new Date()
//     const diff = now.getTime() - date.getTime()
//     const minutes = Math.floor(diff / (1000 * 60))

//     if (minutes < 1) return "Activo ahora"
//     if (minutes < 60) return `Visto hace ${minutes}m`

//     const hours = Math.floor(minutes / 60)
//     if (hours < 24) return `Visto hace ${hours}h`

//     const days = Math.floor(hours / 24)
//     return `Visto hace ${days}d`
//   }

//   if (!chatInfo) {
//     return (
//       <Card className="h-full flex items-center justify-center border-0 rounded-none">
//         <CardContent className="text-center">
//           <Clock className="h-16 w-16 mx-auto mb-4 text-sky-500 opacity-50" />
//           <h3 className="text-xl font-medium mb-2">Selecciona un chat</h3>
//           <p className="text-muted-foreground">Elige una conversación de la lista para comenzar a chatear</p>
//         </CardContent>
//       </Card>
//     )
//   }

//   return (
//     <Card className="h-full flex flex-col border-0 rounded-none">
//       {/* Chat Header */}
//       <CardHeader className="border-b pb-3">
//         <div className="flex items-center justify-between">
//           <div className="flex items-center space-x-3">
//             <div className="relative">
//               <Avatar className="h-10 w-10">
//                 <AvatarFallback className="bg-sky-100 text-sky-600">
//                   <User className="h-5 w-5" />
//                 </AvatarFallback>
//               </Avatar>
//               {chatInfo.isOnline && (
//                 <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
//               )}
//             </div>

//             <div className="flex-1">
//               <h3 className="font-medium">
//                 {chatInfo.clientName || `Cliente ${chatInfo.clientId.substring(0, 8)}...`}
//               </h3>
//               <div className="flex items-center space-x-2 text-sm text-muted-foreground">
//                 <span>{formatLastSeen(chatInfo.lastSeen)}</span>
//                 <span>•</span>
//                 <Badge
//                   variant="outline"
//                   className={`text-xs ${
//                     chatInfo.status === "ACTIVE"
//                       ? "bg-green-50 text-green-700 border-green-200"
//                       : chatInfo.status === "WAITING"
//                         ? "bg-amber-50 text-amber-700 border-amber-200"
//                         : "bg-gray-50 text-gray-700 border-gray-200"
//                   }`}
//                 >
//                   {chatInfo.status === "ACTIVE" ? "Activo" : chatInfo.status === "WAITING" ? "Esperando" : "Finalizado"}
//                 </Badge>
//               </div>
//             </div>
//           </div>

//           <div className="flex items-center space-x-2">
//             <Button size="sm" variant="ghost">
//               <Phone className="h-4 w-4" />
//             </Button>
//             <Button size="sm" variant="ghost">
//               <Video className="h-4 w-4" />
//             </Button>

//             {/* Botón de finalizar chat sin dropdown por ahora */}
//             <Button
//               size="sm"
//               variant="outline"
//               onClick={onFinishChat}
//               className="text-green-600 hover:text-green-600 border-green-200 hover:bg-green-50 bg-transparent"
//             >
//               <CheckCircle className="h-4 w-4 mr-2" />
//               Finalizar
//             </Button>
//           </div>
//         </div>
//       </CardHeader>

//       {/* Messages Area */}
//       <ScrollArea className="flex-1 p-4">
//         <div className="space-y-4">
//           {messages.map((message) => (
//             <ChatMessage key={message.id} message={message} currentUserId="OPERADOR" />
//           ))}

//           {isTyping && (
//             <div className="flex justify-start">
//               <div className="bg-gray-100 rounded-lg px-3 py-2 max-w-xs">
//                 <div className="flex space-x-1">
//                   <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
//                   <div
//                     className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
//                     style={{ animationDelay: "150ms" }}
//                   />
//                   <div
//                     className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
//                     style={{ animationDelay: "300ms" }}
//                   />
//                 </div>
//               </div>
//             </div>
//           )}

//           <div ref={messagesEndRef} />
//         </div>
//       </ScrollArea>

//       {/* Message Input */}
//       <div className="border-t p-4">
//         <form onSubmit={handleSubmit} className="flex items-center space-x-2">
//           <Button type="button" size="icon" variant="ghost" disabled={!isConnected}>
//             <Paperclip className="h-5 w-5" />
//           </Button>

//           <Input
//             value={inputMessage}
//             onChange={handleInputChange}
//             placeholder={isConnected ? "Escribe un mensaje..." : "Desconectado..."}
//             disabled={!isConnected || chatInfo?.status !== "ACTIVE"}
//             className="flex-1"
//           />

//           <Button type="button" size="icon" variant="ghost" disabled={!isConnected}>
//             <Smile className="h-5 w-5" />
//           </Button>

//           <Button
//             type="submit"
//             size="icon"
//             disabled={!isConnected || !inputMessage.trim() || chatInfo?.status !== "ACTIVE"}
//             className="bg-sky-500 hover:bg-sky-600"
//           >
//             <Send className="h-4 w-4" />
//           </Button>
//         </form>
//       </div>
//     </Card>
//   )
// }



"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ChatMessage } from "./chat-message"
import { Send, Paperclip, Smile, Phone, Video, CheckCircle, Clock, User, Bot } from "lucide-react"
import type { Message, ChatInfo, ChatOption } from "@/types/chats"

interface ChatInterfaceProps {
  chatInfo: ChatInfo | null
  messages: Message[]
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

  // Manejar typing indicators
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInputMessage(value)

    // Iniciar typing
    if (value && onStartTyping) {
      onStartTyping()
    }

    // Limpiar timeout anterior
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    // Parar typing después de 1 segundo de inactividad
    typingTimeoutRef.current = setTimeout(() => {
      if (onStopTyping) {
        onStopTyping()
      }
    }, 1000)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (inputMessage.trim() && isConnected) {
      onSendMessage(inputMessage.trim())
      setInputMessage("")

      // Parar typing al enviar mensaje
      if (onStopTyping) {
        onStopTyping()
      }

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
    }
  }

  // Manejar selección de opciones del bot
  const handleOptionSelect = (option: ChatOption) => {
    console.log("🤖 [CHAT] Opción seleccionada:", option)
    // Enviar el valor 'next' como mensaje para que el backend lo procese
    onSendMessage(option.next)
  }

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

  // Encontrar el último mensaje del bot para mostrar opciones
  const lastBotMessage = messages
    .slice()
    .reverse()
    .find((msg) => msg.sender === "BOT")

  if (!chatInfo) {
    return (
      <Card className="h-full flex items-center justify-center border-0 rounded-none bg-gradient-to-br from-slate-50 to-slate-100">
        <CardContent className="text-center">
          <div className="bg-white rounded-full p-6 shadow-lg mb-6">
            <Clock className="h-16 w-16 mx-auto text-sky-500" />
          </div>
          <h3 className="text-2xl font-bold text-gray-800 mb-2">Selecciona un chat</h3>
          <p className="text-gray-600 max-w-md">
            Elige una conversación de la lista para comenzar a chatear con el cliente
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full flex flex-col border-0 rounded-none bg-white">
      {/* Chat Header */}
      <CardHeader className="border-b bg-gradient-to-r from-white to-slate-50 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Avatar className="h-12 w-12 shadow-md ring-2 ring-white">
                <AvatarFallback className="bg-gradient-to-r from-blue-100 to-blue-200 text-blue-700">
                  <User className="h-6 w-6" />
                </AvatarFallback>
              </Avatar>
              {chatInfo.isOnline && (
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full shadow-sm" />
              )}
            </div>

            <div className="flex-1">
              <h3 className="font-bold text-lg text-gray-800">
                {chatInfo.clientName || `Cliente ${chatInfo.clientId.substring(0, 8)}...`}
              </h3>
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <span>{formatLastSeen(chatInfo.lastSeen)}</span>
                <span>•</span>
                <Badge
                  variant="outline"
                  className={`text-xs font-medium ${
                    chatInfo.status === "ACTIVE"
                      ? "bg-green-50 text-green-700 border-green-200"
                      : chatInfo.status === "WAITING"
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-gray-50 text-gray-700 border-gray-200"
                  }`}
                >
                  {chatInfo.status === "ACTIVE" ? "Activo" : chatInfo.status === "WAITING" ? "Esperando" : "Finalizado"}
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Button size="sm" variant="ghost" className="hover:bg-slate-100">
              <Phone className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" className="hover:bg-slate-100">
              <Video className="h-4 w-4" />
            </Button>

            {/* Botón de finalizar chat */}
            <Button
              size="sm"
              variant="outline"
              onClick={onFinishChat}
              className="text-green-600 hover:text-green-700 border-green-200 hover:bg-green-50 bg-white shadow-sm"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Finalizar
            </Button>
          </div>
        </div>
      </CardHeader>

      {/* Messages Area */}
      <ScrollArea className="flex-1 bg-gradient-to-b from-slate-50/50 to-white">
        <div className="p-6 space-y-1">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <div className="bg-white rounded-full p-4 shadow-lg mb-4 inline-block">
                <Bot className="h-8 w-8 text-purple-500" />
              </div>
              <h4 className="text-lg font-semibold text-gray-700 mb-2">¡Conversación iniciada!</h4>
              <p className="text-gray-500">Los mensajes aparecerán aquí</p>
            </div>
          )}

          {messages.map((message, index) => (
            <ChatMessage
              key={message.id}
              message={message}
              currentUserId="OPERADOR"
              onOptionSelect={handleOptionSelect}
              isLatestBotMessage={message.sender === "BOT" && message.id === lastBotMessage?.id}
            />
          ))}

          {isTyping && (
            <div className="flex justify-start mb-4">
              <div className="bg-gradient-to-r from-gray-100 to-gray-200 rounded-2xl px-4 py-3 max-w-xs shadow-sm">
                <div className="flex items-center space-x-2">
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
                  <span className="text-xs text-gray-500 font-medium">Escribiendo...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Message Input */}
      <div className="border-t bg-white p-4">
        <form onSubmit={handleSubmit} className="flex items-center space-x-3">
          <Button type="button" size="icon" variant="ghost" disabled={!isConnected} className="hover:bg-slate-100">
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
