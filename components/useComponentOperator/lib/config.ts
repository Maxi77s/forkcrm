/* ================= Config ================= */
export const pollMs = Number(process.env.NEXT_PUBLIC_N8N_POLL_MS || 4000);
export const MAX_ACTIVE = 6;

export const ENABLE_AUTO_ASSIGN =
  String(process.env.NEXT_PUBLIC_AUTO_ASSIGN ?? "0") === "1";

export const AUTO_ASSIGN_ON_INBOUND = true;

// N8N
export const ENABLE_N8N =
  String(process.env.NEXT_PUBLIC_N8N_ENABLE ?? "0") === "1";
export const N8N_BASE = (process.env.NEXT_PUBLIC_N8N_BASE_URL || "").replace(
  /\/+$/,
  ""
);
export const N8N_MEDIA_EP =
  process.env.NEXT_PUBLIC_N8N_SEND_MEDIA_ENDPOINT || "/webhook/send_message2";
export const N8N_TPL_EP =
  process.env.NEXT_PUBLIC_N8N_SEND_TEMPLATE_ENDPOINT || "/webhook/templates";

export const DEFAULT_PREFIX =
  process.env.NEXT_PUBLIC_PHONE_DEFAULT_PREFIX || "+";
export const N8N_READY = ENABLE_N8N && !!N8N_BASE;

// Cache keys
export const PENDING_KEY = "chat_pending_msgs_v1";
export const CACHE_KEY = "chat_operator_cache_v1";

// WS
export const WS_EVENT_SEND = "sendMessage";
