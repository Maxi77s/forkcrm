"use client";

import { useEffect, useRef } from "react";
import {
  createChatSocket,
  ChatServerEvents,
  joinChat,
  leaveChat,
  emitSendMessage,
} from "@/components/helpers/socket";

type Handlers = {
  onChatHistory?: (payload: any) => void;
  onNewMessage?: (msg: any) => void;
  onError?: (err: any) => void;
};

export function useChatSocket(token?: string, handlers?: Handlers) {
  const socketRef = useRef<ReturnType<typeof createChatSocket> | null>(null);

  // connect / disconnect
  useEffect(() => {
    if (!token) return;
    const s = createChatSocket(token);
    socketRef.current = s;

    if (handlers?.onChatHistory) {
      s.on(ChatServerEvents.chatHistory as any, handlers.onChatHistory);
    }
    if (handlers?.onNewMessage) {
      s.on(ChatServerEvents.newMessage as any, handlers.onNewMessage);
    }

    s.on("connect_error", (err) => handlers?.onError?.(err));
    s.on("error", (err) => handlers?.onError?.(err));

    return () => {
      try {
        s.disconnect();
      } catch {}
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const join = (chatId: string) => {
    const s = socketRef.current;
    if (s) joinChat(s, chatId);
  };

  const leave = (chatId: string) => {
    const s = socketRef.current;
    if (s) leaveChat(s, chatId);
  };

  const emitSend = (chatId: string, content: string, sender: "OPERATOR" | "CLIENT" | "SYSTEM" = "OPERATOR") => {
    const s = socketRef.current;
    if (s) emitSendMessage(s, chatId, content, sender);
  };

  return { socketRef, join, leave, emitSend };
}
