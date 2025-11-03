import { NextResponse } from "next/server";

export const runtime = "nodejs";

function joinUrl(base: string, path: string) {
  const b = base.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

export async function POST(req: Request) {
  const base = process.env.N8N_BASE_URL;
  const path = process.env.N8N_SEND_PATH || "/webhook/send_message2";
  if (!base) return NextResponse.json({ error: "Missing N8N_BASE_URL" }, { status: 500 });

  const url = joinUrl(base, path);

  try {
    const ct = req.headers.get("content-type") || "";
    const headers: HeadersInit = {};
    const H = process.env.N8N_AUTH_HEADER?.trim();
    const V = process.env.N8N_AUTH_VALUE?.trim();
    if (H && V) headers[H] = V;

    let fd: FormData;

    if (ct.includes("multipart/form-data")) {
      // 1) si viene multipart desde el front, reenviamos tal cual
      fd = await req.formData();

      // alias compatibilidad: si te llega "data" en vez de "file"
      if (!fd.has("file") && fd.has("data")) {
        const anyFile = fd.get("data") as File | null;
        if (anyFile) {
          fd.set("file", anyFile, anyFile.name || "upload");
        }
        fd.delete("data");
      }

      if (!fd.has("to")) fd.set("to", "");
      if (!fd.has("text")) fd.set("text", "");
    } else {
      // 2) si vino JSON, sólo podemos enviar texto (sin archivo)
      const body = await req.json().catch(() => ({}));
      fd = new FormData();
      fd.append("to", body?.to ?? "");
      fd.append("text", body?.text ?? "");
      // nota: archivos requieren multipart en el request original
    }

    // validaciones mínimas
    const to = String(fd.get("to") || "").trim();
    const text = String(fd.get("text") || "").trim();
    const hasFile = !!fd.get("file");

    if (!to) {
      return NextResponse.json({ error: "`to` es requerido" }, { status: 400 });
    }
    if (!hasFile && !text) {
      return NextResponse.json({ error: "`text` es requerido si no adjuntás `file`" }, { status: 400 });
    }

    const upstream = await fetch(url, { method: "POST", body: fd, headers });
    const txt = await upstream.text();
    let data: any = txt;
    try { data = txt ? JSON.parse(txt) : undefined; } catch {}

    if (!upstream.ok) {
      return NextResponse.json(
        { error: data?.error || data?.message || txt || "Upstream error" },
        { status: upstream.status }
      );
    }

    return NextResponse.json(data ?? { message: "Workflow was started" });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Send error" }, { status: 500 });
  }
}
