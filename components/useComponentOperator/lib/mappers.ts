import type { ChatItem, ChatMessage, ChatStatus } from "./types";
import { avatarFromName, pickClientName } from "./utils";

export function mapActiveChatToChatItem(x: any): ChatItem {
  const id = String(x?.chatId ?? x?.id ?? x?._id);
  const status = String(x?.status ?? "ACTIVE") as ChatStatus;
  const userId = String(x?.userId ?? x?.clientId ?? id);
  const updatedAt = x?.updatedAt ?? x?.createdAt ?? Date.now();
  const clientName = pickClientName(x);
  const phone = x?.phone ?? x?.client?.phone ?? x?.user?.phone;

  return {
    chatId: id,
    clientId: userId,
    clientName,
    phone,
    status,
    isOnline: true,
    lastMessageTime: new Date(updatedAt),
    lastMessagePreview: "",
    avatar: avatarFromName(clientName),
  };
}

export function mapBackendMessageToChatMessage(
  raw: any,
  chatId: string
): ChatMessage {
  return {
    id: String(raw?.id ?? raw?._id ?? `${chatId}-${raw?.timestamp ?? Date.now()}`),
    chatId,
    sender: String(
      raw?.sender ?? raw?.senderType ?? raw?.from ?? "CLIENT"
    ).toUpperCase() as ChatMessage["sender"],
    content: raw?.content ?? raw?.text ?? raw?.body,
    type: String(raw?.type ?? "TEXT").toUpperCase() as ChatMessage["type"],
    imageUrl: raw?.imageUrl,
    timestamp: new Date(raw?.timestamp ?? raw?.createdAt ?? Date.now()),
    senderName: raw?.senderName ?? undefined,
  };
}
