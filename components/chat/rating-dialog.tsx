"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Star } from "lucide-react"

interface RatingDialogProps {
  isOpen: boolean
  chatId: string
  operatorId: string
  onSubmit: (data: any) => void
  onClose: () => void
}

export function RatingDialog({ isOpen, chatId, operatorId, onSubmit, onClose }: RatingDialogProps) {
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState("")
  const [categories, setCategories] = useState({
    friendliness: 5,
    helpfulness: 5,
    responseTime: 5,
    problemResolution: 5,
  })

  const handleSubmit = () => {
    onSubmit({
      chatId,
      operatorId,
      rating,
      comment,
      categories,
    })
  }

  const StarRating = ({
    value,
    onChange,
    label,
  }: { value: number; onChange: (value: number) => void; label: string }) => (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="flex space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button key={star} type="button" onClick={() => onChange(star)} className="focus:outline-none">
            <Star
              className={`h-6 w-6 ${
                star <= value ? "text-yellow-400 fill-current" : "text-gray-300"
              } hover:text-yellow-400 transition-colors`}
            />
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>⭐ Califica tu experiencia</DialogTitle>
          <DialogDescription>Tu opinión nos ayuda a mejorar nuestro servicio</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <StarRating value={rating} onChange={setRating} label="Calificación general" />

          <div className="space-y-4">
            <h4 className="text-sm font-medium">Califica aspectos específicos:</h4>

            <StarRating
              value={categories.friendliness}
              onChange={(value) => setCategories((prev) => ({ ...prev, friendliness: value }))}
              label="Amabilidad"
            />

            <StarRating
              value={categories.helpfulness}
              onChange={(value) => setCategories((prev) => ({ ...prev, helpfulness: value }))}
              label="Utilidad"
            />

            <StarRating
              value={categories.responseTime}
              onChange={(value) => setCategories((prev) => ({ ...prev, responseTime: value }))}
              label="Tiempo de respuesta"
            />

            <StarRating
              value={categories.problemResolution}
              onChange={(value) => setCategories((prev) => ({ ...prev, problemResolution: value }))}
              label="Resolución del problema"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="comment">Comentarios adicionales (opcional)</Label>
            <Textarea
              id="comment"
              placeholder="Cuéntanos más sobre tu experiencia..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex space-x-2">
            <Button onClick={handleSubmit} className="flex-1">
              Enviar Calificación
            </Button>
            <Button variant="outline" onClick={onClose}>
              Omitir
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
