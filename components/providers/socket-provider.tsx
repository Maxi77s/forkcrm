"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { io, type Socket } from "socket.io-client";
import { useAuth } from "./auth-provider";
import { getWsOrigin, getChatNamespace, getSocketPath, getHttpBase } from "@/lib/env.client";

/** ================== Tipos mínimos ================== */
type ChatWire = {
  id?: string;
  _id?: string;
  chatId?: string;
  userId?: string;
  specialistId?: string;
  clientName?: string;
  status?: string;
  type?: string;
  createdAt?: any;
  updatedAt?: any;
};

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

/** ================== Utils cortos ================== */
const pickChatId = (p: any): string | undefined =>
  p?.chatId ?? p?.id ?? p?._id ?? p?.conversationId ?? p?.threadId ?? p?.ticketId;

const API_BASE = getHttpBase();

/** Intenta 3 endpoints típicos hasta conseguir { clientName, specialistId } */
async function fetchClientNameForChat(chatId: string, specialistId?: string) {
  const urls: string[] = [
    `${API_BASE}/chats/${encodeURIComponent(chatId)}`,
    specialistId ? `${API_BASE}/operators/${encodeURIComponent(specialistId)}/chats/${encodeURIComponent(chatId)}` : "",
    specialistId ? `${API_BASE}/chats?specialistId=${encodeURIComponent(specialistId)}&id=${encodeURIComponent(chatId)}` : "",
  ].filter(Boolean) as string[];

  for (const url of urls) {
    try {
      const r = await fetch(url, { credentials: "include" });
      if (!r.ok) continue;
      const data = await r.json();
      // soporta tanto objeto directo como {data:{...}}
      const obj = (data?.data ?? data) as any;
      const name = obj?.clientName ?? obj?.client_name ?? obj?.name;
      const spec = obj?.specialistId ?? obj?.operatorId ?? specialistId;
      if (name) return { clientName: String(name), specialistId: spec ? String(spec) : undefined };
    } catch {
      /* ignore and try next */
    }
  }
  return { clientName: undefined, specialistId };
}

/** ================== Provider ================== */
export function SocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const connectingRef = useRef(false);

  // cache in-memory para no re-consultar nombres por chatId
  const nameCacheRef = useRef<Map<string, string>>(new Map());

  const { token, user } = useAuth();

  const operatorId = useMemo(() => {
    const v =
      (user as any)?.id ??
      (user as any)?._id ??
      (user as any)?.dni ??
      (user as any)?.uid;
    return v ? String(v) : null;
  }, [user]);

  const roleFromUser = useMemo(() => {
    const raw = String((user as any)?.role || "CLIENT").toUpperCase();
    return raw.includes("OPER") ? "OPERADOR" : raw;
  }, [user]);

  const wsUrl = useMemo(() => {
    const origin = (getWsOrigin() || "").trim();            // http(s)://host[:port]
    const ns = (getChatNamespace() || "/chat").trim();      // /chat
    return `${origin}${ns}`;
  }, []);
  const enginePath = useMemo(() => getSocketPath() || "/socket.io", []);

  useEffect(() => {
    if (!token || !operatorId) {
      try { socket?.disconnect(); } catch {}
      setSocket(null);
      setIsConnected(false);
      connectingRef.current = false;
      return;
    }
    if (connectingRef.current) return;
    connectingRef.current = true;

    try { socket?.disconnect(); } catch {}
    setSocket(null);
    setIsConnected(false);

    const s = io(wsUrl, {
      path: enginePath,
      transports: ["websocket", "polling"],
      forceNew: true,
      withCredentials: true,
      auth: { token, operatorId, role: roleFromUser },
      reconnection: true,
      reconnectionAttempts: 8,
      timeout: 20000,
    });

    const onConnect = () => {
      setIsConnected(true);
      connectingRef.current = false;
      if (roleFromUser === "OPERADOR") {
        s.emit("operator:online", { operatorId });
      }
      console.log("[WS] connected:", s.id);
    };
    const onDisconnect = (reason: string) => {
      setIsConnected(false);
      if (roleFromUser === "OPERADOR") {
        s.emit?.("operator:offline", { operatorId, reason });
      }
    };
    const onError = (err: any) => console.error("❌ [WS]", err?.message ?? err);

    /** —— núcleo: asegurar nombre para cualquier chat/evento —— */
    const ensureClientName = async (raw: any) => {
      const chatId = pickChatId(raw);
      if (!chatId) return;

      const currentName =
        raw?.clientName ?? raw?.client_name ?? raw?.name ?? nameCacheRef.current.get(chatId);

      const specialistId =
        raw?.specialistId ?? raw?.operatorId ?? (roleFromUser === "OPERADOR" ? operatorId : undefined);

      // si ya lo tenemos, propagar y cachear
      if (currentName) {
        nameCacheRef.current.set(chatId, String(currentName));
        window.dispatchEvent(
          new CustomEvent("ws.chat.updated", {
            detail: { chat: { chatId: String(chatId), clientName: String(currentName), specialistId } },
          })
        );
        return;
      }

      // si NO está, lo pedimos al backend con filtro por specialistId
      const { clientName } = await fetchClientNameForChat(String(chatId), specialistId);
      if (clientName) {
        nameCacheRef.current.set(String(chatId), clientName);
        window.dispatchEvent(
          new CustomEvent("ws.chat.updated", {
            detail: { chat: { chatId: String(chatId), clientName, specialistId } },
          })
        );
      }
    };

    // Eventos mínimos
    const onChatCreated = (p: ChatWire) => { void ensureClientName(p); };
    const onChatUpdated = (p: ChatWire) => { void ensureClientName(p); };
    const onMessageNew  = (p: any)      => { void ensureClientName(p); };

    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);
    s.on("connect_error", onError);
    s.on("error", onError);

    s.on("chatCreated", onChatCreated);
    s.on("chat:created", onChatCreated);
    s.on("chat.updated", onChatUpdated);
    s.on("chatUpdated", onChatUpdated);
    s.on("chat:updated", onChatUpdated);

    s.on("message:new", onMessageNew);
    s.on("messageCreated", onMessageNew);
    s.on("message:created", onMessageNew);
    s.on("message", onMessageNew);

    setSocket(s);

    return () => {
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);
      s.off("connect_error", onError);
      s.off("error", onError);

      s.off("chatCreated", onChatCreated);
      s.off("chat:created", onChatCreated);
      s.off("chat.updated", onChatUpdated);
      s.off("chatUpdated", onChatUpdated);
      s.off("chat:updated", onChatUpdated);

      s.off("message:new", onMessageNew);
      s.off("messageCreated", onMessageNew);
      s.off("message:created", onMessageNew);
      s.off("message", onMessageNew);

      try { s.disconnect(); } catch {}
      connectingRef.current = false;
      setIsConnected(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, operatorId, roleFromUser, wsUrl, enginePath]);

  const value = useMemo(() => ({ socket, isConnected }), [socket, isConnected]);
  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocket must be used within a SocketProvider");
  return ctx;
}
