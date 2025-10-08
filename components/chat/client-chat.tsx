"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useSocket } from "@/hooks/use-socket";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChatMessage } from "./chat-message";
import { TypingIndicator } from "./typing-indicator";
import { RatingDialog } from "./rating-dialog";
import { useToast } from "@/hooks/use-toast";
import { MessageCircle, Send, User, LogOut, Loader2, Headphones } from "lucide-react";

// 👇 Se apoya en el helper actualizado
import { requestOperatorForChat } from "@/components/helpers/helper.assign";

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

const uuid = () =>
  (typeof crypto !== "undefined" && (crypto as any).randomUUID)
    ? (crypto as any).randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

export function ClientChat() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatState, setChatState] = useState<ChatState>({ id: null, status: "disconnected" });
  const [isTyping, setIsTyping] = useState(false);
  const [botThinking, setBotThinking] = useState(false);
  const [inputMessage, setInputMessage] = useState("");
  const [showRatingDialog, setShowRatingDialog] = useState(false);
  const [finishedChatData, setFinishedChatData] = useState<{ chatId: string; operatorId: string } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { socket, isConnected } = useSocket({
    userRole: "CLIENT",
    serverUrl: process.env.NEXT_PUBLIC_WS_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002",
  });

  const askedAssignRef = useRef(false);

  const baseApi = useMemo(
    () => process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3002",
    []
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const stored = localStorage.getItem("client-chat-id");
    if (stored && !chatState.id) setChatState({ id: stored, status: "active" });
  }, [chatState.id]);

  // Cargar historial al tener chatId
  useEffect(() => {
    if (!chatState.id || messages.length > 0) return;
    fetch(`${baseApi}/chat/${chatState.id}/messages`)
      .then((r) => r.json())
      .then((data) => {
        const history: Message[] = (Array.isArray(data) ? data : []).map((m: any) => ({
          id: m._id || `${chatState.id}-${m.timestamp || Date.now()}`,
          content: m.content,
          sender: (m.senderType || "SYSTEM") as Sender,
          timestamp: new Date(m.timestamp || m.createdAt || Date.now()),
          chatId: m.chatId,
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

  // === Pedido explícito de asignación ===
  const requestAssignment = async () => {
    if (!chatState.id || askedAssignRef.current) return;
    askedAssignRef.current = true;
    try {
      const res = await requestOperatorForChat(chatState.id);
      if ((res as any)?.ok) {
        toast({ title: "Buscando operador…", description: "Enseguida te asignamos uno." });
      } else {
        askedAssignRef.current = false;
        toast({
          title: "No se pudo asignar",
          description: (res as any)?.message || "Probá nuevamente en breve.",
          variant: "destructive",
        });
      }
    } catch (e: any) {
      askedAssignRef.current = false;
      toast({
        title: "Error solicitando operador",
        description: e?.message || "Reintentá en unos segundos.",
        variant: "destructive",
      });
    }
  };

  // Listeners WS
  useEffect(() => {
    if (!socket) return;

    const onChatCreated = (data: any) => {
      setMessages([]);
      setChatState({ id: data.id, status: "active" });
      localStorage.setItem("client-chat-id", data.id);
      socket.emit("joinChat", { chatId: data.id });
      toast({ title: "Chat iniciado", description: "¡Tu chat con la IA ha comenzado!" });
      // Pedimos operador al crear el chat
      requestAssignment().catch(() => {});
    };

    const onNewMessage = (msg: any) => {
      setMessages((prev) => [
        ...prev,
        {
          id: msg.id || `${msg.chatId}-${Date.now()}`,
          content: msg.content || "",
          sender: (msg.senderType || "SYSTEM") as Sender,
          timestamp: new Date(msg.timestamp || Date.now()),
          chatId: msg.chatId,
          senderName: msg.senderName || "Sistema",
          type: (msg.type || "TEXT") as MsgType,
          imageUrl: msg.imageUrl || undefined,
        },
      ]);
      setBotThinking(false);
    };

    const onBotThinking = () => setBotThinking(true);

    const onChatFinished = (d: any) => {
      setChatState((s) => ({ ...s, status: "finished" }));
      setFinishedChatData({ chatId: d.chatId, operatorId: d.operatorId });
      setTimeout(() => setShowRatingDialog(true), 800);
    };

    // Normalizamos payload de asignación
    const onSpecialistAssigned = (d: any) => {
      const operatorId = d.operatorId || d.specialistId || d.assignedTo || d.operator?._id || d.operator?.id;
      const operatorName =
        d.operatorName || d.specialistName || d.operator?.name || d.name || `Operador ${String(operatorId || "").slice(0,6)}…`;
      setChatState((s) => ({ ...s, status: "with-specialist", operatorName, operatorId }));
      toast({ title: "Operador asignado", description: operatorName ? `Te atiende ${operatorName}.` : "Ya te atiende un operador." });
    };

    // Alias común en algunos backends
    const onOperatorAssigned = onSpecialistAssigned;

    const onError = (err: any) => {
      console.error("❌ [CLIENT] WS Error:", err);
      toast({
        title: "Error",
        description: err?.message || "Ocurrió un error en el chat",
        variant: "destructive",
      });
    };

    socket.on("chatCreated", onChatCreated);
    socket.on("newMessage", onNewMessage);
    socket.on("botThinking", onBotThinking);
    socket.on("chatFinished", onChatFinished);
    socket.on("specialistAssigned", onSpecialistAssigned);
    socket.on("operatorAssigned", onOperatorAssigned);
    socket.on("error", onError);

    return () => {
      socket.off("chatCreated", onChatCreated);
      socket.off("newMessage", onNewMessage);
      socket.off("botThinking", onBotThinking);
      socket.off("chatFinished", onChatFinished);
      socket.off("specialistAssigned", onSpecialistAssigned);
      socket.off("operatorAssigned", onOperatorAssigned);
      socket.off("error", onError);
    };
  }, [socket, toast]);

  // Acciones
  const handleCreateChat = () => {
    if (!socket || !isConnected) {
      toast({ title: "Error", description: "No se pudo conectar al servidor", variant: "destructive" });
      return;
    }
    askedAssignRef.current = false;
    localStorage.removeItem("client-chat-id");
    setMessages([]);
    socket.emit("createChat");
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !socket || !chatState.id) return;

    const clientMessageId = uuid();
    const payload = {
      chatId: chatState.id,
      type: "TEXT",
      content: inputMessage.trim(),
      clientMessageId,
    };

    setInputMessage("");

    // Si aún no hay operador, reintentar asignación en segundo plano
    if (chatState.status !== "with-specialist" && !askedAssignRef.current) {
      requestAssignment().catch(() => {});
    }

    socket
      .timeout(5000)
      .emit("sendMessage", payload, (res: any) => {
        if (!res || !res.ok) {
          console.error("❌ WS ACK sendMessage:", res?.error || "sin respuesta");
        }
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
            <Button variant="default" size="sm" onClick={requestAssignment}>
              <Headphones className="h-4 w-4 mr-2" /> Pedir operador
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => { logout(); localStorage.removeItem("client-chat-id"); }}>
            <LogOut className="h-4 w-4 mr-2" /> Salir
          </Button>
        </div>
      </div>

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
                  {!isConnected ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Conectando...</>) : (<><MessageCircle className="mr-2 h-4 w-4" /> Iniciar Chat</>)}
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map((m) => <ChatMessage key={m.id} message={m} currentUserId={user?.id} />)}
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
