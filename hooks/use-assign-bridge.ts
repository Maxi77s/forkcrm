// src/hooks/use-assign-bridge.ts
"use client";

import { useMemo } from "react";

export type CanonicalMeta = {
  canonicalChatId: string;
  clientId?: string;
  clientName?: string;
};

type SocketLike = {
  emit: (event: string, payload?: any, cb?: (err?: any, res?: any) => void) => void;
};

export function useAssignBridge(socket?: SocketLike | null) {
  return useMemo(() => {
    function buildMeta(canonicalChatId: string, clientId?: string, clientName?: string) {
      const meta: CanonicalMeta = { canonicalChatId, clientId, clientName };
      return { meta };
    }

    function announce(canonicalChatId: string, clientId?: string, clientName?: string) {
      try {
        // Si tu gateway implementa algo para reenviar este evento al operador, genial.
        // Si no, igual viaja dentro del mensaje (meta.canonicalChatId) y el operador lo toma de ahí.
        socket?.emit?.("clientCanonicalId", { canonicalChatId, clientId, clientName });
      } catch {}
    }

    return { buildMeta, announce };
  }, [socket]);
}
