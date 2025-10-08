/* ============================================================
 * Helper Operadores + Chat (FRONT) — completo
 * - Crea chat con clientName (y metadata.clientName)
 * - Si back devuelve clientName null, intenta PATCH
 * - postChatMessage hace fallback si /chat/:id/messages no existe
 * - Exporta ensureOperatorContext + assignWithAutoHeal
 * - FIX: exporta createOperatorDirect (para login-form.tsx)
 * ============================================================ */

type Json = Record<string, any>;

/* ----------------------- Base URL ----------------------- */
export function resolveApiBase(): string {
  const raw =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_ECOM_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://localhost:3002";
  return raw.replace(/\/+$/, "");
}
export const API_BASE = resolveApiBase();

/* ----------------------- Normalizador de IDs ----------------------- */
function toIdString(v: any): string {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (typeof v === "object") {
    const cand =
      (v as any).id ??
      (v as any)._id ??
      (v as any).operatorId ??
      (v as any).operator?._id ??
      (v as any).operator?.id ??
      (v as any).userId ??
      (v as any).user?._id ??
      (typeof (v as any).toString === "function" ? (v as any).toString() : "");
    if (typeof cand === "string") return cand;
    if (typeof cand === "number") return String(cand);
  }
  return String(v);
}

/* ----------------------- Auth helpers ----------------------- */
export function readTokenFromStorage(): string | undefined {
  try {
    const cand = ["token", "access_token", "jwt", "AUTH_TOKEN", "auth-token", "AuthToken"];
    for (const k of cand) {
      const v = localStorage.getItem(k);
      if (v) return v.replace(/^"|"$/g, "");
    }
    const auth = localStorage.getItem("auth");
    if (auth) {
      const a = JSON.parse(auth);
      return a?.token || a?.accessToken || a?.jwt;
    }
  } catch {}
  return undefined;
}

export function readOperatorIdFromStorage(): string | undefined {
  try {
    const keys = ["user-OPERADOR", "user", "operator", "me", "profile"];
    for (const k of keys) {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const u = JSON.parse(raw);
      const id = toIdString(
        u?.id ??
          u?._id ??
          u?.operatorId ??
          u?.operator?._id ??
          u?.operator?.id ??
          u?.userId ??
          u?.user?._id ??
          u
      );
      if (id && id !== "[object Object]") return id;
    }

    const authRaw = localStorage.getItem("auth");
    if (authRaw) {
      const a = JSON.parse(authRaw);
      const id = toIdString(
        a?.operatorId ??
          a?.operator?._id ??
          a?.operator?.id ??
          a?.user?._id ??
          a?.user?.id ??
          a?.id ??
          a?._id
      );
      if (id && id !== "[object Object]") return id;
    }
  } catch {}
  return undefined;
}

export function saveOperatorLocal(id: string, extra?: Record<string, any>) {
  const base = { id, role: "OPERADOR", ...extra };
  localStorage.setItem("user-OPERADOR", JSON.stringify(base));
}

export async function ensureOperatorForUser(input?: { id?: string; dni?: number; email?: string; name?: string }) {
  const cand = input?.id || readOperatorIdFromStorage();
  if (cand) { saveOperatorLocal(String(cand)); return { ok: true, operatorId: String(cand) }; }
  return { ok: false, message: "No operator id available to persist locally" };
}

/* 👉 FIX: export que pedía tu build */
export async function createOperatorDirect(payload: { dni: number; email: string; name: string; password?: string }) {
  // Si tenés endpoint real, reemplazá por POST a tu API y guardá el id real.
  const fakeId = String(payload.dni || Date.now());
  saveOperatorLocal(fakeId, { name: payload.name, email: payload.email });
  return { id: fakeId, ...payload };
}

/* ----------------------- HTTP utils ----------------------- */
async function safeParseJSON(r: Response) {
  const raw = await r.text();
  if (!raw) return { ok: true, json: undefined, raw: "" };
  try { return { ok: true, json: JSON.parse(raw), raw }; }
  catch { return { ok: false, json: undefined, raw }; }
}
function headers(token?: string) {
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}
async function POST(url: string, body?: Json, token?: string) {
  return fetch(url, { method: "POST", headers: headers(token), body: body ? JSON.stringify(body) : undefined });
}
async function GET(url: string, token?: string) {
  return fetch(url, { method: "GET", headers: headers(token) });
}
async function PATCH(url: string, body: Json, token?: string) {
  return fetch(url, { method: "PATCH", headers: headers(token), body: JSON.stringify(body) });
}

/* ----------------------- Tipos ----------------------- */
export type OperatorState = "AVAILABLE" | "OFFLINE" | "BUSY";
export interface OperatorChatDTO {
  chatId: string;
  clientId: string;
  clientName?: string;
  status?: string;
  isOnline: boolean;
  lastMessageTime?: string | Date;
  lastMessagePreview?: string;
  phone?: string;
  channel?: string;
}
export interface ActiveChatsResult { ok: true; items: any[]; status: number; }
export interface ActiveChatsFail {
  ok: false; status?: number;
  reason: "NOT_FOUND_ROUTE" | "HTTP_ERROR" | "NETWORK_ERROR" | "INVALID_JSON";
  message?: string; raw?: string;
}
export type GetActiveChatsResult = ActiveChatsResult | ActiveChatsFail;

/* ----------------------- Cache local de asignados ----------------------- */
const CACHE_KEY = "assigned_chats_by_operator_v1";

export function loadAssignedCache(operatorId?: string): OperatorChatDTO[] {
  if (!operatorId) return [];
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const all = JSON.parse(raw) as Record<string, OperatorChatDTO[]>;
    const list = Array.isArray(all?.[operatorId]) ? all[operatorId] : [];
    return list.map((c) => ({
      ...c,
      lastMessageTime: c.lastMessageTime ? new Date(c.lastMessageTime) : undefined,
    }));
  } catch { return []; }
}

export function saveAssignedCache(operatorId: string, items: OperatorChatDTO[]) {
  if (!operatorId) return;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const all = raw ? JSON.parse(raw) : {};
    all[operatorId] = (items || []).map((c: any) => ({
      chatId: c.chatId,
      clientId: c.clientId,
      clientName: c.clientName,
      status: c.status,
      isOnline: !!c.isOnline,
      lastMessageTime: c.lastMessageTime ? new Date(c.lastMessageTime).toISOString() : undefined,
      lastMessagePreview: c.lastMessagePreview,
      phone: c.phone,
      channel: c.channel,
    }));
    localStorage.setItem(CACHE_KEY, JSON.stringify(all));
  } catch {}
}

export function clearAssignedCache(operatorId?: string) {
  try {
    if (!operatorId) { localStorage.removeItem(CACHE_KEY); return; }
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return;
    const all = JSON.parse(raw);
    delete all[operatorId];
    localStorage.setItem(CACHE_KEY, JSON.stringify(all));
  } catch {}
}

/* ----------------------- Asignación (incluye auto-heal) ----------------------- */
export interface AssignSuccess { ok: true; data: any; status: number }
export interface AssignFail {
  ok: false; status?: number; reason: "NOT_FOUND_ROUTE" | "NO_AVAILABLE" | "HTTP_ERROR" | "NETWORK_ERROR" | "INVALID_JSON" | "OP_OVERLOAD";
  message?: string; raw?: string;
}
export type AssignResult = AssignSuccess | AssignFail;

export async function assignOperator(token?: string, operatorId?: string): Promise<AssignResult> {
  const url = `${API_BASE}/operators/assign`;
  const authToken = token || readTokenFromStorage();

  try {
    const r = await fetch(url, { method: "POST", headers: headers(authToken) });
    const parsed = await safeParseJSON(r);

    if (!r.ok) {
      const msg = (parsed.json?.message || parsed.json?.error || parsed.raw || "").toString();
      const lower = msg.toLowerCase();

      if (r.status === 400) {
        // reintento con body abajo
      } else if (r.status === 404) {
        return { ok: false, reason: "NOT_FOUND_ROUTE", status: r.status, message: msg, raw: parsed.raw };
      } else if (lower.includes("no available") || lower.includes("no hay operadores")) {
        return { ok: false, reason: "NO_AVAILABLE", status: r.status, message: msg, raw: parsed.raw };
      } else if (lower.includes("active chats count") && lower.includes("exceed")) {
        return { ok: false, reason: "OP_OVERLOAD", status: r.status, message: msg, raw: parsed.raw };
      } else {
        return { ok: false, reason: "HTTP_ERROR", status: r.status, message: msg, raw: parsed.raw };
      }
    } else {
      if (!parsed.ok) return { ok: false, reason: "INVALID_JSON", status: r.status, raw: parsed.raw };
      return { ok: true, data: parsed.json, status: r.status };
    }
  } catch {}

  // 2) intento con body {operatorId}
  const id = operatorId || readOperatorIdFromStorage();
  try {
    const r2 = await fetch(url, {
      method: "POST",
      headers: headers(authToken),
      body: JSON.stringify({ operatorId: id }),
    });
    const parsed2 = await safeParseJSON(r2);

    if (!r2.ok) {
      const msg = (parsed2.json?.message || parsed2.json?.error || parsed2.raw || "").toString();
      const lower = msg.toLowerCase();
      if (r2.status === 404)
        return { ok: false, reason: "NOT_FOUND_ROUTE", status: r2.status, message: msg, raw: parsed2.raw };
      if (lower.includes("no available") || lower.includes("no hay operadores"))
        return { ok: false, reason: "NO_AVAILABLE", status: r2.status, message: msg, raw: parsed2.raw };
      if (lower.includes("active chats count") && lower.includes("exceed"))
        return { ok: false, reason: "OP_OVERLOAD", status: r2.status, message: msg, raw: parsed2.raw };
      return { ok: false, reason: "HTTP_ERROR", status: r2.status, message: msg, raw: parsed2.raw };
    }

    if (!parsed2.ok) return { ok: false, reason: "INVALID_JSON", status: r2.status, raw: parsed2.raw };
    return { ok: true, data: parsed2.json, status: r2.status };
  } catch (err: any) {
    return { ok: false, reason: "NETWORK_ERROR", message: err?.message };
  }
}

export async function releaseOperator(operatorId: string, token?: string) {
  const url = `${API_BASE}/operators/${operatorId}/release`;
  const r = await fetch(url, { method: "POST", headers: headers(token || readTokenFromStorage()) });
  return r.ok;
}

export async function assignWithAutoHeal(operatorId?: string, token?: string): Promise<AssignResult> {
  const res = await assignOperator(token, operatorId);
  if (!res.ok && res.reason === "OP_OVERLOAD" && operatorId) {
    try { await releaseOperator(operatorId, token); } catch {}
    return await assignOperator(token, operatorId);
  }
  return res;
}

/** <- ESTA es la que te faltaba en tu build */
export function ensureOperatorContext(): { token?: string; operatorId?: string } {
  if (typeof window === "undefined") return { token: undefined, operatorId: undefined };
  const token = readTokenFromStorage();

  let operatorId = readOperatorIdFromStorage();
  if (!operatorId || operatorId === "[object Object]") {
    const raw = localStorage.getItem("auth");
    if (raw) {
      try {
        const a = JSON.parse(raw);
        operatorId = toIdString(a?.operatorId ?? a?.operator?._id ?? a?.operator?.id ?? a?.user?._id);
      } catch {}
    }
  }
  operatorId = operatorId ? toIdString(operatorId).trim() : undefined;

  return { token, operatorId };
}

/* ----------------------- Active-chats / State / Available ----------------------- */
export async function getActiveChats(operatorId: string, token?: string): Promise<GetActiveChatsResult> {
  const id = toIdString(operatorId).trim();
  if (!id || id === "[object Object]") {
    console.warn("[getActiveChats] operatorId inválido:", operatorId);
    return { ok: false, reason: "INVALID_JSON", message: "invalid operatorId" };
  }

  const url = `${API_BASE}/operators/${encodeURIComponent(id)}/active-chats`;
  try {
    const r = await fetch(url, { headers: headers(token || readTokenFromStorage()) });
    const p = await safeParseJSON(r);
    if (!r.ok) {
      return {
        ok: false,
        reason: r.status === 404 ? "NOT_FOUND_ROUTE" : "HTTP_ERROR",
        status: r.status,
        message: p.json?.message || p.json?.error || p.raw,
        raw: p.raw
      };
    }
    if (!p.ok) return { ok: false, reason: "INVALID_JSON", status: r.status, raw: p.raw };

    const items = Array.isArray(p.json) ? p.json : p.json?.items ?? [];
    saveAssignedCache(id, items);
    return { ok: true, items, status: r.status };
  } catch (err: any) {
    return { ok: false, reason: "NETWORK_ERROR", message: err?.message };
  }
}

export async function setOperatorState(operatorId: string, state: "AVAILABLE" | "OFFLINE" | "BUSY", token?: string) {
  const url = `${API_BASE}/operators/${operatorId}/state`;
  const r = await PATCH(url, { state }, token || readTokenFromStorage());
  return r.ok;
}

export async function listAvailableOperators(token?: string): Promise<any[]> {
  const url = `${API_BASE}/operators/available`;
  try {
    const r = await fetch(url, { headers: headers(token || readTokenFromStorage()) });
    if (!r.ok) return [];
    const t = await r.text();
    try { return t ? JSON.parse(t) : []; } catch { return []; }
  } catch { return []; }
}

/* ====================== CHAT API ====================== */
const CHAT_PATH =
  process.env.ECOM_CHATS_PATH ||
  process.env.NEXT_PUBLIC_ECOM_CHATS_PATH ||
  "/chat";

const CHAT_WITH_LAST_PATH =
  process.env.ECOM_CHATS_WITH_LAST_PATH ||
  process.env.NEXT_PUBLIC_ECOM_CHATS_WITH_LAST_PATH ||
  "/chat/with-last-message";

export async function listChats(token?: string) {
  const url = `${API_BASE}${CHAT_PATH}`;
  const r = await GET(url, token || readTokenFromStorage());
  const p = await safeParseJSON(r);
  if (!r.ok || !p.ok) throw new Error(p.raw || "HTTP error in listChats");
  return p.json as any[];
}

export async function listChatsWithLastMessage(token?: string) {
  const url = `${API_BASE}${CHAT_WITH_LAST_PATH}`;
  const r = await GET(url, token || readTokenFromStorage());
  const p = await safeParseJSON(r);
  if (!r.ok || !p.ok) throw new Error(p.raw || "HTTP error in listChatsWithLastMessage");
  return p.json as any[];
}

export async function getChatMessages(chatId: string, token?: string) {
  const url = `${API_BASE}${CHAT_PATH}/${encodeURIComponent(chatId)}/messages`;
  const r = await GET(url, token || readTokenFromStorage());
  const p = await safeParseJSON(r);
  if (!r.ok || !p.ok) throw new Error(p.raw || "HTTP error in getChatMessages");
  return p.json as any[];
}

/* ---------- util phone → E.164 (simple) ---------- */
const onlyDigits = (s?: string) => (s ?? "").replace(/\D+/g, "");
export function toE164(input: string, defaultCountry?: string): string {
  let s = (input || "").trim();
  if (!s) return s;
  if (s.startsWith("+")) return s;
  if (s.startsWith("00")) return `+${s.slice(2)}`;
  const digits = onlyDigits(s);
  if (!digits) return s;
  const cc = (defaultCountry || process.env.NEXT_PUBLIC_PHONE_DEFAULT_PREFIX || "+")
    .toString()
    .replace(/^\+/, "");
  return cc ? `+${cc}${digits}` : `+${digits}`;
}

/* ---------- Create / Patch chat con clientName ---------- */
export async function createChat(
  payload: { clientId?: string; phone?: string; name?: string; clientName?: string; metadata?: Record<string, any> },
  token?: string
) {
  const url = `${API_BASE}${CHAT_PATH}/create`;

  const clientName = payload.clientName ?? payload.name ?? null;
  const body = {
    ...payload,
    clientName,
    metadata: {
      ...(payload.metadata || {}),
      ...(clientName ? { clientName } : {}),
    },
  };

  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  const t = await r.text();
  let j: any; try { j = t ? JSON.parse(t) : undefined; } catch {}
  if (!r.ok) throw new Error(j?.message || j?.error || t || `HTTP ${r.status}`);
  return j;
}

export async function patchChatClientName(chatId: string, clientName: string, token?: string) {
  // preferido: PATCH /chat/:id
  let r = await fetch(`${API_BASE}${CHAT_PATH}/${encodeURIComponent(chatId)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ clientName, metadata: { clientName } }),
  });

  // si tu API no lo tiene, probamos /chat/:id/metadata
  if (r.status === 404) {
    r = await fetch(`${API_BASE}${CHAT_PATH}/${encodeURIComponent(chatId)}/metadata`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ clientName }),
    });
  }
  return r.ok;
}

/* ---------- PHONE → chatId (cache local) ---------- */
const PHONE_TO_CHAT_KEY = "phone_to_chat_map_v1";
function loadPhoneToChat(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(PHONE_TO_CHAT_KEY) || "{}"); } catch { return {}; }
}
function savePhoneToChat(map: Record<string, string>) {
  try { localStorage.setItem(PHONE_TO_CHAT_KEY, JSON.stringify(map)); } catch {}
}

/** Garantiza un Chat real para un teléfono y guarda el mapping PHONE→chatId */
export async function ensureBackendChatForPhone(
  phoneE164: string,
  name?: string,
  token?: string
): Promise<string> {
  const map = loadPhoneToChat();
  if (map[phoneE164]) return map[phoneE164];

  const created = await createChat({ phone: phoneE164, clientName: name, name }, token);
  const chatId = toIdString(created?.id ?? created?.chatId ?? created?._id);
  if (!chatId) throw new Error("No chatId returned by /chat/create");

  if ((!created?.clientName || created.clientName === null) && name) {
    try { await patchChatClientName(chatId, name, token); } catch {}
  }

  map[phoneE164] = chatId;
  savePhoneToChat(map);
  return chatId;
}

/* ---------- Postear mensajes con fallback (no romper si no existe) ---------- */
export async function postChatMessage(
  chatId: string,
  payload: {
    sender: "CLIENT" | "OPERADOR" | "BOT" | "SYSTEM";
    type: "TEXT" | "IMAGE";
    content?: string;
    imageUrl?: string;
    timestamp?: string | number;
  },
  token?: string
): Promise<{ ok: boolean; status?: number; json?: any; tried: string[] }> {
  const tried: string[] = [];
  const auth = token || readTokenFromStorage();

  const commonBody = {
    chatId,
    sender: payload.sender,
    type: payload.type,
    content: payload.content,
    imageUrl: payload.imageUrl,
    timestamp: payload.timestamp ?? Date.now(),
    // alias para APIs legacy
    senderType: payload.sender,
    text: payload.content,
    body: payload.content,
    createdAt: payload.timestamp ?? Date.now(),
  };

  // 1) Ruta estándar
  try {
    const url1 = `${API_BASE}${CHAT_PATH}/${encodeURIComponent(chatId)}/messages`;
    tried.push(url1);
    const r1 = await fetch(url1, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
      },
      body: JSON.stringify(commonBody),
    });
    if (r1.ok) { const p = await safeParseJSON(r1); return { ok: true, status: r1.status, json: p.json, tried }; }
    if (r1.status !== 404) {
      const t = await r1.text(); console.warn("[postChatMessage] fallo ruta 1", r1.status, t);
    }
  } catch (e) {
    console.warn("[postChatMessage] error ruta 1", e);
  }

  // 2) Fallback: POST /chat/messages
  try {
    const url2 = `${API_BASE}${CHAT_PATH}/messages`;
    tried.push(url2);
    const r2 = await fetch(url2, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
      },
      body: JSON.stringify(commonBody),
    });
    if (r2.ok) { const p = await safeParseJSON(r2); return { ok: true, status: r2.status, json: p.json, tried }; }
    if (r2.status !== 404) {
      const t = await r2.text(); console.warn("[postChatMessage] fallo ruta 2", r2.status, t);
    }
  } catch (e) {
    console.warn("[postChatMessage] error ruta 2", e);
  }

  // 3) No existe endpoint → no romper
  console.info("[postChatMessage] ninguna ruta disponible, no se persiste en back. tried:", tried);
  return { ok: false, tried };
}

/* ---------- Map / DTO util ---------- */
export function mapChatWithLastToOperatorDTO(x: any): OperatorChatDTO {
  const id = String(x?.chatId ?? x?.id ?? x?._id ?? "");
  const last = x?.lastMessage ?? x?.last_message ?? x?.last ?? null;

  const lastTs = last?.timestamp ?? last?.ts ?? last?.createdAt ?? last?.date;
  const lastPreview =
    last?.type === "IMAGE" || last?.kind === "IMAGE"
      ? "📷 Imagen"
      : last?.content ?? last?.text ?? last?.body ?? "";

  return {
    chatId: id,
    clientId: String(x?.clientId ?? x?.client_id ?? id),
    clientName: x?.clientName ?? x?.client_name ?? "Cliente",
    status: (x?.status ?? "ACTIVE").toUpperCase?.() ?? "ACTIVE",
    isOnline: Boolean(x?.isOnline ?? true),
    lastMessageTime: lastTs ? new Date(lastTs).toISOString() : undefined,
    lastMessagePreview: lastPreview,
    phone: x?.phone,
    channel: x?.channel,
  };
}

/* ---------- Asignar un chat específico (si tu back lo soporta) ---------- */
export async function ensureAssignmentForChat(
  chatId: string,
  token?: string
): Promise<AssignResult> {
  const auth = token || readTokenFromStorage();
  const safeId = encodeURIComponent(chatId);

  // Preferido: endpoint específico del chat (si existe)
  try {
    const url = `${API_BASE}${CHAT_PATH}/${safeId}/assign`;
    const r = await fetch(url, { method: "POST", headers: headers(auth) });
    const p = await safeParseJSON(r);
    if (r.ok && p.ok) return { ok: true, data: p.json, status: r.status };
    if (r.status !== 404) {
      return {
        ok: false,
        reason: "HTTP_ERROR",
        status: r.status,
        message: p.json?.message || p.raw,
        raw: p.raw,
      };
    }
  } catch {}

  // Fallback: asignación genérica
  return assignOperator(auth);
}
