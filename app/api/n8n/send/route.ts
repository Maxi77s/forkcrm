import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const base = process.env.NEXT_PUBLIC_N8N_BASE_URL!;
  const path = process.env.N8N_SEND_PATH || "/webhook/send-message";
  const { to, text } = await req.json().catch(() => ({}));

  if (!to || !text) {
    return NextResponse.json({ error: "`to` y `text` son requeridos" }, { status: 400 });
  }

  const url = `${base}${path}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, text }),
    });

    const bodyText = await res.text();
    let parsed: any = bodyText;
    try { parsed = JSON.parse(bodyText); } catch {}

    if (!res.ok) {
      return NextResponse.json({ error: parsed || res.statusText }, { status: res.status });
    }
    return NextResponse.json(parsed);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Send error" }, { status: 500 });
  }
}
