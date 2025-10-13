// ChatList.tsx (versión con persistencia forzosa de nombres)
"use client";

import { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, MessageSquare, User, Bot, Phone, ChevronDown, ChevronUp, MessageSquareText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatPreview } from "@/types/chats";
import { fetchUserNamesByIds } from "@/components/helpers/helper.assign";
import { patchChatClientName } from "@/components/helpers/helper.assign"; // <- lo usamos en el listener

const ALLOWED_STATUSES = new Set([
  "ACTIVE", "WAITING", "IN_QUEUE", "ESCALATED", "ASSIGNED", "OPEN", "NEW", "PENDING", "HANDOFF", "HUMAN", "HUMAN_SUPPORT"
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
    c?.chatId || c?.id || c?._id || c?.roomId || c?.conversationId || c?.conversation_id ||
    c?.sessionId || c?.session_id || c?.ticketId || c?.ticket_id || c?.threadId || c?.thread_id ||
    c?.waChatId || c?.wa_chat_id || c?.key;
  if (direct) return String(direct);
  const meta =
    c?.metadata?.canonicalChatId ||
    c?.meta?.canonicalChatId ||
    c?.canonicalChatId ||
    c?.metadata?.canonical_id ||
    c?.meta?.canonical_id;
  return meta ? String(meta) : undefined;
}
function toTitleCase(name?: string) {
  const n = (name || "").trim();
  if (!n) return n;
  return n.split(/\s+/).map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(" ");
}
function isGenericClientLabel(name?: string) {
  const n = (name || "").trim().toLowerCase();
  if (!n) return true;
  // ⚠️ seguimos considerando genéricos, pero el "name authority" los sobreescribe
  if (["cliente","cliente genérico","unknown","desconocido","anónimo","anonimo"].includes(n)) return true;
  if (/^cliente[\s\-_]?[0-9a-f\-]{4,}$/i.test(n)) return true;
  if (/^cliente[:\s]+[0-9a-f\-\+]{4,}$/i.test(n)) return true;
  return false;
}
function isLikelyPhoneLabel(s?: string) {
  const n = (s || "").trim();
  return !!n && /^[\+\d][\d\s\-\(\)]{5,}$/.test(n);
}
function isGoodName(name?: string) {
  if (!name) return false;
  const n = name.trim();
  if (!n) return false;
  if (isLikelyPhoneLabel(n)) return false;
  // ya no filtramos "usuario" de forma dura; lo dejamos pasar si viene de authority o del back
  return true;
}
const pickFirstNonEmpty = (...cands: Array<any>): string | undefined => {
  for (const c of cands) {
    const s = safeStr(c).trim();
    if (s) return s;
  }
  return undefined;
};

const NAME_AUTH_KEY = "chatlist.nameAuthority.v2";
type NameAuthorityMap = Record<string, string>;
function loadNameAuthority(): NameAuthorityMap {
  try { return JSON.parse(localStorage.getItem(NAME_AUTH_KEY) || "{}"); } catch { return {}; }
}
function saveNameAuthority(map: NameAuthorityMap) {
  try { localStorage.setItem(NAME_AUTH_KEY, JSON.stringify(map)); } catch {}
}
function authorityKeysForNames(clientId?: string, userId?: string, phoneDigits?: string) {
  const keys: string[] = [];
  if (clientId) keys.push(`client:${clientId}`);
  if (userId)   keys.push(`user:${userId}`);
  if (phoneDigits) keys.push(`tel:${phoneDigits}`);
  return keys;
}

function canonicalClientKey(chat: any): string {
  const clientId = safeStr(chat?.clientId || "");
  const userId   = safeStr(chat?.userId   || "");
  const phoneDig = onlyDigits(chat?.phone ?? chat?.client?.phone ?? chat?.metadata?.phone ?? chat?.meta?.phone ?? "");
  return clientId || userId || (phoneDig ? `tel:${phoneDig}` : safeStr(chat?.chatId || chat?.id || "unknown"));
}

function resolveLastMessageTime(raw: any): number {
  const cands = [raw?.lastMessageTime, raw?.lastMessageAt, raw?.last_activity_at, raw?.lastActivityAt, raw?.updatedAt, raw?.createdAt, raw?.timestamp, raw?.ts];
  for (const v of cands) {
    if (!v) continue;
    const t = typeof v === "number" ? v : new Date(v).getTime();
    if (!isNaN(t) && t > 0) return t;
  }
  return 0;
}
function normalizeChat(raw: any): any {
  const cid = canonicalChatIdFrom(raw);
  const phone = raw?.phone ?? raw?.client?.phone ?? raw?.user?.phone ?? raw?.metadata?.phone ?? raw?.meta?.phone ?? undefined;
  const lastMessageText =
    typeof raw?.lastMessage === "object"
      ? raw?.lastMessage?.content ?? raw?.lastMessage?.text ?? ""
      : raw?.lastMessage ?? "";
  const lastMessageTime = resolveLastMessageTime(raw);
  return { ...raw, chatId: cid, phone, lastMessage: typeof raw?.lastMessage === "object" ? raw.lastMessage : lastMessageText, lastMessageTime };
}
function isGhost(c: any): boolean {
  const msg = safeStr(typeof c?.lastMessage === "object" ? (c?.lastMessage?.content ?? c?.lastMessage?.text) : c?.lastMessage).trim();
  const phone = onlyDigits(c?.phone ?? c?.client?.phone ?? "");
  const type = String(c?.type ?? "").toUpperCase();
  const assigned = !!(c?.specialistId || c?.operatorId);
  return (!msg && !phone && type === "BOT" && !assigned);
}
function scoreChat(c: any): number {
  const assigned = !!(c?.specialistId || c?.operatorId);
  const unread = Number(c?.unreadCount || 0) > 0;
  const msg = safeStr(typeof c?.lastMessage === "object" ? (c?.lastMessage?.content ?? c?.lastMessage?.text) : c?.lastMessage).trim();
  const phone = onlyDigits(c?.phone ?? "");
  const name = safeStr(c?.clientName).trim();
  const nonGenericName = name && !isGenericClientLabel(name) ? 1 : 0;
  const type = String(c?.type ?? "").toUpperCase();
  let s = 0;
  if (assigned) s += 50;
  if (unread) s += 30;
  if (msg) s += 20;
  if (phone) s += 15;
  if (nonGenericName) s += 5;
  if (type === "HUMAN_SUPPORT" || type === "HUMAN") s += 12;
  if (type === "BOT") s -= 4;
  return s;
}
function pickBetterChat(a: any, b: any): any {
  const ag = isGhost(a); const bg = isGhost(b);
  if (ag !== bg) return ag ? b : a;
  const sa = scoreChat(a); const sb = scoreChat(b);
  if (sa !== sb) return sb > sa ? b : a;
  const at = Number(a?.lastMessageTime || a?.updatedAt || a?.createdAt || 0);
  const bt = Number(b?.lastMessageTime || b?.updatedAt || b?.createdAt || 0);
  if (at !== bt) return bt > at ? b : a;
  const aScore = (safeStr(a?.phone).length > 0 ? 1 : 0) + (safeStr(a?.lastMessage?.content ?? a?.lastMessage).length > 0 ? 1 : 0);
  const bScore = (safeStr(b?.phone).length > 0 ? 1 : 0) + (safeStr(b?.lastMessage?.content ?? b?.lastMessage).length > 0 ? 1 : 0);
  return bScore > aScore ? b : a;
}
function pickBestForClient(cands: any[], authoritativeChatId?: string): any {
  if (authoritativeChatId) {
    const hit = cands.find(c => c.chatId === authoritativeChatId);
    if (hit) return hit;
  }
  const nonGhosts = cands.filter(c => !isGhost(c));
  const pool = nonGhosts.length ? nonGhosts : cands;
  return pool.sort((a, b) => {
    const sa = scoreChat(a); const sb = scoreChat(b);
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
  if (type === "BOT" && !assigned && !unread && minutesBetween(now, last) > HIDE_STALE_MINUTES) return false;
  if (!hasSomeIdentity && minutesBetween(now, last) > 30 * 24 * 60) return false;
  return true;
}

const AUTH_KEY = "chatlist.authority.v2";
type AuthorityMap = Record<string, string>;
function loadAuthority(): AuthorityMap { try { return JSON.parse(localStorage.getItem(AUTH_KEY) || "{}"); } catch { return {}; } }
function saveAuthority(map: AuthorityMap) { try { localStorage.setItem(AUTH_KEY, JSON.stringify(map)); } catch {} }

const listHeightClass = "h-[calc(100dvh-200px)]";
const DEFAULT_PAGE_SIZE = 10;
const PAGE_STEP = 10;

const getStatusColor = (status: string) => {
  switch ((status || "").toUpperCase()) {
    case "ACTIVE": return "bg-green-500";
    case "WAITING": return "bg-amber-500";
    case "FINISHED":
    case "COMPLETED": return "bg-gray-400";
    case "CANCELLED": return "bg-red-400";
    case "IN_QUEUE": return "bg-blue-400";
    case "TIMEOUT_FALLBACK": return "bg-purple-400";
    case "ESCALATED":
    case "ASSIGNED": return "bg-sky-500";
    case "OPEN":
    case "NEW":
    case "PENDING":
    case "HUMAN":
    case "HUMAN_SUPPORT": return "bg-blue-500";
    default: return "bg-gray-300";
  }
};
const getStatusText = (status: string) => {
  switch ((status || "").toUpperCase()) {
    case "ACTIVE": return "Activo";
    case "WAITING": return "Esperando";
    case "FINISHED":
    case "COMPLETED": return "Finalizado";
    case "CANCELLED": return "Cancelado";
    case "IN_QUEUE": return "En cola";
    case "TIMEOUT_FALLBACK": return "Fallback IA";
    case "ESCALATED": return "Escalado";
    case "ASSIGNED": return "Asignado";
    case "OPEN": return "Abierto";
    case "NEW": return "Nuevo";
    case "PENDING": return "Pendiente";
    case "HUMAN":
    case "HUMAN_SUPPORT": return "Humano";
    default: return "Desconocido";
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

interface ChatListProps {
  chats: ChatPreview[];
  selectedChatId: string | null;
  onChatSelect: (chatId: string) => void;
  onNewChat?: () => void;
  isLoading?: boolean;
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

  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const scrollAreaRootRef = useRef<HTMLDivElement | null>(null);
  const scrollViewportRef = useRef<HTMLDivElement | null>(null);

  const authorityRef = useRef<AuthorityMap>({});
  useEffect(() => { authorityRef.current = loadAuthority(); }, []);
  const recordAuthority = (gkey: string, chatId?: string) => {
    const chid = safeStr(chatId).trim();
    if (!gkey || !chid) return;
    const map = { ...authorityRef.current, [gkey]: chid };
    authorityRef.current = map;
    saveAuthority(map);
  };

  const nameAuthorityRef = useRef<NameAuthorityMap>({});
  useEffect(() => { nameAuthorityRef.current = loadNameAuthority(); }, []);

  const hadDataRef = useRef(false);
  useEffect(() => { if (Array.isArray(chats) && chats.length > 0) hadDataRef.current = true; }, [chats]);

  useEffect(() => {
    if (!scrollAreaRootRef.current) return;
    const vp = scrollAreaRootRef.current.querySelector<HTMLDivElement>("[data-radix-scroll-area-viewport]");
    if (vp) scrollViewportRef.current = vp;
  }, []);

  const normNoGhosts = useMemo(() => {
    const normed = (Array.isArray(chats) ? chats : [])
      .map(normalizeChat)
      .filter(shouldShow);

    const byId = new Map<string, any>();
    for (const c of normed) {
      const cid = c.chatId;
      if (!cid) continue;
      const prev = byId.get(cid);
      if (!prev) byId.set(cid, c);
      else byId.set(cid, pickBetterChat(prev, c));
    }
    return Array.from(byId.values());
  }, [chats]);

  const uniqueByClient = useMemo(() => {
    const groups = new Map<string, any[]>();
    for (const c of normNoGhosts) {
      const gkey = canonicalClientKey(c);
      const arr = groups.get(gkey) || [];
      arr.push(c); groups.set(gkey, arr);
    }
    const result: any[] = [];
    for (const [gkey, list] of Array.from(groups.entries())) {
      const authoritativeChatId = authorityRef.current[gkey];
      const best = list.length === 1 ? list[0] : pickBestForClient(list, authoritativeChatId);
      result.push(best);
    }
    return result;
  }, [normNoGhosts]);

  const sortedChats = useMemo(() => {
    return [...uniqueByClient].sort((a: any, b: any) => {
      const aTime = Number(a.lastMessageTime ?? a.updatedAt ?? a.createdAt ?? 0);
      const bTime = Number(b.lastMessageTime ?? b.updatedAt ?? b.createdAt ?? 0);
      return bTime - aTime;
    });
  }, [uniqueByClient]);

  // === RESOLVER DISPLAY NAME (confía en el AUTHORITY si existe) ===
  function resolveDisplayName(chat: any, nameAuthority: Record<string,string>): string {
    // 1) authority primero (confianza total; acepta "usuario")
    const digits  = onlyDigits(chat.phone ?? chat.client?.phone ?? chat.user?.phone ?? chat.metadata?.phone ?? chat.meta?.phone ?? "");
    const clientId = safeStr(chat.clientId || "");
    const userId   = safeStr(chat.userId   || "");
    const keys = [
      clientId && `client:${clientId}`,
      userId   && `user:${userId}`,
      digits   && `tel:${digits}`
    ].filter(Boolean) as string[];
    for (const k of keys) {
      const v = (nameAuthority[k] || "").trim();
      if (v) return toTitleCase(v);
    }

    // 2) luego campos directos del chat (seguimos evitando etiquetas tipo "Cliente 123…")
    const direct = safeStr(chat.clientName || chat.client_name || chat.nombreCliente || chat.nombre_cliente);
    if (isGoodName(direct) && !isGenericClientLabel(direct)) return toTitleCase(direct)!;

    const nested =
      pickFirstNonEmpty(
        chat.name, chat.displayName, chat.display_name, chat.customerName, chat.customer_name,
        chat.user?.name, chat.user?.fullName, [chat.user?.firstName, chat.user?.lastName].filter(Boolean).join(" "),
        chat.client?.name, chat.client?.fullName, [chat.client?.firstName, chat.client?.lastName].filter(Boolean).join(" "),
        chat.metadata?.client?.name, chat.meta?.client?.name
      ) || "";
    if (isGoodName(nested) && !isGenericClientLabel(nested)) return toTitleCase(nested)!;

    // 3) fallback
    if (digits) return `+${digits}`;
    const short = safeStr(clientId || userId || chat.chatId || chat.id || "").slice(0, 8) || "—";
    return `Cliente ${short}…`;
  }

  // 4) filtro (usa nameAuthority)
  useEffect(() => {
    const term = safeLower(searchTerm).trim();
    const phoneDigits = onlyDigits(phoneTerm.trim());
    const nameAuthority = nameAuthorityRef.current;

    const filtered = (sortedChats ?? [])
      .map((ch: any) => ({ ...ch, __displayName: resolveDisplayName(ch, nameAuthority) }))
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedChats, searchTerm, phoneTerm]);

  useEffect(() => { setVisibleCount(DEFAULT_PAGE_SIZE); }, [searchTerm, phoneTerm]);

  const displayedChats = useMemo(
    () => filteredChats.slice(0, Math.min(visibleCount, filteredChats.length)),
    [filteredChats, visibleCount]
  );

  // ===== Listener de persistencia forzada (chat.name.force) =====
  useEffect(() => {
    function onForce(e: any) {
      const d = e?.detail || {};
      const name = (d.name || "").trim();
      if (!name) return;

      const digits = onlyDigits(d.phone || "");
      const keys = authorityKeysForNames(safeStr(d.clientId), safeStr(d.userId), digits);
      if (keys.length === 0) return;

      // 1) actualizar authority y persistir
      const map = { ...(nameAuthorityRef.current || {}) };
      let changed = false;
      for (const k of keys) {
        if (map[k] !== name) { map[k] = name; changed = true; }
      }
      if (changed) {
        nameAuthorityRef.current = map;
        saveNameAuthority(map);
        setFilteredChats(prev => prev.map(x => ({ ...x }))); // re-render
      }

      // 2) parchear duplicados del mismo cliente si podemos (BOT/HUMAN)
      try {
        const gkey = d.clientId || d.userId || (digits ? `tel:${digits}` : "");
        if (!gkey) return;
        const matches = (normNoGhosts || []).filter(ch => canonicalClientKey(ch) === gkey);
        for (const c of matches) {
          const chid = c?.chatId || c?.id;
          if (chid) patchChatClientName(String(chid), name, d.token).catch(() => {});
        }
      } catch {}
    }
    window.addEventListener("chat.name.force", onForce as any);
    return () => window.removeEventListener("chat.name.force", onForce as any);
  }, [normNoGhosts]);

  // ===== mantener scroll/selección =====
  const prevListRef = useRef<any[]>(displayedChats);
  const prevScrollHRef = useRef<number>(0);
  useLayoutEffect(() => {
    const vp = scrollViewportRef.current;
    if (vp) prevScrollHRef.current = vp.scrollHeight;
  }, [displayedChats]);
  useLayoutEffect(() => {
    const vp = scrollViewportRef.current;
    if (!vp) return;
    const prevFirst = prevListRef.current[0]?.chatId;
    const currFirst = displayedChats[0]?.chatId;
    const prevFirstStillInside = prevFirst && (displayedChats as any[]).some((c) => c.chatId === prevFirst);
    const isPrepend = prevFirst && currFirst && prevFirst !== currFirst && prevFirstStillInside;
    if (isPrepend) {
      const prevBehavior = (vp as any).style?.scrollBehavior;
      (vp as any).style.scrollBehavior = "auto";
      const delta = vp.scrollHeight - prevScrollHRef.current;
      if (delta > 0) vp.scrollTop += delta;
      (vp as any).style.scrollBehavior = prevBehavior || "";
    }
    prevListRef.current = displayedChats;
  }, [displayedChats]);

  useEffect(() => {
    if (!selectedChatId) return;
    const el = itemRefs.current[selectedChatId];
    if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedChatId]);

  const setItemRef = useCallback((chatId: string) => (el: HTMLDivElement | null) => {
    itemRefs.current[chatId] = el;
  }, []);

  const toggleExpand = (id: string) => setExpandedId((prev) => (prev === id ? null : id));
  const openWA = (phone?: string) => { const d = onlyDigits(phone ?? ""); if (d) window.open(`https://wa.me/${d}`, "_blank", "noopener,noreferrer"); };
  const callTel = (phone?: string) => { const d = onlyDigits(phone ?? ""); if (d) window.location.href = `tel:+${d}`; };

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
          {onNewChat && (
            <Button size="sm" onClick={onNewChat} className="bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 shadow-md">
              Nuevo Chat
            </Button>
          )}
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
            {(!hadDataRef.current && isLoading) ? (
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

                    const displayName = chat.__displayName || resolveDisplayName(chat, nameAuthorityRef.current || {});
                    interface ChatListItemProps {
                      chat: any;
                      cid: string;
                      isExpanded: boolean;
                      phone?: string;
                      displayName: string;
                    }

                    const getInitials = (displayName: string): string => {
                      return displayName.trim()
                        ? (displayName.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "U")
                        : "U";
                    };

                    const initials: string = getInitials(displayName);

                    const lastMessageText =
                      safeStr(
                        typeof chat.lastMessage === "object"
                          ? chat.lastMessage?.content ?? chat.lastMessage?.text ?? ""
                          : chat.lastMessage
                      ) || "—";

                    const showBotIcon = /(^hola\b)|(^¡hola\b)|bienvenido|asistente|bot/i.test(lastMessageText || "");

                    return (
                      <div
                        key={cid}
                        ref={setItemRef(cid)}
                        onDoubleClick={() => setExpandedId(prev => prev === cid ? null : cid)}
                        className={cn(
                          "group relative transition-colors duration-200",
                          isExpanded ? "bg-white" : "hover:bg-gradient-to-r hover:from-slate-50 hover:to-blue-50"
                        )}
                      >
                        <div
                          className={cn(
                            "flex items-start p-4 cursor-pointer",
                            selectedChatId === cid && "bg-gradient-to-r from-sky-50 to-blue-50 border-r-4 border-sky-500 shadow-sm"
                          )}
                          onClick={() => {
                            onChatSelect(cid);
                            const gkey = canonicalClientKey(chat);
                            recordAuthority(gkey, cid);
                            // si ya tenemos un nombre “aceptable”, lo guardamos como authority
                            const n = (displayName || "").trim();
                            if (n) {
                              const dig = onlyDigits(phone || "");
                              const keys = authorityKeysForNames(safeStr(chat?.clientId), safeStr(chat?.userId), dig);
                              if (keys.length) {
                                const map = { ...(nameAuthorityRef.current || {}) };
                                let changed = false;
                                for (const k of keys) { if (map[k] !== n) { map[k] = n; changed = true; } }
                                if (changed) {
                                  nameAuthorityRef.current = map;
                                  saveNameAuthority(map);
                                }
                              }
                            }
                          }}
                        >
                          {/* Avatar */}
                          <div className="relative mr-4 mt-0.5 shrink-0">
                            <Avatar className={cn("h-14 w-14 shadow-sm", selectedChatId === cid && "ring-2 ring-sky-200")}>
                              {chat.avatar ? <AvatarImage src={chat.avatar} alt={displayName} /> : null}
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
                                <h4 className="font-bold text-gray-800 truncate text-lg">{displayName}</h4>
                                {chat.channel === "ECOM" && (
                                  <Badge className="shrink-0 bg-green-100 text-green-700 border border-green-200">
                                    E-commerce
                                  </Badge>
                                )}
                              </div>

                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 opacity-70 hover:opacity-100 shrink-0"
                                onClick={(e) => { e.stopPropagation(); setExpandedId(prev => prev === cid ? null : cid); }}
                                title={isExpanded ? "Contraer" : "Expandir"}
                              >
                                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </Button>
                            </div>

                            {/* Teléfono + estado */}
                            <div className="flex items-center justify-between mt-0.5">
                              <div className="flex items-center gap-2">
                                {phone && <span className="text-xs text-gray-500 font-mono">+{onlyDigits(phone)}</span>}
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
                            <div className={cn("mt-1 text-sm text-gray-700", isExpanded ? "whitespace-normal break-words" : "truncate max-w-[260px]")}>
                              {showBotIcon && <Bot className="inline h-3 w-3 mr-1 text-purple-500" />}
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
                                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); openWA(phone); }}>
                                    <MessageSquareText className="h-4 w-4" />
                                    <span className="ml-1 text-xs">WhatsApp</span>
                                  </Button>
                                )}
                                {phone && (
                                  <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); callTel(phone); }}>
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
