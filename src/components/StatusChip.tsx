import { Badge } from "@/components/ui/badge";
import { getAttainmentStatus, STATUS_LABEL, type AttainmentStatus } from "@/lib/status";
import { cn } from "@/lib/utils";

const VARIANT: Record<AttainmentStatus, "destructive" | "warning" | "info" | "success" | "neutral"> = {
  critical: "destructive",
  attention: "warning",
  near: "info",
  met: "success",
  none: "neutral",
};

/** Chip de status de atingimento: cor + bolinha + rótulo (cor nunca sozinha). */
export function StatusChip({ pct, className }: { pct: number | null | undefined; className?: string }) {
  const status = getAttainmentStatus(pct);
  return (
    <Badge variant={VARIANT[status]} className={cn("gap-1", className)}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {STATUS_LABEL[status]}
    </Badge>
  );
}
