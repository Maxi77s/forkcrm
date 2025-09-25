"use client";

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { useAuth } from "@/components/providers/auth-provider";

interface UseSocketProps {
  serverUrl?: string;
  /** Si es true exige token para conectar (operador). Para cliente anónimo usa false. */
  requireToken?: boolean;
}

export const useSocket = ({
  serverUrl = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3002",
  requireToken = true,
}: UseSocketProps) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const { token } = useAuth();
  const initializedRef = useRef(false);

  useEffect(() => {
    // 👉 si requiere token y no hay token, no conectes
    if (requireToken && !token) return;
    if (initializedRef.current) return;
    initializedRef.current = true;

    const url = serverUrl.replace(/\/$/, "");
    const s = io(url, {
      transports: ["websocket", "polling"],
      withCredentials: true,
      timeout: 20000,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      // La guía usa token en query. Si no hay token (cliente anónimo), va vacío.
      query: token ? { token } : {},
      auth: {}, // el back no lo usa según la guía
    });

    setSocket(s);

    s.on("connect", () => {
      setIsConnected(true);
      s.emit("getStats"); // opcional, no afecta al cliente
    });

    s.on("disconnect", (reason) => {
      setIsConnected(false);
      console.warn("❌ [SOCKET] disconnect:", reason);
    });

    s.on("connect_error", (err: any) => {
      setIsConnected(false);
      console.error("🔥 [SOCKET] connect_error:", { message: err?.message, data: err?.data });
    });

    return () => {
      try {
        s.removeAllListeners();
        s.disconnect();
      } catch {}
      setSocket(null);
      setIsConnected(false);
      initializedRef.current = false;
    };
  }, [serverUrl, token, requireToken]);

  return { socket, isConnected };
};
