import { ArrowRight } from "lucide-react";
import type { TripInput } from "../types";
import type { RouteRecovery } from "../lib/route-recovery";
import { usePlannerTask } from "../lib/use-planner-task";
import LoadingStatus from "./LoadingStatus";

export default function RouteRecoveryOptions({ input, onApply }: {
  input: TripInput; onApply: (change: RouteRecovery) => void;
}) {
  const calculation = usePlannerTask({ kind: "recoveries", input });
  const choices = calculation.result ?? [];
  if (calculation.status === "loading") return <LoadingStatus>Ищем, какое пожелание можно изменить…</LoadingStatus>;
  if (calculation.status === "error") return <div role="alert"><p>{calculation.error}</p><button className="tv-button tv-secondary" onClick={calculation.retry}>Повторить поиск подсказок</button></div>;
  if (!choices.length) return null;
  return <div className="route-recovery-options">
    <p>Можно изменить одно условие — остальные пожелания сохраним:</p>
    <div>{choices.map(change => <button type="button" key={change.id} onClick={() => onApply(change)}>
      <span><strong>{change.label}</strong><small>{change.hint}</small></span><ArrowRight />
    </button>)}</div>
    <small>Проверено по предварительному каталогу. Любое изменение можно отменить.</small>
  </div>;
}
