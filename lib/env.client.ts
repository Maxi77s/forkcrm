/**
 * Helpers de entorno para código CLIENT (browser).
 * - Usa siempre los NEXT_PUBLIC_* provistos por el build.
 * - Normaliza trailing slashes y protocolo WS.
 * - Expone namespace de chat y path de socket.io para no duplicar "/chat".
 */

function trimSlashes(u?: string) {
  return (u || "").trim().replace(/\/+$/, "");
}

/** Garantiza que el path empiece con "/" */
function normPath(p?: string, fallback: string = "/"): string {
  const v = (p || "").trim();
  if (!v) return fallback;
  return v.startsWith("/") ? v : `/${v}`;
}

/**
 * Base HTTP para fetch/axios
 * Prioridad:
 * 1) NEXT_PUBLIC_API_URL
 * 2) NEXT_PUBLIC_WS_URL (compat antigua)
 * Fallback: http://localhost:3002 (solo dev local)
 */
export function getHttpBase(): string {
  const env =
    trimSlashes(process.env.NEXT_PUBLIC_API_URL) ||
    trimSlashes(process.env.NEXT_PUBLIC_WS_URL);
  return env || "http://localhost:3002";
}

/** Alias de conveniencia */
export const API_BASE = getHttpBase();

/**
 * Base ORIGIN para WS (sin namespace)
 * Prioridad:
 * 1) NEXT_PUBLIC_WEBSOCKET_URL
 * 2) NEXT_PUBLIC_API_URL
 * 3) NEXT_PUBLIC_WS_URL
 * Fallback: http://localhost:3002 (solo dev local)
 *
 * ⚠️ Devuelve SIEMPRE protocolo http/https (socket.io se encarga).
 */
export function getWsOrigin(): string {
  const raw =
    trimSlashes(process.env.NEXT_PUBLIC_WEBSOCKET_URL) ||
    trimSlashes(process.env.NEXT_PUBLIC_API_URL) ||
    trimSlashes(process.env.NEXT_PUBLIC_WS_URL) ||
    "http://localhost:3002";
  return raw;
}

/** Namespace del ChatGateway (default "/chat") */
export function getChatNamespace(): string {
  return normPath(process.env.NEXT_PUBLIC_CHAT_NS, "/chat");
}

/** Path del engine/socket.io (default "/socket.io") */
export function getSocketPath(): string {
  return normPath(process.env.NEXT_PUBLIC_SOCKET_PATH, "/socket.io");
}

/* ===== Paths REST configurables ===== */

export function getAuthLoginPath(): string {
  return normPath(process.env.NEXT_PUBLIC_AUTH_LOGIN_PATH, "/auth/login");
}

export function getAuthRegisterPath(): string {
  return normPath(process.env.NEXT_PUBLIC_AUTH_REGISTER_PATH, "/auth/register");
}

export function getAuthRefreshPath(): string {
  return normPath(process.env.NEXT_PUBLIC_AUTH_REFRESH_PATH, "/auth/refresh");
}
