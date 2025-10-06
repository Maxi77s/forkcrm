"use client";

import * as React from "react";

export type OperatorChatListItem = {
  chatId: string;
  clientId: string;
  clientName?: string;
  status?: "ACTIVE" | "WAITING" | "FINISHED";
  isOnline?: boolean;
  lastMessageTime?: Date;
  lastMessagePreview?: string;
  avatar?: string;
};

type Props = {
  chats: OperatorChatListItem[];
  selectedChatId: string | null;
  onSelect: (chatId: string) => void;
  isLoading?: boolean;
};

export default function OperatorChatList({
  chats,
  selectedChatId,
  onSelect,
  isLoading,
}: Props) {
  if (isLoading) {
    return <div className="p-4 text-sm opacity-70">Cargando chats…</div>;
  }
  if (!chats?.length) {
    return <div className="p-4 text-sm opacity-70">No tenés chats activos.</div>;
  }

  return (
    <div className="flex flex-col gap-2 p-2">
      {chats.map((c) => (
        <button
          key={c.chatId}
          onClick={() => onSelect(c.chatId)}
          className={`w-full text-left rounded-xl px-3 py-2 border transition
            ${selectedChatId === c.chatId ? "border-white/20 bg-white/5" : "border-white/10 hover:bg-white/5"}`}
        >
          <div className="text-sm font-medium">
            {c.clientName ?? c.clientId}
          </div>
          <div className="text-xs opacity-70">
            {c.status ?? "ACTIVE"} · {c.lastMessageTime ? c.lastMessageTime.toLocaleString() : "—"}
          </div>
        </button>
      ))}
    </div>
  );
}
