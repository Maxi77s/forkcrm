"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChatPreview } from "@/types/chats";
import { useSocket } from "@/components/providers/socket-provider";
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
import { n8nSendTextOrImage, n8nSendTemplateVideo } from "@/components/helpers/helper.n8n";
import { API_BASE } from "@/lib/env.client";

/* ===== Tipos ===== */
type ChatStatus = "ACTIVE" | "WAITING" | "FINISHED";
type OrchestratorMode = "BOT" | "AI" | "HUMAN";

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
  /** NUEVO: para saber a qué operador está asignado en el back */
  specialistId?: string;
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

export interface UseChatOperatorOptions {
  token?: string;
}

/* =========================
 * CONFIG
 * ========================= */
const MAX_ACTIVE = Number(process.env.NEXT_PUBLIC_MAX_ACTIVE ?? 6);
const ENABLE_AUTO_ASSIGN = String(process.env.NEXT_PUBLIC_AUTO_ASSIGN ?? "0") === "1";

/* =========================
 * UTILS
 * ========================= */
const uuid = () =>
  typeof crypto !== "undefined" && (crypto as any).randomUUID
    ? (crypto as any).randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

const avatarFromName = (name?: string) =>
  `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(name || "Cliente")}`;

const nChatId = (p: any) =>
  String(p?.chatId ?? p?.chatID ?? p?.chat_id ?? p?.chat ?? p?.roomId ?? "").trim();

const normSender = (v?: any) => String(v ?? "").toUpperCase();

const NAME_CACHE_KEY = "op-chat-name-cache";
type NameCache = Record<string, string>;
const readNameCache = (): NameCache => {
  try {
    return JSON.parse(localStorage.getItem(NAME_CACHE_KEY) || "{}");
  } catch {
    return {};
  }
};
const writeNameCache = (map: NameCache) => {
  try {
    localStorage.setItem(NAME_CACHE_KEY, JSON.stringify(map));
  } catch {}
};
const getCachedName = (chatId: string) => readNameCache()[chatId];

function isLikelyIdentifier(s?: string): boolean {
  if (!s) return false;
  const t = s.trim();
  if (!t) return false;
  if (/^[a-f0-9]{24}$/i.test(t)) return true; // ObjectId
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(t)
  )
    return true; // uuid
  if (/^\d{6,}$/.test(t)) return true; // puro número largo
  return false;
}

function sanitizeDisplayName(s?: string): string | undefined {
  const t = String(s ?? "").trim();
  if (!t) return;
  if (isLikelyIdentifier(t)) return;
  // no filtrar teléfonos aquí; eso lo manejan otros helpers de UI
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

/* Fecha util */
const tsNum = (v: any) => {
  if (!v) return Date.now();
  const d = new Date(v);
  return isNaN(d.getTime()) ? Date.now() : d.getTime();
};

/* Mapper WS→UI */
const mapRawToMessage = (raw: any, chatId: string): ChatMessage => {
  const senderRaw = normSender(raw?.senderType ?? raw?.sender ?? "SYSTEM");
  const sender =
    senderRaw === "AI"
      ? "BOT" // UI agrupa IA como BOT “asistente”
      : senderRaw === "OPERATOR"
      ? "OPERADOR"
      : (["CLIENT", "BOT", "OPERADOR", "SYSTEM"].includes(senderRaw)
          ? (senderRaw as ChatMessage["sender"])
          : "SYSTEM");
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

/* emit con timeout/ack */
function emitWithAck(socket: any, event: string, payload: any, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    try {
      socket.timeout(timeoutMs).emit(event, payload, (err: any, res?: any) => {
        if (err) return reject(err);
        resolve(res);
      });
    } catch (e) {
      reject(e);
    }
  });
}

/* Twin store (id client/op) */
const makeTwinStore = () => {
  const primaryRef = new Map<string, string>(); // anyId -> opPrimary
  return {
    linkPair: (opId?: string, clientId?: string) => {
      if (!opId || !clientId || opId === clientId) return;
      primaryRef.set(opId, opId);
      primaryRef.set(clientId, opId);
    },
    toPrimary: (id?: string) => (id ? primaryRef.get(id) ?? id : id),
  };
};

/* =========================================================
 * HOOK PRINCIPAL
 * ========================================================= */
export function useChatOperator({ token }: UseChatOperatorOptions = {}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | undefined>();
  const [message, setMessage] = useState("");
  const [localSending, setLocalSending] = useState(false);
  const [byChat, setByChat] = useState<Record<string, ChatMessage[]>>({});

  // NUEVO: modo orquestador + indicador de “pensando”
  const [modeByChat, setModeByChat] = useState<Record<string, OrchestratorMode>>({});
  const [botThinking, setBotThinking] = useState<Record<string, boolean>>({});

  const { toast } = useToast();
  const { socket, isConnected } = useSocket();

  // Auth/ctx
  const { token: ensuredToken, operatorId: ensuredOperatorId } = ensureOperatorContext();
  const authToken = token || ensuredToken;
  const operatorId = useMemo(() => {
    const v = ensuredOperatorId;
    if (!v) return "";
    if (typeof v === "string") return v.trim();
    return String((v as any).id ?? (v as any)._id ?? v).trim();
  }, [ensuredOperatorId]);

  // Rooms joined / historial ya pedido / mapping ids
  const joinedRoomsRef = useRef<Set<string>>(new Set());
  const historyRequestedRef = useRef<Set<string>>(new Set());
  const twins = useRef(makeTwinStore());

  // refs p/estado dentro de listeners
  const chatsRef = useRef<ChatItem[]>([]);
  const byChatRef = useRef<Record<string, ChatMessage[]>>({});
  useEffect(() => {
    chatsRef.current = chats;
  }, [chats]);
  useEffect(() => {
    byChatRef.current = byChat;
  }, [byChat]);

  /* ===== Notificaciones desktop ===== */
  useEffect(() => {
    if (typeof window === "undefined") return;
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  const showIncomingNotification = useCallback(
    (title: string, body: string) => {
      toast({
        title,
        description: body.length > 120 ? body.slice(0, 117) + "…" : body,
      });
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        try {
          new Notification(title, { body });
        } catch {}
      }
    },
    [toast]
  );

  const requestHistoryIfNeeded = useCallback(
    (id: string) => {
      if (!socket || !isConnected || !id) return;
      if (historyRequestedRef.current.has(id)) return;
      socket.emit("getChatMessages", { chatId: id });
      historyRequestedRef.current.add(id);
    },
    [socket, isConnected]
  );

  /* marcar operador disponible */
  useEffect(() => {
    if (!operatorId) return;
    setOperatorState(operatorId, "AVAILABLE", authToken).catch(() => {});
  }, [operatorId, authToken]);

  /* =========================================================
   * CARGA INICIAL (HTTP + JOIN)
   * ========================================================= */
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
        if (mounted) {
          setChats([]);
          setByChat({});
          setSelectedChatId(undefined);
        }
        return;
      }

      try {
        await tryFillSlots(chats.length);
      } catch {}

      let base: ChatItem[] = [];
      let by: Record<string, ChatMessage[]> = {};

      // 1) HTTP oficial
      const active = await getActiveChats(operatorId, authToken);
      const itemsOk =
        (active as any)?.ok &&
        Array.isArray((active as any).items) &&
        (active as any).items.length > 0;

      if (itemsOk) {
        const items: any[] = (active as any).items;

        base = items.map((x: any) => {
          const opId = String(x?.chatId ?? x?.id ?? x?._id);
          const status = String(x?.status ?? "ACTIVE").toUpperCase() as ChatStatus;
          const clientId = String(
            x?.clientId ?? x?.userId ?? x?.client?._id ?? x?.user?._id ?? ""
          );
          const updatedAt =
            x?.updatedAt ??
            x?.lastMessageTime ??
            x?.lastMessageAt ??
            x?.createdAt ??
            Date.now();

          // 👇 DB PRIMERO, luego fallback y recién al final caché
          const candidate = sanitizeDisplayName(
            x?.clientName ||
              x?.name ||
              x?.displayName ||
              x?.client?.name ||
              x?.user?.name
          );
          const cached = sanitizeDisplayName(getCachedName(opId));
          const clientName = candidate || cached || "Cliente";
          const phone = x?.phone ?? x?.client?.phone ?? x?.user?.phone;

          return {
            chatId: opId,
            clientId: clientId || "",
            clientName,
            phone,
            status,
            isOnline: true,
            lastMessageTime: new Date(tsNum(updatedAt)),
            lastMessagePreview: "",
            avatar: avatarFromName(clientName),
            specialistId: x?.specialistId ? String(x.specialistId) : undefined, // NUEVO
          } as ChatItem;
        });

        // ⚠️ Filtrar SOLO si el payload trae specialistId (para no romper backends que ya filtran)
        if (operatorId && base.some((c) => typeof c.specialistId === "string")) {
          base = base.filter((c) => c.specialistId === operatorId);
        }

        by = {};

        await Promise.all(
          base.map(async (c) => {
            try {
              const rawMsgs = (await getChatMessages(c.chatId, authToken)) as any;
              const arr = Array.isArray(rawMsgs?.messages)
                ? rawMsgs.messages
                : Array.isArray(rawMsgs)
                ? rawMsgs
                : [];

              const histClientName = sanitizeDisplayName((rawMsgs as any)?.clientName);
              // solo completar si aún NO tengo nombre bueno
              if (!sanitizeDisplayName(c.clientName) && histClientName) {
                setCachedName(c.chatId, histClientName);
                c.clientName = histClientName;
                c.avatar = avatarFromName(histClientName);
              }

              const msgs: ChatMessage[] = (arr as any[])
                .map((m: any) => mapRawToMessage(m, c.chatId))
                .sort(
                  (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
                );
              by[c.chatId] = msgs;

              // semilla desde primer mensaje del cliente sólo si no hay nombre
              if (!sanitizeDisplayName(c.clientName)) {
                const firstClient = msgs.find(
                  (m) => m.sender === "CLIENT" && sanitizeDisplayName(m.senderName)
                );
                const best = sanitizeDisplayName(
                  getCachedName(c.chatId) || firstClient?.senderName || c.clientName
                );
                if (best && best !== c.clientName) {
                  c.clientName = best;
                  c.avatar = avatarFromName(best);
                  setCachedName(c.chatId, best);
                }
              }

              const last = msgs[msgs.length - 1];
              if (last) {
                c.lastMessageTime = last.timestamp;
                c.lastMessagePreview =
                  last.type === "IMAGE" ? "📷 Imagen" : last.content ?? "";
              }
            } catch {
              by[c.chatId] = [];
            }
          })
        );
      } else {
        // 2) Fallback si tu back viejo
        const fb = await listAssignedChatsWithMessages(operatorId);
        base = fb.chats.map((x: any) => {
          const opId = String(x?.id ?? x?._id);
          const clientId = String(x?.clientId?._id ?? x?.clientId ?? x?.userId ?? "");
          const candidate = sanitizeDisplayName(
            x?.clientName || x?.name || x?.displayName || x?.client?.name || x?.user?.name
          );
          const cached = sanitizeDisplayName(getCachedName(opId));
          const clientName = candidate || cached || "Cliente";
          const lastTs = x?.lastMessageAt ?? x?.updatedAt ?? Date.now();
          const lastPrev =
            x?.lastMessage?.type === "IMAGE"
              ? "📷 Imagen"
              : x?.lastMessage?.text ?? x?.lastMessage?.body ?? "";

          return {
            chatId: opId,
            clientId: clientId || "",
            clientName,
            phone: x?.phone,
            status: (x?.status ?? "ACTIVE").toUpperCase() as ChatStatus,
            isOnline: true,
            lastMessageTime: new Date(tsNum(lastTs)),
            lastMessagePreview: lastPrev,
            avatar: avatarFromName(clientName),
            specialistId: x?.specialistId ? String(x.specialistId) : undefined,
          } as ChatItem;
        });

        by = {};
        for (const [k, arrAny] of Object.entries(fb.byChat)) {
          const opId = String(k);
          const arr = Array.isArray(arrAny) ? arrAny : [];
          const msgs = arr
            .map((m: any) => mapRawToMessage(m, opId))
            .sort(
              (a: ChatMessage, b: ChatMessage) =>
                a.timestamp.getTime() - b.timestamp.getTime()
            );
          by[opId] = msgs;

          // sólo cacheo si no hay nombre “bueno” ya
          const hasGood = !!sanitizeDisplayName(base.find((b) => b.chatId === opId)?.clientName);
          if (!hasGood) {
            const firstClient = msgs.find(
              (m) => m.sender === "CLIENT" && sanitizeDisplayName(m.senderName)
            );
            const best = sanitizeDisplayName(getCachedName(opId) || firstClient?.senderName);
            if (best) setCachedName(opId, best);
          }
        }

        // Igual que arriba: si viene specialistId, filtramos
        if (operatorId && base.some((c) => typeof c.specialistId === "string")) {
          base = base.filter((c) => c.specialistId === operatorId);
        }
      }

      const dedup = new Map<string, ChatItem>();
      for (const c of base) dedup.set(c.chatId, c);

      const finalList = Array.from(dedup.values()).sort(
        (a, b) => b.lastMessageTime.getTime() - a.lastMessageTime.getTime()
      );

      if (!mounted) return;

      setChats(finalList);
      setByChat(by);

      // Asegurar que haya seleccionado uno visible
      if (!selectedChatId || !finalList.some((c) => c.chatId === selectedChatId)) {
        if (finalList[0]) setSelectedChatId(finalList[0].chatId);
      }

      if (socket && isConnected) {
        finalList.forEach((c) => {
          if (!joinedRoomsRef.current.has(c.chatId)) {
            socket.emit("joinChat", {
              chatId: c.chatId,
              as: "OPERADOR",
              operatorId,
              userId: operatorId,
            });
            joinedRoomsRef.current.add(c.chatId);
          }
          requestHistoryIfNeeded(c.chatId);
        });
      }
    }

    setLoading(true);
    hydrateAssigned().finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operatorId, isConnected]);

  /* JOIN del chat seleccionado */
  useEffect(() => {
    if (!socket || !isConnected || !selectedChatId || !operatorId) return;
    const primary = twins.current.toPrimary(selectedChatId) || selectedChatId;
    if (!joinedRoomsRef.current.has(primary)) {
      socket.emit("joinChat", { chatId: primary, as: "OPERADOR", operatorId, userId: operatorId });
      joinedRoomsRef.current.add(primary);
    }
    requestHistoryIfNeeded(primary);
  }, [socket, isConnected, selectedChatId, operatorId, requestHistoryIfNeeded]);

  /* Helpers de UI / nombres */
  const bestClientNameFromMsg = (msg: any) => {
    const senderType = normSender(msg?.senderType ?? msg?.sender);
    const isClient = senderType === "CLIENT";
    return sanitizeDisplayName(isClient ? msg?.senderName || msg?.clientName : msg?.clientName);
  };

  const ensureChatItem = (
    primaryId: string,
    seed?: { fromMsg?: any; fromAuto?: any; fromHistoryName?: string }
  ) => {
    setChats((prev) => {
      const cached = getCachedName(primaryId);
      // No usar caché como semilla si vienen datos desde back/eventos
      const nmSeed =
        sanitizeDisplayName(seed?.fromHistoryName) ||
        sanitizeDisplayName(seed?.fromAuto?.clientName) ||
        (seed?.fromMsg && bestClientNameFromMsg(seed.fromMsg)) ||
        undefined;

      if (prev.some((c) => c.chatId === primaryId)) {
        if (nmSeed) {
          setCachedName(primaryId, nmSeed);
          return prev.map((c) =>
            c.chatId === primaryId ? { ...c, clientName: nmSeed, avatar: avatarFromName(nmSeed) } : c
          );
        }
        return prev;
      }

      const nm = nmSeed || cached || "Cliente";
      const cid = String(seed?.fromMsg?.clientId ?? seed?.fromAuto?.clientId ?? "");
      const ts = new Date(seed?.fromMsg?.timestamp ?? seed?.fromAuto?.timestamp ?? Date.now());
      const lastPrev =
        seed?.fromMsg?.type === "IMAGE"
          ? "📷 Imagen"
          : seed?.fromMsg?.content ?? seed?.fromAuto?.message ?? "";

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

  /* =========================================================
   * Listeners de WebSocket
   * ========================================================= */
  useEffect(() => {
    if (!socket) return;

    const upsertMessages = (primaryId: string, incoming: ChatMessage[]) => {
      setByChat((prev) => {
        const curr = prev[primaryId] ?? [];
        let next = [...curr];

        for (const m of incoming) {
          // Si ya tengo un nombre bueno, no lo piso con senderName
          if (m.sender === "CLIENT" && sanitizeDisplayName(m.senderName)) {
            setChats((prevChats) =>
              prevChats.map((c) => {
                if (c.chatId !== primaryId) return c;
                const hasGoodName = !!sanitizeDisplayName(c.clientName);
                if (hasGoodName) return c;
                const nm = sanitizeDisplayName(m.senderName)!;
                setCachedName(primaryId, nm);
                return { ...c, clientName: nm, avatar: avatarFromName(nm) };
              })
            );
          }

          if (m.clientMessageId) {
            const idxOpt = next.findIndex(
              (x) => x.id === m.clientMessageId && x.sender === m.sender
            );
            if (idxOpt !== -1) {
              next[idxOpt] = m;
              continue;
            }
          }

          if (next.some((x) => x.id === m.id)) continue;

          const idxInv = next.findIndex(
            (x) => x.clientMessageId && x.clientMessageId === m.id && x.sender === m.sender
          );
          if (idxInv !== -1) {
            next[idxInv] = m;
            continue;
          }

          next.push(m);
        }

        next.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        return { ...prev, [primaryId]: next };
      });

      const last = incoming[incoming.length - 1];
      if (last) {
        setChats((prev) =>
          prev
            .map((c) =>
              c.chatId === primaryId
                ? {
                    ...c,
                    lastMessageTime: last.timestamp,
                    lastMessagePreview: last.type === "IMAGE" ? "📷 Imagen" : last.content ?? "",
                  }
                : c
            )
            .sort((a, b) => b.lastMessageTime.getTime() - a.lastMessageTime.getTime())
        );
      }
    };

    // Historial (compat) — sólo completa nombre si NO hay uno válido aún
    const onCompatHistory = (p: any) => {
      const opId = nChatId(p) || String(p?.chatId ?? p?.id ?? "");
      const arr = Array.isArray(p?.messages) ? p.messages : [];
      if (!opId) return;

      const mapped: ChatMessage[] = (arr as any[])
        .map((m: any) => mapRawToMessage(m, opId))
        .sort((a: ChatMessage, b: ChatMessage) => a.timestamp.getTime() - b.timestamp.getTime());

      const preferredName = sanitizeDisplayName(p?.clientName);
      setChats((prev) =>
        prev.map((c) => {
          if (c.chatId !== opId) return c;
          const hasGood = !!sanitizeDisplayName(c.clientName);
          if (hasGood) return c;

          const firstClient = arr.find(
            (m: any) =>
              normSender(m?.senderType ?? m?.sender) === "CLIENT" &&
              (m?.senderName || m?.clientName)
          );
          const fallback =
            preferredName ||
            sanitizeDisplayName(firstClient?.senderName || firstClient?.clientName);
          if (fallback) {
            setCachedName(opId, fallback);
            return { ...c, clientName: fallback, avatar: avatarFromName(fallback) };
          }
          return c;
        })
      );

      ensureChatItem(opId, { fromMsg: arr[0], fromHistoryName: preferredName });
      if (mapped.length) upsertMessages(opId, mapped);
    };

    // Mensaje nuevo (compat)
    const onCompatMessage = (msg: any) => {
      const rawId = nChatId(msg);
      if (!rawId) return;
      const primaryId = twins.current.toPrimary(rawId) || rawId;
      const known = !!chatsRef.current.find((c) => c.chatId === primaryId);
      if (!known) return;

      const nm = bestClientNameFromMsg(msg);
      if (nm) {
        // cachea solo si aún no hay nombre bueno; el set se hace en upsertMessages
        setCachedName(primaryId, nm);
      }

      const mapped = mapRawToMessage(msg, primaryId);
      upsertMessages(primaryId, [mapped]);

      const isIncoming = mapped.sender !== "OPERADOR";
      const isOtherChat = selectedChatId !== primaryId;
      const isHidden = typeof document !== "undefined" ? document.hidden : false;
      if (isIncoming && (isOtherChat || isHidden)) {
        const title = sanitizeDisplayName(mapped.senderName) || "Nuevo mensaje";
        const preview = mapped.type === "IMAGE" ? "📷 Imagen" : mapped.content || "";
        showIncomingNotification(title!, preview);
      }
    };

    // Chat finalizado
    const onChatFinished = (d: any) => {
      const id = nChatId(d);
      const primaryId = twins.current.toPrimary(id) || id;
      if (!primaryId) return;
      setChats((prev) => prev.map((c) => (c.chatId === primaryId ? { ...c, status: "FINISHED" } : c)));
      const sysMsg: ChatMessage = {
        id: uuid(),
        chatId: primaryId,
        sender: "SYSTEM",
        content: "✅ El operador ha finalizado este chat.",
        type: "TEXT",
        timestamp: new Date(),
        senderName: "Sistema",
      };
      upsertMessages(primaryId, [sysMsg]);
    };

    // Asignaciones
    const onOperatorAssigned = (d: any) => {
      if (String(d?.operatorId) !== operatorId) return;
      const id = nChatId(d) || String(d?.chatId ?? "");
      if (!id) return;

      const nm = sanitizeDisplayName(d?.clientName);
      if (nm) {
        setChats((prev) =>
          prev.map((c) => (c.chatId === id ? { ...c, clientName: nm, avatar: avatarFromName(nm) } : c))
        );
        setCachedName(id, nm);
      }

      ensureChatItem(id, { fromAuto: d, fromHistoryName: nm });

      if (!joinedRoomsRef.current.has(id)) {
        socket.emit("joinChat", { chatId: id, as: "OPERADOR", operatorId, userId: operatorId });
        joinedRoomsRef.current.add(id);
      }
      requestHistoryIfNeeded(id);
    };

    // Auto-asignación con historial
    const onChatAutoAssigned = (d: any) => {
      if (String(d?.operatorId) !== operatorId) return;
      const id = nChatId(d) || String(d?.chatId ?? "");
      if (!id) return;

      if (!joinedRoomsRef.current.has(id)) {
        socket.emit("joinChat", { chatId: id, as: "OPERADOR", operatorId, userId: operatorId });
        joinedRoomsRef.current.add(id);
      }

      const arr = Array.isArray(d?.history) ? d.history : [];
      const firstClient = arr.find(
        (m: any) =>
          normSender(m?.senderType ?? m?.sender) === "CLIENT" &&
          (m?.senderName || m?.clientName)
      );
      const seedName =
        sanitizeDisplayName(d?.clientName) ||
        sanitizeDisplayName(firstClient?.senderName || firstClient?.clientName);

      if (seedName) {
        setChats((prev) =>
          prev.map((c) =>
            c.chatId === id ? { ...c, clientName: seedName, avatar: avatarFromName(seedName) } : c
          )
        );
        setCachedName(id, seedName);
      }

      ensureChatItem(id, { fromAuto: { ...d, clientName: seedName }, fromHistoryName: seedName });

      if (arr.length) {
        const mapped: ChatMessage[] = (arr as any[])
          .map((m: any) => mapRawToMessage(m, id))
          .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        upsertMessages(id, mapped);
      }
    };

    // Nombre cliente (explícito desde back)
    const onClientNameUpdated = (d: any) => {
      const id = nChatId(d) || String(d?.chatId ?? "");
      const nm = sanitizeDisplayName(d?.clientName);
      if (!id || !nm) return;
      setCachedName(id, nm);
      setChats((prev) =>
        prev.map((c) => (c.chatId === id ? { ...c, clientName: nm, avatar: avatarFromName(nm) } : c))
      );
    };

    // NUEVO: modo cambiado
    const onModeChanged = (p: any) => {
      const id = nChatId(p) || String(p?.chatId ?? "");
      const mode = (String(p?.mode || "").toUpperCase() || "BOT") as OrchestratorMode;
      if (!id) return;
      setModeByChat((prev) => ({ ...prev, [id]: mode }));
      setBotThinking((prev) => ({ ...prev, [id]: false }));
    };

    // NUEVO: bot "pensando"
    const onBotThinking = (p: any) => {
      const id = nChatId(p) || String(p?.chatId ?? "");
      if (!id) return;
      setBotThinking((prev) => ({ ...prev, [id]: true }));
    };

    // NUEVO: en cola
    const onChatInQueue = (p: any) => {
      const id = nChatId(p) || String(p?.chatId ?? "");
      if (!id) return;
      toast({ title: "Chat en cola", description: "Esperando operador disponible…" });
    };

    const onError = (e: any) => console.warn("[WS] error", e);

    const MESSAGE_EVENTS = ["newMessage", "message:new"] as const;
    MESSAGE_EVENTS.forEach((evt) => socket.on(evt, onCompatMessage));
    socket.on("chatHistory", onCompatHistory);
    socket.on("chatMessages", onCompatHistory);
    socket.on("chatFinished", onChatFinished);
    socket.on("chat:finished", onChatFinished);
    socket.on("operatorAssigned", onOperatorAssigned);
    socket.on("specialistAssigned", onOperatorAssigned);
    socket.on("chatAutoAssigned", onChatAutoAssigned);
    socket.on("clientNameUpdated", onClientNameUpdated);

    // orquestador
    socket.on("mode:changed", onModeChanged);
    socket.on("botThinking", onBotThinking);
    socket.on("chatInQueue", onChatInQueue);
    socket.on("error", onError);

    const onConnect = () => console.log("[WS] conectado", socket.id);
    const onDisconnect = (r: any) => console.log("[WS] desconectado", r);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onError);

    return () => {
      MESSAGE_EVENTS.forEach((evt) => socket.off(evt, onCompatMessage));
      socket.off("chatHistory", onCompatHistory);
      socket.off("chatMessages", onCompatHistory);
      socket.off("chatFinished", onChatFinished);
      socket.off("chat:finished", onChatFinished);
      socket.off("operatorAssigned", onOperatorAssigned);
      socket.off("specialistAssigned", onOperatorAssigned);
      socket.off("chatAutoAssigned", onChatAutoAssigned);
      socket.off("clientNameUpdated", onClientNameUpdated);
      socket.off("mode:changed", onModeChanged);
      socket.off("botThinking", onBotThinking);
      socket.off("chatInQueue", onChatInQueue);
      socket.off("error", onError);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onError);
    };
  }, [socket, operatorId, isConnected, selectedChatId, showIncomingNotification, toast]);

  /* =========================================================
   * Envío
   * ========================================================= */
  const pushMessage = useCallback((primaryId: string, msg: ChatMessage) => {
    setByChat((prev) => {
      const curr: ChatMessage[] = prev[primaryId] ?? [];
      if (curr.some((x) => x.id === msg.id)) return prev;
      const next = [...curr, msg].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      return { ...prev, [primaryId]: next };
    });

    setChats((prev) =>
      prev
        .map((c) =>
          c.chatId === primaryId
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

  const handleSend = useCallback(
    async () => {
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
        // Si no estamos en modo HUMANO, tomamos control antes de enviar
        const mode = (modeByChat[primaryId] || "BOT") as OrchestratorMode;
        if (socket && mode !== "HUMAN") {
          await emitWithAck(socket, "mode:takeover", { chatId: primaryId }, 3000).catch(() => {});
        }

        const item = chats.find((c) => c.chatId === primaryId || c.chatId === rawSelected);
        const cl = item?.clientId;
        const phone = item?.phone;

        if (operatorId && cl && cl !== primaryId && cl !== rawSelected) {
          await ensureAssignmentForChat(primaryId, authToken, cl, operatorId).catch(() => {});
        }

        // 1) UI inmediata
        pushMessage(primaryId, outgoing);

        // 2) WS → persistencia/relay
        if (!socket) throw new Error("Socket no disponible");
        await emitWithAck(
          socket,
          "sendMessage",
          {
            chatId: primaryId,
            userId: operatorId,
            senderType: "OPERADOR",
            clientName: "Operador",
            type: "TEXT",
            content: text,
            timestamp: Date.now(),
            clientMessageId: tmpId,
          },
          3000
        );

        // 3) WhatsApp vía n8n
        if (phone) n8nSendTextOrImage({ to: String(phone), text }).catch(() => {});
      } catch (e) {
        console.error("[OPERADOR] error al enviar:", e);
        toast({
          title: "No se pudo enviar",
          description: "Revisa tu conexión.",
          variant: "destructive",
        });
      } finally {
        setMessage("");
        setLocalSending(false);
      }
    },
    [selectedChatId, message, operatorId, socket, pushMessage, authToken, chats, toast, modeByChat]
  );

  const handlePickImage = useCallback(() => fileRef.current?.click(), []);

  const handleImageSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
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
        content: (message || "").trim() || undefined, // caption local
      };

      try {
        const item = chats.find((c) => c.chatId === primaryId || c.chatId === rawSelected);
        const cl = item?.clientId;
        const phone = item?.phone;

        if (operatorId && cl && cl !== primaryId && cl !== rawSelected) {
          await ensureAssignmentForChat(primaryId, authToken, cl, operatorId).catch(() => {});
        }

        // Tomar control si no es HUMANO
        const mode = (modeByChat[primaryId] || "BOT") as OrchestratorMode;
        if (socket && mode !== "HUMAN") {
          await emitWithAck(socket, "mode:takeover", { chatId: primaryId }, 3000).catch(() => {});
        }

        // 1) UI
        pushMessage(primaryId, imgMsg);

        // 2) Persistencia HTTP opcional
        await postChatMessage(
          primaryId,
          {
            sender: "OPERADOR",
            type: "IMAGE",
            imageUrl: localUrl,
            content: (message || "").trim() || undefined,
            timestamp: Date.now(),
            clientMessageId: tmpId,
          },
          authToken
        ).catch(() => {});

        // 3) WhatsApp
        if (phone) {
          await n8nSendTextOrImage({
            to: String(phone),
            text: (message || "").trim() || undefined,
            file,
          });
        }
      } catch (err) {
        console.error("[useChatOperator] Error enviando imagen:", err);
        toast({
          title: "No se pudo enviar la imagen",
          description: "Reintenta más tarde.",
          variant: "destructive",
        });
      } finally {
        setLocalSending(false);
        e.target.value = "";
        setMessage("");
      }
    },
    [selectedChatId, pushMessage, message, authToken, operatorId, chats, toast, socket, modeByChat]
  );

  const finishChat = useCallback(
    (chatId: string) => {
      const primary = twins.current.toPrimary(chatId) || chatId;
      const sysMsg: ChatMessage = {
        id: uuid(),
        chatId: primary,
        sender: "SYSTEM",
        content: "Conversación finalizada por el operador.",
        type: "TEXT",
        timestamp: new Date(),
        senderName: "Sistema",
      };
      pushMessage(primary, sysMsg);
      setChats((prev) => prev.map((c) => (c.chatId === primary ? { ...c, status: "FINISHED" } : c)));
    },
    [pushMessage]
  );

  const setClientName = useCallback(
    async (chatId: string, name: string) => {
      if (!socket || !chatId || !name.trim()) return;
      try {
        const res = (await emitWithAck(
          socket,
          "setClientName",
          { chatId, clientName: name.trim() },
          3000
        )) as any;
        const finalName = sanitizeDisplayName(res?.name) || sanitizeDisplayName(name);
        if (finalName) {
          setCachedName(chatId, finalName);
          setChats((prev) =>
            prev.map((c) =>
              c.chatId === chatId
                ? { ...c, clientName: finalName, avatar: avatarFromName(finalName) }
                : c
            )
          );
        }
      } catch (e) {
        console.warn("[setClientName] error", e);
        toast({
          title: "No se pudo actualizar el nombre",
          description: "Intenta nuevamente.",
          variant: "destructive",
        });
      }
    },
    [socket, toast]
  );

  // NUEVO: controles de modo
  const takeOver = useCallback(
    async (chatId: string) => {
      if (!socket || !chatId) return;
      try {
        await emitWithAck(socket, "mode:takeover", { chatId }, 3000);
      } catch (e) {
        toast({
          title: "No se pudo tomar control",
          description: "Intenta nuevamente.",
          variant: "destructive",
        });
      }
    },
    [socket, toast]
  );

  const release = useCallback(
    async (chatId: string) => {
      if (!socket || !chatId) return;
      try {
        await emitWithAck(socket, "mode:release", { chatId }, 3000);
      } catch (e) {
        toast({
          title: "No se pudo liberar control",
          description: "Intenta nuevamente.",
          variant: "destructive",
        });
      }
    },
    [socket, toast]
  );

  // Enviar plantilla con video (n8n)
  const sendTemplateVideo = useCallback(
    async (opts: { tratamiento: "depilacion" | "blanqueamiento" | "otro"; nombre_cliente: string; file: File }) => {
      const rawSelected = selectedChatId;
      if (!rawSelected) return;
      const primaryId = twins.current.toPrimary(rawSelected) || rawSelected;

      const phone = chats.find((c) => c.chatId === primaryId || c.chatId === rawSelected)?.phone;
      if (!phone) {
        toast({
          title: "No hay teléfono",
          description: "El chat no tiene número asociado.",
          variant: "destructive",
        });
        return;
      }

      try {
        await n8nSendTemplateVideo({ to: String(phone), ...opts });
        toast({ title: "Plantilla enviada", description: `${opts.tratamiento} para ${opts.nombre_cliente}` });
      } catch (e) {
        console.error("[sendTemplateVideo] error", e);
        toast({
          title: "No se pudo enviar plantilla",
          description: "Revisa el archivo y vuelve a intentar.",
          variant: "destructive",
        });
      }
    },
    [selectedChatId, chats, toast]
  );

  /* Selectores & Memos */
  const current = useMemo(
    () => chats.find((c) => c.chatId === selectedChatId),
    [chats, selectedChatId]
  );

  const messagesMemo = useMemo<ChatMessage[]>(
    () => (selectedChatId ? byChat[twins.current.toPrimary(selectedChatId)!] ?? [] : []),
    [byChat, selectedChatId]
  );

  const chatPreviews = useMemo<ChatPreview[]>(() => {
    return chats.map((c) => {
      const list = byChat[c.chatId] ?? [];
      const last = list[list.length - 1];
      const lastText =
        last?.type === "IMAGE" ? "📷 Imagen" : last?.content ?? c.lastMessagePreview ?? "";
      return {
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
        // opcional: exponer modo actual en preview
        mode: (modeByChat as any)[c.chatId],
        botThinking: !!botThinking[c.chatId],
      } as any;
    });
  }, [byChat, chats, modeByChat, botThinking]);

  /* API pública */
  return {
    state: {
      loading,
      chats,
      chatPreviews,
      selectedChatId,
      messages: messagesMemo,
      message,
      localSending,
      fileRef,
      current,
      isConnected,
      modeByChat,
      botThinking,
    },
    actions: {
      setSelectedChatId,
      setMessage,
      handleSend,
      handlePickImage,
      handleImageSelected,
      finishChat,
      setClientName,
      sendTemplateVideo,
      takeOver,
      release,
    },
  };
}

/* =========================================================
 * HTTP helper opcional para persistir IMAGEN en back
 * ========================================================= */
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
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/chats/${chatId}/messages`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status} - ${res.statusText}`);
  return res.json();
}
