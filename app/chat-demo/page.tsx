"use client"

import { SidebarInset } from "@/components/ui/sidebar"
import { ChatbotWidget } from "@/components/chatbot/chatbot-widget"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MessageSquare, Bot, Sparkles, Zap } from "lucide-react"

export default function ChatbotDemoPage() {
  return (
    <SidebarInset>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-full p-3 mr-4">
                <Bot className="h-8 w-8 text-white" />
              </div>
              <h1 className="text-4xl font-bold text-gray-800">Demo Chatbot DepilZONE</h1>
            </div>
            <p className="text-xl text-gray-600 mb-6">Prueba nuestro asistente virtual inteligente</p>
            <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg p-4 mb-8 max-w-2xl mx-auto">
              <div className="flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-yellow-600 mr-2" />
                <p className="text-yellow-800 font-medium">
                  👆 Busca el botón flotante azul en la esquina inferior derecha
                </p>
              </div>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-blue-50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-blue-600">
                  <MessageSquare className="h-5 w-5 mr-2" />
                  Características
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-gray-600">
                  <li className="flex items-center">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                    Interfaz moderna y responsive
                  </li>
                  <li className="flex items-center">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                    Respuestas rápidas predefinidas
                  </li>
                  <li className="flex items-center">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                    Chat en tiempo real
                  </li>
                  <li className="flex items-center">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                    Indicadores de escritura
                  </li>
                  <li className="flex items-center">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                    Minimizar/maximizar
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-purple-50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-purple-600">
                  <Zap className="h-5 w-5 mr-2" />
                  Servicios DepilZONE
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-gray-600">
                  <li className="flex items-center">
                    <div className="w-2 h-2 bg-purple-500 rounded-full mr-3"></div>
                    Depilación láser avanzada
                  </li>
                  <li className="flex items-center">
                    <div className="w-2 h-2 bg-purple-500 rounded-full mr-3"></div>
                    Tratamientos faciales
                  </li>
                  <li className="flex items-center">
                    <div className="w-2 h-2 bg-purple-500 rounded-full mr-3"></div>
                    Cuidado corporal integral
                  </li>
                  <li className="flex items-center">
                    <div className="w-2 h-2 bg-purple-500 rounded-full mr-3"></div>
                    Consultas especializadas
                  </li>
                  <li className="flex items-center">
                    <div className="w-2 h-2 bg-purple-500 rounded-full mr-3"></div>
                    Agendamiento online
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-green-50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-green-600">
                  <Bot className="h-5 w-5 mr-2" />
                  Cómo Usar
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-3 text-gray-600">
                  <li className="flex items-start">
                    <Badge className="bg-green-500 text-white text-xs mr-3 mt-0.5">1</Badge>
                    Busca el botón flotante
                  </li>
                  <li className="flex items-start">
                    <Badge className="bg-green-500 text-white text-xs mr-3 mt-0.5">2</Badge>
                    Haz clic para abrir
                  </li>
                  <li className="flex items-start">
                    <Badge className="bg-green-500 text-white text-xs mr-3 mt-0.5">3</Badge>
                    Elige opciones rápidas
                  </li>
                  <li className="flex items-start">
                    <Badge className="bg-green-500 text-white text-xs mr-3 mt-0.5">4</Badge>O escribe libremente
                  </li>
                  <li className="flex items-start">
                    <Badge className="bg-green-500 text-white text-xs mr-3 mt-0.5">5</Badge>
                    Navega por el menú
                  </li>
                </ol>
              </CardContent>
            </Card>
          </div>

          {/* Flujo de conversación */}
          <Card className="border-0 shadow-lg bg-gradient-to-r from-white to-slate-50 mb-8">
            <CardHeader>
              <CardTitle className="text-2xl text-gray-800 flex items-center">
                <MessageSquare className="h-6 w-6 mr-3 text-sky-500" />
                Flujo de Conversación
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-sky-600 flex items-center">
                    <div className="w-3 h-3 bg-sky-500 rounded-full mr-2"></div>
                    Menú Principal
                  </h3>
                  <div className="space-y-2 text-gray-600">
                    <div className="bg-sky-50 rounded-lg p-3 border border-sky-200">
                      <p className="font-medium">Ver servicios</p>
                      <p className="text-sm text-gray-500">Información sobre depilación láser y tratamientos</p>
                    </div>
                    <div className="bg-sky-50 rounded-lg p-3 border border-sky-200">
                      <p className="font-medium">Consultar precios</p>
                      <p className="text-sm text-gray-500">Tarifas y promociones actuales</p>
                    </div>
                    <div className="bg-sky-50 rounded-lg p-3 border border-sky-200">
                      <p className="font-medium">Agendar cita</p>
                      <p className="text-sm text-gray-500">Reserva tu consulta online</p>
                    </div>
                    <div className="bg-sky-50 rounded-lg p-3 border border-sky-200">
                      <p className="font-medium">Soporte técnico</p>
                      <p className="text-sm text-gray-500">Ayuda y contacto con especialistas</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4 text-purple-600 flex items-center">
                    <div className="w-3 h-3 bg-purple-500 rounded-full mr-2"></div>
                    Opciones Avanzadas
                  </h3>
                  <div className="space-y-2 text-gray-600">
                    <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                      <p className="font-medium">Conexión con operador</p>
                      <p className="text-sm text-gray-500">Chat directo con especialista humano</p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                      <p className="font-medium">Información detallada</p>
                      <p className="text-sm text-gray-500">Especificaciones técnicas de tratamientos</p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                      <p className="font-medium">Navegación intuitiva</p>
                      <p className="text-sm text-gray-500">Botones "Volver" en cada sección</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Instrucciones de prueba */}
          <Card className="border-0 shadow-lg bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
            <CardHeader>
              <CardTitle className="text-2xl text-gray-800 flex items-center">
                <Sparkles className="h-6 w-6 mr-3 text-blue-500" />
                Instrucciones de Prueba
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">
                      1
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">Localiza el botón flotante</p>
                      <p className="text-sm text-gray-600">Círculo azul con gradiente en la esquina inferior derecha</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="bg-purple-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">
                      2
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">Abre el chat</p>
                      <p className="text-sm text-gray-600">Haz clic y verás el mensaje de bienvenida automático</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="bg-green-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">
                      3
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">Interactúa</p>
                      <p className="text-sm text-gray-600">Usa botones de opciones o escribe mensajes personalizados</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="bg-orange-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">
                      4
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">Explora</p>
                      <p className="text-sm text-gray-600">Navega por servicios, precios y opciones de contacto</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Chatbot Widget */}
      <ChatbotWidget />
    </SidebarInset>
  )
}
