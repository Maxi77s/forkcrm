// src/lib/display-name.ts
const NAME_CACHE_KEY = "client.displayName.v1";
type NameCache = Record<string, string>;

const onlyDigits = (s?: string) => String(s || "").replace(/[^\d]/g, "");

function loadNameCache(): NameCache {
  try { return JSON.parse(localStorage.getItem(NAME_CACHE_KEY) || "{}"); } catch { return {}; }
}
function saveNameCache(map: NameCache) {
  try { localStorage.setItem(NAME_CACHE_KEY, JSON.stringify(map)); } catch {}
}

function cacheKeyFrom(chat: any): string | null {
  const userId = String(chat?.userId || chat?.clientId || "").trim();
  const digits = onlyDigits(
    chat?.phone ??
    chat?.client?.phone ??
    chat?.user?.phone ??
    chat?.metadata?.phone ??
    chat?.meta?.phone
  );
  if (userId) return `user:${userId}`;
  if (digits) return `tel:${digits}`;
  return null;
}

export function getCachedDisplayName(chat: any): string | undefined {
  const key = cacheKeyFrom(chat);
  if (!key) return undefined;
  return (loadNameCache()[key] || "").trim() || undefined;
}

export function setCachedDisplayName(chat: any, name: string) {
  const clean = String(name || "").trim();
  if (!clean) return;
  if (/^\+?[\d\-\s\(\)]{6,}$/.test(clean)) return;   // no guardar teléfonos como nombre
  if (/^cliente$/i.test(clean)) return;              // no cachear placeholder
  const key = cacheKeyFrom(chat);
  if (!key) return;
  const map = loadNameCache();
  if (map[key] !== clean) {
    map[key] = clean;
    saveNameCache(map);
  }
}

export function shortId(id?: string) {
  if (!id) return "";
  return String(id).slice(0, 6);
}

/** Prioridad:
 * 1) clientName / client_name (DB)  ➜ cachea
 * 2) cache local (userId/tel)
 * 3) client.name / user.name / metadata.name / meta.name / name / client_name / metadata.clientName / meta.clientName ➜ cachea
 * 4) phone
 * 5) "Cliente <shortId>"
 */
export function getChatDisplayName(chat: any): string {
  const fromDb = chat?.clientName ?? chat?.client_name ?? null;
  if (fromDb && String(fromDb).trim()) {
    const clean = String(fromDb).trim();
    setCachedDisplayName(chat, clean);
    return clean;
  }

  const fromCache = getCachedDisplayName(chat);
  if (fromCache) return fromCache;

  const nested =
    chat?.client?.name ??
    chat?.user?.name ??
    chat?.metadata?.name ??
    chat?.meta?.name ??
    chat?.name ??
    chat?.client_name ??
    chat?.metadata?.clientName ??
    chat?.meta?.clientName ??
    null;

  if (nested && String(nested).trim()) {
    const clean = String(nested).trim();
    setCachedDisplayName(chat, clean);
    return clean;
  }

  const phone =
    chat?.phone ??
    chat?.client?.phone ??
    chat?.user?.phone ??
    chat?.metadata?.phone ??
    chat?.meta?.phone ??
    null;
  if (phone) return String(phone);

  return `Cliente ${shortId(chat?.userId || chat?.id || chat?._id)}`;
}
