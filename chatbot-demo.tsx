"use client"

import { ChatbotWidget } from "./components/chatbot/chatbot-widget"

export default function ChatbotDemo() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-8">
      {/* Demo content */}
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">Chatbot Widget Demo</h1>
          <p className="text-xl text-gray-600 mb-8">
            Click the floating button in the bottom-right corner to start chatting!
          </p>
        </div>

        {/* Sample content */}
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          <div className="bg-white rounded-xl p-6 shadow-lg">
            <h2 className="text-2xl font-semibold mb-4 text-gray-800">Features</h2>
            <ul className="space-y-3 text-gray-600">
              <li className="flex items-center">
                <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                Floating button widget
              </li>
              <li className="flex items-center">
                <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                Interactive chat interface
              </li>
              <li className="flex items-center">
                <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                Predefined quick reply buttons
              </li>
              <li className="flex items-center">
                <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                Text input capability
              </li>
              <li className="flex items-center">
                <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                Responsive design
              </li>
              <li className="flex items-center">
                <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                Modern UI with animations
              </li>
            </ul>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg">
            <h2 className="text-2xl font-semibold mb-4 text-gray-800">How to Use</h2>
            <ol className="space-y-3 text-gray-600">
              <li className="flex items-start">
                <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm mr-3 mt-0.5">
                  1
                </span>
                Click the floating chat button
              </li>
              <li className="flex items-start">
                <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm mr-3 mt-0.5">
                  2
                </span>
                Choose from quick reply options
              </li>
              <li className="flex items-start">
                <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm mr-3 mt-0.5">
                  3
                </span>
                Or type your own message
              </li>
              <li className="flex items-start">
                <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm mr-3 mt-0.5">
                  4
                </span>
                Navigate through the conversation flow
              </li>
            </ol>
          </div>
        </div>

        {/* Additional demo content */}
        <div className="bg-white rounded-xl p-8 shadow-lg">
          <h2 className="text-3xl font-semibold mb-6 text-gray-800">About This Widget</h2>
          <div className="prose prose-lg text-gray-600">
            <p>
              This chatbot widget is designed to provide an excellent user experience with modern UI patterns and smooth
              interactions. It features a conversational flow system that guides users through predefined paths while
              also allowing free-form text input.
            </p>
            <p>
              The widget is fully responsive and works seamlessly on both desktop and mobile devices. It includes
              features like typing indicators, message timestamps, and smooth animations to create a natural chat
              experience.
            </p>
          </div>
        </div>
      </div>

      {/* Chatbot Widget */}
      <ChatbotWidget />
    </div>
  )
}
