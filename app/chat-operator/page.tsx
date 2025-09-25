"use client";

import ChatPanel from "@/components/operator/chat-panel";
import { useSearchParams, useRouter } from "next/navigation";

export default function Page() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const chatId = searchParams.get("chatId") ?? "";

  return (
    <ChatPanel
      chatId={chatId}
      onChatFinished={() => {
        // Cambiá esta ruta a donde quieras volver al cerrar el chat
        router.push("/dashboard/chats");
      }}
    />
  );
}
