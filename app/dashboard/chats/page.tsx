"use client"

import { useState } from "react"
import { SidebarInset } from "@/components/ui/sidebar"
import { ChatList } from "@/components/chat/chat-list"
import { ChatInterface } from "@/components/chat/chat-interface"
import { useChatManager } from "@/hooks/use-chat-manager"

interface ChatInfo {
  chatId: string
  clientId: string
  clientName?: string
  status: "ACTIVE" | "FINISHED" | "WAITING"
  isOnline: boolean
  lastSeen?: Date
  startedAt: Date
}

export default function ChatsPage() {
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null)

  const { chats, messages, isTyping, typingChatId, isLoading, isConnected, joinChat, sendMessage, finishChat } =
    useChatManager()

  const handleChatSelect = (chatId: string) => {
    setSelectedChatId(chatId)
    joinChat(chatId)
  }

  const handleSendMessage = (content: string) => {
    if (!selectedChatId) return
    sendMessage(selectedChatId, content)
  }

  const handleFinishChat = () => {
    if (!selectedChatId) return
    finishChat(selectedChatId)
  }

  // Obtener información del chat seleccionado
  const selectedChat = chats.find((chat) => chat.chatId === selectedChatId)
  const chatInfo: ChatInfo | null = selectedChat
    ? {
        chatId: selectedChat.chatId,
        clientId: selectedChat.clientId,
        clientName: selectedChat.clientName,
        status: selectedChat.status,
        isOnline: selectedChat.isOnline,
        lastSeen: selectedChat.isOnline ? undefined : new Date(Date.now() - 10 * 60 * 1000),
        startedAt: new Date(selectedChat.lastMessageTime.getTime() - 2 * 60 * 60 * 1000),
      }
    : null

  // Filtrar mensajes del chat seleccionado
  const chatMessages = messages.filter((msg) => msg.chatId === selectedChatId)

  // Verificar si alguien está escribiendo en el chat actual
  const isCurrentChatTyping = !!(isTyping && typingChatId === selectedChatId)

  return (
    <SidebarInset>
      <div className="h-screen flex">
        {/* Lista de Chats */}
        <div className="w-1/3 border-r bg-white">
          <ChatList
            chats={chats}
            selectedChatId={selectedChatId}
            onChatSelect={handleChatSelect}
            isLoading={isLoading}
          />
        </div>

        {/* Interfaz de Chat */}
        <div className="flex-1 bg-slate-50">
          <ChatInterface
            chatInfo={chatInfo}
            messages={chatMessages}
            isTyping={isCurrentChatTyping}
            onSendMessage={handleSendMessage}
            onFinishChat={handleFinishChat}
            isConnected={isConnected}
          />
        </div>
      </div>
    </SidebarInset>
  )
}
