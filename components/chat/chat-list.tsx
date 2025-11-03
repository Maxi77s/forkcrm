// src/components/chat/chat-list.tsx
"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  useLayoutEffect,
} from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Search,
  MessageSquare,
  User,
  Bot as BotIcon,
  Phone,
  ChevronDown,
  ChevronUp,
  MessageSquareText,
  Megaphone,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatPreview } from "@/types/chats";
import { forcePersistClientName } from "@/components/helpers/helper.assign";
import { getChatDisplayName, setCachedDisplayName } from "@/lib/display-name";

/* ================== Config / Constantes ================== */

const ALLOWED_STATUSES = new Set([
  "ACTIVE",
  "WAITING",
  "IN_QUEUE",
  "ESCALATED",
  "ASSIGNED",
  "OPEN",
  "NEW",
  "PENDING",
  "HANDOFF",
  "HUMAN",
  "HUMAN_SUPPORT",
]);

const HIDE_STALE_MINUTES = 12 * 60;

const onlyDigits = (s: string) => String(s || "").replace(/[^\d]/g, "");
const safeStr = (v: any) => (v === null || v === undefined ? "" : String(v));
const safeLower = (v: any) => safeStr(v).toLowerCase();

function minutesBetween(a: Date, b: Date) {
  return Math.abs(a.getTime() - b.getTime()) / (1000 * 60);
}

function canonicalChatIdFrom(c: any): string | undefined {
  const direct =
    c?.chatId ||
    c?.id ||
    c?._id ||
    c?.roomId ||
    c?.conversationId ||
    c?.conversation_id ||
    c?.sessionId ||
    c?.session_id ||
    c?.ticketId ||
    c?.ticket_id ||
    c?.threadId ||
    c?.thread_id ||
    c?.waChatId ||
    c?.wa_chat_id ||
    c?.key;
  if (direct) return String(direct);

  const meta =
    c?.metadata?.canonicalChatId ||
    c?.meta?.canonicalChatId ||
    c?.canonicalChatId ||
    c?.metadata?.canonical_id ||
    c?.meta?.canonical_id;

  return meta ? String(meta) : undefined;
}

/* --- parseo robusto para fechas Mongo ({ $date: ... }) --- */
function tsOf(v: any): number {
  if (!v) return 0;
  if (typeof v === "number") return isNaN(v) ? 0 : v;
  if (v && typeof v === "object" && "$date" in v) {
    const raw = (v as any)["$date"];
    const d = new Date(typeof raw === "number" ? raw : String(raw));
    return isNaN(d.getTime()) ? 0 : d.getTime();
  }
  const d = new Date(v);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

function normalizeChat(raw: any): any {
  const id = raw?.id ?? raw?._id ?? undefined;
  const cid = canonicalChatIdFrom(raw) ?? id;

  const phone =
    raw?.phone ??
    raw?.client?.phone ??
    raw?.user?.phone ??
    raw?.metadata?.phone ??
    raw?.meta?.phone ??
    undefined;

  const lastMessageText =
    typeof raw?.lastMessage === "object"
      ? raw?.lastMessage?.content ?? raw?.lastMessage?.text ?? ""
      : raw?.lastMessage ?? "";

  const lastMessageTime =
    [
      raw?.lastMessageTime,
      raw?.lastMessageAt,
      raw?.last_activity_at,
      raw?.lastActivityAt,
      raw?.updatedAt,
      raw?.createdAt,
      raw?.timestamp,
      raw?.ts,
    ]
      .map(tsOf)
      .find((t) => t > 0) || 0;

  return {
    ...raw,
    id: id ? String(id) : undefined,
    _id: id ? String(id) : undefined,
    chatId: cid ? String(cid) : undefined,
    phone,
    lastMessage: typeof raw?.lastMessage === "object" ? raw.lastMessage : lastMessageText,

    // 👇 Siempre respetar clientName del back si viene
    clientName:
      raw?.clientName ??
      raw?.client_name ??
      raw?.metadata?.clientName ??
      raw?.meta?.clientName ??
      undefined,

    // 👇 Añadimos specialistId/operatorId si vienen
    specialistId: raw?.specialistId ?? raw?.operatorId ?? undefined,

    lastMessageTime,
    createdAt: tsOf(raw?.createdAt),
    updatedAt: tsOf(raw?.updatedAt),
  };
}

function isGhost(c: any): boolean {
  const msg = safeStr(
    typeof c?.lastMessage === "object"
      ? c?.lastMessage?.content ?? c?.lastMessage?.text
      : c?.lastMessage
  ).trim();
  const phone = onlyDigits(c?.phone ?? c?.client?.phone ?? "");
  const type = String(c?.type ?? "").toUpperCase();
  const assigned = !!(c?.specialistId || c?.operatorId);
  return !msg && !phone && type === "BOT" && !assigned;
}

function scoreChat(c: any): number {
  const assigned = !!(c?.specialistId || c?.operatorId);
  const unread = Number(c?.unreadCount || 0) > 0;
  const msg = safeStr(
    typeof c?.lastMessage === "object"
      ? c?.lastMessage?.content ?? c?.lastMessage?.text
      : c?.lastMessage
  ).trim();
  const phone = onlyDigits(c?.phone ?? "");
  const type = String(c?.type ?? "").toUpperCase();

  let s = 0;
  if (assigned) s += 50;
  if (unread) s += 30;
  if (msg) s += 20;
  if (phone) s += 15;
  if (type === "HUMAN_SUPPORT" || type === "HUMAN") s += 12;
  if (type === "BOT") s -= 4;

  return s;
}

function pickBestForClient(cands: any[]): any {
  const nonGhosts = cands.filter((c) => !isGhost(c));
  const pool = nonGhosts.length ? nonGhosts : cands;

  return pool.sort((a, b) => {
    const sa = scoreChat(a);
    const sb = scoreChat(b);
    if (sa !== sb) return sb - sa;
    const at = Number(a?.lastMessageTime || a?.updatedAt || a?.createdAt || 0);
    const bt = Number(b?.lastMessageTime || b?.updatedAt || b?.createdAt || 0);
    return bt - at;
  })[0];
}

function shouldShow(chat: any): boolean {
  const cidOk = !!chat?.chatId;
  if (!cidOk) return false;

  const status = String(chat?.status ?? "").toUpperCase();
  if (status && !ALLOWED_STATUSES.has(status)) {
    if (["FINISHED", "COMPLETED", "CANCELLED", "ARCHIVED", "DELETED"].includes(status)) {
      if (Number(chat?.unreadCount || 0) <= 0) return false;
    }
  }

  const hasSomeIdentity =
    !!safeStr(chat?.clientName).trim() ||
    !!onlyDigits(chat?.phone ?? "") ||
    !!safeStr(chat?.lastMessage?.content ?? chat?.lastMessage).trim();

  const lastTs = chat?.lastMessageTime || chat?.updatedAt || chat?.createdAt;
  const last = new Date(Number(lastTs));
  if (!lastTs || isNaN(last.getTime())) return false;

  const type = String(chat?.type ?? "").toUpperCase();
  const assigned = !!(chat?.specialistId || chat?.operatorId);
  const unread = Number(chat?.unreadCount || 0) > 0;

  const now = new Date();
  if (type === "BOT" && !assigned && !unread && minutesBetween(now, last) > HIDE_STALE_MINUTES)
    return false;
  if (!hasSomeIdentity && minutesBetween(now, last) > 30 * 24 * 60) return false;

  return true;
}

const listHeightClass = "h-[calc(100dvh-200px)]";
const DEFAULT_PAGE_SIZE = 10;
const PAGE_STEP = 10;

const getStatusColor = (status: string) => {
  switch ((status || "").toUpperCase()) {
    case "ACTIVE":
      return "bg-green-500";
    case "WAITING":
      return "bg-amber-500";
    case "FINISHED":
    case "COMPLETED":
      return "bg-gray-400";
    case "CANCELLED":
      return "bg-red-400";
    case "IN_QUEUE":
      return "bg-blue-400";
    case "TIMEOUT_FALLBACK":
      return "bg-purple-400";
    case "ESCALATED":
    case "ASSIGNED":
      return "bg-sky-500";
    case "OPEN":
    case "NEW":
    case "PENDING":
    case "HUMAN":
    case "HUMAN_SUPPORT":
      return "bg-blue-500";
    default:
      return "bg-gray-300";
  }
};

const getStatusText = (status: string) => {
  switch ((status || "").toUpperCase()) {
    case "ACTIVE":
      return "Activo";
    case "WAITING":
      return "Esperando";
    case "FINISHED":
    case "COMPLETED":
      return "Finalizado";
    case "CANCELLED":
      return "Cancelado";
    case "IN_QUEUE":
      return "En cola";
    case "TIMEOUT_FALLBACK":
      return "Fallback IA";
    case "ESCALATED":
    case "ASSIGNED":
      return "Escalado";
    case "OPEN":
    case "NEW":
    case "PENDING":
      return "Pendiente";
    case "HUMAN":
    case "HUMAN_SUPPORT":
      return "Humano";
    default:
      return "Desconocido";
  }
};

function formatTime(date?: number | Date | string) {
  if (!date) return "";
  const d = new Date(typeof date === "number" ? date : date);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (days === 1) return "Ayer";
  if (days < 7) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { day: "2-digit", month: "2-digit" });
}

/* ================= Props ================= */

interface ChatListProps {
  chats: ChatPreview[] & Array<Partial<{ mode: "BOT" | "AI" | "HUMAN"; botThinking: boolean }>>;
  selectedChatId: string | null;
  onChatSelect: (chatId: string) => void;
  onNewChat?: () => void;
  isLoading?: boolean;
}

function ModeBadge({ mode, thinking }: { mode?: "BOT" | "AI" | "HUMAN"; thinking?: boolean }) {
  if (!mode) return null;
  const classes =
    mode === "HUMAN"
      ? "bg-emerald-100 text-emerald-700 border-emerald-200"
      : mode === "AI"
      ? "bg-purple-100 text-purple-700 border-purple-200"
      : "bg-indigo-100 text-indigo-700 border-indigo-200";
  const label = mode === "HUMAN" ? "Humano" : mode === "AI" ? "IA" : "Bot";
  return (
    <Badge className={cn("shrink-0", classes, "px-2 py-0.5 h-5 text-[11px]")}>
      {label}
      {thinking ? <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-current animate-pulse" /> : null}
    </Badge>
  );
}

export function ChatList({
  chats,
  selectedChatId,
  onChatSelect,
  onNewChat,
  isLoading = false,
}: ChatListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [phoneTerm, setPhoneTerm] = useState("");
  const [filteredChats, setFilteredChats] = useState<any[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState<number>(DEFAULT_PAGE_SIZE);

  // OVERLAY: upserts por sockets sin refrescar
  const [runtimeUpserts, setRuntimeUpserts] = useState<Record<string, any>>({});

  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({ });
  const scrollAreaRootRef = useRef<HTMLDivElement | null>(null);
  const scrollViewportRef = useRef<HTMLDivElement | null>(null);

  const hadDataRef = useRef(false);
  useEffect(() => {
    if (Array.isArray(chats) && chats.length > 0) hadDataRef.current = true;
  }, [chats]);

  useEffect(() => {
    if (!scrollAreaRootRef.current) return;
    const vp =
      scrollAreaRootRef.current.querySelector<HTMLDivElement>("[data-radix-scroll-area-viewport]");
    if (vp) scrollViewportRef.current = vp;
  }, []);

  const upsertRuntime = useCallback((partial: any) => {
    const n = normalizeChat(partial);
    const cid = n.chatId;
    if (!cid) return;
    setRuntimeUpserts((prev) => ({
      ...prev,
      [cid]: { ...(prev[cid] || {}), ...n },
    }));
  }, []);

  // ---- listeners (wirea tu provider a estos window events) ----
  useEffect(() => {
    function onChatCreated(e: any) {
      const chat = normalizeChat(e?.detail?.chat || e?.detail);
      if (chat?.clientName) setCachedDisplayName(chat, String(chat.clientName));
      upsertRuntime(chat);
    }
    function onChatUpdated(e: any) {
      const d = e?.detail?.chat || e?.detail;
      const chat = normalizeChat(d);
      if (chat?.clientName) setCachedDisplayName(chat, String(chat.clientName));
      upsertRuntime({ ...chat, chatId: String(chat.chatId || chat.id || d.chatId) });
    }
    function onMessageNew(e: any) {
      const d = e?.detail || {};
      const now = Date.now();
      const patch = {
        chatId: String(d.chatId || d.chat_id || d.threadId || d.conversationId || ""),
        lastMessage:
          typeof d.message === "object" ? (d.message?.content ?? d.message?.text ?? "") : d.message,
        lastMessageTime: now,
        unreadCount: 1,
        clientName: d.clientName ?? undefined,   // si viene, lo respetamos (DB suele propagarlo)
        phone: d.phone ?? undefined,
        userId: d.userId ?? undefined,
      };
      if (patch.clientName) setCachedDisplayName(patch, String(patch.clientName));
      upsertRuntime(patch);
    }
    function onClientNameUpdated(e: any) {
      const d = e?.detail || {};
      const cid = String(d.chatId || "");
      const name = String(d.clientName || "").trim();
      if (!cid || !name) return;
      upsertRuntime({ chatId: cid, clientName: name });
    }

    window.addEventListener("ws.chat.created", onChatCreated as any);
    window.addEventListener("ws.chat.updated", onChatUpdated as any);
    window.addEventListener("ws.message.new", onMessageNew as any);
    window.addEventListener("clientNameUpdated", onClientNameUpdated as any);

    return () => {
      window.removeEventListener("ws.chat.created", onChatCreated as any);
      window.removeEventListener("ws.chat.updated", onChatUpdated as any);
      window.removeEventListener("ws.message.new", onMessageNew as any);
      window.removeEventListener("clientNameUpdated", onClientNameUpdated as any);
    };
  }, [upsertRuntime]);

  // props + overlay
  const baseWithRuntime = useMemo(() => {
    const src = (Array.isArray(chats) ? chats : []).map(normalizeChat);
    const map = new Map<string, any>();
    for (const c of src) if (c.chatId) map.set(c.chatId, c);
    for (const [cid, patch] of Object.entries(runtimeUpserts)) {
      const prev = map.get(cid) || {};
      map.set(cid, { ...prev, ...patch });
    }
    return Array.from(map.values());
  }, [chats, runtimeUpserts]);

  const normNoGhosts = useMemo(() => baseWithRuntime.filter(shouldShow), [baseWithRuntime]);

  const uniqueByClient = useMemo(() => {
    const groups = new Map<string, any[]>();
    for (const c of normNoGhosts) {
      const key =
        safeStr(c?.clientId || c?.userId) ||
        (onlyDigits(c?.phone || c?.client?.phone || "") && `tel:${onlyDigits(c?.phone || c?.client?.phone || "")}`) ||
        safeStr(c?.chatId || c?.id || "");
      const arr = groups.get(key) || [];
      arr.push(c);
      groups.set(key, arr);
    }
    return Array.from(groups.values()).map((list) => pickBestForClient(list));
  }, [normNoGhosts]);

  const sortedChats = useMemo(
    () =>
      [...uniqueByClient].sort((a: any, b: any) => {
        const aTime = Number(a.lastMessageTime ?? a.updatedAt ?? a.createdAt ?? 0);
        const bTime = Number(b.lastMessageTime ?? b.updatedAt ?? b.createdAt ?? 0);
        return bTime - aTime;
      }),
    [uniqueByClient],
  );

  // Si llega clientName desde el back, sembrar caché y diccionario auxiliar
  useEffect(() => {
    for (const ch of sortedChats) {
      const name = String(ch?.clientName || "").trim();
      if (name && !/^\+?[\d\-\s\(\)]{6,}$/.test(name)) {
        setCachedDisplayName(ch, name);
        forcePersistClientName({
          name,
          clientId: safeStr(ch?.clientId ?? ch?.userId) || undefined,
          phone: ch?.phone ? String(ch?.phone) : undefined,
          chatId: String(ch?.chatId ?? ch?.id ?? ch?._id ?? ""),
        });
      }
    }
  }, [sortedChats]);

  const displayNameOf = (chat: any) => getChatDisplayName(chat);

  const [searchTermState, setSearchTermState] = useState({ s: "", p: "" });
  useEffect(() => setSearchTermState({ s: searchTerm, p: phoneTerm }), [searchTerm, phoneTerm]);

  useEffect(() => {
    const term = safeLower(searchTermState.s).trim();
    const phoneDigits = onlyDigits(searchTermState.p.trim());

    const filtered = (sortedChats ?? [])
      .map((ch: any) => ({ ...ch, __displayName: displayNameOf(ch) }))
      .filter((chat: any) => {
        const displayName = safeLower(chat.__displayName);
        const byText =
          !term ||
          displayName.includes(term) ||
          safeLower(safeStr(chat.clientId)).includes(term) ||
          safeLower(
            typeof chat.lastMessage === "object"
              ? chat.lastMessage?.content ?? chat.lastMessage?.text ?? ""
              : chat.lastMessage
          ).includes(term);
        const chatPhoneDigits = onlyDigits(chat.phone ?? chat.client?.phone ?? "");
        const byPhone = !phoneDigits || chatPhoneDigits.includes(phoneDigits);
        return byText && byPhone;
      });

    setFilteredChats(filtered);
    if (expandedId && !filtered.some((c: any) => c.chatId === expandedId)) setExpandedId(null);
  }, [sortedChats, searchTermState, expandedId]);

  useEffect(() => setVisibleCount(DEFAULT_PAGE_SIZE), [searchTerm, phoneTerm]);

  const displayedChats = useMemo(
    () => filteredChats.slice(0, Math.min(visibleCount, filteredChats.length)),
    [filteredChats, visibleCount]
  );

  useLayoutEffect(() => {
    const vp = scrollViewportRef.current;
    if (vp) (vp as any).__prevScrollH = vp.scrollHeight;
  }, [displayedChats]);

  useLayoutEffect(() => {
    const vp = scrollViewportRef.current;
    if (!vp) return;
    const prevH = (vp as any).__prevScrollH || 0;
    const delta = vp.scrollHeight - prevH;
    if (delta > 0) vp.scrollTop += delta;
  }, [displayedChats]);

  useEffect(() => {
    if (!selectedChatId) return;
    const el = itemRefs.current[selectedChatId];
    if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedChatId]);

  const setItemRef = useCallback(
    (chatId: string) => (el: HTMLDivElement | null) => {
      itemRefs.current[chatId] = el;
    },
    []
  );

  const openWA = (phone?: string) => {
    const d = onlyDigits(phone ?? "");
    if (d) window.open(`https://wa.me/${d}`, "_blank", "noopener,noreferrer");
  };
  const callTel = (phone?: string) => {
    const d = onlyDigits(phone ?? "");
    if (d) window.location.href = `tel:+${d}`;
  };

  const canLoadMore = visibleCount < filteredChats.length;
  const handleLoadMore = () => setVisibleCount((prev) => Math.min(prev + PAGE_STEP, filteredChats.length));

  return (
    <Card className="h-full flex flex-col border-0 rounded-none bg-white shadow-sm overflow-hidden">
      <CardHeader className="pb-4 border-b bg-gradient-to-r from-white to-slate-50 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold flex items-center text-gray-800">
            <MessageSquare className="h-6 w-6 mr-3 text-sky-500" />
            Chats ({filteredChats.length})
          </CardTitle>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="gap-2" title="Enviar mensajes masivos">
              <Megaphone className="h-4 w-4" />
              Difusión
            </Button>

            {onNewChat && (
              <Button
                size="sm"
                onClick={onNewChat}
                className="bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 shadow-md"
              >
                Nuevo Chat
              </Button>
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar por nombre, ID o mensaje…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 border-gray-300 focus:border-sky-500 focus:ring-sky-500 rounded-full shadow-sm"
            />
          </div>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Teléfono (ej. +549351...)"
              inputMode="tel"
              value={phoneTerm}
              onChange={(e) => setPhoneTerm(e.target.value)}
              className="pl-10 border-gray-300 focus:border-sky-500 focus:ring-sky-500 rounded-full shadow-sm"
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 relative">
        {isLoading && hadDataRef.current && (
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-500 via-blue-400 to-sky-500 animate-pulse opacity-70" />
        )}

        <div ref={scrollAreaRootRef}>
          <ScrollArea className={`w-full ${listHeightClass}`}>
            {!hadDataRef.current && isLoading ? (
              <div className="p-4 space-y-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex items-center space-x-4 p-4 animate-pulse">
                    <div className="w-12 h-12 bg-gray-200 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-3/4" />
                      <div className="h-3 bg-gray-200 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredChats.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-96 text-center p-6">
                <div className="bg-slate-100 rounded-full p-6 mb-6">
                  <MessageSquare className="h-16 w-16 text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-700 mb-2">
                  {searchTerm || phoneTerm ? "No se encontraron chats" : "No hay chats disponibles"}
                </h3>
                <p className="text-gray-500 max-w-sm">
                  {searchTerm || phoneTerm
                    ? "Probá con otros términos o quita filtros"
                    : "Los chats aparecerán aquí cuando los clientes inicien conversaciones"}
                </p>
              </div>
            ) : (
              <>
                <div className="divide-y divide-gray-100">
                  {displayedChats.map((chat: any) => {
                    const cid = chat.chatId as string;
                    const isExpanded = expandedId === cid;
                    const phone = chat.phone as string | undefined;

                    const displayName = chat.__displayName || getChatDisplayName(chat);

                    const initials =
                      displayName
                        .trim()
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((p: string[]) => p[0]?.toUpperCase() ?? "")
                        .join("") || "U";

                    const lastMessageText =
                      safeStr(
                        typeof chat.lastMessage === "object"
                          ? chat.lastMessage?.content ?? chat.lastMessage?.text ?? ""
                          : chat.lastMessage
                      ) || "—";
                    const showBotIcon = /(^hola\b)|(^¡hola\b)|bienvenido|asistente|bot/i.test(
                      lastMessageText || ""
                    );

                    return (
                      <div
                        key={cid}
                        ref={setItemRef(cid)}
                        onDoubleClick={() => setExpandedId((prev) => (prev === cid ? null : cid))}
                        className={cn(
                          "group relative transition-colors duration-200",
                          isExpanded ? "bg-white" : "hover:bg-gradient-to-r hover:from-slate-50 hover:to-blue-50"
                        )}
                      >
                        <div
                          className={cn(
                            "flex items-start p-4 cursor-pointer",
                            selectedChatId === cid &&
                              "bg-gradient-to-r from-sky-50 to-blue-50 border-r-4 border-sky-500 shadow-sm"
                          )}
                          onClick={() => {
                            onChatSelect(cid);
                            if (displayName && !/^\+?[\d\-\s\(\)]{6,}$/.test(displayName)) {
                              setCachedDisplayName(chat, displayName);
                            }
                          }}
                        >
                          {/* Avatar */}
                          <div className="relative mr-4 mt-0.5 shrink-0">
                            <Avatar
                              className={cn(
                                "h-14 w-14 shadow-sm",
                                selectedChatId === cid && "ring-2 ring-sky-200"
                              )}
                            >
                              {chat.avatar ? (
                                <AvatarImage src={chat.avatar} alt={displayName} />
                              ) : null}
                              <AvatarFallback className="bg-gradient-to-r from-blue-100 to-blue-200 text-blue-700 font-semibold">
                                {initials || <User className="h-6 w-6" />}
                              </AvatarFallback>
                            </Avatar>
                            {chat.isOnline && (
                              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 border-2 border-white rounded-full shadow-sm" />
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="flex min-w-0 flex-1 items-center gap-2">
                                <h4 className="font-bold text-gray-800 truncate text-lg">
                                  {displayName}
                                </h4>

                                {chat.channel === "ECOM" && (
                                  <Badge className="shrink-0 bg-green-100 text-green-700 border border-green-200">
                                    E-commerce
                                  </Badge>
                                )}

                                <ModeBadge mode={chat.mode} thinking={chat.botThinking} />
                              </div>

                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 opacity-70 hover:opacity-100 shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedId((prev) => (prev === cid ? null : cid));
                                }}
                                title={isExpanded ? "Contraer" : "Expandir"}
                              >
                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </Button>
                            </div>

                            {/* Teléfono + estado */}
                            <div className="flex items-center justify-between mt-0.5">
                              <div className="flex items-center gap-2">
                                {phone && (
                                  <span className="text-xs text-gray-500 font-mono">
                                    +{onlyDigits(phone)}
                                  </span>
                                )}
                                <div className="flex items-center gap-1">
                                  <div className={cn("w-2 h-2 rounded-full shadow-sm", getStatusColor(chat.status))} />
                                  <span className="text-xs text-gray-500">{getStatusText(chat.status)}</span>
                                </div>
                              </div>
                              <span className="text-xs text-gray-500 font-medium">
                                {formatTime(chat.lastMessageTime)}
                              </span>
                            </div>

                            {/* Mensaje */}
                            <div
                              className={cn(
                                "mt-1 text-sm text-gray-700",
                                isExpanded ? "whitespace-normal break-words" : "truncate max-w-[260px]"
                              )}
                            >
                              {showBotIcon && (
                                <BotIcon className="inline h-3 w-3 mr-1 text-purple-500" />
                              )}
                              {lastMessageText}
                            </div>

                            {/* Unread badge */}
                            <div className="mt-2">
                              {!!chat.unreadCount && chat.unreadCount > 0 && (
                                <Badge className="bg-gradient-to-r from-sky-500 to-sky-600 text-white text-xs min-w-[24px] h-5 rounded-full">
                                  {chat.unreadCount > 99 ? "99+" : chat.unreadCount}
                                </Badge>
                              )}
                            </div>

                            {/* Acciones extra */}
                            {isExpanded && (
                              <div className="mt-3 flex items-center gap-2">
                                {phone && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openWA(phone);
                                    }}
                                  >
                                    <MessageSquareText className="h-4 w-4" />
                                    <span className="ml-1 text-xs">WhatsApp</span>
                                  </Button>
                                )}
                                {phone && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      callTel(phone);
                                    }}
                                  >
                                    <Phone className="h-4 w-4" />
                                    <span className="ml-1 text-xs">Llamar</span>
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="p-4 flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    Mostrando <span className="font-semibold">{displayedChats.length}</span> de{" "}
                    <span className="font-semibold">{filteredChats.length}</span> chats
                  </span>
                  {canLoadMore && (
                    <Button variant="outline" size="sm" onClick={handleLoadMore} className="rounded-full">
                      Más chats
                    </Button>
                  )}
                </div>
              </>
            )}
            <ScrollBar orientation="vertical" />
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}

export default ChatList;
