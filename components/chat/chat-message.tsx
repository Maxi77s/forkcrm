/*"use client"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Bot, User, Headphones, Settings } from "lucide-react"

interface Message {
  id: string
  content?: string
  sender: "CLIENT" | "BOT" | "OPERADOR" | "SYSTEM"
  timestamp: Date
  chatId?: string
  senderName?: string
  type: "TEXT" | "IMAGE"          
  imageUrl?: string           
   userId?: string    
}

interface ChatMessageProps {
  message: Message
  isOwn?: boolean
  currentUserId?: string
}

export function ChatMessage({message, currentUserId}: ChatMessageProps) {
   const isOwn = message.userId === currentUserId
  const getSenderIcon = () => {
    switch (message.sender) {
      case "BOT":
        return <Bot className="h-4 w-4" />
      case "CLIENT":
        return <User className="h-4 w-4" />
      case "OPERADOR":
        return <Headphones className="h-4 w-4" />
      case "SYSTEM":
        return <Settings className="h-4 w-4" />
      default:
        return <User className="h-4 w-4" />
    }
  }

  const getSenderColor = () => {
    switch (message.sender) {
      case "BOT":
        return "bg-blue-500"
      case "CLIENT":
        return "bg-green-500"
      case "OPERADOR":
        return "bg-purple-500"
      case "SYSTEM":
        return "bg-gray-500"
      default:
        return "bg-gray-500"
    }
  }

  const getMessageAlignment = () => {
    if (message.sender === "SYSTEM") return "justify-center"
    return isOwn ? "justify-end" : "justify-start"
  }

  const getMessageStyle = () => {
    if (message.sender === "SYSTEM") {
      return "bg-gray-100 text-gray-700 text-center text-sm italic"
    }
    return isOwn ? "bg-blue-500 text-white ml-auto" : "bg-white border text-gray-900"
  }

  return (
    <div className={`flex ${getMessageAlignment()} mb-4`}>
      <div
        className={`flex items-start space-x-3 max-w-xs lg:max-w-md ${isOwn ? "flex-row-reverse space-x-reverse" : ""}`}
      >
        {!isOwn && message.sender !== "SYSTEM" && (
          <Avatar className="w-8 h-8">
            <AvatarFallback className={getSenderColor()}>{getSenderIcon()}</AvatarFallback>
          </Avatar>
        )}

        <div className={`flex flex-col ${isOwn ? "items-end" : "items-start"}`}>
          {!isOwn && message.sender !== "SYSTEM" && (
            <div className="flex items-center space-x-2 mb-1">
              <span className="text-xs font-medium text-gray-600">{message.senderName || message.sender}</span>
              <Badge variant="outline" className="text-xs">
                {message.sender}
              </Badge>
            </div>
          )}

    <div className={`rounded-lg px-4 py-2 ${getMessageStyle()}`}>
  {message.content && (
    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
  )}
  {message.type === "IMAGE" && message.imageUrl && (
    <img
      src={message.imageUrl}
      alt="Imagen enviada"
      className="max-w-full rounded-md mt-2 border"
    />
  )}
</div>

          <span className="text-xs text-gray-500 mt-1">{message.timestamp.toLocaleTimeString()}</span>
        </div>

        {isOwn && (
          <Avatar className="w-8 h-8">
            <AvatarFallback className="bg-blue-500">
              <User className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
        )}
      </div>
    </div>
  )
}
*/
"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Bot, User, Headphones, Settings } from "lucide-react"

interface Message {
  id: string;
  content?: string;
  sender: "CLIENT" | "BOT" | "OPERADOR" | "SYSTEM";
  timestamp: Date;
  chatId?: string;
  senderName?: string;
  type: "TEXT" | "IMAGE";
  imageUrl?: string;
  userId?: string;
}

interface ChatMessageProps {
  message: Message
  currentUserId: string | undefined
}

export function ChatMessage({ message, currentUserId }:ChatMessageProps) {
  const isOwn =
    message.sender === "CLIENT" ||
    (currentUserId && message.userId === currentUserId);

  const getSenderIcon = () => {
    switch (message.sender) {
      case "BOT":
        return (
          <AvatarImage src="/bot-icon.png" alt="Bot" className="object-cover" />
        );
      case "CLIENT":
        return <User className="h-4 w-4" />;
      case "OPERADOR":
        return <Headphones className="h-4 w-4" />;
      case "SYSTEM":
        return <Settings className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  const getSenderColor = () => {
    switch (message.sender) {
      case "BOT":
        return "bg-emerald-500";
      case "CLIENT":
        return "bg-green-500";
      case "OPERADOR":
        return "bg-purple-500";
      case "SYSTEM":
        return "bg-gray-500";
      default:
        return "bg-gray-500";
    }
  };

  const getMessageAlignment = () => {
    if (message.sender === "SYSTEM") return "justify-center";
    return isOwn ? "justify-end" : "justify-start";
  };

  const getMessageStyle = () => {
    switch (message.sender) {
      case "BOT":
        return "bg-emerald-100 text-emerald-900 border border-emerald-300";
      case "CLIENT":
        return "bg-green-100 text-green-900 border border-green-300";
      case "OPERADOR":
        return "bg-purple-100 text-purple-900 border border-purple-300";
      case "SYSTEM":
        return "bg-gray-100 text-gray-700 text-center text-sm italic";
      default:
        return "bg-white text-gray-900 border";
    }
  };

  return (
    <div className={`flex ${getMessageAlignment()} mb-4`}>
      <div
        className={`flex items-start space-x-3 max-w-xs lg:max-w-md ${
          isOwn ? "flex-row-reverse space-x-reverse" : ""
        }`}
      >
        {!isOwn && message.sender !== "SYSTEM" && (
          <Avatar className="w-8 h-8">
            {message.sender === "BOT" ? (
              <AvatarImage src="/bot-icon.png" alt="Bot" />
            ) : (
              <AvatarFallback className={getSenderColor()}>
                {getSenderIcon()}
              </AvatarFallback>
            )}
          </Avatar>
        )}

        <div className={`flex flex-col ${isOwn ? "items-end" : "items-start"}`}>
          {!isOwn && message.sender !== "SYSTEM" && (
            <div className="flex items-center space-x-2 mb-1">
              <span className="text-xs font-medium text-gray-600">
                {message.senderName || message.sender}
              </span>
              <Badge
                variant="outline"
                className={`text-xs ${
                  message.sender === "BOT"
                    ? "border-emerald-500 text-emerald-700"
                    : ""
                }`}
              >
                {message.sender}
              </Badge>
            </div>
          )}

          <div className={`rounded-lg px-4 py-2 ${getMessageStyle()}`}>
            {message.content && (
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            )}
            {message.type === "IMAGE" && message.imageUrl && (
              <img
                src={message.imageUrl}
                alt="Imagen enviada"
                className="max-w-full rounded-md mt-2 border"
              />
            )}
          </div>

          <span className="text-xs text-gray-500 mt-1">
            {message.timestamp.toLocaleTimeString()}
          </span>
        </div>

        {isOwn && (
          <Avatar className="w-8 h-8">
            <AvatarFallback className="bg-blue-500">
              <User className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
        )}
      </div>
    </div>
  );
}




// "use client"

// import { Avatar, AvatarFallback } from "@/components/ui/avatar"
// import { Badge } from "@/components/ui/badge"
// import { User, Bot, Headphones, Settings, Sparkles } from "lucide-react"
// import { cn } from "@/lib/utils"
// import Image from "next/image"
// import { ChatOptions } from "./chat-options"
// import type { Message, ChatOption } from "@/types/chats"

// interface ChatMessageProps {
//   message: Message
//   currentUserId: string
//   onOptionSelect?: (option: ChatOption) => void
//   isLatestBotMessage?: boolean
// }

// export function ChatMessage({ message, currentUserId, onOptionSelect, isLatestBotMessage = false }: ChatMessageProps) {
//   const isOwnMessage = message.sender === "OPERADOR"
//   const isSystemMessage = message.sender === "SYSTEM"
//   const isBotMessage = message.sender === "BOT"
//   const isClientMessage = message.sender === "CLIENT"

//   const getSenderIcon = () => {
//     switch (message.sender) {
//       case "CLIENT":
//         return <User className="h-4 w-4" />
//       case "BOT":
//         return <Bot className="h-4 w-4" />
//       case "OPERADOR":
//         return <Headphones className="h-4 w-4" />
//       case "SYSTEM":
//         return <Settings className="h-4 w-4" />
//       default:
//         return <User className="h-4 w-4" />
//     }
//   }

//   const getSenderColor = () => {
//     switch (message.sender) {
//       case "CLIENT":
//         return "bg-blue-100 text-blue-600"
//       case "BOT":
//         return "bg-gradient-to-r from-purple-100 to-purple-200 text-purple-700"
//       case "OPERADOR":
//         return "bg-sky-100 text-sky-600"
//       case "SYSTEM":
//         return "bg-gray-100 text-gray-600"
//       default:
//         return "bg-gray-100 text-gray-600"
//     }
//   }

//   const formatTime = (date: Date) => {
//     return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
//   }

//   if (isSystemMessage) {
//     return (
//       <div className="flex justify-center my-6">
//         <div className="bg-gradient-to-r from-gray-100 to-gray-200 rounded-full px-4 py-2 max-w-md shadow-sm">
//           <div className="flex items-center space-x-2 text-sm text-gray-600">
//             <Settings className="h-4 w-4" />
//             <span className="font-medium">{message.content}</span>
//           </div>
//           <div className="text-xs text-gray-400 text-center mt-1">{formatTime(message.timestamp)}</div>
//         </div>
//       </div>
//     )
//   }

//   return (
//     <div className={cn("flex items-start space-x-3 mb-6", isOwnMessage && "flex-row-reverse space-x-reverse")}>
//       {/* Avatar */}
//       <div className="flex-shrink-0">
//         <Avatar className={cn("h-10 w-10 shadow-md", isBotMessage && "ring-2 ring-purple-200")}>
//           <AvatarFallback className={getSenderColor()}>
//             {isBotMessage && <Sparkles className="h-4 w-4" />}
//             {!isBotMessage && getSenderIcon()}
//           </AvatarFallback>
//         </Avatar>
//       </div>

//       {/* Message Content */}
//       <div className={cn("flex flex-col max-w-xs lg:max-w-md xl:max-w-lg", isOwnMessage && "items-end")}>
//         {/* Sender Name & Time */}
//         <div className={cn("flex items-center space-x-2 mb-2", isOwnMessage && "flex-row-reverse space-x-reverse")}>
//           <span className="text-xs font-semibold text-gray-700">
//             {message.senderName || (isBotMessage ? "DepilBot" : message.sender)}
//           </span>
//           <span className="text-xs text-gray-400">{formatTime(message.timestamp)}</span>
//           {isBotMessage && (
//             <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700 border-purple-200">
//               IA
//             </Badge>
//           )}
//         </div>

//         {/* Message Bubble */}
//         <div
//           className={cn(
//             "rounded-2xl px-4 py-3 break-words shadow-sm",
//             isOwnMessage
//               ? "bg-gradient-to-r from-sky-500 to-sky-600 text-white rounded-br-md"
//               : isBotMessage
//                 ? "bg-gradient-to-r from-purple-50 to-purple-100 text-purple-900 border border-purple-200 rounded-bl-md"
//                 : isClientMessage
//                   ? "bg-gradient-to-r from-blue-50 to-blue-100 text-blue-900 border border-blue-200 rounded-bl-md"
//                   : "bg-gray-100 text-gray-900 rounded-bl-md",
//           )}
//         >
//           {message.type === "IMAGE" && message.imageUrl ? (
//             <div className="space-y-3">
//               <Image
//                 src={message.imageUrl || "/placeholder.svg"}
//                 alt="Imagen enviada"
//                 width={250}
//                 height={250}
//                 className="rounded-lg max-w-full h-auto shadow-sm"
//               />
//               {message.content && <p className="text-sm leading-relaxed">{message.content}</p>}
//             </div>
//           ) : (
//             <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
//           )}
//         </div>

//         {/* Options for Bot Messages */}
//         {isBotMessage && message.options && message.options.length > 0 && isLatestBotMessage && onOptionSelect && (
//           <div className="w-full max-w-sm">
//             <ChatOptions options={message.options} onOptionSelect={onOptionSelect} />
//           </div>
//         )}

//         {/* Message Status (for own messages) */}
//         {isOwnMessage && (
//           <div className="flex items-center space-x-1 mt-2">
//             <Badge variant="outline" className="text-xs bg-sky-50 border-sky-200 text-sky-600">
//               Enviado
//             </Badge>
//           </div>
//         )}
//       </div>
//     </div>
//   )
// }
