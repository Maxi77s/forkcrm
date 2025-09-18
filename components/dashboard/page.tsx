"use client"


import { ChatbotWidget } from "@/components/chatbot/chatbot-widget"
import { OperatorDashboard } from "../operator/operator-dashboard"

export default function DashboardPage() {
  return (
    <>
      <OperatorDashboard />

      {/* Chatbot Widget integrado */}
      <ChatbotWidget />
    </>
  )
}
