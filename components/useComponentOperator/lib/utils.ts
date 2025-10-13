import { DEFAULT_PREFIX } from "./config";

export function uuid(): string {
  if (typeof crypto !== "undefined" && (crypto as any).randomUUID)
    return (crypto as any).randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export const normalizePhone = (p?: string) =>
  p ? String(p).replace(/\s+/g, "").replace(/^00/, "+") : undefined;

export const toMsisdn = (raw?: string) => {
  if (!raw) return undefined;
  const s = raw.replace(/\s+/g, "");
  if (s.startsWith("+") || s.startsWith("00")) return s.replace(/^00/, "+");
  return `${DEFAULT_PREFIX}${s}`;
};

export function pickClientName(raw: any): string {
  const candidates = [
    raw?.clientName,
    raw?.name,
    raw?.displayName,
    raw?.customerName,
    raw?.client_name,
    raw?.customer_name,
    raw?.client?.name,
    raw?.user?.name,
    raw?.customer?.name,
    raw?.metadata?.clientName,
    raw?.meta?.clientName,
    raw?.profile?.name,
  ].filter(Boolean);

  const name = String(candidates[0] || "").trim();
  if (name) return name;

  const phone = raw?.phone ?? raw?.client?.phone ?? raw?.user?.phone;
  if (phone) return String(phone).replace(/[^\d+]/g, "");

  const idShort = String(
    raw?.clientId ?? raw?.chatId ?? raw?.id ?? raw?._id ?? ""
  ).slice(0, 8) || "—";

  return `Cliente ${idShort}...`;
}

export function avatarFromName(name: string) {
  return `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(
    name || "Cliente"
  )}`;
}
