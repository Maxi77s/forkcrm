// src/lib/api/chats.ts

// ===== Tipos base (por si luego agregás listado de chats) =====
export type ChatStatus = "WAITING" | "ACTIVE" | "CLOSED";
export type ChatType = "IA" | "HUMAN";

export interface ChatDTO {
  id: string;
  status: ChatStatus;
  type: ChatType;
  userId: string;
  specialistId: string | null;
  clientName: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

export type MessageSender = "CLIENT" | "OPERATOR" | "SYSTEM";

// ===== Tipos de mensajes (lo que devuelve tu controller actual) =====
export interface ChatMessageDTO {
  id: string;
  content: string;
  sender: MessageSender | "BOT" | "OPERADOR"; // por compatibilidad de front
  timestamp: string; // ISO
  chatId: string;
  userId?: string;
  type: "TEXT" | "IMAGE";
}

export interface CreatedMessageDTO {
  id: string;
  chatId: string;
  sender: MessageSender;
  content: string;
  createdAt: string; // ISO
}

// ===== Config =====
const BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002").replace(/\/$/, "");
const API_PREFIX = (process.env.NEXT_PUBLIC_API_PREFIX ?? "").replace(/\/$/, ""); // e.g. "/api" o ""
const JSON_HEADERS = { "Content-Type": "application/json" } as const;

function url(path: string, qs?: string) {
  // path sin barra inicial
  const p = path.replace(/^\//, "");
  const prefix = API_PREFIX ? `/${API_PREFIX.replace(/^\//, "")}` : "";
  return `${BASE_URL}${prefix}/${p}${qs ? `?${qs}` : ""}`;
}

function authHeaders(token?: string): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function http<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText} – ${text}`);
  }
  return (await res.json()) as T;
}

/* =========================================================================
   ENDPOINTS REALES HOY
   - GET /chat/:chatId/messages  → historial de un chat (tu controller actual)
   - (opcional futuro) POST /chat/:chatId/messages → enviar mensaje
   ========================================================================= */

// Obtener historial de mensajes de un chat (USAR ESTE)
export async function getChatMessages(chatId: string, token?: string): Promise<ChatMessageDTO[]> {
  const headers: Record<string, string> = { ...JSON_HEADERS, ...authHeaders(token) };
  return http(url(`chat/${chatId}/messages`), { headers, cache: "no-store" });
}

// Enviar mensaje a un chat (requiere que tu backend exponga POST en la misma ruta)
export async function sendMessage(
  chatId: string,
  payload: { sender: MessageSender; content: string },
  token?: string
): Promise<CreatedMessageDTO> {
  const headers: Record<string, string> = { ...JSON_HEADERS, ...authHeaders(token) };
  return http(url(`chat/${chatId}/messages`), {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
}

/* =========================================================================
   ENDPOINTS AÚN NO DISPONIBLES EN TU BACK
   (Si más adelante los creás, los activás aquí)
   ========================================================================= */

// // Listar chats (NO EXISTE HOY EN TU API)
// export async function listChats(params?: {
//   page?: number;
//   limit?: number;
//   status?: ChatStatus;
//   token?: string;
// }): Promise<{ items: ChatDTO[]; page: number; limit: number; total?: number }> {
//   const page = params?.page ?? 1;
//   const limit = params?.limit ?? 20;
//   const status = params?.status;
//   const qs = new URLSearchParams({
//     page: String(page),
//     limit: String(limit),
//     ...(status ? { status } : {}),
//   }).toString();
//   const headers: Record<string, string> = { ...JSON_HEADERS, ...authHeaders(params?.token) };
//   return http(url("chats", qs), { headers, cache: "no-store" });
// }

// // Obtener detalle de un chat (NO EXISTE HOY EN TU API)
// export async function getChat(id: string, token?: string): Promise<ChatDTO> {
//   const headers: Record<string, string> = { ...JSON_HEADERS, ...authHeaders(token) };
//   return http(url(`chats/${id}`), { headers, cache: "no-store" });
// }
