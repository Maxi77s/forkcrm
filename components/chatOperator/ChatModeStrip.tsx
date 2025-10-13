"use client";

import { Bot, Brain, User } from "lucide-react";
import { cn } from "@/lib/utils";

type Mode = "BOT" | "AI" | "HUMAN" | undefined;

export interface ChatModeStripProps {
  mode?: Mode;
  size?: "sm" | "md";
  className?: string;
}

const baseIcon =
  "h-4 w-4 sm:h-4 sm:w-4 md:h-5 md:w-5 transition-colors duration-200";

function ModePill({
  active,
  children,
  title,
}: {
  active: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      title={title}
      className={cn(
        "inline-flex items-center justify-center rounded-full p-1",
        active
          ? "bg-sky-100 text-sky-700 ring-1 ring-sky-300"
          : "bg-transparent text-gray-400"
      )}
      style={{ lineHeight: 0 }}
    >
      {children}
    </div>
  );
}

/** Tira de 3 iconos: Bot / IA / Humano. Ilumina el activo. */
export function ChatModeStrip({ mode, size = "sm", className }: ChatModeStripProps) {
  const iconClass = cn(baseIcon, size === "md" ? "md:h-5 md:w-5" : "h-4 w-4");
  return (
    <div className={cn("flex items-center gap-1.5 mt-4", className)}>
      <ModePill active={mode === "BOT"} title="Bot">
        <Bot className={iconClass} />
      </ModePill>
      <ModePill active={mode === "AI"} title="IA">
        <Brain className={iconClass} />
      </ModePill>
      <ModePill active={mode === "HUMAN"} title="Soporte humano">
        <User className={iconClass} />
      </ModePill>
    </div>
  );
}

export default ChatModeStrip;
