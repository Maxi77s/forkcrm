"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  assignWithAutoHeal,     // ← usa auto-heal + cooldown
  listAvailableOperators,
  setOperatorState,
  releaseOperator,
  type OperatorState,
} from "@/components/helpers/helper.assign";

function uuid() {
  if (typeof crypto !== "undefined" && (crypto as any).randomUUID)
    return (crypto as any).randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

type Props = {
  operatorId: string;
  currentState?: OperatorState;
  onAssigned?: () => void;
};

export default function AssignOperator({
  operatorId,
  currentState,
  onAssigned,
}: Props) {
  const [state, setState] = useState<OperatorState>(currentState ?? "AVAILABLE");
  const [availableOps, setAvailableOps] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const disabled = !operatorId;

  // contador de disponibles
  useEffect(() => {
    let alive = true;
    if (!operatorId) return;

    const load = async () => {
      try {
        const ops = await listAvailableOperators();
        if (!alive) return;
        setAvailableOps(Array.isArray(ops) ? ops.length : 0);
      } catch {
        if (!alive) return;
        setAvailableOps(0);
      }
    };

    load();
    const id = setInterval(load, 8000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [operatorId]);

  const toggleState = async () => {
    if (!operatorId) return;
    const next: OperatorState = state === "AVAILABLE" ? "BUSY" : "AVAILABLE";
    try {
      await setOperatorState(operatorId, next);
      setState(next);
    } catch (e) {
      console.error("[AssignOperator] setOperatorState error:", e);
    }
  };

  const takeNext = async () => {
    if (!operatorId) return;
    setLoading(true);
    try {
      await assignWithAutoHeal(operatorId);
      onAssigned?.();
    } catch (e) {
      console.error("[AssignOperator] assignWithAutoHeal error:", e);
    } finally {
      setLoading(false);
    }
  };

  const unlock = async () => {
    if (!operatorId) return;
    try {
      await releaseOperator(operatorId);
      onAssigned?.();
    } catch (e) {
      console.error("[AssignOperator] releaseOperator error:", e);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge
        variant={state === "AVAILABLE" ? "default" : "secondary"}
        className="text-[11px]"
      >
        {state === "AVAILABLE" ? "Disponible" : "Ocupado"}
      </Badge>

      <Button size="sm" variant="outline" onClick={toggleState} disabled={disabled}>
        {state === "AVAILABLE" ? "Poner en Ocupado" : "Poner en Disponible"}
      </Button>

      <Button
        size="sm"
        onClick={takeNext}
        disabled={disabled || loading || state !== "AVAILABLE"}
      >
        {loading ? "Tomando..." : "Tomar siguiente"}
      </Button>

      <Button
        size="sm"
        variant="secondary"
        onClick={unlock}
        disabled={disabled}
        title="POST /operators/{id}/release"
      >
        Destrabar
      </Button>

      <Badge variant="outline" className="text-[11px]">
        Operadores disp.: {availableOps}
      </Badge>
    </div>
  );
}
