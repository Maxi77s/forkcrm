// import { NextResponse } from "next/server";

// // === cache simple en memoria ===
// type CacheEntry = { ts: number; data: any };
// const CACHE_TTL_MS = 15_000; // 15s
// let cache: CacheEntry | null = null;

// function joinUrl(base: string, path: string) {
//   const b = base.replace(/\/+$/, "");
//   const p = path.startsWith("/") ? path : `/${path}`;
//   return `${b}${p}`;
// }

// export const dynamic = "force-dynamic";

// export async function GET() {
//   const base = process.env.N8N_BASE_URL;
//   const path = process.env.N8N_MESSAGES_PATH || "/mensajes";

//   if (!base) {
//     return NextResponse.json({ error: "Missing N8N_BASE_URL" }, { status: 500 });
//   }

//   const url = joinUrl(base, path);

//   // 1) Cache fresco en memoria
//   if (cache && Date.now() - cache.ts < CACHE_TTL_MS) {
//     return NextResponse.json(cache.data, {
//       headers: {
//         "Cache-Control": `public, s-maxage=${Math.floor(
//           CACHE_TTL_MS / 1000
//         )}, stale-while-revalidate=60`,
//       },
//     });
//   }

//   try {
//     // 2) Pedir a N8n (permitiendo que Next revalide el fetch externo)
//     const res = await fetch(`${url}?cb=${Date.now()}`, {
//       method: "GET",
//       headers: { accept: "application/json" },
//       next: { revalidate: CACHE_TTL_MS / 1000 },
//       // cache: "no-store", // si querés desactivar por completo el cache externo
//     });

//     const txt = await res.text();
//     let data: any = [];
//     try {
//       data = txt ? JSON.parse(txt) : [];
//     } catch {
//       // si N8n no responde JSON válido, devolvemos array vacío con texto bruto
//       data = [];
//     }

//     if (!res.ok) {
//       return NextResponse.json(
//         { error: data?.error || data?.message || txt || res.statusText },
//         { status: res.status }
//       );
//     }

//     cache = { ts: Date.now(), data };

//     return NextResponse.json(data, {
//       headers: {
//         "Cache-Control": `public, s-maxage=${Math.floor(
//           CACHE_TTL_MS / 1000
//         )}, stale-while-revalidate=60`,
//       },
//     });
//   } catch (e: any) {
//     return NextResponse.json(
//       { error: e?.message || "Fetch error" },
//       { status: 500 }
//     );
//   }
// }
