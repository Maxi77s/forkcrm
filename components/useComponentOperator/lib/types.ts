export type ChatStatus = "ACTIVE" | "WAITING" | "FINISHED";

export interface ChatItem {
  chatId: string;
  clientId: string;
  clientName?: string;
  phone?: string;
  status: ChatStatus;
  isOnline: boolean;
  lastMessageTime: Date;
  lastMessagePreview?: string;
  avatar?: string;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  sender: "CLIENT" | "BOT" | "OPERADOR" | "SYSTEM";
  content?: string;
  type: "TEXT" | "IMAGE";
  imageUrl?: string;
  timestamp: Date;
  senderName?: string;
}

export interface UseChatOperatorOptions {
  token?: string;
  mock?: boolean;
}

export type CacheShape = {
  chats: ChatItem[];
  byChat: Record<string, ChatMessage[]>;
  selectedChatId?: string;
};
