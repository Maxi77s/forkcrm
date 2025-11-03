import { NextResponse } from "next/server";

export const runtime = "nodejs";

function joinUrl(base: string, path: string) {
  const b = base.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

export async function POST(req: Request) {
  const base = process.env.N8N_BASE_URL;
  const path = process.env.N8N_TEMPLATES_PATH || "/webhook/templates";
  if (!base) return NextResponse.json({ error: "Missing N8N_BASE_URL" }, { status: 500 });

  const url = joinUrl(base, path);

  try {
    const ct = req.headers.get("content-type") || "";
    const headers: HeadersInit = {};
    const H = process.env.N8N_AUTH_HEADER?.trim();
    const V = process.env.N8N_AUTH_VALUE?.trim();
    if (H && V) headers[H] = V;

    if (!ct.includes("multipart/form-data")) {
      // este webhook necesita SI o SI multipart (porque adjunta video)
      return NextResponse.json(
        { error: "Content-Type multipart/form-data requerido para adjuntar `file` (video)" },
        { status: 415 }
      );
    }

    const fd = await req.formData();

    // normalización mínima
    const to = String(fd.get("to") || "").trim();
    const tratamiento = String(fd.get("tratamiento") || "").trim();
    const nombre = String(fd.get("nombre_cliente") || "").trim();
    const file = fd.get("file") as File | null;

    if (!to) return NextResponse.json({ error: "`to` es requerido" }, { status: 400 });
    if (!tratamiento) return NextResponse.json({ error: "`tratamiento` es requerido" }, { status: 400 });
    if (!nombre) return NextResponse.json({ error: "`nombre_cliente` es requerido" }, { status: 400 });
    if (!file) return NextResponse.json({ error: "`file` (video) es requerido" }, { status: 400 });

    // (opcional) Validar valores permitidos
    const valid = ["depilacion", "blanqueamiento", "otro"];
    if (!valid.includes(tratamiento.toLowerCase())) {
      // no bloquea, sólo convierte
      fd.set("tratamiento", tratamiento.toLowerCase());
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
    return NextResponse.json({ error: e?.message || "Templates error" }, { status: 500 });
  }
}
