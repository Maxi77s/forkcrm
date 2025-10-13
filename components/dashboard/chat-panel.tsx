"use client";

import type React from "react";

import { useState, useEffect, useRef } from "react";
import { useSocket } from "@/components/providers/socket-provider";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ChatMessage } from "@/components/chat/chat-message";
import { TypingIndicator } from "@/components/chat/typing-indicator";
import { SaleConfirmationDialog } from "@/components/operator/sale-confirmation-dialog";
import { Send, X, DollarSign, User, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ChatModeStrip from "@/components/chatOperator/ChatModeStrip"; // NUEVO

// 🔧 Unificamos con el tipo que espera <ChatMessage />
type Sender = "CLIENT" | "OPERADOR" | "BOT" | "SYSTEM";

interface Message {
  id: string;
  content: string;
  sender: Sender;
  timestamp: Date;
  senderName?: string;
  type: "TEXT" | "IMAGE";
  imageUrl?: string;
  // para distinguir BOT clásico vs IA sin romper tipos
  meta?: { ai?: boolean };
}

interface ChatInfo {
  id: string;
  clientDni: number;
  status: string;
  createdAt: Date;
  operatorName?: string;
  type?: string; // "BOT" | "HUMAN" | "HUMAN_SUPPORT" (opcional)
}

interface ChatPanelProps {
  chatId: string;
  onChatFinished: () => void;
}

type Mode = "BOT" | "AI" | "HUMAN";

function computeModeFromMessages(msgs: Message[], fallbackType?: string): Mode {
  // buscamos el último mensaje no-SYSTEM
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    if (!m || m.sender === "SYSTEM") continue;
    if (m.sender === "OPERADOR") return "HUMAN";
    if (m.sender === "BOT") {
      if (m.meta?.ai) return "AI";
      return "BOT";
    }
    // CLIENT no define modo
  }
  const t = String(fallbackType || "").toUpperCase();
  if (t === "HUMAN" || t === "HUMAN_SUPPORT") return "HUMAN";
  if (t === "BOT") return "BOT";
  return "BOT";
}

export function ChatPanel({ chatId, onChatFinished }: ChatPanelProps) {
  const { socket } = useSocket();
  const { user } = useAuth();
  const { toast } = useToast();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState("");
  const [chatInfo, setChatInfo] = useState<ChatInfo | null>(null);
  const [showSaleDialog, setShowSaleDialog] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!socket || !chatId) return;

    socket.emit("joinChat", { chatId });
    socket.emit("getChatMessages", { chatId });

    socket.on("chatMessages", (data) => {
      const msgs: Message[] = (data.messages || []).map((m: any) => {
        const raw = String(m.sender || m.senderType || "").toUpperCase();
        const isAI = raw === "AI";
        const sender: Sender = isAI
          ? "BOT"
          : (raw as Sender) || "CLIENT";

        return {
          id: m.id || m._id || `${m.timestamp || Date.now()}`,
          content: m.content,
          sender,
          timestamp: new Date(m.timestamp),
          senderName: m.senderName,
          type: (m.type || "TEXT").toUpperCase() === "IMAGE" ? "IMAGE" : "TEXT",
          imageUrl: m.imageUrl,
          meta: { ai: isAI },
        };
      });
      setMessages(msgs);
      setChatInfo(data.chatInfo || null);
    });

    socket.on("messageReceived", (data) => {
      if (data.chatId === chatId) {
        const raw = String(data.sender || data.senderType || "").toUpperCase();
        const isAI = raw === "AI";
        const sender: Sender =
          raw === "CLIENT" ? "CLIENT" :
          raw === "BOT" ? "BOT" :
          raw === "OPERADOR" ? "OPERADOR" :
          isAI ? "BOT" : "OPERADOR";

        const newMessage: Message = {
          id: data.id || Date.now().toString(),
          content: data.content,
          sender,
          timestamp: new Date(data.timestamp),
          senderName: data.senderName,
          type: (data.type || "TEXT").toUpperCase() === "IMAGE" ? "IMAGE" : "TEXT",
          imageUrl: data.imageUrl,
          meta: { ai: isAI },
        };

        setMessages((prev) => [...prev, newMessage]);
        setIsTyping(false);
      }
    });

    socket.on("userTyping", (data) => {
      if (data.chatId === chatId && data.userId !== user?.id) {
        setIsTyping(true);
        setTypingUser(data.userName || "CLIENT");
      }
    });

    socket.on("userStoppedTyping", () => {
      setIsTyping(false);
      setTypingUser("");
    });

    socket.on("chatFinished", (data) => {
      if (data.chatId === chatId) {
        onChatFinished();
        toast({ title: "Chat finalizado", description: "La conversación ha sido cerrada." });
      }
    });

    return () => {
      socket.off("chatMessages");
      socket.off("messageReceived");
      socket.off("userTyping");
      socket.off("userStoppedTyping");
      socket.off("chatFinished");
    };
  }, [socket, chatId, user, onChatFinished, toast]);

  useEffect(() => {
    if (!socket || !chatId) return;

    let typingTimer: NodeJS.Timeout;

    const handleTyping = () => {
      socket.emit("typing", { chatId });
      clearTimeout(typingTimer);
      typingTimer = setTimeout(() => socket.emit("stopTyping", { chatId }), 1000);
    };

    const inputElement = inputRef.current;
    if (inputElement) {
      inputElement.addEventListener("input", handleTyping);
      return () => {
        inputElement.removeEventListener("input", handleTyping);
        clearTimeout(typingTimer);
      };
    }
  }, [socket, chatId]);

  const sendMessage = () => {
    if (!inputMessage.trim() || !socket || !chatId) return;
    const operatorMessage: Message = {
      id: Date.now().toString(),
      content: inputMessage,
      sender: "OPERADOR",
      timestamp: new Date(),
      senderName: user?.name || "Operador",
      type: "TEXT",
    };
    setMessages((prev) => [...prev, operatorMessage]);
    socket.emit("sendMessage", { chatId, content: inputMessage });
    setInputMessage("");
    inputRef.current?.focus();
  };

  const finishChat = () => {
    if (!socket || !chatId) return;
    socket.emit("finishChat", { chatId });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (date: Date) =>
    new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit" }).format(new Date(date));

  const activeMode: Mode = computeModeFromMessages(messages, chatInfo?.type);

  if (!chatInfo) {
    return (
      <Card className="h-96">
        <CardContent className="flex items-center justify-center h-full">
          <div className="text-center text-gray-500">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-2"></div>
            <p>Cargando chat...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-96 relative">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <User className="h-5 w-5" />
            <div>
              <CardTitle className="text-lg">{chatInfo.clientDni}</CardTitle>
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <Clock className="h-4 w-4" />
                <span>Iniciado: {formatTime(chatInfo.createdAt)}</span>
                <Badge variant="outline">{chatInfo.status}</Badge>
              </div>
            </div>
          </div>

          {/* Tira de íconos (flotante y visible) */}
          <ChatModeStrip
            mode={activeMode}
            size="md"
            className="pointer-events-none"
          />

          <div className="flex space-x-2">
            <Button variant="outline" size="sm" onClick={() => setShowSaleDialog(true)} className="flex items-center space-x-1">
              <DollarSign className="h-4 w-4" />
              <span>Confirmar Venta</span>
            </Button>
            <Button variant="destructive" size="sm" onClick={finishChat} className="flex items-center space-x-1">
              <X className="h-4 w-4" />
              <span>Finalizar</span>
            </Button>
          </div>
        </div>
      </CardHeader>

      {/* Opcional: si querés que quede "flotando" centrado sobre el timeline,
          descomentá este bloque y/o quitalo del header de arriba. */}
      {/* 
      <ChatModeStrip
        mode={activeMode}
        size="lg"
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-1.5 z-20"
      />
      */}

      <CardContent className="p-0">
        <ScrollArea className="h-64 px-4 custom-scrollbar">
          <div className="space-y-4 py-4">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} currentUserId={"OPERADOR"} />
            ))}
            {isTyping && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        <div className="border-t p-4">
          <div className="flex space-x-2">
            <Input
              ref={inputRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Escribe tu respuesta..."
              className="flex-1"
            />
            <Button onClick={sendMessage} disabled={!inputMessage.trim()} size="icon">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>

      <SaleConfirmationDialog
        open={showSaleDialog}
        onOpenChange={setShowSaleDialog}
        chatId={chatId}
        clientDni={chatInfo.clientDni}
      />
    </Card>
  );
}

export default ChatPanel;
