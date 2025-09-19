export interface ChatOption {
  label: string
  next: string
}

export interface Message {
  id: string
  content: string
  sender: "CLIENT" | "BOT" | "OPERADOR" | "SYSTEM"
  timestamp: Date
  chatId: string
  senderName?: string
  type: "TEXT" | "IMAGE" | "OPTIONS"
  imageUrl?: string
  options?: ChatOption[]
}

export interface ChatPreview {
  chatId: string
  clientId: string
  clientName?: string
  lastMessage: string
  lastMessageTime: Date
  unreadCount: number
  status: "ACTIVE" | "FINISHED" | "WAITING"
  isOnline: boolean
  avatar?: string
}

export interface ConnectedClient {
  userId: string
  connectedAt: Date
  currentChatId?: string
}

export interface ChatInfo {
  chatId: string
  clientId: string
  clientName?: string
  status: "ACTIVE" | "FINISHED" | "WAITING"
  isOnline: boolean
  lastSeen?: Date
  startedAt: Date
}
