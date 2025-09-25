// src/components/helpers/helper.menssage.ts
export type Mensaje = {
  id?: string;
  to?: string;
  from?: string;
  text?: string;
  direction?: "IN" | "OUT";
  timestamp?: string | number | Date;
  raw?: any;
};

const INTERNAL_MESSAGES_URL = "/api/n8n/messages";
const INTERNAL_SEND_URL = "/api/n8n/send";

export async function listAllMessages(): Promise<Mensaje[]> {
  const res = await fetch(INTERNAL_MESSAGES_URL, { method: "GET", cache: "no-store" });
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`Error listando mensajes: ${err}`);
  }
  const data = await res.json();

  if (Array.isArray(data)) {
    return data.map((m: any) => ({
      id: m?.id ?? m?._id ?? undefined,
      to: m?.to,
      from: m?.from,
      text: m?.text ?? m?.body ?? m?.message ?? "",
      direction:
        m?.direction?.toUpperCase?.() === "IN" ? "IN" :
        m?.direction?.toUpperCase?.() === "OUT" ? "OUT" : undefined,
      timestamp: m?.timestamp ?? m?.date ?? m?.createdAt ?? undefined,
      raw: m,
    })) as Mensaje[];
  }

  return [{ raw: data } as Mensaje];
}

export async function sendTextMessage(to: string, text: string) {
  const res = await fetch(INTERNAL_SEND_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to, text }),
  });

  const payloadText = await res.text();
  let payload: any = payloadText;
  try { payload = JSON.parse(payloadText); } catch {}

  if (!res.ok) {
    throw new Error(typeof payload === "string" ? payload : payload?.error || "Error enviando mensaje");
  }
  return payload;
}
