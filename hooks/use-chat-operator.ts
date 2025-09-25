"use client"; //En uso

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChatPreview } from "@/types/chats";

import {
  listAllMessages,
  sendTextMessage,
  type Mensaje as N8nMsg,
} from "@/components/helpers/helper.message"; // <-- ajusta si es helper.menssage

type ChatStatus = "ACTIVE" | "WAITING" | "FINISHED";

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
  // opcional: pending flag para UI futura
  // pending?: boolean;
}

interface UseChatOperatorOptions {
  token?: string;
  mock?: boolean;
}

function uuid() {
  if (typeof crypto !== "undefined" && (crypto as any).randomUUID)
    return (crypto as any).randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ---------- Persistencia en localStorage para mensajes pendientes ----------
const PENDING_KEY = "chat_pending_msgs_v1";

function revivePending(obj: any): Record<string, ChatMessage[]> {
  const out: Record<string, ChatMessage[]> = {};
  if (!obj || typeof obj !== "object") return out;
  for (const k of Object.keys(obj)) {
    out[k] = (obj[k] || []).map((m: any) => ({
      ...m,
      timestamp: new Date(m.timestamp),
    }));
  }
  return out;
}

function loadPendingFromStorage(): Record<string, ChatMessage[]> {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return revivePending(parsed);
  } catch {
    return {};
  }
}

function savePendingToStorage(data: Record<string, ChatMessage[]>) {
  try {
    // serializamos timestamps a ISO
    const plain: any = {};
    for (const k of Object.keys(data)) {
      plain[k] = (data[k] || []).map((m) => ({ ...m, timestamp: m.timestamp.toISOString() }));
    }
    localStorage.setItem(PENDING_KEY, JSON.stringify(plain));
  } catch {}
}
// -------------------------------------------------------------------------

export function useChatOperator({ token, mock }: UseChatOperatorOptions) {
  const fileRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | undefined>(undefined);
  const [message, setMessage] = useState("");
  const [localSending, setLocalSending] = useState(false);

  const [byChat, setByChat] = useState<Record<string, ChatMessage[]>>({});
  const [pendingByChat, setPendingByChat] = useState<Record<string, ChatMessage[]>>(
    typeof window !== "undefined" ? loadPendingFromStorage() : {}
  ); // ← buffer optimista persistido

  // guardar cada vez que cambian los pendientes
  useEffect(() => {
    if (typeof window === "undefined") return;
    savePendingToStorage(pendingByChat);
  }, [pendingByChat]);

  const pollMs = Number(process.env.NEXT_PUBLIC_N8N_POLL_MS || 4000);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const current = useMemo(() => chats.find((c) => c.chatId === selectedChatId), [chats, selectedChatId]);
  const messages = useMemo<ChatMessage[]>(() => (selectedChatId ? byChat[selectedChatId] ?? [] : []), [byChat, selectedChatId]);

  // ---- Normalización ----
  const normalizePhone = (p?: string) => (p ? String(p).replace(/\s+/g, "") : undefined);

  // fusionar y dedup (por remitente + texto + cercanía temporal)
  const mergeWithPending = useCallback(
    (fetched: Record<string, ChatMessage[]>) => {
      const RESOLVE_WINDOW_MS = 60_000; // 60s para considerar que es el mismo OUT
      const next = { ...fetched };

      for (const chatId of Object.keys(pendingByChat)) {
        const pending = pendingByChat[chatId] ?? [];
        const base = next[chatId] ? [...next[chatId]] : [];

        const resolved: ChatMessage[] = [];
        for (const p of pending) {
          const idx = base.findIndex(b =>
            b.sender === p.sender &&
            (b.content ?? "") === (p.content ?? "") &&
            Math.abs(b.timestamp.getTime() - p.timestamp.getTime()) <= RESOLVE_WINDOW_MS
          );
          if (idx >= 0) {
            // ya vino en el GET → resuelto
            resolved.push(p);
          } else {
            base.push(p); // mantener visible
          }
        }

        base.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        next[chatId] = base;

        // limpiar los resueltos del storage
        if (resolved.length) {
          setPendingByChat(prev => {
            const clone = { ...prev };
            clone[chatId] = (clone[chatId] ?? []).filter(p =>
              !resolved.some(r =>
                r.sender === p.sender &&
                (r.content ?? "") === (p.content ?? "") &&
                Math.abs(r.timestamp.getTime() - p.timestamp.getTime()) <= RESOLVE_WINDOW_MS
              )
            );
            return clone;
          });
        }
      }

      return next;
    },
    [pendingByChat]
  );

  const mapN8nToChatMessage = (m: N8nMsg, chatId: string): ChatMessage => {
    const src: any = (m as any).raw ?? m;

    const rawDir = (m as any).direction?.toUpperCase?.();
    const fromStr = src?.from != null ? String(src.from) : (m as any).from ? String((m as any).from) : undefined;
    const bizStr  = src?.phone_number != null ? String(src.phone_number) : undefined;
    const toStr   = src?.to != null ? String(src.to) : (m as any).to ? String((m as any).to) : undefined;

    let direction = rawDir;
    if (!direction || direction === "") {
      if (fromStr && bizStr && fromStr !== bizStr) direction = "IN";
      else if (toStr) direction = "OUT";
    }

    const sender: ChatMessage["sender"] =
      direction === "IN" ? "CLIENT"
      : direction === "OUT" ? "OPERADOR"
      : "SYSTEM";

    const content = (m as any).text ?? src?.text ?? src?.body ?? src?.message ?? "";
    const ts = (m as any).timestamp ?? src?.timestamp ?? src?.date ?? src?.createdAt ?? Date.now();
    const name = src?.profile_name ?? (sender === "CLIENT" ? "Cliente" : sender === "OPERADOR" ? "Operador" : "Sistema");

    return {
      id: (m as any).id ?? src?.id ?? (m as any)._id ?? `${chatId}-${ts}`,
      chatId,
      sender,
      content: String(content),
      type: "TEXT",
      timestamp: new Date(ts),
      senderName: name,
    };
  };

  const buildStateFromN8n = (items: N8nMsg[]) => {
    const groups = new Map<string, { phone: string; msgs: ChatMessage[]; last: ChatMessage | null }>();

    for (const raw of items) {
      const src: any = (raw as any).raw ?? raw;

      const rawDir = (raw as any).direction?.toUpperCase?.();
      const fromStr = src?.from != null ? String(src.from) : (raw as any).from ? String((raw as any).from) : undefined;
      const bizStr  = src?.phone_number != null ? String(src.phone_number) : undefined;
      const toStr   = src?.to != null ? String(src.to) : (raw as any).to ? String((raw as any).to) : undefined;

      let dir = rawDir;
      if (!dir || dir === "") {
        if (fromStr && bizStr && fromStr !== bizStr) dir = "IN";
        else if (toStr) dir = "OUT";
      }

      const peer = dir === "IN" ? normalizePhone(fromStr) : normalizePhone(toStr);
      if (!peer) continue;

      const chatId = peer;
      const cm = mapN8nToChatMessage(raw, chatId);
      const prev = groups.get(chatId) ?? { phone: peer, msgs: [], last: null };
      prev.msgs.push(cm);
      if (!prev.last || cm.timestamp > prev.last.timestamp) prev.last = cm;
      groups.set(chatId, prev);
    }

    const nextByChat: Record<string, ChatMessage[]> = {};
    const nextChats: ChatItem[] = [];

    groups.forEach((data, chatId) => {
      const sorted = [...data.msgs].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      nextByChat[chatId] = sorted;

      const last = sorted[sorted.length - 1];
      const clientDisplayName = sorted.find(m => m.sender === "CLIENT")?.senderName || "Cliente";

      nextChats.push({
        chatId,
        clientId: chatId,
        clientName: clientDisplayName,
        phone: data.phone,
        status: "ACTIVE",
        isOnline: true,
        lastMessageTime: last?.timestamp ?? new Date(),
        lastMessagePreview: last?.type === "IMAGE" ? "📷 Imagen" : last?.content ?? "",
        avatar: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(clientDisplayName.slice(0, 2))}`,
      });
    });

    nextChats.sort((a, b) => b.lastMessageTime.getTime() - a.lastMessageTime.getTime());
    return { nextChats, nextByChat };
  };

  // ---- Carga inicial + polling ----
  useEffect(() => {
    let mounted = true;

    async function loadInitial() {
      try {
        setLoading(true);
        const raw = await listAllMessages();
        if (!mounted) return;
        const { nextChats, nextByChat } = buildStateFromN8n(raw);
        const merged = mergeWithPending(nextByChat); // fusiona con optimistas (persistidos)
        setChats(nextChats);
        setByChat(merged);
        if (!selectedChatId && nextChats[0]) setSelectedChatId(nextChats[0].chatId);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadInitial();

    pollRef.current = setInterval(async () => {
      try {
        const raw = await listAllMessages();
        if (!mounted) return;
        const { nextChats, nextByChat } = buildStateFromN8n(raw);
        const merged = mergeWithPending(nextByChat);
        setChats(nextChats);
        setByChat(merged);
      } catch (e) {
        console.error("[useChatOperator] polling error:", e);
      }
    }, pollMs);

    return () => {
      mounted = false;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [pollMs, selectedChatId, mergeWithPending]);

  const pushMessage = useCallback((chatId: string, msg: ChatMessage) => {
    setByChat((prev) => {
      const next = { ...prev };
      next[chatId] = [...(next[chatId] ?? []), msg];
      return next;
    });
    setChats((prev) =>
      prev
        .map((c) =>
          c.chatId === chatId
            ? {
                ...c,
                lastMessageTime: msg.timestamp,
                lastMessagePreview: msg.type === "TEXT" ? msg.content ?? "" : "📷 Imagen",
              }
            : c
        )
        .sort((a, b) => b.lastMessageTime.getTime() - a.lastMessageTime.getTime())
    );
  }, []);

  const handleSend = useCallback(async () => {
    if (!selectedChatId) return;
    const text = message.trim();
    if (!text) return;

    setLocalSending(true);

    const outgoing: ChatMessage = {
      id: uuid(),
      chatId: selectedChatId,
      sender: "OPERADOR",
      content: text,
      type: "TEXT",
      timestamp: new Date(),
      senderName: "Operador",
      // pending: true,
    };

    try {
      const targetPhone = current?.phone ?? normalizePhone(selectedChatId);
      if (!targetPhone) throw new Error("No se pudo determinar el teléfono del destinatario.");

      // Optimista: mostrar y guardar en pendientes (persistido)
      pushMessage(selectedChatId, outgoing);
      setPendingByChat(prev => {
        const next = { ...prev };
        next[selectedChatId] = [...(next[selectedChatId] ?? []), outgoing];
        return next;
      });

      await sendTextMessage(targetPhone.startsWith("+") ? targetPhone : `+${targetPhone}`, text);
      // Se reconciliará en el siguiente poll automáticamente
    } catch (e) {
      console.error("[useChatOperator] Error enviando:", e);
      // si falla, podrías removerlo de pending
      setPendingByChat(prev => {
        const next = { ...prev };
        next[selectedChatId] = (next[selectedChatId] ?? []).filter(m => m.id !== outgoing.id);
        return next;
      });
    } finally {
      setMessage("");
      setLocalSending(false);
    }
  }, [current?.phone, message, selectedChatId, pushMessage]);

  const handlePickImage = useCallback(() => fileRef.current?.click(), []);

  const handleImageSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !selectedChatId) return;

      setLocalSending(true);
      const localUrl = URL.createObjectURL(file);

      const imgMsg: ChatMessage = {
        id: uuid(),
        chatId: selectedChatId,
        sender: "OPERADOR",
        type: "IMAGE",
        imageUrl: localUrl,
        timestamp: new Date(),
        senderName: "Operador",
      };

      pushMessage(selectedChatId, imgMsg);
      setLocalSending(false);
      e.target.value = "";
    },
    [selectedChatId, pushMessage]
  );

  const finishChat = useCallback((chatId: string) => {
    const sysMsg: ChatMessage = {
      id: uuid(),
      chatId,
      sender: "SYSTEM",
      content: "Conversación finalizada por el operador.",
      type: "TEXT",
      timestamp: new Date(),
      senderName: "Sistema",
    };
    pushMessage(chatId, sysMsg);
    setChats((prev) => prev.map((c) => (c.chatId === chatId ? { ...c, status: "FINISHED" } : c)));
  }, [pushMessage]);

  const chatPreviews = useMemo<ChatPreview[]>(() => {
    return chats.map((c) => {
      const list = byChat[c.chatId] ?? [];
      const last = list[list.length - 1];
      const lastText = last?.type === "IMAGE" ? "📷 Imagen" : last?.content ?? c.lastMessagePreview ?? "";
      const preview: any = {
        chatId: c.chatId,
        clientId: c.clientId,
        clientName: c.clientName,
        lastMessage: lastText,
        lastMessageTime: last?.timestamp ?? c.lastMessageTime,
        unreadCount: 0,
        status: c.status,
        isOnline: c.isOnline,
        avatar: c.avatar,
        phone: c.phone,
      };
      return preview as ChatPreview;
    });
  }, [byChat, chats]);

  return {
    state: {
      loading,
      chats,
      chatPreviews,
      selectedChatId,
      messages,
      message,
      localSending,
      fileRef,
      current,
    },
    actions: {
      setSelectedChatId,
      setMessage,
      handleSend,
      handlePickImage,
      handleImageSelected,
      finishChat,
    },
  };
}
