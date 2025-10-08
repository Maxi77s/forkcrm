"use client";

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { useAuth } from "@/components/providers/auth-provider";

interface UseSocketProps {
  userRole?: "CLIENT" | "OPERADOR" | "ADMIN";
  serverUrl?: string; // base (sin /chat)
}

export const useSocket = ({
  userRole = "CLIENT",
  serverUrl = process.env.NEXT_PUBLIC_WS_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002",
}: UseSocketProps) => {
  const { token } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!token) return;

    const s = io(`${serverUrl}/chat`, {
      auth: { token, userRole },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      timeout: 20000,
      withCredentials: true,
      forceNew: true,
    });

    s.on("connect", () => setIsConnected(true));
    s.on("disconnect", () => setIsConnected(false));
    s.on("connect_error", (err) => {
      console.error("[SOCKET connect_error]", err?.message || err);
      setIsConnected(false);
    });

    socketRef.current = s;
    setSocket(s);

    return () => {
      try {
        s.removeAllListeners();
        s.disconnect();
      } catch {}
      socketRef.current = null;
      setSocket(null);
      setIsConnected(false);
    };
  }, [serverUrl, token, userRole]);

  return { socket, isConnected };
};
