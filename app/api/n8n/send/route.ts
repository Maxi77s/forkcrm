import { NextResponse } from "next/server";

function joinUrl(base: string, path: string) {
  const b = base.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

export async function POST(req: Request) {
  const base = process.env.N8N_BASE_URL;
  const path = process.env.N8N_SEND_PATH || "/webhook/send_message2";

  if (!base) {
    return NextResponse.json({ error: "Missing N8N_BASE_URL" }, { status: 500 });
  }

  const url = joinUrl(base, path);

  try {
    const ct = req.headers.get("content-type") || "";
    let fd: FormData;

    if (ct.includes("multipart/form-data")) {
      // Reenviamos el form-data que viene del front (to, text, file)
      fd = await req.formData();
      // Asegurar que existan las keys (al menos vacías)
      if (!fd.has("to")) fd.set("to", "");
      if (!fd.has("text")) fd.set("text", "");
    } else {
      // Si vino JSON, lo convertimos a form-data (el webhook espera multipart)
      const body = await req.json().catch(() => ({}));
      fd = new FormData();
      fd.append("to", body?.to ?? "");
      fd.append("text", body?.text ?? "");
      // Si quisieras soportar base64->archivo, podés parsearlo acá y hacer fd.append("file", blob, "media.jpg")
    }

    // Validación mínima
    const to = String(fd.get("to") || "").trim();
    const text = String(fd.get("text") || "").trim();
    if (!to && !fd.get("file")) {
      return NextResponse.json(
        { error: "`to` es requerido (y `text` si no hay archivo)" },
        { status: 400 }
      );
    }
    if (!text && !fd.get("file")) {
      return NextResponse.json(
        { error: "`text` es requerido si no adjuntás un `file`" },
        { status: 400 }
      );
    }

    // POST directo al webhook N8n (NO seteamos Content-Type manualmente)
    const upstream = await fetch(url, { method: "POST", body: fd });

    const txt = await upstream.text();
    let data: any = txt;
    try {
      data = txt ? JSON.parse(txt) : undefined;
    } catch {
      // respuesta no-JSON: devolvemos texto
    }

    if (!upstream.ok) {
      return NextResponse.json(
        { error: data?.error || data?.message || txt || "Upstream error" },
        { status: upstream.status }
      );
    }

    return NextResponse.json(data ?? { ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Send error" },
      { status: 500 }
    );
  }
}
