// src/lib/pending-queue.ts
"use client";

/**
 * Cola de pendientes 100% front-side.
 * - Persiste en localStorage (si existe window).
 * - Exponer subscribe() para reflejar en la UI.
 * - Canales: "wa" | "ecom".
 */

export type QueueChannel = "wa" | "ecom";
type Counts = Record<QueueChannel, number>;

const KEY = "__pending_queue_counts_v1__";
const listeners = new Set<(c: Counts) => void>();

function clamp(n: number) {
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function read(): Counts {
  if (typeof window === "undefined") return { wa: 0, ecom: 0 };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { wa: 0, ecom: 0 };
    const p = JSON.parse(raw);
    return { wa: clamp(p?.wa ?? 0), ecom: clamp(p?.ecom ?? 0) };
  } catch {
    return { wa: 0, ecom: 0 };
  }
}
function write(c: Counts) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(KEY, JSON.stringify(c)); } catch {}
}

let counts: Counts = read();
function notify() { listeners.forEach(fn => fn({ ...counts })); }

export function getCounts(): Counts { return { ...counts }; }
export function setCounts(next: Partial<Counts>) {
  counts = { ...counts, ...next }; write(counts); notify();
}
export function inc(channel: QueueChannel, amount = 1) {
  counts = { ...counts, [channel]: clamp((counts[channel] ?? 0) + amount) };
  write(counts); notify();
}
export function dec(channel: QueueChannel, amount = 1) {
  counts = { ...counts, [channel]: clamp((counts[channel] ?? 0) - amount) };
  write(counts); notify();
}
export function reset() { counts = { wa: 0, ecom: 0 }; write(counts); notify(); }

export function subscribe(fn: (c: Counts) => void): () => void {
  listeners.add(fn);
  try { fn({ ...counts }); } catch {}
  // devolvemos una función de cleanup que NO retorna nada
  return () => {
    listeners.delete(fn);
  };
}
/* (Opcional) Enchufar a socket para mover contadores con eventos reales */
export function hookPendingQueueToSocket(socket: any) {
  if (!socket || typeof socket.on !== "function") return;

  socket.on("chatInQueue", (payload: any) => {
    const ch: QueueChannel = (payload?.source === "ecommerce") ? "ecom" : "wa";
    inc(ch, 1);
  });

  socket.on("operatorAssigned", (payload: any) => {
    const ch: QueueChannel =
      (payload?.source === "ecommerce" || payload?.origin === "ECOM") ? "ecom" : "wa";
    dec(ch, 1);
  });

  socket.on("chatStatusChanged", (p: any) => {
    if (p?.from === "WAITING" && p?.to !== "WAITING") {
      const ch: QueueChannel = (p?.source === "ecommerce") ? "ecom" : "wa";
      dec(ch, 1);
    }
  });
}
