"use client";

import { useMemo } from "react";
import { useChatOperator } from "@/hooks/use-chat-operator"; // tu hook ya existente
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Send, Headphones } from "lucide-react";
import { assignWithAutoHeal } from "@/components/helpers/helper.assign";

export default function ChatOperator() {
  const {
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
  } = useChatOperator({});

  const badgeByStatus = (s?: string) =>
    ({
      ACTIVE: <Badge>🟢 Activo</Badge>,
      WAITING: <Badge variant="outline">⏳ En cola</Badge>,
      FINISHED: <Badge variant="secondary">✅ Finalizado</Badge>,
    }[String(s || "ACTIVE")] || <Badge>🟢 Activo</Badge>);

  const currentMessages = messages;
  const currentTitle = useMemo(
    () => current?.clientName || (selectedChatId ? `Chat ${selectedChatId.slice(0, 6)}…` : "Sin chat"),
    [current?.clientName, selectedChatId]
  );

  const handleAutoAssign = async () => {
    // Opcional: intenta completar slots hasta MAX_ACTIVE usando tu helper
    await assignWithAutoHeal();
  };

  return (
    <div className="grid grid-cols-12 gap-3 h-[calc(100vh-2rem)] p-3">
      {/* Columna izquierda: lista de chats */}
      <div className="col-span-4 flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold">Chats asignados</h2>
          <div className="flex gap-2">
            <Badge variant={isConnected ? "default" : "destructive"}>
              {isConnected ? "WS conectado" : "WS desconectado"}
            </Badge>
            <Button size="sm" variant="outline" onClick={handleAutoAssign}>
              <Headphones className="h-4 w-4 mr-1" /> Auto-asignar
            </Button>
          </div>
        </div>

        <Card className="flex-1">
          <ScrollArea className="h-full">
            <div className="p-2 space-y-1">
              {loading && <div className="text-sm text-gray-500 p-2">Cargando…</div>}
              {!loading && chatPreviews.length === 0 && (
                <div className="text-sm text-gray-500 p-2">Sin chats asignados.</div>
              )}
              {chatPreviews.map((c) => (
                <button
                  key={c.chatId}
                  className={`w-full text-left rounded-md p-2 hover:bg-gray-50 border ${
                    selectedChatId === c.chatId ? "border-blue-500" : "border-transparent"
                  }`}
                  onClick={() => setSelectedChatId(c.chatId)}
                >
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      {c.avatar ? <AvatarImage src={c.avatar} alt={c.clientName || "Cliente"} /> : null}
                      <AvatarFallback>{(c.clientName || "C").slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium truncate">{c.clientName || "Cliente"}</span>
                        {badgeByStatus(c.status as any)}
                      </div>
                      <div className="text-xs text-gray-500 truncate">{c.lastMessage}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </Card>
      </div>

      {/* Columna derecha: conversación */}
      <div className="col-span-8 flex flex-col">
        <Card className="flex-1 flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-base">{currentTitle}</CardTitle>
            </div>
            {current?.status && badgeByStatus(current.status)}
          </CardHeader>

          <CardContent className="flex-1 flex flex-col p-0">
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-3">
                {currentMessages.map((m) => (
                  <div key={`${m.id}-${m.timestamp.toISOString()}`} className="flex flex-col">
                    <div
                      className={`inline-block max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                        m.sender === "OPERADOR"
                          ? "self-end bg-blue-600 text-white"
                          : m.sender === "CLIENT"
                          ? "self-start bg-gray-100"
                          : "self-center bg-gray-200"
                      }`}
                    >
                      {m.type === "IMAGE" ? (
                        <div className="italic">📷 Imagen</div>
                      ) : (
                        <div>{m.content}</div>
                      )}
                    </div>
                    <div className="text-[10px] text-gray-500 mt-1 self-end">
                      {m.senderName || m.sender}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Composer */}
            <div className="border-t p-3">
              {selectedChatId ? (
                <div className="flex gap-2">
                  <Input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Escribe un mensaje…"
                  />
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    ref={fileRef}
                    onChange={handleImageSelected}
                  />
                  <Button type="button" variant="outline" onClick={handlePickImage}>
                    📎
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSend}
                    disabled={!message.trim() || localSending}
                  >
                    <Send className="h-4 w-4 mr-1" />
                    Enviar
                  </Button>
                </div>
              ) : (
                <div className="text-sm text-gray-500">Seleccioná un chat para comenzar.</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Acciones extra */}
        <div className="mt-2 flex items-center gap-2">
          <Button
            variant="secondary"
            disabled={!selectedChatId}
            onClick={() => selectedChatId && finishChat(selectedChatId)}
          >
            Finalizar chat
          </Button>
          {/* Ejemplo de template (si usás N8N): */}
          {/* <Button onClick={() => sendTemplate("depilacion", current?.clientName || "Cliente")}>
            Enviar template
          </Button> */}
        </div>
      </div>
    </div>
  );
}
