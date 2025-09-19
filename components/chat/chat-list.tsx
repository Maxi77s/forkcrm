// "use client"

// import { useState, useEffect } from "react"
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
// import { Input } from "@/components/ui/input"
// import { ScrollArea } from "@/components/ui/scroll-area"
// import { Avatar, AvatarFallback } from "@/components/ui/avatar"
// import { Badge } from "@/components/ui/badge"
// import { Button } from "@/components/ui/button"
// import { Search, MessageSquare, User } from "lucide-react"
// import { cn } from "@/lib/utils"

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

// interface ChatListProps {
//   chats: ChatPreview[]
//   selectedChatId: string | null
//   onChatSelect: (chatId: string) => void
//   onNewChat?: () => void
//   isLoading?: boolean
// }

// export function ChatList({ chats, selectedChatId, onChatSelect, onNewChat, isLoading = false }: ChatListProps) {
//   const [searchTerm, setSearchTerm] = useState("")
//   const [filteredChats, setFilteredChats] = useState<ChatPreview[]>(chats)

//   useEffect(() => {
//     const filtered = chats.filter(
//       (chat) =>
//         chat.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
//         chat.clientId.toLowerCase().includes(searchTerm.toLowerCase()) ||
//         chat.lastMessage.toLowerCase().includes(searchTerm.toLowerCase()),
//     )
//     setFilteredChats(filtered)
//   }, [chats, searchTerm])

//   const formatTime = (date: Date) => {
//     const now = new Date()
//     const diff = now.getTime() - date.getTime()
//     const days = Math.floor(diff / (1000 * 60 * 60 * 24))

//     if (days === 0) {
//       return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
//     } else if (days === 1) {
//       return "Ayer"
//     } else if (days < 7) {
//       return date.toLocaleDateString([], { weekday: "short" })
//     } else {
//       return date.toLocaleDateString([], { day: "2-digit", month: "2-digit" })
//     }
//   }

//   const getStatusColor = (status: string) => {
//     switch (status) {
//       case "ACTIVE":
//         return "bg-green-500"
//       case "WAITING":
//         return "bg-amber-500"
//       case "FINISHED":
//         return "bg-gray-400"
//       default:
//         return "bg-gray-400"
//     }
//   }

//   const getStatusText = (status: string) => {
//     switch (status) {
//       case "ACTIVE":
//         return "Activo"
//       case "WAITING":
//         return "Esperando"
//       case "FINISHED":
//         return "Finalizado"
//       default:
//         return "Desconocido"
//     }
//   }

//   return (
//     <Card className="h-full flex flex-col border-0 rounded-none">
//       <CardHeader className="pb-3 border-b">
//         <div className="flex items-center justify-between">
//           <CardTitle className="text-lg font-semibold flex items-center">
//             <MessageSquare className="h-5 w-5 mr-2 text-sky-500" />
//             Chats ({chats.length})
//           </CardTitle>
//           {onNewChat && (
//             <Button size="sm" onClick={onNewChat} className="bg-sky-500 hover:bg-sky-600">
//               Nuevo Chat
//             </Button>
//           )}
//         </div>

//         {/* Search Bar */}
//         <div className="relative">
//           <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
//           <Input
//             placeholder="Buscar chats..."
//             value={searchTerm}
//             onChange={(e) => setSearchTerm(e.target.value)}
//             className="pl-10"
//           />
//         </div>
//       </CardHeader>

//       <CardContent className="flex-1 p-0">
//         <ScrollArea className="h-full">
//           {isLoading ? (
//             <div className="p-4 space-y-3">
//               {Array.from({ length: 5 }).map((_, i) => (
//                 <div key={i} className="flex items-center space-x-3 p-3 animate-pulse">
//                   <div className="w-12 h-12 bg-gray-200 rounded-full" />
//                   <div className="flex-1 space-y-2">
//                     <div className="h-4 bg-gray-200 rounded w-3/4" />
//                     <div className="h-3 bg-gray-200 rounded w-1/2" />
//                   </div>
//                 </div>
//               ))}
//             </div>
//           ) : filteredChats.length === 0 ? (
//             <div className="flex flex-col items-center justify-center h-64 text-center p-4">
//               <MessageSquare className="h-16 w-16 text-muted-foreground opacity-20 mb-4" />
//               <h3 className="text-lg font-medium text-muted-foreground mb-2">
//                 {searchTerm ? "No se encontraron chats" : "No hay chats disponibles"}
//               </h3>
//               <p className="text-sm text-muted-foreground">
//                 {searchTerm
//                   ? "Intenta con otros términos de búsqueda"
//                   : "Los chats aparecerán aquí cuando los clientes inicien conversaciones"}
//               </p>
//             </div>
//           ) : (
//             <div className="divide-y">
//               {filteredChats.map((chat) => (
//                 <div
//                   key={chat.chatId}
//                   onClick={() => onChatSelect(chat.chatId)}
//                   className={cn(
//                     "flex items-center p-4 hover:bg-slate-50 cursor-pointer transition-colors relative",
//                     selectedChatId === chat.chatId && "bg-sky-50 border-r-2 border-sky-500",
//                   )}
//                 >
//                   {/* Avatar */}
//                   <div className="relative mr-3">
//                     <Avatar className="h-12 w-12">
//                       <AvatarFallback className="bg-sky-100 text-sky-600">
//                         <User className="h-6 w-6" />
//                       </AvatarFallback>
//                     </Avatar>

//                     {/* Online Status */}
//                     {chat.isOnline && (
//                       <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full" />
//                     )}
//                   </div>

//                   {/* Chat Info */}
//                   <div className="flex-1 min-w-0">
//                     <div className="flex items-center justify-between mb-1">
//                       <h4 className="font-medium text-sm truncate">
//                         {chat.clientName || `Cliente ${chat.clientId.substring(0, 8)}...`}
//                       </h4>
//                       <div className="flex items-center space-x-2">
//                         <span className="text-xs text-muted-foreground">{formatTime(chat.lastMessageTime)}</span>
//                         {chat.unreadCount > 0 && (
//                           <Badge className="bg-sky-500 text-white text-xs min-w-[20px] h-5 flex items-center justify-center rounded-full">
//                             {chat.unreadCount > 99 ? "99+" : chat.unreadCount}
//                           </Badge>
//                         )}
//                       </div>
//                     </div>

//                     <div className="flex items-center justify-between">
//                       <p className="text-sm text-muted-foreground truncate max-w-[200px]">{chat.lastMessage}</p>

//                       {/* Status Badge */}
//                       <div className="flex items-center space-x-1">
//                         <div className={cn("w-2 h-2 rounded-full", getStatusColor(chat.status))} />
//                         <span className="text-xs text-muted-foreground">{getStatusText(chat.status)}</span>
//                       </div>
//                     </div>

//                     {/* Chat ID */}
//                     <div className="mt-1">
//                       <span className="text-xs text-muted-foreground font-mono">
//                         ID: {chat.chatId.substring(0, 8)}...
//                       </span>
//                     </div>
//                   </div>
//                 </div>
//               ))}
//             </div>
//           )}
//         </ScrollArea>
//       </CardContent>
//     </Card>
//   )
// }


"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Search, MessageSquare, User, Bot } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ChatPreview } from "@/types/chats"

interface ChatListProps {
  chats: ChatPreview[]
  selectedChatId: string | null
  onChatSelect: (chatId: string) => void
  onNewChat?: () => void
  isLoading?: boolean
}

export function ChatList({ chats, selectedChatId, onChatSelect, onNewChat, isLoading = false }: ChatListProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [filteredChats, setFilteredChats] = useState<ChatPreview[]>(chats)

  useEffect(() => {
    const filtered = chats.filter(
      (chat) =>
        chat.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        chat.clientId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        chat.lastMessage.toLowerCase().includes(searchTerm.toLowerCase()),
    )
    setFilteredChats(filtered)
  }, [chats, searchTerm])

  const formatTime = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    } else if (days === 1) {
      return "Ayer"
    } else if (days < 7) {
      return date.toLocaleDateString([], { weekday: "short" })
    } else {
      return date.toLocaleDateString([], { day: "2-digit", month: "2-digit" })
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "bg-green-500"
      case "WAITING":
        return "bg-amber-500"
      case "FINISHED":
        return "bg-gray-400"
      default:
        return "bg-gray-400"
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "Activo"
      case "WAITING":
        return "Esperando"
      case "FINISHED":
        return "Finalizado"
      default:
        return "Desconocido"
    }
  }

  return (
    <Card className="h-full flex flex-col border-0 rounded-none bg-white shadow-sm">
      <CardHeader className="pb-4 border-b bg-gradient-to-r from-white to-slate-50">
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

        {/* Search Bar */}
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar chats..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 border-gray-300 focus:border-sky-500 focus:ring-sky-500 rounded-full shadow-sm"
          />
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-full">
          {isLoading ? (
            <div className="p-4 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
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
                {searchTerm ? "No se encontraron chats" : "No hay chats disponibles"}
              </h3>
              <p className="text-gray-500 max-w-sm">
                {searchTerm
                  ? "Intenta con otros términos de búsqueda"
                  : "Los chats aparecerán aquí cuando los clientes inicien conversaciones"}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredChats.map((chat) => (
                <div
                  key={chat.chatId}
                  onClick={() => onChatSelect(chat.chatId)}
                  className={cn(
                    "flex items-center p-4 hover:bg-gradient-to-r hover:from-slate-50 hover:to-blue-50 cursor-pointer transition-all duration-200 relative",
                    selectedChatId === chat.chatId &&
                      "bg-gradient-to-r from-sky-50 to-blue-50 border-r-4 border-sky-500 shadow-sm",
                  )}
                >
                  {/* Avatar */}
                  <div className="relative mr-4">
                    <Avatar
                      className={cn("h-14 w-14 shadow-md", selectedChatId === chat.chatId && "ring-2 ring-sky-200")}
                    >
                      <AvatarFallback className="bg-gradient-to-r from-blue-100 to-blue-200 text-blue-700 font-semibold">
                        <User className="h-6 w-6" />
                      </AvatarFallback>
                    </Avatar>

                    {/* Online Status */}
                    {chat.isOnline && (
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 border-2 border-white rounded-full shadow-sm" />
                    )}
                  </div>

                  {/* Chat Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-bold text-gray-800 truncate text-lg">
                        {chat.clientName || `Cliente ${chat.clientId.substring(0, 8)}...`}
                      </h4>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-gray-500 font-medium">{formatTime(chat.lastMessageTime)}</span>
                        {chat.unreadCount > 0 && (
                          <Badge className="bg-gradient-to-r from-sky-500 to-sky-600 text-white text-xs min-w-[24px] h-6 flex items-center justify-center rounded-full shadow-sm">
                            {chat.unreadCount > 99 ? "99+" : chat.unreadCount}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-600 truncate max-w-[200px] leading-relaxed">
                        {chat.lastMessage.includes("¡Hola") && <Bot className="inline h-3 w-3 mr-1 text-purple-500" />}
                        {chat.lastMessage}
                      </p>

                      {/* Status Badge */}
                      <div className="flex items-center space-x-2">
                        <div className={cn("w-2 h-2 rounded-full shadow-sm", getStatusColor(chat.status))} />
                        <span className="text-xs text-gray-500 font-medium">{getStatusText(chat.status)}</span>
                      </div>
                    </div>

                    {/* Chat ID */}
                    <div className="mt-2">
                      <span className="text-xs text-gray-400 font-mono bg-gray-100 px-2 py-1 rounded-full">
                        ID: {chat.chatId.substring(0, 8)}...
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
