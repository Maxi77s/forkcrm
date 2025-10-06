// components/helpers/helper.ecom.ts
export type EcomLastMessage = {
  content?: string;
  timestamp?: string | number | Date;
  sender?: "CLIENT" | "OPERADOR" | "SYSTEM";
};

export type EcomChat = {
  id: string;
  userId?: string;
  clientName?: string;
  status?: string; // "OPEN" | "CLOSED" | etc.
  createdAt?: string | number | Date;
  updatedAt?: string | number | Date;
  lastMessage?: EcomLastMessage | null;
};

const BASE = (process.env.NEXT_PUBLIC_ECOM_BASE_URL ?? "http://localhost:3002").replace(/\/+$/, "");

// forzamos estos paths:
const LIST_PATH = "/chat";
const LIST_WITH_LAST_PATH = "/chat/with-last-message";

function join(base: string, path: string) {
  return base + (path.startsWith("/") ? path : `/${path}`);
}

async function getJson(url: string, init?: RequestInit) {
  const r = await fetch(url, { cache: "no-store", ...init });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(text || `HTTP ${r.status}`);
  }
  return r.json();
}

// === SOLO /chat ===
export async function listEcomChats(init?: RequestInit): Promise<EcomChat[]> {
  const url = join(BASE, LIST_PATH);
  // console.debug("[ECOM] GET", url);
  return getJson(url, init);
}

// si querés probar manual: /chat/with-last-message
export async function listEcomChatsWithLast(init?: RequestInit): Promise<EcomChat[]> {
  const url = join(BASE, LIST_WITH_LAST_PATH);
  // console.debug("[ECOM] GET", url);
  return getJson(url, init);
}

// opcional: para debug rápido en UI
export function getEcomResolvedPaths() {
  return { base: BASE, listPath: LIST_PATH, listWithLastPath: LIST_WITH_LAST_PATH };
}
