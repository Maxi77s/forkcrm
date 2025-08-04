// "use client";

// import type React from "react";

// import { useState, useEffect, useRef } from "react";
// import { useSocket } from "@/hooks/use-socket";
// import { useAuth } from "@/components/providers/auth-provider";
// import { Button } from "@/components/ui/button";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Badge } from "@/components/ui/badge";
// import { ScrollArea } from "@/components/ui/scroll-area";
// import { Avatar, AvatarFallback } from "@/components/ui/avatar";
// import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
// import { ChatMessage } from "../chat/chat-message";
// import { Input } from "@/components/ui/input";
// import { useToast } from "@/hooks/use-toast";
// import {
//   Headphones,
//   Users,
//   MessageCircle,
//   LogOut,
//   Send,
//   CheckCircle,
//   Clock,
//   User,
// } from "lucide-react";

// interface Message {
//   id: string;
//   content: string;
//   sender: "CLIENT" | "BOT" | "OPERADOR" | "SYSTEM";
//   timestamp: Date;
//   chatId: string;
//   senderName?: string;
//    type: "TEXT" | "IMAGE"
//   imageUrl?: string
// }

// interface ConnectedClient {
//   userId: string;
//   connectedAt: Date;
//   currentChatId?: string;
// }

// interface ChatInfo {
//   chatId: string;
//   clientId: string;
//   assignedAt: Date;
//   isActive: boolean;
// }

// interface Rating {
//   chatId: string;
//   rating: number;
//   comment: string;
//   categories: {
//     friendliness: number;
//     helpfulness: number;
//     responseTime: number;
//     problemResolution: number;
//   };
//   clientId: string;
//   timestamp: Date;
//   ratingStars: string;
// }

// export function OperatorDashboard() {
//   const { user, logout } = useAuth();
//   const { toast } = useToast();
//   const [messages, setMessages] = useState<Message[]>([]);
//   const [assignedChats, setAssignedChats] = useState<ChatInfo[]>([]);
//   const [currentChatId, setCurrentChatId] = useState<string | null>(null);
//   const [isTyping, setIsTyping] = useState(false);
//   const [notifications, setNotifications] = useState<string[]>([]);
//   const [connectedClients, setConnectedClients] = useState<ConnectedClient[]>(
//     []
//   );
//   const [recentRatings, setRecentRatings] = useState<Rating[]>([]);
//   const [inputMessage, setInputMessage] = useState("");
//   const [stats, setStats] = useState({
//     totalActiveChats: 0,
//     connectedClients: 0,
//     connectedOperators: 0,
//   });

//   const specialistId = useRef(
//     user?.id || `operador-${Math.random().toString(36).substr(2, 9)}`
//   );
//   const messagesEndRef = useRef<HTMLDivElement>(null);

//   const { socket, isConnected } = useSocket({
//     userRole: "OPERADOR",
//     serverUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002",
//   });

//   // Auto scroll to bottom
//   const scrollToBottom = () => {
//     messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
//   };

//   useEffect(() => {
//     scrollToBottom();
//   }, [messages]);

//   const addNotification = (message: string) => {
//     setNotifications((prev) => [
//       ...prev.slice(-4),
//       `${new Date().toLocaleTimeString()}: ${message}`,
//     ]);
//   };

//   const playNotificationSound = () => {
//     try {
//       const audio = new Audio(
//         "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT"
//       );
//       audio.play().catch(() => {});
//     } catch (error) {
//       // Ignorar errores de audio
//     }
//   };

//   useEffect(() => {
//     if (!socket) return;

//     socket.on("operatorDashboard", (data) => {
//       console.log("📊 [OPERADOR] Dashboard recibido:", data);
//       console.log("📊 [OPERADOR] Detalles del dashboard:", {
//         connectedClients: data.connectedClients?.length || 0,
//         assignedChats: data.assignedChats?.length || 0,
//         totalConnectedUsers: data.totalConnectedUsers,
//       });
//       setConnectedClients(data.connectedClients || []);
//       setStats((prev) => ({
//         ...prev,
//         totalActiveChats: data.assignedChats?.length || 0,
//       }));
//     });

//     socket.on("connectedUsersUpdate", (data) => {
//       console.log("👥 [OPERADOR] Usuarios conectados actualizados:", data);
//       setConnectedClients(data.clients || []);
//       setStats((prev) => ({
//         ...prev,
//         connectedClients: data.clients?.length || 0,
//         connectedOperators: data.operators?.length || 0,
//       }));
//     });

//     socket.on("chatAutoAssigned", (data) => {
//       console.log("🚨 [OPERADOR] Chat auto-asignado RECIBIDO:", data);
//       console.log("🚨 [OPERADOR] Detalles del evento:", {
//         chatId: data.chatId,
//         clientId: data.clientId,
//         operatorId: data.operatorId,
//         operatorName: data.operatorName,
//         historyLength: data.history?.length || 0,
//         timestamp: data.timestamp,
//       });

//       addNotification(`🚨 NUEVO CHAT ASIGNADO: Cliente ${data.clientId}`);

//       const newChat: ChatInfo = {
//         chatId: data.chatId,
//         clientId: data.clientId,
//         assignedAt: new Date(data.timestamp),
//         isActive: true,
//       };

//       console.log("📋 [OPERADOR] Agregando chat a la lista:", newChat);
//       setAssignedChats((prev) => {
//         const updated = [...prev, newChat];
//         console.log("📋 [OPERADOR] Lista actualizada de chats:", updated);
//         return updated;
//       });

//       if (!currentChatId) {
//         console.log(
//           "🎯 [OPERADOR] Estableciendo como chat actual:",
//           data.chatId
//         );
//         setCurrentChatId(data.chatId);
//       }

//       if (data.history) {
//         const historyMessages = data.history.map((msg: any) => ({
//           id: msg.id,
//           content: msg.content,
//           sender: msg.sender,
//           timestamp: new Date(msg.timestamp),
//           chatId: msg.chatId,
//           senderName: msg.senderName,
//         }));
//         console.log("📚 [OPERADOR] Estableciendo historial:", historyMessages);
//         setMessages(historyMessages);
//       }

//       playNotificationSound();
//       toast({
//         title: "Nuevo chat asignado",
//         description: `Cliente ${data.clientId} necesita ayuda`,
//       });
//     });

//     socket.on("chatFinished", (data) => {
//       console.log("✅ [OPERADOR] Chat finalizado exitosamente:", data);
//       setAssignedChats((prev) =>
//         prev.filter((chat) => chat.chatId !== data.chatId)
//       );

//       if (currentChatId === data.chatId) {
//         setCurrentChatId(null);
//         setMessages([]);
//       }

//       addNotification(`✅ Chat ${data.chatId} finalizado exitosamente`);
//       toast({
//         title: "Chat finalizado",
//         description: "El chat ha sido finalizado exitosamente",
//       });
//     });

//     socket.on("chatRated", (data) => {
//       console.log("⭐ [OPERADOR] Chat calificado:", data);
//       const ratingText = "⭐".repeat(data.rating);
//       const commentText = data.comment ? ` - "${data.comment}"` : "";
//       addNotification(
//         `⭐ CALIFICACIÓN RECIBIDA: ${ratingText} (${data.rating}/5)${commentText}`
//       );

//       setRecentRatings((prev) => [
//         {
//           chatId: data.chatId,
//           rating: data.rating,
//           comment: data.comment,
//           categories: data.categories,
//           clientId: data.clientId,
//           timestamp: new Date(data.timestamp),
//           ratingStars: "⭐".repeat(data.rating),
//         },
//         ...prev.slice(0, 4),
//       ]);

//       playNotificationSound();
//       toast({
//         title: "Nueva calificación",
//         description: `Recibiste ${data.rating} estrellas`,
//       });
//     });

//     socket.on("newMessage", (message) => {
//       console.log("💬 [OPERADOR] Nuevo mensaje:", message);
//       setMessages((prev) => [
//         ...prev,
//         {
//           id: message.id,
//           content: message.content,
//           sender: message.senderType,
//           timestamp: new Date(message.timestamp),
//           chatId: message.chatId,
//           senderName:
//             message.senderType === "CLIENT"
//               ? `Cliente ${message.userId}`
//               : message.senderType === "BOT"
//               ? "Depilbot"
//               : message.senderType === "OPERADOR"
//               ? "Tú"
//               : "Sistema",
//           type: message.type,
//         },
//       ]);
//     });

//     socket.on("joinedChat", (data) => {
//       console.log("✅ [OPERADOR] Unido al chat:", data);
//     });

//     socket.on("chatHistory", (data) => {
//       console.log("📚 [OPERADOR] Historial recibido:", data);
//       const historyMessages = data.messages.map((msg: any) => ({
//         id: msg.id,
//         content: msg.content,
//         sender: msg.sender,
//         timestamp: new Date(msg.timestamp),
//         chatId: msg.chatId,
//         senderName: msg.senderName,
//       }));
//       setMessages(historyMessages);
//     });

//     socket.on("userTyping", (data) => {
//       console.log("⌨️ [OPERADOR] Usuario escribiendo:", data);
//       if (data.userId !== specialistId.current) {
//         setIsTyping(data.isTyping);
//       }
//     });

//     socket.on("error", (error) => {
//       console.error("❌ [OPERADOR] Error:", error);
//       addNotification(`❌ Error: ${error.message}`);
//       toast({
//         title: "Error",
//         description: error.message || "Ha ocurrido un error",
//         variant: "destructive",
//       });
//     });

//     return () => {
//       socket.off("operatorDashboard");
//       socket.off("connectedUsersUpdate");
//       socket.off("chatAutoAssigned");
//       socket.off("chatFinished");
//       socket.off("chatRated");
//       socket.off("newMessage");
//       socket.off("joinedChat");
//       socket.off("chatHistory");
//       socket.off("userTyping");
//       socket.off("error");
//     };
//   }, [socket, currentChatId, toast]);

//   const handleJoinChat = (chatId: string) => {
//     if (!socket || !isConnected) {
//       toast({
//         title: "Error de conexión",
//         description: "No se puede conectar al servidor",
//         variant: "destructive",
//       });
//       return;
//     }

//     console.log("🚀 [OPERADOR] Uniéndose al chat:", chatId);
//     socket.emit("joinChat", { chatId });
//     setCurrentChatId(chatId);
//   };

//   const handleFinishChat = (chatId: string) => {
//     if (!socket || !isConnected) {
//       toast({
//         title: "Error de conexión",
//         description: "No se puede conectar al servidor",
//         variant: "destructive",
//       });
//       return;
//     }

//     if (confirm("¿Estás seguro de que quieres finalizar este chat?")) {
//       console.log("🏁 [OPERADOR] Finalizando chat:", chatId);
//       socket.emit("finishChat", {
//         chatId,
//         reason: "Chat finalizado por el operador",
//       });
//     }
//   };

//   const handleSendMessage = (e: React.FormEvent) => {
//     e.preventDefault();

//     if (!inputMessage.trim() || !socket || !currentChatId || !isConnected) {
//       return;
//     }

//     console.log("📤 [OPERADOR] Enviando mensaje:", inputMessage);
//     socket.emit("sendMessage", {
//       userId: specialistId.current,
//       chatId: currentChatId,
//       content: inputMessage,
//     });

//     setInputMessage("");
//   };

//   return (
//     <div className="flex flex-col h-screen bg-gray-50">
//       {/* Header */}
//       <div className="bg-white border-b p-4 flex items-center justify-between">
//         <div className="flex items-center space-x-3">
//           <Avatar>
//             <AvatarFallback className="bg-purple-500">
//               <Headphones className="h-4 w-4" />
//             </AvatarFallback>
//           </Avatar>
//           <div>
//             <h1 className="font-semibold">Dashboard Operador</h1>
//             <p className="text-sm text-gray-500">{user?.email}</p>
//           </div>
//         </div>
//         <div className="flex items-center space-x-2">
//           <Badge variant={isConnected ? "default" : "destructive"}>
//             {isConnected ? "Conectado" : "Desconectado"}
//           </Badge>
//           <Button variant="outline" size="sm" onClick={logout}>
//             <LogOut className="h-4 w-4 mr-2" />
//             Salir
//           </Button>
//         </div>
//       </div>

//       <div className="flex-1 flex">
//         {/* Sidebar */}
//         <div className="w-80 bg-white border-r flex flex-col">
//           <Tabs defaultValue="stats" className="flex-1">
//             <TabsList className="grid w-full grid-cols-3">
//               <TabsTrigger value="stats">Stats</TabsTrigger>
//               <TabsTrigger value="chats">Chats</TabsTrigger>
//               <TabsTrigger value="ratings">Ratings</TabsTrigger>
//             </TabsList>

//             <TabsContent value="stats" className="flex-1 p-4 space-y-4">
//               <div className="grid grid-cols-2 gap-4">
//                 <Card>
//                   <CardContent className="p-4 text-center">
//                     <Users className="h-8 w-8 mx-auto mb-2 text-blue-500" />
//                     <div className="text-2xl font-bold">
//                       {stats.connectedClients}
//                     </div>
//                     <div className="text-sm text-gray-500">Clientes Online</div>
//                   </CardContent>
//                 </Card>
//                 <Card>
//                   <CardContent className="p-4 text-center">
//                     <MessageCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
//                     <div className="text-2xl font-bold">
//                       {assignedChats.length}
//                     </div>
//                     <div className="text-sm text-gray-500">Mis Chats</div>
//                   </CardContent>
//                 </Card>
//               </div>

//               <Card>
//                 <CardHeader>
//                   <CardTitle className="text-sm">Clientes Conectados</CardTitle>
//                 </CardHeader>
//                 <CardContent>
//                   <ScrollArea className="h-32">
//                     {connectedClients.length === 0 ? (
//                       <p className="text-sm text-gray-500">
//                         No hay clientes conectados
//                       </p>
//                     ) : (
//                       <div className="space-y-2">
//                         {connectedClients.map((client) => (
//                           <div
//                             key={client.userId}
//                             className="flex items-center justify-between text-sm"
//                           >
//                             <span className="flex items-center">
//                               <User className="h-3 w-3 mr-1" />
//                               {client.userId.substring(0, 8)}...
//                             </span>
//                             <span className="text-gray-500">
//                               {new Date(
//                                 client.connectedAt
//                               ).toLocaleTimeString()}
//                             </span>
//                           </div>
//                         ))}
//                       </div>
//                     )}
//                   </ScrollArea>
//                 </CardContent>
//               </Card>

//               <Card>
//                 <CardHeader>
//                   <CardTitle className="text-sm">Notificaciones</CardTitle>
//                 </CardHeader>
//                 <CardContent>
//                   <ScrollArea className="h-32">
//                     {notifications.length === 0 ? (
//                       <p className="text-sm text-gray-500">
//                         No hay notificaciones
//                       </p>
//                     ) : (
//                       <div className="space-y-1">
//                         {notifications.slice(-5).map((notif, index) => (
//                           <div
//                             key={index}
//                             className="text-xs text-gray-600 p-2 bg-gray-50 rounded"
//                           >
//                             {notif}
//                           </div>
//                         ))}
//                       </div>
//                     )}
//                   </ScrollArea>
//                 </CardContent>
//               </Card>
//             </TabsContent>

//             <TabsContent value="chats" className="flex-1 p-4">
//               <div className="space-y-4">
//                 <h3 className="font-medium">
//                   Chats Asignados ({assignedChats.length})
//                 </h3>
//                 {assignedChats.length === 0 ? (
//                   <p className="text-sm text-gray-500">
//                     No hay chats asignados. El sistema te asignará
//                     automáticamente cuando un cliente solicite soporte humano.
//                   </p>
//                 ) : (
//                   <ScrollArea className="h-96">
//                     <div className="space-y-2">
//                       {assignedChats.map((chat) => (
//                         <Card
//                           key={chat.chatId}
//                           className={`cursor-pointer transition-colors ${
//                             currentChatId === chat.chatId
//                               ? "bg-blue-50 border-blue-200"
//                               : ""
//                           }`}
//                         >
//                           <CardContent className="p-3">
//                             <div className="flex items-center justify-between">
//                               <div>
//                                 <div className="font-medium text-sm">
//                                   Chat {chat.chatId.substring(0, 8)}...
//                                 </div>
//                                 <div className="text-xs text-gray-500">
//                                   Cliente: {chat.clientId.substring(0, 8)}...
//                                 </div>
//                                 <div className="text-xs text-gray-400">
//                                   Asignado:{" "}
//                                   {chat.assignedAt.toLocaleTimeString()}
//                                 </div>
//                               </div>
//                               <div className="flex flex-col space-y-1">
//                                 <Button
//                                   size="sm"
//                                   variant={
//                                     currentChatId === chat.chatId
//                                       ? "default"
//                                       : "outline"
//                                   }
//                                   onClick={() => handleJoinChat(chat.chatId)}
//                                 >
//                                   {currentChatId === chat.chatId
//                                     ? "Activo"
//                                     : "Abrir"}
//                                 </Button>
//                                 <Button
//                                   size="sm"
//                                   variant="destructive"
//                                   onClick={() => handleFinishChat(chat.chatId)}
//                                   disabled={!isConnected}
//                                 >
//                                   <CheckCircle className="h-3 w-3" />
//                                 </Button>
//                               </div>
//                             </div>
//                           </CardContent>
//                         </Card>
//                       ))}
//                     </div>
//                   </ScrollArea>
//                 )}
//               </div>
//             </TabsContent>

//             <TabsContent value="ratings" className="flex-1 p-4">
//               <div className="space-y-4">
//                 <h3 className="font-medium">
//                   Calificaciones Recientes ({recentRatings.length})
//                 </h3>
//                 {recentRatings.length === 0 ? (
//                   <p className="text-sm text-gray-500">
//                     No hay calificaciones recientes
//                   </p>
//                 ) : (
//                   <ScrollArea className="h-96">
//                     <div className="space-y-3">
//                       {recentRatings.map((rating, index) => (
//                         <Card key={index}>
//                           <CardContent className="p-3">
//                             <div className="flex items-center justify-between mb-2">
//                               <div className="flex items-center space-x-2">
//                                 <span className="text-lg">
//                                   {rating.ratingStars}
//                                 </span>
//                                 <span className="text-sm font-medium">
//                                   ({rating.rating}/5)
//                                 </span>
//                               </div>
//                               <span className="text-xs text-gray-500">
//                                 {rating.timestamp.toLocaleTimeString()}
//                               </span>
//                             </div>
//                             <div className="text-xs text-gray-600 mb-2">
//                               Cliente: {rating.clientId.substring(0, 8)}... |
//                               Chat: {rating.chatId.substring(0, 8)}...
//                             </div>
//                             {rating.comment && (
//                               <p className="text-sm text-gray-700 italic">
//                                 "{rating.comment}"
//                               </p>
//                             )}
//                             <div className="text-xs text-gray-500 mt-2">
//                               Amabilidad: {rating.categories.friendliness}/5 |
//                               Utilidad: {rating.categories.helpfulness}
//                               /5 | Tiempo: {rating.categories.responseTime}/5 |
//                               Resolución: {rating.categories.problemResolution}
//                               /5
//                             </div>
//                           </CardContent>
//                         </Card>
//                       ))}
//                     </div>
//                   </ScrollArea>
//                 )}
//               </div>
//             </TabsContent>
//           </Tabs>
//         </div>

//         {/* Main Chat Area */}
//         <div className="flex-1 flex flex-col">
//           {currentChatId ? (
//             <>
//               {/* Chat Header */}
//               <div className="bg-white border-b p-4 flex items-center justify-between">
//                 <div>
//                   <h2 className="font-medium">
//                     Chat Activo: {currentChatId.substring(0, 8)}...
//                   </h2>
//                   <p className="text-sm text-gray-500">
//                     Cliente:{" "}
//                     {assignedChats
//                       .find((c) => c.chatId === currentChatId)
//                       ?.clientId.substring(0, 8)}
//                     ...
//                   </p>
//                 </div>
//                 <Button
//                   variant="destructive"
//                   size="sm"
//                   onClick={() => handleFinishChat(currentChatId)}
//                   disabled={!isConnected}
//                 >
//                   <CheckCircle className="h-4 w-4 mr-2" />
//                   Finalizar Chat
//                 </Button>
//               </div>

//               {/* Messages */}
//               <ScrollArea className="flex-1 p-4">
//                 <div className="space-y-4">
//                   {messages
//                     .filter((m) => m.chatId === currentChatId)
//                     .map((message) => (
//                       <ChatMessage
//                         key={message.id}
//                         message={{
//                           ...message,
//                           type: message.type || "text", // default en caso que no venga
//                         }}
//                         currentUserId={"OPERADOR"}
//                       />
//                     ))}
//                   {isTyping && (
//                     <div className="flex justify-start">
//                       <div className="bg-gray-100 rounded-lg px-3 py-2">
//                         <div className="flex space-x-1">
//                           <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
//                           <div
//                             className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
//                             style={{ animationDelay: "150ms" }}
//                           />
//                           <div
//                             className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
//                             style={{ animationDelay: "300ms" }}
//                           />
//                         </div>
//                       </div>
//                     </div>
//                   )}
//                   <div ref={messagesEndRef} />
//                 </div>
//               </ScrollArea>

//               {/* Input */}
//               <div className="bg-white border-t p-4">
//                 <form onSubmit={handleSendMessage} className="flex space-x-2">
//                   <Input
//                     value={inputMessage}
//                     onChange={(e) => setInputMessage(e.target.value)}
//                     placeholder="Responder al cliente..."
//                     disabled={!isConnected}
//                     className="flex-1"
//                   />
//                   <Button
//                     type="submit"
//                     disabled={!isConnected || !inputMessage.trim()}
//                   >
//                     <Send className="h-4 w-4" />
//                   </Button>
//                 </form>
//               </div>
//             </>
//           ) : (
//             <div className="flex-1 flex items-center justify-center">
//               <Card className="w-full max-w-md mx-4">
//                 <CardHeader className="text-center">
//                   <Clock className="h-12 w-12 mx-auto mb-4 text-purple-600" />
//                   <CardTitle>Esperando Asignaciones</CardTitle>
//                   <p className="text-gray-600">
//                     Los chats se asignarán automáticamente cuando los clientes
//                     soliciten soporte humano
//                   </p>
//                 </CardHeader>
//                 <CardContent>
//                   <div className="flex items-center justify-center space-x-2">
//                     <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
//                     <span className="text-sm text-gray-500">Esperando...</span>
//                   </div>
//                 </CardContent>
//               </Card>
//             </div>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// }














// "use client"

// import type React from "react"

// import { useState, useEffect, useRef } from "react"
// import { useSocket } from "@/hooks/use-socket"
// import { useAuth } from "@/components/providers/auth-provider"
// import { useToast } from "@/hooks/use-toast"
// import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
// import { DashboardSidebar } from "@/components/dashboard/sidebar"
// import { StatsCard } from "@/components/dashboard/stats-card"
// import { ActivityChart } from "@/components/dashboard/activity-chart"
// import { ActiveChats } from "@/components/dashboard/active-chats"
// import { ChatPanel } from "@/components/dashboard/chat-panel"
// import { RecentRatings } from "@/components/dashboard/recent-ratings"
// import { NotificationsPanel } from "@/components/dashboard/notifications-panel"
// import { Users, MessageSquare, Star, Clock } from "lucide-react"

// interface Message {
//   id: string
//   content: string
//   sender: "CLIENT" | "BOT" | "OPERADOR" | "SYSTEM"
//   timestamp: Date
//   chatId: string
//   senderName?: string
//   type: "TEXT" | "IMAGE"
//   imageUrl?: string
// }

// interface ConnectedClient {
//   userId: string
//   connectedAt: Date
//   currentChatId?: string
// }

// interface ChatInfo {
//   chatId: string
//   clientId: string
//   assignedAt: Date
//   isActive: boolean
//   lastMessage?: string
//   unreadCount?: number
// }

// interface Rating {
//   chatId: string
//   rating: number
//   comment: string
//   categories: {
//     friendliness: number
//     helpfulness: number
//     responseTime: number
//     problemResolution: number
//   }
//   clientId: string
//   timestamp: Date
//   ratingStars: string
// }

// export function OperatorDashboard() {
//   const { user, logout } = useAuth()
//   const { toast } = useToast()
//   const [messages, setMessages] = useState<Message[]>([])
//   const [assignedChats, setAssignedChats] = useState<ChatInfo[]>([])
//   const [currentChatId, setCurrentChatId] = useState<string | null>(null)
//   const [isTyping, setIsTyping] = useState(false)
//   const [notifications, setNotifications] = useState<string[]>([])
//   const [connectedClients, setConnectedClients] = useState<ConnectedClient[]>([])
//   const [recentRatings, setRecentRatings] = useState<Rating[]>([])
//   const [inputMessage, setInputMessage] = useState("")
//   const [stats, setStats] = useState({
//     totalActiveChats: 0,
//     connectedClients: 0,
//     connectedOperators: 0,
//     averageRating: 4.7,
//     responseTime: "1.2m",
//   })

//   const specialistId = useRef(user?.id || `operador-${Math.random().toString(36).substr(2, 9)}`)

//   const { socket, isConnected } = useSocket({
//     userRole: "OPERADOR",
//     serverUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002",
//   })

//   const addNotification = (message: string) => {
//     setNotifications((prev) => [...prev.slice(-9), `${new Date().toLocaleTimeString()}: ${message}`])
//   }

//   const playNotificationSound = () => {
//     try {
//       const audio = new Audio(
//         "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT",
//       )
//       audio.play().catch(() => {})
//     } catch (error) {
//       // Ignorar errores de audio
//     }
//   }

//   useEffect(() => {
//     if (!socket) return

//     socket.on("operatorDashboard", (data) => {
//       console.log("📊 [OPERADOR] Dashboard recibido:", data)
//       setConnectedClients(data.connectedClients || [])
//       setStats((prev) => ({
//         ...prev,
//         totalActiveChats: data.assignedChats?.length || 0,
//       }))
//     })

//     socket.on("connectedUsersUpdate", (data) => {
//       console.log("👥 [OPERADOR] Usuarios conectados actualizados:", data)
//       setConnectedClients(data.clients || [])
//       setStats((prev) => ({
//         ...prev,
//         connectedClients: data.clients?.length || 0,
//         connectedOperators: data.operators?.length || 0,
//       }))
//     })

//     socket.on("chatAutoAssigned", (data) => {
//       console.log("🚨 [OPERADOR] Chat auto-asignado RECIBIDO:", data)
//       addNotification(`🚨 NUEVO CHAT ASIGNADO: Cliente ${data.clientId}`)

//       const newChat: ChatInfo = {
//         chatId: data.chatId,
//         clientId: data.clientId,
//         assignedAt: new Date(data.timestamp),
//         isActive: true,
//       }

//       setAssignedChats((prev) => [...prev, newChat])

//       if (!currentChatId) {
//         setCurrentChatId(data.chatId)
//       }

//       if (data.history) {
//         const historyMessages = data.history.map((msg: any) => ({
//           id: msg.id,
//           content: msg.content,
//           sender: msg.sender,
//           timestamp: new Date(msg.timestamp),
//           chatId: msg.chatId,
//           senderName: msg.senderName,
//           type: msg.type || "TEXT",
//         }))

//         setMessages(historyMessages)
//       }

//       playNotificationSound()

//       toast({
//         title: "Nuevo chat asignado",
//         description: `Cliente ${data.clientId} necesita ayuda`,
//       })
//     })

//     socket.on("chatFinished", (data) => {
//       console.log("✅ [OPERADOR] Chat finalizado exitosamente:", data)

//       setAssignedChats((prev) => prev.filter((chat) => chat.chatId !== data.chatId))

//       if (currentChatId === data.chatId) {
//         setCurrentChatId(null)
//         setMessages([])
//       }

//       addNotification(`✅ Chat ${data.chatId} finalizado exitosamente`)

//       toast({
//         title: "Chat finalizado",
//         description: "El chat ha sido finalizado exitosamente",
//       })
//     })

//     socket.on("chatRated", (data) => {
//       console.log("⭐ [OPERADOR] Chat calificado:", data)

//       const ratingText = "⭐".repeat(data.rating)
//       const commentText = data.comment ? ` - "${data.comment}"` : ""

//       addNotification(`⭐ CALIFICACIÓN RECIBIDA: ${ratingText} (${data.rating}/5)${commentText}`)

//       setRecentRatings((prev) => [
//         {
//           chatId: data.chatId,
//           rating: data.rating,
//           comment: data.comment,
//           categories: data.categories,
//           clientId: data.clientId,
//           timestamp: new Date(data.timestamp),
//           ratingStars: "⭐".repeat(data.rating),
//         },
//         ...prev.slice(0, 9),
//       ])

//       playNotificationSound()

//       toast({
//         title: "Nueva calificación",
//         description: `Recibiste ${data.rating} estrellas`,
//       })
//     })

//     socket.on("newMessage", (message) => {
//       console.log("💬 [OPERADOR] Nuevo mensaje:", message)

//       // Actualizar el último mensaje en el chat correspondiente
//       setAssignedChats((prev) =>
//         prev.map((chat) => {
//           if (chat.chatId === message.chatId && message.senderType === "CLIENT") {
//             return {
//               ...chat,
//               lastMessage: message.content,
//               unreadCount: (chat.unreadCount || 0) + (currentChatId !== message.chatId ? 1 : 0),
//             }
//           }
//           return chat
//         }),
//       )

//       setMessages((prev) => [
//         ...prev,
//         {
//           id: message.id,
//           content: message.content,
//           sender: message.senderType,
//           timestamp: new Date(message.timestamp),
//           chatId: message.chatId,
//           senderName:
//             message.senderType === "CLIENT"
//               ? `Cliente ${message.userId}`
//               : message.senderType === "BOT"
//                 ? "Depilbot"
//                 : message.senderType === "OPERADOR"
//                   ? "Tú"
//                   : "Sistema",
//           type: message.type || "TEXT",
//           imageUrl: message.imageUrl,
//         },
//       ])

//       // Si el mensaje es de un cliente y no es el chat actual, reproducir sonido
//       if (message.senderType === "CLIENT" && message.chatId !== currentChatId) {
//         playNotificationSound()
//       }
//     })

//     socket.on("joinedChat", (data) => {
//       console.log("✅ [OPERADOR] Unido al chat:", data)
//     })

//     socket.on("chatHistory", (data) => {
//       console.log("📚 [OPERADOR] Historial recibido:", data)

//       const historyMessages = data.messages.map((msg: any) => ({
//         id: msg.id,
//         content: msg.content,
//         sender: msg.sender,
//         timestamp: new Date(msg.timestamp),
//         chatId: msg.chatId,
//         senderName: msg.senderName,
//         type: msg.type || "TEXT",
//         imageUrl: msg.imageUrl,
//       }))

//       setMessages(historyMessages)
//     })

//     socket.on("userTyping", (data) => {
//       console.log("⌨️ [OPERADOR] Usuario escribiendo:", data)

//       if (data.userId !== specialistId.current) {
//         setIsTyping(data.isTyping)
//       }
//     })

//     socket.on("error", (error) => {
//       console.error("❌ [OPERADOR] Error:", error)

//       addNotification(`❌ Error: ${error.message}`)

//       toast({
//         title: "Error",
//         description: error.message || "Ha ocurrido un error",
//         variant: "destructive",
//       })
//     })

//     return () => {
//       socket.off("operatorDashboard")
//       socket.off("connectedUsersUpdate")
//       socket.off("chatAutoAssigned")
//       socket.off("chatFinished")
//       socket.off("chatRated")
//       socket.off("newMessage")
//       socket.off("joinedChat")
//       socket.off("chatHistory")
//       socket.off("userTyping")
//       socket.off("error")
//     }
//   }, [socket, currentChatId, toast])

//   const handleJoinChat = (chatId: string) => {
//     if (!socket || !isConnected) {
//       toast({
//         title: "Error de conexión",
//         description: "No se puede conectar al servidor",
//         variant: "destructive",
//       })
//       return
//     }

//     console.log("🚀 [OPERADOR] Uniéndose al chat:", chatId)
//     socket.emit("joinChat", { chatId })
//     setCurrentChatId(chatId)

//     // Resetear contador de mensajes no leídos
//     setAssignedChats((prev) =>
//       prev.map((chat) => {
//         if (chat.chatId === chatId) {
//           return { ...chat, unreadCount: 0 }
//         }
//         return chat
//       }),
//     )
//   }

//   const handleFinishChat = (chatId: string) => {
//     if (!socket || !isConnected) {
//       toast({
//         title: "Error de conexión",
//         description: "No se puede conectar al servidor",
//         variant: "destructive",
//       })
//       return
//     }

//     if (confirm("¿Estás seguro de que quieres finalizar este chat?")) {
//       console.log("🏁 [OPERADOR] Finalizando chat:", chatId)
//       socket.emit("finishChat", {
//         chatId,
//         reason: "Chat finalizado por el operador",
//       })
//     }
//   }

//   const handleSendMessage = (e: React.FormEvent) => {
//     e.preventDefault()

//     if (!inputMessage.trim() || !socket || !currentChatId || !isConnected) {
//       return
//     }

//     console.log("📤 [OPERADOR] Enviando mensaje:", inputMessage)
//     socket.emit("sendMessage", {
//       userId: specialistId.current,
//       chatId: currentChatId,
//       content: inputMessage,
//     })

//     setInputMessage("")
//   }

//   // Obtener el cliente actual
//   const currentClient = currentChatId ? assignedChats.find((chat) => chat.chatId === currentChatId)?.clientId : null

//   return (
//     <SidebarProvider>
//       <DashboardSidebar />
//       <SidebarInset>
//         <div className="flex flex-col h-screen bg-slate-50">
//           <div className="flex-1 p-6 space-y-6 overflow-auto">
//             {/* Stats Row */}
//             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
//               <StatsCard
//                 title="Clientes Online"
//                 value={stats.connectedClients}
//                 icon={Users}
//                 variant="blue"
//                 trend={{ value: 12, isPositive: true }}
//               />
//               <StatsCard
//                 title="Chats Activos"
//                 value={assignedChats.length}
//                 icon={MessageSquare}
//                 variant="green"
//                 iconColor="text-green-500"
//               />
//               <StatsCard
//                 title="Calificación Promedio"
//                 value={stats.averageRating}
//                 icon={Star}
//                 variant="amber"
//                 iconColor="text-amber-500"
//               />
//               <StatsCard
//                 title="Tiempo de Respuesta"
//                 value={stats.responseTime}
//                 icon={Clock}
//                 variant="purple"
//                 iconColor="text-purple-500"
//               />
//             </div>

//             {/* Main Content */}
//             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
//               <div className="lg:col-span-2 space-y-6">
//                 {/* Activity Chart */}
//                 <ActivityChart />

//                 {/* Notifications */}
//                 <NotificationsPanel notifications={notifications} />
//               </div>

//               <div className="space-y-6">
//                 {/* Active Chats */}
//                 <ActiveChats
//                   chats={assignedChats}
//                   currentChatId={currentChatId}
//                   onJoinChat={handleJoinChat}
//                   onFinishChat={handleFinishChat}
//                 />

//                 {/* Recent Ratings */}
//                 <RecentRatings ratings={recentRatings} />
//               </div>
//             </div>

//             {/* Chat Panel */}
//             <div className="h-[600px]">
//               <ChatPanel
//                 chatId={currentChatId}
//                 clientId={currentClient}
//                 messages={messages.filter((m) => m.chatId === currentChatId)}
//                 isTyping={isTyping}
//                 onSendMessage={handleSendMessage}
//                 inputMessage={inputMessage}
//                 setInputMessage={setInputMessage}
//                 onFinishChat={handleFinishChat}
//                 isConnected={isConnected}
//               />
//             </div>
//           </div>
//         </div>
//       </SidebarInset>
//     </SidebarProvider>
//   )
// }



"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { useSocket } from "@/hooks/use-socket"
import { useAuth } from "@/components/providers/auth-provider"
import { useToast } from "@/hooks/use-toast"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { DashboardSidebar } from "@/components/dashboard/sidebar"
import { StatsCard } from "@/components/dashboard/stats-card"
import { ActivityChart } from "@/components/dashboard/activity-chart"
import { ActiveChats } from "@/components/dashboard/active-chats"
import { ChatPanel } from "@/components/dashboard/chat-panel"
import { RecentRatings } from "@/components/dashboard/recent-ratings"
import { NotificationsPanel } from "@/components/dashboard/notifications-panel"
import { Users, MessageSquare, Star, Clock } from "lucide-react"

interface Message {
  id: string
  content: string
  sender: "CLIENT" | "BOT" | "OPERADOR" | "SYSTEM"
  timestamp: Date
  chatId: string
  senderName?: string
  type: "TEXT" | "IMAGE"
  imageUrl?: string
}

interface ConnectedClient {
  userId: string
  connectedAt: Date
  currentChatId?: string
}

interface ChatInfo {
  chatId: string
  clientId: string
  assignedAt: Date
  isActive: boolean
  lastMessage?: string
  unreadCount?: number
}

interface Rating {
  chatId: string
  rating: number
  comment: string
  categories: {
    friendliness: number
    helpfulness: number
    responseTime: number
    problemResolution: number
  }
  clientId: string
  timestamp: Date
  ratingStars: string
}

export function OperatorDashboard() {
  const { user, logout } = useAuth()
  const { toast } = useToast()
  const [messages, setMessages] = useState<Message[]>([])
  const [assignedChats, setAssignedChats] = useState<ChatInfo[]>([])
  const [currentChatId, setCurrentChatId] = useState<string | null>(null)
  const [isTyping, setIsTyping] = useState(false)
  const [notifications, setNotifications] = useState<string[]>([])
  const [connectedClients, setConnectedClients] = useState<ConnectedClient[]>([])
  const [recentRatings, setRecentRatings] = useState<Rating[]>([])
  const [inputMessage, setInputMessage] = useState("")
  const [stats, setStats] = useState({
    totalActiveChats: 0,
    connectedClients: 0,
    connectedOperators: 0,
    averageRating: 4.7,
    responseTime: "1.2m",
  })

  const specialistId = useRef(user?.id || `operador-${Math.random().toString(36).substr(2, 9)}`)

  const { socket, isConnected } = useSocket({
    userRole: "OPERADOR",
    serverUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002",
  })

  const addNotification = (message: string) => {
    setNotifications((prev) => [...prev.slice(-9), `${new Date().toLocaleTimeString()}: ${message}`])
  }

  const playNotificationSound = () => {
    try {
      const audio = new Audio(
        "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT",
      )
      audio.play().catch(() => {})
    } catch (error) {
      // Ignorar errores de audio
    }
  }

  useEffect(() => {
    if (!socket) return

    socket.on("operatorDashboard", (data) => {
      console.log("📊 [OPERADOR] Dashboard recibido:", data)
      setConnectedClients(data.connectedClients || [])
      setStats((prev) => ({
        ...prev,
        totalActiveChats: data.assignedChats?.length || 0,
      }))
    })

    socket.on("connectedUsersUpdate", (data) => {
      console.log("👥 [OPERADOR] Usuarios conectados actualizados:", data)
      setConnectedClients(data.clients || [])
      setStats((prev) => ({
        ...prev,
        connectedClients: data.clients?.length || 0,
        connectedOperators: data.operators?.length || 0,
      }))
    })

    socket.on("chatAutoAssigned", (data) => {
      console.log("🚨 [OPERADOR] Chat auto-asignado RECIBIDO:", data)
      addNotification(`🚨 NUEVO CHAT ASIGNADO: Cliente ${data.clientId}`)

      const newChat: ChatInfo = {
        chatId: data.chatId,
        clientId: data.clientId,
        assignedAt: new Date(data.timestamp),
        isActive: true,
      }

      setAssignedChats((prev) => [...prev, newChat])

      if (!currentChatId) {
        setCurrentChatId(data.chatId)
      }

      if (data.history) {
        const historyMessages = data.history.map((msg: any) => ({
          id: msg.id,
          content: msg.content,
          sender: msg.sender,
          timestamp: new Date(msg.timestamp),
          chatId: msg.chatId,
          senderName: msg.senderName,
          type: msg.type || "TEXT",
        }))

        setMessages(historyMessages)
      }

      playNotificationSound()

      toast({
        title: "Nuevo chat asignado",
        description: `Cliente ${data.clientId} necesita ayuda`,
      })
    })

    socket.on("chatFinished", (data) => {
      console.log("✅ [OPERADOR] Chat finalizado exitosamente:", data)

      setAssignedChats((prev) => prev.filter((chat) => chat.chatId !== data.chatId))

      if (currentChatId === data.chatId) {
        setCurrentChatId(null)
        setMessages([])
      }

      addNotification(`✅ Chat ${data.chatId} finalizado exitosamente`)

      toast({
        title: "Chat finalizado",
        description: "El chat ha sido finalizado exitosamente",
      })
    })

    socket.on("chatRated", (data) => {
      console.log("⭐ [OPERADOR] Chat calificado:", data)

      const ratingText = "⭐".repeat(data.rating)
      const commentText = data.comment ? ` - "${data.comment}"` : ""

      addNotification(`⭐ CALIFICACIÓN RECIBIDA: ${ratingText} (${data.rating}/5)${commentText}`)

      setRecentRatings((prev) => [
        {
          chatId: data.chatId,
          rating: data.rating,
          comment: data.comment,
          categories: data.categories,
          clientId: data.clientId,
          timestamp: new Date(data.timestamp),
          ratingStars: "⭐".repeat(data.rating),
        },
        ...prev.slice(0, 9),
      ])

      playNotificationSound()

      toast({
        title: "Nueva calificación",
        description: `Recibiste ${data.rating} estrellas`,
      })
    })

    socket.on("newMessage", (message) => {
      console.log("💬 [OPERADOR] Nuevo mensaje:", message)

      // Actualizar el último mensaje en el chat correspondiente
      setAssignedChats((prev) =>
        prev.map((chat) => {
          if (chat.chatId === message.chatId && message.senderType === "CLIENT") {
            return {
              ...chat,
              lastMessage: message.content,
              unreadCount: (chat.unreadCount || 0) + (currentChatId !== message.chatId ? 1 : 0),
            }
          }
          return chat
        }),
      )

      setMessages((prev) => [
        ...prev,
        {
          id: message.id,
          content: message.content,
          sender: message.senderType,
          timestamp: new Date(message.timestamp),
          chatId: message.chatId,
          senderName:
            message.senderType === "CLIENT"
              ? `Cliente ${message.userId}`
              : message.senderType === "BOT"
                ? "Depilbot"
                : message.senderType === "OPERADOR"
                  ? "Tú"
                  : "Sistema",
          type: message.type || "TEXT",
          imageUrl: message.imageUrl,
        },
      ])

      // Si el mensaje es de un cliente y no es el chat actual, reproducir sonido
      if (message.senderType === "CLIENT" && message.chatId !== currentChatId) {
        playNotificationSound()
      }
    })

    socket.on("joinedChat", (data) => {
      console.log("✅ [OPERADOR] Unido al chat:", data)
    })

    socket.on("chatHistory", (data) => {
      console.log("📚 [OPERADOR] Historial recibido:", data)

      const historyMessages = data.messages.map((msg: any) => ({
        id: msg.id,
        content: msg.content,
        sender: msg.sender,
        timestamp: new Date(msg.timestamp),
        chatId: msg.chatId,
        senderName: msg.senderName,
        type: msg.type || "TEXT",
        imageUrl: msg.imageUrl,
      }))

      setMessages(historyMessages)
    })

    socket.on("userTyping", (data) => {
      console.log("⌨️ [OPERADOR] Usuario escribiendo:", data)

      if (data.userId !== specialistId.current) {
        setIsTyping(data.isTyping)
      }
    })

    socket.on("error", (error) => {
      console.error("❌ [OPERADOR] Error:", error)

      addNotification(`❌ Error: ${error.message}`)

      toast({
        title: "Error",
        description: error.message || "Ha ocurrido un error",
        variant: "destructive",
      })
    })

    return () => {
      socket.off("operatorDashboard")
      socket.off("connectedUsersUpdate")
      socket.off("chatAutoAssigned")
      socket.off("chatFinished")
      socket.off("chatRated")
      socket.off("newMessage")
      socket.off("joinedChat")
      socket.off("chatHistory")
      socket.off("userTyping")
      socket.off("error")
    }
  }, [socket, currentChatId, toast])

  const handleJoinChat = (chatId: string) => {
    if (!socket || !isConnected) {
      toast({
        title: "Error de conexión",
        description: "No se puede conectar al servidor",
        variant: "destructive",
      })
      return
    }

    console.log("🚀 [OPERADOR] Uniéndose al chat:", chatId)
    socket.emit("joinChat", { chatId })
    setCurrentChatId(chatId)

    // Resetear contador de mensajes no leídos
    setAssignedChats((prev) =>
      prev.map((chat) => {
        if (chat.chatId === chatId) {
          return { ...chat, unreadCount: 0 }
        }
        return chat
      }),
    )
  }

  const handleFinishChat = (chatId: string) => {
    if (!socket || !isConnected) {
      toast({
        title: "Error de conexión",
        description: "No se puede conectar al servidor",
        variant: "destructive",
      })
      return
    }

    if (confirm("¿Estás seguro de que quieres finalizar este chat?")) {
      console.log("🏁 [OPERADOR] Finalizando chat:", chatId)
      socket.emit("finishChat", {
        chatId,
        reason: "Chat finalizado por el operador",
      })
    }
  }

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()

    if (!inputMessage.trim() || !socket || !currentChatId || !isConnected) {
      return
    }

    console.log("📤 [OPERADOR] Enviando mensaje:", inputMessage)
    socket.emit("sendMessage", {
      userId: specialistId.current,
      chatId: currentChatId,
      content: inputMessage,
    })

    setInputMessage("")
  }

  // Obtener el cliente actual
  const currentClient = currentChatId
    ? assignedChats.find((chat) => chat.chatId === currentChatId)?.clientId || null
    : null

  return (
    <SidebarProvider>
      <DashboardSidebar />
      <SidebarInset>
        <div className="flex flex-col h-screen bg-slate-50">
          <div className="flex-1 p-6 space-y-6 overflow-auto">
            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatsCard
                title="Clientes Online"
                value={stats.connectedClients}
                icon={Users}
                variant="blue"
                trend={{ value: 12, isPositive: true }}
              />
              <StatsCard
                title="Chats Activos"
                value={assignedChats.length}
                icon={MessageSquare}
                variant="green"
                iconColor="text-green-500"
              />
              <StatsCard
                title="Calificación Promedio"
                value={stats.averageRating}
                icon={Star}
                variant="amber"
                iconColor="text-amber-500"
              />
              <StatsCard
                title="Tiempo de Respuesta"
                value={stats.responseTime}
                icon={Clock}
                variant="purple"
                iconColor="text-purple-500"
              />
            </div>

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                {/* Activity Chart */}
                <ActivityChart />

                {/* Notifications */}
                <NotificationsPanel notifications={notifications} />
              </div>

              <div className="space-y-6">
                {/* Active Chats */}
                <ActiveChats
                  chats={assignedChats}
                  currentChatId={currentChatId}
                  onJoinChat={handleJoinChat}
                  onFinishChat={handleFinishChat}
                />

                {/* Recent Ratings */}
                <RecentRatings ratings={recentRatings} />
              </div>
            </div>

            {/* Chat Panel */}
            <div className="h-[600px]">
              <ChatPanel
                chatId={currentChatId}
                clientId={currentClient}
                messages={messages.filter((m) => m.chatId === currentChatId)}
                isTyping={isTyping}
                onSendMessage={handleSendMessage}
                inputMessage={inputMessage}
                setInputMessage={setInputMessage}
                onFinishChat={handleFinishChat}
                isConnected={isConnected}
              />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
