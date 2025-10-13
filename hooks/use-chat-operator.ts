"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChatPreview } from "@/types/chats";
import { useSocket } from "@/hooks/use-socket";
import {
  assignWithAutoHeal,
  ensureOperatorContext,
  getActiveChats,
  getChatMessages,
  ensureAssignmentForChat,
  setOperatorState,
} from "@/components/helpers/helper.assign";
import { listAssignedChatsWithMessages } from "@/components/helpers/helper.chats";
import { useToast } from "@/hooks/use-toast";

/* ===== Tipos ===== */
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
  clientMessageId?: string;
}

export interface UseChatOperatorOptions { token?: string; mock?: boolean; }

/* ===== Config ===== */
const MAX_ACTIVE = Number(process.env.NEXT_PUBLIC_MAX_ACTIVE ?? 6);
const ENABLE_AUTO_ASSIGN = String(process.env.NEXT_PUBLIC_AUTO_ASSIGN ?? "0") === "1";

/* ===== Utils ===== */
const uuid = () =>
  (typeof crypto !== "undefined" && (crypto as any).randomUUID)
    ? (crypto as any).randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

const avatarFromName = (name?: string) =>
  `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(name || "Cliente")}`;

const nChatId = (p: any) =>
  String(p?.chatId ?? p?.chatID ?? p?.chat_id ?? p?.chat ?? p?.roomId ?? "").trim();

const normSender = (v?: any) => String(v ?? "").toUpperCase();

/* ====== Name cache (persistente) ====== */
const NAME_CACHE_KEY = "op-chat-name-cache";
type NameCache = Record<string, string>;

function readNameCache(): NameCache {
  try { return JSON.parse(localStorage.getItem(NAME_CACHE_KEY) || "{}"); } catch { return {}; }
}
function writeNameCache(map: NameCache) {
  try { localStorage.setItem(NAME_CACHE_KEY, JSON.stringify(map)); } catch {}
}
function getCachedName(chatId: string): string | undefined {
  return readNameCache()[chatId];
}
function isLikelyIdentifier(s?: string): boolean {
  if (!s) return false;
  const t = s.trim();
  if (!t) return false;
  if (/^[a-f0-9]{24}$/i.test(t)) return true;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(t)) return true;
  if (/^\d{6,}$/.test(t)) return true;
  return false;
}
function sanitizeDisplayName(s?: string): string | undefined {
  const t = String(s ?? "").trim();
  if (!t) return undefined;
  if (isLikelyIdentifier(t)) return undefined;
  return t;
}
function setCachedName(chatId: string, name?: string) {
  const good = sanitizeDisplayName(name);
  if (!chatId || !good) return;
  const map = readNameCache();
  if (map[chatId] === good) return;
  map[chatId] = good;
  writeNameCache(map);
}

/** Mapea crudo → ChatMessage (incluye clientMessageId) */
const mapRawToMessage = (raw: any, chatId: string): ChatMessage => {
  const senderRaw = normSender(raw?.senderType ?? raw?.sender ?? "SYSTEM");
  const sender =
    senderRaw === "AI" ? "BOT" :
    senderRaw === "OPERATOR" ? "OPERADOR" :
    (["CLIENT","BOT","OPERADOR","SYSTEM"].includes(senderRaw) ? senderRaw : "SYSTEM") as ChatMessage["sender"];
  const type = String(raw?.type ?? "TEXT").toUpperCase() as ChatMessage["type"];
  const ts = new Date(raw?.timestamp ?? raw?.createdAt ?? Date.now());
  return {
    id: String(raw?.id ?? raw?._id ?? `${chatId}-${+ts}`),
    chatId,
    sender,
    content: raw?.content ?? raw?.text ?? raw?.body ?? raw?.message ?? "",
    type,
    imageUrl: raw?.imageUrl,
    timestamp: ts,
    senderName: raw?.senderName,
    clientMessageId: raw?.clientMessageId ?? raw?.meta?.clientMessageId,
  };
};

function emitWithAck(socket: any, event: string, payload: any, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    try {
      socket.timeout(timeoutMs).emit(event, payload, (err: any, res?: any) => {
        if (err) return reject(err);
        resolve(res);
      });
    } catch (e) { reject(e); }
  });
}

/* ===== twin (client/op ids) ===== */
const makeTwinStore = () => {
  const primaryRef = new Map<string, string>(); // anyId -> opPrimary
  return {
    linkPair: (opId?: string, clientId?: string) => {
      if (!opId || !clientId || opId === clientId) return;
      primaryRef.set(opId, opId); primaryRef.set(clientId, opId);
    },
    toPrimary: (id?: string) => (id ? (primaryRef.get(id) ?? id) : id),
  };
};

/* ===== Hook ===== */
export function useChatOperator({ token }: UseChatOperatorOptions) {
  const fileRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | undefined>();
  const [message, setMessage] = useState("");
  const [localSending, setLocalSending] = useState(false);
  const [byChat, setByChat] = useState<Record<string, ChatMessage[]>>({});

  const { toast } = useToast();

  const { socket, isConnected } = useSocket({
    userRole: "OPERADOR",
    serverUrl: process.env.NEXT_PUBLIC_WS_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002",
  });

  const { token: ensuredToken, operatorId: ensuredOperatorId } = ensureOperatorContext();
  const authToken = token || ensuredToken;
  const operatorId = useMemo(() => {
    const v = ensuredOperatorId;
    if (!v) return "";
    if (typeof v === "string") return v.trim();
    return String((v as any).id ?? (v as any)._id ?? v).trim();
  }, [ensuredOperatorId]);

  const joinedRoomsRef = useRef<Set<string>>(new Set());
  const historyRequestedRef = useRef<Set<string>>(new Set());
  const twins = useRef(makeTwinStore());

  // refs para leer estado dentro de listeners
  const chatsRef = useRef<ChatItem[]>([]);
  const byChatRef = useRef<Record<string, ChatMessage[]>>({});
  useEffect(() => { chatsRef.current = chats; }, [chats]);
  useEffect(() => { byChatRef.current = byChat; }, [byChat]);

  /* ===== Notificaciones ===== */
  useEffect(() => {
    if (typeof window === "undefined") return;
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  const showIncomingNotification = useCallback((title: string, body: string) => {
    toast({ title, description: body.length > 120 ? body.slice(0, 117) + "…" : body });
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      try { new Notification(title, { body }); } catch {}
    }
  }, [toast]);

  const requestHistoryIfNeeded = useCallback((id: string) => {
    if (!socket || !isConnected || !id) return;
    if (historyRequestedRef.current.has(id)) return;
    socket.emit("getChatMessages", { chatId: id });
    historyRequestedRef.current.add(id);
  }, [socket, isConnected]);

  // AVAILABLE
  useEffect(() => {
    if (!operatorId) return;
    setOperatorState(operatorId, "AVAILABLE", authToken).catch(() => {});
  }, [operatorId, authToken]);

  /* ====== Carga inicial ====== */
  useEffect(() => {
    let mounted = true;

    async function tryFillSlots(currentCount: number) {
      if (!ENABLE_AUTO_ASSIGN || !operatorId) return;
      let count = currentCount;
      while (count < MAX_ACTIVE) {
        const res = await assignWithAutoHeal(operatorId, authToken);
        if (!res || (res as any).ok === false) break;
        count++;
        await new Promise((r) => setTimeout(r, 120));
      }
    }

    async function hydrateAssigned() {
      if (!operatorId) {
        if (mounted) { setChats([]); setByChat({}); setSelectedChatId(undefined); }
        return;
      }

      try { await tryFillSlots(chats.length); } catch {}

      let base: ChatItem[] = [];
      let by: Record<string, ChatMessage[]> = {};

      // 1) HTTP
      const active = await getActiveChats(operatorId, authToken);
      const itemsOk = (active as any)?.ok && Array.isArray((active as any).items) && (active as any).items.length > 0;

      if (itemsOk) {
        const items: any[] = (active as any).items;
        base = items.map((x: any) => {
          const opId = String(x?.chatId ?? x?.id ?? x?._id);
          const status = String(x?.status ?? "ACTIVE") as ChatStatus;
          const clientId = String(x?.clientId ?? x?.userId ?? x?.client?._id ?? x?.user?._id ?? "");
          const updatedAt = x?.updatedAt ?? x?.createdAt ?? Date.now();

          const candidate = x?.clientName || x?.name || x?.displayName || x?.client?.name || x?.user?.name;
          const cached = getCachedName(opId);
          const clientName = sanitizeDisplayName(cached || candidate) || "Cliente";

          const phone = x?.phone ?? x?.client?.phone ?? x?.user?.phone;
          return {
            chatId: opId, clientId: clientId || "", clientName, phone,
            status, isOnline: true, lastMessageTime: new Date(updatedAt),
            lastMessagePreview: "", avatar: avatarFromName(clientName),
          };
        });

        by = {};
        await Promise.all(base.map(async (c) => {
          try {
            const rawMsgs = await getChatMessages(c.chatId, authToken) as any;
            const arr = Array.isArray(rawMsgs?.messages) ? rawMsgs.messages : Array.isArray(rawMsgs) ? rawMsgs : [];
            const histClientName = sanitizeDisplayName((rawMsgs as any)?.clientName);
            if (histClientName) {
              setCachedName(c.chatId, histClientName);
              c.clientName = histClientName;
              c.avatar = avatarFromName(histClientName);
            }

            const msgs: ChatMessage[] = (arr as any[])
              .map((m: any) => mapRawToMessage(m, c.chatId))
              .sort((a: ChatMessage, b: ChatMessage) => a.timestamp.getTime() - b.timestamp.getTime());
            by[c.chatId] = msgs;

            const firstClient = msgs.find(m => m.sender === "CLIENT" && sanitizeDisplayName(m.senderName));
            const best = sanitizeDisplayName(getCachedName(c.chatId) || firstClient?.senderName || c.clientName);
            if (best && best !== c.clientName) {
              c.clientName = best;
              c.avatar = avatarFromName(best);
              setCachedName(c.chatId, best);
            }

            const last = msgs[msgs.length - 1];
            if (last) {
              c.lastMessageTime = last.timestamp;
              c.lastMessagePreview = last.type === "IMAGE" ? "📷 Imagen" : (last.content ?? "");
            }
          } catch { by[c.chatId] = []; }
        }));
      } else {
        // 2) Fallback
        const fb = await listAssignedChatsWithMessages(operatorId);
        base = fb.chats.map((x: any) => {
          const opId = String(x?.id ?? x?._id);
          const clientId = String(x?.clientId?._id ?? x?.clientId ?? x?.userId ?? "");
          const candidate = x?.clientName || x?.name || x?.displayName || x?.client?.name || x?.user?.name;
          const cached = getCachedName(opId);
          const clientName = sanitizeDisplayName(cached || candidate) || "Cliente";
          const lastTs = x?.lastMessageAt ?? x?.updatedAt ?? Date.now();
          const lastPrev = x?.lastMessage?.type === "IMAGE" ? "📷 Imagen" : (x?.lastMessage?.text ?? x?.lastMessage?.body ?? "");
          return {
            chatId: opId, clientId: clientId || "", clientName,
            phone: x?.phone, status: (x?.status ?? "ACTIVE").toUpperCase() as ChatStatus,
            isOnline: true, lastMessageTime: new Date(lastTs),
            lastMessagePreview: lastPrev, avatar: avatarFromName(clientName),
          } as ChatItem;
        });

        by = {};
        for (const [k, arrAny] of Object.entries(fb.byChat)) {
          const opId = String(k);
          const arr = Array.isArray(arrAny) ? arrAny : [];
          const msgs = arr.map((m: any) => mapRawToMessage(m, opId))
            .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
          by[opId] = msgs;

          const firstClient = msgs.find(m => m.sender === "CLIENT" && sanitizeDisplayName(m.senderName));
          const best = sanitizeDisplayName(getCachedName(opId) || firstClient?.senderName);
          if (best) setCachedName(opId, best);
        }
      }

      const dedup = new Map<string, ChatItem>();
      for (const c of base) dedup.set(c.chatId, c);
      const finalList = Array.from(dedup.values()).sort((a, b) => b.lastMessageTime.getTime() - a.lastMessageTime.getTime());

      if (!mounted) return;
      setChats(finalList);
      setByChat(by);
      if (!selectedChatId && finalList[0]) setSelectedChatId(finalList[0].chatId);

      if (socket && isConnected) {
        finalList.forEach(c => {
          if (!joinedRoomsRef.current.has(c.chatId)) {
            socket.emit("joinChat", { chatId: c.chatId, as: "OPERADOR", operatorId, userId: operatorId });
            joinedRoomsRef.current.add(c.chatId);
          }
          requestHistoryIfNeeded(c.chatId);
        });
      }
    }

    setLoading(true);
    hydrateAssigned().finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [operatorId, isConnected]); // eslint-disable-line

  /* ====== JOIN selected ====== */
  useEffect(() => {
    if (!socket || !isConnected || !selectedChatId || !operatorId) return;
    const primary = twins.current.toPrimary(selectedChatId) || selectedChatId;
    if (!joinedRoomsRef.current.has(primary)) {
      socket.emit("joinChat", { chatId: primary, as: "OPERADOR", operatorId, userId: operatorId });
      joinedRoomsRef.current.add(primary);
    }
    requestHistoryIfNeeded(primary);
  }, [socket, isConnected, selectedChatId, operatorId, requestHistoryIfNeeded]);

  /* ====== Helpers UI ====== */
  const bestClientNameFromMsg = (msg: any) => {
    const senderType = normSender(msg?.senderType ?? msg?.sender);
    const isClient = senderType === "CLIENT";
    return sanitizeDisplayName(isClient ? (msg?.senderName || msg?.clientName) : msg?.clientName);
  };

  const ensureChatItem = (primaryId: string, seed?: { fromMsg?: any; fromAuto?: any; fromHistoryName?: string }) => {
    setChats(prev => {
      const cached = getCachedName(primaryId);
      const nmSeed =
        sanitizeDisplayName(seed?.fromHistoryName) ||
        (seed?.fromMsg && bestClientNameFromMsg(seed.fromMsg)) ||
        sanitizeDisplayName(seed?.fromAuto?.clientName) ||
        cached;

      if (prev.some(c => c.chatId === primaryId)) {
        if (nmSeed) {
          setCachedName(primaryId, nmSeed);
          return prev.map(c => c.chatId === primaryId ? { ...c, clientName: nmSeed, avatar: avatarFromName(nmSeed) } : c);
        }
        return prev;
      }

      const nm = nmSeed || "Cliente";
      const cid = String(seed?.fromMsg?.clientId ?? seed?.fromAuto?.clientId ?? "");
      const ts = new Date(seed?.fromMsg?.timestamp ?? seed?.fromAuto?.timestamp ?? Date.now());
      const lastPrev = seed?.fromMsg?.type === "IMAGE" ? "📷 Imagen" : (seed?.fromMsg?.content ?? seed?.fromAuto?.message ?? "");
      if (nmSeed) setCachedName(primaryId, nmSeed);

      const item: ChatItem = {
        chatId: primaryId,
        clientId: cid,
        clientName: nm,
        phone: undefined,
        status: "ACTIVE",
        isOnline: true,
        lastMessageTime: ts,
        lastMessagePreview: lastPrev,
        avatar: avatarFromName(nm),
      };
      return [item, ...prev];
    });
  };

  /* ====== Listeners WS ====== */
  useEffect(() => {
    if (!socket) return;

    const upsertMessages = (primaryId: string, incoming: ChatMessage[]) => {
      setByChat(prev => {
        const curr = prev[primaryId] ?? [];
        let next = [...curr];

        for (const m of incoming) {
          if (m.sender === "CLIENT" && sanitizeDisplayName(m.senderName)) {
            setCachedName(primaryId, m.senderName);
            setChats(prevChats => prevChats.map(c =>
              c.chatId === primaryId ? { ...c, clientName: sanitizeDisplayName(m.senderName)!, avatar: avatarFromName(m.senderName) } : c
            ));
          }
          if (m.clientMessageId) {
            const idxOpt = next.findIndex(x => x.id === m.clientMessageId && x.sender === m.sender);
            if (idxOpt !== -1) { next[idxOpt] = m; continue; }
          }
          if (next.some(x => x.id === m.id)) continue;
          const idxInv = next.findIndex(x => x.clientMessageId && x.clientMessageId === m.id && x.sender === m.sender);
          if (idxInv !== -1) { next[idxInv] = m; continue; }
          next.push(m);
        }

        next.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        return { ...prev, [primaryId]: next };
      });

      const last = incoming[incoming.length - 1];
      if (last) {
        setChats(prev =>
          prev.map(c =>
            c.chatId === primaryId
              ? { ...c, lastMessageTime: last.timestamp, lastMessagePreview: last.type === "IMAGE" ? "📷 Imagen" : (last.content ?? "") }
              : c
          ).sort((a, b) => b.lastMessageTime.getTime() - a.lastMessageTime.getTime())
        );
      }
    };

    const onCompatHistory = (p: any) => {
      const opId = nChatId(p) || String(p?.chatId ?? p?.id ?? "");
      const arr = Array.isArray(p?.messages) ? p.messages : [];
      if (!opId) return;

      const mapped: ChatMessage[] = (arr as any[])
        .map((m: any) => mapRawToMessage(m, opId))
        .sort((a: ChatMessage, b: ChatMessage) => a.timestamp.getTime() - b.timestamp.getTime());

      const preferredName = sanitizeDisplayName(p?.clientName);
      if (preferredName) {
        setCachedName(opId, preferredName);
        setChats(prev => prev.map(c => c.chatId === opId ? { ...c, clientName: preferredName, avatar: avatarFromName(preferredName) } : c));
      } else {
        const firstClient = arr.find((m: any) => normSender(m?.senderType ?? m?.sender) === "CLIENT" && (m?.senderName || m?.clientName));
        const fallback = sanitizeDisplayName(firstClient?.senderName || firstClient?.clientName);
        if (fallback) {
          setCachedName(opId, fallback);
          setChats(prev => prev.map(c => c.chatId === opId ? { ...c, clientName: fallback, avatar: avatarFromName(fallback) } : c));
        }
      }

      ensureChatItem(opId, { fromMsg: arr[0], fromHistoryName: preferredName });
      if (mapped.length) upsertMessages(opId, mapped);
    };

    const onCompatMessage = (msg: any) => {
      const rawId = nChatId(msg);
      if (!rawId) return;
      const primaryId = twins.current.toPrimary(rawId) || rawId;

      // ❌ NO auto-join por mensajes (evita colarse en chats ajenos)
      const known = !!chatsRef.current.find(c => c.chatId === primaryId);
      if (!known) return;

      const nm = bestClientNameFromMsg(msg);
      if (nm) setCachedName(primaryId, nm);

      const mapped = mapRawToMessage(msg, primaryId);
      upsertMessages(primaryId, [mapped]);

      const isIncoming = mapped.sender !== "OPERADOR";
      const isOtherChat = selectedChatId !== primaryId;
      const isHidden = typeof document !== "undefined" ? document.hidden : false;
      if (isIncoming && (isOtherChat || isHidden)) {
        const title = sanitizeDisplayName(mapped.senderName) || "Nuevo mensaje";
        const preview = mapped.type === "IMAGE" ? "📷 Imagen" : (mapped.content || "");
        showIncomingNotification(title!, preview);
      }
    };

    const onChatFinished = (d: any) => {
      const id = nChatId(d);
      const primaryId = twins.current.toPrimary(id) || id;
      if (!primaryId) return;
      setChats(prev => prev.map(c => (c.chatId === primaryId ? { ...c, status: "FINISHED" } : c)));
      const sysMsg: ChatMessage = {
        id: uuid(), chatId: primaryId, sender: "SYSTEM",
        content: "✅ El operador ha finalizado este chat.", type: "TEXT", timestamp: new Date(), senderName: "Sistema",
      };
      upsertMessages(primaryId, [sysMsg]);
    };

    // ⛔️ Procesar asignaciones SOLO si son para este operador
    const onOperatorAssigned = (d: any) => {
      if (String(d?.operatorId) !== operatorId) return;
      const id = nChatId(d) || String(d?.chatId ?? "");
      if (!id) return;
      const nm = sanitizeDisplayName(d?.clientName);
      if (nm) {
        setCachedName(id, nm);
        setChats(prev => prev.map(c => c.chatId === id ? { ...c, clientName: nm, avatar: avatarFromName(nm) } : c));
      }
      ensureChatItem(id, { fromAuto: d, fromHistoryName: nm });

      if (!joinedRoomsRef.current.has(id)) {
        socket.emit("joinChat", { chatId: id, as: "OPERADOR", operatorId, userId: operatorId });
        joinedRoomsRef.current.add(id);
      }
      requestHistoryIfNeeded(id);
    };

    const onChatAutoAssigned = (d: any) => {
      if (String(d?.operatorId) !== operatorId) return;
      const id = nChatId(d) || String(d?.chatId ?? "");
      if (!id) return;

      if (!joinedRoomsRef.current.has(id)) {
        socket.emit("joinChat", { chatId: id, as: "OPERADOR", operatorId, userId: operatorId });
        joinedRoomsRef.current.add(id);
      }

      const arr = Array.isArray(d?.history) ? d.history : [];
      const firstClient = arr.find((m: any) => normSender(m?.senderType ?? m?.sender) === "CLIENT" && (m?.senderName || m?.clientName));
      const seedName = sanitizeDisplayName(d?.clientName) || sanitizeDisplayName(firstClient?.senderName || firstClient?.clientName);
      if (seedName) {
        setCachedName(id, seedName);
        setChats(prev => prev.map(c => c.chatId === id ? { ...c, clientName: seedName, avatar: avatarFromName(seedName) } : c));
      }

      ensureChatItem(id, { fromAuto: { ...d, clientName: seedName }, fromHistoryName: seedName });

      if (arr.length) {
        const mapped: ChatMessage[] = (arr as any[])
          .map((m: any) => mapRawToMessage(m, id))
          .sort((a: ChatMessage, b: ChatMessage) => a.timestamp.getTime() - b.timestamp.getTime());
        upsertMessages(id, mapped);
      }
    };

    const onClientNameUpdated = (d: any) => {
      const id = nChatId(d) || String(d?.chatId ?? "");
      const nm = sanitizeDisplayName(d?.clientName);
      if (!id || !nm) return;
      setCachedName(id, nm);
      setChats(prev => prev.map(c => c.chatId === id ? { ...c, clientName: nm, avatar: avatarFromName(nm) } : c));
    };

    const onError = (e: any) => console.warn("[WS] error", e);

    const MESSAGE_EVENTS = ["newMessage"] as const;
    MESSAGE_EVENTS.forEach(evt => socket.on(evt, onCompatMessage));

    socket.on("chatHistory", onCompatHistory);
    socket.on("chatMessages", onCompatHistory);
    socket.on("chatFinished", onChatFinished);
    socket.on("operatorAssigned", onOperatorAssigned);
    socket.on("specialistAssigned", onOperatorAssigned);
    socket.on("chatAutoAssigned", onChatAutoAssigned);
    socket.on("clientNameUpdated", onClientNameUpdated);
    socket.on("error", onError);

    const onConnect = () => console.log("[WS] conectado", socket.id);
    const onDisconnect = (r: any) => console.log("[WS] desconectado", r);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onError);

    return () => {
      MESSAGE_EVENTS.forEach(evt => socket.off(evt, onCompatMessage));
      socket.off("chatHistory", onCompatHistory);
      socket.off("chatMessages", onCompatHistory);
      socket.off("chatFinished", onChatFinished);
      socket.off("operatorAssigned", onOperatorAssigned);
      socket.off("specialistAssigned", onOperatorAssigned);
      socket.off("chatAutoAssigned", onChatAutoAssigned);
      socket.off("clientNameUpdated", onClientNameUpdated);
      socket.off("error", onError);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onError);
    };
  }, [socket, operatorId, isConnected, selectedChatId, requestHistoryIfNeeded, showIncomingNotification]);

  /* ====== Envío ====== */
  const pushMessage = useCallback((primaryId: string, msg: ChatMessage) => {
    setByChat(prev => {
      const curr: ChatMessage[] = prev[primaryId] ?? [];
      if (curr.some(x => x.id === msg.id)) return prev;
      const next = [...curr, msg].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      return { ...prev, [primaryId]: next };
    });
    setChats(prev =>
      prev.map(c =>
        c.chatId === primaryId
          ? { ...c, lastMessageTime: msg.timestamp, lastMessagePreview: msg.type === "TEXT" ? (msg.content ?? "") : "📷 Imagen" }
          : c
      ).sort((a, b) => b.lastMessageTime.getTime() - a.lastMessageTime.getTime())
    );
  }, []);

  const handleSend = useCallback(async () => {
    const rawSelected = selectedChatId;
    if (!rawSelected) return;

    const primaryId = twins.current.toPrimary(rawSelected) || rawSelected;
    const text = message.trim();
    if (!text) return;

    setLocalSending(true);

    const tmpId = uuid();
    const outgoing: ChatMessage = {
      id: tmpId,
      clientMessageId: tmpId,
      chatId: primaryId,
      sender: "OPERADOR",
      content: text,
      type: "TEXT",
      timestamp: new Date(),
      senderName: "Operador",
    };

    try {
      const cl = chats.find((c) => c.chatId === primaryId || c.chatId === rawSelected)?.clientId;
      if (operatorId && cl && cl !== primaryId && cl !== rawSelected) {
        await ensureAssignmentForChat(primaryId, authToken, cl, operatorId).catch(() => {});
      }

      pushMessage(primaryId, outgoing);
      if (!socket) throw new Error("Socket no disponible");

      await emitWithAck(socket, "sendMessage", {
        chatId: primaryId,
        userId: operatorId,
        senderType: "OPERADOR",
        clientName: "Operador",
        type: "TEXT",
        content: text,
        timestamp: Date.now(),
        clientMessageId: tmpId,
      }, 3000);
    } catch (e) {
      console.error("[OPERADOR] error al enviar:", e);
      toast({ title: "No se pudo enviar", description: "Revisa tu conexión.", variant: "destructive" });
    } finally {
      setMessage("");
      setLocalSending(false);
    }
  }, [selectedChatId, message, operatorId, socket, pushMessage, authToken, chats, toast]);

  const handlePickImage = useCallback(() => fileRef.current?.click(), []);

  const handleImageSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const rawSelected = selectedChatId;
    if (!file || !rawSelected) return;

    const primaryId = twins.current.toPrimary(rawSelected) || rawSelected;
    setLocalSending(true);

    const localUrl = URL.createObjectURL(file);
    const tmpId = uuid();
    const imgMsg: ChatMessage = {
      id: tmpId,
      clientMessageId: tmpId,
      chatId: primaryId,
      sender: "OPERADOR",
      type: "IMAGE",
      imageUrl: localUrl,
      timestamp: new Date(),
      senderName: "Operador",
    };

    try {
      const cl = chats.find((c) => c.chatId === primaryId || c.chatId === rawSelected)?.clientId;
      if (operatorId && cl && cl !== primaryId && cl !== rawSelected) {
        await ensureAssignmentForChat(primaryId, authToken, cl, operatorId).catch(() => {});
      }

      pushMessage(primaryId, imgMsg);

      await postChatMessage(primaryId, {
        sender: "OPERADOR", type: "IMAGE", imageUrl: localUrl,
        content: (message || "").trim() || undefined, timestamp: Date.now(),
        clientMessageId: tmpId,
      }, authToken);
    } catch (err) {
      console.error("[useChatOperator] Error enviando imagen:", err);
      toast({ title: "No se pudo enviar la imagen", description: "Reintenta más tarde.", variant: "destructive" });
    } finally {
      setLocalSending(false);
      e.target.value = "";
    }
  }, [selectedChatId, pushMessage, message, authToken, operatorId, chats, toast]);

  const finishChat = useCallback((chatId: string) => {
    const primary = twins.current.toPrimary(chatId) || chatId;
    const sysMsg: ChatMessage = {
      id: uuid(), chatId: primary, sender: "SYSTEM",
      content: "Conversación finalizada por el operador.", type: "TEXT",
      timestamp: new Date(), senderName: "Sistema",
    };
    pushMessage(primary, sysMsg);
    setChats(prev => prev.map(c => (c.chatId === primary ? { ...c, status: "FINISHED" } : c)));
  }, [pushMessage]);

  // acción para setear nombre desde el panel operador
  const setClientName = useCallback(async (chatId: string, name: string) => {
    if (!socket || !chatId || !name.trim()) return;
    try {
      const res = await emitWithAck(socket, "setClientName", { chatId, clientName: name.trim() }, 3000) as any;
      const finalName = sanitizeDisplayName(res?.name) || sanitizeDisplayName(name);
      if (finalName) {
        setCachedName(chatId, finalName);
        setChats(prev => prev.map(c => c.chatId === chatId ? ({ ...c, clientName: finalName, avatar: avatarFromName(finalName) }) : c));
      }
    } catch (e) {
      console.warn("[setClientName] error", e);
      toast({ title: "No se pudo actualizar el nombre", description: "Intenta nuevamente.", variant: "destructive" });
    }
  }, [socket, toast]);

  const current = useMemo(() => chats.find((c) => c.chatId === selectedChatId), [chats, selectedChatId]);
  const messagesMemo = useMemo<ChatMessage[]>(() =>
    (selectedChatId ? byChat[twins.current.toPrimary(selectedChatId)!] ?? [] : []),
    [byChat, selectedChatId]
  );

  const chatPreviews = useMemo<ChatPreview[]>(() => {
    return chats.map((c) => {
      const list = byChat[c.chatId] ?? [];
      const last = list[list.length - 1];
      const lastText = last?.type === "IMAGE" ? "📷 Imagen" : last?.content ?? c.lastMessagePreview ?? "";
      return {
        chatId: c.chatId, clientId: c.clientId, clientName: c.clientName,
        lastMessage: lastText, lastMessageTime: last?.timestamp ?? c.lastMessageTime,
        unreadCount: 0, status: c.status, isOnline: c.isOnline, avatar: c.avatar, phone: c.phone,
      } as ChatPreview;
    });
  }, [byChat, chats]);

  return {
    state: {
      loading, chats, chatPreviews, selectedChatId,
      messages: messagesMemo, message, localSending, fileRef,
      current, isConnected,
    },
    actions: {
      setSelectedChatId, setMessage, handleSend,
      handlePickImage, handleImageSelected, finishChat,
      setClientName,
    },
  };
}

/* ====== HTTP helper para IMAGEN ====== */
export async function postChatMessage(
  chatId: string,
  payload: {
    sender: "CLIENT" | "OPERADOR" | "SYSTEM" | "BOT";
    type: "TEXT" | "IMAGE";
    content?: string;
    imageUrl?: string;
    timestamp?: string | number;
    clientMessageId?: string;
  },
  token?: string
): Promise<any> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/chats/${chatId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : "",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} - ${res.statusText}`);
  return res.json();
}
