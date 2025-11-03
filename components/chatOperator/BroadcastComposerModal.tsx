"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Megaphone,
  Mail,
  MessageCircle,
  Loader2,
  Check,
  Search,
} from "lucide-react";
import type { AudienceSegment } from "./MassBroadcastAudienceModal";
import {
  fetchChats,
  filterChats,
  resolveApiBase,
  type ChatRow,
} from "@/components/helpers/fetchmodal";

/* ===== Tipos ===== */
type SendPayload = {
  message: string;
  testMode?: boolean;
  selectedChatIds?: string[];
};

interface BroadcastComposerModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;

  segment: AudienceSegment;                 // ALL | WHATSAPP | ECOMMERCE
  includeInactive: boolean;
  counts?: Partial<Record<AudienceSegment, number>>;
  onSend: (payload: SendPayload) => Promise<void> | void;

  enableClientSearchUI?: boolean;
  clientPreviewText?: string;
  authToken?: string | null;
  apiBaseOverride?: string;
}

/* ===== Utils locales ===== */
const ONLY_DIGITS = (s?: string) => String(s || "").replace(/[^\d]/g, "");
const MOCK_SUFFIXES = ["081", "082", "083", "084", "085"] as const;
type MockSuffix = (typeof MOCK_SUFFIXES)[number];

function makeMockRowsFromDni(dni: string): ChatRow[] {
  const base = ONLY_DIGITS(dni).slice(0, -3);
  return MOCK_SUFFIXES.map((suf, i) => ({
    chatId: `mock-${base}${suf}`,
    clientName: `Mock Cliente ${suf}`,
    phone: `+54 9 351 555 ${String(1000 + i).slice(-4)}`,
    dni: `${base}${suf}`,
    lastMessageAt: new Date().toISOString(),
  }));
}

async function createChatIfMock(
  row: ChatRow,
  baseUrl: string,
  token?: string | null
): Promise<ChatRow> {
  if (!row.chatId.startsWith("mock-")) return row;
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${baseUrl}/chat/create`, {
      method: "POST",
      headers,
      body: JSON.stringify({ phone: row.phone, clientName: row.clientName, dni: row.dni }),
    });
    if (!res.ok) return row;
    const data: any = await res.json().catch(() => null);
    const newId = String(data?.id || data?._id || data?.chatId || "");
    return newId ? { ...row, chatId: newId } : row;
  } catch {
    return row;
  }
}

export default function BroadcastComposerModal({
  open,
  onOpenChange,
  segment,
  includeInactive,
  counts,
  onSend,
  enableClientSearchUI = true,
  clientPreviewText,
  authToken = (typeof window !== "undefined" ? localStorage.getItem("token") : null),
  apiBaseOverride,
}: BroadcastComposerModalProps) {
  const [message, setMessage] = useState("");
  const [testMode, setTestMode] = useState(false);
  const [sending, setSending] = useState(false);

  // búsqueda / selección
  const [dni, setDni] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [rows, setRows] = useState<ChatRow[]>([]);
  const [selected, setSelected] = useState<Record<string, ChatRow>>({});
  const [didSearch, setDidSearch] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (open) {
      setMessage("");
      setTestMode(false);
      setSending(false);
      setDni("");
      setPhone("");
      setRows([]);
      setSelected({});
      setErrorMsg(null);
      setDidSearch(false);
    } else {
      abortRef.current?.abort();
    }
  }, [open]);

  const chars = message.length;
  const segmentLabel = useMemo(() => {
    switch (segment) {
      case "ALL":
        return "Todos mis clientes";
      case "WHATSAPP":
        return "Solo WhatsApp";
      case "ECOMMERCE":
        return "Solo E-commerce";
      default:
        return "Segmento";
    }
  }, [segment]);

  const segmentCount = typeof counts?.[segment] === "number" ? counts?.[segment] : undefined;
  const canSend = message.trim().length > 0 && !sending;
  const baseUrl = resolveApiBase(apiBaseOverride);

  function toggleSelect(row: ChatRow) {
    setSelected((prev) => {
      const copy = { ...prev };
      if (copy[row.chatId]) delete copy[row.chatId];
      else copy[row.chatId] = row;
      return copy;
    });
  }

  async function runFetch(all: boolean) {
    setErrorMsg(null);
    setLoading(true);
    setDidSearch(true);

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const dniDigits = ONLY_DIGITS(dni);
      const dniSuf = dniDigits.slice(-3) as MockSuffix;
      if (!all && dniDigits && (MOCK_SUFFIXES as readonly string[]).includes(dniSuf)) {
        setRows(makeMockRowsFromDni(dniDigits));
        return;
      }

      const data = await fetchChats({
        withLastMessage: true,
        token: authToken || undefined,
        signal: ctrl.signal,
        baseUrl,
      });

      const filtered = all ? data : filterChats(data, { dni, phone });
      setRows(filtered);
    } catch (e: any) {
      setRows([]);
      setErrorMsg(e?.message || "Error al obtener los chats");
    } finally {
      setLoading(false);
    }
  }

  async function handleSend() {
    if (!canSend) return;
    setSending(true);
    try {
      const selectedRows = Object.values(selected);
      const resolvedRows: ChatRow[] = [];
      for (const r of selectedRows) {
        // eslint-disable-next-line no-await-in-loop
        const rr = await createChatIfMock(r, baseUrl, authToken);
        resolvedRows.push(rr);
      }
      const selectedIds = resolvedRows.length ? resolvedRows.map((r) => r.chatId) : undefined;

      await onSend({ message: message.trim(), testMode, selectedChatIds: selectedIds });
      onOpenChange(false);
    } finally {
      setSending(false);
    }
  }

  /* estilos de rail resaltado */
  const chipBase = "inline-flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs";
  const chipActive = "border-emerald-500 bg-emerald-50 text-emerald-700";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* ⬅️ Más ancho: sm:max-w-2xl + 94vw; alto máx y scroll vertical */}
      <DialogContent className="sm:max-w-2xl w-[94vw] max-h-[90vh] p-0 overflow-y-scroll">
        {/* Header sticky */}
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/70 border-b">
          <div className="px-5 pt-4 pb-3">
            <DialogHeader className="space-y-1">
              <DialogTitle className="flex items-center gap-2 text-base">
                <Megaphone className="h-5 w-5" />
                Redactar difusión
              </DialogTitle>
              <DialogDescription className="text-xs">
                Escribí el contenido para el segmento seleccionado.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <Badge variant="secondary">{segmentLabel}</Badge>
              <Badge variant="outline">
                {includeInactive ? "Incluye inactivos (30 días)" : "Solo activos"}
              </Badge>
              {typeof segmentCount === "number" && (
                <Badge className="bg-sky-100 text-sky-800 border-sky-200">
                  {segmentCount} destino(s)
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* BODY */}
        <div className="flex">
          {/* Rail OUTBOUND */}
          <aside className="w-36 shrink-0 border-r px-3 py-4">
            <div className="text-[11px] tracking-widest text-muted-foreground">OUTBOUND</div>

            <div className="mt-2 grid gap-2">
              <div className={`${chipBase} ${segment === "ALL" ? chipActive : ""}`} title="Todos">
                <svg
                  className="h-3.5 w-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                Todos
              </div>

              <div
                className={`${chipBase} ${segment === "WHATSAPP" ? chipActive : ""}`}
                title="WhatsApp"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                WhatsApp
              </div>

              <div
                className={`${chipBase} ${segment === "ECOMMERCE" ? chipActive : ""}`}
                title="Email"
              >
                <Mail className="h-3.5 w-3.5" />
                Email
              </div>
            </div>
          </aside>

          {/* Main */}
          <main className="flex-1 px-6 py-5">
            {/* === OBTENER CLIENTE === */}
            {enableClientSearchUI && (
              <>
                <div className="text-[12px] font-medium tracking-wide text-muted-foreground">
                  OBTENER CLIENTE
                </div>

                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    placeholder="DNI"
                    value={dni}
                    onChange={(e) => setDni(e.target.value)}
                    className="rounded-full h-9"
                  />
                  <Input
                    placeholder="Celular"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="rounded-full h-9"
                  />
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <Button
                    variant="secondary"
                    className="rounded-full"
                    onClick={() => runFetch(true)}
                  >
                    TODOS
                  </Button>
                  <Button className="rounded-full" onClick={() => runFetch(false)}>
                    <Search className="h-4 w-4 mr-1" />
                    BUSCAR
                  </Button>
                </div>

                {clientPreviewText && (
                  <div className="mt-3 text-sm font-medium text-muted-foreground">
                    {clientPreviewText}
                  </div>
                )}

                {/* Resultados */}
                <div className="mt-4">
                  {loading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Buscando chats…
                    </div>
                  ) : errorMsg ? (
                    <div className="text-sm text-red-600">{errorMsg}</div>
                  ) : rows.length ? (
                    <div className="rounded-lg border">
                      <div className="max-h-52 overflow-y-auto divide-y">
                        {rows.map((r) => {
                          const isSel = !!selected[r.chatId];
                          return (
                            <button
                              key={r.chatId}
                              type="button"
                              onClick={() => toggleSelect(r)}
                              className={[
                                "w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-muted/50",
                                isSel ? "bg-sky-50" : "",
                              ].join(" ")}
                            >
                              <div className="min-w-0">
                                <div className="truncate text-sm font-medium">
                                  {r.clientName || "Sin nombre"}
                                </div>
                                <div className="truncate text-xs text-muted-foreground">
                                  {r.phone || "—"} {r.dni ? `• DNI ${r.dni}` : ""}
                                  {String(r.chatId).startsWith("mock-") ? " • MOCK" : ""}
                                </div>
                              </div>
                              <div className="shrink-0">
                                {isSel ? (
                                  <span className="inline-flex items-center rounded-full bg-sky-600 px-2 py-0.5 text-[10px] font-medium text-white">
                                    <Check className="mr-1 h-3 w-3" />
                                    Seleccionado
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-muted-foreground">
                                    Seleccionar
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {/* Chips seleccionados */}
                      <div className="flex flex-wrap items-center gap-2 border-t p-2">
                        <span className="text-xs text-muted-foreground">
                          {Object.keys(selected).length} seleccionado(s)
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {Object.values(selected).slice(0, 6).map((s) => (
                            <span
                              key={`chip-${s.chatId}`}
                              className="max-w-[180px] truncate rounded-full border px-2 py-0.5 text-[11px]"
                              title={s.clientName || s.chatId}
                            >
                              {s.clientName || s.chatId}
                            </span>
                          ))}
                          {Object.keys(selected).length > 6 && (
                            <span className="text-[11px] text-muted-foreground">
                              +{Object.keys(selected).length - 6} más
                            </span>
                          )}
                        </div>
                        {Object.keys(selected).length > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="ml-auto"
                            onClick={() => setSelected({})}
                          >
                            Limpiar
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : didSearch ? (
                    <div className="text-sm font-medium text-red-600">
                      No se encontró cliente con esos datos.
                    </div>
                  ) : null}
                </div>

                <Separator className="my-4" />
              </>
            )}

            {/* Mensaje */}
            <div>
              <Label htmlFor="bc-message" className="text-xs">
                Mensaje
              </Label>
              <div className="mt-1 rounded-2xl border bg-muted/30 p-2">
                <Textarea
                  id="bc-message"
                  placeholder="Este generador usa un diccionario de palabras… (podés usar {nombre})"
                  rows={8}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="min-h-[150px] resize-y rounded-xl border-none bg-transparent focus-visible:ring-0"
                />
              </div>
              <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>Podés usar variables como {"{nombre}"} si tu plantilla lo soporta.</span>
                <span>{chars} caract.</span>
              </div>
            </div>

            {/* Prueba */}
            <div className="mt-3 flex items-center gap-2">
              <input
                id="bc-test"
                type="checkbox"
                className="h-4 w-4"
                checked={testMode}
                onChange={(e) => setTestMode(e.target.checked)}
              />
              <Label htmlFor="bc-test" className="text-sm text-muted-foreground">
                Enviar prueba (muestra pequeña)
              </Label>
            </div>

            {/* Acciones */}
            <div className="mt-5 mb-2 flex justify-center">
              <Button
                onClick={handleSend}
                type="button"
                disabled={!canSend}
                className="min-w-[180px] rounded-full bg-gradient-to-r from-sky-500 to-sky-600 text-white"
              >
                {sending ? "Enviando…" : "ENVIAR"}
              </Button>
            </div>
            <div className="mb-3 flex justify-end">
              <Button variant="ghost" size="sm" type="button" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
            </div>
          </main>
        </div>
      </DialogContent>
    </Dialog>
  );
}
