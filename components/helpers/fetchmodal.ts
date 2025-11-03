// components/helpers/fetchmodal.ts

export type ChatRow = {
  chatId: string;
  clientName?: string;
  phone?: string;
  dni?: string;
  lastMessageAt?: string | Date;
  raw?: any; // por si querés inspeccionar
};

type FetchOptions = {
  baseUrl?: string;      // si no lo pasás, usa NEXT_PUBLIC_API_URL
  withLastMessage?: boolean;
  token?: string | null; // si tu back usa Bearer; si no, ignoralo
  signal?: AbortSignal;
};

/** Resuelve la base del backend */
export function resolveApiBase(custom?: string) {
  const fromEnv =
    custom ||
    process.env.NEXT_PUBLIC_API_URL ||
    (typeof window !== "undefined" ? (window as any).__API_BASE__ : "") ||
    "";
  return fromEnv.replace(/\/+$/, "");
}

/** Normaliza el chat del back a ChatRow (lo más genérico posible) */
function mapChatRow(x: any): ChatRow {
  // Intento cubrir estructuras típicas:
  // - x._id o x.id como chatId
  // - x.client{ name, phone, dni } o x.customer{...} o aplanado
  const chatId = String(x?._id || x?.id || x?.chatId || "");
  const client = x?.client || x?.customer || x?.usuario || x;
  const clientName: string | undefined =
    client?.name || client?.fullName || client?.clientName || client?.nombre;
  const phone: string | undefined =
    client?.phone || client?.telefono || client?.mobile || x?.phone;
  const dni: string | undefined =
    client?.dni || client?.document || client?.documentNumber || x?.dni;
  const lastMessageAt =
    x?.lastMessageAt || x?.lastMessage?.createdAt || x?.updatedAt;

  return { chatId, clientName, phone, dni, lastMessageAt, raw: x };
}

/** Trae /chat o /chat/with-last-message (según flag) */
export async function fetchChats(opts: FetchOptions = {}): Promise<ChatRow[]> {
  const base = resolveApiBase(opts.baseUrl);
  const url = `${base}${opts.withLastMessage ? "/chat/with-last-message" : "/chat"}`;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  const res = await fetch(url, { headers, signal: opts.signal, cache: "no-store" });
  if (!res.ok) {
    const body = await safeJson(res);
    throw new Error(`Error ${res.status} al obtener chats: ${JSON.stringify(body)}`);
  }
  const data = await safeJson(res);
  if (!Array.isArray(data)) return [];
  return data.map(mapChatRow);
}

/** Filtra por DNI y/o teléfono en memoria */
export function filterChats(rows: ChatRow[], q: { dni?: string; phone?: string }) {
  const norm = (s?: string) => String(s || "").toLowerCase();
  const onlyDigits = (s?: string) => String(s || "").replace(/[^\d]/g, "");

  const qDni = onlyDigits(q.dni);
  const qPhone = onlyDigits(q.phone);

  return rows.filter((r) => {
    const dniOk = qDni ? onlyDigits(r.dni) === qDni : true;
    const phoneOk = qPhone ? onlyDigits(r.phone).includes(qPhone) : true;
    return dniOk && phoneOk;
  });
}

async function safeJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}
