import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";
import type { stopReason } from "../lib/route-reasons";

export function AdvicePanel({ title, compact = false, children }: { title: string; compact?: boolean; children: ReactNode }) {
  return <div className={`trip-advice ${compact ? "trip-advice-compact" : "tp-stop-reason"}`}>
    <div className="trip-advice-heading"><Sparkles aria-hidden="true" /><strong>{title}</strong></div>
    {children}
  </div>;
}

export default function StopAdvice({ reason, compact = false }: { reason: ReturnType<typeof stopReason>; compact?: boolean }) {
  return <AdvicePanel title="Почему эта остановка" compact={compact}>
    <p>{reason.why}</p>
    <p>{reason.daysReason} {reason.connection}</p>
    {reason.caveat && <p className="trip-advice-note">{reason.caveat}</p>}
    <details className="trip-advice-programme"><summary>Программа и совет по планированию</summary>
      <p>{reason.load}</p>
      {reason.practical && <p>{reason.practical}</p>}
    </details>
  </AdvicePanel>;
}
