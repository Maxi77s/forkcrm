import { NextResponse } from "next/server";

export async function GET() {
  const base = process.env.NEXT_PUBLIC_N8N_BASE_URL!;
  const path = process.env.N8N_MESSAGES_PATH || "/webhook/mensajes";
  const url = `${base}${path}`;

  try {
    const res = await fetch(url, { method: "GET", cache: "no-store" });
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: text || res.statusText }, { status: res.status });
    }
    const data = await res.json().catch(() => null);
    return NextResponse.json(data ?? []);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Fetch error" }, { status: 500 });
  }
}
