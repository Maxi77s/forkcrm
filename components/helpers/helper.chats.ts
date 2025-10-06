// src/components/helpers/helper.chats.ts
const BASE = process.env.NEXT_PUBLIC_ECOM_BASE_URL ?? "http://localhost:3002";

/* ================= Auth ================= */
function getToken(): string | null {
  return typeof window !== "undefined" ? localStorage.getItem("token") : null;
}
function authHeaders(extra?: HeadersInit): HeadersInit {
  const t = getToken();
  return {
    "Content-Type": "application/json",
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
    ...extra,
  };
}
async function GET<T = any>(url: string) {
  const r = await fetch(url, { headers: authHeaders() });
  const raw = await r.text();
  let json: any = undefined;
  try { json = raw ? JSON.parse(raw) : undefined; } catch {}
  return { ok: r.ok, status: r.status, json: json as T, raw };
}

/* ================= Tipos ================= */
export interface ChatDetailDTO {
  id: string;
  clientId: string | { _id: string };
  clientName?: string;
  assignedOperator?: string | { _id: string };
  operatorId?: string | { _id: string };
  status?: "ACTIVE" | "WAITING" | "FINISHED" | string;
  lastMessageAt?: string;
  phone?: string;
  lastMessage?: { text?: string; body?: string; type?: "TEXT" | "IMAGE"; timestamp?: string | number };
  // agrega más campos si hace falta
}

export interface MessageDTO {
  id: string;
  chatId: string;
  sender: "CLIENT" | "BOT" | "OPERADOR" | "SYSTEM";
  type: "TEXT" | "IMAGE";
  content?: string;
  imageUrl?: string;
  timestamp: string;
}

/* ================= Utils ================= */
const toId = (x: any): string | undefined =>
  !x ? undefined : typeof x === "string" ? x : (x?._id ? String(x._id) : undefined);

const isActiveStatus = (s?: string) => {
  if (!s) return false;
  const u = String(s).toUpperCase();
  return ["ACTIVE", "OPEN", "EN_CURSO", "ASSIGNED"].includes(u);
};

const isAssignedTo = (chat: any, operatorId: string): boolean => {
  const oid = String(operatorId);
  const fields = [
    chat.assignedOperator,
    chat.operatorId,
    chat.operator,
    chat.assignedOperatorId,
  ].map(toId).filter(Boolean);
  return fields.includes(oid);
};

/* ================= Endpoints existentes (tuyos) ================= */

/** Detalle de chat (enforce server: 403 si no te pertenece) */
export async function getChatById(chatId: string) {
  const r = await fetch(`${BASE}/chat/${encodeURIComponent(chatId)}`, { headers: authHeaders() });
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<ChatDetailDTO>;
}

/** Mensajes del chat (ajustá a tu ruta real si difiere) */
export async function listMessages(chatId: string) {
  const r = await fetch(`${BASE}/chat/${encodeURIComponent(chatId)}/messages`, { headers: authHeaders() });
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<MessageDTO[]>;
}

/** Enviar mensaje (ajustá ruta si tu back usa otra) */
export async function sendMessage(
  chatId: string,
  body: { type: "TEXT" | "IMAGE"; content?: string; imageUrl?: string }
) {
  const r = await fetch(`${BASE}/chat/${encodeURIComponent(chatId)}/messages`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<MessageDTO>;
}

/* ================= NUEVO: traer chats asignados al operador ================= */

/**
 * Intenta múltiples rutas para obtener los "active chats" asignados a un operador:
 * 1) /operators/:id/active-chats           (si existe)
 * 2) /chat/with-last-message               (fallback A: filtra en front)
 * 3) /chat                                 (fallback B: filtra en front)
 * 4) /clients/assigned/:operatorId + /chat (fallback C: cruza por clientId)
 */
export async function listAssignedChats(operatorId: string): Promise<ChatDetailDTO[]> {
  const id = encodeURIComponent(operatorId);

  // 1) Intento directo (si tu back ya lo expone)
  {
    const r = await GET<ChatDetailDTO[] | any>(`${BASE}/operators/${id}/active-chats`);
    if (r.ok && Array.isArray(r.json)) {
      // Asumimos que ya viene filtrado por operador y estado
      return r.json as ChatDetailDTO[];
    }
  }

  // 2) with-last-message (filtrado en front)
  {
    const r = await GET<ChatDetailDTO[] | any>(`${BASE}/chat/with-last-message`);
    if (r.ok && Array.isArray(r.json)) {
      const list = (r.json as ChatDetailDTO[]).filter(
        (c) => isAssignedTo(c, operatorId) && isActiveStatus(c.status)
      );
      if (list.length) return list;
    }
  }

  // 3) /chat (filtrado en front)
  {
    const r = await GET<ChatDetailDTO[] | any>(`${BASE}/chat`);
    if (r.ok && Array.isArray(r.json)) {
      const list = (r.json as ChatDetailDTO[]).filter(
        (c) => isAssignedTo(c, operatorId) && isActiveStatus(c.status)
      );
      if (list.length) return list;
    }
  }

  // 4) Fallback por clientes asignados
  const clients = await GET<any[]>(`${BASE}/clients/assigned/${id}`);
  const clientIds: string[] = Array.isArray(clients.json)
    ? (clients.json as any[]).map(toId).filter(Boolean) as string[]
    : [];

  if (clientIds.length) {
    // conseguir todos los chats y cruzar por clientId
    const all = await GET<ChatDetailDTO[] | any>(`${BASE}/chat`);
    if (all.ok && Array.isArray(all.json)) {
      const list = (all.json as ChatDetailDTO[]).filter((c) => {
        const cid = toId(c.clientId);
        return cid && clientIds.includes(cid) && isActiveStatus(c.status);
      });
      if (list.length) return list;
    }
  }

  // Nada
  return [];
}

/**
 * Trae mensajes de todos los chats asignados a un operador.
 * Útil para hidratar el inbox al entrar.
 */
export async function listAssignedChatsWithMessages(operatorId: string): Promise<{
  chats: ChatDetailDTO[];
  byChat: Record<string, MessageDTO[]>;
}> {
  const chats = await listAssignedChats(operatorId);
  const byChat: Record<string, MessageDTO[]> = {};

  // Opcional: limitar por rendimiento
  const LIMITED = chats.slice(0, Number(process.env.NEXT_PUBLIC_MAX_ACTIVE ?? 6));

  await Promise.all(
    LIMITED.map(async (c) => {
      const chatId = toId((c as any).id) || toId((c as any)._id) || String((c as any).id || (c as any)._id || "");
      if (!chatId) return;
      try {
        const msgs = await listMessages(chatId);
        byChat[chatId] = msgs;
      } catch {
        byChat[chatId] = [];
      }
    })
  );

  return { chats, byChat };
}
