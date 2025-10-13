// src/components/chat/ClientChat.tsx
"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useSocket } from "@/hooks/use-socket";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChatMessage as ChatBubble } from "./chat-message";
import { TypingIndicator } from "./typing-indicator";
import { RatingDialog } from "./rating-dialog";
import { useToast } from "@/hooks/use-toast";
import { MessageCircle, Send, User, LogOut, Loader2, Headphones } from "lucide-react";
import { ensureAssignmentForChat, listAvailableOperators } from "@/components/helpers/helper.assign";
import { useAssignBridge } from "@/hooks/use-assign-bridge";

type Sender = "CLIENT" | "BOT" | "OPERADOR" | "SYSTEM";
type MsgType = "TEXT" | "IMAGE";

interface Message {
  id: string;
  content: string;
  sender: Sender;
  timestamp: Date;
  chatId: string;
  senderName?: string;
  type: MsgType;
  imageUrl?: string;
}

interface ChatState {
  id: string | null;
  status: "disconnected" | "active" | "with-specialist" | "finished" | "in-queue";
  operatorName?: string;
  operatorId?: string;
}

type OperatorItem = {
  id: string;
  name?: string;
  email?: string;
  isAvailable?: boolean;
  activeChats?: number;
};

const uuid = () =>
  (typeof crypto !== "undefined" && (crypto as any).randomUUID)
    ? (crypto as any).randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

const pickChatId = (p: any) =>
  String(p?.chatId ?? p?.chatID ?? p?.chat_id ?? p?.chat ?? p?.roomId ?? "").trim();

export function ClientChat() {
  const { user, logout, token: rawToken } = useAuth();
  const authToken: string | undefined = rawToken ?? undefined;
  const { toast } = useToast();

  const [messages, setMessages] = useState<Message[]>([]);
  const [chatState, setChatState] = useState<ChatState>({ id: null, status: "disconnected" });
  const [isTyping, setIsTyping] = useState(false);
  const [botThinking, setBotThinking] = useState(false);
  const [inputMessage, setInputMessage] = useState("");

  const [assignOpen, setAssignOpen] = useState(false);
  const [operators, setOperators] = useState<OperatorItem[]>([]);
  const [selectedOpId, setSelectedOpId] = useState<string>("");
  const [assignLoading, setAssignLoading] = useState(false);

  const [showRatingDialog, setShowRatingDialog] = useState(false);
  const [finishedChatData, setFinishedChatData] = useState<{ chatId: string; operatorId: string } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const askedAssignRef = useRef(false);

  // 👇 ID canónico (si el back usa un ID distinto para el operador)
  const canonicalChatIdRef = useRef<string | null>(null);
  const setCanonicalId = (id?: string | null) => {
    if (id && id !== canonicalChatIdRef.current) {
      canonicalChatIdRef.current = id;
      try { localStorage.setItem("client-chat-canonical", id); } catch {}
    }
  };

  const { socket, isConnected } = useSocket({
    userRole: "CLIENT",
    serverUrl: process.env.NEXT_PUBLIC_WS_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002",
  });

  // 🧩 bridge para adjuntar meta y (opcional) anunciar
  const { buildMeta, announce } = useAssignBridge(socket);

  const baseApi = useMemo(
    () => process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3002",
    []
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Rehidratar chatId y canónico
  useEffect(() => {
    const stored = localStorage.getItem("client-chat-id");
    const storedCanonical = localStorage.getItem("client-chat-canonical");
    if (stored && !chatState.id) setChatState({ id: stored, status: "active" });
    if (storedCanonical) setCanonicalId(storedCanonical);
  }, [chatState.id]);

  // Logs de conexión
  useEffect(() => {
    if (!socket) return;
    const onConnect = () => console.log("[CLIENT WS] conectado", socket.id);
    const onDisconnect = (r: any) => console.log("[CLIENT WS] desconectado", r);
    const onError = (e: any) => console.warn("[CLIENT WS] error", e);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onError);
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onError);
    };
  }, [socket]);

  // Join rooms: ID local y canónico (si difieren)
  useEffect(() => {
    if (!socket || !isConnected) return;
    const ids = new Set<string>();
    if (chatState.id) ids.add(chatState.id);
    if (canonicalChatIdRef.current) ids.add(canonicalChatIdRef.current);

    ids.forEach((id) => {
      socket.emit("joinChat", { chatId: id, as: "CLIENT", userId: user?.id });
    });
  }, [socket, isConnected, chatState.id, user?.id]);

  // Historial por HTTP → intentar con el canónico primero
  useEffect(() => {
    const idForHistory = canonicalChatIdRef.current || chatState.id;
    if (!idForHistory || messages.length > 0) return;

    fetch(`${baseApi}/chat/${idForHistory}/messages`)
      .then((r) => r.json())
      .then((data) => {
        const history: Message[] = (Array.isArray(data) ? data : []).map((m: any) => ({
          id: m._id || `${idForHistory}-${m.timestamp || Date.now()}`,
          content: m.content ?? m.text ?? m.body ?? m.message ?? "",
          sender: (m.senderType || "SYSTEM") as Sender,
          timestamp: new Date(m.timestamp || m.createdAt || Date.now()),
          chatId: m.chatId || idForHistory,
          senderName:
            m.senderName ||
            (m.senderType === "BOT"
              ? "Depilbot"
              : m.senderType === "OPERADOR"
              ? "Especialista"
              : m.senderType === "CLIENT"
              ? "Tú"
              : "Sistema"),
          type: (m.type || "TEXT") as MsgType,
          imageUrl: m.imageUrl || undefined,
        }));
        setMessages(history);
      })
      .catch((err) => console.error("❌ [CLIENT] Error al cargar historial:", err));
  }, [chatState.id, messages.length, baseApi]);

  // Abrir selector de operador (ordenado por menor carga)
  const openAssignSelector = useCallback(async () => {
    if (!chatState.id && !canonicalChatIdRef.current) {
      toast({ title: "No hay chat", description: "Iniciá el chat antes de pedir operador.", variant: "destructive" });
      return;
    }
    try {
      const list = await listAvailableOperators(authToken);
      const onlyAvail = (Array.isArray(list) ? list : []).filter((o: any) => o?.isAvailable !== false);
      onlyAvail.sort((a: any, b: any) => (a?.activeChats ?? 0) - (b?.activeChats ?? 0));
      setOperators(onlyAvail as OperatorItem[]);
      if (onlyAvail.length > 0) setSelectedOpId(String(onlyAvail[0].id));
      setAssignOpen(true);
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "No se pudo obtener operadores.", variant: "destructive" });
    }
  }, [chatState.id, authToken, toast]);

  // Confirmar asignación → asegura `chatId` (canónico si existe)
  const confirmAssign = useCallback(async () => {
    const targetChatId = canonicalChatIdRef.current || chatState.id;
    if (!targetChatId) return;

    const clientId = String(user?.id ?? (user as any)?._id ?? (user as any)?.userId ?? "");
    if (!clientId) {
      toast({ title: "Error", description: "clientId inválido.", variant: "destructive" });
      return;
    }
    if (!selectedOpId) {
      toast({ title: "Elegí un operador", description: "Seleccioná un operador de la lista.", variant: "destructive" });
      return;
    }
    try {
      setAssignLoading(true);
      const res = await ensureAssignmentForChat(targetChatId, authToken, clientId, selectedOpId);
      if (!res.ok) throw new Error((res as any)?.message || "Asignación rechazada");

      const chosen = operators.find((o) => String(o.id) === String(selectedOpId));
      setAssignOpen(false);
      askedAssignRef.current = true;
      setChatState((s) => ({ ...s, status: "with-specialist", operatorId: String(selectedOpId), operatorName: chosen?.name }));
      toast({ title: "Operador asignado", description: chosen?.name ? `Te atiende ${chosen.name}.` : "Asignación exitosa." });

      // (opcional) comunica el canónico
      announce(targetChatId, clientId, (user as any)?.name);
    } catch (e: any) {
      toast({ title: "No se pudo asignar", description: e?.message, variant: "destructive" });
    } finally {
      setAssignLoading(false);
    }
  }, [chatState.id, authToken, selectedOpId, operators, user?.id, toast, announce]);

  // Listeners WS
  useEffect(() => {
    if (!socket) return;

    const onChatCreated = (data: any) => {
      const newId = pickChatId(data) || data.id;
      setMessages([]);
      setChatState({ id: newId, status: "active" });
      localStorage.setItem("client-chat-id", newId);
      setCanonicalId(newId);                // 👈 canónico = el del cliente inicialmente
      announce(newId, user?.id, (user as any)?.name); // 👈 lo anunciamos por si el back lo reenvía
      socket.emit("joinChat", { chatId: newId, as: "CLIENT", userId: user?.id });
    };

    const onNewMessage = (msg: any) => {
      const idFromMsg = pickChatId(msg) || msg.chatId;
      const accepted =
        idFromMsg &&
        (idFromMsg === (canonicalChatIdRef.current || chatState.id) ||
         idFromMsg === chatState.id);

      if (!accepted) return;

      setMessages((prev) => [
        ...prev,
        {
          id: msg.id || `${idFromMsg}-${Date.now()}`,
          content: msg.content ?? msg.text ?? msg.body ?? msg.message ?? "",
          sender: (msg.senderType || "SYSTEM") as Sender,
          timestamp: new Date(msg.timestamp || Date.now()),
          chatId: idFromMsg,
          senderName: msg.senderName || "Sistema",
          type: (msg.type || "TEXT") as MsgType,
          imageUrl: msg.imageUrl || undefined,
        },
      ]);
      setBotThinking(false);
    };

    const onBotThinking = () => setBotThinking(true);

    const onChatFinished = (d: any) => {
      const id = pickChatId(d) || d.chatId;
      const canonical = canonicalChatIdRef.current || chatState.id;
      if (id && canonical && (id === canonical || id === chatState.id)) {
        setChatState((s) => ({ ...s, status: "finished" }));
        setFinishedChatData({ chatId: id, operatorId: d.operatorId });
        setTimeout(() => setShowRatingDialog(true), 800);
      }
    };

    const onSpecialistAssigned = (d: any) => {
      const operatorId =
        d.operatorId || d.specialistId || d.assignedTo || d.operator?._id || d.operator?.id;
      const operatorName =
        d.operatorName || d.specialistName || d.operator?.name || d.name;

      const opChatId = pickChatId(d) || d.chatId;
      if (opChatId && opChatId !== canonicalChatIdRef.current) {
        setCanonicalId(opChatId);
        socket.emit("joinChat", { chatId: opChatId, as: "CLIENT", userId: user?.id });
      }
      setChatState((s) => ({ ...s, status: "with-specialist", operatorId, operatorName }));
    };

    const messageEvents = ["newMessage", "message", "clientMessage", "messageCreated"];
    messageEvents.forEach((evt) => socket.on(evt, onNewMessage));

    socket.on("chatCreated", onChatCreated);
    socket.on("botThinking", onBotThinking);
    socket.on("chatFinished", onChatFinished);
    socket.on("specialistAssigned", onSpecialistAssigned);
    socket.on("operatorAssigned", onSpecialistAssigned);

    return () => {
      messageEvents.forEach((evt) => socket.off(evt, onNewMessage));
      socket.off("chatCreated", onChatCreated);
      socket.off("botThinking", onBotThinking);
      socket.off("chatFinished", onChatFinished);
      socket.off("specialistAssigned", onSpecialistAssigned);
      socket.off("operatorAssigned", onSpecialistAssigned);
    };
  }, [socket, user?.id, chatState.id, isConnected, announce]);

  // Crear chat
  const handleCreateChat = () => {
    if (!socket || !isConnected) {
      toast({ title: "Error", description: "No se pudo conectar al servidor", variant: "destructive" });
      return;
    }
    askedAssignRef.current = false;
    localStorage.removeItem("client-chat-id");
    localStorage.removeItem("client-chat-canonical");
    canonicalChatIdRef.current = null;
    setMessages([]);
    socket.emit("createChat");
  };

  // Enviar mensaje → **incluye meta.canonicalChatId**
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const targetChatId = canonicalChatIdRef.current || chatState.id;
    if (!inputMessage.trim() || !socket || !targetChatId) return;

    const clientMessageId = uuid();
    const text = inputMessage.trim();

    const clientId = String(user?.id ?? (user as any)?._id ?? (user as any)?.userId ?? "");
    const clientName = (user as any)?.name || user?.email?.split("@")[0] || "Cliente";
    const { meta } = buildMeta(targetChatId, clientId, clientName); // 👈 aquí

    setInputMessage("");

    if (chatState.status !== "with-specialist" && !askedAssignRef.current) {
      openAssignSelector().catch(() => {});
    }

    socket.timeout(5000).emit("sendMessage", {
      chatId: targetChatId,
      type: "TEXT",
      content: text,
      clientMessageId,
      senderType: "CLIENT" as const,
      userId: clientId,
      clientId,
      senderName: clientName,
      timestamp: Date.now(),
      meta, // 👈 viaja pegado al mensaje
    });
  };

  const badge = {
    finished: <Badge variant="secondary">✅ Finalizado</Badge>,
    "with-specialist": <Badge>🎧 Con Especialista</Badge>,
    active: <Badge>🟢 Activo</Badge>,
    "in-queue": <Badge variant="outline">⏳ En Cola</Badge>,
    disconnected: <Badge variant="destructive">🔴 Desconectado</Badge>,
  }[chatState.status];
  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <div className="bg-white border-b p-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Avatar><AvatarFallback><User className="h-4 w-4" /></AvatarFallback></Avatar>
          <div>
            <h1 className="font-semibold">Chat Cliente</h1>
            <p className="text-sm text-gray-500">{user?.email}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {badge}
          {chatState.id && chatState.status !== "with-specialist" && chatState.status !== "finished" && (
            <Button variant="default" size="sm" onClick={openAssignSelector}>
              <Headphones className="h-4 w-4 mr-2" /> Pedir operador
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              logout();
              localStorage.removeItem("client-chat-id");
              localStorage.removeItem("client-chat-canonical");
              canonicalChatIdRef.current = null;
            }}
          >
            <LogOut className="h-4 w-4 mr-2" /> Salir
          </Button>
        </div>
      </div>

      {/* Selector de operador */}
      {assignOpen && (
        <div className="bg-white border-b p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="font-medium">Seleccioná un operador:</div>
            <select
              className="border rounded px-2 py-1 min-w-[260px]"
              value={selectedOpId}
              onChange={(e) => setSelectedOpId(e.target.value)}
              disabled={assignLoading}
            >
              <option value="">— Elegir —</option>
              {operators.map((op) => (
                <option key={String(op.id)} value={String(op.id)}>
                  {(op.name || op.email || op.id) + (typeof op.activeChats === "number" ? ` — ${op.activeChats} chats` : "")}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <Button size="sm" onClick={confirmAssign} disabled={assignLoading || !selectedOpId}>
                {assignLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Confirmar
              </Button>
              <Button size="sm" variant="outline" onClick={() => setAssignOpen(false)} disabled={assignLoading}>
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col">
        {!chatState.id ? (
          <div className="flex-1 flex items-center justify-center">
            <Card className="w-full max-w-md mx-4">
              <CardHeader className="text-center">
                <MessageCircle className="h-12 w-12 mx-auto mb-4 text-blue-600" />
                <CardTitle>¡Bienvenido al Chat!</CardTitle>
                <p className="text-gray-600">Inicia una conversación con nuestro asistente</p>
              </CardHeader>
              <CardContent>
                <Button onClick={handleCreateChat} disabled={!isConnected} className="w-full" size="lg">
                  {!isConnected ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Conectando...
                    </>
                  ) : (
                    <>
                      <MessageCircle className="mr-2 h-4 w-4" /> Iniciar Chat
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map((m) => (
                  <ChatBubble key={m.id} message={m} currentUserId={user?.id} />
                ))}
                {botThinking && <TypingIndicator name="Depilbot" />}
                {isTyping && <TypingIndicator name="Especialista" />}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <div className="bg-white border-t p-4">
              <form onSubmit={handleSendMessage} className="flex space-x-2">
                <Input
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Escribe tu mensaje..."
                  disabled={!isConnected || chatState.status === "finished"}
                  className="flex-1"
                />
                <Button type="submit" disabled={!isConnected || !inputMessage.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </>
        )}
      </div>

      {showRatingDialog && finishedChatData && (
        <RatingDialog
          isOpen={showRatingDialog}
          chatId={finishedChatData.chatId}
          operatorId={finishedChatData.operatorId}
          onSubmit={(d) => socket?.emit("rateChat", { ...d, clientId: user?.id })}
          onClose={() => setShowRatingDialog(false)}
        />
      )}
    </div>
  );
}
