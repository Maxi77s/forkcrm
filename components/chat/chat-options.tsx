"use client"

import { Button } from "@/components/ui/button"
import type { ChatOption } from "@/types/chats"
import { ChevronRight, Sparkles } from "lucide-react"

interface ChatOptionsProps {
  options: ChatOption[]
  onOptionSelect: (option: ChatOption) => void
  disabled?: boolean
}

export function ChatOptions({ options, onOptionSelect, disabled = false }: ChatOptionsProps) {
  if (!options || options.length === 0) return null

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center gap-2 text-xs text-purple-600 font-medium">
        <Sparkles className="h-3 w-3" />
        <span>Opciones disponibles:</span>
      </div>

      <div className="space-y-2">
        {options.map((option, index) => (
          <Button
            key={index}
            variant="outline"
            size="sm"
            onClick={() => onOptionSelect(option)}
            disabled={disabled}
            className="w-full justify-between text-left h-auto py-3 px-4 bg-gradient-to-r from-white to-purple-50 hover:from-purple-50 hover:to-purple-100 border-purple-200 text-purple-700 hover:text-purple-800 transition-all duration-200 shadow-sm hover:shadow-md group"
          >
            <span className="text-sm font-medium">{option.label}</span>
            <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform duration-200" />
          </Button>
        ))}
      </div>
    </div>
  )
}
