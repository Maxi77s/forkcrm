"use client";

import type React from "react";
import { useState, useRef, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChatMessage } from "./chat-message";
import {
  Send,
  Paperclip,
  Smile,
  Phone,
  Video,
  CheckCircle,
  Clock,
  User,
  Bot as BotIcon,
  MessageSquareText,
  Headphones,
} from "lucide-react";
import type { Message as ChatMsgFromTypes, ChatInfo } from "@/types/chats";
import { forcePersistClientName } from "@/components/helpers/helper.assign";
import { getChatDisplayName, setCachedDisplayName } from "@/lib/display-name";

/** Sin "OPTIONS"; además filtramos SYSTEM para no mostrar joins automáticos del back */
type DisplayMessage = Omit<ChatMsgFromTypes, "type"> & { type: "TEXT" | "IMAGE" };

interface ChatInterfaceProps {
  chatInfo: ChatInfo | null;
  messages: ChatMsgFromTypes[];
  isTyping: boolean;
  onSendMessage: (message: string) => void;
  onFinishChat: () => void;
  onStartTyping?: () => void;
  onStopTyping?: () => void;
  onTransferChat?: () => void;
  isConnected: boolean;

  mode?: "BOT" | "AI" | "HUMAN";
  botThinking?: boolean;
  onTakeOver?: () => void;
  onRelease?: () => void;

  /** opcional: para el banner del takeover */
  operatorDisplayName?: string;
}

function ModePill({ mode, thinking }: { mode?: "BOT" | "AI" | "HUMAN"; thinking?: boolean }) {
  if (!mode) return null;
  const label = mode === "HUMAN" ? "Humano" : mode === "AI" ? "IA" : "Bot";
  const classes =
    mode === "HUMAN"
      ? "bg-emerald-600/20 text-emerald-300 border border-emerald-500/30"
      : mode === "AI"
      ? "bg-purple-600/20 text-purple-200 border border-purple-500/30"
      : "bg-indigo-600/20 text-indigo-200 border border-indigo-500/30";
  return (
    <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-md text-xs font-semibold ${classes}`}>
      {label}
      {thinking ? <span className="inline-block h-1.5 w-1.5 rounded-full bg-current animate-pulse" /> : null}
    </span>
  );
}

export function ChatInterface({
  chatInfo,
  messages,
  isTyping,
  onSendMessage,
  onFinishChat,
  onStartTyping,
  onStopTyping,
  onTransferChat, // eslint-disable-line @typescript-eslint/no-unused-vars
  isConnected,
  mode,
  botThinking,
  onTakeOver,
  onRelease,
  operatorDisplayName,
}: ChatInterfaceProps) {
  const [inputMessage, setInputMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  // Sembrar caché + diccionario al abrir/cambiar chat
  useEffect(() => {
    if (!chatInfo) return;
    const finalName = getChatDisplayName(chatInfo as any);
    if (finalName && !/^\+?[\d\-\s\(\)]{6,}$/.test(finalName)) {
      setCachedDisplayName(chatInfo, finalName);
      const clientId =
        (chatInfo as any)?.clientId?._id ??
        (chatInfo as any)?.clientId ??
        (chatInfo as any)?.userId ??
        undefined;

      const phone =
        (chatInfo as any)?.phone ??
        (chatInfo as any)?.client?.phone ??
        (chatInfo as any)?.metadata?.phone ??
        (chatInfo as any)?.meta?.phone ??
        undefined;

      forcePersistClientName({
        name: finalName,
        clientId: clientId ? String(clientId) : undefined,
        phone: phone ? String(phone) : undefined,
        chatId: (chatInfo as any)?.id || (chatInfo as any)?.chatId || (chatInfo as any)?._id,
      });
    }
  }, [chatInfo]);

  const displayMessages: DisplayMessage[] = useMemo(() => {
    const base = messages
      .filter((m) => m.type !== "OPTIONS" && m.type !== "SYSTEM") // <-- ignorar joins automáticos
      .map((m) => ({ ...(m as any), type: m.type as "TEXT" | "IMAGE" }));
    return base.sort((a, b) => {
      const ta = new Date(a.timestamp as any).getTime();
      const tb = new Date(b.timestamp as any).getTime();
      return ta - tb;
    });
  }, [messages]);

  const lastClientMessage = useMemo(
    () => [...displayMessages].reverse().find((m) => m.sender === "CLIENT" && m.type === "TEXT"),
    [displayMessages],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputMessage(value);
    if (value && onStartTyping) onStartTyping();
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      if (onStopTyping) onStopTyping();
    }, 1000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputMessage.trim() && isConnected) {
      onSendMessage(inputMessage.trim());
      setInputMessage("");
      if (onStopTyping) onStopTyping();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    }
  };

  const handleQuickReply = (text: string) => onSendMessage(text);

  const formatLastSeen = (date?: Date) => {
    if (!date) return "Nunca visto";
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    if (minutes < 1) return "Activo ahora";
    if (minutes < 60) return `Visto hace ${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Visto hace ${hours}h`;
    const days = Math.floor(hours / 24);
    return `Visto hace ${days}d`;
  };

  const headerName = useMemo(() => {
    if (!chatInfo) return "Cliente";
    return getChatDisplayName(chatInfo as any);
  }, [chatInfo]);

  // -------- Banner de takeover SOLO cuando cambia a HUMANO --------
  const prevModeRef = useRef<typeof mode | null>(null);
  const [showTakeoverBanner, setShowTakeoverBanner] = useState(false);
  useEffect(() => {
    const prev = prevModeRef.current;
    if (prev !== "HUMAN" && mode === "HUMAN") {
      setShowTakeoverBanner(true);
      const t = setTimeout(() => setShowTakeoverBanner(false), 6000);
      return () => clearTimeout(t);
    }
    prevModeRef.current = mode ?? null;
  }, [mode]);

  const takeoverText =
    `${operatorDisplayName || "Un operador"} se ha unido al chat. ` +
    `La IA ya no responderá automáticamente.`;

  if (!chatInfo) {
    return (
      <Card className="h-full flex items-center justify-center border-0 rounded-none bg-gradient-to-br from-slate-50 to-slate-100">
        <CardContent className="text-center">
          <div className="bg-white rounded-full p-6 shadow-lg mb-6">
            <Clock className="h-16 w-16 mx-auto text-sky-500" />
          </div>
          <h3 className="text-2xl font-bold text-gray-800 mb-2">Selecciona un chat</h3>
          <p className="text-gray-600 max-w-md">Elige una conversación de la lista para comenzar a chatear con el cliente</p>
        </CardContent>
      </Card>
    );
  }

  const canTakeOver = mode && mode !== "HUMAN";
  const canRelease = mode === "HUMAN";

  return (
    <Card className="h-full flex flex-col border-0 rounded-none bg-white">
      {/* ======= CABECERA ======= */}
      <CardHeader className="border-b bg-[#0f172a] text-white pb-5">
        <div className="flex items-start gap-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 ring-2 ring-white/20">
              <AvatarFallback className="bg-slate-200 text-slate-700">
                <User className="h-5 w-5" />
              </AvatarFallback>
            </Avatar>
            <div className="leading-tight">
              <p className="font-semibold">{headerName}</p>
              <p className="text-xs text-slate-300">{formatLastSeen(chatInfo.lastSeen)}</p>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-md text-xs font-semibold bg-emerald-600/20 text-emerald-300 border border-emerald-500/30">
              <MessageSquareText className="h-3.5 w-3.5" />
              WHATSAPP INBOUND
            </span>
            <ModePill mode={mode} thinking={botThinking} />
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-white/15 bg-white/5 p-4">
          <div className="flex items-center justify-between">
            <p className="font-semibold">{headerName}:</p>
            <Avatar className="h-7 w-7 ring-2 ring-white/20">
              <AvatarFallback className="bg-slate-200 text-slate-700">
                <BotIcon className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
          </div>

          <p className="mt-1 text-sm text-slate-200">
            NRO. de contacto <span className="font-mono">{(chatInfo as any)?.phone ?? "—"}</span>
          </p>

          {lastClientMessage?.content && (
            <div className="mt-3">
              <div className="inline-block max-w-[640px] rounded-lg bg-white/10 px-3 py-2 text-sm text-slate-100">
                {lastClientMessage.content}
              </div>
            </div>
          )}

          {botThinking && (
            <div className="mt-3 text-xs text-slate-300">
              <span className="inline-flex items-center gap-2">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-200 animate-pulse" />
                La IA está redactando una respuesta…
              </span>
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center gap-2">
          <Button size="sm" variant="secondary" className="bg-white/10 text-white hover:bg-white/20">
            <Phone className="h-4 w-4 mr-2" />
            Llamar
          </Button>
          <Button size="sm" variant="secondary" className="bg-white/10 text-white hover:bg-white/20">
            <Video className="h-4 w-4 mr-2" />
            Video
          </Button>

          {canTakeOver && (
            <Button
              size="sm"
              variant="outline"
              onClick={onTakeOver}
              className="ml-auto text-amber-200 border-amber-400/40 hover:bg-amber-500/10 bg-transparent"
              title="Tomar control (pasar a HUMANO)"
            >
              Tomar control
            </Button>
          )}
          {canRelease && (
            <Button
              size="sm"
              variant="outline"
              onClick={onRelease}
              className="ml-auto text-indigo-200 border-indigo-400/40 hover:bg-indigo-500/10 bg-transparent"
              title="Liberar control (volver a BOT/IA)"
            >
              Liberar
            </Button>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={onFinishChat}
            className="text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/10 bg-transparent"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Finalizar
          </Button>
        </div>
      </CardHeader>

      {/* ======= MENSAJES ======= */}
      <ScrollArea className="flex-1 bg-gradient-to-b from-slate-50/50 to-white">
        <div className="p-6 space-y-1">
          {displayMessages.length === 0 && (
            <div className="text-center py-12">
              <div className="bg-white rounded-full p-4 shadow-lg mb-4 inline-block">
                <BotIcon className="h-8 w-8 text-purple-500" />
              </div>
              <h4 className="text-lg font-semibold text-gray-700 mb-2">¡Conversación iniciada!</h4>
              <p className="text-gray-500">Los mensajes aparecerán aquí</p>
            </div>
          )}

          {/* Banner de takeover local (solo cuando cambia a HUMANO) */}
          {showTakeoverBanner && (
            <div className="flex justify-center my-3">
              <div className="max-w-[680px] w-full text-center bg-slate-100 text-slate-700 rounded-lg px-4 py-2 text-sm shadow-sm border">
                <Headphones className="inline h-4 w-4 mr-2 align-text-top" />
                {takeoverText}
              </div>
            </div>
          )}

          {displayMessages.map((message) => (
            <ChatMessage key={message.id} message={message} currentUserId="OPERADOR" />
          ))}

          <div ref={messagesEndRef} id="chat-bottom-anchor" />
        </div>
      </ScrollArea>

      {/* ======= INPUT ======= */}
      <div className="border-t bg-white p-4">
        <form onSubmit={handleSubmit} className="flex items-center space-x-3">
          <Button type="button" size="icon" variant="ghost" disabled={!isConnected} className="hover:bg-slate-100">
            <Paperclip className="h-5 w-5" />
          </Button>

          <div className="flex-1 relative">
            <Input
              value={inputMessage}
              onChange={handleInputChange}
              placeholder={isConnected ? "Escribe un mensaje..." : "Desconectado..."}
              disabled={!isConnected || (chatInfo as any)?.status !== "ACTIVE"}
              className="pr-12 h-12 border-gray-300 focus:border-sky-500 focus:ring-sky-500 rounded-full shadow-sm"
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              disabled={!isConnected}
              className="absolute right-1 top-1 hover:bg-slate-100 rounded-full"
            >
              <Smile className="h-5 w-5" />
            </Button>
          </div>

          <Button
            type="submit"
            size="icon"
            disabled={!isConnected || !inputMessage.trim() || (chatInfo as any)?.status !== "ACTIVE"}
            className="bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 shadow-md h-12 w-12 rounded-full"
            title={mode && mode !== "HUMAN" ? "Enviar (hará takeover automático)" : "Enviar"}
          >
            <Send className="h-5 w-5" />
          </Button>
        </form>
      </div>
    </Card>
  );
}

export default ChatInterface;
