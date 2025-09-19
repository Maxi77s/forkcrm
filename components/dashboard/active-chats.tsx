"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CheckCircle, MessageSquare, Clock, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";

interface ChatInfo {
  chatId: string;
  clientId: string;
  clientName?: string;
  assignedAt: Date;
  isActive: boolean;
  lastMessage?: string;
  unreadCount?: number;
}

interface ActiveChatsProps {
  chats: ChatInfo[];
  currentChatId: string | null;
  onJoinChat: (chatId: string) => void;
  onFinishChat: (chatId: string) => void;
}

export function ActiveChats({
  chats,
  currentChatId,
  onJoinChat,
  onFinishChat,
}: ActiveChatsProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredChats = chats.filter(
    (chat) =>
      chat.chatId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      chat.clientId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">
            Chats Activos ({chats.length})
          </CardTitle>
          <Badge
            variant="outline"
            className="bg-sky-50 text-sky-700 border-sky-200"
          >
            En línea
          </Badge>
        </div>
        <div className="relative mt-2">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar chats..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px]">
          {filteredChats.length === 0 ? (
            <div className="py-12 px-4 text-center">
              <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground opacity-20" />
              <p className="mt-2 text-muted-foreground">No hay chats activos</p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredChats.map((chat) => (
                <div
                  key={chat.chatId}
                  className={`p-4 hover:bg-slate-50 transition-colors ${
                    currentChatId === chat.chatId ? "bg-sky-50" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Avatar className="h-10 w-10 mr-3">
                        <AvatarFallback className="bg-sky-100 text-sky-600">
                          {chat.clientName
                            ? chat.clientName.substring(0, 2).toUpperCase()
                            : chat.clientId.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center">
                          <p className="font-medium">
                            {chat.clientName ??
                              `Cliente ${chat.clientId.substring(0, 8)}...`}
                          </p>

                          {chat.unreadCount && (
                            <Badge className="ml-2 bg-sky-500">
                              {chat.unreadCount}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center text-xs text-muted-foreground mt-1">
                          <Clock className="h-3 w-3 mr-1" />
                          <span>
                            {chat.assignedAt.toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        {chat.lastMessage && (
                          <p className="text-sm text-muted-foreground mt-1 truncate max-w-[180px]">
                            {chat.lastMessage}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col space-y-2">
                      <Button
                        size="sm"
                        variant={
                          currentChatId === chat.chatId ? "default" : "outline"
                        }
                        onClick={() => onJoinChat(chat.chatId)}
                        className={
                          currentChatId === chat.chatId
                            ? "bg-sky-500 hover:bg-sky-600"
                            : ""
                        }
                      >
                        {currentChatId === chat.chatId ? "Activo" : "Abrir"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-green-200 text-green-700 hover:bg-green-50 bg-transparent"
                        onClick={() => onFinishChat(chat.chatId)}
                      >
                        <CheckCircle className="h-3 w-3 mr-1" />
                        <span>Finalizar</span>
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
