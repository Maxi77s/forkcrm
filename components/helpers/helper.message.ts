/* ============================================================
 * Helper Mensajes (FRONT)
 * - listAllMessages: intenta NEXT_PUBLIC_N8N_* si están; si no, usa /api/n8n/messages
 * - sendTextMessage / sendImageWithCaption: usa directo NEXT_PUBLIC_* si están;
 *   si NO están, usa /api/n8n/send (proxy) y arma form-data.
 * ============================================================ */

export type Mensaje = {
  id?: string;
  to?: string;
  from?: string;
  text?: string;
  direction?: "IN" | "OUT";
  timestamp?: string | number | Date;
  raw?: any;
};

/* ---------- Resolver URLs ---------- */
function joinUrl(base?: string, path?: string) {
  if (!base || !path) return "";
  return `${base.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

/* Lectura (GET) */
const PUBLIC_MESSAGES_URL =
  // si querés leer directo de N8n (no recomendado por CORS)
  (process.env.NEXT_PUBLIC_N8N_BASE && process.env.NEXT_PUBLIC_N8N_MESSAGES_PATH
    ? joinUrl(process.env.NEXT_PUBLIC_N8N_BASE, process.env.NEXT_PUBLIC_N8N_MESSAGES_PATH)
    : "") || "";

/* Envío (POST form-data) */
const PUBLIC_SEND_URL =
  (process.env.NEXT_PUBLIC_N8N_BASE && process.env.NEXT_PUBLIC_N8N_SEND_PATH
    ? joinUrl(process.env.NEXT_PUBLIC_N8N_BASE, process.env.NEXT_PUBLIC_N8N_SEND_PATH)
    : process.env.NEXT_PUBLIC_N8N_SEND2_URL || "") || "";

/* Proxys internos (Next API) */
const INTERNAL_MESSAGES_URL = "/api/n8n/messages"; // GET → N8N_BASE_URL + N8N_MESSAGES_PATH
const INTERNAL_SEND_URL = "/api/n8n/send";         // POST form-data → N8N_BASE_URL + N8N_SEND_PATH

/* ---------- Utils ---------- */
const onlyDigits = (s?: string) => (s ?? "").replace(/\D+/g, "");
export function toE164(input: string, defaultCountry?: string): string {
  let s = (input || "").trim();
  if (!s) return s;
  if (s.startsWith("+")) return s;
  if (s.startsWith("00")) return `+${s.slice(2)}`;
  const digits = onlyDigits(s);
  if (!digits) return s;
  const cc = (defaultCountry || process.env.NEXT_PUBLIC_DEFAULT_COUNTRY || "")
    .toString()
    .replace(/^\+/, "");
  return cc ? `+${cc}${digits}` : `+${digits}`;
}

/* ---------- Lectura de mensajes ---------- */
export async function listAllMessages(): Promise<Mensaje[]> {
  // 1) Intentar público directo si está configurado (requiere CORS habilitado en N8n)
  const urlDirect = PUBLIC_MESSAGES_URL ? `${PUBLIC_MESSAGES_URL}?cb=${Date.now()}` : "";
  const urlProxy = `${INTERNAL_MESSAGES_URL}?cb=${Date.now()}`;

  const tryFetch = async (url: string) => {
    const res = await fetch(url, {
      method: "GET",
      cache: "no-store",
      headers: {
        "cache-control": "no-cache, no-store, must-revalidate",
        pragma: "no-cache",
        accept: "application/json",
      },
    });
    if (!res.ok) {
      const err = await res.text().catch(() => res.statusText);
      throw new Error(`HTTP ${res.status} ${err}`);
    }
    const data = await res.json();

    if (Array.isArray(data)) {
      return data.map((m: any) => ({
        id: m?.id ?? m?._id ?? undefined,
        to: m?.to,
        from: m?.from,
        text: m?.text ?? m?.body ?? m?.message ?? "",
        direction:
          m?.direction?.toUpperCase?.() === "IN"
            ? "IN"
            : m?.direction?.toUpperCase?.() === "OUT"
            ? "OUT"
            : undefined,
        timestamp: m?.timestamp ?? m?.date ?? m?.createdAt ?? undefined,
        raw: m,
      })) as Mensaje[];
    }
    return [{ raw: data } as Mensaje];
  };

  try {
    if (urlDirect) return await tryFetch(urlDirect);
    return await tryFetch(urlProxy);
  } catch (e1) {
    // fallback: si falló directo, probar proxy
    if (urlDirect) {
      try {
        return await tryFetch(urlProxy);
      } catch (e2) {
        console.error("[helper.message] listAllMessages falló:", e1, e2);
        return [];
      }
    }
    console.error("[helper.message] listAllMessages falló:", e1);
    return [];
  }
}

/* ---------- Envío (nuevo form-data) ---------- */
export async function sendMessageFormData(params: {
  to: string;
  text?: string;
  file?: File | Blob | null;
  filename?: string;
  countryCode?: string;
}) {
  const to = toE164(params.to, params.countryCode);
  const fd = new FormData();
  fd.append("to", to);
  fd.append("text", params.text ?? "");
  if (params.file) {
    const fname =
      params.filename ||
      (params.file instanceof File ? params.file.name : "media.jpg");
    fd.append("file", params.file, fname);
  }

  // Preferir público si está definido; si no, ir por proxy interno
  const url = PUBLIC_SEND_URL || INTERNAL_SEND_URL;

  // Log útil
  console.log("[helper.message] POST form-data →", url, {
    to,
    hasFile: !!params.file,
    textPreview: (params.text ?? "").slice(0, 30),
  });

  const r = await fetch(url, { method: "POST", body: fd });
  const txt = await r.text();
  let json: any = txt;
  try { json = txt ? JSON.parse(txt) : undefined; } catch {}
  if (!r.ok) {
    const msg = (json?.message || json?.error || txt || `HTTP ${r.status}`).toString();
    throw new Error(`Fallo envío: ${msg}`);
  }
  return json ?? txt ?? null;
}

export async function sendTextMessage(to: string, text: string) {
  return sendMessageFormData({ to, text });
}

export async function sendImageWithCaption(to: string, file: File | Blob, caption?: string, filename?: string) {
  return sendMessageFormData({ to, text: caption ?? "", file, filename });
}
