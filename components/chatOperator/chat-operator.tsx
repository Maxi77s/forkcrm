"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Image as ImageIcon,
  Loader2,
  Send,
  User,
  Phone,
  PhoneCall,
  Video,
  VideoOff,
  Mic,
  MicOff,
  MessageCircle,
  FileVideo,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/auth-provider";
import { ChatList } from "@/components/chat/chat-list";
import { ChatMessage } from "@/components/chat/chat-message";
import { useChatOperator } from "@/hooks/use-chat-operator";
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";
import ChatModeStrip from "@/components/chatOperator/ChatModeStrip";

/* ================= helpers ================= */
const onlyDigits = (n?: string) => (n ?? "").replace(/[^\d]/g, "");

type Mode = "BOT" | "AI" | "HUMAN";

/** Decide qué modo está “activo” según el último mensaje relevante (no SYSTEM). */
function computeActiveMode(msgs: any[], fallbackType?: string): Mode {
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    if (!m) continue;
    const raw = String(m.sender || m.senderType || "").toUpperCase();
    if (raw === "SYSTEM") continue;
    if (raw === "OPERADOR" || raw === "HUMAN" || raw === "HUMAN_SUPPORT") return "HUMAN";
    if (raw === "AI") return "AI";
    if (raw === "BOT") {
      if (m?.meta?.ai || m?.tags?.includes?.("ai")) return "AI";
      return "BOT";
    }
  }
  const t = String(fallbackType || "").toUpperCase();
  if (t === "HUMAN" || t === "HUMAN_SUPPORT") return "HUMAN";
  if (t === "BOT") return "BOT";
  return "BOT";
}

/* ================= component ================= */
export default function ChatOperator() {
  const { user, token } = useAuth();

  // Obtenemos el hook una sola vez y luego sacamos state/actions (deja puerta a métodos opcionales)
  const hook = useChatOperator({ token: token ?? undefined });

  const {
    state: {
      loading,
      chatPreviews,
      selectedChatId,
      messages,
      message,
      localSending,
      fileRef,
      current,
    },
    actions: {
      setSelectedChatId,
      setMessage,
      handleSend,
      handlePickImage,
      handleImageSelected,
      finishChat,
      // 👉 nuevo: acción del hook para plantilla con video (si existe)
      sendTemplateVideo,
    },
  } = hook;

  // ====== OPCIONALES del orquestador (no rompen si no existen en tu hook) ======
  const modeByChat = (hook as any)?.state?.modeByChat as Record<string, Mode> | undefined;
  const botThinkingMap = (hook as any)?.state?.botThinking as Record<string, boolean> | undefined;
  const takeOver = (hook as any)?.actions?.takeOver as ((chatId: string) => void) | undefined;
  const release = (hook as any)?.actions?.release as ((chatId: string) => void) | undefined;

  // Enlaces rápidos (tel/wa) — FIX: strings con template literal
  const e164 = onlyDigits(current?.phone);
  const telHref = e164 ? `tel:+${e164}` : undefined;
  const waChatHref = e164 ? `https://wa.me/${e164}` : undefined;
  const waCallHref = e164 ? `whatsapp://call?phone=${e164}` : undefined;
  const waVideoHref = e164 ? `whatsapp://video?phone=${e164}` : undefined;

  // Controles mic/cam
  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const micStreamRef = useRef<MediaStream | null>(null);
  const camStreamRef = useRef<MediaStream | null>(null);
  const stopStream = (s: MediaStream | null) => s?.getTracks().forEach((t) => t.stop());

  const toggleMic = async () => {
    if (micOn) {
      stopStream(micStreamRef.current);
      micStreamRef.current = null;
      setMicOn(false);
      return;
    }
    try {
      micStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicOn(true);
    } catch {
      setMicOn(false);
    }
  };

  const toggleCam = async () => {
    if (camOn) {
      stopStream(camStreamRef.current);
      camStreamRef.current = null;
      setCamOn(false);
      return;
    }
    try {
      camStreamRef.current = await navigator.mediaDevices.getUserMedia({ video: true });
      setCamOn(true);
    } catch {
      setCamOn(false);
    }
  };

  useEffect(() => {
    return () => {
      stopStream(micStreamRef.current);
      stopStream(camStreamRef.current);
    };
  }, []);

  // Auto–scroll al final cuando llegan mensajes o cambia el seleccionado
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, selectedChatId]);

  const confirmFinish = async () => {
    if (!current) return;
    const res = await Swal.fire({
      title: "¿Finalizar conversación?",
      text: "¿Seguro que quieres finalizar la conversación? Podrás reabrirla más tarde.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, finalizar",
      cancelButtonText: "Cancelar",
      reverseButtons: true,
      confirmButtonColor: "#ef4444",
    });
    if (res.isConfirmed) {
      finishChat(current.chatId);
      await Swal.fire({
        title: "Conversación finalizada",
        icon: "success",
        timer: 1400,
        showConfirmButton: false,
      });
    }
  };

  const renderChannelBadge = () => null;

  // ============== Panel Plantillas (video) ==============
  const [tplOpen, setTplOpen] = useState(false);
  const [tplTratamiento, setTplTratamiento] = useState<"depilacion" | "blanqueamiento" | "otro">("depilacion");
  const [tplNombre, setTplNombre] = useState<string>("");
  const [tplVideoFile, setTplVideoFile] = useState<File | null>(null);
  const [tplSending, setTplSending] = useState(false);
  const tplFileRef = useRef<HTMLInputElement>(null);

  // precompletar el nombre cuando cambia el chat
  useEffect(() => {
    setTplNombre(current?.clientName ?? "");
  }, [current?.clientName, selectedChatId]);

  const handleTplPickVideo = () => tplFileRef.current?.click();
  const handleTplFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setTplVideoFile(f);
  };

  const handleTplSend = async () => {
    if (!current?.phone) {
      Swal.fire({ icon: "error", title: "Falta teléfono", text: "El chat no tiene número asociado." });
      return;
    }
    if (!tplVideoFile) {
      Swal.fire({ icon: "warning", title: "Adjunta un video", text: "Selecciona un archivo .mp4 o .3gp" });
      return;
    }
    setTplSending(true);
    try {
      await sendTemplateVideo?.({
        tratamiento: tplTratamiento,
        nombre_cliente: tplNombre || "Cliente",
        file: tplVideoFile,
      });
      setTplOpen(false);
      setTplVideoFile(null);
      Swal.fire({ icon: "success", title: "Plantilla enviada" });
    } catch (e: any) {
      Swal.fire({ icon: "error", title: "No se pudo enviar", text: e?.message || "Revisa el archivo e intenta de nuevo" });
    } finally {
      setTplSending(false);
    }
  };

  // ====== Modo activo / Thinking: preferimos orquestador si existe; si no, inferimos por mensajes
  const orchestratorMode = useMemo<Mode | undefined>(() => {
    if (!selectedChatId) return undefined;
    const m = modeByChat?.[selectedChatId];
    return m as Mode | undefined;
  }, [modeByChat, selectedChatId]);

  const inferredMode: Mode = computeActiveMode(messages as any[], (current as any)?.type);
  const activeMode: Mode = orchestratorMode ?? inferredMode;

  const isThinking = !!(selectedChatId && botThinkingMap?.[selectedChatId]);

  return (
    <div className="grid h-[calc(100dvh-2rem)] w-full gap-4 md:grid-cols-[340px_1fr]">
      {/* Columna izquierda */}
      <Card className="flex flex-col overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={undefined} alt="Operador" />
              <AvatarFallback>
                <User className="h-5 w-5" />
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-medium leading-none">
                  {user?.name ?? "Operador"}
                </p>
                <Badge variant="secondary" className="h-5 text-[11px]">
                  {(user as any)?.role ?? "OPERADOR"}
                </Badge>
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {(user as any)?.email ?? "operador@example.com"}
              </p>
            </div>
          </div>
        </CardHeader>

        <Separator />
        <CardContent className="p-0 flex-1">
          <ChatList
            chats={chatPreviews as any} // si tu preview incluye { mode, botThinking }, se mostrarán en badges
            selectedChatId={selectedChatId ?? null}
            onChatSelect={(id) => setSelectedChatId(id ?? undefined)}
            isLoading={loading}
          />
        </CardContent>
      </Card>

      {/* Columna derecha */}
      <Card className="relative flex min-h-0 flex-col overflow-hidden">
        {/* 🔵 Tira flotante, centrada (modo actual) */}
        <ChatModeStrip
          mode={activeMode}
          size="md"
          className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-3 md:top-14 z-30"
        />

        <CardHeader className="sticky top-0 z-20 bg-white border-b p-4">
          <div className="flex items-center w-full gap-3 flex-nowrap">
            <Avatar className="h-8 w-8 flex-shrink-0">
              {current?.avatar ? (
                <AvatarImage
                  src={current.avatar}
                  alt={current?.clientName ?? "Cliente"}
                />
              ) : null}
              <AvatarFallback>
                {(current?.clientName?.[0] ?? "C").toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-medium leading-none">
                  {current
                    ? (current.clientName ?? `Cliente ${current.clientId.slice(0, 8)}…`)
                    : "Selecciona un chat"}
                </p>
                {renderChannelBadge()}
              </div>

              {current && (
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      current.isOnline ? "bg-green-500" : "bg-zinc-400"
                    )}
                  />
                  <span className="text-xs text-muted-foreground">
                    {current.isOnline ? "En línea" : "Desconectado"}
                  </span>
                  {/* Indicador de IA pensando, si el hook lo trae */}
                  {isThinking && (
                    <span className="ml-2 inline-flex items-center gap-2 text-[11px] text-zinc-500">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-zinc-400 animate-pulse" />
                      La IA está redactando…
                    </span>
                  )}
                </div>
              )}
            </div>

            {current?.phone && (
              <Badge variant="outline" className="font-mono text-xs flex-shrink-0">
                +{onlyDigits(current.phone)}
              </Badge>
            )}

            <div className="ml-auto flex items-center gap-2 flex-shrink-0">
              {/* Botón para abrir panel de plantillas */}
              <Button
                size="sm"
                variant={tplOpen ? "default" : "outline"}
                onClick={() => setTplOpen((v) => !v)}
                disabled={!current?.phone}
                title={current?.phone ? "Enviar plantilla con video" : "Este chat no tiene teléfono"}
              >
                <FileVideo className="h-4 w-4" />
                <span className="ml-1 text-xs hidden sm:inline">Plantilla</span>
                {tplOpen ? <ChevronUp className="ml-1 h-3 w-3" /> : <ChevronDown className="ml-1 h-3 w-3" />}
              </Button>

              {waChatHref && (
                <Button size="sm" variant="outline" asChild title="Abrir chat en WhatsApp">
                  <a href={waChatHref} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="h-4 w-4" />
                    <span className="ml-1 text-xs">WA</span>
                  </a>
                </Button>
              )}
              {telHref && (
                <Button size="sm" variant="outline" asChild title="Llamar (teléfono)">
                  <a href={telHref}>
                    <Phone className="h-4 w-4" />
                  </a>
                </Button>
              )}
              {waCallHref && (
                <Button size="sm" variant="outline" asChild title="Llamada de WhatsApp (app)">
                  <a href={waCallHref}>
                    <PhoneCall className="h-4 w-4" />
                    <span className="ml-1 text-xs">WA</span>
                  </a>
                </Button>
              )}
              {waVideoHref && (
                <Button size="sm" variant="outline" asChild title="Videollamada de WhatsApp (app)">
                  <a href={waVideoHref}>
                    <Video className="h-4 w-4" />
                    <span className="ml-1 text-xs">WA</span>
                  </a>
                </Button>
              )}
              <Button
                size="sm"
                variant={micOn ? "default" : "outline"}
                onClick={toggleMic}
                title={micOn ? "Micrófono activado" : "Activar micrófono"}
                aria-pressed={micOn}
              >
                {micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
              </Button>
              <Button
                size="sm"
                variant={camOn ? "default" : "outline"}
                onClick={toggleCam}
                title={camOn ? "Cámara activada" : "Activar cámara"}
                aria-pressed={camOn}
              >
                {camOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
              </Button>

              {/* Controles opcionales de orquestador */}
              {selectedChatId && takeOver && activeMode !== "HUMAN" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => takeOver(selectedChatId)}
                  className="text-amber-700 border-amber-300 hover:bg-amber-50"
                  title="Tomar control (pasar a HUMANO)"
                >
                  Tomar control
                </Button>
              )}
              {selectedChatId && release && activeMode === "HUMAN" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => release(selectedChatId)}
                  className="text-indigo-700 border-indigo-300 hover:bg-indigo-50"
                  title="Liberar control (volver a BOT/IA)"
                >
                  Liberar
                </Button>
              )}

              <Button
                size="sm"
                variant="destructive"
                disabled={!current || current.status === "FINISHED"}
                onClick={confirmFinish}
                title="Finalizar conversación"
              >
                Finalizar
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* ======= Panel plegable de Plantillas (video) ======= */}
        {tplOpen && (
          <div className="border-b bg-muted/40 p-3">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-center">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Tratamiento</span>
                <select
                  className="h-9 rounded-md border bg-background px-2 text-sm"
                  value={tplTratamiento}
                  onChange={(e) =>
                    setTplTratamiento(e.target.value as "depilacion" | "blanqueamiento" | "otro")
                  }
                >
                  <option value="depilacion">depilacion</option>
                  <option value="blanqueamiento">blanqueamiento</option>
                  <option value="otro">otro</option>
                </select>
              </div>

              <div className="flex flex-col gap-1 md:col-span-2">
                <span className="text-xs text-muted-foreground">Nombre del cliente</span>
                <Input
                  value={tplNombre}
                  onChange={(e) => setTplNombre(e.target.value)}
                  placeholder="Nombre del cliente"
                />
              </div>

              <div className="flex items-end gap-2">
                <input
                  ref={tplFileRef}
                  type="file"
                  accept="video/mp4,video/3gpp,video/*"
                  className="hidden"
                  onChange={handleTplFileSelected}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTplPickVideo}
                  disabled={!current?.phone || tplSending}
                  title="Adjuntar video (mp4/3gp)"
                >
                  <FileVideo className="h-4 w-4" />
                  <span className="ml-1 text-xs">Adjuntar video</span>
                </Button>
                <Button
                  type="button"
                  onClick={handleTplSend}
                  disabled={!current?.phone || !tplVideoFile || tplSending}
                  title="Enviar plantilla"
                >
                  {tplSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {tplVideoFile && (
              <p className="mt-2 text-xs text-muted-foreground">
                Archivo seleccionado: <span className="font-medium">{tplVideoFile.name}</span>
              </p>
            )}
          </div>
        )}

        {/* Mensajes */}
        <div className="flex min-h-0 flex-1 flex-col">
          <ScrollArea className="flex-1">
            <div className="flex flex-col gap-3 p-4">
              {(!current || messages.length === 0) && (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  {current ? "Sin mensajes todavía" : "Selecciona un chat de la izquierda"}
                </p>
              )}
              {messages.map((m) => (
                <ChatMessage
                  key={m.id}
                  message={m as any}
                  currentUserId={(user as any)?.id}
                  clientAvatarUrl={current?.avatar}
                />
              ))}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          {/* Input de texto + imagen (caption usa el input) */}
          <div className="border-t p-3">
            <div className="flex items-center gap-2">
              <Input
                placeholder={current ? "Escribe un mensaje…" : "Selecciona un chat"}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                disabled={!current || localSending}
              />
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageSelected}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handlePickImage}
                disabled={!current || localSending}
                title="Adjuntar imagen"
              >
                <ImageIcon className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                onClick={handleSend}
                disabled={!current || !message.trim() || localSending}
                title={activeMode !== "HUMAN" && takeOver && selectedChatId ? "Enviar (hará takeover automático)" : "Enviar"}
              >
                {localSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
