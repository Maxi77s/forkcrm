import { useEffect, useState } from "react";
import { Socket } from "socket.io-client";

interface UsePersistentChatParams {
  socket: Socket | null;
  isConnected: boolean;
}

export function usePersistentChat({ socket, isConnected }: UsePersistentChatParams) {
  const [messages, setMessages] = useState<any[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [assignedChats, setAssignedChats] = useState<any[]>([]);

  // Cargar desde localStorage al inicio
  useEffect(() => {
    const savedMessages = localStorage.getItem("operatorMessages");
    const savedChatId = localStorage.getItem("operatorCurrentChatId");
    const savedAssignedChats = localStorage.getItem("operatorAssignedChats");

    if (savedMessages) setMessages(JSON.parse(savedMessages));
    if (savedChatId) setCurrentChatId(savedChatId);
    if (savedAssignedChats) setAssignedChats(JSON.parse(savedAssignedChats));
  }, []);

  // Guardar en localStorage al cambiar
  useEffect(() => {
    localStorage.setItem("operatorMessages", JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    if (currentChatId) {
      localStorage.setItem("operatorCurrentChatId", currentChatId);
    } else {
      localStorage.removeItem("operatorCurrentChatId");
    }
  }, [currentChatId]);

  useEffect(() => {
    localStorage.setItem("operatorAssignedChats", JSON.stringify(assignedChats));
  }, [assignedChats]);

  // Restaurar historial de chat si está conectado
  useEffect(() => {
    if (isConnected && currentChatId && socket) {
      socket.emit("requestChatHistory", { chatId: currentChatId });
    }
  }, [isConnected]);

  // Validar que el chat actual esté dentro de los asignados
  useEffect(() => {
    if (
      currentChatId &&
      !assignedChats.some((chat: any) => chat.chatId === currentChatId)
    ) {
      setCurrentChatId(null);
      setMessages([]);
    }
  }, [assignedChats]);

  const clearChatStorage = () => {
    localStorage.removeItem("operatorMessages");
    localStorage.removeItem("operatorCurrentChatId");
    localStorage.removeItem("operatorAssignedChats");
  };

  return {
    messages,
    setMessages,
    currentChatId,
    setCurrentChatId,
    assignedChats,
    setAssignedChats,
    clearChatStorage,
  };
}
