import { createLimiter } from "./limiter";
import type { ChatItem, ChatMessage } from "./types";
import { avatarFromName } from "./utils";
import { mapActiveChatToChatItem, mapBackendMessageToChatMessage } from "./mappers";
import {
  getActiveChats,
  getChatMessages,
} from "@/components/helpers/helper.assign";

/**
 * Trae todos los chats asignados al operador, mapea su info base y
 * además hidrata mensajes para cada chat, ordenando y completando clientName/preview.
 */
export async function hydrateAssignedChatsFrontOnly(
  operatorId: string,
  authToken?: string
): Promise<{ chats: ChatItem[]; byChat: Record<string, ChatMessage[]> }> {
  const active = await getActiveChats(operatorId, authToken);
  if (!active?.ok) return { chats: [], byChat: {} };

  const base: ChatItem[] = (active.items || []).map(mapActiveChatToChatItem);

  const byChat: Record<string, ChatMessage[]> = {};
  const limit = createLimiter(4);

  await Promise.all(
    base.map((c) =>
      limit(async () => {
        try {
          const hist = await getChatMessages(c.chatId, authToken);
          const msgs: ChatMessage[] = (hist || [])
            .map((m: any) => mapBackendMessageToChatMessage(m, c.chatId))
            .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
          byChat[c.chatId] = msgs;

          // completar nombre si falta
          if (!c.clientName) {
            const nm = msgs.find((m) => m.sender === "CLIENT" && m.senderName)?.senderName;
            if (nm) {
              c.clientName = nm;
              c.avatar = avatarFromName(nm);
            }
          }

          const last = msgs[msgs.length - 1];
          if (last) {
            c.lastMessageTime = last.timestamp;
            c.lastMessagePreview = last.type === "IMAGE" ? "📷 Imagen" : last.content ?? "";
          }
        } catch {
          byChat[c.chatId] = [];
        }
      })
    )
  );

  base.sort((a, b) => b.lastMessageTime.getTime() - a.lastMessageTime.getTime());
  return { chats: base, byChat };
}
