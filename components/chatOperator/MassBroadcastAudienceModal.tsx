"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Megaphone, Users, MessageCircle, ShoppingBag } from "lucide-react";

export type AudienceSegment = "ALL" | "WHATSAPP" | "ECOMMERCE";

export interface MassBroadcastAudienceModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (payload: {
    segment: AudienceSegment;
    includeInactive: boolean;
  }) => void;

  counts?: Partial<Record<AudienceSegment, number>>;
  defaultSegment?: AudienceSegment;
  defaultIncludeInactive?: boolean;
  title?: string;
  description?: string;
}

export default function MassBroadcastAudienceModal({
  open,
  onOpenChange,
  onConfirm,
  counts,
  defaultSegment = "ALL",
  defaultIncludeInactive = false,
  title = "Difusión de mensajes",
  description = "Elegí a qué grupo de usuarios querés enviar el mensaje masivo.",
}: MassBroadcastAudienceModalProps) {
  const [segment, setSegment] = useState<AudienceSegment>(defaultSegment);
  const [includeInactive, setIncludeInactive] = useState<boolean>(
    defaultIncludeInactive
  );

  useEffect(() => {
    if (open) {
      setSegment(defaultSegment);
      setIncludeInactive(defaultIncludeInactive);
    }
  }, [open, defaultSegment, defaultIncludeInactive]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl p-0 overflow-hidden">
        <div className="px-6 pt-5 pb-3">
          <DialogHeader className="space-y-1">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Megaphone className="h-5 w-5" />
              {title}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {description}
            </DialogDescription>
          </DialogHeader>
        </div>

        <Separator />

        {/* cuerpo en dos columnas: rail de canales + opciones */}
        <div className="flex">
          {/* rail */}
          <aside className="w-40 shrink-0 border-r px-4 py-6">
            <div className="text-[11px] tracking-widest text-muted-foreground">
              OUTBOUND
            </div>
            <div className="mt-3 grid gap-2 text-xs">
              <div className="rounded-md border px-2.5 py-1.5">Todos</div>
              <div className="rounded-md border px-2.5 py-1.5">WhatsApp</div>
              <div className="rounded-md border px-2.5 py-1.5">Email</div>
            </div>
          </aside>

          {/* selector */}
          <main className="flex-1 px-6 py-6">
            <RadioGroup
              value={segment}
              onValueChange={(v) => setSegment(v as AudienceSegment)}
              className="space-y-3"
            >
              <div className="flex items-start gap-3 rounded-lg border p-3">
                <RadioGroupItem value="ALL" id="seg-all" className="mt-1" />
                <div className="grid gap-1">
                  <Label htmlFor="seg-all" className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Todos mis clientes
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {typeof counts?.ALL === "number"
                      ? `${counts?.ALL} usuarios`
                      : "Incluye todos los clientes vinculados al operador."}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg border p-3">
                <RadioGroupItem value="WHATSAPP" id="seg-wa" className="mt-1" />
                <div className="grid gap-1">
                  <Label htmlFor="seg-wa" className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4" />
                    Solo WhatsApp
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {typeof counts?.WHATSAPP === "number"
                      ? `${counts?.WHATSAPP} usuarios`
                      : "Clientes con canal WhatsApp."}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg border p-3">
                <RadioGroupItem
                  value="ECOMMERCE"
                  id="seg-ecom"
                  className="mt-1"
                />
                <div className="grid gap-1">
                  <Label htmlFor="seg-ecom" className="flex items-center gap-2">
                    <ShoppingBag className="h-4 w-4" />
                    Solo E-commerce
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {typeof counts?.ECOMMERCE === "number"
                      ? `${counts?.ECOMMERCE} usuarios`
                      : "Clientes provenientes del e-commerce."}
                  </p>
                </div>
              </div>
            </RadioGroup>

            <Separator className="my-4" />

            <div className="flex items-center space-x-2">
              <Checkbox
                id="include-inactive"
                checked={includeInactive}
                onCheckedChange={(v) => setIncludeInactive(Boolean(v))}
              />
              <Label
                htmlFor="include-inactive"
                className="text-sm text-muted-foreground"
              >
                Incluir usuarios inactivos (últimos 30 días)
              </Label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                type="button"
              >
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  onConfirm({ segment, includeInactive });
                  onOpenChange(false);
                }}
                type="button"
                className="bg-gradient-to-r from-sky-500 to-sky-600 text-white"
              >
                Continuar
              </Button>
            </div>
          </main>
        </div>
      </DialogContent>
    </Dialog>
  );
}
