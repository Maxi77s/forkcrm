/* ============================================================
 * Helper Operadores + Chat (FRONT) — completo
 * - Crea chat con clientName (y metadata.clientName)
 * - Si back devuelve clientName null, intenta PATCH
 * - postChatMessage hace fallback si /chat/:id/messages no existe
 * - Exporta ensureOperatorContext + assignWithAutoHeal
 * - FIX: exporta createOperatorDirect (para login-form.tsx)
 * - NUEVO: exporta fetchUserNamesByIds(ids) para hidratar nombres por userId
 * - NUEVO: exporta forcePersistClientName(...) para cache local + patch opcional
 * ============================================================ */

type Json = Record<string, any>;

/* ---------- phone utils ---------- */
const __digits = (s?: string) => String(s || "").replace(/[^\d]/g, "");

function __getPhoneFromItem(x: any): string | undefined {
  return (
    x?.phone ??
    x?.client?.phone ??
    x?.user?.phone ??
    x?.metadata?.phone ??
    x?.meta?.phone
  );
}

function __findChatByPhoneLocal(list: any[], phoneE164: string): any | undefined {
  if (!Array.isArray(list) || !phoneE164) return undefined;
  const want = __digits(phoneE164);
  return list.find((c) => __digits(__getPhoneFromItem(c)) === want);
}


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
    const cand = [
      "token",
      "access_token",
      "jwt",
      "AUTH_TOKEN",
      "auth-token",
      "AuthToken",
    ];
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

export async function ensureOperatorForUser(input?: {
  id?: string;
  dni?: number;
  email?: string;
  name?: string;
}) {
  const cand = input?.id || readOperatorIdFromStorage();
  if (cand) {
    saveOperatorLocal(String(cand));
    return { ok: true, operatorId: String(cand) };
  }
  return { ok: false, message: "No operator id available to persist locally" };
}

/* 👉 FIX: export que pedía tu build */
export async function createOperatorDirect(payload: {
  dni: number;
  email: string;
  name: string;
  password?: string;
}) {
  // Si tenés endpoint real, reemplazá por POST a tu API y guardá el id real.
  const fakeId = String(payload.dni || Date.now());
  saveOperatorLocal(fakeId, { name: payload.name, email: payload.email });
  return { id: fakeId, ...payload };
}

/* ----------------------- HTTP utils ----------------------- */
async function safeParseJSON(r: Response) {
  const raw = await r.text();
  if (!raw) return { ok: true, json: undefined, raw: "" };
  try {
    return { ok: true, json: JSON.parse(raw), raw };
  } catch {
    return { ok: false, json: undefined, raw };
  }
}
function headers(token?: string) {
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}
async function POST(url: string, body?: Json, token?: string) {
  return fetch(url, {
    method: "POST",
    headers: headers(token),
    body: body ? JSON.stringify(body) : undefined,
  });
}
async function GET(url: string, token?: string) {
  return fetch(url, { method: "GET", headers: headers(token) });
}
async function PATCH(url: string, body: Json, token?: string) {
  return fetch(url, {
    method: "PATCH",
    headers: headers(token),
    body: JSON.stringify(body),
  });
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
export interface ActiveChatsResult {
  ok: true;
  items: any[];
  status: number;
}
export interface ActiveChatsFail {
  ok: false;
  status?: number;
  reason: "NOT_FOUND_ROUTE" | "HTTP_ERROR" | "NETWORK_ERROR" | "INVALID_JSON";
  message?: string;
  raw?: string;
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
      lastMessageTime: c.lastMessageTime
        ? new Date(c.lastMessageTime)
        : undefined,
    }));
  } catch {
    return [];
  }
}

export function saveAssignedCache(
  operatorId: string,
  items: OperatorChatDTO[]
) {
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
      lastMessageTime: c.lastMessageTime
        ? new Date(c.lastMessageTime).toISOString()
        : undefined,
      lastMessagePreview: c.lastMessagePreview,
      phone: c.phone,
      channel: c.channel,
    }));
    localStorage.setItem(CACHE_KEY, JSON.stringify(all));
  } catch {}
}

export function clearAssignedCache(operatorId?: string) {
  try {
    if (!operatorId) {
      localStorage.removeItem(CACHE_KEY);
      return;
    }
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return;
    const all = JSON.parse(raw);
    delete all[operatorId];
    localStorage.setItem(CACHE_KEY, JSON.stringify(all));
  } catch {}
}

/* ----------------------- Asignación (incluye auto-heal) ----------------------- */
export interface AssignSuccess {
  ok: true;
  data: any;
  status: number;
}
export interface AssignFail {
  ok: false;
  status?: number;
  reason:
    | "NOT_FOUND_ROUTE"
    | "NO_AVAILABLE"
    | "HTTP_ERROR"
    | "NETWORK_ERROR"
    | "INVALID_JSON"
    | "OP_OVERLOAD";
  message?: string;
  raw?: string;
}
export type AssignResult = AssignSuccess | AssignFail;

export async function assignOperator(
  token?: string,
  operatorId?: string
): Promise<AssignResult> {
  const url = `${API_BASE}/operators/assign`;
  const authToken = token || readTokenFromStorage();

  try {
    const r = await fetch(url, { method: "POST", headers: headers(authToken) });
    const parsed = await safeParseJSON(r);

    if (!r.ok) {
      const msg = (
        parsed.json?.message ||
        parsed.json?.error ||
        parsed.raw ||
        ""
      ).toString();
      const lower = msg.toLowerCase();

      if (r.status === 400) {
        // reintento con body abajo
      } else if (r.status === 404) {
        return {
          ok: false,
          reason: "NOT_FOUND_ROUTE",
          status: r.status,
          message: msg,
          raw: parsed.raw,
        };
      } else if (
        lower.includes("no available") ||
        lower.includes("no hay operadores")
      ) {
        return {
          ok: false,
          reason: "NO_AVAILABLE",
          status: r.status,
          message: msg,
          raw: parsed.raw,
        };
      } else if (
        lower.includes("active chats count") &&
        lower.includes("exceed")
      ) {
        return {
          ok: false,
          reason: "OP_OVERLOAD",
          status: r.status,
          message: msg,
          raw: parsed.raw,
        };
      } else {
        return {
          ok: false,
          reason: "HTTP_ERROR",
          status: r.status,
          message: msg,
          raw: parsed.raw,
        };
      }
    } else {
      if (!parsed.ok)
        return {
          ok: false,
          reason: "INVALID_JSON",
          status: r.status,
          raw: parsed.raw,
        };
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
      const msg = (
        parsed2.json?.message ||
        parsed2.json?.error ||
        parsed2.raw ||
        ""
      ).toString();
      const lower = msg.toLowerCase();
      if (r2.status === 404)
        return {
          ok: false,
          reason: "NOT_FOUND_ROUTE",
          status: r2.status,
          message: msg,
          raw: parsed2.raw,
        };
      if (lower.includes("no available") || lower.includes("no hay operadores"))
        return {
          ok: false,
          reason: "NO_AVAILABLE",
          status: r2.status,
          message: msg,
          raw: parsed2.raw,
        };
      if (lower.includes("active chats count") && lower.includes("exceed"))
        return {
          ok: false,
          reason: "OP_OVERLOAD",
          status: r2.status,
          message: msg,
          raw: parsed2.raw,
        };
      return {
        ok: false,
        reason: "HTTP_ERROR",
        status: r2.status,
        message: msg,
        raw: parsed2.raw,
      };
    }

    if (!parsed2.ok)
      return {
        ok: false,
        reason: "INVALID_JSON",
        status: r2.status,
        raw: parsed2.raw,
      };
    return { ok: true, data: parsed2.json, status: r2.status };
  } catch (err: any) {
    return { ok: false, reason: "NETWORK_ERROR", message: err?.message };
  }
}

export async function releaseOperator(operatorId: string, token?: string) {
  const url = `${API_BASE}/operators/${operatorId}/release`;
  const r = await fetch(url, {
    method: "POST",
    headers: headers(token || readTokenFromStorage()),
  });
  return r.ok;
}

export async function assignWithAutoHeal(
  operatorId?: string,
  token?: string
): Promise<AssignResult> {
  const res = await assignOperator(token, operatorId);
  if (!res.ok && res.reason === "OP_OVERLOAD" && operatorId) {
    try {
      await releaseOperator(operatorId, token);
    } catch {}
    return await assignOperator(token, operatorId);
  }
  return res;
}

/** <- ESTA es la que te faltaba en tu build */
export function ensureOperatorContext(): {
  token?: string;
  operatorId?: string;
} {
  if (typeof window === "undefined")
    return { token: undefined, operatorId: undefined };
  const token = readTokenFromStorage();

  let operatorId = readOperatorIdFromStorage();
  if (!operatorId || operatorId === "[object Object]") {
    const raw = localStorage.getItem("auth");
    if (raw) {
      try {
        const a = JSON.parse(raw);
        operatorId = toIdString(
          a?.operatorId ?? a?.operator?._id ?? a?.operator?.id ?? a?.user?._id
        );
      } catch {}
    }
  }
  operatorId = operatorId ? toIdString(operatorId).trim() : undefined;

  return { token, operatorId };
}

/* ----------------------- Active-chats / State / Available ----------------------- */
export async function getActiveChats(
  operatorId: string,
  token?: string
): Promise<GetActiveChatsResult> {
  const id = toIdString(operatorId).trim();
  if (!id || id === "[object Object]") {
    console.warn("[getActiveChats] operatorId inválido:", operatorId);
    return { ok: false, reason: "INVALID_JSON", message: "invalid operatorId" };
  }

  const url = `${API_BASE}/operators/${encodeURIComponent(id)}/active-chats`;
  try {
    const r = await fetch(url, {
      headers: headers(token || readTokenFromStorage()),
    });
    const p = await safeParseJSON(r);
    if (!r.ok) {
      return {
        ok: false,
        reason: r.status === 404 ? "NOT_FOUND_ROUTE" : "HTTP_ERROR",
        status: r.status,
        message: p.json?.message || p.json?.error || p.raw,
        raw: p.raw,
      };
    }
    if (!p.ok)
      return {
        ok: false,
        reason: "INVALID_JSON",
        status: r.status,
        raw: p.raw,
      };

    const items = Array.isArray(p.json) ? p.json : p.json?.items ?? [];
    saveAssignedCache(id, items);
    return { ok: true, items, status: r.status };
  } catch (err: any) {
    return { ok: false, reason: "NETWORK_ERROR", message: err?.message };
  }
}

export async function setOperatorState(
  operatorId: string,
  state: "AVAILABLE" | "OFFLINE" | "BUSY",
  token?: string
) {
  const url = `${API_BASE}/operators/${operatorId}/state`;
  const r = await PATCH(url, { state }, token || readTokenFromStorage());
  return r.ok;
}

export async function listAvailableOperators(token?: string): Promise<any[]> {
  const url = `${API_BASE}/operators/available`;
  try {
    const r = await fetch(url, {
      headers: headers(token || readTokenFromStorage()),
    });
    if (!r.ok) return [];
    const t = await r.text();
    try {
      return t ? JSON.parse(t) : [];
    } catch {
      return [];
    }
  } catch {
    return [];
  }
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
  if (!r.ok || !p.ok)
    throw new Error(p.raw || "HTTP error in listChatsWithLastMessage");
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
  const cc = (
    defaultCountry ||
    process.env.NEXT_PUBLIC_PHONE_DEFAULT_PREFIX ||
    "+"
  )
    .toString()
    .replace(/^\+/, "");
  return cc ? `+${cc}${digits}` : `+${digits}`;
}

/* ---------- Create / Patch chat con clientName ---------- */
export async function createChat(
  payload: {
    clientId?: string;
    phone?: string;
    name?: string;
    clientName?: string;
    metadata?: Record<string, any>;
  },
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
  let j: any;
  try {
    j = t ? JSON.parse(t) : undefined;
  } catch {}
  if (!r.ok) throw new Error(j?.message || j?.error || t || `HTTP ${r.status}`);
  return j;
}

export async function patchChatClientName(
  chatId: string,
  clientName: string,
  token?: string
) {
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
    r = await fetch(
      `${API_BASE}${CHAT_PATH}/${encodeURIComponent(chatId)}/metadata`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ clientName }),
      }
    );
  }
  return r.ok;
}

/* ---------- PHONE → chatId (cache local) ---------- */
const PHONE_TO_CHAT_KEY = "phone_to_chat_map_v1";
function loadPhoneToChat(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(PHONE_TO_CHAT_KEY) || "{}");
  } catch {
    return {};
  }
}
function savePhoneToChat(map: Record<string, string>) {
  try {
    localStorage.setItem(PHONE_TO_CHAT_KEY, JSON.stringify(map));
  } catch {}
}

/** Garantiza un Chat real para un teléfono y guarda el mapping PHONE→chatId */
export async function ensureBackendChatForPhone(
  phoneE164: string,
  name?: string,
  token?: string
): Promise<string> {
  const map = loadPhoneToChat();
  if (map[phoneE164]) return map[phoneE164];

  const created = await createChat(
    { phone: phoneE164, clientName: name, name },
    token
  );
  const chatId = toIdString(created?.id ?? created?.chatId ?? created?._id);
  if (!chatId) throw new Error("No chatId returned by /chat/create");

  if ((!created?.clientName || created.clientName === null) && name) {
    try {
      await patchChatClientName(chatId, name, token);
    } catch {}
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
    const url1 = `${API_BASE}${CHAT_PATH}/${encodeURIComponent(
      chatId
    )}/messages`;
    tried.push(url1);
    const r1 = await fetch(url1, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
      },
      body: JSON.stringify(commonBody),
    });
    if (r1.ok) {
      const p = await safeParseJSON(r1);
      return { ok: true, status: r1.status, json: p.json, tried };
    }
    if (r1.status !== 404) {
      const t = await r1.text();
      console.warn("[postChatMessage] fallo ruta 1", r1.status, t);
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
    if (r2.ok) {
      const p = await safeParseJSON(r2);
      return { ok: true, status: r2.status, json: p.json, tried };
    }
    if (r2.status !== 404) {
      const t = await r2.text();
      console.warn("[postChatMessage] fallo ruta 2", r2.status, t);
    }
  } catch (e) {
    console.warn("[postChatMessage] error ruta 2", e);
  }

  // 3) No existe endpoint → no romper
  console.info(
    "[postChatMessage] ninguna ruta disponible, no se persiste en back. tried:",
    tried
  );
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
  _chatId: string,
  token?: string,
  clientId?: string,
  operatorId?: string,
  opts?: {
    clientName?: string;
    debounceMs?: number;
    canonicalChatId?: string;
  }
): Promise<AssignResult> {
  const auth = token || readTokenFromStorage();
  if (!clientId) {
    return { ok: false, reason: "INVALID_JSON", message: "clientId is required" } as any;
  }

  try {
    const key = `assign_lock_${clientId}`;
    const now = Date.now();
    const win = Math.max(0, opts?.debounceMs ?? 8000);
    const last = Number(localStorage.getItem(key) || "0");
    if (now - last < win) {
      return { ok: true, data: { skipped: true, recent: true }, status: 200 };
    }
    localStorage.setItem(key, String(now));
  } catch {}

  const payload: any = { clientId: String(clientId) };
  if (operatorId) payload.operatorId = String(operatorId);
  if (opts?.clientName) payload.clientName = String(opts.clientName);
  if (opts?.canonicalChatId) payload.canonicalChatId = String(opts.canonicalChatId);

  try {
    const r = await fetch(`${API_BASE}/operators/assign`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    const p = await (async () => {
      try { return { ok: true, json: await r.json(), raw: "" }; }
      catch { return { ok: false, json: undefined as any, raw: await r.text() }; }
    })();

    if (!r.ok) {
      return {
        ok: false,
        reason: r.status === 404 ? "NOT_FOUND_ROUTE" : "HTTP_ERROR",
        status: r.status,
        message: p.json?.message || p.raw,
        raw: p.raw,
      };
    }

    if (!p.ok) {
      return { ok: false, reason: "INVALID_JSON", status: r.status, raw: p.raw };
    }

    const assigned = p.json;
    const assignedChatId: string | undefined = String(
      assigned?.chatId ?? assigned?.id ?? assigned?._id ?? ""
    ) || undefined;

    if (opts?.clientName && assignedChatId) {
      const returnedName =
        assigned?.clientName ??
        assigned?.client_name ??
        assigned?.chat?.clientName ??
        assigned?.chat?.client_name ??
        null;

      if (returnedName === null || String(returnedName || "").trim() === "") {
        try {
          await patchChatClientName(assignedChatId, String(opts.clientName), auth);
        } catch {}
      }
    }

    return { ok: true, data: assigned, status: r.status };
  } catch (err: any) {
    return { ok: false, reason: "NETWORK_ERROR", message: err?.message };
  }
}

/* ---------- Solicitar operador (alias usado por el front) ---------- */
export async function requestOperatorForChat(input: {
  chatId: string;
  clientId: string;
  token?: string;
  operatorId?: string;
}): Promise<AssignResult> {
  const { chatId, clientId, token, operatorId } = input;

  if (!chatId) return { ok: false, reason: "INVALID_JSON", message: "chatId is required" } as any;
  if (!clientId || typeof clientId !== "string") {
    return { ok: false, reason: "INVALID_JSON", message: "clientId must be a string" } as any;
  }

  const auth = token || readTokenFromStorage();
  const url = `${API_BASE}/operators/assign`;

  const body: any = {
    chatId: String(chatId),
    clientId: String(clientId),
  };
  if (operatorId) body.operatorId = String(operatorId);

  try {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
      },
      body: JSON.stringify(body),
    });
    const p = await safeParseJSON(r);

    if (r.ok && p.ok) return { ok: true, data: p.json, status: r.status };
    return {
      ok: false,
      reason: r.status === 404 ? "NOT_FOUND_ROUTE" : "HTTP_ERROR",
      status: r.status,
      message: p.json?.message || p.raw,
      raw: p.raw,
    };
  } catch (err: any) {
    return { ok: false, reason: "NETWORK_ERROR", message: err?.message };
  }
}

/* ---------- Resolver de chatId autoritativo (evita "Chat no encontrado") ---------- */
export function resolveAuthoritativeChatId(
  candidateChatId: string | undefined,
  knownChats: Array<{ chatId?: string; id?: string; clientId?: string; phone?: string; metadata?: any; meta?: any; client?: any; user?: any; canonicalChatId?: string }>,
  opts: { canonicalChatId?: string; clientId?: string; phone?: string } = {}
): string | undefined {
  if (!Array.isArray(knownChats) || knownChats.length === 0) return candidateChatId;

  // 1) si el id ya existe en la lista, es válido
  if (candidateChatId && knownChats.some(c => c.chatId === candidateChatId || c.id === candidateChatId)) {
    return candidateChatId;
  }

  // 2) por canonical
  const can = (opts.canonicalChatId || "").trim();
  if (can) {
    const byCan = knownChats.find(c => {
      const cc =
        c?.metadata?.canonicalChatId || c?.metadata?.canonical_id ||
        c?.meta?.canonicalChatId || c?.meta?.canonical_id || c?.canonicalChatId;
      return cc && String(cc) === can;
    });
    if (byCan) return byCan.chatId || byCan.id;
  }

  // 3) por clientId
  if (opts.clientId) {
    const byClient = knownChats.find(c => String(c.clientId || "") === String(opts.clientId));
    if (byClient) return byClient.chatId || byClient.id;
  }

  // 4) por phone
  const wantPhone = __digits(opts.phone);
  if (wantPhone) {
    const byPhone = knownChats.find(c => __digits(c.phone || c.client?.phone || c.user?.phone || c.metadata?.phone) === wantPhone);
    if (byPhone) return byPhone.chatId || byPhone.id;
  }

  return candidateChatId;
}

/* ---------- ensureBackendChatForPhoneSafe y ensureAssignmentForChatSafe ---------- */
export async function ensureBackendChatForPhoneSafe(
  knownChats: any[] = [],
  phoneE164: string,
  name?: string,
  token?: string,
  opts: { allowCreate?: boolean } = {}
): Promise<string> {
  const allowCreate = !!opts.allowCreate;

  // 0) Si en la lista local ya está, usarlo
  const local = __findChatByPhoneLocal(knownChats, phoneE164);
  if (local) {
    const id = String(local.chatId ?? local.id ?? local._id ?? "");
    if (id) return id;
  }

  // 1) Revisar cache PHONE→chat y validar que exista
  const map = loadPhoneToChat();
  const cachedId = map[phoneE164];
  if (cachedId) {
    const stillInLocal = knownChats?.some((c) => c.chatId === cachedId || c.id === cachedId);
    if (stillInLocal) return cachedId;

    // Validar contra el servidor (intenta with-last y luego list)
    try {
      const server1 = await listChatsWithLastMessage(token);
      const found1 = server1.find((c: any) => __digits(__getPhoneFromItem(c)) === __digits(phoneE164));
      if (found1) {
        const id = String(found1.chatId ?? found1.id ?? found1._id ?? "");
        if (id) {
          map[phoneE164] = id;
          savePhoneToChat(map);
          return id;
        }
      }
    } catch {}
    try {
      const server2 = await listChats(token);
      const found2 = server2.find((c: any) => __digits(__getPhoneFromItem(c)) === __digits(phoneE164));
      if (found2) {
        const id = String(found2.chatId ?? found2.id ?? found2._id ?? "");
        if (id) {
          map[phoneE164] = id;
          savePhoneToChat(map);
          return id;
        }
      }
    } catch {}

    // cache estaba stale → la limpiamos para este phone
    delete map[phoneE164];
    savePhoneToChat(map);
  }

  // 2) Buscar en servidor aunque no haya cache (para evitar crear)
  try {
    const server1 = await listChatsWithLastMessage(token);
    const found1 = server1.find((c: any) => __digits(__getPhoneFromItem(c)) === __digits(phoneE164));
    if (found1) {
      const id = String(found1.chatId ?? found1.id ?? found1._id ?? "");
      if (id) {
        map[phoneE164] = id;
        savePhoneToChat(map);
        return id;
      }
    }
  } catch {}
  try {
    const server2 = await listChats(token);
    const found2 = server2.find((c: any) => __digits(__getPhoneFromItem(c)) === __digits(phoneE164));
    if (found2) {
      const id = String(found2.chatId ?? found2.id ?? found2._id ?? "");
      if (id) {
        map[phoneE164] = id;
        savePhoneToChat(map);
        return id;
      }
    }
  } catch {}

  // 3) Si no encontramos y NO está permitido crear → devolvemos error
  if (!allowCreate) {
    throw new Error("EXISTING_CHAT_NOT_FOUND_FOR_PHONE");
  }

  // 4) Crear explícitamente
  const created = await createChat({ phone: phoneE164, clientName: name, name }, token);
  const chatId = String(created?.id ?? created?.chatId ?? created?._id ?? "");
  if (!chatId) throw new Error("No chatId returned by /chat/create");

  // Si el back devolvió clientName null y tenemos name, intentar patch
  if ((!created?.clientName || created.clientName === null) && name) {
    try { await patchChatClientName(chatId, name, token); } catch {}
  }

  map[phoneE164] = chatId;
  savePhoneToChat(map);
  return chatId;
}

export async function ensureAssignmentForChatSafe(
  knownChats: Array<{ clientId?: string; phone?: string; metadata?: any; [k: string]: any }>,
  _chatId: string,
  token?: string,
  clientId?: string,
  operatorId?: string,
  opts: { canonicalChatId?: string; phone?: string; throttleMs?: number } = {}
): Promise<AssignResult> {
  if (!clientId) {
    return { ok: false, reason: "INVALID_JSON", message: "clientId is required" } as any;
  }

  const canonicalChatId = (opts.canonicalChatId || "").trim();
  const wantPhone = __digits(opts.phone);

  // 1) ¿ya existe chat?
  const exists = (knownChats || []).some((ch) => {
    const chClient = ch?.clientId ? String(ch.clientId) : "";
    const chPhone = __digits(__getPhoneFromItem(ch));
    const chCan =
      ch?.metadata?.canonicalChatId ||
      ch?.metadata?.canonical_id ||
      ch?.meta?.canonicalChatId ||
      ch?.canonicalChatId ||
      "";
    return (
      (chClient && chClient === String(clientId)) ||
      (canonicalChatId && String(chCan) === canonicalChatId) ||
      (wantPhone && chPhone === wantPhone)
    );
  });
  if (exists) return { ok: true, reason: "ALREADY_PRESENT" } as any;

  // 2) throttle
  const key = canonicalChatId || String(clientId);
  const throttleMs = Number.isFinite(opts.throttleMs as any) ? Number(opts.throttleMs) : 8000;
  const lastMap: Map<string, number> =
    (ensureAssignmentForChatSafe as any).__lastAssignAt ||
    ((ensureAssignmentForChatSafe as any).__lastAssignAt = new Map<string, number>());
  const now = Date.now();
  const last = lastMap.get(key) || 0;
  if (now - last < throttleMs) return { ok: true, reason: "THROTTLED" } as any;
  lastMap.set(key, now);

  // 3) delega al assign real
  return await ensureAssignmentForChat(_chatId, token, clientId, operatorId);
}

/* =================== NUEVO: Batch de nombres por userId =================== */
/**
 * Intenta rutas comunes:
 * - POST /users/names         => {map:{id:name}} o {names:{id:name}}
 * - POST /users/by-ids        => {users:[{id,name|fullName|nombre|firstName,lastName}]}
 * - GET  /users/names?ids=1,2 => {map:{id:name}} o {names:{id:name}}
 * - Fallback GET /users/:id   => {id, name|fullName|nombre|firstName,lastName}
 */
export async function fetchUserNamesByIds(
  ids: string[],
  token?: string
): Promise<Record<string, string>> {
  if (!ids?.length) return {};
  const auth = token || readTokenFromStorage();

  // 1) POST /users/names
  try {
    const r = await POST(`${API_BASE}/users/names`, { ids }, auth);
    if (r.ok) {
      const { ok, json } = await safeParseJSON(r);
      if (ok && json && typeof json === "object") {
        const m = json.map || json.names;
        if (m && typeof m === "object") return m;
        const arr = json.users || json;
        if (Array.isArray(arr)) {
          const out: Record<string, string> = {};
          for (const it of arr) {
            const nm =
              it?.name ||
              it?.fullName ||
              it?.fullname ||
              it?.nombre ||
              [it?.firstName, it?.lastName].filter(Boolean).join(" ");
            if (it?.id && nm) out[String(it.id)] = String(nm);
          }
          if (Object.keys(out).length) return out;
        }
      }
    }
  } catch {}

  // 2) POST /users/by-ids
  try {
    const r = await POST(`${API_BASE}/users/by-ids`, { ids }, auth);
    if (r.ok) {
      const { ok, json } = await safeParseJSON(r);
      if (ok && json) {
        const arr = json.users || json;
        if (Array.isArray(arr)) {
          const out: Record<string, string> = {};
          for (const it of arr) {
            const nm =
              it?.name ||
              it?.fullName ||
              it?.fullname ||
              it?.nombre ||
              [it?.firstName, it?.lastName].filter(Boolean).join(" ");
            if (it?.id && nm) out[String(it.id)] = String(nm);
          }
          if (Object.keys(out).length) return out;
        }
        const m = json.map || json.names;
        if (m && typeof m === "object") return m;
      }
    }
  } catch {}

  // 3) GET /users/names?ids=...
  try {
    const q = encodeURIComponent(ids.join(","));
    const r = await GET(`${API_BASE}/users/names?ids=${q}`, auth);
    if (r.ok) {
      const { ok, json } = await safeParseJSON(r);
      if (ok && json && typeof json === "object") {
        const m = json.map || json.names;
        if (m && typeof m === "object") return m;
      }
    }
  } catch {}

  // 4) Fallback 1x1
  const fallback: Record<string, string> = {};
  for (const id of ids) {
    try {
      const r = await GET(`${API_BASE}/users/${encodeURIComponent(id)}`, auth);
      if (!r.ok) continue;
      const { ok, json } = await safeParseJSON(r);
      if (ok && json) {
        const nm =
          json?.name ||
          json?.fullName ||
          json?.fullname ||
          json?.nombre ||
          [json?.firstName, json?.lastName].filter(Boolean).join(" ");
        if (nm) fallback[id] = String(nm);
      }
    } catch {}
  }
  return fallback;
}

/* =========== Persistencia de nombres (cache local + evento + patch) =========== */
const NAME_AUTH_KEY = "chatlist.nameAuthority.v2";

function __loadNameAuthority(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(NAME_AUTH_KEY) || "{}"); } catch { return {}; }
}
function __saveNameAuthority(map: Record<string, string>) {
  try { localStorage.setItem(NAME_AUTH_KEY, JSON.stringify(map)); } catch {}
}
function __digitsOnly(s?: string) { return String(s || "").replace(/\D+/g, ""); }

/**
 * Fuerza la persistencia de un nombre para un cliente/usuario/teléfono y notifica a la UI.
 * - name: string no vacío (se respeta tal cual, incluso "usuario")
 * - clientId/userId/phone para las claves de autoridad
 * - chatId/token para intentar patch en el back (opcional, pero recomendable)
 */
export async function forcePersistClientName(opts: {
  name: string;
  clientId?: string;
  userId?: string;
  phone?: string;
  chatId?: string;
  token?: string;
}) {
  const n = (opts?.name || "").trim();
  if (!n) return;

  // 1) persistencia local
  const map = __loadNameAuthority();
  const keys: string[] = [];
  if (opts.clientId) keys.push(`client:${String(opts.clientId)}`);
  if (opts.userId)   keys.push(`user:${String(opts.userId)}`);
  const dig = __digitsOnly(opts.phone);
  if (dig)           keys.push(`tel:${dig}`);

  let changed = false;
  for (const k of keys) {
    if (!map[k] || map[k] !== n) { map[k] = n; changed = true; }
  }
  if (changed) __saveNameAuthority(map);

  // 2) notificar a cualquier lista abierta para que re-renderice ya
  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(new CustomEvent("chat.name.force", { detail: opts }));
    } catch {}
  }

  // 3) parchear back si tengo chatId
  if (opts.chatId) {
    try {
      await patchChatClientName(String(opts.chatId), n, opts.token);
    } catch {}
  }
}
