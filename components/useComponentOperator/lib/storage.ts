import { CACHE_KEY, PENDING_KEY } from "./config";
import type { CacheShape, ChatMessage } from "./types";

/** ----- Pending ----- */
export function revivePending(obj: any): Record<string, ChatMessage[]> {
  const out: Record<string, ChatMessage[]> = {};
  if (!obj || typeof obj !== "object") return out;
  for (const k of Object.keys(obj)) {
    out[k] = (obj[k] || []).map((m: any) => ({
      ...m,
      timestamp: new Date(m.timestamp),
    }));
  }
  return out;
}

export function loadPendingFromStorage(): Record<string, ChatMessage[]> {
  try {
    if (typeof window === "undefined") return {};
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return {};
    return revivePending(JSON.parse(raw));
  } catch {
    return {};
  }
}

export function savePendingToStorage(data: Record<string, ChatMessage[]>) {
  try {
    if (typeof window === "undefined") return;
    const plain: any = {};
    for (const k of Object.keys(data)) {
      plain[k] = (data[k] || []).map((m) => ({
        ...m,
        timestamp: m.timestamp.toISOString(),
      }));
    }
    localStorage.setItem(PENDING_KEY, JSON.stringify(plain));
  } catch {}
}

/** ----- Cache principal ----- */
export function saveCache(data: CacheShape) {
  try {
    if (typeof window === "undefined") return;
    const serializable: any = {
      ...data,
      chats: data.chats.map((c) => ({
        ...c,
        lastMessageTime:
          c.lastMessageTime instanceof Date
            ? c.lastMessageTime.toISOString()
            : new Date(c.lastMessageTime as any).toISOString(),
      })),
      byChat: Object.fromEntries(
        Object.entries(data.byChat).map(([k, arr]) => [
          k,
          arr.map((m) => ({
            ...m,
            timestamp:
              m.timestamp instanceof Date
                ? m.timestamp.toISOString()
                : new Date(m.timestamp as any).toISOString(),
          })),
        ])
      ),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(serializable));
  } catch {}
}

export function loadCache(): CacheShape | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as any;
    const revived: CacheShape = {
      chats: (parsed.chats || []).map((c: any) => ({
        ...c,
        lastMessageTime: new Date(c.lastMessageTime),
      })),
      byChat: Object.fromEntries(
        Object.entries(parsed.byChat || {}).map(([k, arr]) => [
          k,
          (arr as any[]).map((m) => ({
            ...m,
            timestamp: new Date((m as any).timestamp),
          })),
        ])
      ),
      selectedChatId: parsed.selectedChatId,
    };
    return revived;
  } catch {
    return null;
  }
}

/** ----- Merge pending con historia ----- */
export function computeMergedAndResolved(
  fetched: Record<string, ChatMessage[]>,
  pendingByChat: Record<string, ChatMessage[]>,
  resolveWindowMs = 60_000
): { mergedByChat: Record<string, ChatMessage[]>; resolvedByChat: Record<string, ChatMessage[]> } {
  const next: Record<string, ChatMessage[]> = { ...fetched };
  const resolvedByChat: Record<string, ChatMessage[]> = {};

  for (const chatId of Object.keys(pendingByChat)) {
    const pending = pendingByChat[chatId] ?? [];
    const base = next[chatId] ? [...next[chatId]] : [];
    const resolved: ChatMessage[] = [];

    for (const p of pending) {
      const idx = base.findIndex(
        (b) =>
          b.sender === p.sender &&
          (b.content ?? "") === (p.content ?? "") &&
          Math.abs(b.timestamp.getTime() - p.timestamp.getTime()) <=
            resolveWindowMs
      );
      if (idx >= 0) resolved.push(p);
      else base.push(p);
    }

    base.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    next[chatId] = base;
    if (resolved.length) {
      resolvedByChat[chatId] = resolved;
    }
  }

  return { mergedByChat: next, resolvedByChat };
}
