// src/components/helpers/helper.operators.ts
const BASE = process.env.NEXT_PUBLIC_ECOM_BASE_URL ?? "http://localhost:3002";

function getToken(): string | null {
  // Ajustar si usás otro storage/provider
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

/** ===== Operators API ===== */
export type OperatorState = "AVAILABLE" | "BUSY" | "OFFLINE";

export interface OperatorDTO {
  id: string;
  name: string;
  state: OperatorState;
}

export interface OperatorChatDTO {
  id: string;
  clientId: string;
  clientName?: string;
  lastMessageAt?: string;
  status?: "ACTIVE" | "WAITING" | "FINISHED";
  // agrega campos que ya tengas en tu back...
}

/** Crear un nuevo operador */
export async function createOperator(input: { name: string; state?: OperatorState }) {
  const r = await fetch(`${BASE}/operators`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<OperatorDTO>;
}

/** Obtener operadores disponibles */
export async function getAvailableOperators() {
  const r = await fetch(`${BASE}/operators/available`, { headers: authHeaders() });
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<OperatorDTO[]>;
}

/** Obtener operador por ID */
export async function getOperatorById(operatorId: string) {
  const r = await fetch(`${BASE}/operators/${operatorId}`, { headers: authHeaders() });
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<OperatorDTO>;
}

/** Obtener operador por nombre */
export async function getOperatorByName(name: string) {
  const r = await fetch(`${BASE}/operators/name/${encodeURIComponent(name)}`, { headers: authHeaders() });
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<OperatorDTO>;
}

/** Mis chats activos (ATAJO recomendado en backend: /operators/me/active-chats)
 *  Si no tenés /me, usa /operators/{id}/active-chats y pasá el ID del user logueado.
 */
export async function getMyActiveChats(options?: { operatorId?: string }) {
  const endpoint = options?.operatorId
    ? `${BASE}/operators/${options.operatorId}/active-chats`
    : `${BASE}/operators/me/active-chats`;

  const r = await fetch(endpoint, { headers: authHeaders() });
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<OperatorChatDTO[]>;
}

/** Asignación automática (deja que el back elija el operador) */
export async function autoAssignOperator() {
  const r = await fetch(`${BASE}/operators/assign`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<OperatorDTO>;
}

/** Actualizar estado del operador */
export async function updateOperatorState(operatorId: string, state: OperatorState) {
  const r = await fetch(`${BASE}/operators/${operatorId}/state`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ state }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<{ ok: true } | OperatorDTO | any>;
}

/** Liberar operador (termina chat, etc.) */
export async function releaseOperator(operatorId: string) {
  const r = await fetch(`${BASE}/operators/${operatorId}/release`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!r.ok) throw new Error(await r.text());
  // algunos backs devuelven 201 sin body
  try { return await r.json(); } catch { return { ok: true }; }
}
