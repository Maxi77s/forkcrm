// src/lib/socket/chat.ts
// Conexión y eventos de Socket.IO para el módulo de chats

import { io, Socket } from "socket.io-client";

// URL de conexión (guía): ws://localhost:3002/socket.io/?token=JWT_TOKEN
const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3002";

// ===== Eventos (cliente -> servidor) =====
export const ChatClientEvents = {
  createChat: "createChat",
  sendMessage: "sendMessage",
  finishChat: "finishChat",
  rateChat: "rateChat",
  joinChat: "joinChat",
  getStats: "getStats",
  leaveChat: "leaveChat",
  typingStart: "typingStart",
  typingStop: "typingStop",
} as const;

// ===== Eventos (servidor -> cliente) =====
export const ChatServerEvents = {
  newMessage: "newMessage",
  botThinking: "botThinking",
  chatAutoAssigned: "chatAutoAssigned",
  operatorAssigned: "operatorAssigned",
  chatInQueue: "chatInQueue",
  chatFinished: "chatFinished",
  chatRated: "chatRated",
  joinedChat: "joinedChat",
  chatHistory: "chatHistory",
  statsUpdate: "statsUpdate",
  userTyping: "userTyping",
  specialistAssigned: "specialistAssigned",
  chatStatusChanged: "chatStatusChanged",
  connectedUsersUpdate: "connectedUsersUpdate",
  operatorDashboard: "operatorDashboard",
  clientConnected: "client-connected",
  chatCreated: "chatCreated",
  ratingSubmitted: "ratingSubmitted",
  error: "error",
} as const;

// ===== Conector con JWT =====
export function createChatSocket(token: string): Socket {
  // socket.io-client acepta URL HTTP/WS indistinto; usamos query token
  return io(WS_URL, {
    path: "/socket.io/",
    transports: ["websocket"],
    query: { token }, // acorde a la guía
  });
}

// ===== Wrappers comunes =====
export function joinChat(socket: Socket, chatId: string) {
  socket.emit(ChatClientEvents.joinChat, { chatId });
}

export function leaveChat(socket: Socket, chatId: string) {
  socket.emit(ChatClientEvents.leaveChat, { chatId });
}

export function emitTypingStart(socket: Socket, chatId: string) {
  socket.emit(ChatClientEvents.typingStart, { chatId });
}

export function emitTypingStop(socket: Socket, chatId: string) {
  socket.emit(ChatClientEvents.typingStop, { chatId });
}

export function emitSendMessage(
  socket: Socket,
  chatId: string,
  content: string,
  sender: "CLIENT" | "OPERATOR" | "SYSTEM" = "OPERATOR"
) {
  socket.emit(ChatClientEvents.sendMessage, { chatId, content, sender });
}
