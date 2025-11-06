// app/chat-operator/page.tsx
"use client";

import { Suspense } from "react";
import ChatPanel from "@/components/operator/chat-panel";
import { useSearchParams, useRouter } from "next/navigation";

function ChatOperatorContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const chatId = searchParams.get("chatId") ?? "";

  return (
    <ChatPanel
      chatId={chatId}
      onChatFinished={() => {
        router.push("/dashboard/chats");
      }}
    />
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div>cargando chat…</div>}>
      <ChatOperatorContent />
    </Suspense>
  );
}
