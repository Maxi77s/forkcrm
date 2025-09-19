"use client"

import { useState } from "react"
import { useSocket } from "@/components/providers/socket-provider"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { DollarSign } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface SaleConfirmationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  chatId: string
  clientDni: number
}

export function SaleConfirmationDialog({ open, onOpenChange, chatId, clientDni }: SaleConfirmationDialogProps) {
  const { socket } = useSocket()
  const { toast } = useToast()

  const [saleData, setSaleData] = useState({
    amount: "",
    description: "",
    productName: "",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!saleData.amount || !saleData.description || !socket) return

    setIsSubmitting(true)

    try {
      socket.emit("confirmSale", {
        chatId,
        amount: Number.parseFloat(saleData.amount),
        description: saleData.description,
        productName: saleData.productName || undefined,
      })

      toast({
        title: "¡Venta confirmada!",
        description: `Venta de $${saleData.amount} registrada correctamente.`,
      })

      setSaleData({
        amount: "",
        description: "",
        productName: "",
      })

      onOpenChange(false)
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo confirmar la venta. Inténtalo de nuevo.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <DollarSign className="h-5 w-5" />
            <span>Confirmar Venta</span>
          </DialogTitle>
          <DialogDescription>Registra los detalles de la venta realizada con {clientDni}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Monto de la venta *</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={saleData.amount}
              onChange={(e) => setSaleData({ ...saleData, amount: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="productName">Nombre del producto (opcional)</Label>
            <Input
              id="productName"
              placeholder="Ej: Plan Premium, Producto X..."
              value={saleData.productName}
              onChange={(e) => setSaleData({ ...saleData, productName: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción de la venta *</Label>
            <Textarea
              id="description"
              placeholder="Describe los detalles de la venta..."
              value={saleData.description}
              onChange={(e) => setSaleData({ ...saleData, description: e.target.value })}
              rows={3}
              required
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!saleData.amount || !saleData.description || isSubmitting}>
            {isSubmitting ? "Confirmando..." : "Confirmar Venta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
