"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { MessageCircle, X, Send, Bot, User, Minimize2, Sparkles, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface ChatMessage {
  id: string
  content: string
  sender: "user" | "bot"
  timestamp: Date
  options?: ChatOption[]
}

interface ChatOption {
  id: string
  label: string
  value: string
}

interface ChatFlow {
  [key: string]: {
    message: string
    options?: ChatOption[]
    nextStep?: string
  }
}

// Define the chat flow específico para DepilZONE
const chatFlow: ChatFlow = {
  welcome: {
    message: "¡Hola! 👋 Soy tu asistente virtual de DepilZONE. ¿En qué puedo ayudarte hoy?",
    options: [
      { id: "services", label: "🔥 Ver servicios", value: "services" },
      { id: "pricing", label: "💰 Consultar precios", value: "pricing" },
      { id: "appointment", label: "📅 Agendar cita", value: "appointment" },
      { id: "support", label: "🆘 Soporte técnico", value: "support" },
    ],
  },
  services: {
    message: "En DepilZONE ofrecemos servicios especializados con tecnología de última generación:",
    options: [
      { id: "service1", label: "⚡ Depilación láser", value: "laser" },
      { id: "service2", label: "✨ Tratamientos faciales", value: "facial" },
      { id: "service3", label: "💆 Cuidado corporal", value: "body" },
      { id: "back", label: "← Volver al menú", value: "welcome" },
    ],
  },
  pricing: {
    message: "Nuestros precios son muy competitivos. ¿Qué servicio te interesa?",
    options: [
      { id: "price1", label: "Depilación láser - desde $80", value: "price_laser" },
      { id: "price2", label: "Tratamientos faciales - desde $120", value: "price_facial" },
      { id: "price3", label: "Paquetes completos - Descuentos", value: "packages" },
      { id: "back", label: "← Volver al menú", value: "welcome" },
    ],
  },
  appointment: {
    message: "¡Perfecto! Para agendar tu cita en DepilZONE necesito algunos datos:",
    options: [
      { id: "online", label: "🌐 Agendar online", value: "book_online" },
      { id: "phone", label: "📞 Llamar ahora", value: "call_now" },
      { id: "whatsapp", label: "💬 WhatsApp", value: "whatsapp" },
      { id: "back", label: "← Volver al menú", value: "welcome" },
    ],
  },
  support: {
    message: "Estoy aquí para ayudarte con cualquier consulta sobre DepilZONE. ¿Cuál es tu consulta?",
    options: [
      { id: "tech1", label: "🌐 Problema con la web", value: "web_issue" },
      { id: "tech2", label: "❓ Consulta general", value: "general" },
      { id: "tech3", label: "👨‍💼 Hablar con especialista", value: "human" },
      { id: "back", label: "← Volver al menú", value: "welcome" },
    ],
  },
  laser: {
    message:
      "🔥 La depilación láser es nuestro servicio estrella en DepilZONE. Utilizamos tecnología IPL de última generación para resultados duraderos y seguros. ¡Sin dolor y con garantía!",
    options: [
      { id: "laser_info", label: "📋 Más información", value: "laser_details" },
      { id: "laser_book", label: "📅 Agendar consulta", value: "appointment" },
      { id: "laser_price", label: "💰 Ver precios", value: "price_laser" },
      { id: "back", label: "← Volver a servicios", value: "services" },
    ],
  },
  human: {
    message:
      "Te conectaré con uno de nuestros especialistas de DepilZONE. Por favor, espera un momento mientras te asigno a un operador disponible...",
    options: [
      { id: "wait", label: "⏳ Esperando conexión...", value: "waiting" },
      { id: "back", label: "← Volver al menú", value: "welcome" },
    ],
  },
  book_online: {
    message:
      "🌐 Para agendar tu cita online en DepilZONE, visita nuestra plataforma de reservas o proporciona tu información de contacto.",
    options: [
      { id: "contact_form", label: "📝 Formulario de contacto", value: "contact" },
      { id: "call_back", label: "📞 Que me llamen", value: "callback" },
      { id: "back", label: "← Volver", value: "appointment" },
    ],
  },
  price_laser: {
    message:
      "💰 Depilación láser en DepilZONE:\n\n• Sesión individual: desde $80\n• Paquete 6 sesiones: $420 (ahorra $60)\n• Paquete completo: $750 (ahorra $150)\n\n¡Consulta por promociones vigentes!",
    options: [
      { id: "promo", label: "🎉 Ver promociones", value: "promotions" },
      { id: "book_laser", label: "📅 Agendar ahora", value: "appointment" },
      { id: "back", label: "← Volver a precios", value: "pricing" },
    ],
  },
}

export function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState("")
  const [currentStep, setCurrentStep] = useState("welcome")
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Initialize chat when opened
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setTimeout(() => {
        addBotMessage(chatFlow.welcome.message, chatFlow.welcome.options)
      }, 500)
    }
  }, [isOpen])

  const addBotMessage = (content: string, options?: ChatOption[]) => {
    setIsTyping(true)

    setTimeout(() => {
      const newMessage: ChatMessage = {
        id: Date.now().toString(),
        content,
        sender: "bot",
        timestamp: new Date(),
        options,
      }

      setMessages((prev) => [...prev, newMessage])
      setIsTyping(false)
    }, 1000)
  }

  const addUserMessage = (content: string) => {
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      content,
      sender: "user",
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, newMessage])
  }

  const handleOptionClick = (option: ChatOption) => {
    addUserMessage(option.label)

    setTimeout(() => {
      const nextFlow = chatFlow[option.value]
      if (nextFlow) {
        setCurrentStep(option.value)
        addBotMessage(nextFlow.message, nextFlow.options)
      } else {
        addBotMessage("Gracias por tu consulta. ¿Hay algo más en lo que pueda ayudarte?", chatFlow.welcome.options)
        setCurrentStep("welcome")
      }
    }, 800)
  }

  const handleSendMessage = () => {
    if (!inputValue.trim()) return

    addUserMessage(inputValue)

    setTimeout(() => {
      addBotMessage(
        "Gracias por tu mensaje. Un especialista revisará tu consulta y te responderá pronto. ¿Puedo ayudarte con algo más?",
        chatFlow.welcome.options,
      )
      setCurrentStep("welcome")
    }, 1000)

    setInputValue("")
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  // Floating button
  if (!isOpen) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={() => setIsOpen(true)}
          className="h-14 w-14 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-110"
        >
          <MessageCircle className="h-6 w-6 text-white" />
        </Button>

        {/* Notification badge */}
        <div className="absolute -top-2 -left-2 h-6 w-6 bg-red-500 rounded-full flex items-center justify-center">
          <span className="text-xs text-white font-bold">1</span>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Card
        className={cn(
          "w-80 sm:w-96 transition-all duration-300 shadow-2xl border-0",
          isMinimized ? "h-16" : "h-[500px]",
        )}
      >
        {/* Header */}
        <CardHeader className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-4 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Avatar className="h-10 w-10 border-2 border-white/20">
                <AvatarFallback className="bg-white/20 text-white">
                  <Bot className="h-5 w-5" />
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-semibold text-lg">DepilZONE Assistant</h3>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-sm opacity-90">En línea • IA</span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMinimized(!isMinimized)}
                className="text-white hover:bg-white/20 h-8 w-8 p-0"
              >
                <Minimize2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="text-white hover:bg-white/20 h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* Chat Content */}
        {!isMinimized && (
          <CardContent className="p-0 flex flex-col h-[436px]">
            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map((message) => (
                  <div key={message.id} className="space-y-3">
                    {/* Message bubble */}
                    <div
                      className={cn(
                        "flex items-start space-x-3",
                        message.sender === "user" && "flex-row-reverse space-x-reverse",
                      )}
                    >
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarFallback
                          className={cn(
                            message.sender === "bot"
                              ? "bg-gradient-to-r from-blue-100 to-purple-100 text-blue-600"
                              : "bg-gray-100 text-gray-600",
                          )}
                        >
                          {message.sender === "bot" ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
                        </AvatarFallback>
                      </Avatar>

                      <div
                        className={cn(
                          "max-w-[75%] rounded-2xl px-4 py-3 shadow-sm",
                          message.sender === "bot"
                            ? "bg-gradient-to-r from-gray-50 to-gray-100 text-gray-800 rounded-bl-sm"
                            : "bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-br-sm",
                        )}
                      >
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                        <span
                          className={cn(
                            "text-xs mt-2 block",
                            message.sender === "bot" ? "text-gray-500" : "text-white/70",
                          )}
                        >
                          {formatTime(message.timestamp)}
                        </span>
                      </div>
                    </div>

                    {/* Options */}
                    {message.sender === "bot" && message.options && (
                      <div className="ml-11 space-y-2">
                        <div className="flex items-center gap-2 text-xs text-purple-600 font-medium">
                          <Sparkles className="h-3 w-3" />
                          <span>Opciones rápidas:</span>
                        </div>
                        <div className="grid gap-2">
                          {message.options.map((option) => (
                            <Button
                              key={option.id}
                              variant="outline"
                              size="sm"
                              onClick={() => handleOptionClick(option)}
                              className="justify-between text-left h-auto py-3 px-4 bg-gradient-to-r from-white to-blue-50 hover:from-blue-50 hover:to-purple-50 border-blue-200 text-blue-700 hover:text-purple-700 transition-all duration-200 shadow-sm hover:shadow-md group"
                            >
                              <span className="text-sm font-medium">{option.label}</span>
                              <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform duration-200" />
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Typing indicator */}
                {isTyping && (
                  <div className="flex items-start space-x-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-gradient-to-r from-blue-100 to-purple-100 text-blue-600">
                        <Bot className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                        <div
                          className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                          style={{ animationDelay: "150ms" }}
                        />
                        <div
                          className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                          style={{ animationDelay: "300ms" }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="border-t bg-white p-4">
              <div className="flex items-center space-x-2">
                <Input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Escribe tu mensaje..."
                  className="flex-1 border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-full"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim()}
                  className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-full h-10 w-10 p-0 shadow-md"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-2 text-center">Presiona Enter para enviar • Powered by IA</p>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  )
}
