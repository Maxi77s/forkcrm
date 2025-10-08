"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChatPreview } from "@/types/chats";
import { useSocket } from "@/hooks/use-socket";

// Helpers REST propios
import {
  assignWithAutoHeal,
  ensureOperatorContext,
  getActiveChats,
  getChatMessages,
  ensureBackendChatForPhone,
  postChatMessage,
  ensureAssignmentForChat,   // 👈 asegura asignación del chat
  setOperatorState,          // 👈 pone AVAILABLE al operador
} from "@/components/helpers/helper.assign";

import {
  listAllMessages,           // sólo si activás polling N8N
  sendTextMessage,           // fallback legacy
  type Mensaje as N8nMsg,
} from "@/components/helpers/helper.message";

/* ================= Config ================= */
const pollMs = Number(process.env.NEXT_PUBLIC_N8N_POLL_MS || 4000);
const MAX_ACTIVE = 6;
const ENABLE_AUTO_ASSIGN = String(process.env.NEXT_PUBLIC_AUTO_ASSIGN ?? "0") === "1";
const AUTO_ASSIGN_ON_INBOUND = true; // 👈 asigna cuando llega mensaje de CLIENT

// N8N (envs provistas)
const ENABLE_N8N = String(process.env.NEXT_PUBLIC_N8N_ENABLE ?? "0") === "1";
const N8N_BASE = (process.env.NEXT_PUBLIC_N8N_BASE_URL || "").replace(/\/+$/, "");
const N8N_MEDIA_EP = process.env.NEXT_PUBLIC_N8N_SEND_MEDIA_ENDPOINT || "/webhook/send_message2";
const N8N_TPL_EP = process.env.NEXT_PUBLIC_N8N_SEND_TEMPLATE_ENDPOINT || "/webhook/templates";
const DEFAULT_PREFIX = process.env.NEXT_PUBLIC_PHONE_DEFAULT_PREFIX || "+";

// ✅ Sólo consideramos N8N listo si está habilitado y hay base URL.
const N8N_READY = ENABLE_N8N && !!N8N_BASE;

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
}

interface UseChatOperatorOptions {
  token?: string;
  mock?: boolean;
}

/* ================= Utils ================= */
function uuid() {
  if (typeof crypto !== "undefined" && (crypto as any).randomUUID)
    return (crypto as any).randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const ensurePlus = (p: string) => (p.startsWith("+") ? p : `+${p}`);
const normalizePhone = (p?: string) =>
  p ? String(p).replace(/\s+/g, "").replace(/^00/, "+") : undefined;
const toMsisdn = (raw?: string) => {
  if (!raw) return undefined;
  const s = raw.replace(/\s+/g, "");
  if (s.startsWith("+") || s.startsWith("00")) return s.replace(/^00/, "+");
  return `${DEFAULT_PREFIX}${s}`;
};

function pickClientName(raw: any): string {
  const candidates = [
    raw?.clientName,
    raw?.name,
    raw?.displayName,
    raw?.customerName,
    raw?.client_name,
    raw?.customer_name,
    raw?.client?.name,
    raw?.user?.name,
    raw?.customer?.name,
    raw?.metadata?.clientName,
    raw?.meta?.clientName,
    raw?.profile?.name,
  ].filter(Boolean);

  const name = String(candidates[0] || "").trim();
  if (name) return name;

  const phone = raw?.phone ?? raw?.client?.phone ?? raw?.user?.phone;
  if (phone) return String(phone).replace(/[^\d+]/g, "");

  const idShort = String(raw?.clientId ?? raw?.chatId ?? raw?.id ?? raw?._id ?? "").slice(0, 8) || "—";
  return `Cliente ${idShort}...`;
}

/* ===== Persistencia: pendientes ===== */
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
    return revivePending(JSON.parse(raw));
  } catch {
    return {};
  }
}
function savePendingToStorage(data: Record<string, ChatMessage[]>) {
  try {
    const plain: any = {};
    for (const k of Object.keys(data)) {
      plain[k] = (data[k] || []).map((m) => ({
        ...m,
        timestamp: m.timestamp.toISOString(),
      }));
    }
    localStorage.setItem(PENDING_KEY, JSON.stringify(plain));
  } catch {}
}

/* ===== Persistencia: cache ===== */
const CACHE_KEY = "chat_operator_cache_v1";
type CacheShape = {
  chats: ChatItem[];
  byChat: Record<string, ChatMessage[]>;
  selectedChatId?: string;
};
function saveCache(data: CacheShape) {
  try {
    const serializable: any = {
      ...data,
      chats: data.chats.map((c) => ({
        ...c,
        lastMessageTime:
          c.lastMessageTime instanceof Date
            ? c.lastMessageTime.toISOString()
            : new Date(c.lastMessageTime as any).toISOString(),
      })),
      byChat: Object.fromEntries(
        Object.entries(data.byChat).map(([k, arr]) => [
          k,
          arr.map((m) => ({
            ...m,
            timestamp:
              m.timestamp instanceof Date
                ? m.timestamp.toISOString()
                : new Date(m.timestamp as any).toISOString(),
          })),
        ])
      ),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(serializable));
  } catch {}
}
function loadCache(): CacheShape | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as any;
    const revived: CacheShape = {
      chats: (parsed.chats || []).map((c: any) => ({
        ...c,
        lastMessageTime: new Date(c.lastMessageTime),
      })),
      byChat: Object.fromEntries(
        Object.entries(parsed.byChat || {}).map(([k, arr]) => [
          k,
          (arr as any[]).map((m) => ({ ...m, timestamp: new Date(m.timestamp) })),
        ])
      ),
      selectedChatId: parsed.selectedChatId,
    };
    return revived;
  } catch {
    return null;
  }
}

/* ===== Merge utils ===== */
function mergeChats(base: ChatItem[], incoming: ChatItem[]): ChatItem[] {
  const map = new Map(base.map((c) => [c.chatId, c]));
  for (const c of incoming) {
    const prev = map.get(c.chatId);
    if (!prev) {
      map.set(c.chatId, c);
    } else {
      map.set(c.chatId, {
        ...prev,
        ...c,
        lastMessageTime:
          c.lastMessageTime > prev.lastMessageTime ? c.lastMessageTime : prev.lastMessageTime,
        lastMessagePreview: c.lastMessagePreview ?? prev.lastMessagePreview,
        status: c.status || prev.status,
        isOnline: c.isOnline ?? prev.isOnline,
        phone: c.phone ?? prev.phone,
        clientName: c.clientName ?? prev.clientName,
        avatar: prev.avatar || c.avatar,
      });
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => b.lastMessageTime.getTime() - a.lastMessageTime.getTime()
  );
}
function mergeByChat(
  base: Record<string, ChatMessage[]>,
  incoming: Record<string, ChatMessage[]>
): Record<string, ChatMessage[]> {
  const out: Record<string, ChatMessage[]> = { ...base };
  for (const [chatId, list] of Object.entries(incoming)) {
    const prev = out[chatId] ?? [];
    const seen = new Set(prev.map((m) => `${m.id}|${m.timestamp.getTime()}`));
    const merged = [...prev];
    for (const m of list) {
      const key = `${m.id}|${m.timestamp.getTime()}`;
      if (!seen.has(key)) {
        merged.push(m);
        seen.add(key);
      }
    }
    merged.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    out[chatId] = merged;
  }
  return out;
}

/* =============== FRONT-ONLY: traer asignados y enriquecer =============== */
function createLimiter(max = 4) {
  let running = 0;
  const q: Array<() => void> = [];
  const run = () => {
    if (running >= max || q.length === 0) return;
    running++;
    const job = q.shift()!;
    job();
  };
  return <T>(fn: () => Promise<T>) =>
    new Promise<T>((res, rej) => {
      const task = () =>
        fn().then(res).catch(rej).finally(() => {
          running--;
          run();
        });
      q.push(task);
      run();
    });
}

async function hydrateAssignedChatsFrontOnly(
  operatorId: string,
  authToken?: string
): Promise<{ chats: ChatItem[]; byChat: Record<string, ChatMessage[]> }> {
  const active = await getActiveChats(operatorId, authToken);
  if (!active?.ok) return { chats: [], byChat: {} };

  const base: ChatItem[] = (active.items || []).map((x: any) => {
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
      avatar: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(clientName)}`,
    };
  });

  const byChat: Record<string, ChatMessage[]> = {};
  const limit = createLimiter(4);

  await Promise.all(
    base.map((c) =>
      limit(async () => {
        try {
          const hist = await getChatMessages(c.chatId, authToken);
          const msgs: ChatMessage[] = (hist || [])
            .map((m: any) => ({
              id: String(m?.id ?? m?._id ?? `${c.chatId}-${m?.timestamp ?? Date.now()}`),
              chatId: c.chatId,
              sender: (String(m?.sender ?? m?.senderType ?? m?.from ?? "CLIENT").toUpperCase() as ChatMessage["sender"]),
              content: m?.content ?? m?.text ?? m?.body,
              type: (String(m?.type ?? "TEXT").toUpperCase() as ChatMessage["type"]),
              imageUrl: m?.imageUrl,
              timestamp: new Date(m?.timestamp ?? m?.createdAt ?? Date.now()),
              senderName: m?.senderName ?? undefined,
            }))
            .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
          byChat[c.chatId] = msgs;

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

/* ================= buildStateFromN8n (opcional) ================= */
const mapN8nToChatMessage = (m: N8nMsg, chatId: string): ChatMessage => {
  const src: any = (m as any).raw ?? m;
  const rawDir = (m as any).direction?.toUpperCase?.();
  const fromStr = src?.from != null ? String(src.from) : (m as any).from ? String((m as any).from) : undefined;
  const bizStr = src?.phone_number != null ? String(src.phone_number) : undefined;
  const toStr = src?.to != null ? String(src.to) : (m as any).to ? String((m as any).to) : undefined;

  let direction = rawDir;
  if (!direction || direction === "") {
    if (fromStr && bizStr && fromStr !== bizStr) direction = "IN";
    else if (toStr) direction = "OUT";
  }

  const sender: ChatMessage["sender"] =
    direction === "IN" ? "CLIENT" : direction === "OUT" ? "OPERADOR" : "SYSTEM";

  const content = (m as any).text ?? src?.text ?? src?.body ?? src?.message ?? "";
  const ts = (m as any).timestamp ?? src?.timestamp ?? src?.date ?? src?.createdAt ?? Date.now();
  const name =
    src?.profile_name ??
    (sender === "CLIENT" ? "Cliente" : sender === "OPERADOR" ? "Operador" : "Sistema");

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

function buildStateFromN8n(
  items: N8nMsg[],
  authToken?: string
): { nextChats: ChatItem[]; nextByChat: Record<string, ChatMessage[]> } {
  const groups = new Map<string, { phone: string; msgs: ChatMessage[]; name?: string }>();

  for (const raw of items) {
    const src: any = (raw as any).raw ?? raw;
    const rawDir = (raw as any).direction?.toUpperCase?.();
    const fromStr = src?.from != null ? String(src.from) : (raw as any).from ? String((raw as any).from) : undefined;
    const bizStr = src?.phone_number != null ? String(src.phone_number) : undefined;
    const toStr = src?.to != null ? String(src.to) : (raw as any).to ? String((raw as any).to) : undefined;

    let dir = rawDir;
    if (!dir || dir === "") {
      if (fromStr && bizStr && fromStr !== bizStr) dir = "IN";
      else if (toStr) dir = "OUT";
    }

    const peer = dir === "IN" ? normalizePhone(fromStr) : normalizePhone(toStr);
    if (!peer) continue;

    const provisionalChatId = peer.replace(/^\+/, "");
    const cm = mapN8nToChatMessage(raw, provisionalChatId);
    const displayName = src?.profile_name || (cm.sender === "CLIENT" ? "Cliente" : "Operador");

    const prev = groups.get(peer) ?? { phone: peer, msgs: [], name: displayName };
    prev.msgs.push(cm);
    groups.set(peer, prev);
  }

  const nextByChat: Record<string, ChatMessage[]> = {};
  const nextChats: ChatItem[] = [];

  let phoneToChat: Record<string, string> = {};
  try { phoneToChat = JSON.parse(localStorage.getItem("phone_to_chat_map_v1") || "{}"); } catch {}

  groups.forEach((data, phone) => {
    const provisionalChatId = phoneToChat[phone] || phone.replace(/^\+/, "");
    const sorted = [...data.msgs].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    nextByChat[provisionalChatId] = sorted.map(m => ({ ...m, chatId: provisionalChatId }));

    const last = sorted[sorted.length - 1];
    const clientDisplayName = sorted.find(m => m.sender === "CLIENT")?.senderName || data.name || "Cliente";

    nextChats.push({
      chatId: provisionalChatId,
      clientId: provisionalChatId,
      clientName: clientDisplayName,
      phone: phone,
      status: "ACTIVE",
      isOnline: true,
      lastMessageTime: last?.timestamp ?? new Date(),
      lastMessagePreview: last?.type === "IMAGE" ? "📷 Imagen" : last?.content ?? "",
      avatar: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(clientDisplayName)}`,
    });
  });

  // Bootstrap opcional: crear chat real + subir IN al backend + asegurar asignación
  (async () => {
    let created = 0;
    for (const [phone, data] of groups.entries()) {
      if (phoneToChat[phone]) continue;
      if (created >= 3) break;
      try {
        const realId = await ensureBackendChatForPhone(phone, data.name, authToken);
        try { await ensureAssignmentForChat(realId, authToken); } catch {}
        phoneToChat[phone] = realId;
        localStorage.setItem("phone_to_chat_map_v1", JSON.stringify(phoneToChat));
        const inMsgs = data.msgs.filter(m => m.sender === "CLIENT");
        for (const m of inMsgs) {
          await postChatMessage(realId, {
            sender: "CLIENT",
            type: m.type,
            content: m.content,
            imageUrl: m.imageUrl,
            timestamp: m.timestamp.getTime(),
          }, authToken);
        }
      } catch (e) {} finally { created++; }
    }
  })();

  nextChats.sort((a, b) => b.lastMessageTime.getTime() - a.lastMessageTime.getTime());
  return { nextChats, nextByChat };
}

/* ==================== WS helpers ==================== */
// Evento que escucha tu ChatGateway para enviar/broadcast
const WS_EVENT_SEND = "sendMessage";

// Emit con ACK y timeout
function emitWithAck(socket: any, event: string, payload: any, timeoutMs = 2000) {
  return new Promise<any>((resolve, reject) => {
    let done = false;
    const t = setTimeout(() => {
      if (done) return;
      done = true;
      reject(new Error(`ACK timeout ${event}`));
    }, timeoutMs);
    try {
      socket.emit(event, payload, (ack: any) => {
        if (done) return;
        done = true;
        clearTimeout(t);
        resolve(ack);
      });
    } catch (e) {
      if (done) return;
      done = true;
      clearTimeout(t);
      reject(e);
    }
  });
}

/* ================= Hook ================= */
export function useChatOperator({ token, mock }: UseChatOperatorOptions) {
  const fileRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | undefined>();
  const [message, setMessage] = useState("");
  const [localSending, setLocalSending] = useState(false);

  const [byChat, setByChat] = useState<Record<string, ChatMessage[]>>({});
  const [pendingByChat, setPendingByChat] = useState<Record<string, ChatMessage[]>>(
    typeof window !== "undefined" ? loadPendingFromStorage() : {}
  );

  // N8N kill-switch
  const n8nDisabledRef = useRef<boolean>(!N8N_READY);

  // ===== WebSocket como OPERADOR =====
  const { socket, isConnected } = useSocket({
    userRole: "OPERADOR",
    serverUrl: process.env.NEXT_PUBLIC_WS_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002",
  });

  // Notificaciones
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  const notifyClientMessage = useCallback((chatId: string, preview: string, clientName?: string) => {
    const title = clientName ? `Nuevo mensaje de ${clientName}` : "Nuevo mensaje de cliente";
    const body = preview?.slice(0, 120) || "Mensaje nuevo";
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      try { new Notification(title, { body }); } catch { alert(`${title}\n\n${body}`); }
    } else {
      alert(`${title}\n\n${body}`);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") savePendingToStorage(pendingByChat);
  }, [pendingByChat]);

  // Warm-up desde cache
  useEffect(() => {
    const cached = loadCache();
    if (cached) {
      setChats(cached.chats || []);
      setByChat(cached.byChat || {});
      if (cached.selectedChatId) setSelectedChatId(cached.selectedChatId);
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    saveCache({ chats, byChat, selectedChatId });
  }, [chats, byChat, selectedChatId]);

  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const current = useMemo(() => chats.find((c) => c.chatId === selectedChatId), [chats, selectedChatId]);
  const messages = useMemo<ChatMessage[]>(
    () => (selectedChatId ? byChat[selectedChatId] ?? [] : []),
    [byChat, selectedChatId]
  );

  // reconciliar pendientes
  const mergeWithPending = useCallback((fetched: Record<string, ChatMessage[]>) => {
    const RESOLVE_WINDOW_MS = 60_000;
    const next: Record<string, ChatMessage[]> = { ...fetched };
    for (const chatId of Object.keys(pendingByChat)) {
      const pending = pendingByChat[chatId] ?? [];
      const base = next[chatId] ? [...next[chatId]] : [];
      const resolved: ChatMessage[] = [];
      for (const p of pending) {
        const idx = base.findIndex(
          (b) =>
            b.sender === p.sender &&
            (b.content ?? "") === (p.content ?? "") &&
            Math.abs(b.timestamp.getTime() - p.timestamp.getTime()) <= RESOLVE_WINDOW_MS
        );
        if (idx >= 0) resolved.push(p);
        else base.push(p);
      }
      base.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      next[chatId] = base;
      if (resolved.length) {
        setPendingByChat((prev) => {
          const clone = { ...prev };
          clone[chatId] = (clone[chatId] ?? []).filter(
            (p) =>
              !resolved.some(
                (r) =>
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
  }, [pendingByChat]);

  // Auto-asignación (opcional)
  const autoAssigningRef = useRef(false);
  const { token: ensuredToken, operatorId: ensuredOperatorId } = ensureOperatorContext();
  const authToken = token || ensuredToken;
  const operatorId = useMemo(() => {
    const v = ensuredOperatorId;
    if (!v) return "";
    if (typeof v === "string") return v.trim();
    return String((v as any).id ?? (v as any)._id ?? v).trim();
  }, [ensuredOperatorId]);

  // 👇 NUEVO: poner OPERADOR en AVAILABLE al cargar (para quedar elegible)
  useEffect(() => {
    if (!operatorId) return;
    setOperatorState(operatorId, "AVAILABLE", authToken).catch(() => {});
  }, [operatorId, authToken]);

  // Carga inicial + Poll N8N
  useEffect(() => {
    let mounted = true;

    async function hydrateFromServer() {
      try {
        const cachedCount = chats.length;
        if ((cachedCount ?? 0) < MAX_ACTIVE) {
          await tryFillSlots(cachedCount ?? 0);
        }
      } catch (e) {
        console.warn("[useChatOperator] auto-assign warn:", e);
      }

      if (!operatorId) {
        if (mounted) {
          setChats([]);
          setByChat({});
          setSelectedChatId(undefined);
        }
        return;
      }

      const { chats: nextChats, byChat: nextByChat } =
        await hydrateAssignedChatsFrontOnly(operatorId, authToken);

      const mergedMsgs = mergeWithPending(nextByChat);

      if (!mounted) return;
      setChats(nextChats);
      setByChat(mergedMsgs);
      if (!selectedChatId && nextChats[0]) setSelectedChatId(nextChats[0].chatId);
    }

    const tryFillSlots = async (currentCount: number) => {
      if (!ENABLE_AUTO_ASSIGN) return;
      if (!operatorId) return;
      if (autoAssigningRef.current) return;
      autoAssigningRef.current = true;
      try {
        let count = currentCount;
        while (count < MAX_ACTIVE) {
          const res = await assignWithAutoHeal(operatorId, authToken);
          if (!res || (res as any).ok === false) break;
          count++;
          await new Promise((r) => setTimeout(r, 120));
        }
      } finally {
        autoAssigningRef.current = false;
      }
    };

    (async () => {
      try {
        setLoading(true);
        await hydrateFromServer();
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    if (N8N_READY) {
      pollRef.current = setInterval(async () => {
        if (n8nDisabledRef.current) return;
        try {
          const raw = await listAllMessages();
          if (!raw || raw.length === 0) return;
          const { nextChats: n8nChats, nextByChat: n8nByChat } = buildStateFromN8n(raw, authToken);
          setChats((prev) => mergeChats(prev, n8nChats));
          setByChat((prev) => {
            const merged = mergeByChat(prev, n8nByChat);
            return mergeWithPending(merged);
          });
        } catch (e: any) {
          const msg = String(e?.message || "");
          if (msg.includes("Missing N8N_BASE_URL") || msg.includes("HTTP 404")) {
            n8nDisabledRef.current = true;
            console.warn("[useChatOperator] N8N no disponible. Poll detenido.");
          } else {
            console.error("[useChatOperator] polling error:", e);
          }
        }
      }, pollMs);
    }

    return () => {
      mounted = false;
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mergeWithPending, operatorId]);

  /* ===== helper local: hidratar un chat específico ===== */
  const hydrateSingleChat = useCallback(async (chatId: string) => {
    try {
      const hist = await getChatMessages(chatId, authToken);
      const msgs: ChatMessage[] = (hist || [])
        .map((m: any) => ({
          id: String(m?.id ?? m?._id ?? `${chatId}-${m?.timestamp ?? Date.now()}`),
          chatId,
          sender: (String(m?.sender ?? m?.senderType ?? m?.from ?? "CLIENT").toUpperCase() as ChatMessage["sender"]),
          content: m?.content ?? m?.text ?? m?.body,
          type: (String(m?.type ?? "TEXT").toUpperCase() as ChatMessage["type"]),
          imageUrl: m?.imageUrl,
          timestamp: new Date(m?.timestamp ?? m?.createdAt ?? Date.now()),
          senderName: m?.senderName ?? undefined,
        }))
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      setByChat(prev => ({ ...prev, [chatId]: msgs }));

      const last = msgs[msgs.length - 1];
      setChats(prev => {
        const exists = prev.find(c => c.chatId === chatId);
        const clientName =
          msgs.find(m => m.sender === "CLIENT")?.senderName ||
          exists?.clientName || "Cliente";

        const base: ChatItem = exists ?? {
          chatId,
          clientId: chatId,
          clientName,
          phone: undefined,
          status: "ACTIVE",
          isOnline: true,
          lastMessageTime: new Date(),
          lastMessagePreview: "",
          avatar: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(clientName)}`,
        };

        const updated: ChatItem = {
          ...base,
          lastMessageTime: last?.timestamp ?? base.lastMessageTime,
          lastMessagePreview: last ? (last.type === "IMAGE" ? "📷 Imagen" : (last.content ?? "")) : base.lastMessagePreview,
        };

        const next = exists
          ? prev.map(c => c.chatId === chatId ? updated : c)
          : [updated, ...prev];

        return next.sort((a, b) => b.lastMessageTime.getTime() - a.lastMessageTime.getTime());
      });
    } catch {}
  }, [authToken]);

  /* ====== WebSocket listeners ====== */
  // unir al room del chat cuando el operador selecciona uno
  useEffect(() => {
    if (!socket || !isConnected || !selectedChatId) return;
    socket.emit("joinChat", { chatId: selectedChatId });
  }, [socket, isConnected, selectedChatId]);

  useEffect(() => {
    if (!socket) return;

    const upsertMessages = (chatId: string, incoming: ChatMessage[]) => {
      setByChat((prev) => {
        const curr = prev[chatId] ?? [];
        const seen = new Set(curr.map((m) => `${m.id}|${m.timestamp.getTime()}`));
        const merged = [...curr];
        for (const m of incoming) {
          const key = `${m.id}|${m.timestamp.getTime()}`;
          if (!seen.has(key)) {
            merged.push(m);
            seen.add(key);
          }
        }
        merged.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        return { ...prev, [chatId]: merged };
      });

      const last = incoming[incoming.length - 1];
      if (last) {
        setChats((prev) =>
          prev
            .map((c) =>
              c.chatId === chatId
                ? {
                    ...c,
                    lastMessageTime: last.timestamp,
                    lastMessagePreview: last.type === "IMAGE" ? "📷 Imagen" : (last.content ?? ""),
                  }
                : c
            )
            .sort((a, b) => b.lastMessageTime.getTime() - a.lastMessageTime.getTime())
        );
      }
    };

    const onChatAutoAssigned = (payload: any) => {
      const chatId = String(payload?.chatId);
      const clientId = String(payload?.clientId ?? "");
      const history = Array.isArray(payload?.history) ? payload.history : [];

      setChats((prev) => {
        const exists = prev.some((c) => c.chatId === chatId);
        if (exists) return prev;
        const clientName =
          history.find((h: any) => (h?.sender ?? h?.senderType) === "CLIENT")?.senderName ||
          "Cliente";
        const item: ChatItem = {
          chatId,
          clientId,
          clientName,
          phone: undefined,
          status: "ACTIVE",
          isOnline: true,
          lastMessageTime: new Date(payload?.timestamp ?? Date.now()),
          lastMessagePreview: "",
          avatar: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(clientName)}`,
        };
        return [item, ...prev];
      });

      const mapped: ChatMessage[] = history
        .map((msg: any) => ({
          id: String(msg?.id ?? msg?._id ?? `${chatId}-${msg?.timestamp ?? Date.now()}`),
          chatId,
          sender: (String(msg?.sender ?? msg?.senderType ?? "CLIENT").toUpperCase() as ChatMessage["sender"]),
          content: msg?.content ?? "",
          type: (String(msg?.type ?? "TEXT").toUpperCase() as ChatMessage["type"]),
          imageUrl: msg?.imageUrl,
          timestamp: new Date(msg?.timestamp ?? Date.now()),
          senderName: msg?.senderName,
        }))
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      if (mapped.length) upsertMessages(chatId, mapped);
      setSelectedChatId((prev) => prev ?? chatId);
    };

    const onNewMessage = (msg: any) => {
      const chatId = String(msg?.chatId);
      const senderType = String(msg?.senderType ?? msg?.sender ?? "SYSTEM").toUpperCase() as ChatMessage["sender"];
      const mapped: ChatMessage = {
        id: String(msg?.id ?? msg?._id ?? `${chatId}-${msg?.timestamp ?? Date.now()}`),
        chatId,
        sender: senderType,
        content: msg?.content ?? "",
        type: (String(msg?.type ?? "TEXT").toUpperCase() as ChatMessage["type"]),
        imageUrl: msg?.imageUrl,
        timestamp: new Date(msg?.timestamp ?? Date.now()),
        senderName: msg?.senderName,
      };

      // 👇 Si entra un mensaje de cliente y el chat no está en lista, asigno y lo hidrato
      if (senderType === "CLIENT" && AUTO_ASSIGN_ON_INBOUND) {
        const exists = chats.some(c => c.chatId === chatId);
        if (!exists) {
          ensureAssignmentForChat(chatId, authToken)
            .then(() => hydrateSingleChat(chatId))
            .catch(() => {});
        }
      }

      upsertMessages(chatId, [mapped]);

      // 🔔 Notificar si es CLIENTE
      if (senderType === "CLIENT") {
        const clientName =
          chats.find((c) => c.chatId === chatId)?.clientName ||
          msg?.clientName ||
          "Cliente";
        const preview = mapped.type === "IMAGE" ? "📷 Imagen" : (mapped.content ?? "");
        notifyClientMessage(chatId, preview, clientName);
      }
    };

    const onChatFinished = (d: any) => {
      const chatId = String(d?.chatId);
      setChats((prev) =>
        prev.map((c) => (c.chatId === chatId ? { ...c, status: "FINISHED" } : c))
      );
      const sysMsg: ChatMessage = {
        id: uuid(),
        chatId,
        sender: "SYSTEM",
        content: "✅ El operador ha finalizado este chat.",
        type: "TEXT",
        timestamp: new Date(),
        senderName: "Sistema",
      };
      upsertMessages(chatId, [sysMsg]);
    };

    socket.on("chatAutoAssigned", onChatAutoAssigned);
    socket.on("newMessage", onNewMessage);
    socket.on("chatFinished", onChatFinished);

    return () => {
      socket.off("chatAutoAssigned", onChatAutoAssigned);
      socket.off("newMessage", onNewMessage);
      socket.off("chatFinished", onChatFinished);
    };
  }, [socket, chats, notifyClientMessage, authToken, hydrateSingleChat]);

  /* ====== Envío ====== */
  const pushMessage = useCallback((chatId: string, msg: ChatMessage) => {
    setByChat((prev) => {
      const curr = prev[chatId] ?? [];
      const key = `${msg.id}|${msg.timestamp.getTime()}`;
      const seen = new Set(curr.map((m) => `${m.id}|${m.timestamp.getTime()}`));
      if (seen.has(key)) return prev;
      const next = { ...prev };
      next[chatId] = [...curr, msg].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
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
    };

    try {
      // 1) Optimista en UI
      pushMessage(selectedChatId, outgoing);
      setPendingByChat((prev) => {
        const next = { ...prev };
        next[selectedChatId] = [...(next[selectedChatId] ?? []), outgoing];
        return next;
      });

      // 2) WebSocket primero (persistencia + broadcast en el back)
      if (socket) {
        const wsPayload = {
          chatId: selectedChatId,
          userId: operatorId,
          senderType: "OPERADOR",
          clientName: "Operador",
          type: "TEXT",
          content: text,
          timestamp: Date.now(),
          clientMessageId: outgoing.id,
        };
        await emitWithAck(socket, WS_EVENT_SEND, wsPayload, 2000);
      } else {
        throw new Error("Socket no disponible");
      }
    } catch (e) {
      console.error("[useChatOperator] Error WS enviando:", e);
      // 3) Fallback REST por si falla el WS
      try {
        await postChatMessage(
          selectedChatId,
          { sender: "OPERADOR", type: "TEXT", content: text, timestamp: Date.now() },
          authToken
        );
      } catch (e2) {
        // si también falla REST, retiro el pendiente optimista
        setPendingByChat((prev) => {
          const next = { ...prev };
          next[selectedChatId] = (next[selectedChatId] ?? []).filter((m) => m.id !== outgoing.id);
          return next;
        });
      }
    } finally {
      setMessage("");
      setLocalSending(false);
    }
  }, [selectedChatId, message, operatorId, socket, pushMessage, authToken]);

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

      try {
        const target = toMsisdn(current?.phone || selectedChatId);
        if (!target) throw new Error("Destino inválido");

        pushMessage(selectedChatId, imgMsg);

        if (N8N_READY) {
          const cap = (message || "").trim() || undefined;
          await n8nSendMedia(target, cap, file);
        } else {
          console.warn("N8N deshabilitado: imagen sólo se mostró en UI.");
        }

        await postChatMessage(
          selectedChatId,
          {
            sender: "OPERADOR",
            type: "IMAGE",
            imageUrl: localUrl,
            content: (message || "").trim() || undefined,
            timestamp: Date.now(),
          },
          authToken
        );
      } catch (err) {
        console.error("[useChatOperator] Error enviando imagen:", err);
      } finally {
        setLocalSending(false);
        e.target.value = "";
      }
    },
    [selectedChatId, pushMessage, current?.phone, message, authToken]
  );

  const finishChat = useCallback(
    (chatId: string) => {
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
      setChats((prev) =>
        prev.map((c) => (c.chatId === chatId ? { ...c, status: "FINISHED" } : c))
      );
    },
    [pushMessage]
  );

  const sendTemplate = useCallback(
    async (tratamiento: string, nombreCliente: string, file?: File) => {
      if (!selectedChatId) return;
      const target = toMsisdn(current?.phone || selectedChatId);
      if (!target) throw new Error("Destino inválido");
      if (!N8N_READY) throw new Error("N8N disabled");
      await n8nSendTemplate(target, tratamiento, nombreCliente, file);
    },
    [current?.phone, selectedChatId]
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
      } as ChatPreview;
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
      isConnected,
    },
    actions: {
      setSelectedChatId,
      setMessage,
      handleSend,
      handlePickImage,
      handleImageSelected,
      finishChat,
      sendTemplate,
    },
  };
}

/* ===== N8N send helpers (front) ===== */
async function n8nSendMedia(to: string, text?: string, file?: File) {
  if (!N8N_READY) throw new Error("N8N disabled or missing base URL");
  const fd = new FormData();
  fd.append("to", to);
  if (text) fd.append("text", text);
  if (file) fd.append("file", file);
  const r = await fetch(`${N8N_BASE}${N8N_MEDIA_EP}`, { method: "POST", body: fd });
  if (!r.ok) throw new Error(`N8N media failed: ${r.status} ${await r.text()}`);
  return r.json().catch(() => ({}));
}
async function n8nSendTemplate(to: string, tratamiento: string, nombre_cliente: string, file?: File) {
  if (!N8N_READY) throw new Error("N8N disabled or missing base URL");
  const fd = new FormData();
  fd.append("to", to);
  fd.append("tratamiento", tratamiento);
  fd.append("nombre_cliente", nombre_cliente);
  if (file) fd.append("file", file);
  const r = await fetch(`${N8N_BASE}${N8N_TPL_EP}`, { method: "POST", body: fd });
  if (!r.ok) throw new Error(`N8N template failed: ${r.status} ${await r.text()}`);
  return r.json().catch(() => ({}));
}
